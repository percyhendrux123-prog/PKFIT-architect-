// Phase 2 stub — ManyChat enrichment hook.
//
// When the /standard chat surface reaches a meaningful state (intent rated,
// hot lead detected, qualifier link clicked) we want to call back into
// ManyChat to apply tags + custom fields on the matching subscriber. This
// closes the loop with the existing free Keyword Flow so the rest of the
// nurture sequences (soft_nurture_7day, hot_lead_3day, Percy notification)
// still fire on the right cadence.
//
// The chat function does NOT invoke this in v1. The endpoint exists so the
// page (or a Supabase trigger / webhook) can post enrichment events here
// without forcing another deploy when we wire the real call.
//
// Required ManyChat pieces (not yet held in env):
//   - MANYCHAT_API_KEY       (subscriber-level token, ManyChat → Settings → API)
//   - MANYCHAT_PAGE_ID       (the connected page / IG account ID)
//
// Body shape we'll accept once live:
//   { session_id, subscriber_id, intent_level, qualifier_clicked, custom_fields? }
//
// Expected call (left as TODO):
//   POST https://api.manychat.com/fb/subscriber/setCustomField
//   POST https://api.manychat.com/fb/subscriber/addTag

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  // TODO(phase-2): validate session_id + subscriber_id, look up the session
  // in Supabase, derive the intent tag, and POST to ManyChat's setCustomField
  // and addTag endpoints with MANYCHAT_API_KEY. For now, just log and ack so
  // the chat surface can stub a fire-and-forget call without breaking.
  // eslint-disable-next-line no-console
  console.log('[manychat-event:stub]', JSON.stringify(body).slice(0, 500));

  return new Response(JSON.stringify({ ok: true, stub: true }), {
    status: 202,
    headers: JSON_HEADERS,
  });
};
