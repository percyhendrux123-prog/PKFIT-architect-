// Icon — line SVG icon set extracted from the PKFIT redesign primitives bundle.
// Converted to ES module from window-global definition.

export function Icon({ name, size = 20, stroke = 1.6, color = 'currentColor' }) {
  const paths = {
    home: (<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>),
    flame: (<path d="M12 3s4 4 4 8a4 4 0 1 1-8 0c0-2 1-3 1-3s-1-3 3-5zm0 18a6 6 0 0 0 6-6c0-2-1-3-1-3" />),
    chart: (<><path d="M4 20V8" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>),
    user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>),
    chat: (<path d="M21 12a8 8 0 1 1-3-6.2L21 4l-1 4a8 8 0 0 1 1 4z" />),
    play: (<path d="M6 4l14 8-14 8z" />),
    pause: (<><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>),
    plus: (<><path d="M12 5v14" /><path d="M5 12h14" /></>),
    check: (<path d="M5 12l5 5 9-11" />),
    arrow: (<><path d="M5 12h14" /><path d="M13 5l7 7-7 7" /></>),
    arrowUp: (<><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></>),
    arrowDown: (<><path d="M12 5v14" /><path d="M5 12l7 7 7-7" /></>),
    bell: (<path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9zm6 13a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3z" />),
    calendar: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M3 10h18" /></>),
    timer: (<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2" /><path d="M9 2h6" /></>),
    apple: (<path d="M12 7c0-2 2-4 4-4-1 3-3 4-4 4zm0 0c-3 0-7 2-7 7 0 5 4 10 7 10s2-2 4-2 1 2 4 2c0 0 4-3 4-9 0-3-2-7-7-7-2 0-3 1-5 1z" />),
    camera: (<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7l2-3h4l2 3" /><circle cx="12" cy="13" r="4" /></>),
    sparkle: (<><path d="M12 3v6" /><path d="M12 15v6" /><path d="M3 12h6" /><path d="M15 12h6" /><path d="M5 5l4 4" /><path d="M15 15l4 4" /><path d="M19 5l-4 4" /><path d="M9 15l-4 4" /></>),
    settings: (<><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.6-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></>),
    search: (<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></>),
    heart: (<path d="M12 21s-8-5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-10 11-10 11z" />),
    bolt: (<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />),
    target: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>),
    mic: (<><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></>),
    send: (<><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></>),
    close: (<><path d="M6 6l12 12" /><path d="M18 6l-12 12" /></>),
    menu: (<><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>),
    moon: (<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />),
    sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v3" /><path d="M12 19v3" /><path d="M2 12h3" /><path d="M19 12h3" /><path d="M5 5l2 2" /><path d="M17 17l2 2" /><path d="M5 19l2-2" /><path d="M17 7l2-2" /></>),
    cycle: (<><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M3 21v-5h5" /></>),
    ruler: (<><rect x="3" y="9" width="18" height="6" rx="1" /><path d="M7 9v3" /><path d="M11 9v3" /><path d="M15 9v3" /><path d="M19 9v3" /></>),
    droplet: (<path d="M12 3s7 8 7 13a7 7 0 1 1-14 0c0-5 7-13 7-13z" />),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      {paths[name] || null}
    </svg>
  );
}

export default Icon;
