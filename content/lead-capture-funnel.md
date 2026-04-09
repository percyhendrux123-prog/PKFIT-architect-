# PKFIT Lead-Capture Funnel

**The system that turns a reel comment into an email, an email into a conversation, and a conversation into a Blueprint sale.**

Rooted in the Mirror Collection scripts. Routed through ManyChat. Sequenced to feel like a direct continuation of the reel — not a handoff to a robot.

---

## The Architecture (30-second read)

```
[ Reel on Instagram ]
        ↓  (viewer comments "DIAGNOSIS")
[ ManyChat catches the comment ]
        ↓  (instant DM fires)
[ Welcome DM → asks for email ]
        ↓
[ Email captured → PDF delivered ]
        ↓  (24h delay)
[ Follow-up: "What did you score?" ]
        ↓
[ Score-based personalized pitch ]
        ↓
[ Blueprint CTA → Gumroad ]
        ↓  (if no click in 48h)
[ 5-day drip sequence ]
        ↓
[ Final close → archive lead ]
```

Every message in this funnel echoes the voice of the reel they commented on. No tonal whiplash. No "bot" feeling. Just a one-to-one conversation — automated to scale.

---

## Setup Checklist (do this first)

Complete these before building the flow. Takes ~45 minutes total.

- [ ] **Create a free ManyChat account** at manychat.com
- [ ] **Connect your Instagram business account** (ManyChat will walk you through it)
- [ ] **Design the 7-Point Diagnosis PDF** from `content/lead-magnet-7-point-diagnosis.md` — drop the content into Canva, match your PKFIT dark/gold brand, export as PDF
- [ ] **Host the PDF somewhere public** — easiest options:
  - Upload to Gumroad as a $0 product (free, auto-deliver, tracks downloads)
  - Upload to Google Drive and create a "anyone with the link" share
  - Upload to `/content/` in this repo and serve from Netlify
- [ ] **Copy the direct download link** — you'll paste this into the ManyChat flow
- [ ] **Confirm your Gumroad Blueprint link:** `https://percyhendrux.gumroad.com/l/khcus`
- [ ] **Pick your launch reel** (recommended: Script 8 — "The Diagnosis" from Mirror Collection — because it literally uses the word "diagnosis" as the hook)

---

## Trigger Keywords

In ManyChat → Automation → Keywords (Instagram comments), create triggers for these words:

- `DIAGNOSIS` (primary — use this in your reel captions)
- `BLUEPRINT`
- `MIRROR`
- `STUCK`

All four fire the same flow. Having multiple triggers means viewers who misremember the keyword still enter the funnel. Tag each one so you can see which word performs best:

- `DIAGNOSIS` → tag `trig:diagnosis`
- `BLUEPRINT` → tag `trig:blueprint`
- `MIRROR` → tag `trig:mirror`
- `STUCK` → tag `trig:stuck`

---

## The Flow — Block by Block

Build this in ManyChat under **Automation → New Flow → "Diagnosis Funnel"**. Each block below = one ManyChat message block. Copy the text verbatim. Button labels in `[brackets]`.

### BLOCK 1 — Welcome (fires instantly, 0s delay)

```
Hey {{first_name}}.

You commented. Good. [beat]

That means something in that reel hit. And the fact that you typed the word instead of scrolling past — that's data.

I'm going to send you something free. Before I do, one question.

Are you going to actually sit with it tonight? Or is this another thing you'll save and forget?
```

**Buttons:**
- `[I'll do it tonight]` → Block 2A
- `[Maybe later]` → Block 2B

---

### BLOCK 2A — "I'll do it tonight" → Email Capture

```
Good answer.

Drop your email here and I'll send you The 7-Point Diagnosis. It's Phase 1 of my 30-Day Blueprint, compressed into 15 minutes. Most men find the thing that's been stopping them on the first read.
```

**ManyChat field:** Email capture input.

**On submit:** → Block 3

---

### BLOCK 2B — "Maybe later"

```
Respect. When you're ready, come back to this DM and type DIAGNOSIS. Nothing expires on my end.
```

**Tag:** `cold-lead`
**End flow.**

---

### BLOCK 3 — Deliver the PDF (fires immediately after email captured)

