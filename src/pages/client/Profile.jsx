import { useEffect, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { downloadCSV } from '../../lib/csv';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';
import { StorageImage } from '../../components/StorageImage';
import { Card, CardHeader } from '../../components/ui/Card';
import { IntakePanel } from '../../components/IntakePanel';
import { formatWeight, formatWeightDelta, kgToLbs, parseWeightToKg, weightLabel } from '../../lib/units';

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const units = profile?.units ?? 'imperial';
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarErr, setAvatarErr] = useState(null);
  const [baselineBusy, setBaselineBusy] = useState(false);
  const [baselineErr, setBaselineErr] = useState(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileErr, setProfileErr] = useState(null);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInErr, setCheckInErr] = useState(null);
  const [photoErr, setPhotoErr] = useState(null);
  const [form, setForm] = useState({ name: '', email: '' });
  const [checkIns, setCheckIns] = useState([]);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [stats, setStats] = useState({ sessions: 0, photos: 0 });

  useEffect(() => {
    setForm({ name: profile?.name ?? '', email: profile?.email ?? user?.email ?? '' });
  }, [profile, user]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    supabase
      .from('check_ins')
      .select('*')
      .eq('client_id', user.id)
      .order('date', { ascending: false })
      .limit(12)
      .then(({ data }) => setCheckIns(data ?? []));

    (async () => {
      const [{ count: sessions }, { count: photos }] = await Promise.all([
        supabase
          .from('workout_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', user.id),
        supabase
          .from('check_ins')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', user.id)
          .not('photo_path', 'is', null),
      ]);
      setStats({ sessions: sessions ?? 0, photos: photos ?? 0 });
    })();
  }, [user?.id]);

  const earliestCheckInWithWeight = [...checkIns].reverse().find((c) => c.weight != null);
  const latestCheckInWithWeight = checkIns.find((c) => c.weight != null);
  const weightDelta =
    earliestCheckInWithWeight && latestCheckInWithWeight
      ? Math.round((Number(latestCheckInWithWeight.weight) - Number(earliestCheckInWithWeight.weight)) * 10) / 10
      : null;

  const startDate = profile?.start_date ? new Date(profile.start_date) : null;
  const daysIn = startDate
    ? Math.max(0, Math.floor((Date.now() - startDate.getTime()) / 86400000))
    : null;

  async function saveProfile(e) {
    e.preventDefault();
    setProfileBusy(true);
    setProfileErr(null);
    try {
      const { error } = await supabase.from('profiles').update({ name: form.name }).eq('id', user.id);
      if (error) throw error;
      await refreshProfile?.();
    } catch (e) {
      setProfileErr(e.message);
    } finally {
      setProfileBusy(false);
    }
  }

  async function uploadBaseline(e) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      setBaselineErr('Baseline photo must be an image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setBaselineErr('Image must be 10 MB or less.');
      return;
    }
    setBaselineBusy(true);
    setBaselineErr(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/baseline-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('baseline-photos')
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ baseline_photo_path: path })
        .eq('id', user.id);
      if (updErr) throw updErr;
      await refreshProfile?.();
    } catch (e) {
      setBaselineErr(`Baseline upload failed: ${e.message}`);
    } finally {
      setBaselineBusy(false);
    }
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      setAvatarErr('Avatar must be an image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarErr('Avatar must be 5 MB or less.');
      return;
    }
    setAvatarBusy(true);
    setAvatarErr(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_path: path })
        .eq('id', user.id);
      if (updErr) throw updErr;
      await refreshProfile?.();
    } catch (e) {
      setAvatarErr(`Avatar upload failed: ${e.message}`);
    } finally {
      setAvatarBusy(false);
    }
  }

  function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoErr('File must be an image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoErr('Image must be 10 MB or less.');
      return;
    }
    setPhotoErr(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function clearCheckInPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoErr(null);
  }

  async function logCheckIn(e) {
    e.preventDefault();
    setCheckInBusy(true);
    setCheckInErr(null);
    try {
      let photoPath = null;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${user.id}/checkin-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('baseline-photos')
          .upload(path, photoFile, { upsert: false, contentType: photoFile.type });
        if (upErr) throw upErr;
        photoPath = path;
      }
      const { data, error } = await supabase
        .from('check_ins')
        .insert({
          client_id: user.id,
          weight: parseWeightToKg(weight, units),
          body_fat: bodyFat ? Number(bodyFat) : null,
          notes,
          photo_path: photoPath,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      if (data) setCheckIns((xs) => [data, ...xs]);
      setWeight('');
      setBodyFat('');
      setNotes('');
      clearCheckInPhoto();
    } catch (e) {
      setCheckInErr(e.message);
    } finally {
      setCheckInBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        <Avatar name={profile?.name ?? profile?.email ?? 'You'} path={profile?.avatar_path} size={72} />
        <div>
          <div className="label mb-2">Profile</div>
          <h1 className="font-display text-4xl tracking-wider2">Your record</h1>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader label="Days in" title={daysIn != null ? `${daysIn}` : '—'} />
        </Card>
        <Card>
          <CardHeader label="Sessions" title={String(stats.sessions)} />
        </Card>
        <Card>
          <CardHeader
            label="Weight Δ"
            title={formatWeightDelta(weightDelta, units)}
            meta={
              earliestCheckInWithWeight && latestCheckInWithWeight
                ? `${formatWeight(earliestCheckInWithWeight.weight, units)} → ${formatWeight(latestCheckInWithWeight.weight, units)}`
                : null
            }
          />
        </Card>
        <Card>
          <CardHeader label="Photos" title={String(stats.photos)} meta="Check-in photos" />
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
        <div>
          <div className="label mb-2">Baseline photo</div>
          {profile?.baseline_photo_path ? (
            <StorageImage
              path={profile.baseline_photo_path}
              alt="Baseline"
              className="max-h-80 w-full object-contain"
            />
          ) : (
            <div className="flex h-48 w-full items-center justify-center border border-dashed border-line bg-black/20 text-xs text-faint">
              No baseline photo
            </div>
          )}
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 border border-line bg-black/30 px-4 py-2 text-xs uppercase tracking-widest2 text-mute hover:border-gold focus-within:border-gold">
            <Upload size={14} aria-hidden="true" />
            {baselineBusy ? 'Uploading' : profile?.baseline_photo_path ? 'Replace baseline' : 'Upload baseline'}
            <input type="file" accept="image/*" className="sr-only" onChange={uploadBaseline} disabled={baselineBusy} />
          </label>
          {baselineErr ? <div role="alert" className="mt-2 text-xs uppercase tracking-widest2 text-signal">{baselineErr}</div> : null}
        </div>
        <div className="text-sm text-mute">
          <p>
            One photo, well-lit, relaxed stance. Used at the start of the loop so the Diagnosis review has a
            reference point. Private — visible to you and the coach only.
          </p>
          {profile?.start_date ? (
            <p className="mt-3 text-xs text-faint">
              Loop started {new Date(profile.start_date).toLocaleDateString()}.
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <div className="label mb-2">Avatar</div>
        <label className="inline-flex cursor-pointer items-center gap-2 border border-line bg-black/30 px-4 py-3 text-xs uppercase tracking-widest2 text-mute hover:border-gold focus-within:border-gold">
          <Upload size={14} aria-hidden="true" />
          {avatarBusy ? 'Uploading' : profile?.avatar_path ? 'Replace avatar' : 'Upload avatar'}
          <input type="file" accept="image/*" className="sr-only" onChange={uploadAvatar} disabled={avatarBusy} />
        </label>
        {avatarErr ? <div role="alert" className="mt-2 text-xs uppercase tracking-widest2 text-signal">{avatarErr}</div> : null}
      </section>

      <form onSubmit={saveProfile} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Email" value={form.email} disabled />
        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <Button disabled={profileBusy}>{profileBusy ? 'Saving' : 'Save'}</Button>
          {profileErr ? <span role="alert" className="text-xs uppercase tracking-widest2 text-signal">{profileErr}</span> : null}
        </div>
      </form>

      <IntakePanel profile={profile} />

      <section>
        <div className="label mb-2">Weekly check-in</div>
        <form onSubmit={logCheckIn} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Input label={weightLabel(units)} type="number" min="0" max="800" step="0.1" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
            <Input label="Body fat %" type="number" min="0" max="60" step="0.1" inputMode="decimal" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
            <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sleep, stress, energy" />
            <label className="flex cursor-pointer items-center justify-center gap-2 border border-dashed border-line bg-black/30 px-3 text-xs uppercase tracking-widest2 text-mute hover:border-gold focus-within:border-gold">
              <Upload size={14} aria-hidden="true" />
              {photoFile ? 'Change photo' : 'Add photo'}
              <input type="file" accept="image/*" onChange={pickPhoto} className="sr-only" />
            </label>
          </div>
          {photoPreview ? (
            <div className="space-y-2">
              <img src={photoPreview} alt="New check-in preview" className="max-h-60 border border-line object-contain" />
              <button
                type="button"
                onClick={clearCheckInPhoto}
                className="text-xs uppercase tracking-widest2 text-faint hover:text-signal focus-visible:outline focus-visible:outline-1 focus-visible:outline-gold"
              >
                Remove photo
              </button>
            </div>
          ) : null}
          {photoErr ? <div role="alert" className="text-xs uppercase tracking-widest2 text-signal">{photoErr}</div> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={checkInBusy}>{checkInBusy ? 'Logging' : 'Log'}</Button>
            {checkInErr ? <span role="alert" className="text-xs uppercase tracking-widest2 text-signal">{checkInErr}</span> : null}
          </div>
        </form>
      </section>


      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="label">History</div>
          {checkIns.length > 0 ? (
            <button
              type="button"
              onClick={() =>
                downloadCSV(
                  `pkfit-checkins-${new Date().toISOString().slice(0, 10)}.csv`,
                  checkIns,
                  [
                    { key: 'date', label: 'Date' },
                    {
                      label: units === 'imperial' ? 'Weight (lbs)' : 'Weight (kg)',
                      get: (c) => (c.weight == null ? '' : units === 'imperial' ? kgToLbs(c.weight) : c.weight),
                    },
                    { key: 'body_fat', label: 'Body fat %' },
                    { key: 'notes', label: 'Notes' },
                  ],
                )
              }
              className="flex items-center gap-1 text-xs uppercase tracking-widest2 text-gold"
            >
              <Download size={12} /> CSV
            </button>
          ) : null}
        </div>
        {checkIns.length === 0 ? (
          <div className="border border-line bg-black/20 p-6 text-sm text-mute">No check-ins yet.</div>
        ) : (
          <ul className="divide-y divide-line border border-line">
            {checkIns.map((c) => (
              <li key={c.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[140px_1fr_1fr_2fr_120px]">
                <div className="label">{c.date?.slice(0, 10)}</div>
                <div>Weight: <span className="text-ink">{formatWeight(c.weight, units)}</span></div>
                <div>BF%: <span className="text-ink">{c.body_fat ?? '—'}</span></div>
                <div className="text-mute">{c.notes}</div>
                <div className="justify-self-end">
                  {c.photo_path ? <StorageImage path={c.photo_path} alt="Check-in photo" className="h-20 w-20 object-cover" /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
