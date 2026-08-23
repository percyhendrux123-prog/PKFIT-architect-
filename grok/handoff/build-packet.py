#!/usr/bin/env python3
"""Assembles the single-file Grok Bot install packet.

The desktop-control agent may receive nothing but this one file, so it is fully
self-contained: the install procedure, every bot charter, and the complete text of
every file that belongs at /workspace/pkfit on the agent computer.

Run grok/workspace/build.py first. Output is a build artifact, not committed.

Usage: python3 grok/handoff/build-packet.py [output.md]
"""
import json
import pathlib
import re
import sys

GROK = pathlib.Path(__file__).parent.parent
DIST = GROK / "workspace" / "dist" / "pkfit"
DEFAULT_OUT = GROK / "workspace" / "dist" / "GROKBOT-PAYLOAD.md"

STAMP = "2026-08-23"


def strip_build_header(text):
    return re.sub(r"^<!-- Assembled by .*?-->\n\n", "", text, flags=re.S)


def demote(text, levels=2):
    """Push markdown headings down so embedded docs nest under packet sections."""
    return re.sub(r"^(#{1,4}) ", lambda m: "#" * min(6, len(m.group(1)) + levels) + " ",
                  text, flags=re.M)


def main():
    out_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT
    if not DIST.exists():
        raise SystemExit("run: python3 grok/workspace/build.py  (payload not built)")

    cfg = json.loads((GROK / "handoff" / "bot-configs.json").read_text())
    bots = cfg["grok_bot"]["bots"]
    handoff = (GROK / "handoff" / "GROKBOT_HANDOFF.md").read_text()

    p = []
    p.append(f"""# PKFIT GROK BOT — INSTALL PACKET

**Assembled {STAMP} from the `PKFIT-architect-` repo, branch
`claude/grok-bots-agent-inventory-iq0386`.**

This file is self-contained. It carries the install procedure, all nine bot charters,
and the complete text of every file that belongs at `/workspace/pkfit` on the agent
computer. Nothing else needs to be fetched.

**Target:** Grok Bot, the standalone desktop and iOS agent product (Cursor account auth).
**Not** grok.com — that is a different product with a different field set.

---

## Read this first

Three things about this product shape the whole install:

1. **A Bot's `description` IS its standing instruction.** There is no separate
   system-prompt field, and no character limit is published. Read the live field.
2. **Routines are created by conversation, not by a form.** Where this packet gives an
   exact message, send it verbatim — the wording is the config.
3. **A Bot can sign in to websites and publish as the operator.** The human gate in this
   design is a policy choice, not a limitation. Install the guardrails first.

**Never**, during this install: create an Always Allow auto-review rule; sign any Bot in
to any website; place a credential, key, token, or client personal data under
`/workspace`; use Reset Agent Computer; delete an existing Bot, routine, or skill.

**The agent computer is shared by every Bot on the account and is not a security
boundary** — shared browser cookies, shared files, shared command-line credentials.

---

## Section 1 — Install procedure

""")
    p.append(demote(handoff, 2))

    p.append(f"""
---

## Section 2 — The nine Bots

Create each Bot, then set **Edit Profile → name, title, description**. The description is
the charter, verbatim. Enable Notifications. Group by Sidebar Section.

| # | Name | Title | Section | Charter chars | Routine |
|---|------|-------|---------|---------------|---------|""")
    for i, b in enumerate(bots, 1):
        r = "yes" if b["routine_message"] else "-"
        p.append(f"| {i:02d} | {b['name']} | {b['title']} | {b['sidebar_section']} | "
                 f"{b['description_chars']} | {r} |")

    p.append("""
Every charter fits inside any plausible limit. If one is rejected, cut from the bottom at
a paragraph boundary, never from the voice rules or the never-publish clause, and record
exactly what was dropped.
""")

    for i, b in enumerate(bots, 1):
        p.append(f"""
### {i:02d}. {b['name']}

- **Title:** `{b['title']}`
- **Sidebar section:** `{b['sidebar_section']}`
- **Notifications:** on
- **Full brief on the agent computer:** `{b['full_brief_on_agent_computer']}`

**Description — paste verbatim ({b['description_chars']} characters):**

```
{b['description']}
```
""")

    p.append("""
---

## Section 3 — Routines

Four Bots get a routine. Open a 1:1 conversation with the owning Bot and send the message
verbatim. The Bot builds the routine and reports its next run — record that time, it
confirms the timezone resolved correctly.

**Do not use Test run.** It performs real work. The first live run is the operator's to
watch. Pause each routine after creating it.
""")
    for b in bots:
        if not b["routine_message"]:
            continue
        p.append(f"""
### {b['name']}

```
{b['routine_message']}
```
""")

    p.append("""
---

## Section 4 — The `/workspace/pkfit` payload

Create `/workspace/pkfit/` on the agent computer and write these files into it, preserving
the `bots/` and `out/` subdirectories. Every Bot reads from here at the start of every
task — this is the memory the product does not otherwise have.

Do not edit these files on the agent computer. They are generated from the repo and the
next sync overwrites them.
""")

    order = ["README.md", "CONTEXT.md", "VOICE.md", "DESIGN.md", "FUNNEL.md",
             "MEDIA.md", "phrase-bank.md"]
    files = [DIST / n for n in order]
    files += sorted((DIST / "bots").glob("*.md"))
    files.append(DIST / "out" / "README.md")

    for f in files:
        rel = f.relative_to(DIST)
        body = strip_build_header(f.read_text()).strip()
        p.append(f"""
### `/workspace/pkfit/{rel}`

{demote(body, 2)}
""")

    p.append(f"""
---

## Section 5 — Report back

1. **Installed** — each Bot, its section, whether it has a routine
2. **The description character limit** — the observed number, or "not reached, charters
   fit". This is the single most valuable line in your report
3. **Truncated** — any charter text that did not fit, quoted exactly
4. **Deviated** — anywhere the live UI did not match this packet. Especially the creation
   dialog: xAI's docs say *name, title, description, avatar*; Cursor's help page says
   *name, shape, color, and title*. Report which you saw
5. **Guardrails** — the rules you created, and an explicit note that auto-review rules are
   stored per desktop and do not follow the account to another machine
6. **Blocked** — anything you could not do, and the hard stop that stopped you
7. **Untested** — all four routines, since none was run

Then hand back. The human runs the first routine and does the first publish.

---

*Packet assembled {STAMP} · regenerate with `python3 grok/workspace/build.py && python3
grok/handoff/build-packet.py`*
""")

    text = "\n".join(p)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(text)
    print(f"wrote {out_path}")
    print(f"  {len(text)/1024:.0f} KB · {len(text.splitlines())} lines · "
          f"{len(bots)} bots · {len(files)} workspace files inlined")


if __name__ == "__main__":
    main()
