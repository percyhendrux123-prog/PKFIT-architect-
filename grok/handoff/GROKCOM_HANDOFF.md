# HANDOFF — grok.com (NOT the chosen target)

> **STOP. Read this first.**
>
> The operator has chosen **Grok Bot**, the standalone desktop/iOS agent product, as
> the install target. **That handoff is `GROKBOT_HANDOFF.md`. Use that one.**
>
> This file targets **grok.com** — Custom Agents, Projects, and Automations. It is a
> different product with a different field set. It is kept because the artifacts in
> `../skills/` and `../bots/` are shared between both, and grok.com remains a valid
> secondary surface. **Do not install from this file unless explicitly told to.**

**For:** an agentic agent with desktop control (screen, keyboard, mouse).
**Goal:** install the PKFIT bot workforce into grok.com's settings.
**Why a desktop agent:** xAI publishes no API for creating or configuring agents,
projects, automations, or skills. Configuration is UI-only. Verified 2026-08-23 — see
`../04_GROK_CAPABILITY_MAP.md` §4.

You are configuring a bot workforce. You are not authoring it. Every value you type
comes from this repo. If a value you need is not in this repo, stop and ask.

---

## 0. Preconditions — the human does these, not you

| Step | Who | Note |
|------|-----|------|
| Log in to grok.com | **Human** | You never handle credentials, passwords, 2FA codes, or recovery keys |
| Confirm subscription tier | **Human** | Agent slots, Imagine resolution, and Grok Bot access are tier-gated |
| Confirm the machine is the operator's own | **Human** | |
| Run `../skills/build.sh` | Either | Produces `../skills/dist/*.zip` |
| Confirm `bot-configs.json` matches the repo | You | It is generated from the `bots/` files; if they disagree, the `bots/` files win |

**Hard stops. If any of these occurs, halt and report:**

- A login, password, 2FA, payment, or billing screen appears
- A confirmation dialog mentions deleting, leaving, or unsharing anything
- A field rejects the text you paste and you cannot see why
- The UI does not match `../04_GROK_CAPABILITY_MAP.md` §2 — labels or fields have moved
- Any screen asks you to publish, share publicly, or share to Team
- You are about to touch anything outside grok.com

**Never:** delete an existing agent, project, automation, or skill. Never overwrite one
whose name is not in `bot-configs.json`. Never enable public sharing. Never place
credentials in Grok Bot's `/workspace` — it is shared across every Bot on the account
and is not a security boundary.

---

## 1. Install order

Install bottom-up. Each layer depends on the one before it.

```
1. SKILLS      → 3 uploads
2. PROJECTS    → 3 workspaces, each with instructions + sources + skills
3. AGENTS      → 4 slots
4. AUTOMATIONS → 4 scheduled runs
5. VERIFY      → the checklist in §6
```

---

## 2. Layer 1 — Skills

Path: `grok.com/skills`

For each of the three zips in `../skills/dist/`:

1. Open `grok.com/skills`.
2. Upload the archive.
3. Confirm the skill's name renders as the `name:` value from its `SKILL.md`
   frontmatter — `pkfit-voice`, `pkfit-stack`, `pkfit-design`.
4. Record the resulting skill identifier in `INSTALL_LOG.md`.

If a skill with that exact name already exists, **update it rather than creating a
duplicate.** If the UI offers no update path, log it and ask the human before deleting.

---

## 3. Layer 2 — Projects

Path: `grok.com/projects` → Create Project → **Chat Project**

Create three. For each, from `bot-configs.json` → `projects[]`:

| Field | Source |
|-------|--------|
| Project name | `.name` |
| Project Instructions | `.instructions` |
| Project Sources | Upload each file in `.sources` from the repo |
| Skills | Enable each in `.skills` |
| Sharing | **Leave private. Do not share.** |

**Source-upload note:** grok.com accepts Markdown, up to 150 MB per file and roughly 100
files. Every path in `.sources` is a small `.md` file — well inside both limits.

---

## 4. Layer 3 — Agents

