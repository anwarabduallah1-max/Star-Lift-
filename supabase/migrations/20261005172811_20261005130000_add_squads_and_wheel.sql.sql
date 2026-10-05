/*
# Add Squads (Trio Teams) and Fair Random Donation Wheel

## Overview
1. **Trio Squad System** — 3-member teams with combined donation tracking and member rankings.
2. **Fair Random Donation Wheel** — Pay 1 Star, spin to donate to a random campaign (prioritizing $0-raised).

## New Tables
- squads (id, name, owner_id, invite_code, created_at)
- squad_members (id, squad_id, user_id, joined_at, unique(squad_id, user_id))
- wheel_spins (id, user_id, stars_spent, selected_request_id, candidates, created_at)

## RPCs
- create_squad(p_name) — creates squad, auto-joins as first member
- join_squad(p_invite_code) — joins by code if < 3 members
- leave_squad(p_squad_id) — removes caller, transfers/deletes as needed
- get_my_squad() — returns squad + ranked members with donation totals
- spin_wheel() — deducts 1 Star, picks 6 campaigns, randomly donates to one

## Security
- RLS on all tables with ownership/membership checks.
- spin_wheel is SECURITY DEFINER for atomic balance + donation.
*/

-- ============ TABLES ============

CREATE TABLE IF NOT EXISTS squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My Squad',
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code text UNIQUE NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS squad_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (squad_id, user_id)
);

CREATE TABLE IF NOT EXISTS wheel_spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stars_spent numeric NOT NULL DEFAULT 1,
  selected_request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  candidates jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_squad_members_user ON squad_members(user_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_squad ON squad_members(squad_id);
CREATE INDEX IF NOT EXISTS idx_squads_invite_code ON squads(invite_code);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_user ON wheel_spins(user_id);

-- ============ RLS: SQUADS ============

ALTER TABLE squads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_squads" ON squads;
CREATE POLICY "select_squads" ON squads FOR SELECT
TO authenticated USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM squad_members WHERE squad_members.user_id = auth.uid() AND squad_members.squad_id = squads.id)
);

DROP POLICY IF EXISTS "insert_own_squads" ON squads;
CREATE POLICY "insert_own_squads" ON squads FOR INSERT
TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "update_own_squads" ON squads;
CREATE POLICY "update_own_squads" ON squads FOR UPDATE
TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_squads" ON squads;
CREATE POLICY "delete_own_squads" ON squads FOR DELETE
TO authenticated USING (owner_id = auth.uid());

-- ============ RLS: SQUAD MEMBERS ============

ALTER TABLE squad_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_squad_members" ON squad_members;
CREATE POLICY "select_squad_members" ON squad_members FOR SELECT
TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_members.squad_id AND s.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM squad_members sm WHERE sm.squad_id = squad_members.squad_id AND sm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "insert_own_squad_membership" ON squad_members;
CREATE POLICY "insert_own_squad_membership" ON squad_members FOR INSERT
TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_squad_membership" ON squad_members;
CREATE POLICY "delete_own_squad_membership" ON squad_members FOR DELETE
TO authenticated USING (user_id = auth.uid());

-- ============ RLS: WHEEL SPINS ============

ALTER TABLE wheel_spins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wheel_spins" ON wheel_spins;
CREATE POLICY "select_own_wheel_spins" ON wheel_spins FOR SELECT
TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_wheel_spins" ON wheel_spins;
CREATE POLICY "insert_own_wheel_spins" ON wheel_spins FOR INSERT
TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ RPCs: SQUAD ============

