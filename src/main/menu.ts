import { Menu, BrowserWindow, shell, app } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import type { MenuVerb } from '../shared/api'

const REPO_URL = 'https://github.com/yarikleto/mnemo'
const ISSUES_URL = `${REPO_URL}/issues/new`

// Install the macOS application menu. On Windows / Linux the renderer owns
// navigation; we suppress the default Electron Edit/View menu so it doesn't
// appear inside the window chrome.
export function installAppMenu(win: BrowserWindow): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }

  const dispatch = (verb: MenuVerb) => () => {
    if (win.isDestroyed()) return
    win.webContents.send(`menu:${verb}`)
  }
  const isDev = !app.isPackaged

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Preferences…', accelerator: 'Cmd+,', click: dispatch('open-settings') },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Card', accelerator: 'Cmd+N', click: dispatch('new-card') },
        { label: 'Open Vault Folder…', click: dispatch('open-vault-folder') },
        { type: 'separator' },
        { label: 'Import…', click: dispatch('import') },
        { label: 'Export Selected…', click: dispatch('export') },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find', accelerator: 'Cmd+F', click: dispatch('find') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Review',    accelerator: 'Cmd+1', click: dispatch('nav-review') },
        { label: 'Browse',    accelerator: 'Cmd+2', click: dispatch('nav-browse') },
        { label: 'Dashboard', accelerator: 'Cmd+3', click: dispatch('nav-dashboard') },
        { label: 'Settings',  accelerator: 'Cmd+4', click: dispatch('open-settings') },
        { type: 'separator' },
        { label: 'Toggle Theme', accelerator: 'Cmd+Shift+T', click: dispatch('toggle-theme') },
        { type: 'separator' },
        ...(isDev ? [{ role: 'reload' as const }, { role: 'toggleDevTools' as const }, { type: 'separator' as const }] : []),
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      role: 'help',
      submenu: [
        { label: 'Mnemo on GitHub', click: () => { void shell.openExternal(REPO_URL) } },
        { label: 'Report an Issue…', click: () => { void shell.openExternal(ISSUES_URL) } },
        { type: 'separator' },
        { label: 'Copy Diagnostics', click: dispatch('copy-diagnostics') }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
