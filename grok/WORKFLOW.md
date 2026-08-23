# THE GROK WORKFLOW — v2 (Grok Bot desktop)

**Target: Grok Bot**, the standalone desktop and iOS agent product. Auth is a Cursor
account. This replaced the grok.com plan in v1 — see §7 for what changed and why.

Two verified constraints shape everything:

1. **There is no API, CLI, or import/export for Bots, skills, or routines.** Everything
   is created through the desktop UI or by talking to a Bot. So the repo holds the
   artifacts and hands them to something with a mouse.
2. **A Grok Bot can sign in to websites and act as you.** The human gate below is
   therefore a *policy*, not a limitation. It is enforced in three places on purpose.

---

## The five layers

```
LAYER 0   REPO — this directory, on branch claude/grok-bots-agent-inventory-iq0386
              The only source of truth. Nothing is authored inside Grok Bot.
                              │
                              ▼
LAYER 1   GUARDRAILS — Auto-review "Require Approval" rules, installed FIRST
              Publishing · sending · signing in · purchases · deletion
              Require beats Always Allow. Per-desktop, not account-wide.
                              │
                              ▼
LAYER 2   /workspace/pkfit — the context pack as real files on the agent computer
              CONTEXT · VOICE · DESIGN · FUNNEL · MEDIA · phrase-bank · bots/ · out/
              Every Bot reads these at the start of every task. This is the memory.
                              │
                              ▼
LAYER 3   NINE BOTS — description = the charter. All nine fit; the cap is 50.
              Media 01-04 · Sales 05-07 · Design 08-09, grouped by Sidebar Section
                              │
                              ▼
LAYER 4   ROUTINES — four, created by conversation, not by a form
              Scout weekdays 07:00 · Operator 07:15 · Listener Sun 08:00 · Archivist Sun 09:00
                              │
                              ▼
LAYER 5   THE HUMAN GATE — nothing publishes itself. By choice, not by limitation.
              Cut, approve, press publish. Every time.
```

## Why this shape

| Constraint (verified 2026-08-23) | Consequence |
|---|---|
| No config API or import/export | The repo holds artifacts; a desktop agent installs them. See `handoff/GROKBOT_HANDOFF.md` |
| **No separate system-prompt field — `description` IS the instruction** | Each bot gets a short **charter** in `description`, under 1,030 characters because the limit is unpublished |
| **No documented `SKILL.md` upload path** | The context pack ships as **files in `/workspace/pkfit/`**, not as uploaded skills |
| Bots share one VM with a persistent filesystem | Those files *are* the memory. The "Grok has no memory" problem that shaped v1 mostly dissolves |
| **The shared VM is not a security boundary** | No credential, key, token, or client data ever goes under `/workspace` |
| 50 Bots, not 4 agent slots | All nine bots are real Bots. v1's compromise — five running as project chats — is gone |
| Routines are conversational | The handoff carries the **exact message to send**, because the wording is the config |
| 50 routines per Bot | Room to grow well past the four in v1 |
| A Test run does **real work** | Never test-run during install. The first live run is the human's to watch |
| Bots can log in and publish | The gate is enforced three times: auto-review rules, the charter's never-publish clause, and the human |

## The charter-plus-brief split

Grok Bot gives one short field for standing instructions. The full system prompts run
1,900–2,500 characters and the limit is unknown, so each bot is configured in two parts:

- **The charter** goes in `description`. Identity, the hard voice rules, the
  anti-fabrication clause, the never-publish clause, and a pointer to the brief. Under
  1,030 characters. This is the part that must survive.
- **The brief** lives at `/workspace/pkfit/bots/NN-name.md` — the full prompt, the output
  format, the run procedure. The charter instructs the bot to read it before every task.

If the description field turns out to be smaller than a charter, cut from the bottom at a
paragraph boundary. The voice rules and the never-publish clause are never what gets cut.

## The nine bots

| # | Bot | Lane | Section | Routine |
|---|-----|------|---------|---------|
| 01 | Signal Scout | Media | PKFIT Media | Weekdays 07:00 |
| 02 | Reply Operator | Media | PKFIT Media | Weekdays 07:15 |
| 03 | Frame Room | Media | PKFIT Media | On demand |
| 04 | Loop Archivist | Media | PKFIT Media | Sunday 09:00 |
| 05 | The Forge | Sales | PKFIT Sales | On demand |
| 06 | The Interrogator | Sales | PKFIT Sales | On demand |
| 07 | The Listener | Sales | PKFIT Sales | Sunday 08:00 |
| 08 | Plate | Design | PKFIT Design | On demand |
| 09 | Caliper | Design | PKFIT Design | Every deploy |

