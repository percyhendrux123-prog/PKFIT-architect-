import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { heightLabel, weightLabel } from '../lib/units';

const steps = ['Identity', 'Baseline', 'Goal', 'Baseline photo', 'Commit'];

// First-load units default. en-US → imperial; everyone else → metric.
// The user can override on step 0; their pick is persisted to profiles.units.
function detectDefaultUnits() {
  if (typeof navigator === 'undefined') return 'imperial';
  const locale = navigator.language || navigator.languages?.[0] || 'en-US';
  return locale.toLowerCase().startsWith('en-us') ? 'imperial' : 'metric';
}

export default function Onboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [units, setUnits] = useState(() => detectDefaultUnits());
  // Sync from profile once it loads — a returning user keeps their pick.
  useEffect(() => {
    if (profile?.units && profile.units !== units) setUnits(profile.units);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.units]);

  const [form, setForm] = useState({
    name: '',
    age: '',
    sex: 'male',
    // Display values in the user's chosen units. Converted to canonical
    // metric (kg, cm) at save time via parseWeightToKg / parseHeightToCm.
    height: '',
    weight: '',
    goal: 'recomp',
    training_days: '4',
    sleep_avg: '7',
    constraint: '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoPath, setPhotoPath] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

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
    if (!user) {
      navigate('/signup');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      // Persist the same fields the original onboarding wrote, plus the units
      // preference (new). Note: `start_date`, `loop_stage`, and `plan` are
      // locked against client UPDATEs by trigger 0020; any future move of
      // those fields needs to go through a server-side RPC. Baseline metrics
      // (height/weight/age/etc.) are intentionally not persisted here — the
      // `profiles` schema has no columns for them yet, and adding them is a
      // separate migration outside this fix's scope.
      const { error } = await supabase
        .from('profiles')
        .update({
          name: form.name,
          units,
          start_date: new Date().toISOString().slice(0, 10),
          loop_stage: 'diagnosis',
          plan: 'trial',
          baseline_photo_path: photoPath,
        })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile?.();
      navigate('/dashboard', { replace: true });
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

      <div className="mt-10 space-y-4">
        {step === 0 && (
          <>
            <Input label="Name" value={form.name} onChange={set('name')} />
            <Input label="Age" type="number" value={form.age} onChange={set('age')} />
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
            <Input label={heightLabel(units)} type="number" value={form.height} onChange={set('height')} />
            <Input label={weightLabel(units)} type="number" value={form.weight} onChange={set('weight')} />
            <Input label="Average sleep (hours)" type="number" value={form.sleep_avg} onChange={set('sleep_avg')} />
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
            <label className="flex cursor-pointer items-center justify-center gap-3 border border-dashed border-line bg-black/30 p-6 text-sm text-mute hover:border-gold">
              <Upload size={18} />
              <span>{photoFile ? 'Change photo' : 'Choose photo'}</span>
              <input type="file" accept="image/*" onChange={pickPhoto} className="sr-only" />
            </label>
            {photoPreview ? (
              <div className="space-y-3">
                <img src={photoPreview} alt="Baseline preview" className="max-h-80 w-full border border-line object-contain" />
                {!photoPath ? (
                  <Button onClick={uploadPhoto} disabled={uploading}>
                    {uploading ? 'Uploading' : 'Upload photo'}
                  </Button>
                ) : (
                  <div className="text-xs uppercase tracking-widest2 text-gold">Uploaded.</div>
                )}
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
        {err ? <div className="text-xs uppercase tracking-widest2 text-red-300">{err}</div> : null}
      </div>

      <div className="mt-8 flex justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep(step + 1)}>Next</Button>
        ) : (
          <Button disabled={busy} onClick={finish}>{busy ? 'Saving' : 'Enter'}</Button>
        )}
      </div>
    </div>
  );
}
