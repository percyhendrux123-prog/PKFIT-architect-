import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { claude, coach as coachApi } from '../../lib/claudeClient';
import { useAuth } from '../../context/AuthContext';
import { Download, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { DMThread } from '../../components/DMThread';
import { StorageImage } from '../../components/StorageImage';
import { HabitHeatmap } from '../../components/HabitHeatmap';
import { GenerateProgramForm, GenerateMealForm } from '../../components/GenerateProgramForm';
import { Textarea } from '../../components/ui/Input';
import { deriveLoopStage, loopStageMeta } from '../../lib/loop';
import { downloadCSV } from '../../lib/csv';

function ReviewPanel({ review, onUpdated }) {
  const [comment, setComment] = useState(review.coach_comment ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase
        .from('reviews')
        .update({
          coach_comment: comment.trim() || null,
          coach_commented_at: comment.trim() ? new Date().toISOString() : null,
        })
        .eq('id', review.id);
      if (error) throw error;
      await onUpdated?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border border-gold bg-black/30 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="label">Latest review</div>
          <h2 className="mt-1 font-display text-2xl tracking-wider2">Week of {review.week_starting}</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-[0.6rem] uppercase tracking-widest2 text-faint">
          {review.metrics?.adherence_pct != null ? (
            <span>{review.metrics.adherence_pct}% adherence</span>
          ) : null}
          {review.metrics?.weight_delta_kg != null ? (
            <span>
              {review.metrics.weight_delta_kg > 0 ? '+' : ''}
              {review.metrics.weight_delta_kg} kg
            </span>
          ) : null}
          {review.metrics?.sessions_completed != null ? (
            <span>{review.metrics.sessions_completed} sessions</span>
          ) : null}
        </div>
      </div>
      <p className="mt-3 max-w-reading text-sm text-ink/90">{review.summary}</p>
      {review.adjustments?.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {review.adjustments.map((a, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-gold">→</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 border-t border-line pt-4">
        <Textarea
          label="Coach note to client"
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="One idea. Tight. Signal only."
        />
        {err ? <div className="mt-2 text-xs uppercase tracking-widest2 text-red-300">{err}</div> : null}
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={save} disabled={saving}>{saving ? 'Saving' : 'Save note'}</Button>
          {review.coach_commented_at ? (
            <span className="text-[0.6rem] uppercase tracking-widest2 text-faint">
              Last saved {new Date(review.coach_commented_at).toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  const { user, role } = useAuth();

  const [client, setClient] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [habits, setHabits] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [openForm, setOpenForm] = useState(null); // 'program' | 'meal' | null

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !id) return;
    const [
      { data: p },
      { data: pr },
      { data: ci },
      { data: ws },
      { data: hb },
      { data: rv },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('programs').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('check_ins').select('*').eq('client_id', id).order('date', { ascending: false }).limit(12),
      supabase.from('workout_sessions').select('*').eq('client_id', id).order('performed_at', { ascending: false }).limit(10),
      supabase
        .from('habits')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('reviews')
        .select('*')
        .eq('client_id', id)
        .order('week_starting', { ascending: false })
        .limit(4),
    ]);
    setClient(p);
    setPrograms(pr ?? []);
    setCheckIns(ci ?? []);
    setSessions(ws ?? []);
    setHabits(hb ?? null);
    setReviews(rv ?? []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function onProgramDone() {
    setOpenForm(null);
    setMsg('Program generated.');
    await load();
  }

  async function onMealDone() {
    setOpenForm(null);
    setMsg('Meal plan generated.');
    await load();
  }

  async function runReview() {
    setBusy('review');
    setMsg(null);
    try {
      await claude.weeklyReview({ clientId: id });
      setMsg('Weekly review generated.');
      await load();
    } catch (e) { setMsg(e.message); }
    setBusy(null);
  }

  async function exportClient() {
    setBusy('export');
    setMsg(null);
    try {
      const dump = await coachApi.exportClient(id);
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = (client?.name ?? id).toString().replace(/\s+/g, '-').toLowerCase();
      a.download = `pkfit-client-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setMsg(e.message); }
    setBusy(null);
  }

  if (!client) return <div className="text-xs uppercase tracking-widest2 text-faint">Loading</div>;

  const habitList = habits?.habit_list ?? [];
  const habitHistory = habits?.check_history ?? {};
  const latestReview = reviews[0] ?? null;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="label mb-2">Client</div>
          <h1 className="font-display text-4xl tracking-wider2">{client.name ?? client.email}</h1>
          <p className="mt-1 text-sm text-mute">
            {client.plan ?? 'trial'} · loop: {loopStageMeta(deriveLoopStage(client)).label}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportClient}
            disabled={busy === 'export'}
            className="flex items-center gap-1 text-xs uppercase tracking-widest2 text-mute hover:text-gold disabled:opacity-40"
          >
            <Download size={12} /> {busy === 'export' ? 'Exporting' : 'Export JSON'}
          </button>
          <Link to="/coach/clients" className="text-xs uppercase tracking-widest2 text-gold">← Roster</Link>
        </div>
      </header>

      <nav className="flex gap-2 border-b border-line">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'messages', label: 'Messages' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setParams({ tab: t.key })}
            className={`px-4 py-2 text-xs uppercase tracking-widest2 ${
              tab === t.key ? 'border-b-2 border-gold text-gold' : 'text-mute hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' ? (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setOpenForm(openForm === 'program' ? null : 'program')}>
                {openForm === 'program' ? 'Close program form' : 'Generate program'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setOpenForm(openForm === 'meal' ? null : 'meal')}
              >
                {openForm === 'meal' ? 'Close meal form' : 'Generate meal plan'}
              </Button>
              <Button onClick={runReview} variant="ghost" disabled={busy === 'review'}>
                <Sparkles size={14} /> {busy === 'review' ? 'Reviewing' : 'Generate weekly review'}
              </Button>
            </div>
            {openForm === 'program' ? (
              <div className="border border-line bg-black/30 p-4">
                <GenerateProgramForm
                  clientId={id}
                  profile={client}
                  onDone={onProgramDone}
                  onCancel={() => setOpenForm(null)}
                />
              </div>
            ) : null}
            {openForm === 'meal' ? (
              <div className="border border-line bg-black/30 p-4">
                <GenerateMealForm
                  clientId={id}
                  profile={client}
                  onDone={onMealDone}
                  onCancel={() => setOpenForm(null)}
                />
              </div>
            ) : null}
          </section>
          {msg ? <div className="text-xs uppercase tracking-widest2 text-gold">{msg}</div> : null}

          {latestReview ? (
            <ReviewPanel review={latestReview} onUpdated={load} />
          ) : null}

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader label="Programs" title={`Recent (${programs.length})`} />
              <ul className="divide-y divide-line">
                {programs.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <span>Week {p.week_number} · {p.status}</span>
                    <span className="text-faint">{new Date(p.created_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader label="Sessions" title={`Logged (${sessions.length})`} />
              {sessions.length === 0 ? (
                <div className="text-sm text-mute">No sessions logged.</div>
              ) : (
                <ul className="divide-y divide-line">
                  {sessions.map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/coach/clients/${id}/sessions/${s.id}`}
                        className="flex items-center justify-between py-2 text-sm hover:bg-black/30"
                      >
                        <span>{new Date(s.performed_at).toLocaleDateString()}</span>
                        <span className="text-faint">
                          {s.duration_min ? `${s.duration_min}m` : ''}
                          {s.rpe_avg != null ? ` · RPE ${s.rpe_avg}` : ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader
                label="Check-ins"
                title={`Recent (${checkIns.length})`}
                meta={
                  checkIns.length > 0 ? (
                    <button
                      onClick={() =>
                        downloadCSV(
                          `pkfit-checkins-${client.name?.replace(/\s+/g, '-').toLowerCase() ?? client.id.slice(0, 8)}.csv`,
                          checkIns,
                          [
                            { key: 'date', label: 'Date' },
                            { key: 'weight', label: 'Weight (kg)' },
                            { key: 'body_fat', label: 'Body fat %' },
                            { key: 'notes', label: 'Notes' },
                          ],
                        )
                      }
                      className="flex items-center gap-1 text-xs uppercase tracking-widest2 text-gold"
                    >
                      <Download size={12} /> CSV
                    </button>
                  ) : null
                }
              />
              <ul className="divide-y divide-line">
                {checkIns.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
                    {c.photo_path ? (
                      <StorageImage path={c.photo_path} alt="Check-in" className="h-12 w-12 shrink-0 object-cover" />
                    ) : null}
                    <span className="flex-1">{c.date?.slice(0, 10)}</span>
                    <span className="text-faint">{c.weight ?? '—'} kg · {c.body_fat ?? '—'}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          {(() => {
            const latestCheckInWithPhoto = checkIns.find((c) => c.photo_path);
            if (!client.baseline_photo_path && !latestCheckInWithPhoto) return null;
            return (
              <section className="border border-line bg-black/30 p-5">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <div className="label">Comparison</div>
                    <h2 className="mt-1 font-display text-2xl tracking-wider2">Baseline vs latest</h2>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <div className="label mb-2">Baseline</div>
                    {client.baseline_photo_path ? (
                      <StorageImage
                        path={client.baseline_photo_path}
                        alt="Baseline"
                        className="max-h-80 w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-48 w-full items-center justify-center border border-dashed border-line bg-black/20 text-xs text-faint">
                        No baseline photo
                      </div>
                    )}
                    {client.start_date ? (
                      <div className="mt-2 text-[0.6rem] uppercase tracking-widest2 text-faint">
                        {new Date(client.start_date).toLocaleDateString()}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <div className="label mb-2">Latest check-in</div>
                    {latestCheckInWithPhoto ? (
                      <>
                        <StorageImage
                          path={latestCheckInWithPhoto.photo_path}
                          alt="Latest check-in"
                          className="max-h-80 w-full object-contain"
                        />
                        <div className="mt-2 text-[0.6rem] uppercase tracking-widest2 text-faint">
                          {latestCheckInWithPhoto.date?.slice(0, 10)}
                          {latestCheckInWithPhoto.weight != null
                            ? ` · ${latestCheckInWithPhoto.weight} kg`
                            : ''}
                        </div>
                      </>
                    ) : (
                      <div className="flex h-48 w-full items-center justify-center border border-dashed border-line bg-black/20 text-xs text-faint">
                        No photo yet
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })()}

          {habitList.length > 0 ? (
            <section className="border border-line bg-black/30 p-5">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <div className="label">Habits</div>
                  <h2 className="mt-1 font-display text-2xl tracking-wider2">Daily stack</h2>
                </div>
                <span className="text-xs text-faint">{habitList.length} habit{habitList.length === 1 ? '' : 's'}</span>
              </div>
              <ul className="mb-5 flex flex-wrap gap-2 text-xs">
                {habitList.map((h) => (
                  <li key={h.id} className="border border-line px-2 py-1 text-mute">
                    {h.name}
                  </li>
                ))}
              </ul>
              <HabitHeatmap list={habitList} history={habitHistory} />
            </section>
          ) : null}

          {reviews.length > 1 ? (
            <section>
              <div className="label mb-2">Prior reviews</div>
              <ul className="divide-y divide-line border border-line">
                {reviews.slice(1).map((r) => (
                  <li key={r.id} className="grid grid-cols-[140px_1fr_auto] gap-3 p-3 text-sm">
                    <div className="label">Week {r.week_starting}</div>
                    <div className="truncate text-mute">{r.summary}</div>
                    <div className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                      {r.metrics?.adherence_pct != null ? `${r.metrics.adherence_pct}%` : '—'}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <DMThread clientId={id} viewer={{ id: user?.id }} role={role} />
      )}
    </div>
  );
}
