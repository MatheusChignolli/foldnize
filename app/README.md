# Foldnize — Desktop app

An Electron desktop app that organizes a folder of photos and videos by their embedded **original date** (EXIF / QuickTime metadata).

This package is a thin UI shell on top of the [`foldnize`](../library) library — all of the actual file-organising logic lives there.

## Features

- Native folder picker (drag-free, OS-integrated).
- Three renaming modes:
  - **Prefix** — keep the original name, add `YYYYMMDD-` in front.
  - **Replace** — fully rename to `YYYYMMDD-HHMMSS.ext`.
  - **Custom** — fully rename to `{yourName}-YYYYMMDD-HHMMSS.ext`.
- **Sort into Year/Month folders** — optionally move each renamed file into a
  `<root>/YYYY/MM/` subfolder based on its date. Existing folders are reused;
  missing ones are created.
- **Subfolder toggle** — choose whether the scan descends into subfolders or
  only processes top-level files.
- **Dry run** mode to preview changes without touching any file.
- Real-time streaming log of every action.
- Safe collision handling (`-1`, `-2`, … suffixes).
- Skips already-formatted files automatically.

## Requirements

- Node.js 18+
- Optional but recommended on macOS:
  - [`exiftool`](https://exiftool.org/) — required to read photo metadata. `brew install exiftool`
  - [`ffprobe`](https://ffmpeg.org/ffprobe.html) — fallback for `.mp4` files. `brew install ffmpeg`

Without these tools installed, files without parseable date metadata are simply skipped.

## Getting started

```bash
# first time: install both
cd ../library && npm install && npm run build
cd ../app     && npm install

# every time you want to launch:
npm start
```

`npm start` runs the full pipeline: `clean → tsc (main + preload) → tsc (renderer) → copy HTML/CSS/assets → electron .`.
If you only changed the renderer or main file and skip TypeScript edits in the
library, you can use the faster `npm run start:fast` (boots without rebuilding).

`npm install` here resolves the local `foldnize` library via a `file:../library`
dependency. If you change the library source, run `npm run build` over there
first, then re-run `npm install` in this folder to refresh `node_modules/foldnize`.

> Tip — during heavy library development you can swap to `npm link` so library
> edits flow through immediately after a rebuild:
> ```bash
> cd ../library && npm link
> cd ../app     && npm link foldnize
> ```

## Scripts

| Command                 | What it does                                          |
| ----------------------- | ----------------------------------------------------- |
| `npm start`             | Build everything, then launch Electron.              |
| `npm run start:fast`    | Launch Electron without rebuilding.                  |
| `npm run build`         | Clean + compile main, preload, renderer, copy assets. |
| `npm run build:main`    | Compile `main.ts` + `preload.ts`.                    |
| `npm run build:renderer`| Compile `renderer/renderer.ts`.                      |
| `npm run build:assets`  | Copy HTML, CSS, icons into `dist/`.                  |
| `npm run typecheck`     | Type-check both subprojects, no emit.                |
| `npm run clean`         | Remove `dist/`.                                      |

## Project structure

```
app/
├── main.ts                   # Electron main process (window, IPC, dialog, dock icon)
├── preload.ts                # Secure bridge between main and renderer
├── bridge-types.d.ts         # Shared type contract for window.foldnize
├── tsconfig.json             # Compiles main.ts + preload.ts (Node, no DOM)
├── tsconfig.renderer.json    # Compiles renderer/*.ts (DOM, no Node)
├── scripts/
│   └── copy-assets.mjs       # Copies HTML/CSS/icons into dist/
├── package.json              # Depends on foldnize via "file:../library"
├── assets/
│   ├── icon.svg              # Source vector (edit this, then re-export)
│   └── icon.png              # Exported icon — dock + header (512×512)
├── renderer/
│   ├── index.html            # UI markup
│   ├── styles.css            # Dark, modern styling
│   └── renderer.ts           # UI logic + IPC calls
└── dist/                     # Build output, loaded by Electron (gitignored)
    ├── main.js
    ├── preload.js
    ├── renderer/
    │   ├── index.html
    │   ├── styles.css
    │   └── renderer.js
    └── assets/
        └── icon.png
```

The Electron `"main"` field in `package.json` points at `dist/main.js`. Source code stays at the project root for editing; everything Electron actually loads lives under `dist/`.

## App icon (macOS dock)

The icon shown in the macOS dock and app header is loaded from `assets/icon.png`.
Replace `assets/icon.png` with a square PNG (512×512). To regenerate from the SVG source:

```bash
cd app/assets
npx @resvg/resvg-js-cli icon.svg icon.png
```

Then rebuild the app (`npm run build:assets` or `npm start`).

If `assets/icon.png` is missing or unreadable, the app silently falls back to
the default Electron icon. No crash, no error.

For **packaged builds** (e.g. via `electron-builder`), you'll also want
multi-resolution icons:

- macOS: `assets/icon.icns` (generate with `iconutil` or `electron-icon-builder`)
- Windows: `assets/icon.ico`
- Linux: `assets/icon.png` (256×256 or 512×512)

Then point your packager at the `assets/` directory in its config.

## Where the business logic lives

The renaming, walking, metadata reading and folder-sorting logic lives in the
[`foldnize`](../library) package next door, fully typed:

```ts
import { organizeFolder, type OrganizeOptions } from "foldnize";

organizeFolder({
  root: "/absolute/path",
  mode: "prefix",                  // "prefix" | "replace" | "custom"
  customName: "vacation",          // required when mode === "custom"
  organizeIntoYearMonth: true,
  scanSubfolders: true,
  dryRun: true,
  onLog: ({ level, message }) => console.log(level, message),
});
```

Returns `{ found, renamed, moved, skipped }`. A file can be counted in both
`renamed` and `moved` if it changes name *and* changes directory.

See [`../library/README.md`](../library/README.md) for the full API.

## Possible next steps

- Persist the last-used folder via `electron-store`.
- Surface a real progress bar driven by the `onLog` stream.
- Clean up empty source folders after move operations (opt-in).
- Package distributable builds with `electron-builder`.

## License

MIT
