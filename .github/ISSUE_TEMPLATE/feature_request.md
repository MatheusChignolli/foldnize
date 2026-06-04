---
name: Feature request
about: Suggest a new capability or improvement
title: "[Feature] "
labels: ["enhancement"]
assignees: []
---

<!--
Got an idea? Excellent. A short proposal upfront helps avoid surprise PRs
that don't land. Don't worry about polish — bullet points are fine.
-->

## Problem to solve

<!--
What's frustrating, missing, or awkward today? Describe the user pain, not
the solution.

  e.g. "When I have 10k photos, the dry-run output scrolls off the screen
  and I can't tell which files were skipped vs renamed."
-->

## Proposed solution

<!--
What would you change? Be as concrete as you want — sketches, mockups,
imaginary CLI flags, JS snippets all welcome.
-->

## Alternatives considered

<!--
Other ways you thought of solving the same problem, and why you set them
aside. Helps reviewers understand the design space.
-->

## Which project(s) would this touch?

- [ ] `library/` — public API change (new option, new export, new behaviour)
- [ ] `library/` — internal change only (no public API impact)
- [ ] `app/` — UI / Electron-side change
- [ ] `landing/` — marketing site
- [ ] Multiple of the above

## Does this change the public library API?

<!--
"Public API" = anything exported from `library/src/index.js`, the `onLog`
event shape, the `organizeFolder` options object, or the CLI flag list.

Breaking changes need a major version bump and extra care — flag them here.
-->

- [ ] No — purely additive (new option, new value, new export with sensible default)
- [ ] No — internal only
- [ ] Yes — backwards-compatible addition (minor bump)
- [ ] Yes — breaking change (major bump)

## Anything else?

<!-- Related issues, prior art in similar tools, willingness to send a PR. -->
