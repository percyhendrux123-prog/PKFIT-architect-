# INSTALL LOG

Append one block per install or sync run. The desktop agent writes the first entry; the
operator maintains it after that.

Every re-sync of a skill, project source, or agent prompt gets an entry. An unlogged
change is how the workforce silently runs stale.

---

## Template

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
