# HANDOFF — GROK BOT DESKTOP

**For:** an agentic agent with desktop control (screen, keyboard, mouse).
**Goal:** install the PKFIT nine-bot workforce into the **Grok Bot** desktop app.
**Target:** Grok Bot, the standalone desktop/iOS agent product — **not** grok.com.
That surface is `GROKCOM_HANDOFF.md` and is secondary.

**Read `../04_GROK_CAPABILITY_MAP.md` §B before starting.** It was verified 2026-08-23
and xAI ships fast.

---

## 0. What makes this install unusual

Grok Bot has **no forms for most of what you are installing.**

- There is **no system-prompt field.** A Bot's `description` *is* its standing
  instruction. The published character limit is unknown.
- **Routines are created by conversation**, not by a form. You type a sentence to the
  Bot and it builds the routine.
- There is **no documented `SKILL.md` upload path.** The context pack ships as **files
  on the agent computer** instead.

So most of your work is **typing messages to Bots**, not filling in fields. Where this
guide gives you an exact message, send it verbatim — the wording carries the config.

---

## 1. Preconditions — the human does these

| Step | Who | Note |
|---|---|---|
| Install and sign in to Grok Bot | **Human** | Auth is a **Cursor account**, not an xAI or X login. You never handle credentials, passwords, 2FA, or passkeys |
| Confirm an eligible plan | **Human** | SuperGrok Plus, SuperGrok Heavy, Cursor Pro+, Cursor Ultra, or Cursor Teams Standard/Premium. Plain Cursor Pro and basic SuperGrok do **not** qualify |
| Confirm Legacy Privacy Mode is **off** | **Human** | It blocks Grok Bot entirely, at account and team level |
| Confirm the timezone | **Human** | Settings → General → Agent → Timezone. Routines resolve against it. **Record the value** |
| Run `python3 ../workspace/build.py` | Either | Produces `../workspace/dist/pkfit/` — 17 files, ~66 KB |
| Confirm `bot-configs.json` is current | You | Regenerate with `python3 build-configs.py` if the `bots/` files are newer |

### Hard stops — halt and report

- Any login, password, 2FA, passkey, CAPTCHA, payment, or identity screen
- A **computer takeover** prompt — that is the human's job by design, not yours
- Any prompt to sign in to X, Instagram, Gumroad, Stripe, Trainerize, or any PKFIT
  account. **No part of this install requires signing in to anything**
- A confirmation dialog mentioning delete, reset, or kill
- The UI not matching `../04_GROK_CAPABILITY_MAP.md` §B
- Anything asking to spend money or enable on-demand spend

### Never

- Never create an **Always allow** auto-review rule. Only **Require Approval** rules.
- Never sign a Bot in to any website.
- Never place a credential, API key, token, or client personal data anywhere under
  `/workspace`. **Every Bot on the account shares that computer and it is not a security
  boundary** — shared browser cookies, shared files, shared command-line credentials.
- Never use **Reset Agent Computer**. It can lose unsynced work.
- Never delete an existing Bot, routine, or skill.

---

## 2. Install order

```
1. GUARDRAILS  → auto-review rules FIRST, before any Bot exists
2. WORKSPACE   → copy the context pack to /workspace/pkfit
3. BOTS        → nine Bots, charter into description
4. SECTIONS    → group the sidebar by lane
5. ROUTINES    → four, created conversationally
6. VERIFY      → §8
```

**Guardrails go first.** A Bot created before the rules exist could act unguarded in the
window between.

---

## 3. Layer 1 — Guardrails

**Settings → General → Auto-review.**

Create **Require Approval** rules covering, at minimum:

- Publishing or posting content to any website or social platform
- Sending any message, email, or DM
- Signing in to any website or service
- Any purchase, payment, or checkout
- Deleting files or making changes outside `/workspace/pkfit/out/`

Then **Settings → General → Agent → Execution on Local Computer** → set to
**Always require approval**.

Two facts to record in `INSTALL_LOG.md`:

1. **Require Approval beats Always Allow** when rules conflict. Rely on that ordering.
2. **Auto-review rules are stored per desktop and sync only to that desktop's agent
   computer.** They are **not** an account-wide policy. If the operator uses a second
   machine, the rules must be recreated there. Say this explicitly in your report.

---

## 4. Layer 2 — The workspace payload

The Bots read their briefs from the agent computer. Get the files there first.

1. Open the **Agent Computer** view.
2. Create `/workspace/pkfit/`.
3. Copy the contents of `../workspace/dist/pkfit/` into it, preserving the `bots/` and
   `out/` subdirectories.
4. Verify `/workspace/pkfit/README.md` and `/workspace/pkfit/bots/01-signal-scout.md`
   both read back correctly.

**Attachment limits if you upload through a conversation:** 6 files per message, 25 MB
per document. The whole payload is ~66 KB, so size is not a constraint — the file count
is. Split across messages, or have a Bot write the files directly.

Do **not** edit these files on the agent computer afterwards. They are generated from
the repo, and the next sync overwrites them.

---

## 5. Layer 3 — The nine Bots

From `bot-configs.json` → `grok_bot.bots[]`. Cap is 50 Bots and group chats combined,
so all nine fit comfortably.

