import { useEffect, useRef } from 'react';
import { Button } from './Button';

export function Modal({ open, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary', busy = false, onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    confirmRef.current?.focus();

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!busy) onCancel?.();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll('button:not([disabled])');
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5 py-10">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-bg/85"
        onClick={() => { if (!busy) onCancel?.(); }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pkfit-modal-title"
        className="relative w-full max-w-md border border-line bg-bg p-6 shadow-2xl"
      >
        <h2 id="pkfit-modal-title" className="font-display text-xl tracking-wider2 text-gold">
          {title}
        </h2>
        {body ? <p className="mt-3 text-sm text-mute">{body}</p> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <button
            ref={confirmRef}
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex items-center justify-center gap-2 px-5 py-3 font-display tracking-wider2 text-sm uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              tone === 'danger'
                ? 'border border-signal/60 text-signal hover:border-signal'
                : 'bg-gold text-bg hover:bg-[#d8b658]'
            }`}
          >
            {busy ? 'Working' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