CREATE OR REPLACE FUNCTION create_squad(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_squad record;
  v_existing_count int;
BEGIN
  SELECT count(*) INTO v_existing_count
  FROM squad_members WHERE user_id = auth.uid();
  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'You are already in a squad. Leave it first.';
  END IF;

  INSERT INTO squads (name, owner_id)
  VALUES (COALESCE(NULLIF(TRIM(p_name), ''), 'My Squad'), auth.uid())
  RETURNING * INTO v_squad;

  INSERT INTO squad_members (squad_id, user_id)
  VALUES (v_squad.id, auth.uid());

  RETURN jsonb_build_object('id', v_squad.id, 'name', v_squad.name, 'invite_code', v_squad.invite_code);
END;
$$;

CREATE OR REPLACE FUNCTION join_squad(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_squad record;
  v_member_count int;
  v_existing_count int;
BEGIN
  SELECT count(*) INTO v_existing_count
  FROM squad_members WHERE user_id = auth.uid();
  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'You are already in a squad. Leave it first.';
  END IF;

  SELECT * INTO v_squad FROM squads WHERE invite_code = UPPER(TRIM(p_invite_code));
  IF v_squad IS NULL THEN
    RAISE EXCEPTION 'Squad not found. Check the invite code.';
  END IF;

  SELECT count(*) INTO v_member_count
  FROM squad_members WHERE squad_id = v_squad.id;
  IF v_member_count >= 3 THEN
    RAISE EXCEPTION 'This squad is full (3/3 members).';
  END IF;

  INSERT INTO squad_members (squad_id, user_id)
  VALUES (v_squad.id, auth.uid());

  RETURN jsonb_build_object('id', v_squad.id, 'name', v_squad.name, 'invite_code', v_squad.invite_code);
END;
$$;

CREATE OR REPLACE FUNCTION leave_squad(p_squad_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  DELETE FROM squad_members
  WHERE squad_id = p_squad_id AND user_id = auth.uid();

  UPDATE squads SET owner_id = (
    SELECT user_id FROM squad_members WHERE squad_id = p_squad_id ORDER BY joined_at LIMIT 1
  )
  WHERE id = p_squad_id AND owner_id NOT IN (
    SELECT user_id FROM squad_members WHERE squad_id = p_squad_id
  );

  DELETE FROM squads
  WHERE id = p_squad_id AND NOT EXISTS (
    SELECT 1 FROM squad_members WHERE squad_id = p_squad_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_my_squad()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_squad record;
  v_members jsonb;
BEGIN
  SELECT s.* INTO v_squad
  FROM squads s
  JOIN squad_members sm ON sm.squad_id = s.id
  WHERE sm.user_id = auth.uid()
  LIMIT 1;

  IF v_squad IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', m.user_id,
    'username', p.username,
    'avatar_url', p.avatar_url,
    'total_donated', COALESCE(d.total_donated, 0),
    'joined_at', m.joined_at
  ) ORDER BY COALESCE(d.total_donated, 0) DESC, m.joined_at ASC), '[]'::jsonb) INTO v_members
  FROM squad_members m
  JOIN profiles p ON p.id = m.user_id
  LEFT JOIN (
    SELECT donor_id, SUM(stars_amount) AS total_donated
    FROM transactions
    GROUP BY donor_id
  ) d ON d.donor_id = m.user_id
  WHERE m.squad_id = v_squad.id;

  RETURN jsonb_build_object(
    'id', v_squad.id,
    'name', v_squad.name,
    'invite_code', v_squad.invite_code,
    'owner_id', v_squad.owner_id,
    'members', v_members
  );
END;
$$;

-- ============ RPC: WHEEL ============

CREATE OR REPLACE FUNCTION spin_wheel()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_balance numeric;
  v_candidates uuid[];
  v_selected_id uuid;
  v_count int;
BEGIN
  SELECT stars_balance INTO v_balance
  FROM profiles WHERE id = auth.uid() FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_balance < 1 THEN
    RAISE EXCEPTION 'Insufficient Stars balance. You need at least 1 Star to spin.';
  END IF;

  SELECT array_agg(id) INTO v_candidates
  FROM (
    SELECT id FROM requests
    WHERE status = 'active'
    ORDER BY current_stars ASC, created_at DESC
    LIMIT 6
  ) sub;

  v_count := COALESCE(array_length(v_candidates, 1), 0);
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No active campaigns available to spin.';
  END IF;

  SELECT v_candidates[1 + floor(random() * v_count)::int] INTO v_selected_id;

  UPDATE profiles SET stars_balance = stars_balance - 1, updated_at = now()
  WHERE id = auth.uid();

  INSERT INTO transactions (donor_id, request_id, stars_amount, cover_fee, fee_amount)
  VALUES (auth.uid(), v_selected_id, 1, false, 0);

  UPDATE requests
  SET current_stars = current_stars + 1,
      status = CASE WHEN is_unlimited = false AND current_stars + 1 >= final_target THEN 'funded' ELSE status END,
      updated_at = now()
  WHERE id = v_selected_id;

  INSERT INTO wheel_spins (user_id, stars_spent, selected_request_id, candidates)
  VALUES (auth.uid(), 1, v_selected_id, to_jsonb(v_candidates));

  RETURN jsonb_build_object(
    'selected_request_id', v_selected_id,
    'candidates', to_jsonb(v_candidates)
  );
END;
$$;
