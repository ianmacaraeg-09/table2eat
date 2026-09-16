// Table2Eat — create-payment
// Creates a PayMongo Payment Intent for a GCash/Maya e-wallet payment,
// writes the booking row as "awaiting_payment", and hands the client
// the redirect URL to send the customer to. The actual confirmation
// happens later via the paymongo-webhook function, not here — a
// redirect coming back to the browser is never fully trustworthy on
// its own (the tab can close, the network can drop).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function paymongoAuth() {
  return 'Basic ' + btoa(`${PAYMONGO_SECRET_KEY}:`);
}

async function paymongo(path: string, body: unknown) {
  const res = await fetch(`https://api.paymongo.com/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: paymongoAuth() },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.errors?.[0]?.detail || `PayMongo request to ${path} failed`);
  return json;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { name, phone, email, date, time, party, notes, fee, ref, method } = body;
    if (!name || !phone || !email || !date || !time || !party || !fee || !ref || !method) {
      throw new Error('Missing required booking fields.');
    }
    if (!['gcash', 'paymaya'].includes(method)) throw new Error('Unsupported payment method.');

    const origin = req.headers.get('origin') || 'https://ianmacaraeg-09.github.io';

    // 1. Payment Intent
    const intent = await paymongo('payment_intents', {
      data: {
        attributes: {
          amount: Math.round(Number(fee) * 100),
          currency: 'PHP',
          payment_method_allowed: [method],
          capture_type: 'automatic',
        },
      },
    });
    const paymentIntentId = intent.data.id;
    const clientKey = intent.data.attributes.client_key;

    // 2. Payment Method
    const pm = await paymongo('payment_methods', {
      data: { attributes: { type: method, billing: { name, email, phone } } },
    });
    const paymentMethodId = pm.data.id;

    // 3. Attach — this is what actually returns the GCash/Maya redirect URL
    const returnUrl = `${origin}/table2eat/?pi=${paymentIntentId}&ref=${encodeURIComponent(ref)}`;
    const attached = await paymongo(`payment_intents/${paymentIntentId}/attach`, {
      data: { attributes: { payment_method: paymentMethodId, client_key: clientKey, return_url: returnUrl } },
    });
    const redirectUrl = attached.data.attributes.next_action?.redirect?.url;
    if (!redirectUrl) throw new Error('PayMongo did not return a redirect URL.');

    // 4. Write the booking now, in "awaiting_payment" — the webhook finalizes it
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase.from('bookings').insert({
      ref, name, phone, email, date, time, party, notes: notes || null, fee,
      payment_method: 'paymongo',
      payment_intent_id: paymentIntentId,
      status: 'awaiting_payment',
    });
    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ checkout_url: redirectUrl, payment_intent_id: paymentIntentId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
