import { useEffect } from 'react';

export default function PhoneShell({ children, screen }) {
  useEffect(() => {
    if (screen) document.title = `operatefitness.app — ${screen}`;
    document.documentElement.style.setProperty('color-scheme', 'dark');
  }, [screen]);

  return (
    <div className="op-root">
      <div className="op-frame">{children}</div>
    </div>
  );
}
