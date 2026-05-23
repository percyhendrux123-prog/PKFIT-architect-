// Owner-agentic tool registry + orchestrator.
//
// Each tool exports:
//   name           — string, matches the tool_use name in Anthropic API
//   description    — string, what the tool does (sent to the model)
//   input_schema   — JSONSchema for parameters
//   risk           — RISK.LOW | MEDIUM | HIGH | CRITICAL
//   approval       — 'autonomous' | 'medium' | 'high' | 'critical'
//   execute(args, ctx)  — async, returns the tool result
//   isCritical?(args)   — optional, dynamic risk escalation (e.g. DDL)
//   criticalToken?(args)— optional, the typed token required for CRITICAL
//   computeRisk?(args)  — optional, dynamic risk (mcp_call inheritance)
//
// runTool() wraps an execute call with:
//   - approval gating against the conversation history
//   - audit logging (BEFORE execution → status='pending', then update)
//   - error capture + structured failure response

import { supabase_query_read, supabase_query_write } from './tools/supabase-query.js';
import { read_file, write_file } from './tools/files.js';
import { spawn_code_task, send_message_to_task, read_task_transcript } from './tools/code-task.js';
import { web_search, web_fetch } from './tools/web.js';
import { generate_image, voice_tts } from './tools/media.js';
import { mcp_call } from './tools/mcp.js';
import { set_env_var } from './tools/env.js';
import {
  read_client_data,
  run_generator,
  compare_periods,
  aggregate_clients,
} from './tools/client-data.js';
import { read_operator_upload, analyze_image, analyze_document } from './tools/architect-uploads.js';
import { RISK, hasHighApproval, hasCriticalApproval, parseBatchApproval } from './risk.js';
import { startAudit, finishAudit } from './audit.js';
import { redactInputs } from './redact.js';

const TOOLS = [
  supabase_query_read,
  supabase_query_write,
  read_file,
  write_file,
  spawn_code_task,
  send_message_to_task,
  read_task_transcript,
  web_search,
  web_fetch,
  generate_image,
  voice_tts,
  mcp_call,
  set_env_var,
  read_client_data,
  run_generator,
  compare_periods,
  aggregate_clients,
  read_operator_upload,
  analyze_image,
  analyze_document,
];

export const TOOL_REGISTRY = Object.freeze(
  TOOLS.reduce((acc, t) => {
    acc[t.name] = t;
    return acc;
  }, {}),
);

// Format the tools for the Anthropic API. The SDK accepts an array of
// { name, description, input_schema }.
export function getAnthropicTools() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

// Compute the effective risk for this invocation. Tools can override
// dynamically (mcp_call inherits, supabase_query_write escalates on DDL,
// set_env_var escalates on critical key).
function effectiveRisk(tool, args) {
  if (tool.isCritical && tool.isCritical(args)) return RISK.CRITICAL;
  if (tool.computeRisk) return tool.computeRisk(args);
  return tool.risk ?? RISK.MEDIUM;
}

