// afterPack hook — flips the @electron/fuses on the final binary so
// runtime-injected code paths are disabled. Defense-in-depth: even if an
// attacker somehow gained access to the on-disk .app, they cannot enable
// node integration in any window or run electron with --inspect.
//
// Reference: ADR-012 (fuses table) in .claude/system-design.md.
'use strict'

const { flipFuses, FuseV1Options, FuseVersion } = require('@electron/fuses')
const path = require('path')

exports.default = async function setFuses(context) {
  const { electronPlatformName, appOutDir, packager } = context
  const productFilename = packager.appInfo.productFilename
  const ext = electronPlatformName === 'darwin' ? '.app' : (electronPlatformName === 'win32' ? '.exe' : '')
  // For macOS we point at the .app bundle; for Windows the .exe; for Linux
  // the unsuffixed binary at appOutDir/<productFilename>.
  const electronBinaryPath = electronPlatformName === 'darwin'
    ? path.join(appOutDir, `${productFilename}${ext}`)
    : electronPlatformName === 'win32'
      ? path.join(appOutDir, `${productFilename}${ext}`)
      : path.join(appOutDir, productFilename.toLowerCase().replace(/\s+/g, '-'))

  console.log(`[fuses] flipping fuses on ${electronBinaryPath}`)
  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    // resetAdHocDarwinSignature is required on darwin because flipping fuses
    // invalidates the existing signature — electron-builder will re-sign on
    // its next pass anyway.
    resetAdHocDarwinSignature: electronPlatformName === 'darwin'
  })
  console.log('[fuses] done')
}
