import GlassCard from './GlassCard.jsx';
import {
  AGENT_THEME,
  CARD_FRAMING_STYLE,
  CARD_HEADING_STYLE,
  PRIMARY_BUTTON_STYLE,
} from './_theme.js';
import { TOOL_URLS } from '../../lib/agentTools.js';

const { BORDER, GOLD, INK, MUTE } = AGENT_THEME;

// Renders the generate_micro_plan tool call. Two-card composition:
//   1. The plan body — pain → standard → day-by-day list.
//   2. The cliffhanger — Percy-voice closing line + qualifier CTA.
//
// Guards: if the model produced no days (or a malformed envelope), the
// component renders nothing rather than a broken card.
export default function MicroPlanCard({ result }) {
  const plan = result?.input;
  if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) return null;
  const sortedDays = [...plan.days].sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <GlassCard>
        <div style={CARD_HEADING_STYLE}>YOUR FIRST 7 DAYS</div>
        {plan.identified_pain ? (
          <div style={{ ...CARD_FRAMING_STYLE, marginTop: 6 }}>
            <span style={{ color: GOLD }}>The pain:</span> {plan.identified_pain}
          </div>
        ) : null}
        {plan.week_goal ? (
          <div style={{ ...CARD_FRAMING_STYLE, marginTop: 4 }}>
            <span style={{ color: GOLD }}>The standard:</span> {plan.week_goal}
          </div>
        ) : null}
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            borderTop: `0.5px solid ${BORDER}`,
            paddingTop: 12,
          }}
        >
          {sortedDays.map((d, i) => (
            <DayRow key={i} day={d.day} focus={d.focus} action={d.action} />
          ))}
        </div>
      </GlassCard>
      {plan.cliffhanger ? (
        <GlassCard accent>
          <div style={{ ...CARD_FRAMING_STYLE, color: INK, marginTop: 0 }}>
            {plan.cliffhanger}
          </div>
          <div style={{ marginTop: 12 }}>
            <a
              href={TOOL_URLS.qualifier}
              target="_blank"
              rel="noopener noreferrer"
              style={PRIMARY_BUTTON_STYLE}
            >
              OPEN QUALIFIER
            </a>
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}

function DayRow({ day, focus, action }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
      <div
        style={{
          fontFamily: '"Bebas Neue", system-ui, sans-serif',
          letterSpacing: '0.06em',
          fontSize: 18,
          color: GOLD,
          minWidth: 36,
        }}
      >
        DAY {day}
      </div>
      <div style={{ flex: 1, fontSize: 13, color: INK, lineHeight: 1.5 }}>
        {focus ? (
          <div
            style={{
              color: MUTE,
              fontSize: 11,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {focus}
          </div>
        ) : null}
        {action ? <div style={{ marginTop: 2 }}>{action}</div> : null}
      </div>
    </div>
  );
}
