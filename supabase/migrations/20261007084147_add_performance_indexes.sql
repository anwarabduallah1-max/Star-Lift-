/*
# Add performance indexes for frequently queried columns

## Purpose
Optimizes the most common query patterns in the app:
- Dashboard / My Requests: list a user's requests ordered by creation date
- Explore feed: active requests sorted by bump time for the "bump to top" upgrade
- Wallet / Dashboard: recent payment orders per user
- Transaction history: donations per request and per donor, ordered by date
- Payout history: payouts per creator, ordered by date
- Wheel spins: user spin history, ordered by date
- Squad members: listing members by join date

## Changes
Adds composite B-tree indexes on:
1. `requests(user_id, created_at DESC)` — dashboard "my requests" list
2. `requests(status, bumped_at DESC NULLS LAST)` — explore feed bump ordering
3. `requests(bumped_at DESC NULLS LAST)` — explore feed secondary sort
4. `payment_orders(user_id, created_at DESC)` — recent orders per user
5. `transactions(request_id, created_at DESC)` — donation history per campaign
6. `transactions(donor_id, created_at DESC)` — donation history per donor
7. `payout_requests(creator_id, created_at DESC)` — payout history per creator
8. `wheel_spins(user_id, created_at DESC)` — spin history per user
9. `squad_members(squad_id, joined_at DESC)` — squad member listing

## Security
No RLS or policy changes — indexes are transparent to access control.

## Notes
1. All indexes use IF NOT EXISTS so re-running is safe.
2. Existing single-column indexes remain — the new composite indexes cover queries that filter + sort simultaneously.
*/

CREATE INDEX IF NOT EXISTS idx_requests_user_created
  ON requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requests_status_bumped
  ON requests (status, bumped_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_requests_bumped
  ON requests (bumped_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_created
  ON payment_orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_request_created
  ON transactions (request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_donor_created
  ON transactions (donor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_requests_creator_created
  ON payout_requests (creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wheel_spins_user_created
  ON wheel_spins (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_squad_members_squad_joined
  ON squad_members (squad_id, joined_at DESC);
