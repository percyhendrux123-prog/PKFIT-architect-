# THE GROK WORKFLOW — v1

The workflow exists because of one verified constraint: **xAI ships no public API for
creating or configuring agents, projects, automations, or skills.** Configuration is
UI-only. So the repo cannot push config to Grok — it can only hold the canonical
artifacts and hand them to something with a mouse.

That shapes everything below.

---

## The five layers

```
LAYER 0   REPO — this directory, on branch claude/grok-bots-agent-inventory-iq0386
              The only source of truth. Nothing is authored inside Grok.
                              │
                              ▼
LAYER 1   SKILLS — grok.com/skills — 3 uploaded zips
              pkfit-voice · pkfit-stack · pkfit-design
              Portable, versioned, attachable. This is Grok's only real memory.
                              │
                              ▼
LAYER 2   PROJECTS — grok.com/projects — 3 workspaces
              PKFIT MEDIA · PKFIT SALES · PKFIT DESIGN
              Project Instructions + Project Sources (the .md files) + Skills attached.
                              │
                              ▼
LAYER 3   AGENTS — Settings → Customize — 4 slots, highest-frequency roles only
              Signal Scout · Reply Operator · The Interrogator · Plate
              The other five bots run as Project chats, not agent slots.
                              │
                              ▼
LAYER 4   AUTOMATIONS — grok.com/automations — scheduled runs bound to a Project
              One trigger each. Output lands in the Project, not in the operator's inbox.
                              │
                              ▼
LAYER 5   THE HUMAN GATE — nothing publishes itself
              Cut, approve, press publish. Every time. No exceptions.
```

## Why this shape

| Constraint (verified) | Consequence in the workflow |
|---|---|
| No config API | The repo holds artifacts; a desktop-control agent installs them. See `handoff/` |
| Skills are portable `SKILL.md` zips | Context lives in `skills/` under version control, not in a paste-block that drifts |
| Custom Agents have no tools, no files, no model choice | Agent slots get the four roles that need only a persona. Everything needing files or search runs inside a Project |
| Only ~4 agent slots | Five of the nine bots deliberately run as Project chats |
| One trigger per automation | Chain by writing into a shared Project, never by multi-triggering |
| Instruction edits do not affect existing conversations | **After any prompt change, start a new chat.** This is the single most common way the system silently runs stale |
| Grok holds no memory | `phrase-bank.md` is the compounding asset. It lives in the repo and is re-attached, not remembered |
| No scheduled posting to X | Publishing stays human, permanently. Layer 5 is not a temporary limitation |

## The nine bots and where each one lives

| # | Bot | Lane | Runs as | Cadence |
|---|-----|------|---------|---------|
| 01 | Signal Scout | Media | **Agent slot** + Automation | Daily 07:00 |
| 02 | Reply Operator | Media | **Agent slot** + Automation | Daily 07:15 |
| 03 | Frame Room | Media | Project chat (PKFIT DESIGN) | Twice weekly |
| 04 | Loop Archivist | Media | Automation (PKFIT MEDIA) | Weekly, Sunday |
| 05 | The Forge | Sales | Project chat (PKFIT SALES) | On demand |
| 06 | The Interrogator | Sales | **Agent slot** | Before every ship |
| 07 | The Listener | Sales | Automation (PKFIT SALES) | Weekly |
| 08 | Plate | Design | **Agent slot** | On demand, batched Sunday |
| 09 | Caliper | Design | Project chat (PKFIT DESIGN) | Every deploy |

## The weekly loop

**Daily, automated.** Signal Scout runs at 07:00 into PKFIT MEDIA. Reply Operator runs
at 07:15 against the scout's output. The operator opens the project at 07:20, cuts at
least three of thirteen drafts, and posts the rest across the day.

**Twice weekly.** Frame Room turns a `content/` script into slides and clips. The
operator approves per asset and rejects outright on any off-palette color rather than
asking for a fix.

**Weekly, Sunday.** The Listener appends verbatim audience language to `phrase-bank.md`.
Loop Archivist takes the top three posts *by link clicks — not by likes* and expands the
strongest into next week's carousel and reel.

**Per ship.** The Interrogator attacks the copy until it breaks. Every `UNHANDLED` tag
is a required edit. Caliper audits the deploy; every `BLOCKER` gates it.

Total human time: under four hours a week. The human does three things — cuts bad
drafts, presses publish, and answers real humans in comments by hand.

## The sync loop — keeping Grok current with the repo

Grok goes stale silently. This is the maintenance contract:

1. **Edit in the repo.** Never edit a system prompt inside Grok's UI. If you do, the
   repo is no longer the source of truth and the next install overwrites your work.
2. **Bump and rebuild.** Change the artifact, then run `skills/build.sh`.
3. **Re-upload the changed skill** at `grok.com/skills`.
4. **Re-upload changed Project Sources** for any project that carries the file directly.
5. **Start new chats.** Existing conversations keep the old instructions. This step is
   not optional and it is the one everyone skips.
6. **Log it** in `handoff/INSTALL_LOG.md` — what changed, which surfaces were touched,
   which conversations were retired.

**Trigger for a full re-sync:** any change to the offer ladder, a checkout URL, the
voice contract, the ethical floor, or the design tokens. Cosmetic edits to a single
bot's prompt need only that bot's surface touched.

**Re-verify `04_GROK_CAPABILITY_MAP.md` before every install run.** xAI ships fast. UI
labels, field limits, and slot counts in that file were captured on 2026-08-23 and will
drift.

## What this workflow deliberately does not do

- **No bot touches money.** Stripe, Gumroad, and Trainerize stay manual.
- **No bot posts.** There is no scheduled X posting from grok.com, and even if there
  were, publishing stays human.
- **No credentials in `/workspace`.** Grok Bot's cloud VM is shared across all Bots on
  the account and is not a security boundary.
- **No building on private endpoints.** `/rest/workspaces` and friends are undocumented
  and unsupported.
- **No cross-contamination with Axiom.** `pkfit-execution` is a different business.
  Its glassmorphism language and its lead data never enter a PKFIT bot.
