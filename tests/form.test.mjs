import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/contact.js';
import { onRequestGet } from '../functions/api/form-config.js';
const env = {
  TURNSTILE_SITE_KEY: 'public-test-key',
  TURNSTILE_SECRET_KEY: 'fake-secret',
  RESEND_API_KEY: 'fake-provider-key',
  CONTACT_FROM_EMAIL: 'website@mg.unitedconcreteinc.com',
  CONTACT_TO_EMAIL: 'contact@unitedconcreteinc.com'
};
const payload = {
  name: 'Sample Test', email: 'sample@example.net', phone: '+1 (951) 555-0110',
  service: 'Core Drilling', message: 'Sample inquiry for local tests only.',
  honey: '', turnstileToken: 'demo-test-token'
};
const url = 'https://united-concrete-preview.pages.dev/api/contact';
function context(body = payload, opts = {}) {
  return { env: opts.env || env, request: new Request(url, {
    method: 'POST',
    headers: { Origin: opts.origin || 'https://united-concrete-preview.pages.dev',
      'Content-Type': opts.type || 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  }) };
}
test('disabled config never exposes secrets and unconfigured POST is 503', async () => {
  const r = await onRequestGet({ env: {} });
  const data = await r.json();
  assert.equal(data.enabled, false);
  assert.equal(data.siteKey, null);
  const p = await onRequestPost(context(payload, { env: {} }));
  assert.equal(p.status, 503);
});
test('invalid origin and bad input fail without network access', async () => {
  assert.equal((await onRequestPost(context(payload, { origin: 'https://attacker.example' }))).status, 403);
  assert.equal((await onRequestPost(context({ ...payload, email: 'bad' }))).status, 422);
  assert.equal((await onRequestPost(context({ ...payload, service: 'Unknown' }))).status, 422);
  assert.equal((await onRequestPost(context({ ...payload, honey: 'bot' }))).status, 422);
});
test('turnstile failure fails closed with no outgoing email', async () => {
  const prev = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ success: false }); };
  try {
    const r = await onRequestPost(context());
    assert.equal(r.status, 403);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = prev; }
});
test('verified staged submission reaches only fixed recipient through mocked provider', async () => {
  const prev = globalThis.fetch;
  const called = [];
  globalThis.fetch = async (endpoint, args) => {
    called.push({ endpoint, args });
    if (String(endpoint).includes('/siteverify')) return Response.json({
      success: true, hostname: 'united-concrete-preview.pages.dev', action: 'contact_form'
    });
    return Response.json({ id: 'em_fake_123' }, { status: 200 });
  };
  try {
    const r = await onRequestPost(context());
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.equal(data.code, 'accepted_by_email_provider');
    assert.equal(called.length, 2);
    assert.equal(called[1].endpoint, 'https://api.resend.com/emails');
    const outbound = JSON.parse(called[1].args.body);
    assert.deepEqual(outbound.to, ['contact@unitedconcreteinc.com']);
    assert.equal(outbound.reply_to, 'sample@example.net');
    assert.equal(outbound.text.includes('Sample inquiry'), true);
    assert.equal(JSON.stringify(data).includes('fake-secret'), false);
  } finally { globalThis.fetch = prev; }
});
test('provider failure is not misrepresented as sent', async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async endpoint => String(endpoint).includes('/siteverify')
    ? Response.json({ success: true, hostname: 'united-concrete-preview.pages.dev', action: 'contact_form' })
    : Response.json({ error: 'No verified sending domain' }, { status: 403 });
  try {
    const r = await onRequestPost(context());
    assert.equal(r.status, 502);
  } finally { globalThis.fetch = prev; }
});
test('form config enabled only for exact recipient and all secrets', async () => {
  const enabled = await (await onRequestGet({ env })).json();
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.siteKey, 'public-test-key');
  assert.equal(JSON.stringify(enabled).includes('fake-provider-key'), false);
  const no = await (await onRequestGet({ env: { ...env, CONTACT_TO_EMAIL: 'else@example.com' } })).json();
  assert.equal(no.enabled, false);
});
