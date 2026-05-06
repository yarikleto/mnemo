# Configuring GitHub Actions Secrets

> For: Mnemo maintainer | Created: 2026-05-06 | Status: PENDING
> **Blocks:** ADR-011 (CI matrix). Without these secrets, the release workflow fails on the macOS signing step.
> **Prereq:** Complete `.claude/handoff/apple-developer-enrollment.md` first — you need the five values it produces.

## Why This Is Needed

The release pipeline (`.github/workflows/release.yml`) runs on GitHub-hosted runners, which are ephemeral VMs. Every release needs the Apple cert + notarization credentials freshly available; secrets are how you hand them to the runner without ever committing them to the repo.

Secrets are encrypted at rest by GitHub, exposed only to workflows on the repo (and only when the workflow file references them by name), and **automatically masked in logs** — even if a workflow does `echo $APPLE_ID`, GitHub redacts it to `***` in the run output. (This is not a license to `set -x` indiscriminately. The release workflow does not.)

## Prerequisites

- [ ] Admin access to `github.com/yarikleto/mnemo` (you own the repo, so you have it).
- [ ] All five values from `apple-developer-enrollment.md` Step "After You're Done".
- [ ] A GitHub fine-grained PAT or the default `GITHUB_TOKEN` strategy decided (see Step 5 below).

## The Six Secrets

| Secret name | What it is | Source | Used by |
|---|---|---|---|
| `APPLE_ID` | Your Apple ID email | `apple-developer-enrollment.md` Step 1 | `@electron/notarize` (notarytool auth) |
| `APPLE_APP_SPECIFIC_PASSWORD` | 19-char `xxxx-xxxx-xxxx-xxxx` from appleid.apple.com | `apple-developer-enrollment.md` Step 6 | `@electron/notarize` (notarytool auth) |
| `APPLE_TEAM_ID` | 10-char Team ID | `apple-developer-enrollment.md` Step 5 | `@electron/notarize` (team scoping) |
| `CSC_LINK` | Base64-encoded `.p12` | `apple-developer-enrollment.md` Step 4 | electron-builder (signs every binary) |
| `CSC_KEY_PASSWORD` | The `.p12` export password | `apple-developer-enrollment.md` Step 3 | electron-builder (unlock the `.p12`) |
| `GH_TOKEN` | GitHub token for publishing release artifacts | Auto OR PAT (see Step 5) | electron-builder (`--publish always`) |

## Steps

### Step 1 — Open the secrets settings page

1. Go to https://github.com/yarikleto/mnemo
2. **Settings** (top-right of the repo page; you must be the owner / admin).
3. Left sidebar → **Secrets and variables** → **Actions**.
4. You're now on a page titled "Actions secrets and variables" with two tabs: "Secrets" and "Variables". Stay on **"Secrets"**.

### Step 2 — Add each Apple secret

For each of `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `CSC_LINK`, `CSC_KEY_PASSWORD`:

1. Click **"New repository secret"** (green button, top right of the secrets list).
2. **Name:** the exact secret name from the table above (case-sensitive, underscores not dashes).
3. **Secret:** paste the value.
4. **Add secret.**

Notes per secret:

- **`APPLE_ID`** — paste your Apple ID email. Just the email, no quotes, no whitespace.
- **`APPLE_APP_SPECIFIC_PASSWORD`** — paste the 19 characters with hyphens (`xxxx-xxxx-xxxx-xxxx`). Apple's format includes the hyphens.
- **`APPLE_TEAM_ID`** — 10 alphanumeric characters, all uppercase. No prefix, no spaces.
- **`CSC_LINK`** — the **entire** base64 blob from `base64 -i mnemo-mac-cert.p12`. It's typically several thousand characters long; paste it all in one go. GitHub's textarea handles it.
- **`CSC_KEY_PASSWORD`** — the password you set when exporting the `.p12`. **Not** your login keychain password. **Not** your Apple ID password.

After adding all five, the secrets list shows: `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_ID`, `APPLE_TEAM_ID`, `CSC_KEY_PASSWORD`, `CSC_LINK` (alphabetical). The values are not displayed — GitHub shows only the names.

### Step 3 — Verify the secrets exist

The workflow will fail with a clear error if any secret is missing or has a typo in its name. To pre-check from the secrets page:

- Confirm all five names appear, spelled exactly as in the table above.
- If you accidentally typed `APPLE_APP_PASSWORD` instead of `APPLE_APP_SPECIFIC_PASSWORD`, delete the wrong one and re-add the right name (you can't rename a secret in-place).

### Step 4 — Decide `GH_TOKEN` strategy

`GH_TOKEN` is what electron-builder uses to upload release artifacts to the `mnemo` repo's GitHub Releases page. **Two valid options**:

**Option A — Use the auto-provided `GITHUB_TOKEN` (RECOMMENDED).** GitHub Actions auto-injects a `GITHUB_TOKEN` secret with `contents: write` permission on the repo, scoped to the running workflow. No setup; the workflow just maps `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. Works for the same-repo release case Mnemo has. **Pick this.**

