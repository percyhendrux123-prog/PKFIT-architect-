import { useEffect, useState, useCallback } from 'react';
import { Pin, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { useRealtime } from '../../hooks/useRealtime';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';

function PostItem({ post, me, isCoach, onReact, onPin, onDelete }) {
  const [draft, setDraft] = useState('');
  const [comments, setComments] = useState([]);
  const [open, setOpen] = useState(false);

  const loadComments = useCallback(async () => {
    if (!open) return;
    const { data } = await supabase
      .from('community_comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    setComments(data ?? []);
  }, [open, post.id]);

  useEffect(() => { loadComments(); }, [loadComments]);

  useRealtime('community_comments', loadComments, `post_id=eq.${post.id}`);

  return (
    <article className={`border p-4 ${post.is_pinned ? 'border-gold' : 'border-line'} bg-black/30`}>
      <header className="flex items-center gap-3">
        <Avatar name={post.author?.name ?? 'Member'} size={32} />
        <div className="flex-1">
          <div className="font-display tracking-wider2">{post.author?.name ?? 'Member'}</div>
          <div className="text-xs text-faint">{new Date(post.created_at).toLocaleString()}</div>
        </div>
        <div className="flex items-center gap-2">
          {post.target_plan ? (
            <span className="text-[0.6rem] uppercase tracking-widest2 text-mute">
              → {post.target_plan}
            </span>
          ) : null}
          {post.is_pinned ? (
            <span className="flex items-center gap-1 text-xs uppercase tracking-widest2 text-gold">
              <Pin size={12} /> Pinned
            </span>
          ) : null}
        </div>
      </header>

      <p className="mt-3 whitespace-pre-wrap text-sm text-ink/90">{post.content}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs uppercase tracking-widest2 text-faint">
        <button onClick={() => onReact(post)} className="hover:text-gold">
          Ack · {post.reactions_count ?? 0}
        </button>
        <button onClick={() => setOpen((o) => !o)} className="hover:text-gold">
          Comment
        </button>
        {isCoach ? (
          <button onClick={() => onPin(post)} className="hover:text-gold">
            {post.is_pinned ? 'Unpin' : 'Pin'}
          </button>
        ) : null}
        {post.author_id === me?.id || isCoach ? (
          <button onClick={() => onDelete(post)} className="ml-auto flex items-center gap-1 hover:text-red-300">
            <Trash2 size={12} /> Delete
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-4 border-t border-line pt-4">
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="text-sm">
                <div className="label">{c.author_id === me?.id ? 'You' : 'Member'} · {new Date(c.created_at).toLocaleTimeString()}</div>
                <div className="text-ink/90">{c.content}</div>
              </li>
            ))}
          </ul>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              const { data } = await supabase
                .from('community_comments')
                .insert({ post_id: post.id, author_id: me.id, content: draft.trim() })
                .select()
                .maybeSingle();
              if (data) setComments((xs) => [...xs, data]);
              setDraft('');
            }}
            className="mt-3 flex gap-2"
          >
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Reply" />
            <div className="self-end"><Button type="submit" disabled={!draft.trim()}>Reply</Button></div>
          </form>
        </div>
      ) : null}
    </article>
  );
}

export default function Community() {
  const { user, profile, role, refreshProfile } = useAuth();
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  // Mark the feed as seen each time it's mounted so unread counts stay accurate.
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    supabase
      .from('profiles')
      .update({ community_last_seen_at: new Date().toISOString() })
      .eq('id', user.id)
      .then(() => refreshProfile?.());
  }, [user?.id]);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data: rows } = await supabase
      .from('community_posts')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    const authorIds = [...new Set((rows ?? []).map((p) => p.author_id))];
    const { data: authors } = authorIds.length
      ? await supabase.from('profiles').select('id,name').in('id', authorIds)
      : { data: [] };
    const byId = Object.fromEntries((authors ?? []).map((a) => [a.id, a]));

    const enriched = await Promise.all(
      (rows ?? []).map(async (p) => {
        const { count } = await supabase
          .from('community_reactions')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', p.id);
        return { ...p, author: byId[p.author_id], reactions_count: count ?? 0 };
      }),
    );
    setPosts(enriched);
  }, []);

  useEffect(() => { load(); }, [load]);

  useRealtime('community_posts', () => load());
  useRealtime('community_reactions', () => load());

  async function createPost(e) {
    e.preventDefault();
    if (!content.trim() || !user) return;
    setBusy(true);
    await supabase.from('community_posts').insert({
      author_id: user.id,
      content: content.trim(),
      is_pinned: false,
    });
    setContent('');
    setBusy(false);
    await load();
  }

  async function react(post) {
    if (!user) return;
    await supabase
      .from('community_reactions')
      .upsert({ post_id: post.id, user_id: user.id, type: 'ack' }, { onConflict: 'post_id,user_id,type' });
    await load();
  }

  async function pin(post) {
    if (role !== 'coach') return;
    await supabase.from('community_posts').update({ is_pinned: !post.is_pinned }).eq('id', post.id);
    await load();
  }

  async function remove(post) {
    if (!user) return;
    if (post.author_id !== user.id && role !== 'coach') return;
    const ok = window.confirm('Delete this post. Comments will also be removed.');
    if (!ok) return;
    await supabase.from('community_posts').delete().eq('id', post.id);
    await load();
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="label mb-2">Community</div>
        <h1 className="font-display text-4xl tracking-wider2">The Feed</h1>
        <p className="mt-2 max-w-reading text-sm text-mute">
          Chronological. No algorithm. Post clean. Keep it signal.
        </p>
      </header>

      <form onSubmit={createPost} className="space-y-3">
        <Textarea label="Post" rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="What moved today" />
        <Button disabled={busy || !content.trim()}>{busy ? 'Posting' : 'Post'}</Button>
      </form>

      <div className="space-y-3">
        {posts.length === 0 ? (
          <div className="border border-line bg-black/20 p-6 text-sm text-mute">No posts yet.</div>
        ) : (
          posts.map((p) => (
            <PostItem
              key={p.id}
              post={p}
              me={{ id: user?.id, name: profile?.name }}
              isCoach={role === 'coach'}
              onReact={react}
              onPin={pin}
              onDelete={remove}
            />
          ))
        )}
      </div>
    </div>
  );
}
