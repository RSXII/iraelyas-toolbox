const { contextBridge, ipcRenderer } = require("electron");

/**
 * Exposes a minimal, typed API surface to the renderer process.
 * The renderer never touches Node/Electron APIs directly.
 * All file I/O goes through this bridge.
 */
contextBridge.exposeInMainWorld("toolbox", {
  // ── Persistence ────────────────────────────────────────────────
  /** Load the unified app state from disk. Returns null on first launch. */
  loadData: () => ipcRenderer.invoke("load-data"),

  /** Persist the full app state to disk. */
  saveData: (data) => ipcRenderer.invoke("save-data", data),

  // ── File dialogs ───────────────────────────────────────────────
  /**
   * Open a native file picker.
   * @param filters  e.g. [{ name: 'JSON', extensions: ['json'] }]
   * @returns Array of { name: string, content: string } or null if canceled.
   */
  importFile: (filters) => ipcRenderer.invoke("import-file", filters),

  /**
   * Open a native save dialog and write content to the chosen path.
   * @param filename  Suggested filename (e.g. 'toolbox_backup.json')
   * @param content   String content to write
   */
  exportFile: (filename, content) =>
    ipcRenderer.invoke("export-file", filename, content),

  // ── App info ───────────────────────────────────────────────────
  getVersion: () => ipcRenderer.invoke("get-version"),

  getDataPath: () => ipcRenderer.invoke("get-data-path"),

  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // ── Timeline editor window ─────────────────────────────────────
  /** Open (or focus) the always-on-top timeline editor window */
  openTimelineEditor: () => ipcRenderer.invoke("open-timeline-editor"),

  /** Read the timeline for a specific campaign from disk */
  getTimeline: (campaignId) => ipcRenderer.invoke("get-timeline", campaignId),

  /** Write an updated timeline to disk and notify the main window */
  saveTimeline: (campaignId, timelineData) =>
    ipcRenderer.invoke("save-timeline", campaignId, timelineData),

  /** Get campaign list + active campaign id for the editor window */
  getEditorContext: () => ipcRenderer.invoke("get-editor-context"),

  /** Listen for timeline-updated events pushed from main process */
  onTimelineUpdated: (callback) => ipcRenderer.on("timeline-updated", callback),

  /** Remove timeline-updated listener (cleanup) */
  offTimelineUpdated: (callback) =>
    ipcRenderer.removeListener("timeline-updated", callback),

  // ── Tree editor window ─────────────────────────────────────
  /** Open (or focus) the always-on-top tree editor window */
  openTreeEditor: () => ipcRenderer.invoke("open-tree-editor"),

  /** Get campaign list + active campaign + houses for a campaign */
  getTreeContext: (campaignId) =>
    ipcRenderer.invoke("get-tree-context", campaignId),

  /** Write an updated HouseData to disk and notify the main window */
  saveHouse: (campaignId, houseId, data) =>
    ipcRenderer.invoke("save-house", campaignId, houseId, data),

  /** Delete a house from disk and notify the main window */
  deleteHouse: (campaignId, houseId) =>
    ipcRenderer.invoke("delete-house", campaignId, houseId),

  /** Open a native image file picker; returns absolute path or null */
  pickImage: () => ipcRenderer.invoke("pick-image"),

  /** Listen for tree-updated events pushed from main process */
  onTreeUpdated: (callback) =>
    ipcRenderer.on("tree-updated", (_e, campaignId) => callback(campaignId)),

  /** Remove tree-updated listener (cleanup) */
  offTreeUpdated: (callback) =>
    ipcRenderer.removeListener("tree-updated", callback),

  // ── Platform ───────────────────────────────────────────────────
  /** 'darwin' | 'win32' | 'linux' */
  platform: process.platform,

  // ── Build variant ─────────────────────────────────────────────
  /** True when this is a beta build (productName contains 'Beta') */
  isBeta: (require("../package.json").productName ?? "").includes("Beta"),
});