**Option B — Use a fine-grained personal access token (PAT).** Required only if you ever publish releases to a *different* repo than the one running the workflow (e.g., a private build repo publishing to a public download repo). Mnemo doesn't need this; skip.

**Action:** nothing to add to secrets. The workflow YAML (which the developer agent writes per ADR-011) handles the mapping.

### Step 5 — (Optional now, recommended later) Add a "secret-smoketest" workflow

To verify the secrets are wired correctly without firing a full release, add a tiny manual-only workflow. The developer agent can include this in the v1 setup. The workflow does **not** echo any secret value (that would be redacted by GitHub anyway, but the principle stands); it just confirms each secret is non-empty.

Conceptually:

```yaml
# .github/workflows/secret-smoketest.yml
name: Secret smoke test
on: { workflow_dispatch: {} }
jobs:
  check:
    runs-on: macos-14
    steps:
      - name: Verify Apple secrets are set
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
        run: |
          for v in APPLE_ID APPLE_APP_SPECIFIC_PASSWORD APPLE_TEAM_ID CSC_LINK CSC_KEY_PASSWORD; do
            if [ -z "${!v}" ]; then echo "MISSING: $v"; exit 1; fi
            echo "OK: $v has length ${#v}"
          done
```

Trigger it from the **Actions** tab → "Secret smoke test" → "Run workflow". A green run with five `OK:` lines means the secrets are reachable. (The lengths printed are not sensitive.) **Do not** add an `echo "$APPLE_ID"` step — even though GitHub would mask it, you don't want to build the muscle memory of echoing secrets.

A more thorough smoke test runs `codesign` against a dummy binary using `CSC_LINK` — but that's nearly the full release path and can wait until the actual release workflow is in place.

### Step 6 — (Future, when Windows signing lands) Add Azure secrets

Per `windows-signing-fastfollow.md`, when Windows signing is enabled you'll add three more secrets: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` (or equivalent for the chosen provider). Don't add them yet — v1 ships unsigned Windows by ADR-007.

## After You're Done

The release workflow can now sign and notarize on every tag push. Next steps:

- The developer agent implements the `electron-builder.yml` changes (`afterSign` hook, `mac.hardenedRuntime`, `mac.entitlements`, `publish: github`, `mac.target: [{target: dmg, arch:[universal]}, {target: zip, arch:[universal]}]`).
- The developer agent writes `.github/workflows/release.yml` per ADR-011.
- You run the **release rehearsal** per `.claude/handoff/release-rehearsal.md` — cut a `v0.0.1` tag and verify a signed Mac build lands in GitHub Releases.

## Troubleshooting

- **`Error: ENOENT: no such file or directory, open '~/Downloads/.p12'`** in CI — `CSC_LINK` is empty or malformed. Re-encode the `.p12`: `base64 -i mnemo-mac-cert.p12 | pbcopy`, paste again. (The variable name is `CSC_LINK` regardless of whether it's a URL or a base64 blob; electron-builder detects which.)
- **`No identity found`** in CI — `CSC_KEY_PASSWORD` is wrong, or the `.p12` doesn't contain the private key (you exported only the cert in `apple-developer-enrollment.md` Step 3 — re-export, making sure to right-click the *parent* row, not just the private key).
- **`Notarization failed: HTTPError: Response code 401`** — `APPLE_APP_SPECIFIC_PASSWORD` is wrong, or `APPLE_ID` doesn't match the account that generated the password. Generate a fresh app-specific password and update the secret. The 19-character format with hyphens is mandatory.
- **`Notarization failed: status: Invalid`** — usually means the binary isn't actually hardened-runtime-signed. Check `mac.hardenedRuntime: true` is in `electron-builder.yml`. The notary log (linked from the failure message) tells you which binary failed.
- **`HttpError: 403 Forbidden`** uploading to GitHub Releases — `GH_TOKEN` doesn't have `contents: write` on the repo. If using `${{ secrets.GITHUB_TOKEN }}`, ensure the workflow has `permissions: contents: write` at the workflow or job level.
- **Secrets disappear after I add them** — they don't disappear; the values are hidden by design. The names should remain in the list.

## Security Hygiene

- **Don't** commit any of these values to the repo, even in `.env` files, even in code comments.
- **Don't** echo them in workflow logs (GitHub masks, but build the habit).
- **If a secret leaks** (e.g., paste-into-Slack accident): revoke immediately.
  - `APPLE_APP_SPECIFIC_PASSWORD`: revoke at appleid.apple.com → "App-Specific Passwords"; generate a new one; update the GitHub secret.
  - `CSC_KEY_PASSWORD`: re-export the `.p12` with a new password; update both `CSC_LINK` and `CSC_KEY_PASSWORD`.
  - `CSC_LINK` itself doesn't need revoking — the cert is public-key-derived and you can't "leak" a cert + key without leaking the password too. If both leak, revoke the cert at developer.apple.com → Certificates and generate a new one. (No existing signed releases are invalidated; only new signatures with the revoked cert will fail.)
- **Rotation cadence:** none routinely required for Mnemo's scale. Apple cert renews annually; calendar-remind 30 days before. App-specific password lasts indefinitely; rotate only on suspected leak.
