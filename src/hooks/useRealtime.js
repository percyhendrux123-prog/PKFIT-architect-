import { useEffect, useId, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

// Subscribe to postgres_changes on a Supabase table. Each hook instance gets
// its own channel — without the per-instance suffix, two consumers of the same
// (table, filter) pair would compute the same channel name, and the Supabase
// client returns the existing channel on a second .channel() call, which
// throws "cannot add 'postgres_changes' callbacks ... after 'subscribe(...)'."
// The handler is stored in a ref so the channel doesn't get torn down and
// re-created on every render when callers pass an inline closure.
export function useRealtime(table, handler, filter) {
  const id = useId();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel(`rt:${table}:${filter ?? 'all'}:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        (payload) => handlerRef.current?.(payload),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, id]);
}
