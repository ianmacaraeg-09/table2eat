-- ============================================================
-- Table2Eat — PayMongo payment integration schema additions
-- Run this once in the Supabase SQL Editor, after migration.sql
-- ============================================================

-- Track which path a booking came through, and PayMongo's own
-- reference for the ones that went through the gateway.
alter table public.bookings
  add column if not exists payment_method text not null default 'manual'
    check (payment_method in ('manual', 'paymongo')),
  add column if not exists payment_intent_id text unique;

-- Widen the status lifecycle to cover the gateway path:
--   awaiting_payment — booking row created, customer sent to GCash/Maya,
--                       webhook hasn't confirmed the result yet
--   payment_failed   — PayMongo reported the payment failed/was cancelled
-- (pending / confirmed / declined stay as the manual-flow states they
-- already were)
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'declined', 'awaiting_payment', 'payment_failed'));

-- The Edge Functions run with the service_role key (bypasses RLS
-- entirely), so no new policies are needed for them to read/write.
-- Anon still can't read bookings directly — payment status after a
-- redirect back from PayMongo is checked through the check-payment-status
-- Edge Function instead, not a direct table read.
