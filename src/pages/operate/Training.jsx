import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import { CloseSvg, PlaySvg, MicSvg, CheckSvg } from '../../components/operate/svg';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';

const WAVE_HEIGHTS = [6, 14, 22, 10, 18, 8, 24, 14, 6, 20, 12, 16, 8, 22, 10, 14, 6, 18, 12, 20];

// Normalize an exercise row into a uniform shape with an editable sets array.
function normalizeExercise(ex, prescribedCount = 3) {
  const targetSetCount = Number(ex.sets) || prescribedCount;
  const existing = Array.isArray(ex.sets_log) ? ex.sets_log
    : Array.isArray(ex.logged_sets) ? ex.logged_sets
    : Array.isArray(ex.sets) ? null
    : [];
  // If `ex.sets` is a number (prescribed count), expand into blanks.
  // If `ex.sets` is already an array of set objects, treat as sets_log.
  let setsLog;
  if (Array.isArray(ex.sets)) {
    setsLog = ex.sets.map((s) => ({
      weight: s.weight ?? '',
      reps: s.reps ?? '',
      rpe: s.rpe ?? '',
      done: Boolean(s.done),
    }));
  } else if (existing && existing.length) {
    setsLog = existing.map((s) => ({
      weight: s.weight ?? '',
      reps: s.reps ?? '',
      rpe: s.rpe ?? '',
      done: Boolean(s.done),
    }));
  } else {
    setsLog = Array.from({ length: targetSetCount }, () => ({ weight: '', reps: '', rpe: '', done: false }));
  }
  return {
    name: ex.name ?? ex.title ?? 'Exercise',
    targetSets: targetSetCount,
    targetReps: ex.reps ?? '—',
    targetLoad: ex.load ?? ex.weight ?? null,
    restSec: Number(ex.rest_sec) || 90,
    sets_log: setsLog,
  };
}

function totalsFor(exercises) {
  let total = 0;
  let done = 0;
  for (const ex of exercises) {
    for (const s of ex.sets_log) {
      total += 1;
      if (s.done) done += 1;
    }
  }
  return { total, done };
}

