import { AGENT_THEME } from './_theme.js';

const { BORDER, GOLD, INK, RADIUS } = AGENT_THEME;

// Glassmorphism container shared by every agent card. `accent` swaps the
// border to gold — used for the conversion-tier cards (qualifier,
// consultation, micro-plan cliffhanger) so they pop visually above the
// information-tier cards (workbook, plan body).
export default function GlassCard({ children, accent = false }) {
  return (
    <div
      style={{
        background: 'rgba(22, 22, 22, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: `0.5px solid ${accent ? GOLD : BORDER}`,
        borderRadius: RADIUS,
        padding: '14px 16px',
        color: INK,
      }}
    >
      {children}
    </div>
  );
}
