import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { useRealtime } from '../../hooks/useRealtime';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import { ChevronLeftSvg, PhoneSvg, PlusSvg, CameraSvg, MicSvg } from '../../components/operate/svg';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';

const LIVE_WAVE = [4, 10, 14, 8, 16, 12, 6, 14, 10, 16, 8, 12, 6, 14];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayDividerLabel(d) {
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return `TODAY · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (isSameDay(d, yest)) return 'YESTERDAY';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

async function ensureThread(clientId) {
  const { data: existing } = await supabase
    .from('dm_threads')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (existing) return existing;
  const { data: created } = await supabase
    .from('dm_threads')
    .insert({ client_id: clientId })
    .select()
    .maybeSingle();
  return created;
}

export default function OperateMessages() {
  const nav = useNavigate();
  const { user, role } = useAuth();
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [coachProfile, setCoachProfile] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const { listening, transcript, toggle } = useVoiceCapture({
    onFinal: (text) => setDraft((d) => (d ? `${d} ${text}` : text)),
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    let cancelled = false;
    ensureThread(user.id).then((t) => {
      if (!cancelled) setThread(t ?? null);
    });
    // Resolve the assigned coach for header info.
    supabase
      .from('coach_client_assignments')
      .select('coach_id,is_primary,ended_on,profiles:coach_id(id,name,email)')
      .eq('client_id', user.id)
      .is('ended_on', null)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setCoachProfile(data?.profiles ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  const load = useCallback(async () => {
    if (!thread?.id) return;
    const { data } = await supabase
      .from('dm_messages')
      .select('*')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);

    // Mark unread (from the other party) as read by viewer.
    const unreadField = role === 'coach' ? 'read_by_coach' : 'read_by_client';
    const unreadIds = (data ?? [])
      .filter((m) => m.author_id !== user?.id && !m[unreadField])
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      await supabase.from('dm_messages').update({ [unreadField]: true }).in('id', unreadIds);
    }
  }, [thread?.id, user?.id, role]);

  useEffect(() => { load(); }, [load]);

  const realtimeFilter = thread ? `thread_id=eq.${thread.id}` : undefined;
  useRealtime('dm_messages', load, realtimeFilter);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = (listening ? transcript : draft).trim();
    if (!text || !thread || !user) return;
    setBusy(true);
    try {
      await supabase.from('dm_messages').insert({
        thread_id: thread.id,
        author_id: user.id,
        content: text,
        read_by_client: role !== 'coach',
        read_by_coach: role === 'coach',
      });
      await supabase.from('dm_threads').update({ last_activity_at: new Date().toISOString() }).eq('id', thread.id);
      setDraft('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const buckets = [];
    for (const m of messages) {
      const d = new Date(m.created_at);
      const key = d.toDateString();
      let bucket = buckets[buckets.length - 1];
      if (!bucket || bucket.key !== key) {
        bucket = { key, label: dayDividerLabel(d), items: [] };
        buckets.push(bucket);
      }
      bucket.items.push(m);
    }
    return buckets;
  }, [messages]);

  const coachName = (coachProfile?.name ?? coachProfile?.email ?? 'COACH').toUpperCase();
  const coachInitials = (() => {
    const n = (coachProfile?.name ?? coachProfile?.email ?? 'PK').trim();
    const parts = n.split(/[\s.@]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0]?.slice(0, 2).toUpperCase() || 'PK';
  })();

  return (
    <PhoneShell screen="Messages">
      <div className="op-chat-header">
        <button type="button" className="op-icon-btn" onClick={() => nav('/dashboard')} aria-label="Back">
          <ChevronLeftSvg />
        </button>
        <div className="op-chat-coach-info">
          <div className="op-coach-avatar">{coachInitials}</div>
          <div className="op-coach-text">
            <span className="op-coach-name-h">{coachName}{coachProfile ? ' · COACH' : ''}</span>
            <span className="op-coach-status">{messages.length ? 'OPEN THREAD' : 'NEW THREAD'}</span>
          </div>
        </div>
        <button type="button" className="op-icon-btn" aria-label="Call"><PhoneSvg /></button>
      </div>

      <div className="op-thread">
        {grouped.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 11, letterSpacing: '2px' }}>
            NO MESSAGES YET. SAY HELLO.
          </div>
        ) : null}
        {grouped.map((bucket) => (
          <div key={bucket.key}>
            <div className="op-day-divider">{bucket.label}</div>
            {bucket.items.map((m) => {
              const mine = m.author_id === user?.id;
              const time = new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
              return (
                <div key={m.id} className={`op-msg ${mine ? 'op-me' : 'op-coach'}`}>
                  {m.content}
                  <div className="op-msg-time">{time}</div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="op-composer">
        {listening ? (
          <div className="op-listening-pill">
            <span className="op-listening-dot" />
            <span className="op-listening-text">LISTENING…</span>
            <div className="op-live-wave">
              {LIVE_WAVE.map((_, i) => (
                <span key={i} style={{ animationDelay: `${(i * 70) % 700}ms` }} />
              ))}
            </div>
          </div>
        ) : null}
        <form
          className="op-composer-row"
          onSubmit={(e) => { e.preventDefault(); send(); }}
        >
          {/* TODO: needs an `audio_attachment` column on dm_messages to support coach voice memos.
              For now the + button is a placeholder. */}
          <button type="button" className="op-cmp-btn" aria-label="Add attachment"><PlusSvg /></button>
          <input
            className="op-cmp-input"
            placeholder={listening ? (transcript || 'Speak…') : 'Message…'}
            value={listening ? transcript : draft}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={listening || busy}
          />
          <button type="button" className="op-cmp-btn" aria-label="Send photo"><CameraSvg /></button>
          <button
            type="button"
            className={`op-cmp-btn op-mic-cmp${listening ? ' op-listening' : ''}`}
            aria-pressed={listening}
            aria-label={listening ? 'Stop dictation' : 'Start dictation'}
            onClick={toggle}
          >
            <MicSvg />
          </button>
          {(draft.trim() || (listening && transcript.trim())) ? (
            <button
              type="submit"
              className="op-cmp-btn op-gold"
              disabled={busy}
              style={{ background: '#C9A84C', color: '#000', fontWeight: 700, fontSize: 11, letterSpacing: '1px' }}
            >
              SEND
            </button>
          ) : null}
        </form>
      </div>

      <BottomNav active="messages" />
    </PhoneShell>
  );
}
