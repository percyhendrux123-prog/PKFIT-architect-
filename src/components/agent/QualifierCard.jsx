import GlassCard from './GlassCard.jsx';
import { CARD_FRAMING_STYLE, CARD_HEADING_STYLE, PRIMARY_BUTTON_STYLE } from './_theme.js';
import { TOOL_URLS } from '../../lib/agentTools.js';

// Renders the offer_qualifier tool call. Surfaces the pkfitelite.co.site
// path. The framing defaults to the brass line if the model didn't supply
// one — keeps the card safe to render even on malformed tool input.
export default function QualifierCard({ result }) {
  const framing = result?.input?.framing || 'Percy reviews every submission personally.';
  return (
    <GlassCard accent>
      <div style={CARD_HEADING_STYLE}>OPEN QUALIFIER</div>
      <div style={CARD_FRAMING_STYLE}>{framing}</div>
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
  );
}
