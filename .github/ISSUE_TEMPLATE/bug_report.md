---
name: Bug report
about: Something isn't working the way it should
title: "[Bug] "
labels: ["bug"]
assignees: []
---

<!--
Thanks for taking the time to file a bug! Filling out the sections below
helps us reproduce the issue and ship a fix faster.
-->

## What happened?

<!-- A clear, concise description of the bug. -->

## Steps to reproduce

1. ...
2. ...
3. ...

## Expected behaviour

<!-- What you thought was going to happen. -->

## Actual behaviour

<!-- What actually happened. Paste error messages, log output, or screenshots here. -->

## Which project is affected?

<!-- Tick whichever applies. -->

- [ ] `library/` — the `foldnize` npm package or CLI
- [ ] `app/` — the Electron desktop app
- [ ] `landing/` — the marketing site
- [ ] Something else / not sure

## Environment

- **OS** (e.g. macOS 14.5, Ubuntu 22.04, Windows 11):
- **Node version** (`node --version`):
- **Foldnize version** (library version in `library/package.json`, or commit SHA):
- **exiftool installed?** (`exiftool -ver`):
- **ffprobe installed?** (`ffprobe -version | head -n 1`):

## File metadata (if file-related)

<!--
If the bug involves a specific file being mis-renamed, mis-skipped, or
mis-sorted, paste its metadata so we can reproduce. NEVER paste private images
— just the metadata dump is enough.

  exiftool -a -G1 path/to/file
-->

```
<paste exiftool output here>
```

## Anything else?

<!-- Screenshots, related issues, ideas about the root cause, anything goes. -->
