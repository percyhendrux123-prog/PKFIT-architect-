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

## Two fields per bot

Each file carries **two** fenced blocks, and `../handoff/build-configs.py` depends on
exactly two being present:

1. **The charter**, under `## Charter`. This goes in Grok Bot's **`description`** field,
   which is the only standing-instruction field the product has. Kept under ~1,030
   characters because the limit is unpublished.
2. **The system prompt**, under `## System prompt`. The full brief. On Grok Bot it is not
   pasted anywhere — it ships to `/workspace/pkfit/bots/` and the charter tells the bot to
   read it before every task. On grok.com it goes in the Instructions field.

## On the run procedures

The run procedures assume the workforce is installed per `../WORKFLOW.md`, with the
context pack at `/workspace/pkfit/`. The bots read their own briefs from disk, so there is
nothing to paste but the task-specific input.

If a bot's output drifts — an emoji, an exclamation point, a hype word — the cause is
almost always one of two things: its charter did not take (check the description field for
truncation), or `/workspace/pkfit/` is stale. Check those before rewriting a prompt.

## After editing any prompt

1. Edit the file here.
2. Run `python3 ../workspace/build.py` and `python3 ../handoff/build-configs.py`.
3. Re-copy `../workspace/dist/pkfit/` to `/workspace/pkfit/` on the agent computer.
4. **If the charter changed**, re-paste it into that Bot's description. A changed brief
   needs no re-paste — it is re-read from disk on the next task.
5. Log it in `../handoff/INSTALL_LOG.md`.
