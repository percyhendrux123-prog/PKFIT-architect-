import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Input';

export default function Announcements() {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  async function post(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const { error } = await supabase.from('community_posts').insert({
        author_id: user.id,
        content: content.trim(),
        is_pinned: true,
        tag: 'announcement',
      });
      if (error) throw error;
      setContent('');
      setMsg('Announcement pinned to the feed.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="label mb-2">Announcements</div>
        <h1 className="font-display text-4xl tracking-wider2">Pin to feed</h1>
        <p className="mt-2 max-w-reading text-sm text-mute">
          Post as a pinned note. Keep it tight. One idea. No filler.
        </p>
      </header>

      <form onSubmit={post} className="space-y-4">
        <Textarea label="Announcement" rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
        <Button disabled={busy || !content.trim()}>{busy ? 'Pinning' : 'Pin to feed'}</Button>
      </form>

      {msg ? <div className="text-xs uppercase tracking-widest2 text-gold">{msg}</div> : null}
      {err ? <div className="text-xs uppercase tracking-widest2 text-red-300">{err}</div> : null}
    </div>
  );
}
