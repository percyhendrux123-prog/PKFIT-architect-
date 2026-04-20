import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function Profile() {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({ name: '', email: '' });
  const [checkIns, setCheckIns] = useState([]);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

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

  async function logCheckIn(e) {
    e.preventDefault();
    setBusy(true);
    const { data } = await supabase
      .from('check_ins')
      .insert({
        client_id: user.id,
        weight: weight ? Number(weight) : null,
        body_fat: bodyFat ? Number(bodyFat) : null,
        notes,
      })
      .select()
      .maybeSingle();
    if (data) setCheckIns((xs) => [data, ...xs]);
    setWeight('');
    setBodyFat('');
    setNotes('');
    setBusy(false);
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
        <form onSubmit={logCheckIn} className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Input label="Weight (kg)" type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
          <Input label="Body fat %" type="number" step="0.1" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sleep, stress, energy" />
          <div className="self-end"><Button disabled={busy}>Log</Button></div>
        </form>
      </section>

      <section>
        <div className="label mb-2">History</div>
        {checkIns.length === 0 ? (
          <div className="border border-line bg-black/20 p-6 text-sm text-mute">No check-ins yet.</div>
        ) : (
          <ul className="divide-y divide-line border border-line">
            {checkIns.map((c) => (
              <li key={c.id} className="grid grid-cols-1 gap-2 p-4 md:grid-cols-[140px_1fr_1fr_2fr]">
                <div className="label">{c.date?.slice(0, 10)}</div>
                <div>Weight: <span className="text-ink">{c.weight ?? '—'}</span></div>
                <div>BF%: <span className="text-ink">{c.body_fat ?? '—'}</span></div>
                <div className="text-mute">{c.notes}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