**For each Bot:**

1. Sidebar → **New** (or `Cmd/Ctrl+N`) → **Create new agent**. A Bot named
   *New Agent* is created and opened.
2. **Bot actions → Edit Profile.**
3. Set **Name** = `.name`, **Title** = `.title`, **Description** = `.description`
   (the charter, verbatim). Avatar is the operator's choice — skip it.
4. Enable **Notifications** for the Bot.

**On the description field — the critical step.** It is the only standing-instruction
field this product has, and its limit is unpublished.

- **Read the live field.** If it truncates or rejects, note the observed limit exactly
  and report it. That number is the single most valuable thing in your report.
- **Never paraphrase or summarize a charter to make it fit.** If it does not fit, cut
  from the bottom at a paragraph boundary and log precisely what was dropped. The voice
  rules and the "never publish" clause are load-bearing and are never what you cut.
- Every charter is under 1,030 characters, so truncation is unlikely.

**Cursor's help page describes the creation dialog as "name, shape, color, and title",
which conflicts with the xAI docs' "name, title, description, avatar".** This is a
version discrepancy. **Read the live dialog** and, if there is no description field at
creation, set it afterwards via Edit Profile or **View conversation details → Agent
settings**. Report which one you saw.

---

## 6. Layer 4 — Sidebar sections

Group the sidebar by lane using `.sidebar_section`: **PKFIT Media** (Bots 01–04),
**PKFIT Sales** (05–07), **PKFIT Design** (08–09).

Cosmetic, but nine Bots in a flat list is unusable. Requires app v1.2.0 or later; skip
and log if the control is absent.

---

## 7. Layer 5 — Routines

Four Bots get a routine. There is **no cron field and no create-routine form** — you
open a conversation with the owning Bot and send the message.

For each entry in `grok_bot.bots[]` that has a non-null `routine_message`:

1. Open a 1:1 conversation with that Bot.
2. Send `.routine_message` **verbatim**.
3. The Bot builds the routine and reports its next run. **Record that next-run time** —
   it confirms the timezone resolved correctly.
4. **Do not use Test run.** It performs real work — navigating sites, changing files,
   calling tools. The first live run is the human's to observe.
5. Open **View conversation details → Routines** and confirm the routine exists, then
   **pause it**.

| Bot | Schedule in the message |
|---|---|
| Signal Scout | Weekdays 07:00 |
| Reply Operator | Weekdays 07:15 |
| The Listener | Sunday 08:00 |
| Loop Archivist | Sunday 09:00 |

Limits: 50 routines per Bot, 20 run records retained, and deleting a Bot deletes its
routines. Grok Bot may pause routines after a long absence if the operator does not
respond to its check — tell the operator this in your report.

---

## 8. Verification

Do not report success until every line passes.

- [ ] Auto-review **Require Approval** rules exist for publishing, sending, signing in,
      purchases, and deletion. **No Always Allow rule was created**
- [ ] Execution on Local Computer is **Always require approval**
- [ ] `/workspace/pkfit/` holds 17 files including `bots/` and `out/`
- [ ] Nine Bots exist with correct names, titles, and descriptions
- [ ] Each description matches its charter, or a truncation is logged with the exact
      dropped text and the observed limit
- [ ] For each Bot, open a conversation and send:
      `Identify yourself. Name the files you read before a task, and state one thing you will never do.`
      The reply names the correct bot, cites `/workspace/pkfit/...`, and states a
      never-publish or never-fabricate rule
- [ ] **No reply contains an emoji or an exclamation point.** If one does, the
      description did not take — go back to §5
- [ ] Four routines exist, each **paused**, each with a next-run time consistent with
      the recorded timezone
- [ ] No Bot is signed in to any website
- [ ] Nothing was published, posted, sent, or purchased
- [ ] `INSTALL_LOG.md` records the timezone, the observed description limit, every
      truncation, and every UI deviation

---

## 9. Report back

1. **Installed** — each Bot, its section, and whether it has a routine
2. **The description limit** — the observed character limit, or "not reached, charters
   fit". Name it precisely
3. **Truncated** — any charter text that did not fit, quoted exactly
4. **Deviated** — anywhere the live UI did not match `../04_GROK_CAPABILITY_MAP.md` §B,
   quoted. Especially the creation-dialog field set. This is the highest-value part of
   your report
5. **Guardrails** — the rules you created, and an explicit note that they are
   per-desktop and do not follow the account to another machine
6. **Blocked** — anything you could not do and the hard stop that stopped you
7. **Untested** — all four routines, since none was run

Then hand back. The human runs the first routine and does the first publish.

---

## 10. Out of scope

- **Teach-by-demonstration.** It produces a draft skill from a recorded browser
  workflow, and it requires signing in to real services. That is the operator's to
  record, not yours.
- **Group chats.** Max six Bots per group and they count against the 50 cap. Worth
  considering later for the Media lane; not part of v1.
- **Marketplace plugins and connectors.** The workforce deliberately has no outbound
  reach in v1.
- **Anything touching Stripe, Gumroad, Trainerize, X, Instagram, or email.**
- **grok.com.** Different product, different handoff.
