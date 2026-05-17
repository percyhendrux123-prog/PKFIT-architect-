// AgentLog — owner audit view of every agentic tool invocation.
//
// Data source: public.agent_actions (RLS allows owners to read all rows).
// Inputs are pre-redacted by the server (redact.js); we render them as-is.
// Outputs are short summaries — never raw row contents.
//
// Filters: tool name, risk level, approval status, time window.
// Pagination: simple offset + page size.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const PAGE_SIZE = 50;

const RISK_COLOR = {
  LOW: 'text-mute',
  MEDIUM: 'text-gold',
  HIGH: 'text-signal',
  CRITICAL: 'text-signal font-display',
};

const APPROVAL_LABEL = {
  autonomous: 'auto',
  approved: 'approved',
  auto_batch: 'auto-batch',
  pending: 'pending',
  denied: 'denied',
  error: 'error',
};

export default function AgentLog() {
  const { role } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ tool: '', risk: '', status: '', days: 30 });
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const sinceIso = new Date(Date.now() - filters.days * 86400_000).toISOString();
        let q = supabase
          .from('agent_actions')
          .select('id, user_id, conversation_id, tool_name, risk_level, inputs_redacted, outputs_summary, approval_status, approver_user_id, created_at', { count: 'exact' })
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
        if (filters.tool) q = q.eq('tool_name', filters.tool);
        if (filters.risk) q = q.eq('risk_level', filters.risk);
        if (filters.status) q = q.eq('approval_status', filters.status);
        const { data, error, count } = await q;
        if (error) throw error;
        if (cancelled) return;
        setRows(data ?? []);
        setTotal(count ?? 0);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, filters]);

  const tools = useMemo(() => {
    const set = new Set();
    for (const r of rows) set.add(r.tool_name);
    return Array.from(set).sort();
  }, [rows]);

  if (role !== 'owner') {
    return (
      <div className="mx-auto max-w-reading p-10">
        <div className="label mb-2">Restricted</div>
        <h1 className="font-display text-3xl tracking-wider2 text-gold">Owner only</h1>
        <p className="mt-3 text-sm text-mute">
          Add your email to <code className="text-gold">OWNER_EMAILS</code> server-side to access this surface.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-10 pb-6">
        <button
          type="button"
          onClick={() => nav('/owner')}
          className="flex items-center gap-2 text-mute transition-colors hover:text-gold"
        >
          <ArrowLeft size={16} />
          <span className="text-xs uppercase tracking-widest2">Owner panel</span>
        </button>
        <div className="text-right">
          <div className="text-[0.6rem] uppercase tracking-widest2 text-faint">Agent activity</div>
          <div className="font-display text-lg tracking-wider2 text-gold">{total} action(s) in window</div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <div className="mb-2 label">Owner Panel</div>
        <h1 className="font-display text-4xl tracking-wider2 text-gold sm:text-5xl">Agent log</h1>
        <p className="mt-3 max-w-reading text-sm text-mute">
          Every tool invocation by the owner-agentic assistant. Credentials masked. Inputs pre-redacted.
          Outputs are short summaries — never row contents.
        </p>

        <section className="mt-6 flex flex-wrap items-center gap-3 border border-line bg-black/20 p-3">
          <Filter size={14} className="text-faint" />
          <label className="text-[0.65rem] uppercase tracking-widest2 text-faint">
            Window
            <select
              value={filters.days}
              onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, days: Number(e.target.value) })); }}
              className="ml-2 border border-line bg-black/40 px-2 py-1 text-xs text-ink focus:border-gold"
            >
              <option value={1}>24h</option>
              <option value={7}>7d</option>
              <option value={30}>30d</option>
              <option value={90}>90d</option>
            </select>
          </label>
          <label className="text-[0.65rem] uppercase tracking-widest2 text-faint">
            Tool
            <select
              value={filters.tool}
              onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, tool: e.target.value })); }}
              className="ml-2 border border-line bg-black/40 px-2 py-1 text-xs text-ink focus:border-gold"
            >
              <option value="">all</option>
              {tools.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-[0.65rem] uppercase tracking-widest2 text-faint">
            Risk
            <select
              value={filters.risk}
              onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, risk: e.target.value })); }}
              className="ml-2 border border-line bg-black/40 px-2 py-1 text-xs text-ink focus:border-gold"
            >
              <option value="">all</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </label>
          <label className="text-[0.65rem] uppercase tracking-widest2 text-faint">
            Status
            <select
              value={filters.status}
              onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, status: e.target.value })); }}
              className="ml-2 border border-line bg-black/40 px-2 py-1 text-xs text-ink focus:border-gold"
            >
              <option value="">all</option>
              <option value="autonomous">autonomous</option>
              <option value="approved">approved</option>
              <option value="auto_batch">auto_batch</option>
              <option value="pending">pending</option>
              <option value="error">error</option>
              <option value="denied">denied</option>
            </select>
          </label>
          {loading ? <span className="text-xs uppercase tracking-widest2 text-faint">Loading…</span> : null}
        </section>

        {err ? <div className="mt-4 text-xs uppercase tracking-widest2 text-signal">{err}</div> : null}

        <section className="mt-6">
          {rows.length === 0 ? (
            <div className="border border-line bg-black/10 p-6 text-sm text-faint">
              No agent actions in this window with the current filters.
            </div>
          ) : (
            <ul className="divide-y divide-line border border-line">
              {rows.map((r) => (
                <li key={r.id} className="grid grid-cols-[170px_160px_100px_120px_1fr] gap-3 p-3 text-sm">
                  <div className="label">{new Date(r.created_at).toLocaleString()}</div>
                  <div className="font-display tracking-wider2 text-ink">{r.tool_name}</div>
                  <div className={`text-xs uppercase tracking-widest2 ${RISK_COLOR[r.risk_level] ?? 'text-mute'}`}>{r.risk_level}</div>
                  <div className="text-[0.65rem] uppercase tracking-widest2 text-mute">{APPROVAL_LABEL[r.approval_status] ?? r.approval_status}</div>
                  <div>
                    <div className="text-xs text-mute">
                      {r.outputs_summary ? r.outputs_summary.slice(0, 220) : <span className="text-faint italic">no output recorded</span>}
                    </div>
                    {r.inputs_redacted ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[0.6rem] uppercase tracking-widest2 text-faint hover:text-gold">
                          inputs (redacted)
                        </summary>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words bg-black/40 p-2 text-[0.7rem] text-mute">
                          {JSON.stringify(r.inputs_redacted, null, 2).slice(0, 4000)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="border border-line bg-black/40 px-3 py-1 text-xs uppercase tracking-widest2 text-mute hover:text-ink disabled:opacity-40"
          >
            ← Prev
          </button>
          <div className="text-[0.65rem] uppercase tracking-widest2 text-faint">
            Page {page + 1} · {rows.length} of {total}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * PAGE_SIZE >= total}
            className="border border-line bg-black/40 px-3 py-1 text-xs uppercase tracking-widest2 text-mute hover:text-ink disabled:opacity-40"
          >
            Next →
          </button>
        </section>
      </main>
    </div>
  );
}
