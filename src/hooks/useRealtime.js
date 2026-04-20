import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export function useRealtime(table, handler, filter) {
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel(`rt:${table}:${filter ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        (payload) => handler(payload),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, handler]);
}
