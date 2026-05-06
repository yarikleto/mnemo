# Enrolling in the Apple Developer Program

> For: Mnemo maintainer (yaroslavp@wix.com) | Created: 2026-05-06 | Status: PENDING
> **Blocks:** ADR-007 (macOS code signing + notarization), VC-1 (no Gatekeeper warning), and therefore the entire v1 release.

## Why This Is Needed

Without an Apple Developer ID Application certificate, every macOS user who downloads Mnemo's `.dmg` hits a "Mnemo can't be opened because Apple cannot check it for malicious software" Gatekeeper warning. Most non-technical friends will close the dialog and never try again. VC-1 explicitly fails. This is the single largest risk in the pre-mortem.

You enroll once ($99/year). After that, the pipeline is automated forever — every CI release signs and notarizes itself.

## Prerequisites

- [ ] An Apple ID (the one you use for the App Store / iCloud is fine, but consider creating a dedicated `mnemo@…` Apple ID if you want to keep the cert separate from personal stuff — **recommendation: just use your existing Apple ID for now; you can transfer later**).
- [ ] A credit card with $99 USD available.
- [ ] A Mac you own (any Mac with macOS 12+) — needed once for certificate generation. **Cannot be a borrowed Mac**; the cert ends up in *your* Keychain.
- [ ] Two-factor auth enabled on the Apple ID (Apple requires it for Developer Program enrollment; if you sign into iCloud already you almost certainly have it).

## Cost & Timeline

- **$99 USD/year**, auto-renewing. Apple's "tax" — non-negotiable for distribution outside the App Store.
- **1–2 business days** for Apple to verify and activate your account after payment. Sometimes same-day; rarely longer than 48 hours.
- **Renewal:** annually. Set a calendar reminder for 30 days before expiry — if the cert expires, every existing signed release continues to work (signatures stay valid; notarization stapling is permanent), but you can't sign a new release until you renew.

## Individual vs Organization — Recommendation: Individual

Apple offers two enrollment types:

| | Individual | Organization |
|---|---|---|
| Cost | $99/yr | $99/yr |
| Verification | Quick (just identity) | Slow (D-U-N-S number, business docs, often 1–2 weeks) |
| App appears as | Your personal name | Your company name |
| Can convert later? | Yes, easily | n/a |

**Recommendation: enroll as Individual.** Mnemo is a solo-maintained project. The signing identity will read "Developer ID Application: Yaroslav Pakhaliuk (TEAMID)" on every user's Mac — that's fine and matches the open-source project ethos. If Mnemo ever grows into a company, you can convert the Individual account to an Organization without losing the existing certs, releases, or app history.

The D-U-N-S number requirement for Organization enrollment is the chief reason to skip it: getting a D-U-N-S number can take 1–2 weeks of bureaucratic back-and-forth, and we'd rather ship.

## Steps

### Step 1 — Enroll

