import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, Sparkles } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useRealtime } from '../hooks/useRealtime';

// block 0 2026-05-05: community surface RIPed. Bell now serves DMs only.
// `profile` prop retained on the component signature for API stability — the
// existing call sites pass it; removing it would force an unrelated edit pass.

function relative(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// eslint-disable-next-line no-unused-vars
export function NotificationBell({ user, role, profile }) {
  const [open, setOpen] = useState(false);
  const [dmCount, setDmCount] = useState(0);
  const [dmPreview, setDmPreview] = useState(null);
  const wrapperRef = useRef(null);
  const nav = useNavigate();

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;

    const readColumn = role === 'coach' ? 'read_by_coach' : 'read_by_client';
    const { count: dmN } = await supabase
      .from('dm_messages')
      .select('*', { count: 'exact', head: true })
      .eq(readColumn, false)
      .neq('author_id', user.id);
    setDmCount(dmN ?? 0);

    if ((dmN ?? 0) > 0) {
      const { data: lastDm } = await supabase
        .from('dm_messages')
        .select('content,created_at,thread_id')
        .eq(readColumn, false)
        .neq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setDmPreview(lastDm ?? null);
    } else {
      setDmPreview(null);
    }
  }, [user?.id, role]);

  useEffect(() => { load(); }, [load]);
  useRealtime('dm_messages', load);

  useEffect(() => {
    function onDoc(e) {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const total = dmCount;
  const inboxPath = role === 'coach' ? '/coach/inbox' : '/inbox';

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={total > 0 ? `Notifications, ${total} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center text-mute hover:text-gold"
      >
        <Bell size={18} />
        {total > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-[16px] border border-bg bg-gold px-1 text-[0.55rem] leading-4 text-bg">
            {total > 99 ? '99+' : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[90vw] border border-line bg-bg shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="label">Notifications</div>
            {total === 0 ? <span className="text-xs text-faint">All clear</span> : null}
          </header>

          <ul className="divide-y divide-line">
            {dmCount > 0 ? (
              <li>
                <button
                  onClick={() => {
                    setOpen(false);
                    nav(inboxPath);
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-black/30"
                >
                  <MessageSquare size={16} className="mt-1 text-gold" />
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display tracking-wider2">
                        {dmCount} new message{dmCount === 1 ? '' : 's'}
                      </span>
                      {dmPreview ? (
                        <span className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                          {relative(dmPreview.created_at)}
                        </span>
                      ) : null}
                    </span>
                    {dmPreview ? (
                      <span className="mt-1 block truncate text-xs text-mute">{dmPreview.content}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ) : null}

            {total === 0 ? (
              <li className="flex items-center gap-3 px-4 py-6 text-sm text-mute">
                <Sparkles size={14} className="text-gold" />
                Nothing new.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
