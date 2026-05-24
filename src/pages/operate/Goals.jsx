import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import MicFab from '../../components/operate/MicFab';
import { ChevronLeftSvg, TrendingSvg, CalendarSvg, ClockSvg, PlusSvg, MicSvg, CheckSvg } from '../../components/operate/svg';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';

const RING_CIRC = 276; // 2*pi*44

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// For each habit, compute adherence over the trailing 7 days.
function adherenceFor(habitId, history, days = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let hits = 0;
  for (let i = 0; i < days; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayMap = history[ymd(d)] ?? {};
    if (dayMap[habitId]) hits += 1;
  }
  return { hits, days };
}

function currentStreakFor(habitId, history) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayMap = history[ymd(d)] ?? {};
    if (dayMap[habitId]) count += 1;
    else if (i > 0) break; // today's miss is allowed grace
  }
  return count;
}

export default function OperateGoals() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [row, setRow] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const { listening, transcript, toggle } = useVoiceCapture({
    onFinal: (t) => setDraft(t),
  });

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    const { data } = await supabase
      .from('habits')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setRow(data ?? null);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const list = row?.habit_list ?? [];
  const history = row?.check_history ?? {};

  async function persist(payload) {
    setBusy(true);
    try {
      if (row) {
        const { data } = await supabase.from('habits').update(payload).eq('id', row.id).select().maybeSingle();
        if (data) setRow(data);
      } else {
        const { data } = await supabase.from('habits').insert({ client_id: user.id, ...payload }).select().maybeSingle();
        if (data) setRow(data);
      }
    } finally {
      setBusy(false);
    }
  }

  async function addStandard(name) {
    if (!name?.trim()) return;
    const next = [...list, { id: crypto.randomUUID(), name: name.trim() }];
    setDraft('');
    await persist({ habit_list: next, check_history: history });
  }

  const goals = useMemo(() => {
    return list.map((h) => {
      const { hits, days } = adherenceFor(h.id, history, 7);
      const streak = currentStreakFor(h.id, history);
      const pct = Math.round((hits / days) * 100);
      const dashoffset = Math.round(RING_CIRC * (1 - pct / 100));
      const lowAdherence = pct < 50;
      return {
        id: h.id,
        title: (h.name ?? 'STANDARD').toUpperCase(),
        // TODO: needs explicit goal categories / target metrics in schema —
        // habits is flat list. Showing 7-day adherence as the proxy metric.
        tag: 'HABIT · DAILY',
        tagGold: false,
        now: `${hits} / ${days} DAYS`,
        target: '7 / 7',
        due: 'THIS WEEK',
        checkin: streak > 0 ? `${streak} DAY STREAK` : 'NO STREAK',
        checkinIcon: 'clock',
        streak: lowAdherence ? 'FALLING BEHIND' : (streak >= 7 ? 'ON PACE' : 'BUILDING'),
        streakRed: lowAdherence,
        pct,
        dashoffset,
      };
    });
  }, [list, history]);

  const activeCount = goals.length;

  return (
    <PhoneShell screen="Standards">
      <div className="op-app">
        <div className="op-header">
          <button type="button" className="op-icon-btn" onClick={() => nav('/dashboard')} aria-label="Back">
            <ChevronLeftSvg />
          </button>
          <div className="op-title">STANDARDS</div>
          <button type="button" className="op-icon-btn" aria-label="Trends"><TrendingSvg /></button>
        </div>

        <div className="op-standard-line">
          A man becomes what he <span className="op-gold">repeatedly moves toward.</span>
        </div>

        <div className="op-filter-row">
          <button type="button" className="op-chip op-active">ACTIVE · {activeCount}</button>
          <button type="button" className="op-chip">COMPLETED · 0</button>
          <button type="button" className="op-chip">PAUSED</button>
        </div>

        {goals.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 11, letterSpacing: '2px', lineHeight: 1.6 }}>
            NO STANDARDS YET.<br />
            INSTALL ONE BELOW — KEEP IT TO THREE.
          </div>
        ) : null}

        {goals.map((g, i) => (
          <div key={g.id} className={`op-goal-card${i === 0 && g.pct >= 50 ? ' op-priority' : ''}`}>
            <div className="op-gc-row">
              <div className="op-gc-ring">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#2a2a2a" strokeWidth="8" />
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#C9A84C" strokeWidth="8"
                    strokeDasharray={RING_CIRC} strokeDashoffset={g.dashoffset} strokeLinecap="round" />
                </svg>
                <div className="op-gc-pct">{g.pct}%</div>
              </div>
              <div className="op-gc-body">
                <div className={`op-gc-tag${g.tagGold ? ' op-gold' : ''}`}>{g.tag}</div>
                <div className="op-gc-title">{g.title}</div>
                <div className="op-gc-metric">
                  <span className="op-now">{g.now}</span>
                  <span className="op-arrow">→</span>
                  <span className="op-target">{g.target}</span>
                  <span className="op-due">{g.due}</span>
                </div>
              </div>
            </div>
            <div className="op-gc-foot">
              <div className="op-gc-checkin">
                {g.checkinIcon === 'clock' ? <ClockSvg /> : <CalendarSvg />}
                {g.checkin}
              </div>
              <div className={`op-gc-streak${g.streakRed ? ' op-red' : ''}`}>{g.streak}</div>
            </div>
          </div>
        ))}

        <div className="op-add-goal-row">
          <button
            type="button"
            className="op-add-goal"
            onClick={() => addStandard(draft)}
            disabled={busy || !draft.trim()}
          >
            <PlusSvg />
            {draft ? draft.toUpperCase() : 'ADD A STANDARD'}
          </button>
          <button
            type="button"
            className="op-add-goal-mic"
            aria-label={listening ? 'Stop voice-create' : 'Voice-create standard'}
            aria-pressed={listening}
            onClick={toggle}
          >
            <MicSvg />
          </button>
        </div>
        {!listening && draft ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a standard…"
            style={{
              marginTop: 10,
              width: '100%',
              background: '#0e0e0e',
              border: '1px solid #2a2a2a',
              color: '#f5f5f5',
              padding: '10px 12px',
              fontSize: 13,
              letterSpacing: '1px',
              fontFamily: 'inherit',
            }}
          />
        ) : null}
        {listening ? (
          <div className="op-voice-overlay" style={{ position: 'static', marginTop: 10 }}>
            <div className="op-voice-overlay-head">
              <span className="op-voice-overlay-label">LISTENING…</span>
              <button type="button" className="op-voice-overlay-stop" onClick={toggle}>TAP TO STOP</button>
            </div>
            <div className="op-voice-overlay-quote">{transcript || 'Say a new standard out loud — "Bench 315 by end of summer."'}</div>
          </div>
        ) : null}

        {/* TODO: needs `completed_at` per habit (or a separate goals table) to populate this. */}
        <div className="op-section-label-tight">CHECKED IN TODAY</div>
        {goals.filter((g) => {
          const today = ymd(new Date());
          return history[today]?.[g.id];
        }).length === 0 ? (
          <div className="op-done-card">
            <div className="op-dc-head">
              <div className="op-dc-title" style={{ color: '#666' }}>NOTHING CHECKED IN TODAY</div>
            </div>
            <div className="op-dc-meta">Open the legacy habits view to check items off.</div>
          </div>
        ) : (
          goals
            .filter((g) => history[ymd(new Date())]?.[g.id])
            .map((g) => (
              <div key={`done-${g.id}`} className="op-done-card">
                <div className="op-dc-head">
                  <div className="op-dc-title">{g.title}</div>
                  <div className="op-dc-check"><CheckSvg /></div>
                </div>
                <div className="op-dc-meta">Checked in today · {g.checkin.toLowerCase()}</div>
              </div>
            ))
        )}
      </div>

      <MicFab context="goals" />
      <BottomNav active="profile" />
    </PhoneShell>
  );
}
