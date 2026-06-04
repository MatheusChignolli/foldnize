<!--
Thanks for sending a PR! Please fill in the sections below so review can go
quickly. Delete sections that don't apply (e.g. screenshots when there's no
UI change).
-->

## Summary

<!-- One or two sentences: what does this PR change and why? -->

## Type of change

<!-- Tick all that apply. -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (changes the public library API, the `onLog` shape, an `organizeFolder` option, a CLI flag, or the IPC contract)
- [ ] Refactor (no functional change)
- [ ] Documentation
- [ ] Tooling / chore
- [ ] Tests only

## Which project(s) does this affect?

- [ ] `library/`
- [ ] `app/`
- [ ] `landing/`

## Related issues

<!-- e.g. Closes #123, Refs #456 -->

## How was this tested?

<!--
For the library, `cd library && npm test` is the baseline. List any manual
steps (test folder layout, exiftool commands, app interactions) that a
reviewer would need to reproduce your verification.

  - Built a tmp folder with 5 JPEGs stamped at 2023-07-15 14:23:10 via exiftool
  - Ran `foldnize --root=... --mode=custom --custom-name=trip --year-month --dry-run`
  - Confirmed each line in the dry-run output matched expectations
-->

- [ ] `cd library && npm test` passes locally
- [ ] `cd library && npm run typecheck` passes locally
- [ ] `cd library && npm run build` succeeds (if library code changed)
- [ ] `cd app && npm run typecheck` passes locally (if app code changed)
- [ ] Added/updated automated tests for the change (or explained below why not)
- [ ] Manually verified with a real folder (steps below)

```
<paste any commands or test setup here>
```

## Screenshots / GIFs

<!-- Required for UI changes in the Electron app or landing page. Drag & drop into this textarea. -->

## Checklist

- [ ] Code follows the conventions in [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] Public API changes are reflected in `library/src/index.ts` and `library/README.md`
- [ ] Affected READMEs are up to date (`README.md`, `library/README.md`, `app/README.md`)
- [ ] Library still has zero **runtime** dependencies (or there's a justified exception in the PR description)
- [ ] No `console.log` left behind in library code (use `onLog` instead)
- [ ] No `process.exit()` in library code (throw instead — the CLI handles exit codes)
- [ ] No `any` introduced where `unknown` + a narrowing guard would do
- [ ] `__`-prefixed exports (test seams) stay out of `library/src/index.ts`

## Anything reviewers should know?

<!-- Trade-offs you made, follow-up work you're punting, things you're unsure about. -->
