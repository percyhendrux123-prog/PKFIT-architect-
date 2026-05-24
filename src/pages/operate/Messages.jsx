import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { useRealtime } from '../../hooks/useRealtime';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import { ChevronLeftSvg, PhoneSvg, PlusSvg, CameraSvg, MicSvg, CloseSvg } from '../../components/operate/svg';
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
  const [callOpen, setCallOpen] = useState(false);
  const [callState, setCallState] = useState('idle'); // idle | sending | done | error
  const [uploadErr, setUploadErr] = useState(null);
  const fileRef = useRef(null);
  const photoRef = useRef(null);
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

  // Upload a picked file to baseline-photos (the bucket has confirmed RLS for
  // client-write + coach-read under {user.id}/...) and send a dm_message with
  // a 24h signed URL inline. No schema change required.
  async function uploadAndSend(file) {
    if (!file || !user || !thread) return;
    setUploadErr(null);
    setBusy(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file';
      const path = `${user.id}/dm/${Date.now()}-${safe}`;
      const up = await supabase.storage
        .from('baseline-photos')
        .upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
      if (up.error) throw up.error;
      const signed = await supabase.storage
        .from('baseline-photos')
        .createSignedUrl(path, 60 * 60 * 24);
      if (signed.error) throw signed.error;
      const isImg = (file.type || '').startsWith('image/');
      const content = `${isImg ? '🖼' : '📎'} ${safe}\n${signed.data.signedUrl}`;
      await supabase.from('dm_messages').insert({
        thread_id: thread.id,
        author_id: user.id,
        content,
        read_by_client: role !== 'coach',
        read_by_coach: role === 'coach',
      });
      await supabase.from('dm_threads').update({ last_activity_at: new Date().toISOString() }).eq('id', thread.id);
      await load();
    } catch (e) {
      setUploadErr(e.message || 'Upload failed');
      setTimeout(() => setUploadErr(null), 4000);
    } finally {
      setBusy(false);
    }
  }

  async function requestCall() {
    if (callState !== 'idle' || !user || !thread) return;
    setCallState('sending');
    try {
      await supabase.from('dm_messages').insert({
        thread_id: thread.id,
        author_id: user.id,
        content: '📞 Requested a call — please reach out when free.',
        read_by_client: true,
        read_by_coach: false,
      });
      await supabase
        .from('dm_threads')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', thread.id);
      setCallState('done');
      await load();
      setTimeout(() => { setCallState('idle'); setCallOpen(false); }, 1500);
    } catch {
      setCallState('error');
      setTimeout(() => setCallState('idle'), 4000);
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
        <button
          type="button"
          className="op-icon-btn"
          aria-label="Request a call"
          onClick={() => setCallOpen(true)}
        >
          <PhoneSvg />
        </button>
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
          <button
            type="button"
            className="op-cmp-btn"
            aria-label="Add attachment"
            onClick={() => fileRef.current?.click()}
            disabled={busy || !thread}
          ><PlusSvg /></button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,video/*,audio/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAndSend(f);
              if (fileRef.current) fileRef.current.value = '';
            }}
            style={{ display: 'none' }}
          />
          <input
            className="op-cmp-input"
            placeholder={listening ? (transcript || 'Speak…') : 'Message…'}
            value={listening ? transcript : draft}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={listening || busy}
          />
          <button
            type="button"
            className="op-cmp-btn"
            aria-label="Send photo"
            onClick={() => photoRef.current?.click()}
            disabled={busy || !thread}
          ><CameraSvg /></button>
          <input
            ref={photoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAndSend(f);
              if (photoRef.current) photoRef.current.value = '';
            }}
            style={{ display: 'none' }}
          />
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

      {uploadErr ? (
        <div
          role="status"
          style={{
            position: 'fixed', left: '50%', bottom: 92, transform: 'translateX(-50%)',
            background: 'rgba(40,12,12,0.95)', border: '1px solid #5a1f1f',
            borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
            color: '#F5F5F5', fontFamily: '"DM Mono", monospace', fontSize: 12,
            zIndex: 55, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            maxWidth: '92vw',
          }}
        >
          <span>{uploadErr.slice(0, 80)}</span>
          <button
            type="button" onClick={() => setUploadErr(null)} aria-label="Dismiss"
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 2, display: 'inline-flex' }}
          ><CloseSvg /></button>
        </div>
      ) : null}

      {callOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Request a call"
          onClick={() => (callState === 'idle' ? setCallOpen(false) : null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(360px, 92vw)', background: '#161616', border: '1px solid #2a2a2a',
              borderRadius: 14, padding: 20, color: '#F5F5F5',
              fontFamily: '"DM Mono", monospace',
            }}
          >
            <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 22, letterSpacing: '2px', marginBottom: 6 }}>
              REQUEST A CALL
            </div>
            <div style={{ color: '#888', fontSize: 12, lineHeight: 1.5, marginBottom: 18 }}>
              {coachName} will get a notification in their inbox and reach out as soon as they can.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setCallOpen(false)}
                disabled={callState !== 'idle'}
                style={{
                  flex: 1, background: 'transparent', border: '1px solid #2a2a2a',
                  borderRadius: 8, padding: 11, color: '#F5F5F5',
                  fontFamily: '"Bebas Neue", sans-serif', fontSize: 13, letterSpacing: '2px',
                  cursor: callState === 'idle' ? 'pointer' : 'default',
                }}
              >CANCEL</button>
              <button
                type="button"
                onClick={requestCall}
                disabled={callState !== 'idle'}
                style={{
                  flex: 1.4, background: '#C9A84C', border: 'none', borderRadius: 8,
                  padding: 11, color: '#080808',
                  fontFamily: '"Bebas Neue", sans-serif', fontSize: 13, letterSpacing: '2px',
                  cursor: callState === 'idle' ? 'pointer' : 'default',
                }}
              >
                {callState === 'sending' ? 'NOTIFYING…'
                  : callState === 'done' ? 'NOTIFIED ✓'
                  : callState === 'error' ? 'RETRY'
                  : 'NOTIFY COACH'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav active="messages" />
    </PhoneShell>
  );
}
