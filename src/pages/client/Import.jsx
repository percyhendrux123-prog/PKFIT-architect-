import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { apify } from '../../lib/claudeClient';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function Import() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState(null);
  const [imported, setImported] = useState(null);

  async function go(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setImported(null);
    setStatus('Starting import…');
    try {
      const res = await apify.importTrainerize(url.trim());
      if (res?.program) {
        setImported(res.program);
        setStatus('Imported. Review it under Workouts.');
      } else if (res?.runId) {
        setStatus(`Import is still running (${res.status}). Run id: ${res.runId}. Try again in a minute.`);
      } else {
        setStatus('Done.');
      }
    } catch (e) {
      setErr(e.message);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="label mb-2">Import</div>
        <h1 className="font-display text-4xl tracking-wider2 text-gold">Trainerize program</h1>
        <p className="mt-2 max-w-reading text-sm text-mute">
          Paste the URL of your Trainerize program. The system runs an Apify scraper, pulls the
          schedule and exercises, and lands the result as a draft under Workouts. You can publish it
          from there.
        </p>
      </header>

      <form onSubmit={go} className="space-y-4">
        <Input
          label="Trainerize program URL"
          type="url"
          required
          placeholder="https://www.trainerize.com/profile/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={busy || !url.trim()}>
            <Upload size={14} className="mr-2" /> {busy ? 'Importing' : 'Import program'}
          </Button>
          {status ? (
            <span className="text-xs uppercase tracking-widest2 text-mute">{status}</span>
          ) : null}
          {err ? (
            <span role="alert" className="text-xs uppercase tracking-widest2 text-signal">{err}</span>
          ) : null}
        </div>
      </form>

      {imported ? (
        <div className="border border-line bg-black/30 p-5">
          <div className="label mb-2">Imported draft</div>
          <div className="font-display text-xl tracking-wider2">
            {imported.schedule?.title ?? `Program W${imported.week_number ?? 1}`}
          </div>
          <div className="mt-1 text-xs uppercase tracking-widest2 text-faint">
            {(imported.exercises ?? []).length} exercise{(imported.exercises ?? []).length === 1 ? '' : 's'}
          </div>
          <div className="mt-3 flex gap-2">
            <Button as={Link} to="/workouts" variant="ghost">Open Workouts</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
