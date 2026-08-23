# BOT DEFINITIONS

Nine bots. Each file carries the job spec, the production system prompt in a fenced
block, and the run procedure.

**These files are the source of truth.** `../handoff/bot-configs.json` is generated from
them by `../handoff/build-configs.py`. Never edit a system prompt inside Grok's UI — the
next install overwrites it and the repo stops being canonical.

## Roster

| # | Bot | Lane | Runs as |
|---|-----|------|---------|
| 01 | Signal Scout | Media | Agent slot + daily automation |
| 02 | Reply Operator | Media | Agent slot + daily automation |
| 03 | Frame Room | Media | Project chat — PKFIT DESIGN |
| 04 | Loop Archivist | Media | Weekly automation — PKFIT MEDIA |
| 05 | The Forge | Sales | Project chat — PKFIT SALES |
| 06 | The Interrogator | Sales | Agent slot |
| 07 | The Listener | Sales | Weekly automation — PKFIT SALES |
| 08 | Plate | Design | Agent slot |
| 09 | Caliper | Design | Project chat — PKFIT DESIGN |

## On the run procedures

Each bot's run procedure says to paste `00_STACK_CONTEXT.md` and, where relevant,
`03_DESIGN_CONTRACT.md`. **That is the fallback path**, correct for a one-off chat
outside a project.

Once the workforce is installed per `../WORKFLOW.md`, the context arrives automatically:
the `pkfit-voice`, `pkfit-stack`, and `pkfit-design` skills are attached to the agent or
automation, and the same files sit in the project's sources. In that case skip the paste
and send the kickoff line only.

Paste anyway when the bot's output starts drifting — an emoji, an exclamation point, a
hype word. Drift means the context is not reaching it, and a paste is the fastest way to
confirm that before you go hunting through settings.

## After editing any prompt

1. Edit the file here.
2. Run `python3 ../handoff/build-configs.py`.
3. Re-paste the instructions into that bot's surface in Grok.
4. **Start a new chat.** Existing conversations keep the old instructions.
5. Log it in `../handoff/INSTALL_LOG.md`.
