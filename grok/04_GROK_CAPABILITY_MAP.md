# GROK CAPABILITY MAP — verified 2026-08-23

> Source: xAI official docs (`docs.x.ai`) plus string extraction from live `grok.com`
> production JS bundles. Claims that could not be verified are marked **[UNVERIFIED]**.
> Re-verify before any install run — xAI ships fast and this file goes stale.

## 1. The surfaces

| Surface | Where | Status |
|---------|-------|--------|
| **Custom Agents** (personas) | grok.com → Settings → Customize → Agent Library / Active Agents | Live |
| **Projects** (internally "workspaces") | `grok.com/projects` — Chat Project, Imagine Project | Live |
| **Automations** (formerly Tasks) | `grok.com/automations` (legacy `/tasks` still routes) | Live |
| **Skills** | `grok.com/skills` — SKILL.md archive upload, per-agent enable | Live |
| **Connectors / MCP** | `grok.com/connectors` | Live |
| **Grok Bot** | Separate desktop (macOS/Windows) + iOS agent product, Cursor-account auth | Live, distinct from grok.com |
| **Voice mode** | In-app — own instructions and personality | Live |
| **Grok Build** | Replaces Grok Studio, which is no longer supported | Live |
| **Companions** (Ani/Rudi/Mika/Valentine) | iOS only | Being retired. No shutdown date **[UNVERIFIED]** |
| **@grok on X** | X app/web. "Ask Grok" reported restricted to Premium tiers **[UNVERIFIED]** | Live |
| **Team Guardrails** | console.x.ai → Grok Business | Business/Enterprise only |

## 2. Configurable fields — exact UI labels

### Custom Agent
- **Name** (`Agent name`) — duplicate names rejected
- **Instructions** (`How should this agent behave?`) — textarea, minRows 5 / maxRows 10
- **Character limit is server-side remote config** (`max_custom_instructions_length`),
  not hardcoded. It varies per account and rollout. Blogs claim 4,000 and 12,000; both
  are **[UNVERIFIED]**. **Read the live counter, never assume.**
- Personality pills: Custom · Concise · Comprehensive · Formal · Socratic · Tutor
- Slot assign / Remove from Team. Slot count is server-driven; commonly 4 **[UNVERIFIED]**
- Standing warning in the UI: *"Changes will only apply to new conversations, not
  existing ones."*
- **Custom Agents have no model selection, no tool toggles, no file attachments, and no
  sharing of their own.** Those live on Projects and Automations.

### Project
- **Project name**, icon picker
- **Project Instructions** — described in-product as "tone, style, and persona"
- **Project Sources** — Add File / Folder / Google Drive / OneDrive / SharePoint / Box /
  **Collections** (Collections are API-manageable)
- Conversation starters
- Sharing: Team · Specific users · Specific emails · Anyone with link. Shares
  conversations, instructions, and files
- Clone / Rename / Leave / Delete. Read-only projects are clonable
- **Automations tab inside the project** — "Schedule recurring tasks that run in this project"

### Automation
- **Automation Name**, icon, **Instructions** (required, max-length enforced)
- **Triggers — exactly one per automation.** Schedule: Once / Hourly / Weekdays / Daily /
  Weekly / Monthly / Yearly, plus time, day, and hour-window. Or event: Gmail, Outlook,
  GitHub, Linear, Stripe, Plaid/Finance, **Webhook** (with rotatable signing secret)
- **Connectors** multi-select · **Skills** multi-select · **Project** binding · file uploads
- **Notification**: Email + App / Email only / App only / Off
- Pause / Resume / Run now / Runs history

### Grok Bot (desktop product) — official hard numbers
- 50 Bots + group chats per account · 50 routines per Bot · 20 run records retained
- 6 attachments per message · 25 MB docs/images/audio · 200 MB video
- Teach-by-demo recordings ≤ 10 minutes
- Editable: **Name, title, description, avatar** (Bot actions → Edit Profile),
  notifications, per-Bot skills, routines
