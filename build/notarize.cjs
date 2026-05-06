// afterSign hook — called by electron-builder once the .app is signed but
// before it's wrapped into the .dmg / .zip. We invoke @electron/notarize to
// upload the .app to Apple's notary service, wait for a verdict, and staple
// the resulting ticket onto the .app on success.
//
// Skipped when:
//   - the platform isn't macOS (notarization is mac-only)
//   - APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID are not set
//     (e.g. local dev build, or a CI job that hasn't yet provisioned the
//     secrets — the build still succeeds but is ad-hoc-signed only).
'use strict'

const { notarize } = require('@electron/notarize')
const path = require('path')

exports.default = async function notarizeMac(context) {
  const { electronPlatformName, appOutDir, packager } = context
  if (electronPlatformName !== 'darwin') return

  const appleId = process.env.APPLE_ID
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD
  const teamId = process.env.APPLE_TEAM_ID
  if (!appleId || !appleIdPassword || !teamId) {
    console.log('[notarize] APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID not set — skipping notarization')
    return
  }

  const appName = packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)
  console.log(`[notarize] submitting ${appPath} to Apple notary service…`)
  await notarize({
    tool: 'notarytool',
    appPath,
    appleId,
    appleIdPassword,
    teamId
  })
  console.log('[notarize] success — staple step happens automatically when tool=notarytool')
}
