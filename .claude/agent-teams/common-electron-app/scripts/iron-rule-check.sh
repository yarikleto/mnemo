#!/bin/bash
# Electron separation enforcement on PreToolUse for Edit and Write tools.
#
# Three contexts in an Electron app — main (Node + full privilege), renderer
# (Chromium, untrusted), preload (sandboxed bridge). Each has rules. This hook
# blocks edits that violate them, plus a few project-wide footguns.
#
# Each rule is a separate guarded block — readable, greppable, easy to extend.
# Exit 2 + stderr to block; exit 0 to allow.
#
# Scope: source files only. Markdown, ADRs, JSON config (except package.json),
# .env, lockfiles, etc. are skipped — those are documents that may legitimately
# discuss the patterns we forbid in code.

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // .tool_input.new_string // empty')

if [ -z "$FILE_PATH" ] || [ -z "$NEW_CONTENT" ]; then
  exit 0
fi

PATH_LOWER=$(echo "$FILE_PATH" | tr '[:upper:]' '[:lower:]')

is_js_source() {
  case "$PATH_LOWER" in
    *.ts|*.tsx|*.js|*.jsx|*.cjs|*.mjs) return 0 ;;
  esac
  return 1
}

is_package_json() {
  case "$PATH_LOWER" in
    */package.json|package.json) return 0 ;;
  esac
  return 1
}

