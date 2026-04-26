import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

let cached = null;
async function loadExercises() {
  if (cached) return cached;
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from('exercises')
    .select('id,name,category,primary_muscle,equipment,youtube_id,cues')
    .order('name');
  cached = data ?? [];
  return cached;
}

export function ExercisePicker({ value, onPick, placeholder = 'Exercise', className = '' }) {
  const [query, setQuery] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    loadExercises().then(setOptions);
  }, []);

  useEffect(() => {
    setQuery(value ?? '');
  }, [value]);

  useEffect(() => {
    function onDocClick(e) {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 20);
    return options
      .filter((o) =>
        o.name.toLowerCase().includes(q) ||
        o.primary_muscle?.toLowerCase().includes(q) ||
        o.category?.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [options, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown') {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      setActive((a) => Math.min(a + 1, filtered.length - 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setActive((a) => Math.max(a - 1, 0));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const picked = filtered[active];
      if (picked) {
        onPick(picked);
        setQuery(picked.name);
        setOpen(false);
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="exercise-picker-list"
        aria-activedescendant={open && filtered[active] ? `exercise-option-${filtered[active].id}` : undefined}
        className="w-full border border-line bg-black/40 px-4 py-3 font-body text-ink placeholder:text-faint focus:border-gold"
      />
      {open ? (
        filtered.length > 0 ? (
          <ul
            id="exercise-picker-list"
            ref={listRef}
            role="listbox"
            className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto border border-line bg-bg shadow-xl"
          >
            {filtered.map((o, i) => (
              <li key={o.id} id={`exercise-option-${o.id}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    onPick(o);
                    setQuery(o.name);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm ${
                    i === active ? 'bg-black/60' : 'hover:bg-black/40'
                  }`}
                >
                  <span className="font-display tracking-wider2 text-ink">{o.name}</span>
                  <span className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                    {[o.primary_muscle, o.equipment].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : query.trim().length > 0 ? (
          <div
            id="exercise-picker-list"
            role="status"
            className="absolute left-0 right-0 z-10 mt-1 border border-line bg-bg px-4 py-3 text-xs uppercase tracking-widest2 text-faint shadow-xl"
          >
            No match. Type the exercise name as it should appear.
          </div>
        ) : null
      ) : null}
    </div>
  );
}
