import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { profileApi } from '../lib/claudeClient';
import { feetInchesToCm, cmToFeetInches } from '../lib/units';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

// Full intake panel: legal name, address, DOB, sex, height (ft + in),
// weight (lb), occupation, training background, goals — plus encrypted
// medical block (conditions, meds, allergies, injuries, emergency contact).
//
// Reads intake directly from the loaded profile prop. Reads medical via
// /get-my-medical (server decrypts). Writes via /update-profile (server
// encrypts medical before storing).

const SEX_OPTIONS = ['', 'male', 'female', 'prefer_not_to_say'];

function emptyIntake() {
  return {
    legal_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
    dob: '',
    sex: '',
    height_ft: '',
    height_in: '',
    weight_lb: '',
    occupation: '',
    training_background: '',
    goals: '',
    training_days_per_week: '',
    equipment: '',
  };
}

function emptyMedical() {
  return {
    conditions: '',
    medications: '',
    allergies: '',
    injuries: '',
    emergency_name: '',
    emergency_phone: '',
    emergency_relation: '',
  };
}

export function IntakePanel({ profile }) {
  const [intake, setIntake] = useState(emptyIntake);
  const [medical, setMedical] = useState(emptyMedical);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [medicalLoaded, setMedicalLoaded] = useState(false);

  useEffect(() => {
    const i = profile?.intake ?? {};
    const fi = i.height_cm != null ? cmToFeetInches(i.height_cm) : null;
    setIntake({
      ...emptyIntake(),
      ...i,
      height_ft: fi?.feet ?? '',
      height_in: fi?.inches ?? '',
      weight_lb: i.weight_lb ?? '',
      training_days_per_week: i.training_days_per_week ?? '',
    });
  }, [profile?.intake]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { medical: m } = await profileApi.getMedical();
        if (cancelled) return;
        if (m) {
          setMedical({
            conditions: m.conditions ?? '',
            medications: m.medications ?? '',
            allergies: m.allergies ?? '',
            injuries: m.injuries ?? '',
            emergency_name: m.emergency_contact?.name ?? '',
            emergency_phone: m.emergency_contact?.phone ?? '',
            emergency_relation: m.emergency_contact?.relation ?? '',
          });
        }
        setMedicalLoaded(true);
      } catch {
        setMedicalLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function bind(group, key) {
    const setter = group === 'intake' ? setIntake : setMedical;
    const value = (group === 'intake' ? intake : medical)[key] ?? '';
    return {
      value,
      onChange: (e) => setter((s) => ({ ...s, [key]: e.target.value })),
    };
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        intake: {
          legal_name: intake.legal_name || null,
          address_line1: intake.address_line1 || null,
          address_line2: intake.address_line2 || null,
          city: intake.city || null,
          state: intake.state || null,
          postal_code: intake.postal_code || null,
          country: intake.country || 'US',
          dob: intake.dob || null,
          sex: intake.sex || null,
          height_cm: feetInchesToCm(intake.height_ft, intake.height_in),
          weight_lb: intake.weight_lb ? Number(intake.weight_lb) : null,
          occupation: intake.occupation || null,
          training_background: intake.training_background || null,
          goals: intake.goals || null,
          training_days_per_week: intake.training_days_per_week ? Number(intake.training_days_per_week) : null,
          equipment: intake.equipment || null,
        },
        medical: {
          conditions: medical.conditions || null,
          medications: medical.medications || null,
          allergies: medical.allergies || null,
          injuries: medical.injuries || null,
          emergency_contact: {
            name: medical.emergency_name || null,
            phone: medical.emergency_phone || null,
            relation: medical.emergency_relation || null,
          },
        },
      };
      await profileApi.update(payload);
      setSavedAt(new Date());
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-8 border border-line bg-black/20 p-5">
      <header>
        <div className="label mb-1">Intake</div>
        <h2 className="font-display text-2xl tracking-wider2 text-ink">
          Personal record
        </h2>
        <p className="mt-2 text-xs text-mute">
          American units throughout. Medical fields are encrypted at rest with a
          server-side key. Visible only to you and the coach.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Legal name" {...bind('intake', 'legal_name')} />
        <Input label="Date of birth (YYYY-MM-DD)" type="date" {...bind('intake', 'dob')} />
        <Input label="Address line 1" {...bind('intake', 'address_line1')} />
        <Input label="Address line 2" {...bind('intake', 'address_line2')} />
        <Input label="City" {...bind('intake', 'city')} />
        <Input label="State" maxLength={4} placeholder="TX" {...bind('intake', 'state')} />
        <Input label="ZIP" maxLength={12} {...bind('intake', 'postal_code')} />
        <label className="flex flex-col gap-1">
          <span className="label">Sex</span>
          <select
            value={intake.sex}
            onChange={(e) => setIntake((s) => ({ ...s, sex: e.target.value }))}
            className="border border-line bg-black/40 px-3 py-2 text-sm text-ink focus:border-gold"
          >
            {SEX_OPTIONS.map((v) => (
              <option key={v || 'none'} value={v}>
                {v || 'Select'}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Input label="Height (ft)" type="number" min="3" max="8" {...bind('intake', 'height_ft')} />
          <Input label="Height (in)" type="number" min="0" max="11" {...bind('intake', 'height_in')} />
        </div>
        <Input label="Weight (lb)" type="number" min="50" max="800" step="0.1" {...bind('intake', 'weight_lb')} />
        <Input label="Occupation" {...bind('intake', 'occupation')} />
        <Input label="Training days/week" type="number" min="1" max="7" {...bind('intake', 'training_days_per_week')} />
      </section>

      <section className="space-y-3">
        <Input label="Equipment access (gym, home rack, dumbbells…)" {...bind('intake', 'equipment')} />
        <label className="flex flex-col gap-1">
          <span className="label">Training background</span>
          <textarea
            rows={3}
            value={intake.training_background}
            onChange={(e) => setIntake((s) => ({ ...s, training_background: e.target.value }))}
            className="border border-line bg-black/40 px-3 py-2 text-sm text-ink focus:border-gold"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Goals</span>
          <textarea
            rows={3}
            value={intake.goals}
            onChange={(e) => setIntake((s) => ({ ...s, goals: e.target.value }))}
            className="border border-line bg-black/40 px-3 py-2 text-sm text-ink focus:border-gold"
          />
        </label>
      </section>

      <section className="space-y-3 border-t border-line pt-6">
        <header className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-gold" />
          <div>
            <div className="label">Medical (encrypted)</div>
            <p className="text-xs text-mute">
              {medicalLoaded ? 'AES-256-GCM at rest. Decrypted only for you.' : 'Loading…'}
            </p>
          </div>
        </header>
        {['conditions', 'medications', 'allergies', 'injuries'].map((k) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="label capitalize">{k}</span>
            <textarea
              rows={2}
              value={medical[k]}
              onChange={(e) => setMedical((s) => ({ ...s, [k]: e.target.value }))}
              className="border border-line bg-black/40 px-3 py-2 text-sm text-ink focus:border-gold"
            />
          </label>
        ))}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input label="Emergency contact name" {...bind('medical', 'emergency_name')} />
          <Input label="Phone" type="tel" {...bind('medical', 'emergency_phone')} />
          <Input label="Relation" {...bind('medical', 'emergency_relation')} />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy}>{busy ? 'Saving' : 'Save intake'}</Button>
        {savedAt ? (
          <span className="text-[0.65rem] uppercase tracking-widest2 text-success">
            Saved {savedAt.toLocaleTimeString()}
          </span>
        ) : null}
        {err ? (
          <span role="alert" className="text-xs uppercase tracking-widest2 text-signal">{err}</span>
        ) : null}
      </div>
    </form>
  );
}
