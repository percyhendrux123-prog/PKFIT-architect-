# THE CONSTRUCT — Series Design Bible

> PKFIT-extended neo-cyberpunk stoic anime. Vertical HTML/CSS/SVG stills. Long-running formula.

**Status:** Approved 2026-04-23. Living document. Update this file before changing any canon.
**Author:** PK / The Architect.
**Deliverable container:** 1080×1920 single-frame HTML artifacts generated in Claude design.

---

## 1. PREMISE

In a near-future city that looks exactly like ours, every man lives inside a hidden cognitive architecture called **The Construct** — a five-layer neural system that keeps him cycling through the same behavior, the same identity, the same default. Most men cannot perceive it. A trained few can. One of them — **The Architect** — enters the Construct of one Subject at a time, diagnoses which of the Seven Laws they have failed to prove, and either walks out with a man ascended or leaves a casualty who will return, years later, as a Warden.

Not a power fantasy. A diagnosis fantasy.

---

## 2. TONE DOCTRINE (inherited from PKFIT)

- No exclamation points.
- No hype language.
- No therapy language.
- No shame framing.
- No generic motivation.
- Mechanism-based language only.
- Diagnosis over motivation.
- One thought per line.
- Short deliberate lines.
- Every output sounds like it was written by a man who has already won.

The tone doctrine is in-universe. The Architect *is* the voice. Breaking tone breaks canon.

---

## 3. WORLD — The Two Layers

### Surface World
Looks like our world. Rain-black asphalt. Empty gyms at 4 AM. Black SUVs. Hotel suites with the lights off. Parking garages. Stairwells. Airports at closing time.

- No neon.
- No drones.
- No chrome.
- No visible future tech.
- **Palette:** graphite, charcoal, concrete, bone, oil-on-asphalt wet black.
- **Single accent:** matte gold `#C8A96E` — Architect's emblem, his coin, one thread in his coat.

### The Construct
A wireframe geometry rendered in cold cyan `#6FC3E0` over dead black `#050505`.

- Unproven Laws show as missing floors, fractured walls, unfinished edges, phantom geometry.
- As a Subject proves a Law, that section *solidifies* — wireframe to **matte concrete** `#2A2A2A`.
- Fully ascended Construct = solid, walkable, owned. No more wireframe.
- Geometry rule: Euclidean, right angles, brutalist. Never organic. Never curved except for one Warden (The Siren).

Characters with discipline perceive both layers simultaneously. The viewer always sees what The Architect sees.

### Color Tokens (canonical)

| Token | Hex | Use |
|---|---|---|
| `--void` | `#050505` | Background of the Construct |
| `--graphite` | `#141414` | Surface world base |
| `--concrete` | `#2A2A2A` | Proven Construct tiles |
| `--bone` | `#D6D3CA` | Subject skin / raw material |
| `--gold` | `#C8A96E` | Architect's emblem, ascended status, brand marks only |
| `--cyan` | `#6FC3E0` | Construct wireframe, Architect's visor slit |
| `--siren` | `#00C2B0` | THE SIREN's accent (cyan-adjacent, but wrong) |
| `--silver` | `#AEB2B8` | THE WITNESS's mirrors |
| `--whiteout` | `#ECECEC` | THE FOG |
| `--loss` | `#8A8A8A` | Failed/archived Subjects |

Gold is scarce. If it appears more than once per still, it is overused.

---

## 4. THE ARCHITECT — Visual Bible

### Silhouette
- Tall. Long charcoal trench coat, knee-length, weighted hem.
- Hood up. Broad shoulders. No cape, no flow — gravity-accurate.
- Stands square. Never slouched.

### Face
- Matte black visor covering entire upper half.
- Single horizontal slit of cyan light — **the read**.
- Visor is never removed on camera. Ever.
- Lower jaw sometimes visible. Never smiling.

### Hands
- Matte black gloves.
- One gold band on the left ring finger — **the Standard**.

### Signature Object
- A matte black coin, edge-milled, PKFIT sigil in gold on the face.
- Always in his left hand, turned slowly between fingers during diagnosis.
- **Placed flat on a surface** = Subject is being tested. The coin is the threshold.

### Behavioral Rules
- Never shown: eating, smiling, sleeping, running, raising voice, expressing emotion in frame.
- Never speaks in dialogue balloons. Voice is **hard type overlay only**.
- Four to twelve words per line. Always.
- Weight on back leg = diagnosing. Step forward = verdict.

