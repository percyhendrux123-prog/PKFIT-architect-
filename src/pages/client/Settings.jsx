import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, Download, KeyRound, Save, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { account } from '../../lib/claudeClient';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Card, CardHeader } from '../../components/ui/Card';
import {
  pushSupported,
  requestNotifications,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../lib/push';

export default function Settings() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);

  const [target, setTarget] = useState({
    target_kcal: '',
    target_protein_g: '',
    target_carbs_g: '',
    target_fat_g: '',
  });
  const [targetBusy, setTargetBusy] = useState(false);
  const [targetMsg, setTargetMsg] = useState(null);

  // Notifications state
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState(null);
  const [pushErr, setPushErr] = useState(null);
  const [pushOk, setPushOk] = useState(false);

  useEffect(() => {
    setTarget({
      target_kcal: profile?.target_kcal ?? '',
      target_protein_g: profile?.target_protein_g ?? '',
      target_carbs_g: profile?.target_carbs_g ?? '',
      target_fat_g: profile?.target_fat_g ?? '',
    });
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    async function detect() {
      const ok = pushSupported();
      if (cancelled) return;
      setPushOk(ok);
      if (!ok) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setPushEnabled(!!sub && Notification.permission === 'granted');
      } catch {
        // ignore — toggle simply stays off
      }
    }
    detect();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveTarget(e) {
    e.preventDefault();
    setTargetBusy(true);
    setTargetMsg(null);
    const payload = {
      target_kcal: target.target_kcal === '' ? null : Number(target.target_kcal),
      target_protein_g: target.target_protein_g === '' ? null : Number(target.target_protein_g),
      target_carbs_g: target.target_carbs_g === '' ? null : Number(target.target_carbs_g),
      target_fat_g: target.target_fat_g === '' ? null : Number(target.target_fat_g),
    };
    await supabase.from('profiles').update(payload).eq('id', user.id);
    await refreshProfile?.();
    setTargetMsg('Macro floor saved.');
    setTargetBusy(false);
  }

  const [exportBusy, setExportBusy] = useState(false);
  const [exportErr, setExportErr] = useState(null);

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState(null);

  async function changePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    if (pw1.length < 8) {
      setPwErr('Password must be at least 8 characters.');
      return;
    }
    if (pw1 !== pw2) {
      setPwErr('Passwords do not match.');
      return;
    }
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setPw1('');
      setPw2('');
      setPwMsg('Password updated.');
    } catch (e) {
      setPwErr(e.message);
    } finally {
      setPwBusy(false);
    }
  }

  async function exportData() {
    setExportBusy(true);
    setExportErr(null);
    try {
      const dump = await account.exportData();
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pkfit-export-${user.id}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setExportErr(e.message);
    } finally {
      setExportBusy(false);
    }
  }

  async function deleteAccount() {
    setDeleteErr(null);
    if (deleteConfirm !== 'DELETE') {
      setDeleteErr('Type DELETE to confirm.');
      return;
    }
    setDeleteBusy(true);
    try {
      await account.deleteAccount();
      await signOut();
      navigate('/', { replace: true });
    } catch (e) {
      setDeleteErr(e.message);
      setDeleteBusy(false);
    }
  }

  async function enablePush() {
    setPushBusy(true);
    setPushMsg(null);
    setPushErr(null);
    try {
      const perm = await requestNotifications();
      if (perm !== 'granted') {
        setPushErr(
          perm === 'denied'
            ? 'Notifications are blocked in browser settings.'
            : 'Permission was not granted.',
        );
        return;
      }
      await subscribeToPush();
      setPushEnabled(true);
      setPushMsg('Notifications enabled.');
    } catch (e) {
      setPushErr(e.message);
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    setPushMsg(null);
    setPushErr(null);
    try {
      await unsubscribeFromPush();
      setPushEnabled(false);
      setPushMsg('Notifications disabled.');
    } catch (e) {
      setPushErr(e.message);
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="label mb-2">Settings</div>
        <h1 className="font-display text-4xl tracking-wider2">Account</h1>
      </header>

      <Card>
        <CardHeader label="Display" title="Units" meta="Applies to weight and height across the app" />
        <Select
          className="max-w-xs"
          value={profile?.units ?? 'imperial'}
          onChange={async (e) => {
            await supabase.from('profiles').update({ units: e.target.value }).eq('id', user.id);
            await refreshProfile?.();
          }}
        >
          <option value="imperial">Imperial (lbs, ft/in)</option>
          <option value="metric">Metric (kg, cm)</option>
        </Select>
      </Card>

      <Card>
        <CardHeader
          label="Notifications"
          title="Push notifications"
          meta="Coach DMs, workout reminders, and weekly review nudges"
        />
        {!pushOk ? (
          <p className="max-w-reading text-sm text-mute">
            This browser does not support web push. On iPhone, install PKFIT to your home
            screen first, then return here.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="max-w-reading text-sm text-mute">
              Receive a system notification when your coach sends you a DM, when a workout
              is scheduled, or when a weekly review is ready.
            </p>
            <div className="flex items-center gap-3">
              {pushEnabled ? (
                <Button variant="ghost" onClick={disablePush} disabled={pushBusy}>
                  <BellOff size={14} /> {pushBusy ? 'Working' : 'Disable notifications'}
                </Button>
              ) : (
                <Button onClick={enablePush} disabled={pushBusy}>
                  <Bell size={14} /> {pushBusy ? 'Enabling' : 'Enable notifications'}
                </Button>
              )}
              {pushMsg ? (
                <span className="text-xs uppercase tracking-widest2 text-gold">{pushMsg}</span>
              ) : null}
              {pushErr ? (
                <span className="text-xs uppercase tracking-widest2 text-signal">{pushErr}</span>
              ) : null}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader label="Nutrition" title="Macro floor" meta="Used on Meals to compare planned vs. eaten" />
        <form onSubmit={saveTarget} className="grid max-w-xl grid-cols-2 gap-3 md:grid-cols-4">
          <Input
            label="Kcal"
            type="number"
            min="0"
            max="6000"
            inputMode="numeric"
            value={target.target_kcal}
            onChange={(e) => setTarget({ ...target, target_kcal: e.target.value })}
          />
          <Input
            label="Protein (g)"
            type="number"
            min="0"
            max="500"
            inputMode="numeric"
            value={target.target_protein_g}
            onChange={(e) => setTarget({ ...target, target_protein_g: e.target.value })}
          />
          <Input
            label="Carbs (g)"
            type="number"
            min="0"
            max="800"
            inputMode="numeric"
            value={target.target_carbs_g}
            onChange={(e) => setTarget({ ...target, target_carbs_g: e.target.value })}
          />
          <Input
            label="Fat (g)"
            type="number"
            min="0"
            max="300"
            inputMode="numeric"
            value={target.target_fat_g}
            onChange={(e) => setTarget({ ...target, target_fat_g: e.target.value })}
          />
          <div className="col-span-2 md:col-span-4">
            <Button type="submit" disabled={targetBusy}>
              <Save size={14} /> {targetBusy ? 'Saving' : 'Save floor'}
            </Button>
            {targetMsg ? (
              <span className="ml-3 text-xs uppercase tracking-widest2 text-gold">{targetMsg}</span>
            ) : null}
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader label="Password" title="Change password" />
        <form onSubmit={changePassword} className="max-w-md space-y-3">
          <Input label="New password" type="password" autoComplete="new-password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
          <Input label="Confirm new password" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          {pwErr ? <div className="text-xs uppercase tracking-widest2 text-signal">{pwErr}</div> : null}
          {pwMsg ? <div className="text-xs uppercase tracking-widest2 text-gold">{pwMsg}</div> : null}
          <Button type="submit" disabled={pwBusy || !pw1 || !pw2}>
            <KeyRound size={14} /> {pwBusy ? 'Updating' : 'Update password'}
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader label="Data" title="Export your data" />
        <p className="max-w-reading text-sm text-mute">
          Downloads every row you own across profile, programs, meals, habits, check-ins, reviews, payments, sessions,
          community activity, assistant conversations, and direct messages. JSON format.
        </p>
        {exportErr ? <div className="mt-3 text-xs uppercase tracking-widest2 text-signal">{exportErr}</div> : null}
        <div className="mt-4">
          <Button onClick={exportData} variant="ghost" disabled={exportBusy}>
            <Download size={14} /> {exportBusy ? 'Assembling' : 'Download export'}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader label="Delete" title="Delete account" />
        <p className="max-w-reading text-sm text-mute">
          Removes your auth account and every row referencing it: programs, meals, habits, check-ins, sessions,
          reviews, conversations, direct messages, photos, payments. Irreversible. Stripe subscriptions must be
          cancelled separately from the billing portal before deletion — otherwise billing continues on Stripe.
        </p>
        <div className="mt-4 space-y-3">
          <Input
            label="Type DELETE to confirm"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
          />
          {deleteErr ? <div className="text-xs uppercase tracking-widest2 text-signal">{deleteErr}</div> : null}
          <Button variant="danger" onClick={deleteAccount} disabled={deleteBusy || deleteConfirm !== 'DELETE'}>
            <Trash2 size={14} /> {deleteBusy ? 'Deleting' : 'Delete account'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
