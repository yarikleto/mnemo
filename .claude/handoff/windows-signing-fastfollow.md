# Windows Code Signing — Fast-Follow

> For: Mnemo maintainer | Created: 2026-05-06 | Status: **POST-V1, DEFERRED**
> **Trigger to act on this:** ≥ 5 Windows users surface from the GitHub audience OR SmartScreen "unrecognized app" is the #1 GitHub-issue complaint for two consecutive weeks. Until then, **don't spend the money.**

## Why This Is Deferred (and not skipped)

v1 ships an **unsigned** Windows NSIS `.exe`. That means every Windows user who downloads Mnemo sees a **Microsoft SmartScreen "Windows protected your PC" warning** when they double-click. To install, they have to click "More info" → "Run anyway." Most cautious users will close the dialog and never try again.

The reasons we accept this at v1, and the reasons we'll fix it eventually:

- **Cost.** Cheapest 2025 path is ~$120/year (Azure Trusted Signing) plus identity validation. Not nothing for a free, solo-maintained project.
- **Audience.** The product vision (§"Target Platforms") expects most users on macOS, some on Linux, few on Windows. Spending the money before any Windows users surface is poor allocation.
- **Reputation accumulation is slow.** Even after you sign, SmartScreen still warns until your binary builds reputation (50+ installs over weeks/months). Buying the cert doesn't immediately make the warning vanish.
- **Post-June-2023 reality.** The cheap path (EV USB token, ~$300 once, hardware dongle) is **closed for new buyers**. Public CAs no longer issue exportable code-signing keys; everything is cloud-HSM-backed now. So the "just buy a cert" world is gone — the new options all involve subscriptions and identity validation.

## When to revisit

The trigger is one of:

- **5+ Windows users** open issues, comment, or otherwise express that they tried Mnemo. (Use GitHub Insights → Traffic → Referrers + the issue tracker as signal.)
- **SmartScreen warnings** are the most-cited friction in GitHub issues for two consecutive weeks.
- **A potential commercial use** appears (an org wants to install Mnemo across employee laptops; SmartScreen-Plus-Defender refusal blocks them). This bumps priority hard.

If none of those happen in the first 6 months, leave the warning in place. The README's "Installation on Windows" section explains the workaround. That's enough.

## Provider Comparison (mid-2025 state)

Three viable providers. All sign via cloud HSM (Microsoft mandates this since June 2023).

| | **Azure Trusted Signing** | **DigiCert KeyLocker** | **SSL.com eSigner** |
|---|---|---|---|
| Pricing model | $9.99 / month | ~$300/year + per-signature fees on some tiers | ~$300/year |
| Approx. annual cost | ~$120 | ~$300+ | ~$300+ |
| Identity validation | Microsoft Entra (M365 / Azure tenant) + 3-year-old org check | DigiCert Validation team review | Standard CA validation |
| Time to first sign | 1–3 days (instant SmartScreen reputation for verified Microsoft Partners) | 3–7 days (CA validates) | 3–7 days (CA validates) |
| electron-builder native support | Yes, `azureSignOptions` (≥ v25) | Via `signtool` plugin | Via `signtool` plugin (or eSigner CLI) |
| SmartScreen reputation | Inherits Microsoft Partner Network reputation if your tenant has it; otherwise builds slowly | Builds slowly | Builds slowly |
| Eligibility for Individual signers | Org signers preferred; Individual is possible but harder | Yes | Yes |
| Hardware needed | None | None | None |
| Auth on hosted GitHub runners | Service principal (`AZURE_TENANT_ID`/`CLIENT_ID`/`CLIENT_SECRET`) | Username/password + auth file | Username/password + TOTP |

### Why Azure Trusted Signing is the default recommendation

1. **Cheapest by ~$180/year.**
2. **Native electron-builder support** since v25; just add `azureSignOptions` to `electron-builder.yml`'s `win` block.
3. **Service-principal auth** plays well with GitHub Actions secrets — no manual TOTP, no per-signature interactive flows.
4. **Microsoft is the operator** — same vendor as the SmartScreen system that'll be checking the signature. If anyone has the right reputation pipeline, it's them.
5. **Eligibility:** As of mid-2025, Microsoft's Trusted Signing eligibility leaned heavily toward US/Canada-registered businesses with 3+ years of verifiable operating history. **For a personal/individual signer, double-check current Microsoft docs at the time of revisit** — they iterate the rules.

### When DigiCert KeyLocker / SSL.com eSigner make more sense

- **You can't qualify for Azure Trusted Signing** (e.g., Individual signer with no business entity, or non-US/Canada and Microsoft hasn't loosened the rules yet).
- **You already have a business relationship** with DigiCert / SSL.com from a previous project — don't fragment vendor accounts.
- **You want a CA-issued cert** (some procurement processes prefer a "real CA" over a managed-signing-service identity; rarely matters for an open-source desktop app).

### Hardware-EV USB tokens — do not go this path

- **Closed to new buyers since June 2023.** Public CAs stopped issuing exportable keys.
- Older second-hand tokens are unreliable, may have shortened validity, and cannot be used on hosted GitHub runners (require a human at the box).
- Listed only because Stack Overflow answers from 2022 still recommend it. Ignore those.

## Default Recommendation

**Azure Trusted Signing**, gated on:
- The Windows-audience trigger above.
- Eligibility verification at time-of-act (Microsoft loosens / tightens rules; check current Trusted Signing docs).

