// Table2Eat — paymongo-webhook
// The authoritative confirmation point for gateway payments. PayMongo
// calls this directly (server-to-server) when a payment succeeds or
// fails, independent of whether the customer's browser ever made it
// back to our return_url. Verifies the signature before trusting
// anything in the payload.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PAYMONGO_WEBHOOK_SECRET = Deno.env.get('PAYMONGO_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function hmacSha256Hex(key: string, message: string) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Header looks like: t=<timestamp>,te=<test_signature>,li=<live_signature>
function parseSignatureHeader(header: string) {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  return { timestamp: parts.t, test: parts.te, live: parts.li };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const rawBody = await req.text();
  const sigHeader = req.headers.get('paymongo-signature');
  if (!sigHeader) return new Response('Missing signature', { status: 400 });

  const { timestamp, test, live } = parseSignatureHeader(sigHeader);
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = await hmacSha256Hex(PAYMONGO_WEBHOOK_SECRET, signedPayload);
  const provided = test || live;

  if (expected !== provided) {
    return new Response('Signature verification failed', { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const eventType = event.data?.attributes?.type;
  const payment = event.data?.attributes?.data;
  const paymentIntentId = payment?.attributes?.payment_intent_id;

  if (!paymentIntentId) return new Response('OK — no payment intent on event', { status: 200 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (eventType === 'payment.paid') {
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('payment_intent_id', paymentIntentId);
  } else if (eventType === 'payment.failed') {
    await supabase.from('bookings').update({ status: 'payment_failed' }).eq('payment_intent_id', paymentIntentId);
  }

  return new Response('OK', { status: 200 });
});
