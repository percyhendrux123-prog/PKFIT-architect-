# PKFIT MEDIA PLAN — v1

## 1. Channel thesis

**Invest in two. Ignore the rest.**

**X — primary, 70% of effort.** Grok bots live natively where the audience argues.
PKFIT's copy is already declarative one-liners — "Busy is not your blocker. Undefined
routines are." That is a post, not a caption. The reply economy is the only
distribution channel a solo operator can win without a camera, and the only one where
a bot's real-time search converts into same-hour relevance. X also carries the
highest-intent traffic for a $37 digital product.

**Instagram — secondary, 25%.** Reels and carousels are already templated in
`content/`. The 9-slide formula and the 38-second reel structure are production-ready.
Grok Imagine generates the motion assets; the operator does not need to appear on
camera. IG is where the IFBB Pro credential converts to trust for coaching
applications.

**Email is not a channel — it is the terminal.** The `/peptides` calculator and
`/workbook` are the capture points. Every X and IG asset routes to a gated tool, not
directly to Gumroad. Cold traffic buys $37 products at a low single-digit fraction of
a percent; a gated tool captures an order of magnitude more and sells across a month.

**Explicitly killed:** TikTok (no reply economy, demands daily volume the operator
cannot sustain), YouTube long-form (production cost per unit is fatal for one person),
LinkedIn, Threads, Pinterest. Revisit only after X passes 5,000 followers.

## 2. The media roster

| Bot | Job | Input | Artifact | Cadence |
|-----|-----|-------|----------|---------|
| **01 Signal Scout** | Finds the day's live arguments PKFIT can enter with authority | 6 standing watch terms | 6 entry points with links and angle | Daily 07:00 |
| **02 Reply Operator** | Writes the day's X posts and replies in PKFIT voice | Scout's table | 3 posts + 10 replies | Daily 07:15 |
| **03 Frame Room** | Generates all visual assets | One reel script or carousel | 9 slides + 4 clips + cover | Twice weekly |
| **04 Loop Archivist** | Converts the week's winners into IG assets | Top 3 posts by clicks | 1 carousel + 1 reel script | Weekly, Sunday |

Full system prompts in `bots/`.

## 3. Weekly cadence — under 5 hours

| Day | Human (time) | Bots |
|-----|--------------|------|
| Mon | 07:20 — review 13 drafts, cut 3, post the rest across the day (25 min) | Scout 07:00, Operator 07:15 |
| Tue | Review and post (20 min). 20:00 — run Frame Room on the carousel, approve (25 min) | Scout, Operator, Frame Room |
| Wed | Review and post (20 min). Publish the carousel to IG (10 min) | Scout, Operator |
| Thu | Review and post (20 min) | Scout, Operator |
| Fri | Review and post (20 min). Run Frame Room on the reel, approve clips (25 min) | Scout, Operator, Frame Room |
| Sat | Publish the reel. Reply to IG and X comments **by hand — never bot-drafted** (30 min) | — |
| Sun | Pull top 3 posts by clicks, run Loop Archivist, queue next week (35 min) | Archivist |

**Total: 3h50m.** The human does three things only: cuts bad drafts, presses publish,
and answers real humans in comments. Everything upstream of publish is bot output.
Everything downstream of publish is the human's name on the line.

**Standing rule.** `00_STACK_CONTEXT.md` gets re-pasted into every bot at the top of
every session. Grok bots hold nothing. Treat the paste as part of the run.

## 4. The five metrics

| Metric | Why it decides | Target by week 8 |
|--------|----------------|------------------|
| Link clicks from X to a PKFIT property | The only proof the reply economy converts to owned traffic. Likes are noise | 150–400 / week |
| Email captures at `/peptides` and `/workbook` | The terminal. If clicks do not become addresses, the funnel is a leak | 40–90 / week, or 10–15% of clicks |
| Reply-to-follow rate on X | Whether the voice earns authority or just visibility. Follows gained ÷ replies posted | 2–5% |
| Blueprint units at $37 | The only revenue signal at this stage | 4–12 / week |
| **Human edit rate on bot drafts** | The workforce's health metric. High edit rate means prompt drift | Under 30%, trending to 15% |

**Kill conditions.** If X link clicks stay under 100/week at week 8, the problem is the
angle, not the volume — rewrite Signal Scout's watch terms, not the posting frequency.
If edit rate exceeds 50%, stop posting for a week and rebuild the voice contract from
`content/` copy verbatim.
