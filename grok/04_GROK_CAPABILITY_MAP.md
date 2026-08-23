# GROK CAPABILITY MAP — verified 2026-08-23

> Source: xAI official docs (`docs.x.ai`), Cursor's help pages, and string extraction
> from live `grok.com` production JS bundles. Claims that could not be verified are
> marked **[UNVERIFIED]**. Re-verify before any install run — xAI ships fast.
>
> **Two different products.** **Part A** covers **grok.com** — Custom Agents, Projects,
> Automations. **Part B** covers **Grok Bot**, the standalone desktop/iOS agent app.
> **Grok Bot is the chosen install target.** They share almost no configuration surface.
>
> ---
>
> # PART A — grok.com (secondary surface)

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


---

# PART B — GROK BOT (the chosen target)

The standalone desktop and iOS agent product. **Auth is a Cursor account**, not an xAI,
X, or Google login.

## B1. What it is

A managed **Linux VM, one per member**, with a **browser, filesystem, and terminal**. The
Bot runs as non-root. Bots do work in real tools rather than producing chat drafts.

## B2. Creating a Bot

1. Sidebar → **New** (`Cmd/Ctrl+N`)
2. **New chat** → **Create new agent**. A Bot named *New Agent* is created and opened
3. **Bot actions → Edit Profile** → **name, title, description, avatar**
4. Later edits: **View conversation details → Agent settings**

**There is no separate system-prompt, instructions, or personality field. The
`description` IS the standing-instruction field.** The docs are explicit: *"Use the
description for rules that should remain true… Use the conversation for task-specific
instructions"*, and *"Put explicit safety boundaries in the Bot description."*

**No character limit is published — [UNVERIFIED].** Read the live field.

⚠️ **Conflict:** Cursor's help page describes the creation fields as *"name, shape,
color, and title"*, while xAI's docs say *"name, title, description, avatar"*. A UI
version discrepancy. **Read the live dialog.**

Other controls: Pin, Hide from sidebar, **Duplicate** (copies profile, settings, enabled
skills, routines, avatar — **not** history, memory, or attachments), Delete.
**Sidebar Sections** group Bots by project (v1.2.0+).

**Cap: 50 Bots and group chats combined, per account.**

## B3. Skills

| Aspect | Behavior |
|---|---|
| Create | Conversationally — *"Save the process we just used as a skill called X"* — or via teach-by-demo |
| Install | **Settings → Plugins → Marketplace**. **Settings → Plugins → Yours** lists installed plugins and private skills |
| Scope | Connectors are **account-wide**; private skills are **enabled per Bot** |
| Invoke | `/` for skills, `@` for Bots, groups, routines, connectors |
| Format | **No zip or `SKILL.md` upload path is documented — [UNVERIFIED].** Cursor's separate Agent Skills standard uses a folder plus `SKILL.md` frontmatter, but that is the IDE's filesystem loader, not Grok Bot's cloud installer |

**This is why the PKFIT context pack ships as files in `/workspace/pkfit/` rather than as
uploaded skills.** The `skills/` directory in this repo targets grok.com; `workspace/`
targets Grok Bot, and `workspace/build.py` generates one from the other.

## B4. Routines

Created **conversationally**. You ask the owning Bot in natural language. **There is no
cron field and no create-routine form.**

| Item | Detail |
|---|---|
| Instruction | The natural-language spec you gave the Bot. Editable later |
| Schedule | Natural language, resolved against **Settings → General → Agent → Timezone**. No cron syntax |
| Event triggers | Yes, via **Cursor account integrations** (Slack message, GitHub notification). Separate connection flow from the plugins |
| Test | **Test run performs real work** — navigates sites, changes files, calls tools |
| Manage | **View conversation details → Routines** — enable, pause, test, edit, inspect history, delete (immediate, no undo) |
| Limits | **50 routines per Bot**, **20 run records retained**. Deleting a Bot deletes its routines |
| Idle | Grok Bot may ask whether to keep routines running after a long absence, and **pause them if there is no response** |
| iOS | View and Active toggle only. Editing, history, testing, deleting are desktop-only |

## B5. Teach-by-demonstration

Desktop only, gradual rollout — the control may be absent. Open a 1:1 conversation, go to
the **computer view → Teach a task**, describe the intended result, perform the browser
workflow once, stop, review.

Produces a **draft skill** (not a routine). Records up to **10 minutes** of visible
computer interaction, no microphone audio. **The output is editable** — the docs call it
a draft and instruct you to add decision rules, failure handling, and approval boundaries
before scheduling it. Not on iPhone.

## B6. The shared computer and `/workspace`

- **All Bots share one VM. Confirmed repeatedly as NOT a security boundary** — shared
  browser cookies and sessions, shared files, shared command-line credentials. Each Bot
  gets its own **screen** for parallel work: *"separate work surfaces, not separate
  security boundaries."*
- **Convention:** durable files in **`/workspace`**, in project folders. Bots read each
  other's files. No per-Bot directory convention is documented — [UNVERIFIED]
- **Persistence:** files, browser state, and supported sign-ins survive normal updates
  and recovery. **Temp directories, manually installed packages, and uncommitted app
  state are explicitly "replaceable"** — a Bot can install software, but it may not
  survive