```
Got it, {{first_name}}.

Here it is: [PASTE YOUR HOSTED PDF LINK]

15 minutes. Pen and paper. Answer honestly — the whole thing is worthless if you lie to yourself on the questions.

At the end, you'll have a score out of 21.

When you're done — reply to this DM with just your score. One number. Nothing else.

Trust me. What I send you after the score is worth more than the diagnosis itself.
```

**Tag:** `warm-lead-email-captured`, `pdf-delivered`

---

### BLOCK 4 — 24-hour Follow-up (delay: 24 hours)

```
{{first_name}} — check-in.

Did you run it?

Be honest. Not with me — with yourself.
```

**Buttons:**
- `[Yes. My score is...]` → Block 5A
- `[Not yet. Today.]` → Block 5B
- `[No, and I won't]` → Block 5C

---

### BLOCK 5A — "Yes. My score is..."

```
Drop the number. 0 to 21. Just the digit.
```

**ManyChat field:** Number input (save as `diagnosis_score`).

**On submit:** → Routed to Block 6A, 6B, or 6C based on score range (ManyChat "Condition" block).

---

### BLOCK 5B — "Not yet. Today."

```
Then stop scrolling and do it right now. Won't take 15 minutes.

I'll check back in 24h.
```

**Delay:** 24 hours → loop back to Block 4.

---

### BLOCK 5C — "No, and I won't"

```
Okay. This will be my last message.

Before I stop — one thing.

The fact that you won't do 15 minutes of diagnosis IS the diagnosis. The Blueprint can't fix that. Nothing I sell can fix that.

What you need isn't another program. It's a conversation with yourself about why you reached out in the first place — and why you keep backing away the moment it gets real.

Good luck, {{first_name}}. I mean that.
```

**Tag:** `no-action`
**End flow.**

---

### BLOCK 6A — Score 0–7 (Broken Foundation)

```
That score tells me you're running on broken infrastructure, {{first_name}}.

I want to say this without softening it: at 0–7, you don't have a discipline problem. You have an *order of operations* problem. Most men in your range try to fix everything at once and burn out in 10 days.

The Blueprint was built for exactly this range. Phase 1 identifies which of your weak points to attack FIRST — because if you attack the wrong one, the others collapse again. Phase 2 corrects it. Phase 3 rebuilds the identity. Phase 4 locks it in.

At your score, this isn't a "nice to have." It's the difference between still being stuck a year from now — or not.

Want the full breakdown?
```

**Buttons:**
- `[Send me The Blueprint]` → Block 7
- `[What does it cost?]` → Block 8

---

### BLOCK 6B — Score 8–14 (Scattered Builder)

```
That's the most common score, {{first_name}} — and also the most frustrating place to be.

Here's what it means: you have pieces. Knowledge. Effort. Probably even decent training. But nothing is connected. Your training isn't talking to your nutrition. Your nutrition doesn't respect your recovery. Every system is running in isolation.

You don't need more pieces. You need a framework that turns the pieces you already have into a machine.

That's literally what the Blueprint does. 30 days. Four phases. Each one builds on the last.

Want to see it?
```

**Buttons:**
- `[Send me The Blueprint]` → Block 7
- `[What does it cost?]` → Block 8

---

### BLOCK 6C — Score 15–21 (Execution Gap)

```
That's an advanced score, {{first_name}}. Most men don't land there — so I'm going to be direct with you.

You don't have a knowledge problem. You don't have a structure problem. You have an *execution* problem. You know what to do. You just don't do it consistently enough, for long enough, to get the result you want.

At your score, The Blueprint isn't about teaching you anything new. It's about Phase 3 — Identity Shift. The part most other programs skip entirely. And it's the exact thing that's been keeping you at "almost."

You've been chasing the wrong fix. Let me show you the right one.
```

**Buttons:**
- `[Send me The Blueprint]` → Block 7
- `[What does it cost?]` → Block 8

---

### BLOCK 7 — The CTA

```
Here it is.

30 days. Four phases. Lifetime access. Buy once, run it as many times as you need.

→ https://percyhendrux.gumroad.com/l/khcus

When you buy, come back to this DM and reply "DONE." I'll send you a personal kickoff message within 12 hours.
```

**Tag:** `cta-delivered`
**Delay:** 48 hours → Block 9 (if no purchase confirmed)

---

### BLOCK 8 — "What does it cost?"

```
[PERCY: fill in your actual price here — e.g., "$47. One payment. Lifetime access."]

If that's a yes, the link is below. If it's a no, tell me — and I'll stop messaging.

→ https://percyhendrux.gumroad.com/l/khcus
```