// Run a tool with the full gate + audit pipeline.
//
// ctx:
//   userId         — auth user id (required)
//   conversationId — conversation id (required for audit)
//   messages       — conversation history (used for approval gate)
//   batchApprovals — { count, tools } map of in-conversation auto-approvals
//   callerToken    — Bearer token for internal function calls (run_generator)
//   internalBaseUrl — host URL for internal fetches
//
// Returns { tool_result, audit_id, blocked?: { reason, prompt } }.
export async function runTool({ name, args }, ctx) {
  const tool = TOOL_REGISTRY[name];
  if (!tool) {
    return {
      tool_result: { error: `unknown tool: ${name}` },
      blocked: null,
      audit_id: null,
    };
  }
  const risk = effectiveRisk(tool, args ?? {});
  const redacted = redactInputs(args ?? {});

  // Batch-approval scan: check the most recent user message for declarations.
  let batchedApproved = false;
  if (Array.isArray(ctx.messages)) {
    for (let i = ctx.messages.length - 1; i >= 0; i--) {
      const m = ctx.messages[i];
      if (m?.role !== 'user') continue;
      const text = typeof m.content === 'string' ? m.content : '';
      const parsed = parseBatchApproval(text);
      if (parsed) {
        if (parsed.scope === 'all') batchedApproved = true;
        else if (parsed.tool && parsed.tool === name) batchedApproved = true;
        else if (typeof parsed.count === 'number') batchedApproved = true; // approximate
      }
      break;
    }
  }

  // Approval gate.
  let approvalStatus = 'autonomous';
  if (risk === RISK.LOW) {
    approvalStatus = 'autonomous';
  } else if (risk === RISK.MEDIUM) {
    if (batchedApproved) approvalStatus = 'auto_batch';
    else if (hasHighApproval(ctx.messages)) approvalStatus = 'approved';
    else {
      // For MEDIUM, allow proceeding but record as 'approved' if user said
      // yes; otherwise the agent should have surfaced a preview first. We
      // accept the agent's call on MEDIUM but the spec says single-tap
      // confirm — we treat the lack of explicit yes as a soft block, returning
      // a tool result that instructs the agent to first ask.
      return {
        tool_result: {
          blocked: true,
          reason: 'MEDIUM-risk action — surface a one-line preview and await yes/go.',
          preview_hint: `About to call ${name}. State the planned action in plain English and wait for confirmation.`,
          redacted_inputs: redacted,
        },
        blocked: { reason: 'medium_needs_preview', risk: 'MEDIUM' },
        audit_id: null,
      };
    }
  } else if (risk === RISK.HIGH) {
    if (batchedApproved) approvalStatus = 'auto_batch';
    else if (hasHighApproval(ctx.messages)) approvalStatus = 'approved';
    else {
      const auditPending = await startAudit({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        toolName: name,
        riskLevel: risk,
        inputs: args,
        approvalStatus: 'pending',
        approverUserId: ctx.userId,
      });
      return {
        tool_result: {
          blocked: true,
          reason: 'HIGH-risk action requires explicit user confirmation.',
          instruction: `BLOCKED: state in one sentence what ${name} is about to do (with the redacted inputs below) and wait for "yes" / "go" / "approved" from the user. Then call this tool again — the gate will recognize the confirmation.`,
          redacted_inputs: redacted,
        },
        blocked: { reason: 'high_needs_yes', risk: 'HIGH' },
        audit_id: auditPending.id,
      };
    }
  } else if (risk === RISK.CRITICAL) {
    const requiredToken = tool.criticalToken ? tool.criticalToken(args ?? {}) : null;
    if (!requiredToken) {
      return {
        tool_result: { error: 'CRITICAL action lacks a required-token target.' },
        blocked: null,
        audit_id: null,
      };
    }
    if (hasCriticalApproval(ctx.messages, requiredToken)) {
      approvalStatus = 'approved';
    } else {
      const auditPending = await startAudit({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        toolName: name,
        riskLevel: risk,
        inputs: args,
        approvalStatus: 'pending',
        approverUserId: ctx.userId,
      });
      return {
        tool_result: {
          blocked: true,
          reason: 'CRITICAL action requires typed confirmation matching a specific token.',
          required_token: requiredToken,
          instruction: `BLOCKED: state the action, state its irreversibility, and require the user to type "${requiredToken}" along with their approval. Then retry this tool call.`,
          redacted_inputs: redacted,
        },
        blocked: { reason: 'critical_needs_typed_token', risk: 'CRITICAL', required_token: requiredToken },
        audit_id: auditPending.id,
      };
    }
  }

  // Audit (pre-execution).
  const audit = await startAudit({
    userId: ctx.userId,
    conversationId: ctx.conversationId,
    toolName: name,
    riskLevel: risk,
    inputs: args,
    approvalStatus: approvalStatus === 'autonomous' ? 'autonomous' : 'pending',
    approverUserId: ctx.userId,
  });

  // Execute.
  let result;
  try {
    result = await tool.execute(args ?? {}, {
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      callerToken: ctx.callerToken,
      internalBaseUrl: ctx.internalBaseUrl,
    });
  } catch (e) {
    result = { error: e?.message ?? String(e) };
  }

  const outputsSummary = result?.summary ?? (result?.error ? `error: ${result.error.slice(0, 200)}` : `${name} completed`);
  const finalStatus = result?.error ? 'error' : approvalStatus;
  await finishAudit({ auditId: audit.id, outputsSummary, approvalStatus: finalStatus });

  return {
    tool_result: result,
    audit_id: audit.id,
    blocked: null,
    risk_level: risk,
    approval_status: finalStatus,
  };
}

export { RISK };
