// Cloudflare Pages Function. No external message is sent until secrets are configured
// and both Turnstile and the downstream email provider succeed.
const reply = (status, code) => new Response(JSON.stringify({ ok: status === 200, code }), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
const plain = (v, max) => typeof v === 'string' ? v.trim().slice(0, max + 1) : '';
const goodEmail = v => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) && v.length <= 254;
const safe = v => v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
const services = new Set(['', 'Core Drilling', 'Flat Sawing', 'Electric Slab Sawing',
  'Asphalt Cutting', 'Sewer / Man-Hole Taps', 'Other']);

export async function onRequestPost({ request, env }) {
  // Deliberate fail-closed behavior for an unconfigured preview.
  if (!(env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY &&
    env.RESEND_API_KEY && env.CONTACT_FROM_EMAIL &&
    env.CONTACT_TO_EMAIL === 'contact@unitedconcreteinc.com')) {
    return reply(503, 'contact_not_configured');
  }
  const u = new URL(request.url);
  if (request.headers.get('Origin') !== u.origin) return reply(403, 'invalid_origin');
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json'))
    return reply(415, 'invalid_content_type');
  if (Number(request.headers.get('Content-Length') || 0) > 12000)
    return reply(413, 'request_too_large');
  let data;
  try {
    const raw = await request.text();
    if (raw.length > 12000) return reply(413, 'request_too_large');
    data = JSON.parse(raw);
  } catch { return reply(400, 'invalid_json'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return reply(400, 'invalid_input');
  const name = plain(data.name, 100), phone = plain(data.phone, 32),
    email = plain(data.email, 254), message = plain(data.message, 2500),
    service = plain(data.service || '', 60), token = plain(data.turnstileToken, 4096);
  // Avoid exposing any field to external email providers until validated.
  if (data.honey || name.length < 2 || name.length > 100 ||
    phone.length < 7 || phone.length > 32 || !/^[0-9+().\s-]+$/.test(phone) ||
    !goodEmail(email) || message.length < 10 || message.length > 2500 ||
    !services.has(service) || !token || token.length > 4096) return reply(422, 'invalid_input');
  let validated = false;
  try {
    const params = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) params.set('remoteip', ip);
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params, signal: AbortSignal.timeout(7000)
    });
    if (!verify.ok) return reply(502, 'verification_unavailable');
    const v = await verify.json();
    validated = v.success === true && v.hostname === u.hostname &&
      v.action === 'contact_form';
  } catch { return reply(502, 'verification_unavailable'); }
  if (!validated) return reply(403, 'verification_failed');

  // Fixed recipient; never take sender/recipient from the browser payload.
  const body = [
    'United Concrete website inquiry (provider accepted, final delivery not guaranteed)',
    'Name: ' + safe(name), 'Phone: ' + safe(phone), 'Email: ' + safe(email),
    'Service: ' + safe(service || 'Not specified'), '',
    'Message:', safe(message)
  ].join('\n');
  try {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.CONTACT_FROM_EMAIL,
        to: [env.CONTACT_TO_EMAIL], reply_to: email,
        subject: 'New United Concrete website inquiry', text: body }),
      signal: AbortSignal.timeout(10000)
    });
    if (!result.ok) return reply(502, 'delivery_provider_rejected');
    const acceptance = await result.json();
    if (!acceptance?.id) return reply(502, 'delivery_provider_unconfirmed');
    return reply(200, 'accepted_by_email_provider');
  } catch { return reply(502, 'delivery_provider_unavailable'); }
}
