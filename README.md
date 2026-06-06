# Foldnize

Foldnize organizes photos and videos by their embedded **original date** — both as a desktop app and as a reusable library.

This repository is a small monorepo with three independent projects:

```
foldnize/
├── library/        npm package: `foldnize`  — pure JS, no deps, has a CLI
├── app/            Electron desktop app that wraps the library
└── landing/        Static marketing site
```

Each folder has its own `package.json`, its own `README.md`, and can be developed independently.

## Quick map

| Folder      | What it is                                                                       | How to run                                            |
| ----------- | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `library/`  | The `foldnize` npm package — **TypeScript**, Node ≥ 22, zero runtime deps, ships a CLI. | `cd library && npm install && npm run build && npm test` |
| `app/`      | The Electron UI (**TypeScript**) on top of the library.                          | `cd app && npm install && npm start`                  |
| `landing/`  | Static HTML/CSS landing page.                                                    | Open `landing/index.html` in a browser.               |

Source code is TypeScript. Each project builds independently via `tsc` into its own `dist/` folder. No monorepo tooling, no bundler.

## How the three pieces talk

- `library/` knows nothing about Electron or the landing page — pure logic, runnable from Node or any CLI.
- `app/` depends on the published [`foldnize`](https://www.npmjs.com/package/foldnize) npm package (`^1.0.0`).
- `landing/` is decoupled — it links to the library/app for downloads.

When developing the library in this repo, temporarily use `file:../library` or `npm link` in `app/` — see [`app/README.md`](./app/README.md).

## Requirements

- Node.js **22+**
- macOS, Linux, or Windows
- Supported formats: `.jpeg`, `.jpg`, `.mov`, `.mp3`, `.mp4`, `.png`
- Optional but recommended:
  - `exiftool` — `brew install exiftool` — photos, audio, and most video metadata
  - `ffprobe` — `brew install ffmpeg` — fallback for `.mp4` and `.mov` video files

## License

MIT
