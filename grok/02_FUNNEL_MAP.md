# PKFIT FUNNEL MAP — v1

## 1. Awareness map

| Stage | Prospect's internal sentence | Asset | Status |
|-------|------------------------------|-------|--------|
| Unaware | "I'm just busy. I'll restart Monday." | X posts, `/field-notes` | **Partial gap.** Field notes exists but is not an acquisition surface |
| Problem-aware | "I keep quitting. Something's wrong with me." | Homepage hero + the M01–M05 loop diagram | **Strong.** The sharpest asset in the business. Reframes self-blame into mechanism |
| Solution-aware | "I need a system, not another program." | `/diagnostic`, pkfit-lite, `/peptides` | **Weak link.** Three separate free tools, no shared capture, no shared next step |
| Product-aware | "Is the Blueprint right for me?" | `blueprint-landing.html` | **Gap: no bridge.** Nothing routes diagnostic-takers to the Blueprint |
| Most-aware | "I've run it. What's next." | Stripe Performance Standard, Trainerize, `/apply` | **Gap: no post-purchase sequence.** The receipt is the last contact |

### Assets that must be created

1. **One email list, three doors.** Diagnostic, peptides calculator, and pkfit-lite all
   capture to the same list, tagged by entry point.
2. **The Diagnostic Result Page** — returns a named loop signature (M02 interpretation
   break / M03 avoidance break) and prescribes the rung. This is the missing
   solution-aware → product-aware bridge.
3. **`/proof` as an objection asset, not a trophy case.** Needs 6–8 short receipts
   structured as: starting loop, intervention, what changed, timeframe. Not
   before/afters as the primary unit.
4. **Blueprint → Standard bridge email** at Day 21 of the buyer's 30 days.

## 2. Objection map

### At $37 — The Architect's Blueprint

**O1. "I've bought programs before. They sat in my downloads folder."**
Highest-frequency objection. It is prior-failure grief, not price resistance.
*Pre-empt:* lead with the loop diagram before the deliverables list. The last program
failed because it prescribed at M05 while the break was at M02.
*Placement:* above the fold on `blueprint-landing.html`, and Email 2.

**O2. "$37 is cheap — so it's probably thin."**
*Pre-empt:* price the $37 as a position, not a discount. "Thirty-seven dollars buys the
written system. It does not buy supervision. Supervision is the next rung and it is
priced accordingly." *Placement:* pricing block, FAQ.

**O3. "I don't have 30 clean days."**
Time scarcity, and it is real for the buyer persona.
*Pre-empt:* state the minimum viable session length and that the plan assumes
interruption. "The system is built for a week that breaks. Phase Two exists because Day
9 goes wrong." *Placement:* four-phase section, Email 4.

**O4. "Is this the peptide guy? I'm not doing that."**
The `/peptides` calculator is a strong lead magnet and a live credibility liability with
the mainstream buyer.
*Pre-empt:* **firewall it.** Research-use tool, never a Blueprint component, never
mentioned in the Blueprint sequence. *Placement:* one-line separation statement on
`/peptides`; complete absence from the $37 page.

### At coaching price

**O5. "Another subscription I'll forget to cancel."**
*Pre-empt:* sell a term, not a subscription. "The Standard runs in blocks. A block ends.
You leave with the block's data." *Placement:* `/apply`, ascension email.

**O6. "I can't tell if this coach is real or just good at graphics."**
The site is well-designed, which in this market reads as agency, not practitioner.
*Pre-empt:* the IFBB Pro credential plus the non-portable-credential line, extended with
coach-side artifacts from the console — a redacted client share page, a real coach note,
a PR moment. Show the working, not the physique. *Placement:* `/proof`, pre-application
email.

**O7. "I'll do it myself once I get consistent."**
Deferral disguised as self-reliance. Highest-value objection at the top of the ladder.
*Pre-empt:* name it as an M03 avoidance behavior. "Waiting until you are consistent to
hire structure is the loop selecting for itself." *Placement:* `/apply`, above the form.

**O8. "What if I apply and get rejected."**
*Pre-empt:* publish the filter criteria openly so applying is not a status risk.
*Placement:* `/apply`.

## 3. Email sequence — does not exist yet, build it

Trigger: any free-tool capture. Cadence: Day 0, 1, 3, 5, 7, 10.

**E1 — `Your loop signature`** · Job: deliver the asset, install the vocabulary.
The tool gave you a reading. The reading is a loop signature, not a verdict. Here is the
five-stage model your break sits inside. The break is almost never where you think it
is. → CTA: read the mechanism (homepage `#mechanism`).

**E2 — `The program was not the problem`** · Job: dissolve self-blame.
You have run programs that worked for other people. They were not fraudulent. They
prescribed at M05 — behavior — while your break was at M02, interpretation. A correct
prescription applied at the wrong stage fails every time, and the failure gets filed
under character. It is not character. It is placement. → CTA: field note on M02 breaks.

**E3 — `What a system actually is`** · Job: define the category before competitors do.
A program is a list of prescriptions. A system is a list plus the rules for what happens
when the list breaks. Most weeks break. A system with no Day 9 clause is a program
wearing a system's language. → CTA: see the four phases.

**E4 — `Built for the week that breaks`** · Job: neutralize O3; first direct offer.
The Blueprint assumes interruption. Phase Two exists because Day 9 goes wrong — travel,
a sick child, a deadline. Thirty days, day by day, with a defined minimum session and a
defined re-entry point. Lifetime access. Thirty-seven dollars. → CTA: get the Blueprint.

**E5 — `Thirty-seven dollars buys the system, not supervision`** · Job: O2 + pre-frame
the ladder. The price is a position. Nothing is withheld. What it does not include is a
second set of eyes on your data every week — that is the next rung, and it costs what
supervision costs. Most people do not need it yet. Start where you are. → CTA: get the
Blueprint.

**E6 — `Dele was thirty-nine`** · Job: proof and close.
Business owner, husband, father, down 35 lbs. He did not find more discipline. He found
where his loop broke and put structure at that point. The receipt is his. The mechanism
is transferable. That is the only claim being made. → CTA: get the Blueprint, or apply.

**Post-purchase Day 21 (separate trigger) — `Day 21`** · Job: ascension.
You have run the cycle. You now have data you did not have on Day 1. The next rung is
not a bigger program, it is supervision of that data. → CTA: The Standard.

## 4. Sales-side bots

| Bot | Job | Cadence |
|-----|-----|---------|
| **05 The Forge** | 15–25 tested variants of one asset | On demand, per ship |
| **06 The Interrogator** | Roleplays a skeptical prospect until the copy breaks | Before every launch or page edit |
| **07 The Listener** | Real-time X search for verbatim audience language | Weekly |

Full system prompts in `bots/`. All three exploit generation speed, live search, roleplay,
and fixed-voice rewriting. None is asked to remember, to touch Stripe/Gumroad/email, or
to decide strategy.

## 5. Ethical floor

Restated in full in `00_STACK_CONTEXT.md` §6. It is not advisory. Any bot asked to break
it must refuse and name the line it breaks.
