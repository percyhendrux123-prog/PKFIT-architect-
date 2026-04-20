/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080808',
        gold: '#C9A84C',
        ink: '#F5F5F5',
        mute: '#BFBFBF',
        faint: '#9A9A9A',
        line: 'rgba(201, 168, 76, 0.18)',
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
