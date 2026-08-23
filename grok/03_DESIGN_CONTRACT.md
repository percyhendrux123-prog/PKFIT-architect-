# PKFIT DESIGN CONTRACT — v1

> Paste this file into any visual bot before asking for anything. It overrides the
> model's aesthetic instincts. Brand posture: **dark editorial engineering.**
> Instruments, not inspiration. Every visual reads as a readout, a spec sheet, or a
> field note — never a supplement ad.

---

## 1. Color — roles binding, hex binding

| Token | Hex | Role |
|-------|-----|------|
| `--pk-bg` | `#080808` | Page ground. The only background |
| `--pk-surface` | `#101010` | Raised card / panel |
| `--pk-surface-2` | `#141414` | Nested panel, input fill |
| `--pk-line` | `#1F1F1F` | Hairlines, 1px rules, table borders |
| `--pk-text` | `#F5F5F5` | Primary text |
| `--pk-text-2` | `#A8A8A8` | Secondary / body at length |
| `--pk-text-3` | `#6F6F6F` | Labels, meta, timestamps |
| `--pk-gold` | `#C8A96E` | THE accent. CTA, active state, key numeral |
| `--pk-gold-hi` | `#E8C882` | Hover / highlight only |
| `--pk-gold-dim` | `#8A7448` | Gold on gold, disabled accent |
| `--pk-ok` | `#4CAF50` | Success / validated only |
| `--pk-alert` | `#FF453A` | Error only |

**Gold coverage stays under 8% of any surface.** If gold reads as a theme color
instead of a pointer, it is wrong.

## 2. Type

Display: **Bebas Neue** 400, uppercase, `letter-spacing: 0.02em`.
Body / UI: **DM Mono** 300/400/500, `letter-spacing: 0.01em`. Never uppercase below
0.875rem except labels at `0.16em` tracking.

| Step | rem | Use |
|------|-----|-----|
| `d1` | 5.75 | Hero display (clamp 2.75 → 5.75) |
| `d2` | 4 | Section opener |
| `d3` | 2.75 | Card headline |
| `h1` | 2 | Sub-headline |
| `h2` | 1.5 | Block title |
| `b1` | 1 | Body (line-height 1.65) |
| `b2` | 0.875 | Dense body, table |
| `lbl` | 0.75 | Uppercase label, 0.16em tracking, `--pk-text-3` |

## 3. Spacing, radius, motion

**Spacing** (4px base): `4 8 12 16 24 32 48 64 96 128 192`. Section rhythm `96` mobile
/ `128` desktop. Nothing lands off-scale.

**Radius**: `0` is the default — images, cards, section panels. `2px` on inputs and
buttons. `999px` only on status pills. The brand is orthogonal.

**Motion**: durations `120 / 200 / 320 / 560ms`. Standard ease
`cubic-bezier(0.22, 1, 0.36, 1)`. Exit `cubic-bezier(0.4, 0, 1, 1)`. Scroll reveals:
24px rise + opacity, 320ms, 60ms stagger, max 3 items per stagger group. Every motion
block wrapped in `@media (prefers-reduced-motion: reduce)`.

## 4. NEVER

1. No emoji. Anywhere. Not in copy, not in UI, not in captions.
2. No gradient as decoration. One exception: a single vertical `#080808 → #0D0D0D`
   scrim behind text on photography. No gold gradients, no glow, no neon.
3. No stock gym cliché — no chalk clouds, no barbell silhouettes, no flexing torso,
   no lens flare, no shredded-abs close-up, no water splash, no before/after collage.
4. No blue, teal, purple, or pink. Off-palette color is an automatic reject.
   The `#3d00ff` / `#ff4cbf` values in `social-concepts.html` are non-brand
   experiments — do not sample from that file.
5. No drop shadows for depth. Depth = surface step + 1px `--pk-line`.
6. No centered body copy over 2 lines. No justified text.
7. No third typeface, no font substitutes, no italics on Bebas.
8. No fake data in charts unless labeled `SAMPLE`.
9. No rounded app-card look, no glassmorphism — that language belongs to Axiom,
   a different business.
10. No exclamation marks. No hype adjectives.

## 5. Ruling: keep two type stacks, deliberately

**`PKFIT-architect-` stays Bebas Neue + DM Mono. `PK-PERCYKEITH` stays Fraunces +
Space Grotesk. Do not unify.**

They serve opposite jobs. The marketing site sells a system to a cold stranger —
condensed uppercase and mono read as instrumentation and authority. The client share
page is a post-purchase artifact handed to one person who already paid; Fraunces'
warmth is what makes "your week 4" feel earned rather than sold. Unifying would either
make the marketing site soft or make the client's proof page feel like an upsell.
Both are conversion losses.

**What is unified across both:** color roles, spacing scale, radius rules, motion
curves, and the NEVER list. `PK-PERCYKEITH`'s `T` object in `src/App.jsx` should
consume `--pk-*` values under the same role names, so a bot handed this contract can
produce for either property by changing one line — the type stack.

`pkfit-execution` (Axiom) is out of scope and shares nothing. Do not let it leak into
PKFIT visuals.

---

## 6. Image prompt template — Grok Imagine / Aurora

### Fixed preamble — never edit

