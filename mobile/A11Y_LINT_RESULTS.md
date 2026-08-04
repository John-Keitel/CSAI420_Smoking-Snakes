# Mobile Accessibility Lint — Setup and Findings

**Tool**: `eslint-plugin-react-native-a11y@^3.5.1`, config `plugin:react-native-a11y/all` (the plugin's own README: "if you are unsure which one to use, in most cases `all` can be safely used" — appropriate here since this app targets both iOS and Android)
**Run against**: `mobile/app/` on `feat/onboarding-chat-ui` (PR #66), as of this branch's point
**Date**: 2026-08-04
**Command**: `npm run lint:a11y` (from `mobile/`)

## Why this tool, and not axe-core

axe-core (and `@axe-core/playwright`) needs a real DOM to inject into and scan. This repo has none: every route under `src/app/` is a `route.ts` JSON API handler — `find`/`git ls-tree` confirms zero `page.tsx`/`page.ts` files anywhere — and `mobile/` is React Native, which renders native platform views, not HTML/DOM. axe-core doesn't apply to either surface. `eslint-plugin-react-native-a11y` is the closest real equivalent for React Native: static, AST-based rule checking for known accessibility mistakes, genuinely automated, no simulator/device infrastructure required.

## Setup notes

- **ESLint pinned to `^8.57.1` inside `mobile/`'s own `package.json`**, separate from the root project's ESLint 9. The plugin's declared peer range is `eslint: '^3 || ^4 || ^5 || ^6 || ^7 || ^8'` — it does not support ESLint 9. `mobile/` is already an independent npm project with its own lockfile, so this doesn't affect the root project at all.
- **`mobile/.eslintrc.json`** is new — `mobile/` had no ESLint configuration of any kind before this.
- **`ESLINT_USE_FLAT_CONFIG=false`** is required in the `lint:a11y` script. Without it, ESLint 8.57 auto-detects the root project's `eslint.config.mjs` one directory up and switches into flat-config mode, ignoring `mobile/.eslintrc.json` entirely and failing with "You're using eslint.config.js, some command line flags are no longer available." This is a known ESLint 8.57 transition-period behavior, not something specific to this repo's setup.

## Results: 9 violations, real code, not fixed

Ran clean against nothing — this is the actual output on the real `feat/onboarding-chat-ui` code, unmodified:

```
app/components/chat/ChatSheet.js
  211:17, 224:25, 247:29  react-native-a11y/has-accessibility-hint

app/components/chat/InputBar.js
  61:17, 73:17  react-native-a11y/has-accessibility-hint

app/components/chat/MessageList.js
  52:17  react-native-a11y/has-accessibility-hint

app/screens/SignUpScreen.js
  46:17, 58:17, 69:17  react-native-a11y/has-valid-accessibility-descriptors
```

### Category 1 — `SignUpScreen.js`: real, unambiguous gap

The standard (non-chat) sign-up form's three interactive elements — the email `TextInput` (line 46), the password `TextInput` (line 58), and the "Sign up" `TouchableOpacity` (line 69) — have **no accessibility descriptors of any kind**: no `accessibilityRole`, no `accessibilityLabel`, no `accessibilityHint`, nothing. They rely entirely on an adjacent `<Text>Email</Text>` / `<Text>Password</Text>` label that is only a *visual* association, not a programmatic one a screen reader can use. A screen reader user landing on either field gets no announcement of what it is. This is a real gap by any accessibility standard, not just this rule's interpretation — and notably, it's a *different* gap from the ones PR #66's own body already flagged (which were about the chat flow specifically); the plain form was not previously called out.

### Category 2 — `ChatSheet.js` / `InputBar.js` / `MessageList.js`: real lint match, debatable severity

All six of these already have `accessibilityLabel` (confirmed by reading each site — e.g. `ChatSheet.js:224` is the "Close the sign up assistant" button, already carrying `accessibilityRole="button"` and that exact label). The rule requires `accessibilityHint` alongside any `accessibilityLabel`; none of these six have one. Worth being honest about the severity here: Apple's and Android's own accessibility guidance treat hints as *supplementary* context for when the action isn't obvious from the label alone, and both explicitly discourage redundant hints that just restate an already-clear label ("Close the sign up assistant, button" is already fully actionable without a hint saying "double tap to close"). So this is a real, mechanically correct lint match — not a false positive — but whether all six actually need a hint added, versus the team deciding this specific rule should be a warning instead of an error, is a judgment call this report isn't making. Flagging it precisely so the team can decide, not editorializing further.

## What this does not cover

Static lint checks JSX prop usage, not runtime behavior. It does not verify:
- Real VoiceOver (iOS) / TalkBack (Android) behavior on an actual device or simulator
- Real `maxFontSizeMultiplier` behavior at maximum OS font scale on-device

Both remain exactly what PR #66's own body already said: "manual and unverified." This lint step doesn't close that gap — it wasn't meant to. A true runtime equivalent would need Detox or Appium driving a real simulator against the native accessibility tree, which is a materially bigger lift than this ticket's scope.

## CI

Added as a new step in the existing `mobile` job in `.github/workflows/ci.yml` (not a new job) — `npm run lint:a11y`, right after `Jest tests`. It is **not** softened with `continue-on-error` — same reasoning as the FND-03 contract test in PR #71: a check that can't fail isn't a real gate. As of this branch, that means the `mobile` job's CI check goes red on these 9 pre-existing violations until someone (not this ticket's scope) fixes them.
