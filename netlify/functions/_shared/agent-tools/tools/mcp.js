// mcp_call — proxy to a connected MCP server.
//
// Phase 1 implementation:
//   We read from agent_mcp_credentials (per-owner encrypted credentials) for
//   the server name. If the server isn't registered, we fall back to reading
//   ~/.config/cowork/mcp-registry.json on the host (only works in local dev).
//
//   The risk level is inherited from the underlying tool, looked up in a
//   static map. Tools we don't recognize default to MEDIUM.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getAdminClient } from '../../supabase-admin.js';
import { decryptByoKey } from '../../byo-crypto.js';
import { RISK } from '../risk.js';

const HOME = process.env.HOME ?? '/Users/percystewart';
const COWORK_REGISTRY = `${HOME}/.config/cowork/mcp-registry.json`;

// Static risk inheritance map. Phase 1: tightly scoped, expanded in Phase 2.
const MCP_TOOL_RISK = {
  'slack/send_message': RISK.HIGH,
  'slack/post': RISK.HIGH,
  'slack/post_message': RISK.HIGH,
  'slack/list_channels': RISK.LOW,
  'slack/read_messages': RISK.LOW,
  'manychat/send_message': RISK.HIGH,
  'manychat/send_broadcast': RISK.CRITICAL,
  'notion/get_page': RISK.LOW,
  'notion/list_pages': RISK.LOW,
  'notion/create_page': RISK.MEDIUM,
  'notion/update_page': RISK.HIGH,
  'stripe/list_customers': RISK.LOW,
  'stripe/list_subscriptions': RISK.LOW,
  'stripe/create_customer': RISK.HIGH,
  'stripe/update_customer': RISK.HIGH,
  'stripe/cancel_subscription': RISK.CRITICAL,
  'github/list_pulls': RISK.LOW,
  'github/create_issue': RISK.MEDIUM,
  'github/comment_on_pr': RISK.MEDIUM,
};

function inheritRisk(server, tool) {
  const key = `${server}/${tool}`;
  if (MCP_TOOL_RISK[key]) return MCP_TOOL_RISK[key];
  // Conservative defaults by tool name semantic.
  if (/send|post|create|update|delete|cancel|broadcast/i.test(tool)) return RISK.HIGH;
  if (/read|get|list|fetch|search|find/i.test(tool)) return RISK.LOW;
  return RISK.MEDIUM;
}

async function loadServerConfig(userId, server) {
  // 1. Try the database.
  try {
    const admin = getAdminClient();
    const { data } = await admin
      .from('agent_mcp_credentials')
      .select('credentials_encrypted, config_json, enabled')
      .eq('user_id', userId)
      .eq('server_name', server)
      .maybeSingle();
    if (data?.enabled) {
      let credentials = null;
      if (data.credentials_encrypted) {
        try {
          credentials = decryptByoKey(data.credentials_encrypted);
        } catch {
          // Decryption failed — fall through.
        }
      }
      return { config: data.config_json ?? {}, credentials, source: 'db' };
    }
  } catch {
    // Fall through.
  }
  // 2. Fall back to local registry file (dev only).
  try {
    const raw = await readFile(resolve(COWORK_REGISTRY), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.servers?.[server]) {
      return { config: parsed.servers[server], credentials: null, source: 'file' };
    }
  } catch {
    // No registry file.
  }
  return null;
}

export const mcp_call = {
  name: 'mcp_call',
  description:
    'Proxy a call to a connected MCP server (slack, notion, stripe, etc.). Risk inherits from the underlying ' +
    'tool — read operations are autonomous, write operations require confirmation. The server config is read from ' +
    'agent_mcp_credentials (encrypted at rest) and falls back to ~/.config/cowork/mcp-registry.json for local dev.',
  risk: RISK.MEDIUM, // Default — actual risk is computed per-call via inheritRisk.
  approval: 'medium',
  input_schema: {
    type: 'object',
    properties: {
      server: { type: 'string', description: 'MCP server name (e.g. "slack", "notion", "stripe").' },
      tool: { type: 'string', description: 'Tool name on the server (e.g. "send_message").' },
      params: { type: 'object', description: 'Parameters to pass to the tool.' },
    },
    required: ['server', 'tool'],
  },
  computeRisk({ server, tool }) {
    return inheritRisk(server, tool);
  },
  async execute({ server, tool, params = {} }, { userId } = {}) {
    if (!server || !tool) return { error: 'server and tool required' };
    const config = await loadServerConfig(userId, server);
    if (!config) {
      return {
        error: `MCP server "${server}" not registered. Configure it in agent_mcp_credentials or ${COWORK_REGISTRY}.`,
        risk_level: inheritRisk(server, tool),
      };
    }
    // Phase 1: we don't actually execute the underlying MCP RPC here. That
    // requires an MCP client (websocket/stdio) which the Netlify runtime
    // doesn't have wired up. Return a structured "configured but no transport"
    // result with the resolved risk + the params we would have sent. This is
    // enough for the agent to surface the planned call to Percy and to
    // continue to act on his behalf via the host Cowork session if needed.
    return {
      executed: false,
      reason: 'MCP transport not implemented in Phase 1. Configuration resolved successfully.',
      server,
      tool,
      params,
      config_source: config.source,
      has_credentials: !!config.credentials,
      risk_level: inheritRisk(server, tool),
      summary: `MCP call resolved for ${server}/${tool} (risk: ${inheritRisk(server, tool)}) — Phase 1 stub, transport pending.`,
    };
  },
};
