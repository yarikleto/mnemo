// afterPack hook — flips the @electron/fuses on the final binary so
// runtime-injected code paths are disabled. Defense-in-depth: even if an
// attacker somehow gained access to the on-disk .app, they cannot enable
// node integration in any window or run electron with --inspect.
//
// Reference: ADR-012 (fuses table) in .claude/system-design.md.
'use strict'

const { flipFuses, FuseV1Options, FuseVersion } = require('@electron/fuses')
const { spawnSync } = require('child_process')
const path = require('path')

const SIGNING_XATTRS = [
  'com.apple.FinderInfo',
  'com.apple.ResourceFork',
  'com.apple.fileprovider.fpfs#P',
  'com.apple.provenance'
]

function clearMacSigningXattrs(rootPath) {
  spawnSync('xattr', ['-cr', rootPath], { stdio: 'ignore' })
  for (const attr of SIGNING_XATTRS) {
    spawnSync('xattr', ['-dr', attr, rootPath], { stdio: 'ignore' })
  }
}

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

  if (electronPlatformName === 'darwin') {
    // Extended attributes can be copied from downloaded dependencies into the
    // bundle and cause ad-hoc codesign to reject nested helper binaries.
    clearMacSigningXattrs(electronBinaryPath)
  }

  // ASAR integrity validation is anchored by the code signature, so it is only
  // meaningful for a *genuinely signed* build. This project ships unsigned /
  // ad-hoc for v1 (see electron-builder.yml), so leave it off until real
  // signing lands — and prefer driving fuses through electron-builder's own
  // `electronFuses` config then, so it also emits the per-file integrity
  // metadata. Gated on CSC_LINK, mirroring the hardenedRuntime gating in
  // electron-builder.yml.
  const isSignedBuild = Boolean(process.env.CSC_LINK)
  console.log(`[fuses] flipping fuses on ${electronBinaryPath} (asar integrity: ${isSignedBuild ? 'on' : 'off — unsigned build'})`)
  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: isSignedBuild,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    // MUST stay enabled: the renderer is loaded out of app.asar via
    // win.loadFile(), which resolves to a file:// URL pointing inside the
    // archive. With this fuse disabled, Node `require` can still read the asar
    // but the file:// protocol cannot — loadFile fails with ERR_FILE_NOT_FOUND
    // and the window renders blank (the v0.1.1 packaged-app regression).
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
    // electron-builder signs macOS bundles after this hook. Let that final
    // signing pass handle the modified binary; the intermediate ad-hoc reset
    // can fail on CI/workspaces that attach FinderInfo or File Provider xattrs.
    resetAdHocDarwinSignature: false
  })
  console.log('[fuses] done')
}