If eligibility blocks you, fall back to **DigiCert KeyLocker** (more popular than SSL.com eSigner; more electron-builder integration documentation around).

## Implementation Sketch (when triggered)

This is what the developer agent will do at fast-follow time. **Do not execute now — listed for future reference.**

### Azure Trusted Signing path

1. **Provision tenant.** Sign up at https://aka.ms/trustedsigning. Provide org details, accept Microsoft's Identity Validation. Wait 1–3 business days for activation.
2. **Create a code-signing account + certificate profile** in the Azure portal. Note the:
   - `endpoint` (e.g., `https://eus.codesigning.azure.net`)
   - `codeSigningAccountName`
   - `certificateProfileName`
3. **Create an Entra ID app registration** for CI auth:
   - Client ID, Client Secret, Tenant ID — these are the three secrets.
   - Grant the app the "Trusted Signing Certificate Profile Signer" role on the certificate profile.
4. **Add three GitHub secrets** (per `github-secrets.md` Step 6):
   - `AZURE_TENANT_ID`
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`
5. **Update `electron-builder.yml`:**
   ```yaml
   win:
     publisherName: 'Yaroslav Pakhaliuk'   # MUST match the cert's CN exactly; electron-updater verifies updates against this
     azureSignOptions:
       publisherName: 'Yaroslav Pakhaliuk'
       endpoint: https://eus.codesigning.azure.net
       certificateProfileName: mnemo-codesign
       codeSigningAccountName: mnemo-signing
   ```
6. **Add the env vars to the Windows job** in `release.yml`:
   ```yaml
   env:
     AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
     AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
     AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
   ```
7. **Re-tag** to trigger the workflow. Verify the resulting `.exe`'s signature on a Windows machine: `signtool verify /pa /v "Mnemo Setup X.Y.Z.exe"`. The output should report a valid Microsoft-trusted code-signing chain.
8. **Auto-update.** `verifyUpdateCodeSignature` (already on by default per ADR-006) extends to Windows automatically — `electron-updater` checks the published Authenticode signature against the `publisherName` field in `electron-builder.yml`. If they match, updates roll forward; if not (e.g., the cert is rotated and `publisherName` wasn't updated), users are stuck and must manually reinstall.

### DigiCert KeyLocker path (alternative)

Roughly similar shape, but `signtool` is invoked via DigiCert's `smctl` plugin instead of native electron-builder support. More config, more secrets to wire. Documented at https://docs.digicert.com/en/digicert-keylocker.html.

## Authoring the README footnote (do this NOW for v1)

Until signing lands, the README's "Installation on Windows" section should say:

> **Heads up — Windows SmartScreen warning at v1.**
>
> Mnemo's macOS builds are signed and notarized; you'll get a clean install. **Windows builds at v1 are unsigned**, which means Microsoft SmartScreen will show a "Windows protected your PC" warning when you run the installer. To install:
>
> 1. Click **"More info"** in the SmartScreen dialog.
> 2. Click **"Run anyway"**.
>
> This is a known v1 limitation; Windows code signing is on the fast-follow list. If you're a Windows user reading this and want signing prioritized, please open a GitHub issue — your signal directly drives the trigger threshold.

Setting this expectation in the README defuses the "is this malware?" reaction and turns it into "fair, the maintainer told me."

## Renewal & Operational Notes (when active)

- **Cert validity:** typically 1–3 years for the Trusted Signing cert. Microsoft handles renewal automatically; the certificate profile rotates the underlying cert without requiring config changes (as long as `publisherName` stays the same).
- **`publisherName` must be stable forever.** If you change your legal name or rebrand, every existing user can't auto-update past the change unless the new releases keep the *old* `publisherName` for a deprecation window. Plan accordingly.
- **Subscription pause.** If you stop paying for Trusted Signing, existing signed releases continue to work (signatures don't retroactively invalidate). New releases sign with whatever the next provider is.
- **SmartScreen reputation builds gradually.** First release post-signing still warns. By release 5–10, most users get clean installs. Not your fault; that's how SmartScreen works.

## Checklist for Future Triggering

When the trigger condition fires:

- [ ] Confirm Azure Trusted Signing eligibility at Microsoft's current docs.
- [ ] If eligible: enroll, fund, validate.
- [ ] If not eligible: pivot to DigiCert KeyLocker. (~$300/year line item.)
- [ ] Add `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` (or KeyLocker equivalents) to GitHub secrets.
- [ ] Add `azureSignOptions` (or KeyLocker config) to `electron-builder.yml`.
- [ ] Add the env vars to the `windows-latest` job in `release.yml`.
- [ ] Tag a release; verify `signtool verify /pa` on the resulting `.exe`.
- [ ] Update README to remove the SmartScreen-warning footnote, or amend it to "first few releases may still warn until SmartScreen reputation builds."
- [ ] Document the change in CEO brain.
- [ ] **Verify Windows auto-update round-trip** with a Windows-side rehearsal analogous to `release-rehearsal.md` — install signed v(N), publish v(N+1), verify the running v(N) detects, downloads, and applies on quit.

## Out of Scope (forever, probably)

- **Microsoft Store distribution.** Sandbox confinement breaks the file-watcher killer feature; 30% revenue share for a free app is also a non-starter.
- **MSIX packaging.** Microsoft Store-flavored packaging that auto-updates via the Store. Same reasons.
- **Per-machine vs per-user installer toggle.** NSIS `.exe` is per-user by default; that's fine for the audience. Per-machine adds complexity (UAC prompt, installer signing requirements). Defer indefinitely.
