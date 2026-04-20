import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useRealtime } from './useRealtime';

// Count of community posts the viewer has not yet caught up on. Posts authored
// by the viewer never count as unread. Plan-targeted posts are filtered by
// RLS, so simply querying as the user reflects what they can actually see.
export function useUnreadCommunity({ userId, lastSeenAt }) {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) return;
    let query = supabase
      .from('community_posts')
      .select('*', { count: 'exact', head: true })
      .neq('author_id', userId);
    if (lastSeenAt) query = query.gt('created_at', lastSeenAt);
    const { count: n } = await query;
    setCount(n ?? 0);
  }, [userId, lastSeenAt]);

  useEffect(() => { load(); }, [load]);
  useRealtime('community_posts', load);

  return count;
}
