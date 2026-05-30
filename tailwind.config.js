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
        // WCAG 1.4.11 fix: alpha 0.12 resolved to ~1.3:1 over the #080808
        // page — borders read as voids. Bumped to 0.40 → ~3.45:1, clearing
        // the 3:1 minimum for non-text UI boundaries with a small margin.
        line: 'rgba(245, 241, 232, 0.40)',
        signal: '#A03A2C',
        success: '#7A8C5C',
      },
      fontFamily: {
        // PK•FIT brand cascade. Bebas Neue is bundled and self-hosted from
        // /public/fonts/. DRUK Wide is reserved as a future-licensed face;
        // it stays in the chain so the day the woff2 is added the brand can
        // upgrade without touching component code. system-ui closes the chain.
        display: ['"Bebas Neue"', '"DRUK Wide"', '"Druk Wide"', 'system-ui', 'sans-serif'],
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
