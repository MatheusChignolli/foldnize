# Foldnize — Desktop app

An Electron desktop app that organizes a folder of photos and videos by their embedded **original date** (EXIF / QuickTime metadata).

This package is a thin UI shell on top of the [`foldnize`](https://www.npmjs.com/package/foldnize) npm package — all of the actual file-organising logic lives there. The library source also lives in [`../library`](../library) in this monorepo.

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
- Supported formats: `.jpeg`, `.jpg`, `.mov`, `.mp3`, `.mp4`, `.png`

## Requirements

- Node.js 22+
- Optional but recommended on macOS:
  - [`exiftool`](https://exiftool.org/) — photos, audio, and most video metadata. `brew install exiftool`
  - [`ffprobe`](https://ffmpeg.org/ffprobe.html) — fallback for `.mp4` and `.mov` video files. `brew install ffmpeg`

Without these tools installed, files without parseable date metadata are simply skipped.

## Getting started

```bash
cd app
npm install
npm start
```

`npm start` runs the full pipeline: `clean → tsc (main + preload) → tsc (renderer) → copy HTML/CSS/assets → electron .`.
If you only changed renderer or main files, use `npm run start:fast` (boots without rebuilding).

The app depends on [`foldnize`](https://www.npmjs.com/package/foldnize) from the npm registry (`^1.0.0`). Bump the version in `package.json` to pick up new releases.

> Tip — when developing the library in this repo, point at the local copy temporarily:
> ```bash
> # in app/package.json: "foldnize": "file:../library"
> cd ../library && npm run build
> cd ../app && npm install
> ```
> Or use `npm link` after building the library.

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
├── package.json              # Depends on foldnize from npm (^1.0.0)
├── assets/
│   ├── Foldnize.icon/        # Icon Composer bundle — macOS app icon source
│   ├── logo.png              # UI logo — header (1024×1024)
│   ├── icon.png              # Generated — dock + Windows/Linux (512×512)
│   └── icon.icns             # Generated — macOS packaged builds
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
        ├── logo.png
        └── icon.png
```

The Electron `"main"` field in `package.json` points at `dist/main.js`. Source code stays at the project root for editing; everything Electron actually loads lives under `dist/`.

## App icon (macOS dock)

The **header logo** uses `assets/logo.png`. The **Dock / window icon** is compiled from
`assets/Foldnize.icon` (your Icon Composer bundle).

```bash
cd app
npm run icons:build
```

On macOS with Xcode installed, this uses `actool` to compile `Foldnize.icon` into
`icon.icns` (and `Assets.car` on supported macOS versions). Without `actool`, it
falls back to building `icon.icns` from the PNG inside the bundle.

Replace `assets/Foldnize.icon` when updating the macOS app icon, and `logo.png` when
updating the in-app / landing logo. Then run `npm run icons:build` before packaging.

If `assets/icon.png` is missing or unreadable, the app silently falls back to
the default Electron icon. No crash, no error.

For **packaged builds** (e.g. via `electron-builder`):

- macOS: `assets/icon.icns` (generated by `npm run icons:build`)
- Windows: `assets/icon.png`
- Linux: `assets/icon.png` (256×256 or 512×512)

Then point your packager at the `assets/` directory in its config.

## Where the business logic lives

The renaming, walking, metadata reading and folder-sorting logic lives in the
[`foldnize`](https://www.npmjs.com/package/foldnize) package, fully typed:

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

See [`../library/README.md`](../library/README.md) (or [npm](https://www.npmjs.com/package/foldnize)) for the full API.

## Desktop releases

Package installers for macOS, Windows, and Linux:

```bash
npm run dist        # current OS
npm run dist:mac    # macOS (.dmg, .zip)
npm run dist:win    # Windows (NSIS)
npm run dist:linux  # Linux (AppImage, .deb)
```

CI publishes installers to **GitHub Releases** (tag `foldnize-app-v*`). The landing page links to those assets; per-asset download counts are on the GitHub Release page — see [`.github/APP_RELEASES.md`](../.github/APP_RELEASES.md).

## Possible next steps

- Persist the last-used folder via `electron-store`.
- Surface a real progress bar driven by the `onLog` stream.
- Clean up empty source folders after move operations (opt-in).
- Apple code signing + notarization for smoother macOS installs.

## License

MIT