> Dark editorial engineering poster. Background pure near-black #080808, flat and
> matte, no gradient. Single accent color muted antique gold #C8A96E used sparingly,
> under 8% of frame. Text and linework in off-white #F5F5F5 with secondary grey
> #A8A8A8. Hard 1px hairline rules, orthogonal grid, sharp square corners, zero
> rounded shapes. Precise technical diagram sensibility — schematic, instrument
> panel, spec sheet. Flat 2D graphic design, no photographic depth of field, no 3D
> render, no bevel, no glow, no shadow. High contrast, generous negative space,
> composition anchored on a strict left margin.

### Variable slots

`[FORMAT]` aspect + pixel size · `[SUBJECT]` the one graphic object ·
`[FOCAL TEXT]` ≤6 words, uppercase · `[SUPPORT TEXT]` ≤10 words, sentence case ·
`[LABEL]` a small mono tag · `[GOLD TARGET]` the single element allowed to be gold ·
`[COMPOSITION]` where the mass sits.

### Negative prompt — paste every time

> emoji, icons, emoticons, gradient background, neon, glow, lens flare, bokeh, blue,
> teal, purple, pink, rainbow, gym photography, barbell, dumbbell, chalk dust,
> muscular torso, shirtless man, before and after body comparison, protein powder,
> sweat droplets, water splash, motivational poster, drop shadow, glassmorphism,
> frosted glass, rounded corners, 3D render, bevel, embossed metal, gold gradient,
> gold foil, ornate, script font, serif display font, italic, watermark, stock photo,
> cluttered layout, centered paragraph text, exclamation mark

### Worked example A — Reel cover (1080×1920)

> [preamble] · Format 9:16, 1080x1920. Subject: a single vertical timeline rule
> running down the left third with four small square nodes, the second node filled
> antique gold. Focal text "DISCIPLINE IS NOT THE PROBLEM" set in tall condensed
> uppercase sans, off-white, occupying the lower-middle third, four lines, tight
> leading. Support text "Episode 01" small monospace, letter-spaced, top right.
> Label "SYSTEM > MOTIVATION" small monospace uppercase across the bottom margin in
> grey. Gold target: node two only. Composition: text mass low-left, top 220px of
> frame empty. [negative prompt]

### Worked example B — Carousel background (1080×1350)

> [preamble] · Format 4:5, 1080x1350. Subject: an empty schematic frame — a faint
> 12-column grid at 6% opacity with two thin gold corner ticks at the top-left and
> bottom-right, plus a horizontal hairline 240px from the bottom. No headline text,
> no body text, no numerals — this is a background plate for text added later.
> Label: none. Gold target: the two corner ticks. Composition: entirely empty center,
> all structure on the perimeter. [negative prompt]

### Worked example C — OG card (1200×630)

> [preamble] · Format 16:9, 1200x630. Subject: a small technical readout block on the
> right — three stacked monospace rows reading "PHASE 01", "PHASE 02", "PHASE 03"
> with a thin progress rule beside each, the first rule filled gold. Focal text
> "THE PKFIT BLUEPRINT" tall condensed uppercase, off-white, left half, two lines.
> Support text "A 30-day body recomposition system" monospace grey directly beneath.
> Label "PKFIT" small monospace top-left. Gold target: the first progress rule.
> Composition: 50/50 vertical split, 80px safe margin on all sides, nothing critical
> within 40px of any edge. [negative prompt]

---

## 7. Short-video spec — 9:16, 1080×1920

**Safe areas.** Full canvas 1080×1920. Top 220px and bottom 420px are platform chrome
— no text there, ever. Left/right margin 96px. The **live band is y=220→1500**.
Primary text sits inside y=560→1240 so it survives Reels, Shorts, and TikTok
simultaneously.

**Type at 1080×1920.** Hook line: Bebas Neue, 132px, uppercase, 0.02em tracking,
line-height 0.92, max 4 lines, left-aligned to the 96px margin. Secondary / step line:
DM Mono 500, 46px, line-height 1.5. Micro-label: DM Mono 400, 28px, 0.16em tracking,
`#6F6F6F`. Numerals in gold when they mark position (`01 / 03`); everything else
off-white.

**Pacing — mapped to the existing 38-second reel structure:**

| Beat | Time | On screen | Cuts |
|------|------|-----------|------|
| Hook | 0:00–0:03 | One contrarian line, 132px, word-by-word at 120ms | 1 |
| Tension | 0:03–0:10 | The mistake, 2 lines max, gold strike-through on the wrong word | 2 |
| System shift | 0:10–0:21 | The principle, one sentence, held still 4s minimum | 2 |
| Action steps | 0:21–0:33 | Three steps, `01/02/03` gold numeral + mono line, 4s each | 3 |
| CTA | 0:33–0:38 | "GET THE BLUEPRINT" + `percyhendrux.gumroad.com/l/khcus` | 1 |

Max 9 cuts total. No cut shorter than 800ms. Transitions are hard cuts or a 200ms gold
hairline wipe — no crossfade, no zoom-punch, no shake.

**Captions.** Burned-in, DM Mono 500 at 42px, `#F5F5F5` on a solid `#080808` box at
88% opacity, at y≈1400, never over the hook type. Two lines maximum, phrase-level
chunking — not word-by-word karaoke. No color-highlighted keywords, no emoji, no
auto-caption styling. Punctuation kept, sentence case.

**Audio-free legibility test:** freeze any frame between 0:00 and 0:03. If a muted
viewer cannot read the claim and tell it is PKFIT, re-cut.
