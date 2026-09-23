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

## npm and GitHub configuration (required)

The publish workflow uses npm Trusted Publishing with GitHub's short-lived OIDC
identity. It does not use an `NPM_TOKEN` or any other long-lived publish secret.

### 1. Trusted Publisher on npm

Open the [`foldnize` package settings on npm](https://www.npmjs.com/package/foldnize/access),
find **Trusted Publisher**, choose **GitHub Actions**, and enter:

| Field | Value |
| ----- | ----- |
| Organization or user | `MatheusChignolli` |
| Repository | `foldnize` |
| Workflow filename | `publish-npm.yml` |
| Environment | `npm` |
| Allowed action | Direct publish with `npm publish` |

The workflow grants only `contents: read` and `id-token: write`. npm exchanges
that GitHub identity for a short-lived publishing credential and creates the
provenance attestation automatically.

After Trusted Publishing works, remove any obsolete `NPM_TOKEN` secret from the
repository and from the `npm` environment.

### 2. GitHub Environment

The publish workflow uses an environment named **`npm`** so you can add protection rules.

1. **Settings → Environments → New environment**
2. Name: `npm`
3. Optional:
   - **Required reviewers** — someone must approve before publish
   - **Wait timer** — delay before publish
   - **Deployment branches** — only `main` or only tags

If you skip creating the environment, GitHub will create it on first run (without rules).

### 3. Variables and secrets

No repository variables or npm authentication secrets are required. If the
package later moves under a scope, update the trusted publisher on npm; do not
reintroduce a long-lived publish token. The environment name must remain `npm`
because it is part of the trusted-publisher identity configured on npmjs.com.

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
6. `npm publish --access public` through OIDC Trusted Publishing
   - `prepublishOnly` rebuilds `dist/` and sets the CLI executable bit
   - Only `dist/` and `README.md` are included in the tarball (`files` in `package.json`)
   - npm creates the provenance statement automatically

---

## Troubleshooting

| Error | Likely fix |
| ----- | ---------- |
| `ENEEDAUTH`, `401`, or `404` during publish | Confirm the npm Trusted Publisher matches user `MatheusChignolli`, repository `foldnize`, workflow `publish-npm.yml`, and environment `npm` exactly |
| Trusted publisher rejects `npm publish` | Edit its allowed actions on npm and enable direct `npm publish`; otherwise switch the workflow intentionally to staged publishing |
| Trusted publishing requires a newer npm | Keep Node 24 and npm 11.5.1 or newer; the workflow checks this before installing dependencies |
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

Manual local publishing still requires an interactive npm login and any 2FA
challenge required by the package. Automated releases use OIDC instead.