- **Network:** internet via **static egress IPs**. Some sites block datacenter IPs
- **Lifecycle:** Settings → Beta → Update / Recover / **Reset**. Reset restores the last
  snapshot and **can lose unsynced work**. Org admins can kill a member's VM

## B7. Browser and account access — the decisive fact

**A Grok Bot can sign in to websites in the shared browser and act as the user.** The
docs say Bots *"can sign and use apps and websites just like you do"* and *"browser
sessions persist so you usually do not need to sign in for each task."*

**The gates are policy, not capability:**

| Gate | Behavior |
|---|---|
| Human-only steps | Passwords, passkeys, 2FA, CAPTCHAs, payment and identity checks trigger **computer takeover** — the human takes control, completes it, returns control |
| Per-action approval | Approval card with the proposed operation. Desktop: Allow once / Deny / **Always allow**. iOS: Approve once / Deny |
| Auto-review rules | **Settings → General → Auto-review**. **Require Approval** rules always stop matching actions; **Always Allow** rules let them through. **Require wins over Allow.** Rules are stored **per desktop** and sync only to that desktop's agent computer — **not account-wide** |
| Bot description | Standing boundaries, e.g. "Never send external messages without approval" |
| Local machine | **Settings → General → Agent → Execution on Local Computer** — Always require approval / Always allowed / Never allowed. Default is ask every time |

The docs name *publishing content*, *sending messages*, *purchases*, *deletions*, and
*production changes* as things you **should** gate — which confirms they are otherwise
possible.

**So "nothing publishes itself" is a configuration choice here, not a product limit.**
The PKFIT workforce keeps the human gate deliberately. See `../WORKFLOW.md`.

Posting to X or Instagram specifically is not named in the docs — [UNVERIFIED] for those
sites, and their anti-automation measures and terms may block it regardless.

## B8. Notifications and results

- **Per-Bot Notifications** switch in Agent settings — OS or mobile notification when
  that Bot finishes or needs input. **Group chats have no per-Bot switch.** Suppressed
  while the app is focused. iOS push is still rolling out
- **Attention states** in the Bot list: *Needs attention*, *Unread activity*, working
- **Errors** appear above the composer, some with **Copy request ID**
- **Files and results** are deliverables in the conversation as preview cards, plus
  durable files in `/workspace`. **6 attachments per message. 25 MB documents, images,
  and audio. 200 MB video.** **No email delivery of results is documented — [UNVERIFIED]**

## B9. Access, cost, platform

- **macOS** (Apple silicon and Intel), **Windows** (x64 and Arm64), **iPhone iOS 18+**.
  No Linux desktop, no Android, no iPad. The VMs run Linux; the app does not
- **Eligible plans:** SuperGrok Plus, SuperGrok Heavy, Cursor Pro+, Cursor Ultra, Cursor
  Teams Standard/Premium, or a one-time trial. **Not included:** plain Cursor Pro, basic
  SuperGrok, SuperGrok Team/Enterprise. A SuperGrok link is a permanent, non-transferable
  usage grant on that Cursor account
- **Legacy Privacy Mode blocks Grok Bot entirely**, at account and team level
- **Metering** is on the **Cursor account**, weekly included usage, macOS and iOS share
  one bucket. The trial is a usage credit over 7 days, not a message count. No Grok
  Bot-specific spend cap yet
- **No model picker for members or admins, "and we do not plan to allow" one.** ⚠️ The
  settings docs list a **Default Model** *"when model selection is available"* — treat as
  rollout-dependent and do not depend on it

## B10. Group chats

**New → New chat → select two to six Bots.** Bots post into the group, decide who
responds, and pass work among themselves. `@Name` addresses one, `@everyone` addresses
all. Bots can also DM each other asynchronously.

Caveats: **max 6 Bots per group**, groups **count against the 50 cap**, Bot-to-group
handoff messages are **text-only** (a Bot must DM an image directly), and there is no
per-Bot notification switch. The docs warn that too many parallel handoffs cause
duplicate work — **assign one owner per stage.**

## B11. Import, export, programmatic config

**None.** No API, CLI, config file, or import/export for Bots, skills, or routines.
Everything is created through the desktop UI or by conversation with a Bot.

The nearest things to portability are **Duplicate a Bot** and **Marketplace** installs.
Admin-side leverage exists but is not bot config: Team Setup install scripts, team rules,
auto-review instructions, MCP allow and deny lists.

**A desktop-control agent is required.**

## B12. Delta from Part A — what differs

| Area | grok.com | Grok Bot |
|---|---|---|
| Account | xAI / X / Google | **Cursor account** |
| Persona config | Separate **Instructions** field, slot library, personality presets | **`description` only.** No presets, no slots |
| Cap | ~4 agent slots [UNVERIFIED] | **50 Bots and group chats** |
| Scheduling | Automations form, one trigger, webhook with signing secret | **Routines**, conversational, per-Bot (50). No webhook documented |
| Context store | **Projects** — instructions, sources, starters, sharing | **No Projects.** `/workspace` folders and Sidebar Sections |
| Model | Fast / Expert / Heavy plus overrides | **No model picker, by design** |
| Files | 150 MB per file, ~100 files | **25 MB (200 MB video), 6 per message** |
| Real-world action | Chat and connectors only | **Browser, shell, and logged-in sessions, approval-gated** |
| Skills | `SKILL.md` archive upload, share, publish | Conversational and Marketplace. **No documented upload format** |
