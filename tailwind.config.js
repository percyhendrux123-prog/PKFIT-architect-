/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080808',
        // minimalist 2026-05-01: redefined gold -> cream/bone. yellow stripped
        // entirely across the app via this single token. legacy `gold` class
        // names retained intentionally so the rest of the app compiles unchanged.
        gold: '#F5F1E8',
        ink: '#F5F5F5',
        mute: '#BFBFBF',
        faint: '#9A9A9A',
        // minimalist 2026-05-01: line tint moved off yellow rgba onto neutral cream.
        line: 'rgba(245, 241, 232, 0.12)',
        signal: '#A03A2C',
        success: '#7A8C5C',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'system-ui', 'sans-serif'],
        body: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        wider2: '0.08em',
        widest2: '0.2em',
      },
      maxWidth: {
        reading: '68ch',
      },
    },
  },
  plugins: [],
};
