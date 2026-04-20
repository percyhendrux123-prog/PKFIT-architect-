import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StorageImage } from '../../components/StorageImage';

export default function Profile() {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({ name: '', email: '' });
  const [checkIns, setCheckIns] = useState([]);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

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
  }, [user?.id]);

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    await supabase.from('profiles').update({ name: form.name }).eq('id', user.id);
    setBusy(false);
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
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function logCheckIn(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
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
          weight: weight ? Number(weight) : null,
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
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="label mb-2">Profile</div>
        <h1 className="font-display text-4xl tracking-wider2">Your record</h1>
      </header>

      <form onSubmit={saveProfile} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Email" value={form.email} disabled />
        <div className="md:col-span-2"><Button disabled={busy}>Save</Button></div>
      </form>

      <section>
        <div className="label mb-2">Weekly check-in</div>
        <form onSubmit={logCheckIn} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Input label="Weight (kg)" type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
            <Input label="Body fat %" type="number" step="0.1" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
            <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sleep, stress, energy" />
            <label className="flex cursor-pointer items-center justify-center gap-2 border border-dashed border-line bg-black/30 px-3 text-xs uppercase tracking-widest2 text-mute hover:border-gold">
              <Upload size={14} />
              {photoFile ? 'Change photo' : 'Add photo'}
              <input type="file" accept="image/*" onChange={pickPhoto} className="sr-only" />
            </label>
          </div>
          {photoPreview ? (
            <img src={photoPreview} alt="New check-in preview" className="max-h-60 border border-line object-contain" />
          ) : null}
          <Button disabled={busy}>{busy ? 'Logging' : 'Log'}</Button>
        </form>
      </section>

      {err ? <div className="text-xs uppercase tracking-widest2 text-red-300">{err}</div> : null}

      <section>
        <div className="label mb-2">History</div>
        {checkIns.length === 0 ? (
          <div className="border border-line bg-black/20 p-6 text-sm text-mute">No check-ins yet.</div>
        ) : (
          <ul className="divide-y divide-line border border-line">
            {checkIns.map((c) => (
              <li key={c.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[140px_1fr_1fr_2fr_120px]">
                <div className="label">{c.date?.slice(0, 10)}</div>
                <div>Weight: <span className="text-ink">{c.weight ?? '—'}</span></div>
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
