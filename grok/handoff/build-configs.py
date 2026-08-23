#!/usr/bin/env python3
"""Generates bot-configs.json from the bot definitions in ../bots/.

The markdown files in ../bots/ are the source of truth. This script extracts each bot's
charter (the Grok Bot `description` field) and its full system prompt, then emits the
machine-readable config the desktop-control agent installs from.

Two targets are emitted. `grok_bot` is the chosen one: nine Bots, charters as
descriptions, full briefs read from /workspace/pkfit/bots/, routines created
conversationally. `grokcom` is the secondary surface: four agent slots, three projects,
four scheduled automations.

Run after editing any bot file.
"""
import json
import re
import pathlib

HERE = pathlib.Path(__file__).parent
BOTS = HERE.parent / "bots"

AGENT_SLOTS = ["01-signal-scout", "02-reply-operator", "06-the-interrogator", "08-plate"]

# Grok Bot routines are created by talking to the owning Bot. There is no cron field
# and no create-routine form, so the config carries the exact message to send.
ROUTINES = [
    ("01-signal-scout",   "Every weekday at 7:00 AM, run today's scout. Read /workspace/pkfit/bots/01-signal-scout.md first and follow it exactly. Write the entry-point table to /workspace/pkfit/out/<today>/signal-scout.md and post it in this conversation. Do not publish anything anywhere."),
    ("02-reply-operator", "Every weekday at 7:15 AM, read the most recent scout table in /workspace/pkfit/out/ and write today's thirteen. Read /workspace/pkfit/bots/02-reply-operator.md first and follow its output format exactly. Save to /workspace/pkfit/out/<today>/reply-operator.md and post it here. Draft only - never post to X."),
    ("07-the-listener",   "Every Sunday at 8:00 AM, run the weekly listen. Read /workspace/pkfit/bots/07-the-listener.md and /workspace/pkfit/phrase-bank.md first, deduplicate against the bank, and follow the table format exactly. Save to /workspace/pkfit/out/<today>/listener.md. Never include a handle or any identifying detail."),
    ("04-loop-archivist", "Every Sunday at 9:00 AM, ask me for the top three X posts by link clicks, then archive the week. Read /workspace/pkfit/bots/04-loop-archivist.md first and follow its carousel and reel templates exactly. Save to /workspace/pkfit/out/<today>/archivist.md."),
]

AUTOMATIONS = [
    ("scout-daily",      "01-signal-scout",   "PKFIT MEDIA", "Daily",  "07:00", "Run today's scout."),
    ("reply-daily",      "02-reply-operator", "PKFIT MEDIA", "Daily",  "07:15", "Write today's thirteen from the most recent scout table in this project."),
    ("archivist-weekly", "04-loop-archivist", "PKFIT MEDIA", "Weekly", "Sunday 09:00", "Archive the week. The operator will paste the top three posts by link clicks."),
    ("listener-weekly",  "07-the-listener",   "PKFIT SALES", "Weekly", "Sunday 08:00", "Run the weekly listen against the phrase bank in this project's sources."),
]

