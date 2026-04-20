import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';

const CLIENT_SCOPED = [
  'programs',
  'meals',
  'habits',
  'check_ins',
  'reviews',
  'conversations',
  'payments',
  'workout_sessions',
  'dm_threads',
];

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user } = await requireUser(event);
    const admin = getAdminClient();

    const dump = { exported_at: new Date().toISOString(), user_id: user.id };

    const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).maybeSingle();
    dump.profile = profile ?? null;

    for (const table of CLIENT_SCOPED) {
      const { data } = await admin.from(table).select('*').eq('client_id', user.id);
      dump[table] = data ?? [];
    }

    // Community posts + reactions + comments authored by the user
    const { data: posts } = await admin
      .from('community_posts')
      .select('*')
      .eq('author_id', user.id);
    dump.community_posts = posts ?? [];
    const { data: reactions } = await admin
      .from('community_reactions')
      .select('*')
      .eq('user_id', user.id);
    dump.community_reactions = reactions ?? [];
    const { data: comments } = await admin
      .from('community_comments')
      .select('*')
      .eq('author_id', user.id);
    dump.community_comments = comments ?? [];

    // Conversation messages for the user's conversations
    const convIds = (dump.conversations ?? []).map((c) => c.id);
    if (convIds.length) {
      const { data: convMessages } = await admin
        .from('conversation_messages')
        .select('*')
        .in('conversation_id', convIds);
      dump.conversation_messages = convMessages ?? [];
    } else {
      dump.conversation_messages = [];
    }

    // DM messages for the user's threads
    const threadIds = (dump.dm_threads ?? []).map((t) => t.id);
    if (threadIds.length) {
      const { data: dmMessages } = await admin.from('dm_messages').select('*').in('thread_id', threadIds);
      dump.dm_messages = dmMessages ?? [];
    } else {
      dump.dm_messages = [];
    }

    return jsonResponse(200, dump);
  } catch (e) {
    return errorResponse(e);
  }
};
