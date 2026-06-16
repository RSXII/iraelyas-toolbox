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

  checkForUpdate: () => ipcRenderer.invoke("check-for-update"),

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

  /** Open a native image file picker; returns a base64 data URL or null */
  pickImage: () => ipcRenderer.invoke("pick-image"),

  /** Listen for tree-updated events pushed from main process */
  onTreeUpdated: (callback) =>
    ipcRenderer.on("tree-updated", (_e, campaignId) => callback(campaignId)),

  /** Remove tree-updated listener (cleanup) */
  offTreeUpdated: (callback) =>
    ipcRenderer.removeListener("tree-updated", callback),

  // ── AI / Enemy generation ──────────────────────────────────────
  /** Encrypt and persist the Claude API key via OS safeStorage */
  setApiKey: (key) => ipcRenderer.invoke("set-api-key", key),

  /** Returns true if an encrypted API key is stored */
  hasApiKey: () => ipcRenderer.invoke("has-api-key"),

  /** Remove the stored encrypted API key */
  clearApiKey: () => ipcRenderer.invoke("clear-api-key"),

  /**
   * Generate a monster stat block via Claude.
   * @param params  { cr, focus, type, hints? }
   * @param model   Claude model id (e.g. 'claude-haiku-4-5')
   */
  generateEnemy: (params, model) =>
    ipcRenderer.invoke("generate-enemy", params, model),

  // ── Platform ───────────────────────────────────────────────────
  /** 'darwin' | 'win32' | 'linux' */
  platform: process.platform,

  // ── Build variant ─────────────────────────────────────────────
  /** True when this is a beta build (productName contains 'Beta') */
  isBeta: (require("../package.json").productName ?? "").includes("Beta"),

  // ── Plugin system ──────────────────────────────────────────────
  /** Scan userData/plugins/ and return an array of valid PluginManifest objects */
  getPlugins: () => ipcRenderer.invoke("get-plugins"),

  /** Rescan after install/remove and return a fresh manifest list */
  rescanPlugins: () => ipcRenderer.invoke("rescan-plugins"),

  /** Open a folder picker, validate, copy into userData/plugins/, return manifest */
  installPlugin: () => ipcRenderer.invoke("install-plugin"),

  /** Delete a plugin folder from userData/plugins/ */
  removePlugin: (pluginId) => ipcRenderer.invoke("remove-plugin", pluginId),

  /** Return the absolute path to the plugins directory */
  getPluginDataPath: () => ipcRenderer.invoke("get-plugin-data-path"),

  /** Plugin data — all operations are scoped to pluginId + campaignId */
  pluginData: {
    /** Read stored data for a plugin in a specific campaign */
    get: (pluginId, campaignId) =>
      ipcRenderer.invoke("plugin-data-get", pluginId, campaignId),

    /** Write stored data for a plugin in a specific campaign */
    set: (pluginId, campaignId, data) =>
      ipcRenderer.invoke("plugin-data-set", pluginId, campaignId, data),

    /** Delete all stored data for a plugin (user-initiated cleanup) */
    delete: (pluginId) => ipcRenderer.invoke("plugin-data-delete", pluginId),

    /** Return plugin IDs that have stored data but are no longer installed */
    getOrphaned: (loadedPluginIds) =>
      ipcRenderer.invoke("get-orphaned-plugin-data", loadedPluginIds),
  },
});