1. Go to https://developer.apple.com/programs/enroll/
2. Sign in with your Apple ID. **2FA codes will be sent to your trusted devices.**
3. Pick **"Individual / Sole Proprietor"** when asked.
4. Confirm legal name + address (must match what's on your government ID; Apple may ask for verification).
5. Pay $99. Apple will email confirmation.
6. **Wait** for the activation email. This is the part outside your control — usually < 24 hours, occasionally 48.

### Step 2 — Generate the Developer ID Application certificate

Once the activation email arrives:

1. Open **Xcode** on the Mac you own. (If Xcode isn't installed, install Xcode Command Line Tools at minimum: `xcode-select --install`. The cert flow works fine without full Xcode IDE.)
2. Open **Xcode → Settings → Accounts** (or use the App Store Connect web UI directly — see below).
3. Click `+` → "Apple ID" → sign in with the Apple ID you just enrolled.
4. Select your team in the list → "Manage Certificates…"
5. Click `+` (bottom-left) → choose **"Developer ID Application"**. (NOT "Mac App Store", NOT "Developer ID Installer", NOT "Apple Development". The exact label is "Developer ID Application".)
6. Xcode generates the cert + private key, stores them in your Keychain, and uploads the public part to Apple.

**Alternative: web UI.** If Xcode is acting up:

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Click `+` to create a new certificate.
3. Pick **"Developer ID Application"**.
4. Generate a Certificate Signing Request (CSR) on your Mac:
   - Open **Keychain Access** → menu → "Keychain Access" → "Certificate Assistant" → "Request a Certificate from a Certificate Authority…"
   - Email + name (use your enrolled Apple ID details).
   - "Request is" = **"Saved to disk"** + check **"Let me specify key pair information"**.
   - Save the `.certSigningRequest` file somewhere.
   - When prompted: **2048 bits, RSA**.
5. Upload the `.certSigningRequest` to the Apple Developer page.
6. Apple gives you a `.cer` file. Double-click it; it imports into your Keychain along with the private key you just generated.

### Step 3 — Export the cert as a `.p12` file

This is the file CI needs to sign Mnemo on every release.

1. Open **Keychain Access**.
2. In the left sidebar, select **"login"** keychain and **"My Certificates"** category.
3. Find **"Developer ID Application: <Your Name> (XXXXXXXXXX)"** — it's a parent row that **expands to show the private key underneath it.** If you see only a cert with no private key, you generated the cert on a different Mac; you'll need to redo step 2 on this Mac.
4. **Right-click the parent row** (NOT just the private key) → "Export 'Developer ID Application: …'"
5. Format: **Personal Information Exchange (.p12)**.
6. Filename: `mnemo-mac-cert.p12`. Save it somewhere safe (NOT in the repo, NOT in Documents/mnemo).
7. **Set a strong password** when prompted. Write it down — you'll need it as the `CSC_KEY_PASSWORD` GitHub secret.
8. macOS will ask for your login keychain password to authorize the export. Enter it.

### Step 4 — Base64-encode the `.p12`

CI secrets must be ASCII. Encode the `.p12` once:

```bash
base64 -i ~/Downloads/mnemo-mac-cert.p12 | pbcopy
```

`pbcopy` puts the result on your clipboard. (Alternatively `base64 -i mnemo-mac-cert.p12 -o mnemo-mac-cert.p12.b64` writes to a file you can paste from.)

This base64 string will go into the **`CSC_LINK`** GitHub secret. The password from Step 3 goes into **`CSC_KEY_PASSWORD`**.

### Step 5 — Find your Team ID

1. Go to https://developer.apple.com/account
2. Top-right or left-sidebar shows **"Membership details"** → "Team ID" — a 10-character alphanumeric string (e.g., `A1B2C3D4E5`).
3. Save this. It's the **`APPLE_TEAM_ID`** GitHub secret.

### Step 6 — Generate an app-specific password for `notarytool`

Notarization auth uses an app-specific password (NOT your Apple ID password directly).

1. Go to https://appleid.apple.com → sign in.
2. **"Sign-In and Security"** → **"App-Specific Passwords"** → **"+"**.
3. Label: `mnemo-notarytool`. (The label is just a memo — Apple shows it in the list of issued passwords.)
4. Apple generates a 19-character password formatted like `xxxx-xxxx-xxxx-xxxx`. **Copy it now** — Apple will not show it again.
5. This is the **`APPLE_APP_SPECIFIC_PASSWORD`** GitHub secret.
6. Your Apple ID email (the one you enrolled with) is the **`APPLE_ID`** GitHub secret.

If you ever lose the password or suspect it leaked: revoke it from the same page, generate a new one, update the GitHub secret. Existing signed releases are unaffected (the password is only used at sign-time).

## After You're Done

Share with the developer agent (or the next CI setup pass) these five values, ready to paste into GitHub secrets:

- `APPLE_ID` — your Apple ID email (the one you enrolled with).
- `APPLE_APP_SPECIFIC_PASSWORD` — the 19-character `xxxx-xxxx-xxxx-xxxx` string from Step 6.
- `APPLE_TEAM_ID` — your 10-character Team ID from Step 5.
- `CSC_LINK` — the base64 string from Step 4.
- `CSC_KEY_PASSWORD` — the password you set when exporting the `.p12` in Step 3.

The next handoff (`github-secrets.md`) is the step-by-step for getting these into GitHub Actions.

## Verification (do this once, locally, before handing the values to CI)

You can verify the cert works by signing a tiny binary on your Mac:

```bash
# In /tmp, somewhere unrelated to the repo
echo 'console.log("hi")' > test.js
codesign --force --sign "Developer ID Application: <Your Name> (TEAMID)" test.js
codesign -dv --verbose=4 test.js
```

The last command should print:

```
Authority=Developer ID Application: <Your Name> (TEAMID)
Authority=Developer ID Certification Authority
Authority=Apple Root CA
TeamIdentifier=<TEAMID>
```

If you see this, the cert is good. If `codesign --force --sign` fails with "no identity found" — the private key isn't in the keychain (Step 2 was on a different Mac, or the export in Step 3 was the cert without the key).

## Troubleshooting

- **"Apple can't verify your enrollment information."** Apple's identity check needs the legal name on file at your bank to match what you typed. Re-check, retry; if it still fails, contact Apple Developer Support — they reply within 24h.
- **"No identity found" when signing.** The private key isn't in the keychain. Re-do Step 2 on a Mac you own.
- **The exported `.p12` won't import on another Mac (e.g., a teammate's).** That's correct — `.p12` is the way to move the cert+key together. Send the `.p12` (encrypted, e.g. via 1Password) + the password (out-of-band). For Mnemo's solo setup, this isn't needed; CI is the only consumer.
- **Cert expires in < 30 days notification.** Renew via the same Developer Console page. Existing signed releases stay valid; only new sign operations need the renewed cert.
- **"This certificate has an invalid issuer" in Keychain.** You may need the Apple Worldwide Developer Relations Intermediate Certificate from https://www.apple.com/certificateauthority/ — download and double-click.
- **Multiple Developer ID Application certs in the keychain.** Apple lets you have up to 5 active. If you see old ones, leave them alone — electron-builder will pick the most recent automatically.

## What Happens Next

Once you've:
- Enrolled and gotten the activation email.
- Generated the Developer ID Application cert.
- Exported it as `.p12`.
- Got an app-specific password.
- Have all five values listed under "After You're Done".

→ proceed to **`.claude/handoff/github-secrets.md`**. Total time from this point to a signed first build: ~15 minutes.
