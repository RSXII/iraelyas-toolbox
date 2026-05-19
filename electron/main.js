const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

// ─── Constants ────────────────────────────────────────────────────────────────
const IS_DEV = process.env.NODE_ENV === "development" || !app.isPackaged;
const DEV_URL = "http://localhost:5173";
const DATA_FILE = path.join(app.getPath("userData"), "toolbox-data.json");

// ─── Windows ──────────────────────────────────────────────────────────────────
let mainWindow = null;
let editorWindow = null;
let treeEditorWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "Iraelya's 5e Toolbox",
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    // Platform-specific chrome
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: false, // show after ready-to-show to avoid flash
  });

  // Load app
  if (IS_DEV) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/renderer/index.html"));
  }

  // Show once fully rendered
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    // Close editor windows when main window closes
    if (editorWindow && !editorWindow.isDestroyed()) editorWindow.close();
    if (treeEditorWindow && !treeEditorWindow.isDestroyed())
      treeEditorWindow.close();
    mainWindow = null;
  });
}

// ─── Editor window ────────────────────────────────────────────────────────────
function createEditorWindow() {
  editorWindow = new BrowserWindow({
    width: 480,
    height: 720,
    minWidth: 400,
    minHeight: 500,
    title: "Timeline Editor",
    backgroundColor: "#111113",
    alwaysOnTop: true,
    // Don't show in taskbar/dock as a separate app entry
    parent: mainWindow ?? undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  if (IS_DEV) {
    editorWindow.loadURL("http://localhost:5173/editor.html");
  } else {
    editorWindow.loadFile(path.join(__dirname, "../dist/renderer/editor.html"));
  }

  editorWindow.once("ready-to-show", () => editorWindow.show());

  editorWindow.on("closed", () => {
    editorWindow = null;
    // Tell main window to re-render — catches any saves made during the session
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("timeline-updated");
    }
  });
}

// ─── Tree editor window ──────────────────────────────────────────────────────
function createTreeEditorWindow() {
  treeEditorWindow = new BrowserWindow({
    width: 780,
    height: 680,
    minWidth: 600,
    minHeight: 500,
    title: "Tree Editor",
    backgroundColor: "#111113",
    alwaysOnTop: true,
    parent: mainWindow ?? undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  if (IS_DEV) {
    treeEditorWindow.loadURL("http://localhost:5173/tree-editor.html");
  } else {
    treeEditorWindow.loadFile(
      path.join(__dirname, "../dist/renderer/tree-editor.html"),
    );
  }

  treeEditorWindow.once("ready-to-show", () => treeEditorWindow.show());

  treeEditorWindow.on("closed", () => {
    treeEditorWindow = null;
  });
}

// ─── IPC: Timeline editor window ──────────────────────────────────────────────

ipcMain.handle("open-timeline-editor", () => {
  if (editorWindow && !editorWindow.isDestroyed()) {
    // Already open — just focus it
    editorWindow.focus();
    return;
  }
  createEditorWindow();
});

// ─── IPC: Tree editor window ─────────────────────────────────────────────────

ipcMain.handle("open-tree-editor", () => {
  if (treeEditorWindow && !treeEditorWindow.isDestroyed()) {
    treeEditorWindow.focus();
    return;
  }
  createTreeEditorWindow();
});

// Get campaign list + active campaign + all houses for a campaign
ipcMain.handle("get-tree-context", (_event, campaignId) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const state = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return {
      campaigns: state.campaigns ?? [],
      activeCampaign: state.ui?.activeCampaign ?? "",
      houses: state.campaignData?.[campaignId]?.houses ?? {},
    };
  } catch (err) {
    console.error("get-tree-context error:", err);
    return null;
  }
});

// Write a single house into the state file and notify the main window
ipcMain.handle("save-house", (_event, campaignId, houseId, houseData) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return { ok: false, error: "No data file" };
    const state = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    if (!state.campaignData) state.campaignData = {};
    if (!state.campaignData[campaignId]) state.campaignData[campaignId] = {};
    if (!state.campaignData[campaignId].houses)
      state.campaignData[campaignId].houses = {};
    state.campaignData[campaignId].houses[houseId] = houseData;
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("tree-updated", campaignId);
    }
    return { ok: true };
  } catch (err) {
    console.error("save-house error:", err);
    return { ok: false, error: err.message };
  }
});

