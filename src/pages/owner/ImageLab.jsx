import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { images } from '../../lib/claudeClient';
import { Button } from '../../components/ui/Button';

// Owner-only fal.ai surface. Wraps the existing /generate-image function
// with a prompt + model picker. Cost is logged server-side via fal_usage.

const MODELS = [
  { id: 'flux-schnell', label: 'Flux schnell · fast, cheap' },
  { id: 'flux-dev',     label: 'Flux dev · balanced' },
  { id: 'flux-pro',     label: 'Flux pro · highest fidelity' },
];

const ASPECTS = ['1:1', '16:9', '9:16', '1080:1350'];

export default function ImageLab() {
  const { role } = useAuth();
  const nav = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [stylePrompt, setStylePrompt] = useState('');
  const [model, setModel] = useState('flux-schnell');
  const [aspect, setAspect] = useState('1:1');
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const [usage, setUsage] = useState(null);
  const [err, setErr] = useState(null);

  if (role !== 'owner') {
    return (
      <div className="mx-auto max-w-reading p-10">
        <h1 className="font-display text-3xl tracking-wider2 text-gold">Owner only</h1>
        <p className="mt-3 text-sm text-mute">
          Image Lab is gated by OWNER_EMAILS. Contact the operator if you need access.
        </p>
      </div>
    );
  }

  async function go(e) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await images.generate({
        prompt: prompt.trim(),
        model,
        aspect_ratio: aspect,
        num_images: count,
        style_prompt: stylePrompt.trim() || undefined,
      });
      setResults(res.images ?? []);
      setUsage(res.usage ?? null);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 pt-10 pb-6">
        <button
          type="button"
          onClick={() => nav('/owner')}
          className="flex items-center gap-2 text-mute transition-colors hover:text-gold"
        >
          <ArrowLeft size={16} />
          <span className="text-xs uppercase tracking-widest2">Owner</span>
        </button>
        <div className="text-right">
          <div className="label">Image Lab</div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24">
        <h1 className="font-display text-4xl tracking-wider2 text-gold sm:text-5xl">
          Generate
        </h1>
        <p className="mt-3 max-w-reading text-sm text-mute">
          fal.ai Flux. Cost is tracked per call in fal_usage. ATLAS brand style is the default —
          override style_prompt for a different look.
        </p>

        <form onSubmit={go} className="mt-8 space-y-4">
          <label className="flex flex-col gap-1">
            <span className="label">Prompt</span>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image. Composition, subject, mood."
              className="border border-line bg-black/40 px-3 py-2 text-sm text-ink focus:border-gold"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Style prompt (optional)</span>
            <textarea
              rows={2}
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              placeholder="Override the ATLAS default. Examples: photorealistic, editorial, cinematic."
              className="border border-line bg-black/40 px-3 py-2 text-sm text-ink focus:border-gold"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="label">Model</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="border border-line bg-black/40 px-3 py-2 text-sm text-ink focus:border-gold"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="label">Aspect</span>
              <select
                value={aspect}
                onChange={(e) => setAspect(e.target.value)}
                className="border border-line bg-black/40 px-3 py-2 text-sm text-ink focus:border-gold"
              >
                {ASPECTS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="label">Count</span>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="border border-line bg-black/40 px-3 py-2 text-sm text-ink focus:border-gold"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={busy || !prompt.trim()}>
              <Sparkles size={14} className="mr-2" /> {busy ? 'Generating' : 'Generate'}
            </Button>
            {usage ? (
              <span className="text-[0.65rem] uppercase tracking-widest2 text-faint">
                Last call: ${usage.cost_usd?.toFixed(4)} · {usage.model}
              </span>
            ) : null}
            {err ? (
              <span role="alert" className="text-xs uppercase tracking-widest2 text-signal">{err}</span>
            ) : null}
          </div>
        </form>

        {results.length > 0 ? (
          <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {results.map((img, i) => (
              <figure key={i} className="border border-line bg-black/30">
                <img src={img.url} alt={`Generated ${i + 1}`} className="w-full" />
                <figcaption className="flex items-center justify-between border-t border-line px-3 py-2 text-[0.6rem] uppercase tracking-widest2 text-faint">
                  <span>{img.width}×{img.height}</span>
                  <a
                    href={img.url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="flex items-center gap-1 text-gold hover:underline"
                  >
                    <Download size={12} /> Open
                  </a>
                </figcaption>
              </figure>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
