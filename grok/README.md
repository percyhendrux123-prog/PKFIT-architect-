# GROK — PKFIT BOT WORKFORCE

Nine Grok bots, three installable skills, three projects, four scheduled automations,
and a desktop-control handoff to install them.

**The problem this solves:** the PKFIT stack lives in three repos and a set of checkout
URLs, and Grok bots hold no memory between runs. Without a canonical, attachable context
pack, every bot invents its own version of the brand — off-palette, over-hyped, and
selling the wrong rung.

**The target:** **Grok Bot**, the standalone desktop and iOS agent product (Cursor
account auth) — not grok.com. It gives each Bot a real Linux computer with a browser,
filesystem, and terminal.

**The constraints that shape it,** verified 2026-08-23:

- No API, CLI, or import/export for Bots, skills, or routines. Everything is created
  through the desktop UI or by talking to a Bot. So this repo holds the artifacts and
  hands them to something with a mouse.
- No separate system-prompt field — a Bot's `description` *is* its standing instruction,
  with no published limit. Hence the charter-plus-brief split.
- No documented `SKILL.md` upload path. The context pack ships as files in
  `/workspace/pkfit/` instead, which the Bots read at the start of every task.
- **A Bot can sign in to sites and publish as you.** The human gate here is a policy
  choice, not a limitation.

## Read in this order

| File | What it is |
|------|------------|
| **`WORKFLOW.md`** | **Start here.** The five-layer architecture, why it has that shape, the weekly loop, and the sync contract |
| `00_STACK_CONTEXT.md` | The canonical stack brief — operator, offer ladder, properties, voice contract, ethical floor |
| `01_MEDIA_PLAN.md` | Channel thesis, media roster, weekly cadence, the five metrics |
| `02_FUNNEL_MAP.md` | Awareness map, objection map, the email sequence that does not exist yet |
| `03_DESIGN_CONTRACT.md` | Tokens, type, motion, image-prompt template, 9:16 video spec |
| `04_GROK_CAPABILITY_MAP.md` | What Grok can and cannot do, with sources. **Re-verify before every install** |
| `bots/` | Nine bot definitions with production system prompts |
| `workspace/` | `build.py` assembles the `/workspace/pkfit` payload the Bots read |
| `skills/` | Three packaged `SKILL.md` artifacts — **grok.com only**, no upload path on Grok Bot |
| `handoff/` | The install guides, the generated config, the install log |
| `phrase-bank.md` | Compounding audience-language asset. Grok's missing memory, kept in the repo |

## Install

```bash
python3 grok/workspace/build.py           # assemble the /workspace/pkfit payload
python3 grok/handoff/build-configs.py     # regenerate bot-configs.json
```

Then hand `grok/handoff/GROKBOT_HANDOFF.md` to the desktop-control agent. The human signs
in; the agent never touches credentials, and nothing in the install requires signing in
to any PKFIT account.

| Target | Handoff | Status |
|---|---|---|
| **Grok Bot** (desktop/iOS) | `handoff/GROKBOT_HANDOFF.md` | **The chosen target** |
| grok.com (Custom Agents, Projects, Automations) | `handoff/GROKCOM_HANDOFF.md` | Secondary — do not install from it unless told to |

The bot definitions in `bots/` are shared between both targets. Only the install path
and the packaging differ.

## The nine bots

**Media** — Signal Scout finds the day's live arguments · Reply Operator writes the
day's posts and replies · Frame Room generates the visuals · Loop Archivist converts
winners into IG assets.

**Sales** — The Forge generates tested variants · The Interrogator attacks the copy as a
skeptical buyer · The Listener collects verbatim audience language.

**Design** — Plate turns a line of copy into on-brand assets · Caliper audits every
deploy against the contract.

## Three rules that hold across all of it

1. **Nothing publishes itself.** Grok Bot *can* post as you — it is declined on purpose,
   enforced in the auto-review rules, in every charter, and by the human at the keyboard.
2. **No bot touches money, and no bot signs in to anything.** Stripe, Gumroad, Trainerize,
   X, and Instagram stay manual. No credential ever goes on the agent computer, which is
   shared across every Bot on the account and is not a security boundary.
3. **The repo is the source of truth.** Never author a charter in Grok Bot's UI or edit a
   brief on the agent computer. Edit here, rebuild, re-copy.
