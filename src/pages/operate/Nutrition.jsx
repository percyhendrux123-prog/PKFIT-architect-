import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import MicFab from '../../components/operate/MicFab';
import { ChevronLeftSvg, ChevronRightSvg, CalendarSvg, MicSvg, CameraSvg, PlusSvg, CloseSvg } from '../../components/operate/svg';
import { SnapMealModal } from '../../components/SnapMealModal';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DOWS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MEAL_SLOTS = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS'];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isToday(d) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function macroSum(meals) {
  const total = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const m of meals) {
    if (!m.eaten) continue;
    const macros = m.macros ?? {};
    total.kcal += Number(macros.kcal ?? 0);
    total.p += Number(macros.p ?? 0);
    total.c += Number(macros.c ?? 0);
    total.f += Number(macros.f ?? 0);
  }
  return total;
}

function groupBySlot(meals) {
  const out = { BREAKFAST: [], LUNCH: [], DINNER: [], SNACKS: [] };
  for (const m of meals) {
    const slot = String(m.meal_type ?? '').toUpperCase();
    if (slot.startsWith('BREAK')) out.BREAKFAST.push(m);
    else if (slot.startsWith('LUNCH')) out.LUNCH.push(m);
    else if (slot.startsWith('DINNER')) out.DINNER.push(m);
    else out.SNACKS.push(m);
  }
  return out;
}

// SVG ring math: circumference 2*pi*42 ≈ 264. The remaining stroke is the
// portion of the ring that's NOT yet consumed.
const RING_CIRC = 264;
function ringOffset(consumed, target) {
  if (!target || target <= 0) return RING_CIRC;
  const pct = Math.min(1, consumed / target);
  return Math.round(RING_CIRC * (1 - pct));
}

// 6-week month grid for the date picker popover (mirrors Calendar.jsx
// pattern so the look matches the Training calendar).
function buildPickerCells(cursor) {
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - startOffset);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, muted: d.getMonth() !== cursor.getMonth() });
  }
  return cells;
}

