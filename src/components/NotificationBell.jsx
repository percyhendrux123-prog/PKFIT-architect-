import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, Sparkles, Users } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useRealtime } from '../hooks/useRealtime';

function relative(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function NotificationBell({ user, role, profile }) {
  const [open, setOpen] = useState(false);
  const [dmCount, setDmCount] = useState(0);
  const [dmPreview, setDmPreview] = useState(null);
  const [communityCount, setCommunityCount] = useState(0);
  const [communityPreview, setCommunityPreview] = useState(null);
  const wrapperRef = useRef(null);
  const nav = useNavigate();

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;

    // DMs
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

    // Community (clients only)
    if (role !== 'coach') {
      let q = supabase
        .from('community_posts')
        .select('*', { count: 'exact', head: true })
        .neq('author_id', user.id);
      if (profile?.community_last_seen_at) q = q.gt('created_at', profile.community_last_seen_at);
      const { count: cN } = await q;
      setCommunityCount(cN ?? 0);

      if ((cN ?? 0) > 0) {
        let q2 = supabase
          .from('community_posts')
          .select('id,content,created_at,is_pinned')
          .neq('author_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (profile?.community_last_seen_at) q2 = q2.gt('created_at', profile.community_last_seen_at);
        const { data: latest } = await q2;
        setCommunityPreview(latest?.[0] ?? null);
      } else {
        setCommunityPreview(null);
      }
    } else {
      setCommunityCount(0);
      setCommunityPreview(null);
    }
  }, [user?.id, role, profile?.community_last_seen_at]);

  useEffect(() => { load(); }, [load]);
  useRealtime('dm_messages', load);
  useRealtime('community_posts', load);

  useEffect(() => {
    function onDoc(e) {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const total = dmCount + communityCount;
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

            {communityCount > 0 ? (
              <li>
                <button
                  onClick={() => {
                    setOpen(false);
                    nav('/community');
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-black/30"
                >
                  <Users size={16} className="mt-1 text-gold" />
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display tracking-wider2">
                        {communityCount} new post{communityCount === 1 ? '' : 's'}
                      </span>
                      {communityPreview ? (
                        <span className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                          {relative(communityPreview.created_at)}
                        </span>
                      ) : null}
                    </span>
                    {communityPreview ? (
                      <span className="mt-1 block truncate text-xs text-mute">
                        {communityPreview.is_pinned ? 'Pinned · ' : ''}
                        {communityPreview.content}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ) : null}

            {total === 0 ? (
              <li className="flex items-center gap-3 px-4 py-6 text-sm text-mute">
                <Sparkles size={14} className="text-gold" />
                Nothing new. Go do the work.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
