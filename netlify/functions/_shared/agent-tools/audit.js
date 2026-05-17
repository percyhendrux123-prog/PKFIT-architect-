// Audit logger for the owner agentic surface. Writes to public.agent_actions.
//
// Logging discipline:
//   - Logged BEFORE execution (status='pending'), so a mid-flight failure
//     is still captured. Status is updated after the tool returns.
//   - Inputs are redacted by the caller (see redact.js) — this module assumes
//     inputs_redacted is already safe.
//   - outputs_summary is a one-line plain-English summary, never row contents.

import { getAdminClient } from '../supabase-admin.js';
import { redactInputs } from './redact.js';

// Insert a pending audit row before execution. Returns the row id so the
// caller can finalize it.
export async function startAudit({
  userId,
  conversationId,
  toolName,
  riskLevel,
  inputs,
  approvalStatus,
  approverUserId,
}) {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('agent_actions')
      .insert({
        user_id: userId,
        conversation_id: conversationId ?? null,
        tool_name: toolName,
        risk_level: riskLevel,
        inputs_redacted: redactInputs(inputs ?? {}),
        approval_status: approvalStatus ?? 'pending',
        approver_user_id: approverUserId ?? null,
      })
      .select('id')
      .maybeSingle();
    if (error) return { id: null, error: error.message };
    return { id: data?.id ?? null, error: null };
  } catch (e) {
    return { id: null, error: e?.message ?? String(e) };
  }
}

// Finalize an audit row after execution. Records the outputs summary and the
// final status (autonomous, approved, denied, auto_batch, error).
export async function finishAudit({ auditId, outputsSummary, approvalStatus }) {
  if (!auditId) return;
  try {
    const admin = getAdminClient();
    await admin
      .from('agent_actions')
      .update({
        outputs_summary: outputsSummary ? String(outputsSummary).slice(0, 2000) : null,
        approval_status: approvalStatus,
      })
      .eq('id', auditId);
  } catch {
    // Audit failure is non-blocking — the user still sees the tool result.
  }
}
