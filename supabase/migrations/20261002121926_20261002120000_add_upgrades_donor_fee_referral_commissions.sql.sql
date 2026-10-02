/*
# Add paid upgrades, donor fee coverage, and donation referral commissions

## Summary
Implements paid upgrade options for campaigns, an optional donor processing fee
toggle, and 5% referral commissions on all donations.

## Changes

### 1. New columns on `requests`
- `is_verified` (boolean, default false) — shows a verified badge on the card
- `is_gold` (boolean, default false) — applies premium gold card styling
- `bumped_at` (timestamptz, nullable) — timestamp for bump-to-top sorting

### 2. New columns on `transactions`
- `cover_fee` (boolean, default false) — whether donor covered the processing fee
- `fee_amount` (numeric, default 0) — processing fee amount in Stars

### 3. Modified `referral_earnings` constraint
- Adds `'donation'` as a valid `source_type` for tracking donation commissions

### 4. Recreated `donate_stars(uuid, numeric)` -> `donate_stars(uuid, numeric, boolean)`
- New `p_cover_fee` parameter (default false)
- When true: donor pays amount + 5% processing fee; campaign receives only the base amount
- Records 5% referral commission to the donor's referrer on every donation
- Tracks fee in transactions table

### 5. New function `purchase_upgrade(uuid, text)`
- Accepts upgrade types: 'bump' (1 Star), 'verified' (2 Stars), 'gold' (6 Stars)
- Deducts Stars from caller's balance, applies upgrade flags to the request
- 'gold' applies verified + gold styling + bump
- 'bump' can be re-purchased to re-bump

## Security
- All functions are SECURITY DEFINER with SET search_path = public, pg_temp
- EXECUTE restricted to authenticated only
- Existing RLS policies cover new columns (same tables, same ownership checks)
*/

-- 1. Add upgrade columns to requests
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'is_verified') THEN
    ALTER TABLE requests ADD COLUMN is_verified boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'is_gold') THEN
    ALTER TABLE requests ADD COLUMN is_gold boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'bumped_at') THEN
    ALTER TABLE requests ADD COLUMN bumped_at timestamptz;
  END IF;
END $$;

-- 2. Add fee columns to transactions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'cover_fee') THEN
    ALTER TABLE transactions ADD COLUMN cover_fee boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'fee_amount') THEN
    ALTER TABLE transactions ADD COLUMN fee_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 3. Add 'donation' to referral_earnings source_type check
DO $$
DECLARE v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.referral_earnings'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%platform_fee%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.referral_earnings DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE public.referral_earnings ADD CONSTRAINT referral_earnings_source_type_check
    CHECK (source_type IN ('platform_fee', 'payout_fee', 'donation'));
END $$;

-- 4. Recreate donate_stars with cover_fee + referral commission
DROP FUNCTION IF EXISTS public.donate_stars(uuid, numeric);

