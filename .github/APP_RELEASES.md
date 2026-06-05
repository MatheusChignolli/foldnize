# Publishing the Foldnize desktop app

The Electron app lives in [`app/`](../app). Installers are built for **macOS**, **Windows**, and **Linux** and published to **GitHub Releases**.

---

## Architecture

| Piece | Service | Role |
| ----- | ------- | ---- |
| Installers | **GitHub Releases** | Host `.dmg`, `.exe`, `.AppImage` (~110 MB each) |
| Landing site | Any static host (Pages, Netlify, Vercel, etc.) | Marketing + download buttons |
| Download stats | **GitHub Release page** | Per-asset download counts on each release |
| CI builds | GitHub Actions | Build all three OS targets |

The landing page ([`landing/download.js`](../landing/download.js)) uses the GitHub API to link directly to the latest `foldnize-app-v*` release assets.

---

## 1 — Package locally (optional test)

```bash
cd app
npm install
npm run dist:mac    # macOS only (on a Mac)
npm run dist:win    # Windows only (on Windows)
npm run dist:linux  # Linux only
```

Artifacts land in `app/release/`.

Unsigned macOS builds show Gatekeeper warnings — expected for open-source until you add Apple code signing.

---

## 2 — GitHub Actions release

Workflow: [`.github/workflows/release-app.yml`](./workflows/release-app.yml)

### Trigger

1. Bump `app/package.json` `version`
2. GitHub → **Releases** → **Draft a new release**
3. Tag: **`foldnize-app-v1.0.0`** (must match `app/package.json` version; does not trigger the library npm publish workflow)
4. Publish — builds macOS, Windows, Linux and attaches installers to **that release**

Or run **Release Foldnize app** manually from Actions (workflow_dispatch). Manual runs build artifacts but only attach to a release when triggered by `release: published`.

### Release assets

| Platform | File pattern |
| -------- | ------------ |
| macOS | `Foldnize-*-arm64.dmg` |
| Windows | `Foldnize Setup *.exe` |
| Linux | `Foldnize-*.AppImage` |

### Download counts

Open the release on GitHub — each asset shows its own download count (macOS / Windows / Linux).

---

## 3 — Landing download buttons

[`landing/download.js`](../landing/download.js) detects the visitor OS and resolves installer URLs from the latest `foldnize-app-v*` release. If the API call fails, buttons fall back to the [latest releases](https://github.com/MatheusChignolli/foldnize/releases/latest) page.

---

## Version checklist

```bash
# 1. Bump app version
cd app && npm version patch   # 1.0.0 → 1.0.1

# 2. Commit
git add app/package.json app/package-lock.json
git commit -m "chore(app): release v1.0.1"
git push

# 3. GitHub Release with tag foldnize-app-v1.0.1
```

---

## Troubleshooting

| Issue | Fix |
| ----- | --- |
| macOS “app is damaged” / Gatekeeper | Unsigned build — right-click → Open, or add code signing later |
| Landing buttons go to releases page only | No `foldnize-app-v*` release with assets yet — publish a release and wait for CI |
| Missing platform on release | That OS build failed — check Actions logs |
| GitHub API rate limit on landing | Rare for normal traffic; falls back to releases page |
