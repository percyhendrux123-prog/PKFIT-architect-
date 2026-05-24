import GlassCard from './GlassCard.jsx';
import { CARD_FRAMING_STYLE, CARD_HEADING_STYLE, PRIMARY_BUTTON_STYLE } from './_theme.js';
import { TOOL_URLS } from '../../lib/agentTools.js';

// Renders the offer_workbook tool call. `result` envelope shape:
//   { name, kind, input: { framing }, sessionId, surface }
// Only `result.input.framing` is required for render — sessionId/surface are
// captured by the parent page (and the diagnose function) for analytics.
export default function WorkbookCard({ result }) {
  const framing = result?.input?.framing;
  return (
    <GlassCard>
      <div style={CARD_HEADING_STYLE}>THE PKFIT DIAGNOSTIC</div>
      {framing ? <div style={CARD_FRAMING_STYLE}>{framing}</div> : null}
      <div style={{ marginTop: 12 }}>
        <a
          href={TOOL_URLS.workbook}
          target="_blank"
          rel="noopener noreferrer"
          style={PRIMARY_BUTTON_STYLE}
        >
          GET THE DIAGNOSTIC
        </a>
      </div>
    </GlassCard>
  );
}