**Buttons:**
- `[I'm in]` → Block 7
- `[Not right now]` → Block 9 (enter drip)

---

### BLOCK 9 — Day 3 Drip (48 hours after Block 7 or Block 8)

```
{{first_name}}. Quick one.

Go back to your diagnosis. Look at just your lowest-scoring section.

Now ask yourself: what would it cost you to leave that unfixed for another year?

Not a pitch. Just a question.
```

**Delay:** 2 days → Block 10.

---

### BLOCK 10 — Day 5 Drip

```
{{first_name}} — I don't chase. But I'm going to say this once.

The gap between the man who runs the diagnosis and the man who runs the program is the gap between "almost" and "actually." 

You've already proven you can do "almost." That's not the problem.

The Blueprint is still in our conversation. When you're ready.

→ https://percyhendrux.gumroad.com/l/khcus
```

**Delay:** 2 days → Block 11.

---

### BLOCK 11 — Day 7 Drip (Final)

```
Final message on this, {{first_name}}.

I'm closing the loop. You know your score. You know what it means. I've said everything I can say.

If you want the Blueprint, it's in our thread.

If you don't — no hard feelings. Good luck. Genuinely.

Either way — don't waste the next 30 days pretending this conversation didn't happen.
```

**Tag:** `drip-complete`
**End flow.**

---

## Reel Caption Template

Use this caption (or a variation) on every reel that should funnel into the flow:

```
Comment DIAGNOSIS below and I'll send you my free 7-point self-assessment.

15 minutes. Pen and paper. It tells you exactly why you're stuck — and what to fix first.

It's Phase 1 of The PKFIT Blueprint. Compressed.

#PKFIT #BodyRecomposition #FitnessDiagnosis
```

---

## Launch Plan — Your First 48 Hours

### Tonight (2 hours of work)
1. Sign up for ManyChat (free tier).
2. Connect your Instagram business account.
3. Drop the `lead-magnet-7-point-diagnosis.md` content into Canva. Match the PKFIT brand (black background, gold `#C8A96E` accent, Bebas Neue headers). Export as PDF.
4. Upload the PDF as a $0 Gumroad product and copy the download link.
5. Build Blocks 1–11 in ManyChat. Copy-paste every message verbatim from this doc.
6. Test the flow on your own Instagram. Comment `DIAGNOSIS` from a second account (or a friend's phone). Confirm every branch fires correctly.

### Tomorrow Morning
1. Film Script 8 from `content/reel-scripts.md` — "The Diagnosis" — as your launch reel.
2. Post with the caption template above.
3. Reply manually to the first 5–10 comments so Instagram's algorithm sees high engagement in the first hour. (After that, ManyChat takes over.)

### Day 2
1. Check ManyChat analytics. See how many commented → how many captured email → how many replied with their score.
2. Message the people already sitting in your DMs manually (use the reactivation scripts if you want — tell me and I'll write them separately).

---

## What to Track

Inside ManyChat, track these numbers weekly. They'll tell you what's working and what's leaking:

1. **Comment-to-DM rate** — of everyone who commented the keyword, how many got the DM? (Should be 100% — if not, your trigger isn't firing right.)
2. **DM-to-email rate** — how many captured their email after the DM? (Target: 60%+. If lower, Block 1 copy needs tightening.)
3. **Email-to-score rate** — how many actually read the PDF and sent their score? (Target: 30%+. If lower, Block 3 delivery message needs more friction reduction.)
4. **Score-to-CTA-click rate** — how many clicked the Blueprint link after their score? (Target: 20%+. If lower, Blocks 6A/B/C need sharper pitches.)
5. **CTA-to-purchase rate** — how many actually bought? (Varies. Track baseline, then optimize.)

The magic metric: **cost per buyer.** If your reels are free (organic), every buyer is pure profit. If you boost reels with ad spend, divide ad spend by buyers to get CPB. Anything under 50% of your Blueprint price is working.

---

## A Note on Voice

Every message in this flow is written in the exact voice of your reels. Low. Controlled. Diagnostic, not desperate. The second you break character — the second one message sounds like a "fitness coach sales DM" — the whole funnel dies.

If you ever feel the urge to soften a line, don't. Your audience is hungry for someone who will talk to them like an adult. That's the whole reason they commented in the first place.

Trust the voice. It's the product.
