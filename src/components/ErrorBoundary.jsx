import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Log to console for now; Sentry wiring ships separately.
    // eslint-disable-next-line no-console
    console.error('PKFIT error boundary caught:', error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-reading px-5 py-16">
          <div className="label mb-2">Something broke</div>
          <h1 className="font-display text-4xl tracking-wider2 text-gold">A surface fell over</h1>
          <p className="mt-3 text-sm text-mute">
            Not the end. Reload the page, or go back to the dashboard. If it keeps happening on the same screen,
            screenshot and send it to the coach.
          </p>
          <pre className="mt-6 max-h-48 overflow-auto border border-line bg-black/30 p-3 text-[0.7rem] text-faint">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="border border-gold bg-gold px-5 py-3 font-display tracking-wider2 text-bg"
            >
              Reload
            </button>
            <a
              href="/dashboard"
              className="border border-line px-5 py-3 font-display tracking-wider2 text-ink hover:border-gold"
            >
              Dashboard
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