Path: `grok.com` → Settings → **Customize** → Agent Library / Active Agents

Four agents, from `bot-configs.json` → `agents[]`:

| Field | Source |
|-------|--------|
| Agent name | `.name` — duplicates are rejected, so check the library first |
| Personality preset | Select **Custom** |
| Instructions | `.instructions` — paste the full system prompt |
| Slot | Assign to an Active Agents slot |

**Critical — the character limit.** The instruction limit is server-side remote config,
not a fixed number. Published figures of 4,000 and 12,000 are unverified and conflict.

1. **Read the live character counter** in the UI before pasting.
2. If the full prompt does not fit, **do not paraphrase or summarize it.** Truncate from
   the bottom at a section boundary, log exactly what was dropped in `INSTALL_LOG.md`,
   and report it. Voice and prohibition clauses are load-bearing — they are never the
   part you cut.
3. If it still does not fit, move that bot from an agent slot to a Project chat and log
   the change.

**Also critical:** the UI warns that *"Changes will only apply to new conversations, not
existing ones."* After every agent install or edit, open a **new** chat to test. Testing
in an existing thread validates nothing.

Custom Agents have no model selection, no tool toggles, no file attachments, and no
sharing of their own. Do not go looking for those controls here — they live on Projects
and Automations.

---

## 5. Layer 4 — Automations

Path: `grok.com/automations` → New Automation

Four automations, from `bot-configs.json` → `automations[]`:

| Field | Source |
|-------|--------|
| Automation Name | `.name` |
| Instructions | `.instructions` |
| Trigger | `.trigger` — schedule type, time, and day. **Exactly one trigger per automation** |
| Project | `.project` — bind it |
| Skills | `.skills` |
| Connectors | **None.** Leave empty |
| Notification | `.notification` |

Times in `bot-configs.json` are local to the operator. **Confirm the account timezone in
Settings before setting any schedule**, and log which timezone you used.

Do **not** press "Run now" during install. The first live run should be observed by the
human.

---

## 6. Verification checklist

Do not report success until every line passes.

- [ ] Three skills appear at `grok.com/skills` with the correct names, no duplicates
- [ ] Three projects exist, each **private**, each with its instructions, sources, and skills
- [ ] Each project's source list matches `.sources` exactly — no missing file, no extra
- [ ] Four agents exist in Active Agents slots, each set to the **Custom** preset
- [ ] For each agent: open a **new** chat, send `Identify yourself and state your output format.` The reply names the correct bot and format
- [ ] No agent reply contains an emoji or an exclamation point. If one does, the instructions were truncated — go back to §4
- [ ] Four automations exist, each **paused or unrun**, each bound to the right project, each with exactly one trigger
- [ ] Automation schedule times match the confirmed account timezone
- [ ] Nothing is shared with Team, with specific users, or by link
- [ ] `INSTALL_LOG.md` records every identifier, every truncation, and the timezone used

---

## 7. Report back

Return, in this order:

1. **Installed** — each surface with the name and identifier it received
2. **Truncated** — any instruction text that did not fit, with the exact dropped
   sections quoted
3. **Deviated** — anywhere the live UI did not match `../04_GROK_CAPABILITY_MAP.md`,
   quoted precisely. This is the highest-value part of your report; it is how the
   capability map gets corrected
4. **Blocked** — anything you could not do, and the hard stop that stopped you
5. **Untested** — every automation, since none was run

Then hand control back. The human runs the first live automation and does the first
publish.

---

## 8. Out of scope for this handoff

- **Grok Bot** (the separate desktop/iOS product with its own Bots, routines, and shared
  cloud VM) is not configured here. If the operator wants the workforce there instead of
  on grok.com, that is a second handoff — the field set is different (Name, title,
  description, avatar, per-Bot skills, routines) and the shared-`/workspace` caveat
  applies.
- **MCP connectors.** The workflow deliberately grants no outbound reach in v1.
- **Anything touching Stripe, Gumroad, Trainerize, or email.** No bot touches money.
