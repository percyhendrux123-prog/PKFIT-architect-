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
  const boxRef = useRef(null);

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

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full border border-line bg-black/40 px-4 py-3 font-body text-ink placeholder:text-faint focus:border-gold"
      />
      {open && filtered.length > 0 ? (
        <ul className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto border border-line bg-bg shadow-xl">
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(o);
                  setQuery(o.name);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-black/40"
              >
                <span className="font-display tracking-wider2 text-ink">{o.name}</span>
                <span className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                  {[o.primary_muscle, o.equipment].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
