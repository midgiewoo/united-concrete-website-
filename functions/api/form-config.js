// Public configuration only. No API keys or secrets are returned.
export async function onRequestGet({ env }) {
  const enabled = Boolean(
    env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY &&
    env.RESEND_API_KEY && env.CONTACT_FROM_EMAIL &&
    env.CONTACT_TO_EMAIL === 'contact@unitedconcreteinc.com'
  );
  return new Response(JSON.stringify({
    enabled,
    siteKey: enabled ? env.TURNSTILE_SITE_KEY : null,
    status: enabled ? 'ready_for_verified_testing' : 'not_configured'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}
