import { useAuth } from '../../context/AuthContext';
import { DMThread } from '../../components/DMThread';

export default function Inbox() {
  const { user, role } = useAuth();

  return (
    <div className="space-y-4">
      <header>
        <div className="label mb-2">Inbox</div>
        <h1 className="font-display text-4xl tracking-wider2">Direct line</h1>
        <p className="mt-2 max-w-reading text-sm text-mute">
          Messages between you and the coach. Short, specific, signal-only.
        </p>
      </header>

      {user ? (
        <DMThread clientId={user.id} viewer={{ id: user.id }} role={role} />
      ) : (
        <div className="border border-line bg-black/20 p-6 text-sm text-mute">Sign in to see your inbox.</div>
      )}
    </div>
  );
}
