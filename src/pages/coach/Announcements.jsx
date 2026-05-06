import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Select, Textarea } from '../../components/ui/Input';

// block 0 2026-05-05: re-pointed from `community_posts` to `announcements`.
// New table is created in supabase/migrations/0031_announcements.sql and is
// applied as part of the Block 1 schema pass — until that lands, this form
// will return a 4xx at runtime. UI shape is preserved; only the destination
// shape and CTA wording have changed.

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All clients' },
  { value: 'active', label: 'Active subscribers only' },
  { value: 'trial', label: 'Trial' },
  { value: 'performance', label: 'Performance Standard' },
  { value: 'identity', label: 'Identity Architecture' },
  { value: 'full', label: 'Full Integration' },
  { value: 'premium', label: 'Premium' },
];

export default function Announcements() {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('all');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  async function publish(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const { error } = await supabase.from('announcements').insert({
        coach_id: user.id,
        body: content.trim(),
        audience: audience || 'all',
        published_at: new Date().toISOString(),
      });
      if (error) throw error;
      setContent('');
      setAudience('all');
      setMsg('Announcement published.');
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
        <h1 className="font-display text-4xl tracking-wider2">Publish to roster</h1>
        <p className="mt-2 max-w-reading text-sm text-mute">
          One idea. Tight body. No filler. Narrow the audience when the message does not apply to the whole roster.
        </p>
      </header>

      <form onSubmit={publish} className="space-y-4">
        <Textarea label="Announcement" rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
        <Select label="Audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
          {AUDIENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <Button disabled={busy || !content.trim()}>{busy ? 'Publishing' : 'Publish'}</Button>
      </form>

      {msg ? <div className="text-xs uppercase tracking-widest2 text-gold">{msg}</div> : null}
      {err ? <div className="text-xs uppercase tracking-widest2 text-signal">{err}</div> : null}
    </div>
  );
}
