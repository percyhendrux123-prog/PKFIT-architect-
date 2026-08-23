# INSTALL LOG

Append one block per install or sync run. The desktop agent writes the first entry; the
operator maintains it after that.

Every re-sync of a skill, project source, or agent prompt gets an entry. An unlogged
change is how the workforce silently runs stale.

---

## Template — Grok Bot (the chosen target)

```
## RUN <n> — <date> — <who ran it>

Target: Grok Bot desktop
App version:
Timezone confirmed (Settings → General → Agent):
Capability map Part B re-verified against live UI:  yes / no
OBSERVED DESCRIPTION CHARACTER LIMIT:               <the number, or "not reached">

GUARDRAILS (installed first)
  Require Approval rules created:
  Execution on Local Computer:            Always require approval
  Always Allow rules created:             NONE  <- must be none
  Noted per-desktop, not account-wide:    yes / no

WORKSPACE
  /workspace/pkfit populated:   17 files? yes / no
  Spot-checked readback:        README.md  bots/01-signal-scout.md

BOTS                       section          desc chars   truncated   notif
  Signal Scout             PKFIT Media                   no
  Reply Operator           PKFIT Media
  Frame Room               PKFIT Media
  Loop Archivist           PKFIT Media
  The Forge                PKFIT Sales
  The Interrogator         PKFIT Sales
  The Listener             PKFIT Sales
  Plate                    PKFIT Design
  Caliper                  PKFIT Design

ROUTINES                   next run reported        state
  Signal Scout   weekdays 07:00                     paused
  Reply Operator weekdays 07:15                     paused
  The Listener   Sunday 08:00                       paused
  Loop Archivist Sunday 09:00                       paused

IDENTITY CHECK (per bot: names itself, cites /workspace/pkfit, states a never-rule)
  Passed:
  Failed:
  Any emoji or exclamation point in a reply:   <- any yes means the description did not take

TRUNCATIONS (quote every dropped paragraph):

UI DEVIATIONS from 04_GROK_CAPABILITY_MAP.md Part B
  (especially: did the creation dialog show description, or shape/color?)

BLOCKED:
```

---

## Template — grok.com (secondary surface)

```
## RUN <n> — <date> — <who ran it>

Timezone confirmed:
Capability map re-verified against live UI:  yes / no

SKILLS
  pkfit-voice    id:            action: created / updated / unchanged
  pkfit-stack    id:            action:
  pkfit-design   id:            action:

PROJECTS
  PKFIT MEDIA    id:            sources uploaded:
  PKFIT SALES    id:            sources uploaded:
  PKFIT DESIGN   id:            sources uploaded:

AGENTS
  Signal Scout       slot:   chars used / limit:      truncated: no
  Reply Operator     slot:   chars used / limit:      truncated:
  The Interrogator   slot:   chars used / limit:      truncated:
  Plate              slot:   chars used / limit:      truncated:

AUTOMATIONS
  scout-daily        trigger:            project:        state: paused
  reply-daily        trigger:            project:        state:
  listener-weekly    trigger:            project:        state:
  archivist-weekly   trigger:            project:        state:

TRUNCATIONS (quote every dropped section):

UI DEVIATIONS from 04_GROK_CAPABILITY_MAP.md:

CONVERSATIONS RETIRED (existing chats keep old instructions):

BLOCKED:
```

---

## RUN 1 — pending

Not yet run.
