# GROK — PKFIT BOT WORKFORCE

Nine Grok bots, three installable skills, three projects, four scheduled automations,
and a desktop-control handoff to install them.

**The problem this solves:** the PKFIT stack lives in three repos and a set of checkout
URLs, and Grok bots hold no memory between runs. Without a canonical, attachable context
pack, every bot invents its own version of the brand — off-palette, over-hyped, and
selling the wrong rung.

**The constraint that shapes it:** xAI publishes no API for creating or configuring
agents, projects, automations, or skills. Configuration is UI-only. Verified
2026-08-23. So this repo holds the artifacts and hands them to something with a mouse.

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
| `skills/` | Three packaged `SKILL.md` artifacts. `./build.sh` zips them for upload |
| `handoff/` | The desktop-agent install guide, the generated config, the install log |
| `phrase-bank.md` | Compounding audience-language asset. Grok's missing memory, kept in the repo |

## Install

```bash
grok/skills/build.sh                      # package the three skills
python3 grok/handoff/build-configs.py     # regenerate bot-configs.json
```

Then hand `grok/handoff/DESKTOP_AGENT_HANDOFF.md` to the desktop-control agent. The
human logs in; the agent never touches credentials.

## The nine bots

**Media** — Signal Scout finds the day's live arguments · Reply Operator writes the
day's posts and replies · Frame Room generates the visuals · Loop Archivist converts
winners into IG assets.

**Sales** — The Forge generates tested variants · The Interrogator attacks the copy as a
skeptical buyer · The Listener collects verbatim audience language.

**Design** — Plate turns a line of copy into on-brand assets · Caliper audits every
deploy against the contract.

## Three rules that hold across all of it

1. **Nothing publishes itself.** The human cuts, approves, and presses publish. There is
   no scheduled posting and there will not be.
2. **No bot touches money.** Stripe, Gumroad, and Trainerize stay manual.
3. **The repo is the source of truth.** Never author a prompt inside Grok's UI. Edit
   here, rebuild, re-upload, and start a new chat — existing conversations keep the old
   instructions.
