import { useEffect, useRef, useState } from 'react';
import { Pin, Plus, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

function summaryOf(pin) {
  switch (pin.type) {
    case 'program':
      return `Program · ${pin.data?.title ?? `Week ${pin.data?.week_number ?? '?'}`}`;
    case 'check_in':
      return `Check-in · ${pin.data?.date?.slice(0, 10) ?? '—'}`;
    case 'review':
      return `Review · ${pin.data?.week_starting ?? '—'}`;
    case 'habits':
      return `Habit stack · ${(pin.data?.habit_list ?? []).length} levers`;
    default:
      return String(pin.type);
  }
}

export function ContextPinMenu({ userId, conversationId, pins, onChange }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState({ programs: [], checkIns: [], reviews: [], habits: null });
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open || !userId || !isSupabaseConfigured) return;
    (async () => {
      const [{ data: programs }, { data: checkIns }, { data: reviews }, { data: habits }] = await Promise.all([
        supabase
          .from('programs')
          .select('id,week_number,schedule,exercises')
          .eq('client_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('check_ins')
          .select('id,date,weight,body_fat,notes')
          .eq('client_id', userId)
          .order('date', { ascending: false })
          .limit(5),
        supabase
          .from('reviews')
          .select('id,week_starting,summary,constraints,adjustments,metrics')
          .eq('client_id', userId)
          .order('week_starting', { ascending: false })
          .limit(5),
        supabase
          .from('habits')
          .select('habit_list,check_history')
          .eq('client_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setOptions({
        programs: programs ?? [],
        checkIns: checkIns ?? [],
        reviews: reviews ?? [],
        habits: habits ?? null,
      });
    })();
  }, [open, userId]);

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function add(pin) {
    if (!conversationId) return;
    const next = [...(pins ?? []), pin];
    await supabase.from('conversations').update({ context: next }).eq('id', conversationId);
    setOpen(false);
    onChange?.(next);
  }

  async function remove(idx) {
    if (!conversationId) return;
    const next = (pins ?? []).filter((_, i) => i !== idx);
    await supabase.from('conversations').update({ context: next }).eq('id', conversationId);
    onChange?.(next);
  }

  return (
    <div ref={wrapRef} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={!conversationId}
          className="flex items-center gap-1 border border-line bg-black/30 px-3 py-1.5 text-[0.65rem] uppercase tracking-widest2 text-mute hover:border-gold disabled:opacity-40"
        >
          <Plus size={12} /> Pin context
        </button>
        {(pins ?? []).map((pin, i) => (
          <span
            key={i}
            className="flex items-center gap-1 border border-gold bg-black/40 px-2 py-1 text-[0.6rem] uppercase tracking-widest2 text-gold"
          >
            <Pin size={10} />
            {summaryOf(pin)}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove pinned context"
              className="ml-1 text-mute hover:text-red-300"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        {!conversationId ? (
          <span className="text-[0.6rem] uppercase tracking-widest2 text-faint">
            Start the conversation to pin context.
          </span>
        ) : null}
      </div>

      {open ? (
        <div className="relative">
          <div className="absolute left-0 top-1 z-20 w-80 max-w-[90vw] border border-line bg-bg shadow-2xl">
            <Section title="Programs">
              {options.programs.length === 0 ? <Empty /> : options.programs.map((p) => (
                <OptionRow
                  key={p.id}
                  label={p.schedule?.title ?? `Week ${p.week_number}`}
                  onClick={() => add({ type: 'program', data: { title: p.schedule?.title, week_number: p.week_number, exercises: p.exercises } })}
                />
              ))}
            </Section>
            <Section title="Check-ins">
              {options.checkIns.length === 0 ? <Empty /> : options.checkIns.map((c) => (
                <OptionRow
                  key={c.id}
                  label={`${c.date?.slice(0, 10)} · ${c.weight ?? '—'} kg`}
                  onClick={() => add({ type: 'check_in', data: c })}
                />
              ))}
            </Section>
            <Section title="Reviews">
              {options.reviews.length === 0 ? <Empty /> : options.reviews.map((r) => (
                <OptionRow
                  key={r.id}
                  label={`Week of ${r.week_starting}`}
                  onClick={() => add({ type: 'review', data: r })}
                />
              ))}
            </Section>
            <Section title="Habit stack">
              {!options.habits?.habit_list?.length ? <Empty /> : (
                <OptionRow
                  label={`${options.habits.habit_list.length} habits`}
                  onClick={() => add({ type: 'habits', data: options.habits })}
                />
              )}
            </Section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="border-b border-line last:border-b-0">
      <div className="label px-3 py-2">{title}</div>
      <ul>{children}</ul>
    </div>
  );
}

function OptionRow({ label, onClick }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center px-3 py-2 text-left text-sm text-mute hover:bg-black/40 hover:text-ink"
      >
        {label}
      </button>
    </li>
  );
}

function Empty() {
  return <li className="px-3 py-2 text-xs text-faint">Nothing to pin.</li>;
}
