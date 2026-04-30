import { useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

function initialsFrom(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '—'
  );
}

export function Avatar({ name = '', path, size = 40, rim = true }) {
  const initials = initialsFrom(name);
  const src = useMemo(() => {
    if (!path || !isSupabaseConfigured) return null;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data?.publicUrl ?? null;
  }, [path]);

  // `rim` defaults true so coach photos / client roster avatars / exercise
  // demo thumbnails all pick up the chrome-gold specular rim on hover. Opt
  // out with rim={false} for places like the top-right user-menu chip.
  const rimClass = rim ? 'pkfit-rim' : '';

  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name} avatar` : 'Avatar'}
        loading="lazy"
        className={`border border-line object-cover ${rimClass}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center border border-line bg-black/50 font-display tracking-wider2 text-gold ${rimClass}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials}
    </div>
  );
}
