import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

// Returns a short-lived signed URL for a private Supabase Storage object.
// Refreshes when the path changes. 1-hour TTL.
export function useSignedUrl(bucket, path) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !bucket || !path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, path]);

  return url;
}
