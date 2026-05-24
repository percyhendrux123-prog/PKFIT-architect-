import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import { HamburgerSvg, PlusSvg, SearchSvg, MicSvg } from '../../components/operate/svg';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';

function initialsOf(name) {
  const n = (name ?? 'XX').trim();
  const parts = n.split(/[\s.@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() || 'XX';
}

function relativeTime(iso) {
  if (!iso) return null;
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function fmtName(name, email) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0].toUpperCase()} ${parts[1][0].toUpperCase()}.`;
    return parts[0].toUpperCase();
  }
  return (email ?? '—').split('@')[0].toUpperCase();
}

// Adherence: % of trailing-14-days that have any activity (workout session OR
// meal log OR habit check). 0–100. Flag thresholds: ≥85 green, 60–84 yellow,
// <60 red.
function adherenceClass(pct) {
  if (pct >= 85) return { cls: 'op-good', flag: 'green' };
  if (pct >= 60) return { cls: 'op-mid', flag: 'yellow' };
  return { cls: 'op-bad', flag: 'red' };
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function OperateCoachInsights() {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('all'); // all | flagged | new | checkin
  const [q, setQ] = useState('');
  const { listening, transcript, toggle } = useVoiceCapture();

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return undefined;
    let cancelled = false;
    (async () => {
      const { data: assignments } = await supabase
        .from('coach_client_assignments')
        .select('client_id,is_primary,started_on,ended_on,profiles:client_id(id,name,email,created_at,plan,status)')
        .eq('coach_id', user.id)
        .is('ended_on', null);

      const clientRows = (assignments ?? [])
        .map((a) => a.profiles)
        .filter(Boolean);
      if (cancelled || clientRows.length === 0) {
        if (!cancelled) {
          setClients([]);
          setLoading(false);
        }
        return;
      }

      const ids = clientRows.map((c) => c.id);
      const since = new Date(Date.now() - 14 * 86400000);
      const sinceIso = since.toISOString();
      const sinceYmd = ymd(since);

      const [sessions, meals, habitRows, dmThreads, latestCheckin] = await Promise.all([
        supabase
          .from('workout_sessions')
          .select('client_id,performed_at')
          .in('client_id', ids)
          .gte('performed_at', sinceIso),
        supabase
          .from('meals')
          .select('client_id,date,eaten')
          .in('client_id', ids)
          .gte('date', sinceYmd),
        supabase
          .from('habits')
          .select('client_id,check_history,habit_list')
          .in('client_id', ids),
        supabase
          .from('dm_threads')
          .select('client_id,last_activity_at')
          .in('client_id', ids),
        supabase
          .from('check_ins')
          .select('client_id,weight,date')
          .in('client_id', ids)
          .order('date', { ascending: false }),
      ]);

      const sessionDays = {};
      for (const s of sessions.data ?? []) {
        if (!s.performed_at) continue;
        const k = ymd(new Date(s.performed_at));
        sessionDays[s.client_id] = sessionDays[s.client_id] ?? new Set();
        sessionDays[s.client_id].add(k);
      }
      const mealDays = {};
      for (const m of meals.data ?? []) {
        if (!m.date || !m.eaten) continue;
        mealDays[m.client_id] = mealDays[m.client_id] ?? new Set();
        mealDays[m.client_id].add(m.date);
      }
      const habitByClient = Object.fromEntries((habitRows.data ?? []).map((h) => [h.client_id, h]));
      const lastCheckinByClient = {};
      const latestWeightByClient = {};
      const prevWeightByClient = {};
      for (const c of latestCheckin.data ?? []) {
        if (!lastCheckinByClient[c.client_id]) {
          lastCheckinByClient[c.client_id] = c.date;
          latestWeightByClient[c.client_id] = c.weight;
        } else if (!prevWeightByClient[c.client_id]) {
          prevWeightByClient[c.client_id] = c.weight;
        }
      }
      const lastDmByClient = Object.fromEntries(
        (dmThreads.data ?? []).map((t) => [t.client_id, t.last_activity_at]),
      );

      const lastActivityByClient = {};
      function touch(id, isoLike) {
        if (!isoLike) return;
        const iso = typeof isoLike === 'string' && isoLike.length === 10
          ? `${isoLike}T00:00:00.000Z`
          : isoLike;
        if (!lastActivityByClient[id] || new Date(iso) > new Date(lastActivityByClient[id])) {
          lastActivityByClient[id] = iso;
        }
      }
      for (const s of sessions.data ?? []) touch(s.client_id, s.performed_at);
      for (const m of meals.data ?? []) touch(m.client_id, m.date);
      for (const c of latestCheckin.data ?? []) touch(c.client_id, c.created_at);
      for (const [id, iso] of Object.entries(lastDmByClient)) touch(id, iso);

      // Adherence: how many of the last 14 days had ANY activity.
      function adherenceFor(clientId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sessSet = sessionDays[clientId] ?? new Set();
        const mealSet = mealDays[clientId] ?? new Set();
        const habitHistory = habitByClient[clientId]?.check_history ?? {};
        const habitList = habitByClient[clientId]?.habit_list ?? [];
        let hits = 0;
        for (let i = 0; i < 14; i += 1) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const k = ymd(d);
          const habitDay = habitHistory[k] ?? {};
          const anyHabit = habitList.some((h) => habitDay[h.id]);
          if (sessSet.has(k) || mealSet.has(k) || anyHabit) hits += 1;
        }
        return Math.round((hits / 14) * 100);
      }

      function lastEventLabel(clientId) {
        const sess = (sessions.data ?? [])
          .filter((s) => s.client_id === clientId && s.performed_at)
          .sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at))[0];
        if (sess) return `Logged session · ${relativeTime(sess.performed_at)}`;
        const lastCi = lastCheckinByClient[clientId];
        if (lastCi) return `Last check-in · ${lastCi}`;
        return 'No activity yet';
      }

      function checkinStatus(clientId) {
        // Cadence assumption: weekly Sundays. Show how late they are vs. last Sun.
        const last = lastCheckinByClient[clientId];
        if (!last) return { label: 'NEW', sub: 'NO CHECK-IN' };
        const days = Math.floor((Date.now() - new Date(`${last}T00:00:00`).getTime()) / 86400000);
        if (days <= 0) return { label: 'TODAY', sub: 'CURRENT' };
        if (days <= 6) return { label: `${days}D AGO`, sub: 'CURRENT' };
        return { label: `${days}D LATE`, sub: 'OVERDUE' };
      }

      const enriched = clientRows.map((c) => {
        const adh = adherenceFor(c.id);
        const klass = adherenceClass(adh);
        const cs = checkinStatus(c.id);
        const latestW = latestWeightByClient[c.id];
        const prevW = prevWeightByClient[c.id];
        const delta = latestW != null && prevW != null
          ? Number(latestW) - Number(prevW)
          : null;
        return {
          id: c.id,
          name: fmtName(c.name, c.email),
          initials: initialsOf(c.name ?? c.email),
          last: lastEventLabel(c.id),
          checkin: cs.label,
          sub: cs.sub,
          adh,
          adhClass: klass.cls,
          flag: klass.flag,
          flagged: klass.flag === 'red',
          weight: latestW,
          weightDelta: delta,
          createdAt: c.created_at,
        };
      });

      if (!cancelled) {
        setClients(enriched);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setClients([]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const counts = useMemo(() => {
    const active = clients.length;
    const onTrack = clients.filter((c) => c.adh >= 85).length;
    const slipping = clients.filter((c) => c.adh >= 60 && c.adh < 85).length;
    const flagged = clients.filter((c) => c.flagged).length;
    return { active, onTrack, slipping, flagged };
  }, [clients]);

  const filtered = useMemo(() => {
    let list = clients;
    if (filter === 'flagged') list = list.filter((c) => c.flagged);
    if (filter === 'new') {
      const cutoff = Date.now() - 14 * 86400000;
      list = list.filter((c) => c.createdAt && new Date(c.createdAt).getTime() > cutoff);
    }
    if (filter === 'checkin') list = list.filter((c) => c.sub === 'OVERDUE');
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(needle));
    }
    return list;
  }, [clients, filter, q]);

  const coachFirstName = (() => {
    const n = profile?.name ?? profile?.email ?? '';
    return n.split(/[\s.@]+/)[0] || 'COACH';
  })().toUpperCase();

  return (
    <PhoneShell screen="Coach roster">
      <div className="op-app op-app--tight">
        <div className="op-header" style={{ padding: '8px 4px 14px' }}>
          <button type="button" className="op-icon-btn" aria-label="Menu"><HamburgerSvg /></button>
          <div style={{ textAlign: 'center' }}>
            <div className="op-title">ROSTER</div>
            <div style={{ fontSize: 10, color: '#888', letterSpacing: '1.5px', marginTop: 2 }}>
              {counts.active} ACTIVE{counts.flagged ? ` · ${counts.flagged} FLAGGED` : ''}
            </div>
          </div>
          {/* TODO: wire to invite-client function (already exists at netlify/functions/invite-client.js) */}
          <button type="button" className="op-icon-btn" aria-label="Add client" onClick={() => nav('/coach/clients-legacy')}><PlusSvg /></button>
        </div>

        <div style={{ textAlign: 'center' }}>
          <span className="op-coach-mode-pill">COACH MODE · {coachFirstName}</span>
        </div>

        <div className="op-summary-strip">
          <div className="op-ss-cell"><div className="op-ss-num">{counts.active}</div><div className="op-ss-label">ACTIVE</div></div>
          <div className="op-ss-cell"><div className="op-ss-num op-gold">{counts.onTrack}</div><div className="op-ss-label">ON TRACK</div></div>
          <div className="op-ss-cell"><div className="op-ss-num">{counts.slipping}</div><div className="op-ss-label">SLIPPING</div></div>
          <div className="op-ss-cell"><div className="op-ss-num op-red">{counts.flagged}</div><div className="op-ss-label">FLAGGED</div></div>
        </div>

        <div className="op-filter-row" style={{ margin: '0 4px 12px' }}>
          <button type="button" className={`op-chip${filter === 'all' ? ' op-active' : ''}`} onClick={() => setFilter('all')}>ALL · {counts.active}</button>
          <button type="button" className={`op-chip${filter === 'flagged' ? ' op-active' : ''}`} onClick={() => setFilter('flagged')}>FLAGGED · {counts.flagged}</button>
          <button type="button" className={`op-chip${filter === 'new' ? ' op-active' : ''}`} onClick={() => setFilter('new')}>NEW</button>
          <button type="button" className={`op-chip${filter === 'checkin' ? ' op-active' : ''}`} onClick={() => setFilter('checkin')}>CHECK-IN DUE</button>
        </div>

        <div className="op-search-bar">
          <SearchSvg />
          <input placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="op-table-head">
          <span />
          <span>CLIENT</span>
          <span>CHECK-IN</span>
          <span>ADHERE</span>
          <span />
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 11, letterSpacing: '2px' }}>LOADING ROSTER…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 11, letterSpacing: '2px' }}>
            NO CLIENTS MATCH.
          </div>
        ) : null}

        <div className="op-client-list">
          {filtered.map((c) => {
            const isExpanded = expandedId === c.id;
            const classes = ['op-client-row'];
            if (c.flagged && !isExpanded) classes.push('op-flagged');
            if (isExpanded) classes.push('op-expanded');
            const weightLine = c.weight != null
              ? `${Number(c.weight).toFixed(1)}${c.weightDelta != null ? ` ${c.weightDelta < 0 ? '↓' : '↑'} ${Math.abs(c.weightDelta).toFixed(1)} lb` : ''}`
              : '—';
            return (
              <div
                key={c.id}
                className={classes.join(' ')}
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setExpandedId(isExpanded ? null : c.id);
                }}
              >
                <div className="op-cr-avatar">{c.initials}</div>
                <div className="op-cr-body">
                  <div className="op-cr-name">{c.name}</div>
                  <div className="op-cr-last">{c.last}</div>
                </div>
                <div className="op-cr-checkin">{c.checkin}<span className="op-small">{c.sub}</span></div>
                <div className={`op-cr-adh ${c.adhClass}`}>{c.adh}%</div>
                <div className={`op-cr-flag op-flag-${c.flag}`} />

                {isExpanded ? (
                  <div className="op-client-detail" onClick={(e) => e.stopPropagation()}>
                    <div className="op-cd-row"><span className="op-lbl">WEIGHT (LATEST)</span><span className="op-val">{weightLine}</span></div>
                    {/* TODO: needs target_protein_g cross-ref + meal_log sums per day for true protein avg. Showing adherence proxy. */}
                    <div className="op-cd-row"><span className="op-lbl">14-DAY ADHERE</span><span className={`op-val ${c.adhClass === 'op-good' ? 'op-gold' : c.adhClass === 'op-bad' ? 'op-red' : ''}`}>{c.adh}%</span></div>
                    <div className="op-cd-row"><span className="op-lbl">LAST ACTIVITY</span><span className="op-val">{c.last}</span></div>
                    <div className="op-cd-row"><span className="op-lbl">CHECK-IN</span><span className={`op-val ${c.sub === 'OVERDUE' ? 'op-red' : ''}`}>{c.checkin} · {c.sub}</span></div>

                    <div className="op-cd-notes">
                      <div className="op-cd-notes-head">
                        <span className="op-cd-notes-label">COACH NOTE · {listening ? 'DICTATING' : 'TAP MIC TO DICTATE'}</span>
                        <button
                          type="button"
                          className="op-cd-notes-mic"
                          onClick={toggle}
                          aria-pressed={listening}
                          aria-label={listening ? 'Stop dictation' : 'Start dictation'}
                        >
                          <MicSvg />
                        </button>
                      </div>
                      <div className="op-cd-quote">
                        {transcript || `"Quick note about ${c.name.toLowerCase()}…"`}
                      </div>
                      {/* TODO: wire to client_notes.insert when dictation finishes */}
                      <div className="op-cd-parsed">→ SAVE TO {c.name.replace(/ .*/, '')}</div>
                    </div>

                    <div className="op-cd-actions">
                      <button type="button" className="op-cd-action" onClick={(e) => { e.stopPropagation(); nav(`/coach/clients/${c.id}?tab=messages`); }}>MESSAGE</button>
                      <button type="button" className="op-cd-action" onClick={(e) => { e.stopPropagation(); nav(`/coach/clients/${c.id}`); }}>OPEN PLAN</button>
                      <button type="button" className="op-cd-action op-gold" onClick={(e) => { e.stopPropagation(); nav(`/coach/clients/${c.id}?tab=checkins`); }}>CHECK-IN</button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav active="roster" variant="coach" />
    </PhoneShell>
  );
}
