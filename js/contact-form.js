document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('form-status');
  const widget = document.getElementById('turnstile-widget');
  let widgetId = null;
  let ready = false;
  const help = 'Online inquiries are being activated. Please call (951) 789-1934 or email contact@unitedconcreteinc.com.';
  const say = (message, kind) => {
    if (status) { status.textContent = message; status.className = 'form-status ' + (kind || ''); }
  };
  const enable = (value) => { button.disabled = !value; };
  enable(false);
  say('Checking secure contact form availability...', '');
  fetch('/api/form-config', { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new Error('unavailable');
    const config = await response.json();
    if (!config.enabled || !config.siteKey) throw new Error('unavailable');
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.onload = resolve; script.onerror = reject;
      document.head.append(script);
    });
    if (!window.turnstile) throw new Error('unavailable');
    widgetId = window.turnstile.render(widget, {
      sitekey: config.siteKey, action: 'contact_form',
      callback: () => { ready = true; enable(true); say('', ''); },
      'expired-callback': () => { ready = false; enable(false); say('Security check expired. Please complete it again.', ''); },
      'error-callback': () => { ready = false; enable(false); say(help, 'error'); }
    });
  }).catch(() => { ready = false; enable(false); say(help, 'error'); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!ready || !window.turnstile || widgetId == null) { say(help, 'error'); return; }
    const token = window.turnstile.getResponse(widgetId);
    if (!token) { say('Please complete the security check.', 'error'); return; }
    const data = new FormData(form);
    const payload = {
      name: data.get('name'), phone: data.get('phone'), email: data.get('email'),
      service: data.get('service') || '', message: data.get('message'),
      honey: data.get('_honey') || '', turnstileToken: token
    };
    enable(false);
    button.textContent = 'Sending...';
    say('Submitting your inquiry securely...', '');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.code !== 'accepted_by_email_provider') throw new Error('failed');
      form.reset();
      say('Your inquiry was accepted for email delivery. We will follow up as soon as possible.', 'success');
    } catch {
      say('Your inquiry could not be submitted. Please call (951) 789-1934 or email contact@unitedconcreteinc.com.', 'error');
    } finally {
      button.textContent = 'Send Message';
      ready = false;
      try { window.turnstile.reset(widgetId); } catch {}
      // The callback re-enables the button after the next successful challenge.
    }
  });
});
