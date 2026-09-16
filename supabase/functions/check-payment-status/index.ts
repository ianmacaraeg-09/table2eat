// Table2Eat — check-payment-status
// The client can't read the bookings table directly (RLS blocks anon
// SELECT entirely), so after redirecting back from GCash/Maya it polls
// this instead. Requires BOTH the ref and payment_intent_id — a pair
// only the customer who just paid would have — rather than exposing
// any broader read access.
//
// Also self-heals: PayMongo's webhook delivery has been unreliable in
// testing (payments succeed on their end but the webhook never fires —
// confirmed via their own delivery log showing zero attempts, a platform
// issue reported to their support, not something fixable from our side).
// Rather than leave bookings stuck in "awaiting_payment" forever, this
// checks PayMongo directly and reconciles our record if it's out of sync.
// The webhook stays in place as the correct primary mechanism for when
// PayMongo's delivery is working.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const ref = url.searchParams.get('ref');
  const paymentIntentId = url.searchParams.get('payment_intent_id');

  if (!ref || !paymentIntentId) {
    return new Response(JSON.stringify({ error: 'ref and payment_intent_id are required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('bookings')
    .select('status')
    .eq('ref', ref)
    .eq('payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let bookingStatus = data.status;

  // Only bother asking PayMongo if the webhook hasn't already resolved this
  // (or if it's still in-flight) — no need once it's a terminal state.
  if (bookingStatus === 'awaiting_payment') {
    try {
      const pmRes = await fetch(`https://api.paymongo.com/v1/payment_intents/${paymentIntentId}`, {
        headers: { Authorization: 'Basic ' + btoa(`${PAYMONGO_SECRET_KEY}:`) },
      });
      const pmJson = await pmRes.json();
      const pmStatus = pmJson.data?.attributes?.status;

      if (pmStatus === 'succeeded') {
        await supabase.from('bookings').update({ status: 'confirmed' }).eq('payment_intent_id', paymentIntentId);
        bookingStatus = 'confirmed';
      } else if (pmStatus === 'awaiting_payment_method') {
        // the customer's attempt failed/expired and PayMongo reset the
        // intent so they could retry — but this checkout session is done
        await supabase.from('bookings').update({ status: 'payment_failed' }).eq('payment_intent_id', paymentIntentId);
        bookingStatus = 'payment_failed';
      }
    } catch (_) { /* if PayMongo's API is unreachable, just report the DB status as-is */ }
  }

  return new Response(JSON.stringify({ status: bookingStatus }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
