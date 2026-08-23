---
name: pkfit-design
description: The PKFIT visual contract - exact color tokens, type scale, spacing, radius, motion, the negative-prompt block for image generation, and the 9x16 short-video spec. Load for any PKFIT image, video, carousel, thumbnail, OG card, or interface work.
---

# PKFIT DESIGN CONTRACT

Brand posture: **dark editorial engineering.** Instruments, not inspiration. Every
visual reads as a readout, a spec sheet, or a field note — never a supplement ad.

## Color — roles binding, hex binding

| Token | Hex | Role |
|-------|-----|------|
| `--pk-bg` | `#080808` | Page ground. The only background |
| `--pk-surface` | `#101010` | Raised card / panel |
| `--pk-surface-2` | `#141414` | Nested panel, input fill |
| `--pk-line` | `#1F1F1F` | Hairlines, 1px rules |
| `--pk-text` | `#F5F5F5` | Primary text |
| `--pk-text-2` | `#A8A8A8` | Secondary |
| `--pk-text-3` | `#6F6F6F` | Labels, meta |
| `--pk-gold` | `#C8A96E` | THE accent. CTA, active state, key numeral |
| `--pk-gold-hi` | `#E8C882` | Hover only |
| `--pk-gold-dim` | `#8A7448` | Disabled accent |
| `--pk-ok` | `#4CAF50` | Success only |
| `--pk-alert` | `#FF453A` | Error only |

**Gold stays under 8% of any surface.** If gold reads as a theme color instead of a
pointer, it is wrong.

## Type

Display **Bebas Neue** 400, uppercase, `letter-spacing: 0.02em`.
Body/UI **DM Mono** 300/400/500, `letter-spacing: 0.01em`.

Scale in rem: `0.75 · 0.875 · 1 · 1.25 · 1.5 · 2 · 2.75 · 4 · 5.75`

**Two type stacks exist on purpose.** `PKFIT-architect-` is Bebas Neue + DM Mono — it
sells a system to a cold stranger, so condensed uppercase and mono read as
instrumentation. `PK-PERCYKEITH` is Fraunces + Space Grotesk — a post-purchase artifact
handed to someone who already paid, where warmth makes "your week 4" feel earned rather
than sold. Do not unify them. Color, spacing, radius, motion, and the NEVER list are
shared.

## Spacing, radius, motion

Spacing (4px base): `4 8 12 16 24 32 48 64 96 128 192`. Section rhythm 96 mobile /
128 desktop. Nothing off-scale.

Radius: `0` default for images, cards, sections. `2px` inputs and buttons. `999px` only
on status pills. The brand is orthogonal.

Motion: `120 / 200 / 320 / 560ms`. Ease `cubic-bezier(0.22, 1, 0.36, 1)`. Exit
`cubic-bezier(0.4, 0, 1, 1)`. Scroll reveal: 24px rise + opacity, 320ms, 60ms stagger,
max 3 per group. Always wrapped in `@media (prefers-reduced-motion: reduce)`.

## NEVER

1. No emoji. Anywhere.
2. No gradient as decoration. Sole exception: a vertical `#080808 → #0D0D0D` scrim
   behind text on photography. No gold gradients, no glow, no neon.
3. No gym stock cliché — chalk clouds, barbell silhouettes, flexing torsos, lens flare,
   abs close-ups, water splash, before/after collages.
4. No blue, teal, purple, or pink. Off-palette color is an automatic reject.
5. No drop shadows for depth. Depth = surface step + 1px line.
6. No third typeface, no substitutes, no italics on Bebas.
7. No fake data in charts unless labeled `SAMPLE`.
8. No rounded app-card look, no glassmorphism — that language belongs to Axiom.
9. No exclamation marks, no hype adjectives.

## Image generation — fixed preamble

> Dark editorial engineering poster. Background pure near-black #080808, flat and matte,
> no gradient. Single accent color muted antique gold #C8A96E used sparingly, under 8%
> of frame. Text and linework in off-white #F5F5F5 with secondary grey #A8A8A8. Hard 1px
> hairline rules, orthogonal grid, sharp square corners, zero rounded shapes. Precise
> technical diagram sensibility — schematic, instrument panel, spec sheet. Flat 2D
> graphic design, no photographic depth of field, no 3D render, no bevel, no glow, no
> shadow. High contrast, generous negative space, composition anchored on a strict left
> margin.

## Image generation — negative prompt, paste every time

> emoji, icons, emoticons, gradient background, neon, glow, lens flare, bokeh, blue,
> teal, purple, pink, rainbow, gym photography, barbell, dumbbell, chalk dust, muscular
> torso, shirtless man, before and after body comparison, protein powder, sweat droplets,
> water splash, motivational poster, drop shadow, glassmorphism, frosted glass, rounded
> corners, 3D render, bevel, embossed metal, gold gradient, gold foil, ornate, script
> font, serif display font, italic, watermark, stock photo, cluttered layout, centered
> paragraph text, exclamation mark

## Short video — 9:16, 1080×1920

Top 220px and bottom 420px are platform chrome. No text there. Left/right margin 96px.
Live band `y=220→1500`; primary text inside `y=560→1240`.

Hook: Bebas Neue 132px, uppercase, line-height 0.92, max 4 lines, left-aligned.
Step line: DM Mono 500, 46px. Micro-label: DM Mono 400, 28px, 0.16em tracking, `#6F6F6F`.
Numerals gold only when marking position (`01 / 03`).

| Beat | Time | Cuts |
|------|------|------|
| Hook | 0:00–0:03 | 1 |
| Tension | 0:03–0:10 | 2 |
| System shift | 0:10–0:21 | 2 |
| Action steps | 0:21–0:33 | 3 |
| CTA | 0:33–0:38 | 1 |

Max 9 cuts. No cut under 800ms. Hard cuts or a 200ms gold hairline wipe only — no
crossfade, no zoom-punch, no shake.

Captions: burned-in DM Mono 500 at 42px, `#F5F5F5` on solid `#080808` at 88% opacity,
y≈1400. Two lines max, phrase-level chunking, no karaoke highlighting, no emoji.

**Audio-free test:** freeze any frame from 0:00–0:03. If a muted viewer cannot read the
claim and tell it is PKFIT, re-cut.

Note: Grok Imagine watermarks its output and the watermark cannot be removed. Plan
compositions with the watermark corner kept clear of load-bearing text.
