// Shared agent-tools toolkit. Used by /standard and any future Claude-driven
// lead surface (audit app, /structure, /system, /protocol, /align, …).
//
// PURE module — no React, no Node-only APIs, no Vite/Supabase imports.
// Bundles cleanly into both the Vite client build (for type-aware UI mapping)
// and Netlify function bundles (for Anthropic tool schemas + dispatcher).
//
// Three exports do the heavy lifting:
//
//   agentToolDefinitions   The Anthropic `tools` array. Pass straight to
//                          `anthropic.messages.create({ tools: ... })`.
//   AGENT_TOOL_NAMES       Set<string> for validating tool_use blocks coming
//                          back from the model (defends against hallucinated
//                          tool names).
//   TOOL_TO_CARD           Map of tool_name → UI card kind. The component
//                          library keys off this; surfaces don't need to
//                          know the tool names directly.
//
// And the dispatcher:
//
//   handleToolUse({ toolName, toolInput, sessionId, context })
//                          Validates the tool, fires the optional
//                          context.onToolFired side-effect (which surfaces
//                          wire to their own capture_lead persistence —
//                          diagnose_sessions for /standard, the audit
//                          sessions table for /audit, etc.), and returns
//                          the normalized result envelope.
//
// SURFACES — when adding a new one:
//   1. Mirror the diagnose Netlify function: pull tools/dispatcher from here.
//   2. Provide context.onToolFired so capture_lead writes to your session table.
//   3. Pass `surface: 'your-surface'` through to consultation-request when the
//      ConsultationRequestForm fires (so the row lands with the right tag).

const QUALIFIER_URL = 'https://pkfitelite.co.site';
const GUMROAD_URL = 'https://percyhendrux.gumroad.com/l/dxnenk';

// Canonical surface allowlist. Mirrors the consultation_requests check
// constraint added in 0059. Keep these in sync.
export const AGENT_SURFACES = ['standard', 'structure', 'system', 'protocol', 'align', 'audit'];

export function isValidSurface(s) {
  return typeof s === 'string' && AGENT_SURFACES.includes(s);
}

// ─── Tool schemas (Anthropic tool-use format) ───────────────────────────

export const agentToolDefinitions = [
  {
    name: 'offer_workbook',
    description:
      "Surface the free PKFIT diagnostic workbook (Gumroad) as a card in the chat. Call when the user has shared SPECIFIC pain AND seems unsure about coaching (level 2-3). Do not ask the user first — call the tool and the UI handles the offer.",
    input_schema: {
      type: 'object',
      properties: {
        framing: {
          type: 'string',
          description:
            'One short line in Percy voice that names the value of the workbook — no marketing speak, no URL, no exclamation points. Example: "It walks the breakdown — appetite, system, structure, standard."',
        },
      },
      required: ['framing'],
    },
  },
  {
    name: 'offer_qualifier',
    description:
      'Surface the pkfitelite.co.site qualifier as a card. Call when the user has explicitly asked about coaching, program, price, or how to start (level 4-5).',
    input_schema: {
      type: 'object',
      properties: {
        framing: {
          type: 'string',
          description:
            'One short line in Percy voice framing what happens next. Example: "I review every submission personally."',
        },
      },
      required: ['framing'],
    },
  },
  {
    name: 'offer_consultation',
    description:
      'Surface an inline form (email + preferred times) the user can submit to request a direct consultation. Call ONLY when the user is decisively ready (level 5) AND has shown specific intent (asked about start dates or said they are ready).',
    input_schema: {
      type: 'object',
      properties: {
        framing: {
          type: 'string',
          description:
            'One short line in Percy voice telling them what happens after they submit.',
        },
      },
      required: ['framing'],
    },
  },
  {
    name: 'generate_micro_plan',
    description:
      "Build and surface a structured 5-7 day starter plan as an inline card. Call at level 3-4 when the conversation has covered enough depth (2+ exchanges) that you can produce a plan SPECIFIC to the user's stated pain — not generic. The cliffhanger sets up the full system at the qualifier.",
    input_schema: {
      type: 'object',
      properties: {
        identified_pain: {
          type: 'string',
          description: 'The specific pain the user described, named back in Percy voice.',
        },
        week_goal: {
          type: 'string',
          description: 'The single standard they should be holding by end of week 1.',
        },
        days: {
          type: 'array',
          minItems: 5,
          maxItems: 7,
          items: {
            type: 'object',
            properties: {
              day: { type: 'integer', minimum: 1, maximum: 7 },
              focus: { type: 'string', description: 'The mechanism this day addresses.' },
              action: { type: 'string', description: 'The exact action they take that day.' },
            },
            required: ['day', 'focus', 'action'],
          },
        },
        cliffhanger: {
          type: 'string',
          description:
            'A closing line in Percy voice naming that this is week 1 and the full system goes through the qualifier.',
        },
      },
      required: ['identified_pain', 'week_goal', 'days', 'cliffhanger'],
    },
  },
];

export const AGENT_TOOL_NAMES = new Set(agentToolDefinitions.map((t) => t.name));

// UI mapping. Cards/components consume these kinds, not the raw tool names.
// Lets the UI evolve independently of the Anthropic-facing schema vocabulary.
export const TOOL_TO_CARD = {
  offer_workbook: 'workbook',
  offer_qualifier: 'qualifier',
  offer_consultation: 'consultation',
  generate_micro_plan: 'micro_plan',
};

// Stable URLs — exported so cards don't drift from server-rendered emails or
// other surfaces that mention them.
export const TOOL_URLS = {
  qualifier: QUALIFIER_URL,
  workbook: GUMROAD_URL,
};

// ─── Dispatcher ─────────────────────────────────────────────────────────

/**
 * Normalize a tool_use block coming back from Claude into a surface-ready
 * envelope. Pure logic — no I/O. Surfaces that need persistence wire it
 * through context.onToolFired, which is awaited but never blocks the return.
 *
 * @param {Object} args
 * @param {string} args.toolName    The name from the tool_use block.
 * @param {Object} args.toolInput   The structured input from the model.
 * @param {string} args.sessionId   Opaque session pointer (whatever the
 *                                  consuming surface uses to identify the
 *                                  conversation).
 * @param {Object} [args.context]   Surface-specific extras.
 * @param {string} [args.context.surface]   One of AGENT_SURFACES. Default 'standard'.
 * @param {Function} [args.context.onToolFired]  Async callback for capture_lead.
 *                                  Receives `{ toolName, toolInput, sessionId, surface }`.
 *                                  Failures are swallowed — capture is best-effort.
 *
 * @returns {Promise<{ok: boolean, name?: string, kind?: string, input?: Object, sessionId?: string, surface?: string, error?: string}>}
 */
export async function handleToolUse({ toolName, toolInput, sessionId, context = {} }) {
  if (!AGENT_TOOL_NAMES.has(toolName)) {
    return { ok: false, error: `unknown agent tool: ${toolName}` };
  }
  const surface = isValidSurface(context.surface) ? context.surface : 'standard';

  if (typeof context.onToolFired === 'function') {
    try {
      await context.onToolFired({ toolName, toolInput, sessionId, surface });
    } catch {
      // capture_lead failure should never block tool delivery to the UI.
      // Surfaces that need stronger guarantees can wrap their own callback.
    }
  }

  return {
    ok: true,
    name: toolName,
    kind: TOOL_TO_CARD[toolName],
    input: toolInput ?? {},
    sessionId,
    surface,
  };
}
