// Slack webhook helper for distributor alerts.
//
// Two severity levels per the distribute spec §5:
//   - WARN     :warning:        single post failed (auth/platform/content)
//   - CRITICAL :rotating_light: auth broken, or 5+ failures in 1h
//
// Webhook URL is read lazily from env so the module imports cleanly in tests
// without any stub. If the webhook is unset we log to console and return —
// alerting must NEVER fail the caller (the post may have already been
// scheduled in Buffer; losing the alert is preferable to a 500).

const WEBHOOK_ENV = 'SLACK_WEBHOOK_URL_AXIOM_DISTRIBUTOR';

const PREFIX = {
  WARN: ':warning:',
  CRITICAL: ':rotating_light:',
};

export async function slackAlert(severity, message, extra = {}) {
  const url = process.env[WEBHOOK_ENV];
  const prefix = PREFIX[severity] ?? ':information_source:';
  const text = `${prefix} *[${severity}]* ${message}`;

  if (!url) {
    // eslint-disable-next-line no-console
    console.warn(`[slack] ${WEBHOOK_ENV} unset; would have posted: ${text}`);
    return { posted: false, reason: 'webhook-unconfigured' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mrkdwn: true, ...extra }),
    });
    if (!res.ok) {
      const body = await res.text();
      // eslint-disable-next-line no-console
      console.error(`[slack] ${res.status}: ${body.slice(0, 200)}`);
      return { posted: false, reason: `http-${res.status}` };
    }
    return { posted: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[slack] post failed: ${err?.message ?? err}`);
    return { posted: false, reason: 'network-error' };
  }
}
