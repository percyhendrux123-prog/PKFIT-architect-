import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
    };
  }, []);

  const refreshProfile = async (userId) => {
    if (!isSupabaseConfigured || !userId) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data ?? null);
    return data ?? null;
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    refreshProfile(userId);
  }, [session?.user?.id]);

  const value = useMemo(() => {
    const user = session?.user ?? null;
    const role = profile?.role ?? null;

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