export default function OperateNutrition() {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const [day, setDay] = useState(() => new Date());
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const dayKey = ymd(day);

  // Snap-a-meal modal — opened by the global SNAP IT button.
  const [snapOpen, setSnapOpen] = useState(false);
  // Date picker popover — opened by the top-right calendar icon.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCursor, setPickerCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  // Slot currently capturing voice; null when not capturing. Global voice
  // button uses 'SNACKS' so a quick log lands in the snacks bucket.
  const [voiceSlot, setVoiceSlot] = useState(null);
  // Undo toast for the most recent add. Survives 5s; tap UNDO to delete.
  const [undo, setUndo] = useState(null); // { id, label, ts }
  const undoTimer = useRef(null);

  function showUndo(id, label) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ id, label, ts: Date.now() });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  }
  async function doUndo() {
    if (!undo) return;
    const id = undo.id;
    setMeals((list) => list.filter((m) => m.id !== id));
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await supabase.from('meals').delete().eq('id', id);
  }

  // Voice capture — onFinal fires when the user stops speaking. We insert a
  // meal row in the captured slot whose only item is the transcript so the
  // food field shows what they said. Auto-parse into macros is TODO.
  const voice = useVoiceCapture({
    onFinal: async (text) => {
      const slot = voiceSlot || 'SNACKS';
      setVoiceSlot(null);
      if (!user || !text.trim()) return;
      const row = {
        client_id: user.id,
        day: dayKey,
        date: dayKey,
        meal_type: slot.toLowerCase(),
        items: [{ name: text.trim() }],
        macros: {},
        eaten: false,
      };
      const { data } = await supabase.from('meals').insert(row).select().maybeSingle();
      if (data) {
        setMeals((list) => [...list, data]);
        showUndo(data.id, `Added: ${text.trim().slice(0, 32)}`);
      }
    },
  });

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('meals')
      .select('id,meal_type,items,macros,eaten,eaten_at,date')
      .eq('client_id', user.id)
      .eq('date', dayKey)
      .order('meal_type');
    setMeals(data ?? []);
    setLoading(false);
  }, [user?.id, dayKey]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => macroSum(meals), [meals]);
  const targetKcal = profile?.target_kcal ?? 2400;
  const targetP = profile?.target_protein_g ?? 200;
  const targetC = profile?.target_carbs_g ?? 240;
  const targetF = profile?.target_fat_g ?? 80;
  const remaining = Math.max(0, targetKcal - Math.round(totals.kcal));

  const grouped = useMemo(() => groupBySlot(meals), [meals]);
  const sectionTargets = useMemo(() => {
    // Split daily target across slots: 25% B, 30% L, 30% D, 15% S.
    const split = { BREAKFAST: 0.25, LUNCH: 0.30, DINNER: 0.30, SNACKS: 0.15 };
    return Object.fromEntries(
      Object.entries(split).map(([k, v]) => [k, Math.round(targetKcal * v)]),
    );
  }, [targetKcal]);

  function shiftDay(delta) {
    setDay((d) => {
      const next = new Date(d);
      next.setDate(d.getDate() + delta);
      return next;
    });
  }

  async function toggleEaten(meal) {
    const next = !meal.eaten;
    setMeals((list) => list.map((m) => (m.id === meal.id ? { ...m, eaten: next } : m)));
    await supabase
      .from('meals')
      .update({ eaten: next, eaten_at: next ? new Date().toISOString() : null })
      .eq('id', meal.id);
  }

  async function addBlankMeal(slot) {
    if (!user) return;
    const row = {
      client_id: user.id,
      day: dayKey,
      date: dayKey,
      meal_type: slot.toLowerCase(),
      items: [],
      macros: {},
      eaten: false,
    };
    const { data } = await supabase.from('meals').insert(row).select().maybeSingle();
    if (data) {
      setMeals((list) => [...list, data]);
      showUndo(data.id, `Added blank ${slot.toLowerCase()}`);
    }
  }

  // Snap-a-meal commit handler. Modal returns { meal_type, items, macros }.
  async function onSnapConfirm(payload) {
    if (!user) return;
    const row = {
      client_id: user.id,
      day: dayKey,
      date: dayKey,
      meal_type: (payload.meal_type ?? 'meal').toLowerCase(),
      items: payload.items ?? [],
      macros: payload.macros ?? {},
      eaten: true,
      eaten_at: new Date().toISOString(),
    };
    const { data } = await supabase.from('meals').insert(row).select().maybeSingle();
    if (data) {
      setMeals((list) => [...list, data]);
      const label = (payload.items?.[0]?.name) || 'photo meal';
      showUndo(data.id, `Snapped: ${String(label).slice(0, 32)}`);
    }
  }

  function startVoiceFor(slot) {
    setVoiceSlot(slot);
    voice.start();
  }
  function cancelVoice() {
    setVoiceSlot(null);
    voice.stop();
  }

  function pickDate(date) {
    setDay(new Date(date));
    setPickerOpen(false);
  }

  const dayLabel = `${isToday(day) ? 'TODAY · ' : ''}${DOWS[day.getDay()]} ${MONTHS[day.getMonth()]} ${day.getDate()}`;

  return (
    <PhoneShell screen="Nutrition">
      <div className="op-app">
        <div className="op-header">
          <button type="button" className="op-icon-btn" onClick={() => nav('/dashboard')} aria-label="Back">
            <ChevronLeftSvg />
          </button>
          <div className="op-title">NUTRITION</div>
          <button
            type="button"
            className="op-icon-btn"
            aria-label="Pick a date"
            onClick={() => {
              setPickerCursor(new Date(day.getFullYear(), day.getMonth(), 1));
              setPickerOpen(true);
            }}
          >
            <CalendarSvg />
          </button>
        </div>

        <div className="op-date-bar">
          <button type="button" className="op-icon-btn op-icon-btn--mute" onClick={() => shiftDay(-1)} aria-label="Previous day"><ChevronLeftSvg /></button>
          <div className="op-date-current">
            <span className="op-date-day">{dayLabel}</span>
            {/* TODO: needs program phase + week_number on the active program to fill this line dynamically */}
            <span className="op-date-sub">{profile?.plan ? `${String(profile.plan).toUpperCase()} PLAN` : 'NUTRITION'}</span>
          </div>
          <button type="button" className="op-icon-btn op-icon-btn--mute" onClick={() => shiftDay(1)} aria-label="Next day"><ChevronRightSvg /></button>
        </div>

        <div className="op-summary-card">
          <div className="op-cal-strip">
            <div className="op-cal-cell"><div className="op-cal-num">{Math.round(totals.kcal)}</div><div className="op-cal-lbl">CONSUMED</div></div>
            <div className="op-cal-cell"><div className="op-cal-num op-gold">{remaining}</div><div className="op-cal-lbl op-gold">REMAINING</div></div>
            <div className="op-cal-cell"><div className="op-cal-num op-muted">{targetKcal}</div><div className="op-cal-lbl">TARGET KCAL</div></div>
          </div>
          <div className="op-macro-ring-row">
            {[
              { name: 'PROTEIN', consumed: totals.p, target: targetP, color: '#C9A84C' },
              { name: 'CARBS', consumed: totals.c, target: targetC, color: '#7a8fb5' },
              { name: 'FAT', consumed: totals.f, target: targetF, color: '#a37b5e' },
            ].map((m) => (
              <div key={m.name} className="op-macro-ring-cell">
                <div className="op-mr-ring">
                  <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#2a2a2a" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={m.color} strokeWidth="8"
                      strokeDasharray={RING_CIRC} strokeDashoffset={ringOffset(m.consumed, m.target)} strokeLinecap="round" />
                  </svg>
                  <div className="op-mr-center">
                    <div className="op-mr-num">{Math.max(0, Math.round(m.target - m.consumed))}</div>
                    <div className="op-mr-unit">G LEFT</div>
                  </div>
                </div>
                <div className="op-mr-name">{m.name}</div>
                <div className="op-mr-prog">{Math.round(m.consumed)} / {m.target}G</div>
              </div>
            ))}
          </div>
        </div>

        <div className="op-voice-bar">
          <button
            type="button"
            className="op-v-btn op-voice"
            onClick={() => (voice.listening ? cancelVoice() : startVoiceFor('SNACKS'))}
            aria-pressed={voice.listening}
            disabled={!voice.supported}
          >
            <div className="op-v-icon"><MicSvg /></div>
            <div className="op-v-text">
              <span className="op-v-title">{voice.listening ? 'LISTENING…' : 'SAY IT'}</span>
              <span className="op-v-sub">{voice.listening ? (voice.transcript || 'speak…').slice(0, 24) : 'VOICE LOG'}</span>
            </div>
          </button>
          <button
            type="button"
            className="op-v-btn op-photo"
            onClick={() => setSnapOpen(true)}
          >
            <div className="op-v-icon"><CameraSvg /></div>
            <div className="op-v-text"><span className="op-v-title">SNAP IT</span><span className="op-v-sub">PHOTO MEAL</span></div>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 11, letterSpacing: '2px' }}>LOADING…</div>
        ) : null}

        {MEAL_SLOTS.map((slot) => {
          const slotMeals = grouped[slot] ?? [];
          const slotKcal = slotMeals
            .filter((m) => m.eaten)
            .reduce((sum, m) => sum + Number(m.macros?.kcal ?? 0), 0);
          const target = sectionTargets[slot];
          const empty = slotMeals.length === 0;

          return (
            <div key={slot} className="op-meal-section">
              <div className="op-meal-head">
                <span className="op-meal-name">{slot}</span>
                <span className="op-meal-cals" style={slotKcal === 0 ? { color: '#666' } : undefined}>
                  {Math.round(slotKcal)}
                  <span className="op-of"> / {target}</span>
                </span>
              </div>
              {empty ? (
                <div className="op-empty-meal">No items logged.</div>
              ) : null}
              {slotMeals.map((m) => {
                const items = Array.isArray(m.items) ? m.items : [];
                const name = items.length
                  ? items.map((it) => (typeof it === 'string' ? it : (it.name ?? ''))).filter(Boolean).join(', ')
                  : (m.meal_type ?? 'Meal');
                const meta = items.length
                  ? items.map((it) => (typeof it === 'string' ? '' : `${it.qty ?? ''}`.trim())).filter(Boolean).join(' · ')
                  : '';
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="op-food-row"
                    onClick={() => toggleEaten(m)}
                    style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, opacity: m.eaten ? 1 : 0.6 }}
                    aria-pressed={Boolean(m.eaten)}
                  >
                    <div>
                      <div className="op-food-name" style={m.eaten ? undefined : { textDecoration: 'line-through' }}>
                        {name || 'Meal'}
                      </div>
                      <div className="op-food-meta">{meta || (m.eaten ? 'eaten' : 'tap to mark eaten')}</div>
                    </div>
                    <div className="op-food-cal">{m.macros?.kcal ? `${Math.round(m.macros.kcal)} kcal` : '—'}</div>
                  </button>
                );
              })}
              <div className="op-meal-actions">
                <button type="button" className="op-meal-action" onClick={() => addBlankMeal(slot)}>
                  <PlusSvg />ADD FOOD
                </button>
                <button
                  type="button"
                  className="op-meal-action op-gold"
                  onClick={() => {
                    if (voice.listening && voiceSlot === slot) {
                      cancelVoice();
                    } else {
                      startVoiceFor(slot);
                    }
                  }}
                  aria-pressed={voice.listening && voiceSlot === slot}
                  disabled={!voice.supported}
                >
                  <MicSvg />
                  {voice.listening && voiceSlot === slot ? 'LISTENING…' : 'SAY IT'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {pickerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pick a meal date"
          onClick={() => setPickerOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: 80,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(360px, 92vw)', background: '#161616', border: '1px solid #2a2a2a',
              borderRadius: 14, padding: 16, color: '#F5F5F5',
              fontFamily: '"DM Mono", monospace',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <button
                type="button" className="op-icon-btn op-icon-btn--mute"
                onClick={() => setPickerCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
                aria-label="Previous month"
              ><ChevronLeftSvg /></button>
              <div style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 18, letterSpacing: '2px' }}>
                {MONTHS[pickerCursor.getMonth()]} {pickerCursor.getFullYear()}
              </div>
              <button
                type="button" className="op-icon-btn op-icon-btn--mute"
                onClick={() => setPickerCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
                aria-label="Next month"
              ><ChevronRightSvg /></button>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
              fontSize: 10, color: '#888', letterSpacing: '1px', textAlign: 'center',
              marginBottom: 6,
            }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((l, i) => <span key={i}>{l}</span>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {buildPickerCells(pickerCursor).map((c, i) => {
                const sel = ymd(c.date) === dayKey;
                const isTd = isToday(c.date);
                return (
                  <button
                    key={i} type="button"
                    onClick={() => pickDate(c.date)}
                    style={{
                      aspectRatio: '1', background: sel ? '#1a1610' : '#0e0e0e',
                      border: sel ? '1px solid #C9A84C' : '0.5px solid #1a1a1a',
                      borderRadius: 8, color: c.muted ? '#444' : (sel || isTd ? '#C9A84C' : '#F5F5F5'),
                      fontFamily: '"Bebas Neue", sans-serif', fontSize: 14,
                      letterSpacing: '0.5px', cursor: 'pointer', padding: 0,
                    }}
                    aria-label={`${MONTHS[c.date.getMonth()]} ${c.date.getDate()}`}
                  >
                    {c.date.getDate()}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => pickDate(new Date())}
                style={{
                  flex: 1, background: 'transparent', border: '1px solid #2a2a2a',
                  borderRadius: 8, padding: 9, color: '#F5F5F5',
                  fontFamily: '"Bebas Neue", sans-serif', fontSize: 12, letterSpacing: '2px', cursor: 'pointer',
                }}
              >TODAY</button>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                style={{
                  flex: 1, background: '#C9A84C', border: 'none', borderRadius: 8,
                  padding: 9, color: '#080808',
                  fontFamily: '"Bebas Neue", sans-serif', fontSize: 12, letterSpacing: '2px', cursor: 'pointer',
                }}
              >DONE</button>
            </div>
          </div>
        </div>
      ) : null}

      <SnapMealModal open={snapOpen} onClose={() => setSnapOpen(false)} onConfirm={onSnapConfirm} />

      {undo ? (
        <div
          role="status"
          style={{
            position: 'fixed', left: '50%', bottom: 92, transform: 'translateX(-50%)',
            background: 'rgba(22,22,22,0.95)', border: '1px solid #2a2a2a',
            borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
            color: '#F5F5F5', fontFamily: '"DM Mono", monospace', fontSize: 12,
            zIndex: 55, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            maxWidth: '92vw',
          }}
        >
          <span style={{ letterSpacing: '0.5px' }}>{undo.label}</span>
          <button
            type="button" onClick={doUndo}
            style={{
              background: 'transparent', border: 'none', color: '#C9A84C',
              fontFamily: '"Bebas Neue", sans-serif', fontSize: 13, letterSpacing: '2px',
              cursor: 'pointer', padding: '2px 4px',
            }}
          >UNDO</button>
          <button
            type="button" onClick={() => setUndo(null)} aria-label="Dismiss"
            style={{
              background: 'transparent', border: 'none', color: '#888', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', padding: 2,
            }}
          ><CloseSvg /></button>
        </div>
      ) : null}

      <MicFab context="nutrition" />
      <BottomNav active="nutrition" />
    </PhoneShell>
  );
}
