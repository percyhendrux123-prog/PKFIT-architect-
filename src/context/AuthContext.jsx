import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext(null);

// Client-side owner hint used only for UI visibility (showing the /owner
// tile, theming, etc.). Server-side `OWNER_EMAILS` is the source of truth
// for any privileged action — bypassing the client check just shows an
// extra link that the server still rejects.
const OWNER_EMAILS = (import.meta.env.VITE_OWNER_EMAILS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isOwnerEmail(email) {
  if (!email) return false;
  return OWNER_EMAILS.includes(String(email).trim().toLowerCase());
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }
    let mounted = true;

    async function bootstrap() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const next = data.session ?? null;
      setSession(next);
      const userId = next?.user?.id;
      if (!userId) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (!mounted) return;
      setProfile(prof ?? null);
      setLoading(false);
    }

    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
    };
  }, []);

  async function refreshProfile(userId) {
    if (!isSupabaseConfigured || !userId) return null;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data ?? null);
    return data ?? null;
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    refreshProfile(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const value = useMemo(() => {
    const user = session?.user ?? null;
    const baseRole = profile?.role ?? null;
    const role = isOwnerEmail(user?.email) ? 'owner' : baseRole;
    const isOwner = role === 'owner';

    async function signIn(email, password) {
      if (!isSupabaseConfigured) throw new Error('Supabase not configured');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }

    async function signUp(email, password, meta = {}) {
      if (!isSupabaseConfigured) throw new Error('Supabase not configured');
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: meta },
      });
      if (error) throw error;
    }

    async function signOut() {
      if (!isSupabaseConfigured) return;
      await supabase.auth.signOut();
    }

    return {
      user,
      profile,
      role,
      isOwner,
      loading,
      signIn,
      signUp,
      signOut,
      isSupabaseConfigured,
      refreshProfile: () => refreshProfile(user?.id),
    };
  }, [session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
