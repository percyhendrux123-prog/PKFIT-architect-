import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Spinner } from '../components/ui/Empty';
import { heightLabel, parseHeightToCm, parseWeightToKg, weightLabel } from '../lib/units';

const steps = ['Identity', 'Baseline', 'Goal', 'Baseline photo', 'Commit'];

const FORM_STORAGE_KEY = 'pkfit:onboarding:draft';

const initialForm = {
  name: '',
  age: '',
  sex: 'male',
  height: '',
  weight: '',
  goal: 'recomp',
  training_days: '4',
  sleep_avg: '7',
  constraint: '',
};

function detectDefaultUnits() {
  if (typeof navigator === 'undefined') return 'imperial';
  const locale = navigator.language || navigator.languages?.[0] || 'en-US';
  return locale.toLowerCase().startsWith('en-us') ? 'imperial' : 'metric';
}

function loadDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FORM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function Onboarding() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const draft = useMemo(loadDraft, []);
  const [step, setStep] = useState(0);
  const [units, setUnits] = useState(() => draft?.units ?? detectDefaultUnits());
  const [form, setForm] = useState(() => ({ ...initialForm, ...(draft?.form ?? {}) }));
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoPath, setPhotoPath] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (profile?.units && profile.units !== units) setUnits(profile.units);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.units]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify({ form, units }));
    } catch {
      /* swallow quota errors */
    }
  }, [form, units]);

  if (authLoading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-5">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signup" replace state={{ from: '/onboarding' }} />;
  }

  const set = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  function canAdvance() {
    if (step === 0) {
      const ageNum = Number(form.age);
      return form.name.trim().length > 0 && Number.isFinite(ageNum) && ageNum >= 13 && ageNum <= 100;
    }
    if (step === 1) {
      const w = Number(form.weight);
      const h = Number(form.height);
      const s = Number(form.sleep_avg);
      return Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0 && Number.isFinite(s) && s > 0;
    }
    return true;
  }

  function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('File must be an image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErr('Image must be 10 MB or less.');
      return;
    }
    setErr(null);
    setPhotoFile(file);
    setPhotoPath(null);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoPath(null);
  }

  async function uploadPhoto() {
    if (!photoFile || !user) return;
    setUploading(true);
    setErr(null);
    try {
      const ext = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/baseline-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('baseline-photos')
        .upload(path, photoFile, { upsert: false, contentType: photoFile.type });
      if (error) throw error;
      setPhotoPath(path);
    } catch (e) {
      setErr(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function finish() {
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: form.name,
          units,
          height_cm: parseHeightToCm(form.height, units),
          weight_kg: parseWeightToKg(form.weight, units),
          start_date: new Date().toISOString().slice(0, 10),
          loop_stage: 'diagnosis',
          plan: 'trial',
          baseline_photo_path: photoPath,
        })
        .eq('id', user.id);
      if (error) throw error;
      try {
        window.localStorage.removeItem(FORM_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      // If signup captured consent versions in user_metadata, persist them
      // to profiles.consent now that we have an authenticated session.
      const consentMeta = user?.user_metadata?.consent;
      if (consentMeta) {
        try {
          const { profileApi } = await import('../lib/claudeClient');
          await profileApi.update({ consent: consentMeta });
        } catch {
          // Non-fatal: user can re-accept under Settings if this fails.
        }
      }
      await refreshProfile?.();
      navigate('/home', { replace: true });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <div className="label mb-3">Onboarding · Step {step + 1} of {steps.length}</div>
      <h1 className="font-display text-4xl tracking-wider2 text-gold">{steps[step]}</h1>
      <div
        aria-hidden="true"
        className="mt-4 flex h-[2px] overflow-hidden border border-line bg-black/40"
      >
        <div
          className="h-full bg-gold transition-[width] duration-300 ease-out"
          style={{ width: `${((step + 1) / steps.length) * 100}%` }}
        />
      </div>

      <div className="mt-10 space-y-4">
        {step === 0 && (
          <>
            <Input label="Name" required autoComplete="name" value={form.name} onChange={set('name')} />
            <Input label="Age" type="number" required min="13" max="100" inputMode="numeric" value={form.age} onChange={set('age')} />
            <Select label="Sex" value={form.sex} onChange={set('sex')}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
            <Select label="Units" value={units} onChange={(e) => setUnits(e.target.value)}>
              <option value="imperial">Imperial (lbs, ft/in)</option>
              <option value="metric">Metric (kg, cm)</option>
            </Select>
          </>
        )}
        {step === 1 && (
          <>
            <Input label={heightLabel(units)} type="number" required min="1" step="0.1" inputMode="decimal" value={form.height} onChange={set('height')} />
            <Input label={weightLabel(units)} type="number" required min="1" max="800" step="0.1" inputMode="decimal" value={form.weight} onChange={set('weight')} />
            <Input label="Average sleep (hours)" type="number" required min="1" max="14" step="0.5" inputMode="decimal" value={form.sleep_avg} onChange={set('sleep_avg')} />
          </>
        )}
        {step === 2 && (
          <>
            <Select label="Primary goal" value={form.goal} onChange={set('goal')}>
              <option value="recomp">Body recomposition</option>
              <option value="lean">Lean out</option>
              <option value="build">Build muscle</option>
              <option value="maintain">Maintain</option>
            </Select>
            <Select label="Training days per week" value={form.training_days} onChange={set('training_days')}>
              {[3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
          </>
        )}
        {step === 3 && (
          <>
            <p className="max-w-reading text-sm text-mute">
              Optional. One photo, well-lit, relaxed stance. Used only for the Diagnosis review. Private to you and the coach.
            </p>
            <label className="flex cursor-pointer items-center justify-center gap-3 border border-dashed border-line bg-black/30 p-6 text-sm text-mute hover:border-gold focus-within:border-gold">
              <Upload size={18} aria-hidden="true" />
              <span>{photoFile ? 'Change photo' : 'Choose photo'}</span>
              <input type="file" accept="image/*" onChange={pickPhoto} className="sr-only" />
            </label>
            {photoPreview ? (
              <div className="space-y-3">
                <img src={photoPreview} alt="Baseline preview" className="max-h-80 w-full border border-line object-contain" />
                <div className="flex flex-wrap gap-3">
                  {!photoPath ? (
                    <Button onClick={uploadPhoto} disabled={uploading}>
                      {uploading ? 'Uploading' : 'Upload photo'}
                    </Button>
                  ) : (
                    <div className="text-xs uppercase tracking-widest2 text-success">Uploaded.</div>
                  )}
                  <Button variant="ghost" type="button" onClick={clearPhoto} disabled={uploading}>
                    Remove
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
        {step === 4 && (
          <>
            <Input label="The one constraint in your way" value={form.constraint} onChange={set('constraint')} />
            <div className="border border-line p-4 text-sm text-mute">
              You are entering a thirty-day protocol. Daily reps. Weekly review. No drift.
            </div>
          </>
        )}
        {err ? <div role="alert" className="text-xs uppercase tracking-widest2 text-signal">{err}</div> : null}
      </div>

      <div className="mt-8 flex justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canAdvance()}>Next</Button>
        ) : (
          <Button disabled={busy} onClick={finish}>{busy ? 'Saving' : 'Enter'}</Button>
        )}
      </div>
    </div>
  );
}
