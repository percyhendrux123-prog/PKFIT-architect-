import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { SessionView } from '../../components/SessionView';

export default function CoachSessionDetail() {
  const { id: clientId, sid } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !sid) {
      setLoading(false);
      return;
    }
    supabase
      .from('workout_sessions')
      .select('*')
      .eq('id', sid)
      .maybeSingle()
      .then(({ data }) => {
        setSession(data ?? null);
        setLoading(false);
      });
  }, [sid]);

  if (loading) return <div className="text-xs uppercase tracking-widest2 text-faint">Loading</div>;
  return (
    <SessionView
      session={session}
      backTo={`/coach/clients/${clientId}`}
      backLabel="← Client"
    />
  );
}
