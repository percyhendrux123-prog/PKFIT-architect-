# SKILLS — grok.com only

Three portable `SKILL.md` artifacts. `./build.sh` packages them as zips for upload at
`grok.com/skills`.

> **These do not install on Grok Bot.** The desktop product exposes no documented zip or
> `SKILL.md` upload path — its skills are created conversationally or installed from the
> Marketplace. See `../04_GROK_CAPABILITY_MAP.md` §B3.
>
> **For Grok Bot, the same content ships as files** in `/workspace/pkfit/`, assembled by
> `../workspace/build.py`, which reads these exact three files as its source. Editing a
> `SKILL.md` here updates both targets.

| Skill | Becomes on the agent computer | Content |
|-------|-------------------------------|---------|
| `pkfit-voice` | `/workspace/pkfit/VOICE.md` | Voice contract and ethical floor |
| `pkfit-stack` | `/workspace/pkfit/CONTEXT.md` | Operator, offer ladder, properties |
| `pkfit-design` | `/workspace/pkfit/DESIGN.md` | Tokens, prompts, video spec |
