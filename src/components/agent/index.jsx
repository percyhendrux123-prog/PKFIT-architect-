// Public surface for the shared agent card library. Surfaces that consume
// the agent toolkit import from here, not from individual files.
//
// Usage (3 lines):
//   import { ToolCard } from '../components/agent';
//   // for each tool_call in the model response:
//   <ToolCard call={tc} sessionId={sessionId} surface="standard" />

import WorkbookCard from './WorkbookCard.jsx';
import QualifierCard from './QualifierCard.jsx';
import ConsultationRequestForm from './ConsultationRequestForm.jsx';
import MicroPlanCard from './MicroPlanCard.jsx';

export { WorkbookCard, QualifierCard, ConsultationRequestForm, MicroPlanCard };

// ToolCard dispatcher. Takes a raw tool_call ({ id, name, input }) plus the
// page's sessionId + surface, and renders the right card. Unknown tool
// names render nothing — defensive against future tools we haven't shipped
// UI for yet.
export function ToolCard({ call, sessionId, surface = 'standard' }) {
  if (!call?.name) return null;
  const result = {
    name: call.name,
    kind: call.kind, // optional; the server may have hydrated it via handleToolUse
    input: call.input ?? {},
    sessionId,
    surface,
  };
  switch (call.name) {
    case 'offer_workbook':
      return <WorkbookCard result={result} />;
    case 'offer_qualifier':
      return <QualifierCard result={result} />;
    case 'offer_consultation':
      return <ConsultationRequestForm result={result} />;
    case 'generate_micro_plan':
      return <MicroPlanCard result={result} />;
    default:
      return null;
  }
}