## The weekly loop

**Daily, automated.** Signal Scout runs at 07:00 and writes its entry-point table to
`/workspace/pkfit/out/`. Reply Operator runs at 07:15 against that table. The operator
opens the app at 07:20, cuts at least three of thirteen drafts, and posts the rest across
the day by hand.

**Twice weekly.** Frame Room turns a `content/` script into slides and clips, writing to
`out/`. The operator approves per asset and rejects outright on any off-palette color
rather than asking for a fix.

**Weekly, Sunday.** The Listener appends verbatim audience language to the phrase bank.
Loop Archivist takes the top three posts *by link clicks, not likes* and expands the
strongest into next week's carousel and reel.

**Per ship.** The Interrogator attacks the copy until it breaks — every `UNHANDLED` tag
is a required edit. Caliper audits the deploy; every `BLOCKER` gates it.

Under four hours of human time a week. The human cuts bad drafts, presses publish, and
answers real humans in comments by hand.

## The sync loop

The workforce goes stale silently. This is the maintenance contract:

1. **Edit in the repo.** Never edit a charter in Grok Bot's UI or a brief on the agent
   computer. Both are overwritten on the next sync.
2. **Rebuild.** `python3 workspace/build.py` and `python3 handoff/build-configs.py`.
3. **Re-copy** `workspace/dist/pkfit/` to `/workspace/pkfit/`.
4. **Re-paste any changed charter** into that Bot's description.
5. **Log it** in `handoff/INSTALL_LOG.md`.

Unlike grok.com, there is no "start a new chat" step — the Bots re-read their briefs from
the filesystem at the start of every task, so a re-copied brief takes effect immediately.
**A changed charter still requires re-pasting**, because the description is stored on the
Bot, not on disk.

**Full re-sync trigger:** any change to the offer ladder, a checkout URL, the voice
contract, the ethical floor, or the design tokens.

**Re-verify `04_GROK_CAPABILITY_MAP.md` Part B before every install run.**

## What this workflow deliberately does not do

- **No bot publishes.** Grok Bot *can* post as you. The workforce does not, because a bot
  posting unreviewed copy in your name is a brand risk no prompt discipline fully covers.
  Enforced in the auto-review rules, in every charter, and by the human.
- **No bot signs in to anything.** Not X, not Instagram, not Gumroad, Stripe, or
  Trainerize. Nothing in the install requires it.
- **No bot touches money.**
- **No credentials on the agent computer.** The VM is shared across every Bot on the
  account and is not a security boundary.
- **No Always Allow auto-review rules.** Require Approval only.
- **No cross-contamination with Axiom.** `pkfit-execution` is a different business.

### If you later decide to let a bot publish

That is a real option, not a locked door. It would mean: creating an Always Allow rule
for one narrow action, signing that Bot in to that one service via computer takeover, and
accepting that the charter's never-publish clause has to be rewritten. Do it for one bot
and one platform, watch it for a fortnight, and keep the Interrogator in the loop before
anything ships. Do not do it across the workforce at once.

## §7 — What changed from v1 (grok.com)

v1 targeted grok.com and was built around four constraints that **do not apply** to Grok
Bot: no memory, roughly four agent slots, one trigger per automation, and instruction
edits not affecting existing conversations.

| v1 (grok.com) | v2 (Grok Bot) |
|---|---|
| 3 uploaded `SKILL.md` zips | `/workspace/pkfit/` files — no upload path exists here |
| 3 Projects with instructions and sources | No Projects. Sidebar Sections plus workspace folders |
| 4 agent slots, 5 bots demoted to project chats | 9 real Bots |
| 4 Automations, one trigger each | 4 Routines, created conversationally, 50 per Bot available |
| Full prompt in the Instructions field | Charter in `description` plus brief on disk |
| "Start a new chat" after every edit | Briefs re-read from disk; only charters need re-pasting |
| Publishing impossible | Publishing possible, and declined on purpose |

`handoff/GROKCOM_HANDOFF.md` and `skills/` are kept — grok.com remains a valid secondary
surface and the underlying bot definitions are shared.
