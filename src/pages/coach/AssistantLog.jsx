// AssistantLog — cross-client bird's-eye view of all Operator Assistant
// activity. Three timelines: conversations, AI actions taken, crisis flags.
// Click any row to jump to that client's profile assistant tab.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

const PAGE_SIZE = 50;

export default function AssistantLog() {
  const [tab, setTab] = useState('conversations');
  const [conversations, setConversations] = useState([]);
  const [actions, setActions] = useState([]);
  const [crisisFlags, setCrisisFlags] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        // Pull conversations + their last user message for preview.
        const { data: convData, error: convErr } = await supabase
          .from('conversations')
          .select('id, client_id, title, created_at, updated_at')
          .gte('updated_at', sinceIso)
          .order('updated_at', { ascending: false })
          .limit(PAGE_SIZE);
        if (convErr) throw convErr;

        // Pull AI action log entries from client_notes.
        const { data: noteData, error: noteErr } = await supabase
          .from('client_notes')
          .select('id, client_id, type, title, body, created_at')
          .in('type', ['ai_action_log', 'ai_flag', 'ai_swap'])
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);
        if (noteErr) throw noteErr;

        // Crisis flags = action_log rows where body contains urgency=HIGH or
        // ai_flag entries (those are explicitly Percy-attention items).
        const crisis = (noteData ?? []).filter(
          (n) =>
            n.type === 'ai_flag' ||
            (n.body ?? '').toLowerCase().includes('urgency=high') ||
            (n.body ?? '').toLowerCase().includes('crisis'),
        );

        // Look up display names for all client_ids involved.
        const clientIds = new Set();
        (convData ?? []).forEach((c) => clientIds.add(c.client_id));
        (noteData ?? []).forEach((n) => clientIds.add(n.client_id));

        let profMap = {};
        if (clientIds.size > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, name, email')
            .in('id', Array.from(clientIds));
          for (const p of profs ?? []) {
            profMap[p.id] = p.name || p.email || p.id.slice(0, 8);
          }
        }

        if (cancelled) return;
        setConversations(convData ?? []);
        setActions(noteData ?? []);
        setCrisisFlags(crisis);
        setProfileMap(profMap);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const headerCounts = useMemo(
    () => ({
      conversations: conversations.length,
      actions: actions.length,
      crisis: crisisFlags.length,
    }),
    [conversations, actions, crisisFlags],
  );

  function clientLink(clientId, label) {
    const name = label ?? profileMap[clientId] ?? clientId.slice(0, 8);
    return (
      <Link
        to={`/coach/clients/${clientId}?tab=assistant`}
        className="font-display tracking-wider2 text-gold hover:underline"
      >
        {name}
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="label">Assistant log</div>
        <h1 className="font-display text-4xl tracking-wider2">Roster-wide AI activity</h1>
        <p className="max-w-reading text-sm text-mute">
          Every conversation, action, and crisis flag from the Operator Assistant across your full client roster. Read the
          rooms you're not in.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[0.65rem] uppercase tracking-widest2 text-faint" htmlFor="window">
          Time window
        </label>
        <select
          id="window"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="border border-line bg-black/40 px-3 py-1 text-sm text-ink focus:border-gold"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        {loading ? (
          <span className="text-xs uppercase tracking-widest2 text-faint">Loading…</span>
        ) : null}
      </div>

      <nav className="flex gap-2 border-b border-line">
        {[
          { key: 'conversations', label: `Conversations (${headerCounts.conversations})` },
          { key: 'actions', label: `Actions (${headerCounts.actions})` },
          { key: 'crisis', label: `Crisis (${headerCounts.crisis})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs uppercase tracking-widest2 ${
              tab === t.key ? 'border-b-2 border-gold text-gold' : 'text-mute hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {err ? <div className="text-xs uppercase tracking-widest2 text-signal">{err}</div> : null}

      {tab === 'conversations' ? (
        <section>
          {conversations.length === 0 ? (
            <div className="text-sm text-faint">No conversations in this window.</div>
          ) : (
            <ul className="divide-y divide-line border border-line">
              {conversations.map((c) => (
                <li key={c.id} className="grid grid-cols-[160px_180px_1fr] gap-3 p-3 text-sm">
                  <div className="label">{new Date(c.updated_at).toLocaleString()}</div>
                  <div>{clientLink(c.client_id)}</div>
                  <div className="truncate text-mute">{c.title || 'Untitled conversation'}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : tab === 'actions' ? (
        <section>
          {actions.length === 0 ? (
            <div className="text-sm text-faint">No actions in this window.</div>
          ) : (
            <ul className="divide-y divide-line border border-line">
              {actions.map((n) => (
                <li key={n.id} className="grid grid-cols-[160px_180px_1fr] gap-3 p-3 text-sm">
                  <div className="label">{new Date(n.created_at).toLocaleString()}</div>
                  <div>{clientLink(n.client_id)}</div>
                  <div>
                    <div className="font-display tracking-wider2 text-ink">{n.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-mute">
                      {(n.body ?? '').slice(0, 240)}
                      {(n.body ?? '').length > 240 ? '…' : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section>
          {crisisFlags.length === 0 ? (
            <div className="text-sm text-faint">
              No crisis flags in this window. Quiet stretch — good or worth checking in personally.
            </div>
          ) : (
            <ul className="divide-y divide-line border border-signal">
              {crisisFlags.map((n) => (
                <li
                  key={n.id}
                  className="grid grid-cols-[160px_180px_1fr] gap-3 bg-signal/10 p-3 text-sm"
                >
                  <div className="label text-signal">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                  <div>{clientLink(n.client_id)}</div>
                  <div>
                    <div className="font-display tracking-wider2 text-signal">{n.title}</div>
                    <div className="mt-1 whitespace-pre-wrap text-xs text-ink">
                      {n.body ?? ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
