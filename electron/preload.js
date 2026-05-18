const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exposes a minimal, typed API surface to the renderer process.
 * The renderer never touches Node/Electron APIs directly.
 * All file I/O goes through this bridge.
 */
contextBridge.exposeInMainWorld('toolbox', {
  // ── Persistence ────────────────────────────────────────────────
  /** Load the unified app state from disk. Returns null on first launch. */
  loadData: () =>
    ipcRenderer.invoke('load-data'),

  /** Persist the full app state to disk. */
  saveData: (data) =>
    ipcRenderer.invoke('save-data', data),

  // ── File dialogs ───────────────────────────────────────────────
  /**
   * Open a native file picker.
   * @param filters  e.g. [{ name: 'JSON', extensions: ['json'] }]
   * @returns Array of { name: string, content: string } or null if canceled.
   */
  importFile: (filters) =>
    ipcRenderer.invoke('import-file', filters),

  /**
   * Open a native save dialog and write content to the chosen path.
   * @param filename  Suggested filename (e.g. 'toolbox_backup.json')
   * @param content   String content to write
   */
  exportFile: (filename, content) =>
    ipcRenderer.invoke('export-file', filename, content),

  // ── App info ───────────────────────────────────────────────────
  getVersion: () =>
    ipcRenderer.invoke('get-version'),

  getDataPath: () =>
    ipcRenderer.invoke('get-data-path'),

  openExternal: (url) =>
    ipcRenderer.invoke('open-external', url),

  // ── Platform ───────────────────────────────────────────────────
  /** 'darwin' | 'win32' | 'linux' */
  platform: process.platform,
});
