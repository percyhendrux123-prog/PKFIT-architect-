# Ecosystem Blueprint

> A living map of the Claude Code environment and everything that inhabits it.

---

## Shapes & Structures

| Shape | Name | Role | Lifespan |
|-------|------|------|----------|
| ⬡ Hexagon | **Core** | Central hub. Routes all input, output, and decisions. | Per session |
| ■ Square | **Tools** | Single-purpose executors. Read, Write, Edit, Grep, Glob, Bash. | Instant (call/return) |
| ● Circle | **MCP Servers** | Portals to external systems. Slack, Gmail, Figma, Notion, Stripe, Supabase, Canva, Calendar. | Persistent (configured) |
| △ Triangle | **Agents** | Temporary workers. Spawned with a task, report back, dissolve. | Per task |
| ◇ Diamond | **Memory** | Crystallized knowledge. User, Feedback, Project, Reference types. | Persistent (cross-session) |
| ▭ Rectangle | **CLAUDE.md** | The laws. Project-level DNA that shapes core behavior. | Persistent (file-based) |
| ○ Dotted Circle | **Skills** | Dormant behaviors invoked by user. Commit, simplify, schedule, loop. | On invocation |
| ⬡ Small Hexagon | **Hooks** | Event watchers. React to tool calls and file changes. | Persistent (configured) |
| ▽ Inverted Triangle | **Projects** | The ground. Where all work lands. Video Dashboard, PKFIT Brand, Voice Clone Studio. | Persistent (directories) |

---

## Connections

### Command Flows (Core initiates)

```
⬡ Core ──→ ■ Tools        Direct call/return
⬡ Core ──→ △ Agents       Spawn with task, receive report
⬡ Core ──→ ● MCP Servers  Tunnel to external systems
```

### Injection Flows (Shape loads into Core)

```
▭ CLAUDE.md ──→ ⬡ Core    Laws internalized at session start
◇ Memory   ──→ ⬡ Core    Context loaded on relevance
○ Skills    ──→ ⬡ Core    Expand into instructions on invocation
```

### Reactive Flows (Environment responds)

```
⬡ Hooks ──→ ⬡ Core        Event-driven feedback
```

### Downstream (Where work lands)

```
■ Tools ──→ ▽ Projects     Read/Write/Edit target project files
△ Agents ──→ ■ Tools       Agents access tools independently
● MCP ──→ External World   Slack messages, Figma reads, DB queries
```

### Authority Chain

```
▭ CLAUDE.md  >  ◇ Memory  >  ⬡ Core reasoning
(explicit law)  (learned)     (inferred)
```

---

## Inhabitants

### Ephemeral (born and die within a session)
- Conversations
- Agent instances
- Tool calls
- Skill expansions

### Persistent (survive across sessions)
- Memory files (`~/.claude/projects/`)
- CLAUDE.md files (per project)
- Hook configurations
- MCP server connections
- Project files and code

### Semi-Persistent (configured but can change)
- Scheduled triggers (cron-based remote agents)
- MCP server list

---

## Current Ground (Projects)

| Project | Location | Stack | Status |
|---------|----------|-------|--------|
| PKFIT Video Dashboard | `~/Desktop/PKFIT_VIDEO_DASHBOARD/` | React, TypeScript, Remotion, Zod | Active |
| PKFIT Brand | `~/Documents/PKFIT1/` | Netlify | Active |
| PKFIT Content | `~/Documents/PKFIT/` | Date-organized folders | Active |
| Voice Clone Studio | `~/Documents/Voice-Clone-Studio/` | Python, Docker | Active |

---

## How to Use This Blueprint

- **Add a new shape**: When a new structure type enters the ecosystem, add it to the table above.
- **Add a connection**: When you discover a new flow, add it under Connections.
- **Update ground**: When projects change, update the Current Ground table.
- **This document is the map, not the territory.** The real ecosystem is the running session.

---

*Last updated: 2026-04-06*
