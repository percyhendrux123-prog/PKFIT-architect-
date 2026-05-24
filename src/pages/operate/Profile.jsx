import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { sessionStreak } from '../../lib/streaks';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import MicFab from '../../components/operate/MicFab';
import {
  ChevronLeftSvg, ChevronRightSvg, SettingsSvg, EditSvg, UserSvg, CalendarSvg, TrendingSvg,
  CardSvg, BellSvg, MicSvg, ShieldSvg, HelpSvg,
} from '../../components/operate/svg';

function initials(profile) {
  const name = (profile?.name || profile?.email || 'YOU').trim();
  const parts = name.split(/[\s.@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() || 'YO';
}

function monthYearLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }).toUpperCase();
}

async function openBillingPortal(setErr) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/.netlify/functions/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
    });
    const json = await res.json().catch(() => ({}));
    if (json?.url) {
      window.location.href = json.url;
    } else {
      setErr(json?.error ?? 'Could not open billing portal');
    }
  } catch (e) {
    setErr(e?.message ?? 'Billing portal unavailable');
  }
}

export default function OperateProfile() {
  const nav = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [latestCheckin, setLatestCheckin] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [coachProfile, setCoachProfile] = useState(null);
  const [billingErr, setBillingErr] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return undefined;
    let cancelled = false;
    Promise.all([
      supabase
        .from('check_ins')
        .select('weight,date')
        .eq('client_id', user.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('workout_sessions')
        .select('performed_at')
        .eq('client_id', user.id)
        .not('performed_at', 'is', null)
        .order('performed_at', { ascending: false }),
      supabase
        .from('coach_client_assignments')
        .select('coach_id,is_primary,ended_on,profiles:coach_id(id,name)')
        .eq('client_id', user.id)
        .is('ended_on', null)
        .order('is_primary', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([ci, sess, asg]) => {
      if (cancelled) return;
      setLatestCheckin(ci.data ?? null);
      setSessions(sess.data ?? []);
      setCoachProfile(asg.data?.profiles ?? null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  const streak = useMemo(() => sessionStreak(sessions), [sessions]);
  const daysActive = useMemo(() => {
    if (!profile?.created_at) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000));
  }, [profile?.created_at]);

  const displayName = (profile?.name || profile?.email || 'You').toUpperCase();
  const weightUnit = profile?.units === 'metric' ? 'KG' : 'LBS';
  const weight = latestCheckin?.weight != null ? Number(latestCheckin.weight).toFixed(1) : '—';
  const sinceLabel = profile?.created_at
    ? `CLIENT SINCE ${monthYearLabel(profile.created_at)}`
    : 'CLIENT';

  async function handleSignOut() {
    try { await signOut(); } finally { nav('/', { replace: true }); }
  }

  const planName = profile?.plan ? String(profile.plan).toUpperCase() : 'TRIAL';
  const macroSummary = profile?.target_kcal
    ? `${profile.target_kcal} kcal · ${profile.target_protein_g ?? '—'}P`
    : 'Not set yet';
  const coachName = coachProfile?.name ?? 'Percy Keith';

  return (
    <PhoneShell screen="Profile">
      <div className="op-app">
        <div className="op-header">
          <button type="button" className="op-icon-btn" onClick={() => nav('/dashboard')} aria-label="Back">
            <ChevronLeftSvg />
          </button>
          <div className="op-title">PROFILE</div>
          <button type="button" className="op-icon-btn" onClick={() => nav('/settings')} aria-label="Settings"><SettingsSvg /></button>
        </div>

        <div className="op-profile-top">
          <div className="op-avatar-wrap">
            <div className="op-avatar">{initials(profile)}</div>
            <div className="op-av-edit"><EditSvg /></div>
          </div>
          <div className="op-p-name">{displayName}</div>
          <div className="op-p-tag">{sinceLabel}</div>
        </div>

        <div className="op-stats-row">
          <div className="op-stat-cell">
            <div className="op-stat-num">{weight}</div>
            <div className="op-stat-unit">{weightUnit}</div>
            <div className="op-stat-label">WEIGHT</div>
          </div>
          <div className="op-stat-cell">
            <div className="op-stat-num op-gold">{streak}</div>
            <div className="op-stat-unit">DAYS</div>
            <div className="op-stat-label">STREAK</div>
          </div>
          <div className="op-stat-cell">
            <div className="op-stat-num">{daysActive}</div>
            <div className="op-stat-unit">DAYS</div>
            <div className="op-stat-label">ACTIVE</div>
          </div>
        </div>

        {/* TODO: needs a `program_phases` row joined to active program for "Week X of Y · ends DATE". */}
        <div className="op-plan-banner" role="button" tabIndex={0} onClick={() => nav('/workouts')}>
          <div className="op-pb-left">
            <div className="op-pb-label">CURRENT PROTOCOL</div>
            <div className="op-pb-title">{planName} PROTOCOL</div>
            <div className="op-pb-sub">{sessions.length} sessions logged</div>
          </div>
          <div className="op-pb-arrow"><ChevronRightSvg /></div>
        </div>

        <div className="op-section-label-mini">COACHING</div>
        <div className="op-menu-group">
          <div className="op-menu-row" role="button" tabIndex={0} onClick={() => nav('/inbox')}>
            <div className="op-menu-icon"><UserSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Coach</div><div className="op-menu-sub">{coachName} · PKFIT</div></div>
            <div className="op-menu-right"><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
          <div className="op-menu-row" role="button" tabIndex={0} onClick={() => nav('/reviews')}>
            <div className="op-menu-icon"><CalendarSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Check-ins</div><div className="op-menu-sub">Weekly review</div></div>
            <div className="op-menu-right"><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
          <div className="op-menu-row" role="button" tabIndex={0} onClick={() => nav('/habits')}>
            <div className="op-menu-icon"><TrendingSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Current Plan</div><div className="op-menu-sub">{macroSummary}</div></div>
            <div className="op-menu-right"><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
        </div>

        <div className="op-section-label-mini">ACCOUNT</div>
        <div className="op-menu-group">
          <div className="op-menu-row" role="button" tabIndex={0} onClick={() => openBillingPortal(setBillingErr)}>
            <div className="op-menu-icon"><CardSvg /></div>
            <div className="op-menu-body">
              <div className="op-menu-title">Subscription</div>
              <div className="op-menu-sub">{billingErr ?? `${planName} · Manage`}</div>
            </div>
            <div className="op-menu-right"><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
          <div className="op-menu-row" role="button" tabIndex={0} onClick={() => nav('/settings')}>
            <div className="op-menu-icon"><BellSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Notifications</div><div className="op-menu-sub">Training + check-ins</div></div>
            <div className="op-menu-right"><div className="op-menu-value">{profile?.channel_preference?.toUpperCase() ?? 'APP'}</div><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
          <div className="op-menu-row" role="button" tabIndex={0} onClick={() => nav('/settings')}>
            <div className="op-menu-icon"><MicSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Voice Input</div><div className="op-menu-sub">Default for logging</div></div>
            <div className="op-menu-right"><div className="op-menu-value op-on">ON</div><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
          <div className="op-menu-row" role="button" tabIndex={0} onClick={() => nav('/settings')}>
            <div className="op-menu-icon"><ShieldSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Privacy & Data</div><div className="op-menu-sub">Export, delete account</div></div>
            <div className="op-menu-right"><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
          <div className="op-menu-row" role="button" tabIndex={0} onClick={() => nav('/legal/terms')}>
            <div className="op-menu-icon"><HelpSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Help & Support</div><div className="op-menu-sub">Terms, contact PKFIT</div></div>
            <div className="op-menu-right"><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
        </div>

        <button type="button" className="op-signout-row" onClick={handleSignOut}>SIGN OUT</button>
        <div className="op-version">PKFIT · v3 · operatefitness.app</div>
      </div>

      <MicFab context="profile" />
      <BottomNav active="profile" />
    </PhoneShell>
  );
}
