# Contributing to Foldnize

First off — thanks for considering contributing! Foldnize is open source and welcomes issues, ideas, bug reports, docs improvements, and pull requests of any size.

This document explains how the repo is laid out, how to set it up locally, and the small set of conventions we try to keep consistent.

## Table of contents

1. [Code of conduct](#code-of-conduct)
2. [Repository layout](#repository-layout)
3. [Prerequisites](#prerequisites)
4. [Getting started](#getting-started)
5. [Working on each project](#working-on-each-project)
   - [`library/` — the `foldnize` npm package + CLI](#library--the-foldnize-npm-package--cli)
   - [`app/` — the Electron desktop app](#app--the-electron-desktop-app)
   - [`landing/` — the marketing site](#landing--the-marketing-site)
6. [Testing](#testing)
7. [Coding conventions](#coding-conventions)
8. [Commit messages](#commit-messages)
9. [Pull request process](#pull-request-process)
10. [Reporting bugs](#reporting-bugs)
11. [Suggesting features](#suggesting-features)
12. [Releasing the library](#releasing-the-library)
13. [License](#license)

## Code of conduct

This project follows the [Contributor Covenant 2.1](./CODE_OF_CONDUCT.md). Be kind, be patient, assume good faith. Discriminatory, harassing, or hostile behaviour will not be tolerated in any channel (issues, PRs, discussions).

> **Maintainer note:** the Code of Conduct's "Enforcement" section still contains the literal placeholder `[INSERT CONTACT METHOD]`. Replace it with your real reporting channel (email, form URL, etc.) before publicising the repo.

## Repository layout

```
foldnize/
├── library/        npm package `foldnize` — pure JS, zero deps, ships a CLI
├── app/            Electron desktop app, depends on foldnize from npm (^1.0.0)
└── landing/        Static marketing site (plain HTML/CSS)
```

Each folder is **self-contained**: its own `package.json`, its own `README.md`, its own dependencies. You can work on any one of them without touching the others.

The top-level [`README.md`](./README.md) has the quick map; this document drills into the day-to-day workflow.

## Prerequisites

| Tool         | Why                                              | How to install (macOS)         |
| ------------ | ------------------------------------------------ | ------------------------------ |
| Node.js 22+  | Runtime for the library, CLI, and Electron app   | `brew install node` or [nvm](https://github.com/nvm-sh/nvm) |
| npm 9+       | Ships with Node                                  | —                              |
| Git          | Source control                                   | `xcode-select --install`       |
| `exiftool`   | Reads embedded photo metadata at runtime         | `brew install exiftool`        |
| `ffprobe`    | Fallback metadata reader for `.mp4` and `.mov` video files | `brew install ffmpeg`          |

`exiftool` and `ffprobe` are only needed when actually running the file organiser end-to-end. The unit tests in `library/test/` use an internal test seam (`__setDateReaderForTests`) so they don't depend on either tool being installed.

The source code is **TypeScript**. The compiler (`typescript`) and `tsx` (for running tests directly against `.ts` files) get installed as dev dependencies the first time you run `npm install` in `library/` or `app/`.

## Getting started

```bash
git clone https://github.com/matheuschignolli/foldnize.git
cd foldnize
```

There is no root `package.json` and no monorepo tooling — each project installs independently:

```bash
cd library && npm install && npm run build   # compiles src/ → dist/
cd ../app && npm install                     # picks up the compiled library
# landing/ is static, no install needed
```

Both projects emit TypeScript build output into their own `dist/` folder. The library's `dist/` is what gets published to npm and what the app's `node_modules/foldnize/` resolves to.

## Working on each project

### `library/` — the `foldnize` npm package + CLI

This is the heart of the project. Everything else is downstream of it.

**Where things live:**

```
library/
├── src/
│   ├── index.ts        Public re-exports (DO NOT add side effects here)
│   ├── organize.ts     Orchestration — organizeFolder + processFile
│   ├── walk.ts         Filesystem walker, respects scanSubfolders
│   ├── naming.ts       Three renaming modes + sanitization + collisions
│   └── metadata.ts     exiftool + ffprobe shellouts, formatDateToParts, test seam
├── bin/
│   └── foldnize.ts     CLI entrypoint (compiled with a `#!/usr/bin/env node` shebang)
├── test/
│   ├── naming.test.ts
│   ├── metadata.test.ts
│   ├── walk.test.ts
│   └── organize.test.ts
├── tsconfig.json       Build config — emits src + bin → dist/
├── tsconfig.json       IDE + typecheck (src, bin, test — no emit)
├── tsconfig.build.json  Production build → dist/ (src + bin only)
└── dist/               Build output (gitignored, published to npm)
```

**Add a feature:**

1. Decide which module it belongs to (or create a new one if it's a new concern).
2. Add or extend a test in `library/test/<area>.test.ts`.
3. Implement in TypeScript with explicit types on the public surface.
4. From `library/` run `npm test` (runs tests via `tsx` against the TS source).
5. Run `npm run typecheck` to type-check the tests too.
6. Run `npm run build` to make sure the production build emits.
7. If the change affects the public API, update `library/README.md` AND re-export from `library/src/index.ts`.

**Run the CLI locally (development):**

```bash
cd library

# After npm run build:
./dist/bin/foldnize.js --help
./dist/bin/foldnize.js --root=/path/to/photos --mode=prefix --dry-run

# Or run directly against the TypeScript source with tsx:
npx tsx bin/foldnize.ts --help
```

**Coding rules specific to the library:**

- **Zero runtime dependencies.** The library MUST stay dependency-free. Dev deps (typescript, tsx, @types/node) are fine. If you're tempted to add a runtime dep, file an issue first to discuss.
- **No `console.log` in library code.** Use the `onLog` callback (`{ level, message }`). The CLI prints; the library doesn't.
- **No `process.exit()`.** Throw instead. The CLI converts errors into exit codes.
- **Public API surface lives in `src/index.ts`.** Anything else is internal — don't import it from outside the library, and don't re-export it.
- **`__`-prefixed exports are internal/test-only.** They aren't re-exported from `src/index.ts` and must not be relied on by external code (think `__setDateReaderForTests`).
- **Type the public surface explicitly.** Add proper interfaces / type aliases to anything re-exported from `src/index.ts`. Internal helpers can lean on inference.

### `app/` — the Electron desktop app

The app is a thin TypeScript shell on top of the library. The renderer talks to the main process over IPC; the main process imports `foldnize` and calls `organizeFolder`.

**Run it:**

```bash
cd app
npm install
npm start          # builds (clean → tsc main → tsc renderer → copy assets) → electron .
npm run start:fast # boots electron without rebuilding (when you only changed nothing TS)
```

**Hacking on the library at the same time:**

The app normally installs `foldnize` from npm. To test unpublished library changes, temporarily set `"foldnize": "file:../library"` in `app/package.json`, run `npm run build` in `library/`, then `npm install` in `app/` — or use `npm link`:

```bash
cd library && npm run build && npm link
cd ../app  && npm link foldnize
```

After linking, rebuild `library/` whenever you change library source.

**Project layout:**

```
app/
├── main.ts                  Electron main process (window, IPC, dialog, dock icon)
├── preload.ts               Bridge — exposes window.foldnize to renderer
├── bridge-types.d.ts        Shared types for the window.foldnize contract (main + renderer)
├── tsconfig.json            Compiles main.ts + preload.ts (Node, no DOM)
├── tsconfig.renderer.json   Compiles renderer/*.ts (DOM, no Node)
├── scripts/copy-assets.mjs  Build step — copies HTML/CSS/icons into dist/
├── renderer/
│   ├── index.html           UI markup (copied to dist/renderer/ at build time)
│   ├── styles.css
│   └── renderer.ts
├── assets/                  icon.png — dock + header
└── dist/                    Build output, what Electron actually loads (gitignored)
```

**Rules:**

- All file/folder logic MUST go through the library — don't reach into `fs` from `main.ts` for organising operations. The app should remain a UI.
- Keep `preload.ts` minimal. Only expose what the renderer truly needs.
- If you add a new option to the UI, route it through IPC → `organizeFolder` — and add it to the library API + tests first.
- Keep main/preload code out of the renderer tsconfig and vice versa. The split exists so the TypeScript compiler catches mistakes like `import "node:fs"` from the renderer.
- The shared `window.foldnize` shape lives in `bridge-types.d.ts`. Any change must be made there first; main and preload then re-import it.

### `landing/` — the marketing site

Plain HTML/CSS with no build step. Just open `landing/index.html` in a browser to preview.

**Rules:**

- Stay dependency-free and build-free. If you find yourself reaching for a bundler, file an issue first.
- Keep the page synchronized with real app features (e.g. don't claim features that aren't in the library yet).

## Testing

Tests live in `library/test/` and use Node's built-in test runner driven through `tsx` (so they run against the TypeScript sources directly — no separate compile step in the dev loop).

```bash
cd library
npm test           # tsx --test "test/*.test.ts"
npm run typecheck  # tsc -p tsconfig.json — full type check including tests
```

What's covered:

- `naming.test.ts` — sanitization, valid extensions
- `metadata.test.ts` — date parsing (no exiftool needed; pure string parsing)
- `walk.test.ts` — recursion toggle, junk-file filtering, extension filtering
- `organize.test.ts` — every renaming mode, dry-run, year/month, collisions, idempotency, log stream

For the organize tests we inject a deterministic metadata reader via the `__setDateReaderForTests` seam exported from `src/metadata.ts`. This keeps the suite fast and tool-free; never reach into `exiftool` from a test.

When fixing a bug, **add a failing test first**, then fix it.

End-to-end tests against real `exiftool` output are out of scope for the automated suite — they live in your local terminal while you're hacking. Document any manual steps you used to verify a change in the PR description.

The app and landing don't have automated tests right now. PRs that introduce test coverage there are very welcome.

## Coding conventions

The codebase is **TypeScript** end-to-end (library, CLI, Electron main, preload, renderer). The landing page remains plain HTML/CSS by design.

- **TypeScript ≥ 5** (we currently track `^6`). Strict mode is on (`"strict": true`, plus a few extras like `noImplicitOverride` and `forceConsistentCasingInFileNames`).
- **CommonJS** for the library (and Electron main/preload). The renderer is plain script-context JS — no module loader, just `<script src="renderer.js">`.
- **Node ≥ 22**. Use modern syntax freely: optional chaining, nullish coalescing, `node:` import prefixes, top-level `await` is fine in scripts (not in library code), etc.
- **Public API surface** in `library/src/index.ts` should have explicit interfaces and JSDoc on every export. Internal helpers can rely on inference.
- **Indentation**: 2 spaces. Match the surrounding file.
- **Quotes**: double quotes (`"`).
- **Semicolons**: yes.
- **Comments**: explain *why*, not *what*. Don't narrate the code.
- **Naming**: descriptive, no abbreviations. `customName` not `cn`, `organizeIntoYearMonth` not `ym`.
- **Filenames**: lower-kebab-case (`naming.ts`, `naming.test.ts`).
- **Avoid `any`**. Reach for `unknown` and narrow with type guards. Reach for `as` casts only at the OS/DOM boundary (e.g. `getElementById("…") as HTMLButtonElement`).

No formatter is enforced. If you want to run one locally, that's fine; just don't commit reformatted unrelated code in the same PR.

## Commit messages

We loosely follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Common types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`.

Examples:

```
feat(library): add HEIC support to VALID_EXTENSIONS
fix(app): debounce custom-name input to avoid rerender thrash
docs(library): clarify how dry-run interacts with year-month
test(organize): cover collision-suffix wraparound
chore: bump electron to 43
```

This isn't enforced by tooling — just makes the git log easier to skim and is a nice habit if you ever want to automate a CHANGELOG later.

## Pull request process

1. **Fork** and create a feature branch off `main`.
2. **Make focused changes.** A PR that touches the library, the app, and the landing page is hard to review — prefer separate PRs.
3. **Run the tests**: `cd library && npm test`.
4. **Update the relevant README**(s) if you changed user-facing behaviour or the public API.
5. **Open the PR** with:
   - A clear title (Conventional Commit style is great).
   - A summary of what changed and why.
   - Manual test steps if relevant (especially for the Electron app).
   - Screenshots / GIFs for UI changes.
6. **Be patient.** This is a side project; reviews land when they land.
7. **Respond to review feedback** by pushing additional commits to the branch — no need to rebase/squash until just before merge.

Small, well-scoped PRs get merged faster.

## Reporting bugs

When opening a bug report, please include:

- What you did (commands / clicks).
- What you expected.
- What actually happened.
- Your OS + Node version (`node --version`).
- Which folder it happened in (`library/`, `app/`, or `landing/`).
- If file-related: a sample input file (or its metadata via `exiftool -a -G1 path/to/file`).

## Suggesting features

Open an issue first, especially for anything user-facing. A short proposal saves a lot of time vs. a surprise PR. Mention which folder(s) it would touch and whether it requires changes to the public library API.

## Releasing the library

> Only maintainers do this — included for transparency.

The library is at `library/package.json`. To cut a release:

1. Bump the version in `library/package.json` following [semver](https://semver.org/):
   - `patch` for bug fixes.
   - `minor` for new options or new exports (backwards-compatible).
   - `major` for breaking changes to the public API (anything in `library/src/index.ts`).
2. Update `library/README.md` if needed.
3. Tag and publish:

   ```bash
   cd library
   npm test
   npm run typecheck
   git commit -am "chore(library): release vX.Y.Z"
   git tag vX.Y.Z
   git push && git push --tags
   npm publish --access public   # prepublishOnly hook rebuilds dist/ for you
   ```

Bump `foldnize` in `app/package.json` when you want the app to pick up a new library release from npm.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE) (the same as the rest of the project).