CREATE OR REPLACE FUNCTION public.donate_stars(p_request_id uuid, p_amount numeric, p_cover_fee boolean DEFAULT false)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_balance numeric;
  v_new_total numeric;
  v_target numeric;
  v_is_unlimited boolean;
  v_fee numeric;
  v_total_charge numeric;
  v_transaction_id uuid;
  v_referrer_id uuid;
  v_commission numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Donation amount must be positive';
  END IF;

  v_fee := CASE WHEN p_cover_fee THEN round(p_amount * 0.05, 2) ELSE 0 END;
  v_total_charge := p_amount + v_fee;

  -- Lock and check donor balance
  SELECT stars_balance INTO v_balance
  FROM profiles WHERE id = auth.uid() FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_balance < v_total_charge THEN
    RAISE EXCEPTION 'Insufficient Stars balance';
  END IF;

  -- Deduct total (donation + optional fee) from donor
  UPDATE profiles
  SET stars_balance = stars_balance - v_total_charge,
      updated_at = now()
  WHERE id = auth.uid();

  -- Record transaction
  INSERT INTO transactions (donor_id, request_id, stars_amount, cover_fee, fee_amount)
  VALUES (auth.uid(), p_request_id, p_amount, p_cover_fee, v_fee)
  RETURNING id INTO v_transaction_id;

  -- Update campaign progress
  SELECT final_target, current_stars, is_unlimited
  INTO v_target, v_new_total, v_is_unlimited
  FROM requests WHERE id = p_request_id FOR UPDATE;

  IF v_new_total IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  v_new_total := v_new_total + p_amount;

  IF v_is_unlimited THEN
    UPDATE requests SET current_stars = v_new_total, updated_at = now() WHERE id = p_request_id;
  ELSE
    UPDATE requests
    SET current_stars = v_new_total,
        status = CASE WHEN v_new_total >= v_target THEN 'funded' ELSE status END,
        updated_at = now()
    WHERE id = p_request_id;
  END IF;

  -- 5% referral commission on donations
  SELECT referred_by INTO v_referrer_id
  FROM profiles WHERE id = auth.uid() FOR SHARE;

  IF v_referrer_id IS NOT NULL AND v_referrer_id <> auth.uid() THEN
    v_commission := round(p_amount * 0.05, 2);
    IF v_commission > 0 THEN
      INSERT INTO referral_earnings (referrer_id, source_user_id, source_type, source_id, fee_stars, platform_share_stars, referrer_share_stars)
      VALUES (v_referrer_id, auth.uid(), 'donation', v_transaction_id, v_commission, 0, v_commission)
      ON CONFLICT (source_type, source_id) DO NOTHING;
      UPDATE profiles SET stars_balance = stars_balance + v_commission, updated_at = now() WHERE id = v_referrer_id;
    END IF;
  END IF;

  RETURN v_new_total;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.donate_stars(uuid, numeric, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.donate_stars(uuid, numeric, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.donate_stars(uuid, numeric, boolean) TO authenticated;

-- 5. Create purchase_upgrade function
CREATE OR REPLACE FUNCTION public.purchase_upgrade(p_request_id uuid, p_upgrade_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_balance numeric;
  v_owner uuid;
  v_cost numeric;
  v_is_verified boolean;
  v_is_gold boolean;
BEGIN
  IF p_upgrade_type NOT IN ('bump', 'verified', 'gold') THEN
    RAISE EXCEPTION 'Invalid upgrade type. Use bump, verified, or gold.';
  END IF;

  v_cost := CASE p_upgrade_type
    WHEN 'bump' THEN 1
    WHEN 'verified' THEN 2
    WHEN 'gold' THEN 6
  END;

  -- Check ownership and current state
  SELECT user_id, is_verified, is_gold INTO v_owner, v_is_verified, v_is_gold
  FROM requests WHERE id = p_request_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'You can only upgrade your own requests';
  END IF;

  -- Prevent duplicate purchases (bump can be re-purchased)
  IF p_upgrade_type = 'verified' AND v_is_verified THEN
    RAISE EXCEPTION 'This request already has a verified badge';
  END IF;

  IF p_upgrade_type = 'gold' AND v_is_gold THEN
    RAISE EXCEPTION 'This request already has the Gold Wish Bundle';
  END IF;

  -- Check and deduct balance
  SELECT stars_balance INTO v_balance
  FROM profiles WHERE id = auth.uid() FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient Stars balance';
  END IF;

  UPDATE profiles
  SET stars_balance = stars_balance - v_cost,
      updated_at = now()
  WHERE id = auth.uid();

  -- Apply upgrade
  IF p_upgrade_type = 'bump' THEN
    UPDATE requests SET bumped_at = now(), updated_at = now() WHERE id = p_request_id;
  ELSIF p_upgrade_type = 'verified' THEN
    UPDATE requests SET is_verified = true, updated_at = now() WHERE id = p_request_id;
  ELSIF p_upgrade_type = 'gold' THEN
    UPDATE requests SET is_gold = true, is_verified = true, bumped_at = now(), updated_at = now() WHERE id = p_request_id;
  END IF;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.purchase_upgrade(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purchase_upgrade(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.purchase_upgrade(uuid, text) TO authenticated;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