### The Architect's Past (unannounced canon)
- The Architect was **Subject 001**.
- This is never stated explicitly earlier than Season 4 finale.
- Hints are planted in ~1 of every 15 stills (different coin, different posture, a second silhouette in a reflection, a Subject number of `001`).
- Zero continuity burden. Background only.

---

## 5. THE FIVE WARDENS — Antagonist Bible

Each Warden = one Mechanism of the Default Paralysis Loop, rendered as both a silhouette figure *and* an environmental layer inside the Subject's personal Construct.

| # | Warden | Mechanism | Layer | Cut By | Accent |
|---|---|---|---|---|---|
| I | **THE HUSK** | Emotion suppression → energy depletion | Greyed city where every step takes twice as long | **Law I** — Structure outlives motivation | cyan, but dimmed |
| II | **THE WITNESS** | Defaults → evidence → identity | Hall of mirrors, each reflection shows Subject at his lowest | **Law IV** — Behavior becomes identity | silver |
| III | **THE FOG** | Identity misalignment → cognitive fog | Streets that dissolve underfoot, no coordinates | **Law V** — Standards remove negotiation | whiteout |
| IV | **THE SIREN** | Fog registers as threat → emergency response | ER/hospital loop — every "rescue" cycles back to default | **Law III** — Discipline is promises kept | siren teal |
| V | **THE LOCK** | Locked system → loop restarts | Perfect black room, no input, no exit | **Law VII** — A man becomes what he moves toward | absolute void |

### Warden Design Rules
- Always silhouette. Never a detailed face.
- Matte black body, light-traced edges in Warden's accent color.
- Scale varies — The Husk is gaunt/thin, The Lock is massive and still.
- Wardens do not monologue. They *are* the mechanism.
- Wardens do not move dramatically. They block, displace, or persist.

### The Fallen Loop (canonical mechanic)
- Every Subject who fails to ascend is **archived**.
- 3–5 arcs later, that Subject returns as a **Warden-variant** inside another Subject's Construct.
- Their dossier callback is one HUD line: `VARIANT — ORIGIN: SUBJ-0xx`.
- This is the in-universe reason Wardens exist.
- Audience should learn this *without being told* by about arc 15.

---

## 6. THE SEVEN LAWS — Power System

Laws are not techniques. They are perceptual + behavioral upgrades. Each Law is a binary: `PROVEN` / `UNPROVEN` / `CONTESTED`.

| Law | Text | In-Universe Manifestation |
|---|---|---|
| I | Structure outlives motivation | Posture holds under Construct stress. Without it, form collapses under load. |
| II | Potential means nothing without proof | HUD flickers until proven. Proven = solid matte tile. |
| III | Discipline is promises kept | Bridges that exist only if a promise was kept. |
| IV | Behavior becomes identity | Silhouette sharpens/degrades visibly based on last 7 actions. |
| V | Standards remove negotiation | Phantom figures offer deals. V silences them. |
| VI | Discipline spreads | Proving a Law in one zone solidifies unrelated zones. |
| VII | Moves toward becomes | Construct geometry bends toward persistent direction. |

HUD readout of all seven Laws is present in **every** still (Zone 2).

---

## 7. POST TEMPLATE — The Five Zones (locked forever)

Every drop is a **1080×1920** HTML/CSS/SVG artifact with these five zones, in this order:

```
Z1  TIMESTAMP  ·  CONSTRUCT // SUBJ-047          [mono, small]
Z2  I ✓  II ✗  III ✗  IV ✓  V ✗  VI —  VII —    [HUD band]
Z3  [ THE CEL — composition ]                    [center, largest]
Z4  "HE HAD NOT PROVEN LAW 3."                   [PK voice, hard type]
    "THE FLOOR OPENED."
Z5  ARC 01 · POST 2/5 · PKFIT.CONSTRUCT          [footer]
```

### Zone Dimensions (1080×1920 canvas)

| Zone | Height (px) | Contains |
|---|---|---|
| Z1 | 72 | Timestamp + file code, mono type, `--bone` on `--void` |
| Z2 | 96 | Seven Law status markers, evenly distributed |
| Z3 | 1440 | The cel — composition of scene or HUD-only |
| Z4 | 216 | Voice line(s), ALL CAPS, display sans, letter-spacing tight |
| Z5 | 96 | Arc marker, post number, brand footer |

### Type System

- **Z1 / Z5 (file codes):** JetBrains Mono or IBM Plex Mono, 28–32px, `--bone`
- **Z2 (HUD):** Inter Display or Söhne Breit, ALL CAPS, 26px, status marker monospace
- **Z4 (voice):** Inter Display / Söhne Breit or NB International, ALL CAPS, 72–96px, letter-spacing `-0.02em`, `--bone`
- **Gold never used in type** except for PROVEN Law markers and the final ascension still

