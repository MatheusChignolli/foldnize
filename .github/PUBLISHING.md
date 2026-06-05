# Publishing `foldnize` to npm (CI/CD)

The package lives in [`library/`](../library). GitHub Actions publishes it automatically after tests pass.

## Workflows

| Workflow | File | When it runs |
| -------- | ---- | -------------- |
| **Library CI** | `.github/workflows/library-ci.yml` | Push/PR that touch `library/**` |
| **Publish to npm** | `.github/workflows/publish-npm.yml` | GitHub Release published, or manual run |

---

## Commit the lockfile

`library/package-lock.json` must be tracked in git (the root `.gitignore` must not exclude it). CI uses it for `npm ci` and for the npm cache in `setup-node`.

```bash
git add library/package-lock.json
git commit -m "chore: track library package-lock for CI"
```

---

## GitHub configuration (required)

### 1. Repository secret

Add this under **Settings → Secrets and variables → Actions → Repository secrets**:

| Secret name | Description |
| ----------- | ----------- |
| `NPM_TOKEN` | npm automation token with permission to publish `foldnize` |

#### How to create `NPM_TOKEN`

1. Log in at [https://www.npmjs.com](https://www.npmjs.com).
2. Go to **Access Tokens** → **Generate New Token**.
3. Choose **Granular Access Token** (recommended):
   - **Packages and scopes:** Read and write for `foldnize` (or all packages if this is your only publish).
   - **Organizations:** none, unless you publish under a scope.
   - If your npm account has **2FA required for publishing**, enable **Bypass 2FA for automation** on this token (otherwise CI gets `403 Forbidden`).
   - Expiration: your choice (90 days or custom).
4. Or use **Classic** → type **Automation** (for CI/CD; bypasses publish 2FA).
5. Copy the token once — you will not see it again.
6. In GitHub: **Repository → Settings → Secrets and variables → Actions → New repository secret**
   - Name: `NPM_TOKEN`
   - Value: paste the token

> Never commit the token. Do not put it in `package.json` or workflow files.

### 2. GitHub Environment (recommended)

The publish workflow uses an environment named **`npm`** so you can add protection rules.

1. **Settings → Environments → New environment**
2. Name: `npm`
3. Optional:
   - **Required reviewers** — someone must approve before publish
   - **Wait timer** — delay before publish
   - **Deployment branches** — only `main` or only tags

If you skip creating the environment, GitHub will create it on first run (without rules).

### 3. Variables (optional)

No repository **variables** are required for the current workflow. Everything uses `NPM_TOKEN` only.

If you later publish under a scope (e.g. `@matheuschignolli/foldnize`), you would update `library/package.json` `name` and keep using the same `NPM_TOKEN` with access to that scope.

---

## How to publish a new version

### Step 1 — Bump version locally

```bash
cd library
npm version patch   # 1.0.0 → 1.0.1  (or minor / major)
```

This updates `library/package.json` and creates a git tag if you use it in a git repo (by default `v1.0.1` at repo root — see tag strategy below).

### Step 2 — Commit and push

```bash
git add library/package.json library/package-lock.json
git commit -m "chore(library): release v1.0.1"
git push origin main
```

### Step 3 — Publish (recommended: GitHub Release)

Pushing a tag alone does **not** run the workflow (avoids double runs when you also create a Release).

1. GitHub → **Releases** → **Draft a new release**
2. Choose or create tag **`foldnize-v1.0.1`** (must match `library/package.json` `version`). Use **`foldnize-v*`** for the library — not `foldnize-app-v*` (app releases skip this workflow).
3. Publish the release — the workflow runs **once**

#### Manual run (first publish or emergencies)

1. GitHub → **Actions** → **Publish foldnize to npm**
2. **Run workflow** → branch `main` → **Run workflow**

No tag/version check on manual runs; `package.json` `version` is what gets published.

---

## What the publish job does

1. Checkout code  
2. `npm ci` in `library/`  
3. `npm run typecheck`  
4. `npm test`  
5. `npm run build`  
6. `npm publish --provenance --access public`  
   - `prepublishOnly` rebuilds `dist/` and sets the CLI executable bit  
   - Only `dist/` and `README.md` are included in the tarball (`files` in `package.json`)

---

## npm trusted publishing (optional)

For stronger supply-chain guarantees, link the package to this repo on npm:

1. npm package page → **Settings** → enable **Trusted Publisher**
2. Provider: **GitHub Actions**
3. Repository: `matheuschignolli/foldnize` (adjust if different)
4. Workflow: `publish-npm.yml`
5. Environment: `npm`

Then you can restrict publishes so only this workflow can publish new versions.

---

## Troubleshooting

| Error | Likely fix |
| ----- | ---------- |
| `ENEEDAUTH` / 401 | `NPM_TOKEN` missing, expired, or wrong permissions |
| `403 Forbidden` — *Two-factor authentication or granular access token with bypass 2fa enabled is required* | Regenerate `NPM_TOKEN`: use a **Classic Automation** token, or a **Granular** token with **Bypass 2FA for automation** and publish access to `foldnize`. A normal **Publish** or **Read-only** token will not work in CI. |
| `403 Forbidden` (other) | Token cannot publish `foldnize`; verify package name ownership on npm |
| `No bin file found at dist/bin/foldnize.js` (warn) | Harmless if `prepublishOnly` runs; the publish workflow also runs `npm run build` before `npm publish` so the bin exists when npm validates `package.json` |
| `You cannot publish over the same version` | Bump `version` in `library/package.json` |
| Tag / version mismatch | Release tag must be `foldnize-v1.0.1` when `package.json` says `1.0.1` |
| Environment approval pending | Approve deployment under **Actions** or disable required reviewers on `npm` environment |

---

## First-time manual publish (without waiting for CI)

```bash
cd library
npm login
npm test
npm publish --access public
```

After the package exists on npm under your account, CI can publish subsequent versions with `NPM_TOKEN`.