- **All Bots share ONE cloud VM at `/workspace`. It is not a security boundary.**
- Deleting a Bot leaves its files and logins on the shared machine
- No Linux, no Android, no iPad. Requires cloud storage (Legacy Privacy Mode
  unsupported). Requires SuperGrok Plus/Heavy or a paid Cursor plan

## 3. Model and file limits

- **Context:** grok-4.6 = 500k · grok-4.3 / 4.20 = 1M · grok-build-0.1 = 256k
- **Knowledge cutoff: 2026-02-01.** Anything after that needs search or a pasted source
- Structured outputs supported via API
- **Files on grok.com:** ~100 files web / 20 Android · **150 MB per file** ·
  PDF, DOCX, XLSX, PPTX, CSV, MD, LaTeX, ODT, RTF, code · JPEG, PNG, WebP, HEIC, BMP ·
  MP3, WAV, M4A, OGG, FLAC, AAC · MP4, MOV
- **Usage since June 2026:** a single **weekly** pool, not per-product daily caps.
  Settings → Usage breaks it out by API / Build / Chat / Imagine / Voice. Extra Usage
  Credits are web-only, $5 minimum, expire in a year, with Auto Top Up
- Tiers in the live bundle: SuperGrok Lite · SuperGrok · SuperGrok Plus · SuperGrok
  Heavy (Heavy = "8 agents on Expert mode")
- Imagine: SuperGrok 720p/30s · Plus 1080p/30s. **Watermark cannot be removed.**
  Enabling NSFW does not disable moderation
- Per-tier message and image counts circulating on blogs (1,000/day etc.) are
  **[UNVERIFIED]** and contradict the current weekly-pool model

## 4. Hard limits that shape this workflow

1. **There is no public API to create or configure agents, projects, automations, or
   skills.** The REST reference covers inference, files/collections, and management
   (billing, auth, audit) only. **Configuration is UI-only — which is exactly why the
   desktop-control handoff in `handoff/` exists.**
2. grok.com does call private cookie-authed endpoints (`/rest/workspaces`,
   `/rest/automations`, `/rest/user-skills`, `/rest/automations/webhook/rotate-secret`).
   Undocumented, unsupported, no auth story. **Do not build on them.**
3. Agent instruction edits **do not affect existing conversations.** After any prompt
   change, start a new chat or the old instructions keep running.
4. Instruction character limits are server-side. Read the live counter.
5. **One trigger per automation.** One schedule. Chain by having automations write into
   a shared Project, not by multi-triggering.
6. No published mechanism for a grok.com bot to post to X on a schedule. Publishing
   stays human.

## 5. Programmatic routes that DO exist — and this workflow uses

| Route | What it buys us |
|-------|-----------------|
| **Skills as portable artifacts** — zip + `SKILL.md` with frontmatter, install via `/rest/skill-link/{token}/install`, share / publish / verified skills | The closest thing to import/export of bot config. **This is why the stack context lives in `skills/` as versioned SKILL.md files instead of a paste-block.** |
| **Collections API** — create collections, upload docs, embeddings and metadata, then attach as Project Sources | Repo markdown becomes searchable bot knowledge without manual re-upload |
| **Custom MCP connectors** — any public MCP URL | The supported way to give a bot outbound third-party reach |
| **Webhook automation trigger** with rotatable signing secret | Inbound programmatic trigger — a deploy or a Netlify hook can wake a bot |

## 6. What Grok bots are bad at — design around these

- **No memory across runs.** Nothing persists unless it is a Skill, a Project Source, or
  pasted into the thread.
- **No outbound integrations** except MCP connectors and the listed event triggers.
  A bot cannot touch Stripe, Gumroad, or an email tool on its own.
- **Voice drift.** Without an explicitly attached voice contract, output slides into
  hype, emoji, and exclamation points within a few turns.
- **Confident fabrication** of sources, engagement counts, and testimonials. Every bot
  prompt in `bots/` carries an explicit anti-fabrication clause for this reason.
- **The shared VM.** Grok Bot's `/workspace` is common to all Bots. Treat anything placed
  there as visible to every Bot on the account. No credentials, ever.