export default function OperateTraining() {
  const nav = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [activeExIdx, setActiveExIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const saveTimer = useRef(null);
  const { listening, transcript, toggle } = useVoiceCapture();

  useEffect(() => {
    if (!isSupabaseConfigured || !user || !id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('workout_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (cancelled) return;
        if (e) setError(e.message);
        if (data) {
          setSession(data);
          const list = Array.isArray(data.exercises) ? data.exercises : [];
          const normalized = list.map((ex) => normalizeExercise(ex));
          setExercises(normalized);
          // Pick first non-fully-done exercise as active.
          const firstIncomplete = normalized.findIndex((ex) =>
            ex.sets_log.some((s) => !s.done),
          );
          setActiveExIdx(firstIncomplete < 0 ? 0 : firstIncomplete);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, user?.id]);

  // Debounced save back to workout_sessions.exercises. We persist a `sets_log`
  // array on each exercise so the prescribed `sets`/`reps` fields are
  // preserved alongside what the client actually logged.
  const scheduleSave = useCallback((nextExercises) => {
    if (!session?.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const original = Array.isArray(session.exercises) ? session.exercises : [];
      const merged = nextExercises.map((ex, i) => ({
        ...(original[i] ?? {}),
        name: ex.name,
        sets: original[i]?.sets ?? ex.targetSets,
        reps: original[i]?.reps ?? ex.targetReps,
        sets_log: ex.sets_log,
      }));
      const { done, total } = totalsFor(nextExercises);
      const patch = { exercises: merged };
      if (done === total && total > 0 && !session.performed_at) {
        patch.performed_at = new Date().toISOString();
      }
      await supabase.from('workout_sessions').update(patch).eq('id', session.id);
    }, 400);
  }, [session?.id, session?.performed_at, session?.exercises]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  function updateSet(exIdx, setIdx, patch) {
    setExercises((curr) => {
      const next = curr.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets_log = ex.sets_log.map((s, j) => (j === setIdx ? { ...s, ...patch } : s));
        return { ...ex, sets_log };
      });
      scheduleSave(next);
      return next;
    });
  }

  const totals = useMemo(() => totalsFor(exercises), [exercises]);
  const progressPct = totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0;
  const activeExercise = exercises[activeExIdx];
  const activeSetIdx = activeExercise ? activeExercise.sets_log.findIndex((s) => !s.done) : -1;

  const sessionTitle = (session?.notes
    || (Array.isArray(session?.exercises) && session.exercises.length ? 'Session' : 'Training'))
    .toUpperCase();

  if (loading) {
    return (
      <PhoneShell screen="Training">
        <div className="op-app op-app--training">
          <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 11, letterSpacing: '2px' }}>LOADING…</div>
        </div>
        <BottomNav active="training" />
      </PhoneShell>
    );
  }

  if (!session) {
    return (
      <PhoneShell screen="Training">
        <div className="op-session-header">
          <div className="op-sh-top">
            <button type="button" className="op-icon-btn" onClick={() => nav('/calendar')} aria-label="Close session">
              <CloseSvg />
            </button>
            <div className="op-sh-title">SESSION NOT FOUND</div>
            <div className="op-sh-timer" />
          </div>
        </div>
        <div className="op-app op-app--training">
          <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 11, letterSpacing: '2px' }}>
            {error ?? 'NO SESSION MATCHES THIS LINK.'}
          </div>
        </div>
        <BottomNav active="training" />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell screen="Training">
      <div className="op-session-header">
        <div className="op-sh-top">
          <button type="button" className="op-icon-btn" onClick={() => nav('/calendar')} aria-label="Close session">
            <CloseSvg />
          </button>
          <div className="op-sh-title">{sessionTitle}</div>
          <div className="op-sh-timer">{totals.done}/{totals.total}</div>
        </div>
        <div className="op-progress-row">
          <div className="op-progress-track"><div className="op-progress-fill" style={{ width: `${progressPct}%` }} /></div>
          <div className="op-progress-text">{totals.done} / {totals.total} SETS</div>
        </div>
      </div>

      <div className="op-app op-app--training">
        {exercises.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 11, letterSpacing: '2px' }}>
            NO EXERCISES ON THIS SESSION.
          </div>
        ) : null}

        {exercises.map((ex, exIdx) => {
          const setsDone = ex.sets_log.filter((s) => s.done).length;
          const allDone = setsDone === ex.sets_log.length && setsDone > 0;
          const isActive = exIdx === activeExIdx;
          const cls = ['op-ex-card'];
          if (allDone) cls.push('op-done');
          else if (isActive) cls.push('op-active');

          return (
            <div key={exIdx} className={cls.join(' ')} onClick={() => !allDone && setActiveExIdx(exIdx)} style={{ cursor: !allDone ? 'pointer' : undefined }}>
              <div className="op-ex-head">
                <div className="op-ex-thumb"><PlaySvg /></div>
                <div className="op-ex-meta">
                  <div className="op-ex-num">
                    {String(exIdx + 1).padStart(2, '0')} / {String(exercises.length).padStart(2, '0')}
                    {isActive && !allDone ? ' · ACTIVE' : ''}
                  </div>
                  <div className="op-ex-name-big">{ex.name.toUpperCase()}</div>
                  <div className="op-ex-target">
                    {ex.targetSets} × {ex.targetReps}
                    {ex.targetLoad ? ` · target ${ex.targetLoad}` : ''}
                  </div>
                </div>
                <div className={`op-ex-status ${allDone ? 'op-status-done' : isActive ? 'op-status-active' : 'op-status-pending'}`}>
                  {allDone ? 'DONE' : isActive ? `SET ${Math.max(setsDone + 1, 1)} / ${ex.sets_log.length}` : (setsDone > 0 ? `${setsDone}/${ex.sets_log.length}` : '—')}
                </div>
              </div>

              {isActive && !allDone ? (
                <>
                  <div className="op-voice-log">
                    <div className="op-voice-log-head">
                      <span className="op-voice-log-label">VOICE LOG · {listening ? 'LISTENING' : 'TAP MIC TO START'}</span>
                      <button type="button" className="op-voice-log-stop" onClick={(e) => { e.stopPropagation(); toggle(); }}>
                        {listening ? 'TAP TO STOP' : 'START'}
                      </button>
                    </div>
                    <div className="op-voice-log-row">
                      <button
                        type="button"
                        className="op-voice-btn"
                        onClick={(e) => { e.stopPropagation(); toggle(); }}
                        aria-label={listening ? 'Stop' : 'Start voice log'}
                      >
                        <MicSvg />
                      </button>
                      <div className="op-voice-wave">
                        {WAVE_HEIGHTS.map((_, i) => (
                          <span key={i} style={{ animationDelay: `${(i * 60) % 800}ms` }} />
                        ))}
                      </div>
                    </div>
                    {transcript ? (
                      <div className="op-voice-transcript">
                        <div className="op-quote">{transcript}</div>
                        <div className="op-parsed">→ TAP A SET ROW TO FILL · {/* TODO: parse transcript into weight/reps/RPE via gemini-voice-turn */}AUTO-PARSE COMING</div>
                      </div>
                    ) : null}
                  </div>

                  <div className="op-ex-sets-list">
                    <div className="op-set-header">
                      <span>SET</span><span>TARGET</span><span>WEIGHT</span><span>REPS</span><span>RPE</span><span />
                    </div>
                    {ex.sets_log.map((s, setIdx) => {
                      const isThisActive = setIdx === activeSetIdx;
                      const rowCls = ['op-set-row'];
                      if (isThisActive) rowCls.push('op-active');
                      return (
                        <div key={setIdx} className={rowCls.join(' ')} onClick={(e) => e.stopPropagation()}>
                          <span className="op-set-num">{setIdx + 1}</span>
                          <span className="op-set-target">{ex.targetReps} × {ex.targetLoad ?? '—'}</span>
                          <input
                            className={`op-set-input${s.done ? ' op-filled' : isThisActive ? ' op-active' : ''}`}
                            placeholder="LB"
                            value={s.weight}
                            readOnly={s.done}
                            onChange={(e) => updateSet(exIdx, setIdx, { weight: e.target.value })}
                          />
                          <input
                            className={`op-set-input${s.done ? ' op-filled' : isThisActive ? ' op-active' : ''}`}
                            placeholder="REPS"
                            value={s.reps}
                            readOnly={s.done}
                            onChange={(e) => updateSet(exIdx, setIdx, { reps: e.target.value })}
                          />
                          <input
                            className={`op-set-input${s.done ? ' op-filled' : isThisActive ? ' op-active' : ''}`}
                            placeholder="RPE"
                            value={s.rpe}
                            readOnly={s.done}
                            onChange={(e) => updateSet(exIdx, setIdx, { rpe: e.target.value })}
                          />
                          <button
                            type="button"
                            className={`op-set-check${s.done ? ' op-done' : ''}`}
                            aria-label={`Mark set ${setIdx + 1} complete`}
                            onClick={() => updateSet(exIdx, setIdx, { done: !s.done })}
                          >
                            <CheckSvg />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      <BottomNav active="training" />
    </PhoneShell>
  );
}
