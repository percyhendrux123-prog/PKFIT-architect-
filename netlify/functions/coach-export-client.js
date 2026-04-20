import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';

const CLIENT_SCOPED = [
  'programs',
  'meals',
  'habits',
  'check_ins',
  'reviews',
  'payments',
  'workout_sessions',
];

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { role } = await requireUser(event);
    if (role !== 'coach') return jsonResponse(403, { error: 'Coach only' });

    const { clientId } = JSON.parse(event.body || '{}');
    if (!clientId) return jsonResponse(400, { error: 'clientId required' });

    const admin = getAdminClient();
    const dump = { exported_at: new Date().toISOString(), client_id: clientId };

    const { data: profile } = await admin.from('profiles').select('*').eq('id', clientId).maybeSingle();
    dump.profile = profile ?? null;

    for (const table of CLIENT_SCOPED) {
      const { data } = await admin.from(table).select('*').eq('client_id', clientId);
      dump[table] = data ?? [];
    }

    const { data: threads } = await admin
      .from('dm_threads')
      .select('*')
      .eq('client_id', clientId);
    dump.dm_threads = threads ?? [];
    const threadIds = (threads ?? []).map((t) => t.id);
    if (threadIds.length) {
      const { data: dmMessages } = await admin
        .from('dm_messages')
        .select('*')
        .in('thread_id', threadIds);
      dump.dm_messages = dmMessages ?? [];
    } else {
      dump.dm_messages = [];
    }

    return jsonResponse(200, dump);
  } catch (e) {
    return errorResponse(e);
  }
};
