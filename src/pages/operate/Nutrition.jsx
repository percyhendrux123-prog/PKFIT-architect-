import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import MicFab from '../../components/operate/MicFab';
import { ChevronLeftSvg, ChevronRightSvg, CalendarSvg, MicSvg, CameraSvg, PlusSvg } from '../../components/operate/svg';

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

export default function OperateNutrition() {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const [day, setDay] = useState(() => new Date());
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const dayKey = ymd(day);

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
    if (data) setMeals((list) => [...list, data]);
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
          <button type="button" className="op-icon-btn" aria-label="History"><CalendarSvg /></button>
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
          {/* TODO: wire to gemini-voice-turn function for voice meal log */}
          <button type="button" className="op-v-btn op-voice">
            <div className="op-v-icon"><MicSvg /></div>
            <div className="op-v-text"><span className="op-v-title">SAY IT</span><span className="op-v-sub">VOICE LOG</span></div>
          </button>
          {/* TODO: wire to gemini-meal-photo function (already exists) — needs file input + modal */}
          <button type="button" className="op-v-btn op-photo">
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
                {/* TODO: voice-log per-slot — wire to gemini-voice-turn */}
                <button type="button" className="op-meal-action op-gold"><MicSvg />SAY IT</button>
              </div>
            </div>
          );
        })}
      </div>

      <MicFab context="nutrition" />
      <BottomNav active="nutrition" />
    </PhoneShell>
  );
}