// Remove a house from the state file and notify the main window
ipcMain.handle("delete-house", (_event, campaignId, houseId) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return { ok: false, error: "No data file" };
    const state = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    if (state.campaignData?.[campaignId]?.houses) {
      delete state.campaignData[campaignId].houses[houseId];
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("tree-updated", campaignId);
    }
    return { ok: true };
  } catch (err) {
    console.error("delete-house error:", err);
    return { ok: false, error: err.message };
  }
});

// Open a native image file picker and return a base64 data URL
ipcMain.handle("pick-image", async () => {
  const win =
    treeEditorWindow && !treeEditorWindow.isDestroyed()
      ? treeEditorWindow
      : mainWindow;
  const result = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"],
      },
    ],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const mimeMap = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  const mime = mimeMap[ext] ?? "image/png";
  const data = fs.readFileSync(filePath);
  return `data:${mime};base64,${data.toString("base64")}`;
});

// ─── IPC: Timeline-specific data ops ─────────────────────────────────────────
// These let the editor window read/write only the timeline portion of the state,
// keeping IPC payloads small and the editor decoupled from full app state.

// Read the full app state from disk and return just the timeline for a campaign
ipcMain.handle("get-timeline", (_event, campaignId) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const state = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return state?.campaignData?.[campaignId]?.timeline ?? null;
  } catch (err) {
    console.error("get-timeline error:", err);
    return null;
  }
});

// Write an updated timeline back into the state file for a campaign,
// then notify the main window to re-render
ipcMain.handle("save-timeline", (_event, campaignId, timelineData) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return { ok: false, error: "No data file" };
    const state = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    if (!state.campaignData) state.campaignData = {};
    if (!state.campaignData[campaignId]) state.campaignData[campaignId] = {};
    state.campaignData[campaignId].timeline = timelineData;
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");

    // Notify main window to re-render the chronicle
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("timeline-updated");
    }
    return { ok: true };
  } catch (err) {
    console.error("save-timeline error:", err);
    return { ok: false, error: err.message };
  }
});

// Get just the campaign list + active campaign id so the editor can
// display context without needing the full state
ipcMain.handle("get-editor-context", () => {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const state = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return {
      campaigns: state.campaigns ?? [],
      activeCampaign: state.ui?.activeCampaign ?? "",
    };
  } catch (err) {
    console.error("get-editor-context error:", err);
    return null;
  }
});

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  // macOS: re-create window when clicking dock icon
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ─── IPC: Data persistence ────────────────────────────────────────────────────

// Load the unified state JSON from userData
ipcMain.handle("load-data", () => {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("load-data error:", err);
    return null;
  }
});

// Save the unified state JSON to userData
ipcMain.handle("save-data", (_event, data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    return { ok: true };
  } catch (err) {
    console.error("save-data error:", err);
    return { ok: false, error: err.message };
  }
});

// ─── IPC: Native file dialogs ─────────────────────────────────────────────────

// Open a file picker and return the file contents as a string
ipcMain.handle("import-file", async (_event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: filters || [{ name: "All Files", extensions: ["*"] }],
  });
  if (result.canceled || !result.filePaths.length) return null;

  // Return array of { name, content } objects
  return result.filePaths.map((fp) => ({
    name: path.basename(fp),
    content: fs.readFileSync(fp, "utf-8"),
  }));
});

// Save a file via native save dialog
ipcMain.handle("export-file", async (_event, filename, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename,
    filters: [
      { name: "JSON", extensions: ["json"] },
      { name: "JavaScript", extensions: ["js"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };

  try {
    fs.writeFileSync(result.filePath, content, "utf-8");
    return { ok: true, filePath: result.filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── IPC: App info ────────────────────────────────────────────────────────────
ipcMain.handle("get-version", () => app.getVersion());

ipcMain.handle("open-external", (_event, url) => {
  shell.openExternal(url);
});

// ─── IPC: userData path (for displaying to user in settings later) ────────────
ipcMain.handle("get-data-path", () => app.getPath("userData"));