### HTML Skeleton (starter)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>CONSTRUCT // SUBJ-047 // POST 02</title>
<style>
  :root {
    --void:#050505; --graphite:#141414; --concrete:#2A2A2A;
    --bone:#D6D3CA; --gold:#C8A96E; --cyan:#6FC3E0;
  }
  html,body{margin:0;padding:0;background:var(--void);color:var(--bone);}
  .frame{
    width:1080px;height:1920px;margin:0 auto;
    display:grid;grid-template-rows:72px 96px 1fr 216px 96px;
    font-family:'Inter',sans-serif;
  }
  .z1,.z5{font-family:'JetBrains Mono',monospace;font-size:24px;
    display:flex;align-items:center;padding:0 48px;letter-spacing:0.04em;}
  .z1{justify-content:space-between;border-bottom:1px solid #1a1a1a;}
  .z5{justify-content:space-between;border-top:1px solid #1a1a1a;color:#888;}
  .z2{display:grid;grid-template-columns:repeat(7,1fr);
    align-items:center;padding:0 48px;border-bottom:1px solid #1a1a1a;
    font-size:22px;text-transform:uppercase;letter-spacing:0.1em;}
  .law{display:flex;gap:8px;align-items:center;}
  .law .n{color:#666;}
  .law .s.proven{color:var(--gold);}
  .law .s.unproven{color:#555;}
  .law .s.contested{color:var(--cyan);}
  .z3{position:relative;overflow:hidden;background:var(--void);}
  .z4{display:flex;flex-direction:column;justify-content:center;
    padding:0 64px;text-transform:uppercase;font-weight:700;
    font-size:84px;line-height:1.05;letter-spacing:-0.02em;
    border-top:1px solid #1a1a1a;}
</style>
</head>
<body>
  <div class="frame">
    <div class="z1">
      <span>03:47:12</span>
      <span>CONSTRUCT // SUBJ-047</span>
    </div>
    <div class="z2">
      <span class="law"><span class="n">I</span><span class="s proven">✓</span></span>
      <span class="law"><span class="n">II</span><span class="s unproven">✗</span></span>
      <span class="law"><span class="n">III</span><span class="s unproven">✗</span></span>
      <span class="law"><span class="n">IV</span><span class="s proven">✓</span></span>
      <span class="law"><span class="n">V</span><span class="s unproven">✗</span></span>
      <span class="law"><span class="n">VI</span><span class="s">—</span></span>
      <span class="law"><span class="n">VII</span><span class="s">—</span></span>
    </div>
    <div class="z3">
      <!-- THE CEL — composition goes here (SVG / CSS illustration) -->
    </div>
    <div class="z4">
      <div>HE HAD NOT PROVEN LAW 3.</div>
      <div>THE FLOOR OPENED.</div>
    </div>
    <div class="z5">
      <span>ARC 01 · POST 2/5</span>
      <span>PKFIT.CONSTRUCT</span>
    </div>
  </div>
</body>
</html>
```

This skeleton is the baseline every Claude-design session starts from.

---

## 8. POST TYPES — Weekly Ritual (3 drops/week)

| Day | Type | Z3 Composition Rule | Voice Line Rule |
|---|---|---|---|
| **Monday** | **DIAGNOSIS** | Wide shot. Architect foreground, Subject middle-distance, Warden silhouette visible in background or periphery. Construct wireframe layered on Surface geometry. | A *read* — one sentence of mechanism diagnosis. |
| **Wednesday** | **PROOF** | Close to medium shot. Subject attempting the Law. Construct visibly solidifies (proof) or fractures (fail) in the frame. Architect usually absent or peripheral. | The Law itself, named. Plus verdict if applicable. |
| **Friday** | **SCAN** | HUD-only still. No figures. Pure data — Subject's current Construct topology, annotated by Architect in white hand-scrawl over the wireframe. | Architect's annotation. Technical. No narrative. |

---

## 9. ARC STRUCTURE — 5 Posts per Subject (12 days)

| Post | Day | Type | Beat |
|---|---|---|---|
| 1/5 | Mon | Diagnosis | Architect arrives. Warden identified. |
| 2/5 | Wed | Proof | First Law attempt. |
| 3/5 | Fri | Scan | Mid-arc topology. |
| 4/5 | Mon | Proof | Second Law attempt / crisis. |
| 5/5 | Wed | Verdict | Ascension *or* archival. |
| — | Fri | **Anchor** | Breather — lore, b-roll, Law spotlight, or Architect vignette. |

**Cycle = 6 posts / 14 days.** → 26 arcs/year.

---

## 10. SEASON STRUCTURE — 10 arcs per season (~5 months)

| Season | Thematic Law |
|---|---|
| 1 | I — Structure |
| 2 | II — Potential |
| 3 | III — Discipline |
| 4 | IV — Behavior |
| 5 | V — Standards |
| 6 | VI — Spread |
| 7 | VII — Direction |
| 8+ | Integration / The Architect's Past surfaces |

Each season opens with a **Genesis** drop (Architect vignette, title card) and closes with an **Audit** drop (retrospective HUD of all Subjects that season — ascended in gold, archived in cyan, ready for Fallen Loop return).

---

## 11. SCOPE DISCIPLINE — what this series is NOT

- No motion. No animation. Single stills only.
- No dialogue balloons. Voice is overlay type only.
- No named characters except **The Architect**. Subjects are numbers. Wardens are titles.
- No shonen combat. No power-ups. No transformations.
- No hype. No exclamation points. Ever.
- No hashtags or platform-speak inside the stills. Captions live outside the frame.
- No color outside the token palette.
- No fonts outside the type system.

---

## 12. PRODUCTION FORMULA — The Claude-Design Loop

### Arc Intake Form (fill once per arc, ~10 minutes)

```
ARC_NUM:            [e.g. 01]
SUBJECT_NUM:        [e.g. 047]
SUBJECT_PROFILE:    [one line — age, role, weight/status, dormant disciplines]
UNPROVEN_LAWS:      [e.g. I, III, V]
WARDENS_IN_PLAY:    [e.g. THE HUSK, THE FOG]
VERDICT_TARGET:     [ASCEND or ARCHIVE]
ARCHITECT_PAST_TELL: [optional: which subtle detail if any in this arc]
```

### Master System Prompt (paste at start of every Claude-design session)

> You are generating one single vertical HTML/CSS/SVG artifact for a series called **THE CONSTRUCT**. The canvas is exactly **1080×1920px**. The artifact uses a locked 5-zone template (Z1 file header, Z2 HUD band, Z3 cel, Z4 voice line, Z5 footer). The tone is stoic, diagnostic, cold. Never use exclamation points. Never use hype language. Use the provided color tokens and type system exactly. All text in Z4 is ALL CAPS, 4–12 words per line. The Architect is a hooded trench-coated silhouette with a matte visor and single horizontal cyan slit of light. The Construct is wireframe cyan over void black. The Surface World is muted graphite with matte gold accent. Refer to the attached HTML skeleton and series bible. Generate only one self-contained HTML document per request.

*(Attach the skeleton from Section 7 and the relevant Warden/Law descriptions each session.)*

### Per-Post Prompt Templates

**Monday — Diagnosis:**
```
Generate post 1/5 of ARC_NUM for SUBJECT_NUM.
Subject profile: [paste from arc intake].
Type: DIAGNOSIS.
Z1: TIMESTAMP="[time]"  FILE="CONSTRUCT // SUBJ-[num]".
Z2 Law states: [list proven/unproven/contested per Law].
Z3: Wide composition. The Architect in foreground (hooded silhouette, left-third, back leg weighted).
    Subject middle-distance (center), small, shown in [posture that reveals the mechanism].
    [Warden name] silhouette visible in [location] of frame.
    Construct wireframe layered over Surface geometry.
    Palette: void background, cyan wireframe, single matte gold accent on Architect's coin.
Z4: Voice line (diagnostic, 1–2 sentences, 4–12 words per line):
    [first line — the read]
    [second line — the consequence]
Z5: ARC [num] · POST 1/5 · PKFIT.CONSTRUCT
Return the complete HTML document.
```

**Wednesday — Proof:**
```
Generate post 2/5 or 4/5 of ARC_NUM for SUBJECT_NUM.
Type: PROOF.
Z1: TIMESTAMP, FILE.
Z2 Law states: [updated].
Z3: Close or medium shot. Subject attempting Law [number].
    If Law proven: Construct section visibly solidifies (wireframe → matte concrete) in the frame.
    If Law failed: Construct fractures, edges break off.
    Architect peripheral or absent.
Z4: The Law, named, plus verdict if final.
    Example: "LAW III. PROMISE KEPT." / "LAW III. UNPROVEN."
Z5: ARC [num] · POST [n]/5 · PKFIT.CONSTRUCT
```

**Friday — Scan:**
```
Generate post 3/5 of ARC_NUM for SUBJECT_NUM.
Type: SCAN. HUD-only. No human figures.
Z1: TIMESTAMP, FILE.
Z2 Law states: [current].
Z3: Top-down or isometric Construct topology map of SUBJECT_NUM's personal Construct.
    Wireframe cyan on void black.
    Proven zones shown as solid matte tiles.
    Unproven zones shown as wireframe.
    Warden positions marked with small silhouette icons.
    Architect's annotations: hand-scrawled white notes over the diagram pointing to structural weaknesses.
Z4: Architect's annotation (technical, no narrative).
    Example: "STRUCTURE HOLDS AT LAW 1." / "FOG ADVANCES FROM NORTH."
Z5: ARC [num] · POST 3/5 · PKFIT.CONSTRUCT
```

**Friday — Anchor (between arcs):**
```
Generate the anchor drop between ARC N and ARC N+1.
Type: ANCHOR. No Subject. Free composition.
Options — pick one:
  - Architect vignette (silent moment, Surface World)
  - Warden lore card (silhouette + layer description)
  - Law spotlight (single Law text over Construct wireframe)
  - Genesis/Audit drop (season boundary only)
Z1: TIMESTAMP, FILE="CONSTRUCT // ANCHOR".
Z2: Blank or stylized.
Z3: Composition matches the chosen anchor type.
Z4: One voice line.
Z5: ANCHOR · PKFIT.CONSTRUCT
```

---

## 13. ARC 001 — Launch Arc (reference)

To seed production. Use this exact arc to generate the first 5 posts.

```
ARC_NUM:            01
SUBJECT_NUM:        047
SUBJECT_PROFILE:    38. Finance. 220lbs. Lifted for a decade, quit 4 years ago. Sleeps 5h. Eats late.
                    Calls it "too busy." Has not told his wife he hates his work.
UNPROVEN_LAWS:      I, III, V
WARDENS_IN_PLAY:    THE HUSK (primary), THE FOG (secondary)
VERDICT_TARGET:     ASCEND
ARCHITECT_PAST_TELL: None in Arc 01. (Clean launch.)
```

Arc 01 narrative beats:
- **Post 1 (Diagnosis):** Architect arrives in Subject 047's Construct at 03:47. Warden visible: The Husk, dimly lit, far end of a graphite corridor. Voice: *"Law 1 unproven. His structure collapsed with his motivation. Predictable."*
- **Post 2 (Proof):** Subject attempting Law I — holding form under fatigue. Construct floor fractures under him, then solidifies when he holds. Voice: *"Law I. Structure holds."*
- **Post 3 (Scan):** HUD topology. Law I proven. Fog advancing from Subject's domestic zone. Voice: *"Fog advances from north. III and V next."*
- **Post 4 (Proof):** Subject attempts Law III — a kept promise. Bridge forms over a void. Voice: *"Law III. Promise kept."*
- **Post 5 (Verdict):** Subject proves Law V by walking past a phantom offering him a deal. Construct solidifies across all zones. Ascended. Voice: *"Subject 047. Ascended."*

---

## 14. LIVING CANON RULES

- Never break the tone doctrine (Section 2).
- Never exceed color token palette (Section 3).
- Never violate scope discipline (Section 11).
- When introducing new element (new Warden variant, new Law manifestation): add it to this bible before it appears in a post.
- When a Subject fails: add their dossier to an archive ledger. Mark return date 3–5 arcs out.
- When the Architect's Past tell appears in a post: log it in a tells ledger so reveals compound.

---

## 15. OPEN TERRAIN (to refine in implementation plan)

- Exact font licensing / fallback stack for JetBrains Mono, Inter Display, Söhne Breit.
- Whether Claude design can render the Construct wireframe convincingly in SVG (likely yes) or whether we need a pre-built SVG library of geometry primitives.
- The Architect silhouette — whether to hand-craft a single reusable SVG once and inject it into every still, or re-generate per post. Recommended: **pre-built SVG, reused**.
- The Warden silhouettes — same question. Recommended: **pre-built SVG library of all five Wardens**.
- Caption format for the social platform layer (what text goes on the Instagram/TikTok caption vs inside the frame).
- Archive ledger and tells ledger — format, location, how maintained.
- Render pipeline — screenshot from browser, headless renderer, or Claude design's built-in export?

These become the implementation plan.

---

*End of series design bible. This document is canon. Update before deviation.*