# Anchored to repo-shape directories. Bare */main/* would match docs/main/...
# and trip on prose; require src/, app/, or electron/ as the parent marker.
is_main_file() {
  case "$PATH_LOWER" in
    */src/main/*|*/app/main/*|*/electron/main/*) return 0 ;;
  esac
  return 1
}

is_renderer_file() {
  case "$PATH_LOWER" in
    */src/renderer/*|*/app/renderer/*|*/electron/renderer/*) return 0 ;;
  esac
  return 1
}

is_preload_file() {
  case "$PATH_LOWER" in
    */src/preload/*|*/app/preload/*|*/electron/preload/*) return 0 ;;
    *preload.ts|*preload.js|*preload.cjs|*preload.mjs) return 0 ;;
  esac
  return 1
}

block() {
  local rule="$1"
  local detail="$2"
  echo "ELECTRON IRON-RULE VIOLATION: $rule" >&2
  echo "File: $FILE_PATH" >&2
  echo "$detail" >&2
  exit 2
}

# Rule M1: main process must keep secure webPreferences defaults
if is_js_source && is_main_file; then
  if echo "$NEW_CONTENT" | grep -Eq 'nodeIntegration\s*:\s*true'; then
    block "main: nodeIntegration: true is forbidden" \
      "contextIsolation + sandbox + nodeIntegration:false is the secure default. Expose APIs via contextBridge in preload instead."
  fi
  if echo "$NEW_CONTENT" | grep -Eq 'contextIsolation\s*:\s*false'; then
    block "main: contextIsolation: false is forbidden" \
      "contextIsolation must stay true. Without it, the renderer can reach into Electron internals."
  fi
  if echo "$NEW_CONTENT" | grep -Eq 'sandbox\s*:\s*false'; then
    block "main: sandbox: false is forbidden" \
      "sandbox must stay true. Drop a window into the OS sandbox; do privileged work in main via IPC."
  fi
  if echo "$NEW_CONTENT" | grep -Eq 'webSecurity\s*:\s*false'; then
    block "main: webSecurity: false is forbidden" \
      "Disabling webSecurity removes same-origin policy. Use a custom protocol handler instead."
  fi
  if echo "$NEW_CONTENT" | grep -Eq 'allowRunningInsecureContent\s*:\s*true'; then
    block "main: allowRunningInsecureContent: true is forbidden" \
      "Mixed content opens HTTPS pages to MITM-injected scripts."
  fi
  if echo "$NEW_CONTENT" | grep -Eq 'enableRemoteModule|@electron/remote'; then
    block "main: @electron/remote / enableRemoteModule are forbidden" \
      "Removed in Electron 14. Use ipcMain.handle + contextBridge instead."
  fi
fi

# Rule R1: renderer must not import privileged Node APIs directly.
# Both require() and ESM import forms are checked symmetrically.
if is_js_source && is_renderer_file; then
  if echo "$NEW_CONTENT" | grep -Eq "require\(['\"]electron['\"]\)|from\s+['\"]electron['\"]"; then
    block "renderer: direct 'electron' import is forbidden" \
      "Renderer code is untrusted. Reach Electron APIs only through window.api exposed by preload."
  fi
  if echo "$NEW_CONTENT" | grep -Eq "require\(['\"]fs['\"]\)|require\(['\"]fs/promises['\"]\)|from\s+['\"]fs['\"]|from\s+['\"]fs/promises['\"]"; then
    block "renderer: direct 'fs' import is forbidden" \
      "Filesystem access belongs in main. Add a typed IPC handler and call it from preload."
  fi
  if echo "$NEW_CONTENT" | grep -Eq "require\(['\"]child_process['\"]\)|from\s+['\"]child_process['\"]"; then
    block "renderer: direct 'child_process' import is forbidden" \
      "Spawning processes is a main-process concern. Define an IPC handler with origin + payload validation."
  fi
  if echo "$NEW_CONTENT" | grep -Eq "require\(['\"](path|os|net)['\"]\)|from\s+['\"](path|os|net)['\"]"; then
    block "renderer: direct Node API import is forbidden" \
      "Node APIs do not belong in the renderer with sandbox + contextIsolation. Wrap them behind preload."
  fi
fi

# Rule P1: preload must not expose raw ipcRenderer in the inline form.
# Patterns that escape this regex (local-var alias, spread, object pun) are
# caught by the reviewer's reject-on-sight checklist, not by this hook.
if is_js_source && is_preload_file; then
  if echo "$NEW_CONTENT" | grep -Eq 'contextBridge\.exposeInMainWorld\([^,]+,\s*ipcRenderer\b'; then
    block "preload: exposing raw ipcRenderer is forbidden" \
      "Expose typed wrappers like { saveDoc: (doc) => ipcRenderer.invoke('docs:save', doc) }. Never the raw object."
  fi
fi

# Rule X1: dynamic code execution on non-literal input is forbidden anywhere
# in source files. Skipped for prose so docs can describe the threat.
if is_js_source; then
  if echo "$NEW_CONTENT" | grep -Eq 'webContents\.executeJavaScript\s*\(\s*[^"`'\'']'; then
    block "any: webContents.executeJavaScript on non-literal is forbidden" \
        "Only literal strings allowed. Anything dynamic is a renderer compromise away from RCE."
  fi
  if echo "$NEW_CONTENT" | grep -Eq '(^|[^a-zA-Z0-9_])eval\s*\(\s*[^"`'\'']'; then
    block "any: eval() on non-literal is forbidden" \
      "eval on dynamic input is RCE. Refactor to a structured handler."
  fi
  if echo "$NEW_CONTENT" | grep -Eq 'new\s+Function\s*\(\s*[^"`'\'']'; then
    block "any: new Function() on non-literal is forbidden" \
      "Same hazard as eval. Replace with a real parser or handler."
  fi
fi

# Rule X2: the deprecated `electron-rebuild` package must not appear as a
# dependency. The same string is also the bin name shipped by `@electron/rebuild`,
# so we only flag it when it appears as a dependency-version pair in package.json
# (e.g. `"electron-rebuild": "^3.2.0"`). Bin invocations in `scripts:` are fine.
if is_package_json; then
  if echo "$NEW_CONTENT" | grep -Eq '"electron-rebuild"\s*:\s*"\^?~?[0-9]'; then
    block "any: electron-rebuild package is deprecated" \
      "Replace the dependency with @electron/rebuild. The bin name (electron-rebuild) is unchanged, so postinstall scripts continue to work."
  fi
fi

exit 0
