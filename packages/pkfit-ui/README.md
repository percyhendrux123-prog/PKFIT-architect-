# @pkfit/ui

Canonical React components for the **PKFIT ATLAS chat-UI pattern** (Stage 0.5).

This is a private workspace package inside the `pkfit-app` monorepo. It is the
single source of truth for the chat surface used by the intake, check-in, and
in-app coach experiences.

## Why this exists

Before this package, the same Stage 0.5 chat pattern (turns, bubbles, chips,
slider/streak/CTA cards, composer, etc.) was hand-rolled inline in two places:

- `pkfit-intake-deploy/public/index.html` (vanilla DOM, ~930 lines)
- `pkfit-checkin-deploy/public/index.html` (vanilla DOM, ~1,170 lines)

The pkfit-app React code did **not** yet have an ATLAS chat surface — its
in-app `Assistant.jsx` uses Tailwind + the local `ui/Card`/`ui/Button` set.

This package establishes the canonical React form so all three surfaces can
converge on a single visual + behavioral source of truth in subsequent PRs.
ATLAS canon (tokens, grid, axiom credit) is mirrored from `~/Desktop/ATLAS.md`.

## Components

| Export | Source pattern | Notes |
|---|---|---|
| `Turn` | both | role='agent'/'client', who, optional timestamp |
| `Bubble` | both | typing/caret variants for streamed output |
| `Chip` / `Chips` | both | quick-reply pills, ghostLast option |
| `SliderCard` | check-in `sliderCard` | 1-10 default, configurable submit copy |
| `StreakCard` | check-in `streakCard` | large serif numeral + optional cue |
| `CtaCard` | both | yes/no soft cross-sell |
| `ComposerWrap` | both | fixed-bottom pill input + send button |
| `EmailCard` | intake `emailCard` | validated email input |
| `NextStepCard` | intake `nextStepCard` | italic-serif end-of-flow cue |

All components self-fade/disable after a terminal interaction, matching the
animation defaults in the source HTML.

## Usage

```jsx
// 1. Import the tokens stylesheet ONCE in your app entry (e.g. main.jsx).
import '@pkfit/ui/tokens.css';

// 2. Use components anywhere.
import { Turn, Bubble, Chips, SliderCard, ComposerWrap } from '@pkfit/ui';

function Example() {
  return (
    <>
      <Turn role="agent" who="PK">
        <Bubble>How was the week?</Bubble>
      </Turn>

      <Chips
        options={[
          { label: 'Strong', value: 'strong' },
          { label: 'Drained', value: 'drained' },
        ]}
        onPick={(opt) => console.log(opt.value)}
      />

      <SliderCard
        label="Energy through the week"
        onSubmit={(v) => console.log(v)}
      />

      <ComposerWrap
        placeholder="Type a reply…"
        onSubmit={(text) => console.log(text)}
      />
    </>
  );
}
```

The components do not render their own page-shell (header, app grid,
notches, axiom credit). Those remain the host app's responsibility — they
live in tokens.css comments only as ATLAS reference.

## Contribution rules

1. **No new visual behavior here.** This package is the single source of
   truth for the ATLAS chat pattern. If you need a new variant, propose it
   in ATLAS.md first, then update this package.
2. **Faithful to the HTML source.** Every component in v0.1.0 is a direct
   translation of the corresponding `xxxCard()` builder in
   `pkfit-intake-deploy` or `pkfit-checkin-deploy`. Animations, defaults,
   and post-pick fade behaviors must match.
3. **Tokens-driven.** Colors, fonts, radii — all via CSS custom properties
   in `tokens.css`. No hard-coded hex inside components.
4. **No app-specific logic.** Flow control (which card to show next, what
   to do with the answer) belongs in the host app, not in `@pkfit/ui`.
5. **Named exports only.** Default exports are forbidden; the index re-exports
   each component by name so tree-shaking stays predictable.
6. **No required peer deps beyond React 18.** Don't pull in icon libraries,
   form libraries, or anything else. Inline SVGs only.

## Versioning

Private package, semver-loose. Bump `package.json` `version` whenever you
change a component's prop contract or visual behavior.

## See also

- [`MIGRATION.md`](./MIGRATION.md) — adoption path for `pkfit-intake-deploy`,
  `pkfit-checkin-deploy`, and `pkfit-app`'s `Assistant.jsx`.
- ATLAS canon: `~/Desktop/ATLAS.md`
- Originating issue: [#17](https://github.com/percyhendrux123-prog/PKFIT-architect-/issues/17)