PROJECTS = [
    {
        "name": "PKFIT MEDIA",
        "instructions": (
            "This project runs PKFIT's distribution. Every output obeys the pkfit-voice "
            "skill without exception: declarative, stoic, systems-framed, no emoji, no "
            "exclamation points, no hype vocabulary, no fabricated proof. Reference one "
            "rung of the offer ladder at a time and default cold traffic to a free tool, "
            "never to the $37 Blueprint. X is primary, Instagram is secondary, email is "
            "the terminal. Nothing published here is written by a bot alone - the "
            "operator cuts and publishes."
        ),
        "sources": [
            "grok/00_STACK_CONTEXT.md", "grok/01_MEDIA_PLAN.md", "grok/phrase-bank.md",
            "grok/bots/01-signal-scout.md", "grok/bots/02-reply-operator.md",
            "grok/bots/04-loop-archivist.md",
            "content/content_pack_01_busy_schedule.md", "content/carousel_template.md",
            "content/animated_reel_series.md",
        ],
        "skills": ["pkfit-voice", "pkfit-stack"],
    },
    {
        "name": "PKFIT SALES",
        "instructions": (
            "This project runs PKFIT's persuasion layer. Every output obeys the "
            "pkfit-voice skill, including its ethical floor: no health or body outcome "
            "claims, no medical or peptide claims, no income claims, no manufactured "
            "scarcity, no fabricated proof, no diagnosis. The only nameable proof point "
            "is Dele Bakare, 39, down 35 lbs, business owner - used verbatim or not at "
            "all. If persuasion would require breaking a line of the ethical floor, "
            "refuse and name the line."
        ),
        "sources": [
            "grok/00_STACK_CONTEXT.md", "grok/02_FUNNEL_MAP.md", "grok/phrase-bank.md",
            "grok/bots/05-the-forge.md", "grok/bots/06-the-interrogator.md",
            "grok/bots/07-the-listener.md",
        ],
        "skills": ["pkfit-voice", "pkfit-stack"],
    },
    {
        "name": "PKFIT DESIGN",
        "instructions": (
            "This project produces PKFIT visuals and audits interfaces. Every asset "
            "obeys the pkfit-design skill exactly: background #080808, accent #C8A96E "
            "under 8% coverage, text #F5F5F5, Bebas Neue display, DM Mono body, square "
            "corners, hairline rules. No emoji, no decorative gradients, no glow, no "
            "glassmorphism, no gym stock imagery, no off-palette color. Append the "
            "negative-prompt block to every generation. Legibility beats decoration."
        ),
        "sources": [
            "grok/00_STACK_CONTEXT.md", "grok/03_DESIGN_CONTRACT.md",
            "grok/bots/03-frame-room.md", "grok/bots/08-plate.md", "grok/bots/09-caliper.md",
        ],
        "skills": ["pkfit-design", "pkfit-voice", "pkfit-stack"],
    },
]

SKILLS_FOR_BOT = {
    "01-signal-scout":   ["pkfit-voice", "pkfit-stack"],
    "02-reply-operator": ["pkfit-voice", "pkfit-stack"],
    "03-frame-room":     ["pkfit-design", "pkfit-voice"],
    "04-loop-archivist": ["pkfit-voice", "pkfit-stack"],
    "05-the-forge":      ["pkfit-voice", "pkfit-stack"],
    "06-the-interrogator": ["pkfit-voice", "pkfit-stack"],
    "07-the-listener":   ["pkfit-voice"],
    "08-plate":          ["pkfit-design"],
    "09-caliper":        ["pkfit-design"],
}


def read_bot(slug):
    """Returns (title, charter, prompt). Charter is the first fenced block, under
    '## Charter'; prompt is the second, under '## System prompt'."""
    text = (BOTS / f"{slug}.md").read_text()
    title = re.search(r"^# (.+)$", text, re.M).group(1)
    blocks = re.findall(r"^```\n(.*?)^```", text, re.M | re.S)
    if len(blocks) != 2:
        raise SystemExit(f"{slug}: expected a charter block and a system-prompt block, "
                         f"found {len(blocks)}")
    return title, blocks[0].strip(), blocks[1].strip()


def bot_name(title):
    return title.split("\u2014")[-1].strip().title()


BOT_ORDER = ["01-signal-scout", "02-reply-operator", "03-frame-room", "04-loop-archivist",
             "05-the-forge", "06-the-interrogator", "07-the-listener", "08-plate",
             "09-caliper"]

LANE = {"01": "Media", "02": "Media", "03": "Media", "04": "Media",
        "05": "Sales", "06": "Sales", "07": "Sales", "08": "Design", "09": "Design"}


def build_grok_bot():
    routines = {slug: msg for slug, msg in ROUTINES}
    bots = []
    for slug in BOT_ORDER:
        title, charter, prompt = read_bot(slug)
        bots.append({
            "source_file": f"grok/bots/{slug}.md",
            "name": bot_name(title),
            "title": f"PKFIT {LANE[slug[:2]]}",
            "description": charter,
            "description_chars": len(charter),
            "full_brief_on_agent_computer": f"/workspace/pkfit/bots/{slug}.md",
            "sidebar_section": f"PKFIT {LANE[slug[:2]]}",
            "notifications": "on",
            "routine_message": routines.get(slug),
        })
    return {
        "surface": "Grok Bot desktop app (Cursor account auth)",
        "install_guide": "grok/handoff/GROKBOT_HANDOFF.md",
        "workspace_payload": "grok/workspace/dist/pkfit -> /workspace/pkfit",
        "build_payload_with": "python3 grok/workspace/build.py",
        "note": "description IS the instruction field - there is no separate system "
                "prompt. Charters are kept short because the limit is unpublished. The "
                "full brief lives on the agent computer and the charter points at it.",
        "bots": bots,
    }


