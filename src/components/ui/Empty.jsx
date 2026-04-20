export function Empty({ title, body, action }) {
  return (
    <div className="border border-line bg-black/20 p-8 text-center">
      <div className="label mb-2">Empty surface</div>
      <h3 className="font-display text-2xl tracking-wider2">{title}</h3>
      {body ? <p className="mx-auto mt-3 max-w-reading text-sm text-mute">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-widest2 text-faint">
      <span className="inline-block h-2 w-2 bg-gold" />
      Loading
    </div>
  );
}
