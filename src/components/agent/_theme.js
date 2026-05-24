// Brand kit for the agent card library. Inlined (not pulled from the Tailwind
// theme) because the tailwind theme has been redefined away from gold and we
// want these cards to render identically across surfaces.

export const AGENT_THEME = {
  BG: '#080808',
  CARD: '#161616',
  BORDER: '#2a2a2a',
  INK: '#F5F5F5',
  MUTE: '#888',
  GOLD: '#C9A84C',
  RADIUS: 14,
};

const { GOLD, BG, BORDER, INK, MUTE } = AGENT_THEME;

export const CARD_HEADING_STYLE = {
  fontFamily: '"Bebas Neue", system-ui, sans-serif',
  letterSpacing: '0.08em',
  fontSize: 16,
  color: GOLD,
};

export const CARD_FRAMING_STYLE = {
  marginTop: 4,
  fontSize: 13,
  color: MUTE,
  lineHeight: 1.5,
};

export const PRIMARY_BUTTON_STYLE = {
  display: 'inline-block',
  background: GOLD,
  color: BG,
  border: `0.5px solid ${GOLD}`,
  borderRadius: AGENT_THEME.RADIUS - 4,
  padding: '9px 16px',
  fontFamily: '"Bebas Neue", system-ui, sans-serif',
  letterSpacing: '0.08em',
  fontSize: 14,
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'opacity 120ms ease',
};

export const FIELD_STYLE = {
  background: '#0f0f0f',
  color: INK,
  border: `0.5px solid ${BORDER}`,
  borderRadius: AGENT_THEME.RADIUS - 6,
  padding: '10px 12px',
  fontFamily: '"DM Mono", ui-monospace, monospace',
  fontSize: 13,
  outline: 'none',
};
