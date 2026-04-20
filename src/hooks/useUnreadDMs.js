import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useRealtime } from './useRealtime';

// Returns the count of DM messages not yet read by the current viewer.
// Role determines which "read_by_*" column we inspect and which author
// direction we exclude (own messages are never "unread for me").
export function useUnreadDMs({ userId, role }) {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) return;
    const column = role === 'coach' ? 'read_by_coach' : 'read_by_client';
    const { count: n } = await supabase
      .from('dm_messages')
      .select('*', { count: 'exact', head: true })
      .eq(column, false)
      .neq('author_id', userId);
    setCount(n ?? 0);
  }, [userId, role]);

  useEffect(() => { load(); }, [load]);
  useRealtime('dm_messages', load);

  return count;
}
