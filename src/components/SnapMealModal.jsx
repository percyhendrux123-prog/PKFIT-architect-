import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { gemini } from '../lib/claudeClient';
import { Button } from './ui/Button';

// Snap-a-meal: user picks (or shoots) a photo, Gemini estimates items +
// macros, user reviews + commits. The actual meals row insert happens in
// the parent on confirm — this component is presentational + Gemini glue.

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function SnapMealModal({ open, onClose, onConfirm }) {
  const fileRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [err, setErr] = useState(null);
  const [mealType, setMealType] = useState('meal');

  function reset() {
    setPreviewUrl(null);
    setEstimate(null);
    setErr(null);
    setBusy(false);
    setMealType('meal');
    if (fileRef.current) fileRef.current.value = '';
  }

  function close() {
    reset();
    onClose?.();
  }

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setEstimate(null);
    const dataUrl = await fileToBase64(file);
    setPreviewUrl(dataUrl);
    setBusy(true);
    try {
      const res = await gemini.mealPhoto({ image: dataUrl, mimeType: file.type || 'image/jpeg' });
      setEstimate(res);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  function commit() {
    if (!estimate?.items) return;
    onConfirm?.({
      meal_type: mealType,
      items: estimate.items.map((it) => ({ name: it.name, qty: `${it.grams}g` })),
      macros: estimate.total ?? {
        kcal: estimate.items.reduce((s, it) => s + (it.kcal || 0), 0),
        p: estimate.items.reduce((s, it) => s + (it.p || 0), 0),
        c: estimate.items.reduce((s, it) => s + (it.c || 0), 0),
        f: estimate.items.reduce((s, it) => s + (it.f || 0), 0),
      },
      source: 'gemini-photo',
    });
    close();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Snap a meal"
      onClick={close}
    >
      <div
        className="w-full max-w-md border-t border-line bg-bg p-5 sm:rounded-none sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="label">Snap a meal</div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="p-2 text-mute hover:text-gold"
          >
            <X size={18} />
          </button>
        </div>

        {!previewUrl ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 border border-dashed border-line bg-black/20 p-8 text-mute hover:border-gold hover:text-gold"
          >
            <Camera size={28} />
            <span className="text-xs uppercase tracking-widest2">Take a photo or pick one</span>
          </button>
        ) : (
          <img src={previewUrl} alt="Meal" className="mb-3 max-h-64 w-full object-cover" />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          onChange={onPick}
          className="hidden"
        />

        {busy ? (
          <div className="mt-3 text-xs uppercase tracking-widest2 text-faint">Estimating macros</div>
        ) : null}

        {err ? (
          <div className="mt-3 text-xs uppercase tracking-widest2 text-signal">{err}</div>
        ) : null}

        {estimate?.items ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <label htmlFor="meal-type" className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                Type
              </label>
              <select
                id="meal-type"
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="border border-line bg-black/40 px-2 py-1 text-xs uppercase tracking-widest2 text-ink focus:border-gold"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
                <option value="meal">Meal</option>
              </select>
            </div>
            <ul className="divide-y divide-line border border-line">
              {estimate.items.map((it, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-ink">{it.name}</span>
                  <span className="text-xs text-faint">
                    {it.grams}g · {it.kcal} kcal · P{it.p} C{it.c} F{it.f}
                  </span>
                </li>
              ))}
            </ul>
            {estimate.total ? (
              <div className="border border-line bg-black/30 px-3 py-2 text-xs text-mute">
                <span className="text-ink">Total</span> · {estimate.total.kcal} kcal · P
                {estimate.total.p} C{estimate.total.c} F{estimate.total.f}
                {typeof estimate.confidence === 'number' ? (
                  <span className="ml-2 text-faint">
                    confidence {Math.round(estimate.confidence * 100)}%
                  </span>
                ) : null}
              </div>
            ) : null}
            {estimate.notes ? (
              <div className="text-[0.65rem] uppercase tracking-widest2 text-faint">
                {estimate.notes}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button onClick={commit}>Log this meal</Button>
              <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                Re-shoot
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