def main():
    agents = []
    for slug in AGENT_SLOTS:
        title, _charter, prompt = read_bot(slug)
        agents.append({
            "source_file": f"grok/bots/{slug}.md",
            "name": bot_name(title),
            "personality_preset": "Custom",
            "instructions": prompt,
            "instruction_chars": len(prompt),
            "note": "Read the live character counter before pasting. The limit is "
                    "server-side remote config, not a fixed number. If it does not fit, "
                    "truncate from the bottom at a section boundary, never from the "
                    "voice or prohibition clauses, and log the drop.",
        })

    automations = []
    for name, slug, project, sched, when, kickoff in AUTOMATIONS:
        _title, _charter, prompt = read_bot(slug)
        automations.append({
            "source_file": f"grok/bots/{slug}.md",
            "name": name,
            "instructions": f"{prompt}\n\nSTANDING TASK FOR THIS AUTOMATION: {kickoff}",
            "trigger": {"type": "schedule", "schedule": sched, "at": when,
                        "timezone": "OPERATOR_LOCAL - confirm in Settings before setting"},
            "project": project,
            "skills": SKILLS_FOR_BOT[slug],
            "connectors": [],
            "notification": "App only",
            "initial_state": "paused",
        })

    config = {
        "generated_from": "grok/bots/*.md - those files are the source of truth",
        "regenerate_with": "python3 grok/handoff/build-configs.py",
        "chosen_target": "grok_bot",
        "capability_map": "grok/04_GROK_CAPABILITY_MAP.md",
        "verified_against_grok_ui": "2026-08-23",
        "sharing_policy": "All surfaces stay private. Never share to Team, to specific "
                          "users, or by link.",
        "skills": [
            {"name": "pkfit-voice",  "archive": "grok/skills/dist/pkfit-voice.zip",  "source": "grok/skills/pkfit-voice/SKILL.md"},
            {"name": "pkfit-stack",  "archive": "grok/skills/dist/pkfit-stack.zip",  "source": "grok/skills/pkfit-stack/SKILL.md"},
            {"name": "pkfit-design", "archive": "grok/skills/dist/pkfit-design.zip", "source": "grok/skills/pkfit-design/SKILL.md"},
        ],
        "grok_bot": build_grok_bot(),
        "grokcom": {
            "surface": "grok.com Custom Agents, Projects, Automations",
            "install_guide": "grok/handoff/GROKCOM_HANDOFF.md",
            "note": "Secondary surface. Do not install from this unless told to.",
        },
        "projects": PROJECTS,
        "agents": agents,
        "automations": automations,
        "project_chat_bots": [
            {"source_file": f"grok/bots/{s}.md", "project": p}
            for s, p in [("03-frame-room", "PKFIT DESIGN"), ("05-the-forge", "PKFIT SALES"),
                         ("09-caliper", "PKFIT DESIGN")]
        ],
    }

    out = HERE / "bot-configs.json"
    out.write_text(json.dumps(config, indent=2) + "\n")
    print(f"wrote {out.relative_to(HERE.parent.parent)}")
    gb = config["grok_bot"]
    print(f"\n  GROK BOT ({len(gb['bots'])} bots) - the chosen target")
    for b in gb["bots"]:
        r = "routine" if b["routine_message"] else "-"
        print(f"    {b['name']:<18} desc {b['description_chars']:>5} chars   {r}")
    print(f"\n  grok.com (secondary)")
    for a in agents:
        print(f"    agent {a['name']:<18} {a['instruction_chars']:>5} chars")
    for a in automations:
        print(f"    automation {a['name']:<18} {a['trigger']['schedule']} {a['trigger']['at']}")


if __name__ == "__main__":
    main()
