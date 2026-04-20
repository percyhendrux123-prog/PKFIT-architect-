import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, KeyRound, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { account } from '../../lib/claudeClient';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader } from '../../components/ui/Card';

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);

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

  return (
    <div className="space-y-6">
      <header>
        <div className="label mb-2">Settings</div>
        <h1 className="font-display text-4xl tracking-wider2">Account</h1>
      </header>

      <Card>
        <CardHeader label="Password" title="Change password" />
        <form onSubmit={changePassword} className="max-w-md space-y-3">
          <Input label="New password" type="password" autoComplete="new-password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
          <Input label="Confirm new password" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          {pwErr ? <div className="text-xs uppercase tracking-widest2 text-red-300">{pwErr}</div> : null}
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
        {exportErr ? <div className="mt-3 text-xs uppercase tracking-widest2 text-red-300">{exportErr}</div> : null}
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
          {deleteErr ? <div className="text-xs uppercase tracking-widest2 text-red-300">{deleteErr}</div> : null}
          <Button variant="danger" onClick={deleteAccount} disabled={deleteBusy || deleteConfirm !== 'DELETE'}>
            <Trash2 size={14} /> {deleteBusy ? 'Deleting' : 'Delete account'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
