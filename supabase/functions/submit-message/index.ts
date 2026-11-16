import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const respond = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers: cors });
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return respond(405, 'Method not allowed.');
  const length = Number(req.headers.get('content-length') || 0);
  if (length > 24000) return respond(413, 'Message is too large.');
  try {
    const raw = await req.text();
    if (raw.length > 24000) return respond(413, 'Message is too large.');
    const data = JSON.parse(raw);
    const username = typeof data.username === 'string' ? data.username.toLowerCase() : '';
    const body = typeof data.body === 'string' ? data.body : '';
    const requestId = typeof data.requestId === 'string' ? data.requestId : '';
    if (!/^[a-z0-9_]{3,24}$/.test(username) || !body.trim() || Array.from(body).length > 5000 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return respond(400, 'Please check your message and try again.');
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const secret = Deno.env.get('SUBMISSION_HASH_SECRET');
    if (!ip || !secret) return respond(503, 'Sending is temporarily unavailable.');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const hash = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip)))).map((v) => v.toString(16).padStart(2, '0')).join('');
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: result, error } = await client.rpc('deliver_message', { p_username: username, p_body: body, p_request_id: requestId, p_sender_hash: hash });
    if (error) return respond(500, 'Could not deliver your message. Please try again.');
    if (result === 'rate_limited') return respond(429, 'Too many messages. Please try again later.');
    if (result === 'not_found') return respond(404, 'This page is unavailable.');
    if (result !== 'ok') return respond(400, 'Please check your message and try again.');
    return respond(200, 'Your message was delivered.');
  } catch {
    return respond(400, 'Could not process your request.');
  }
});
