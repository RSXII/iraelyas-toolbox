const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  safeStorage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");

// ─── Constants ────────────────────────────────────────────────────────────────
const IS_DEV = process.env.NODE_ENV === "development" || !app.isPackaged;
const DEV_URL = "http://localhost:5173";
const DATA_FILE = path.join(app.getPath("userData"), "toolbox-data.json");
const API_KEY_FILE = path.join(app.getPath("userData"), "api-key.enc");
const PLUGINS_DIR = path.join(app.getPath("userData"), "plugins");

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
    backgroundColor: "#111115",
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

// ─── IPC: Plugin system ───────────────────────────────────────────────────────

/**
 * Scan PLUGINS_DIR for valid plugin manifests and return them.
 * Each manifest gets a runtime `_folderPath` so the renderer can
 * construct the iframe src without knowing userData.
 */
ipcMain.handle("get-plugins", () => {
  try {
    if (!fs.existsSync(PLUGINS_DIR)) {
      fs.mkdirSync(PLUGINS_DIR, { recursive: true });
      return [];
    }
    const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
    const manifests = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(PLUGINS_DIR, entry.name, "plugin.json");
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        // Validate required fields before trusting any manifest
        if (
          typeof manifest.id !== "string" ||
          typeof manifest.name !== "string" ||
          typeof manifest.version !== "string" ||
          typeof manifest.apiVersion !== "string" ||
          typeof manifest.entry !== "string"
        ) {
          console.warn("[plugins] skipping malformed manifest in", entry.name);
          continue;
        }
        // Attach computed folder path for the renderer to build the iframe src
        manifest._folderPath = path.join(PLUGINS_DIR, entry.name);
        manifests.push(manifest);
      } catch (parseErr) {
        console.warn(
          "[plugins] failed to parse manifest in",
          entry.name,
          parseErr.message,
        );
      }
    }
    return manifests;
  } catch (err) {
    console.error("get-plugins error:", err);
    return [];
  }
});

/** Return the absolute path to PLUGINS_DIR (used by settings UI). */
ipcMain.handle("get-plugin-data-path", () => PLUGINS_DIR);

/** Read plugin-namespaced data from the main data file. */
ipcMain.handle("plugin-data-get", (_event, pluginId, campaignId) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const state = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return state?.pluginData?.[pluginId]?.[campaignId] ?? {};
  } catch (err) {
    console.error("plugin-data-get error:", err);
    return {};
  }
});

/** Write plugin-namespaced data into the main data file. */
ipcMain.handle("plugin-data-set", (_event, pluginId, campaignId, data) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return { ok: false, error: "No data file" };
    const state = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    if (!state.pluginData) state.pluginData = {};
    if (!state.pluginData[pluginId]) state.pluginData[pluginId] = {};
    state.pluginData[pluginId][campaignId] = data;
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
    return { ok: true };
  } catch (err) {
    console.error("plugin-data-set error:", err);
    return { ok: false, error: err.message };
  }
});

/** Delete all stored data for a plugin (explicit user-initiated cleanup only). */
ipcMain.handle("plugin-data-delete", (_event, pluginId) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return { ok: false, error: "No data file" };
    const state = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    if (state.pluginData) delete state.pluginData[pluginId];
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
    return { ok: true };
  } catch (err) {
    console.error("plugin-data-delete error:", err);
    return { ok: false, error: err.message };
  }
});

/**
 * Given the list of currently-loaded plugin IDs, return any IDs in
 * pluginData that have no matching loaded plugin (orphaned data).
 */
ipcMain.handle("get-orphaned-plugin-data", (_event, loadedPluginIds) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const state = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    if (!state.pluginData) return [];
    const loaded = new Set(
      Array.isArray(loadedPluginIds) ? loadedPluginIds : [],
    );
    return Object.keys(state.pluginData).filter((id) => !loaded.has(id));
  } catch (err) {
    console.error("get-orphaned-plugin-data error:", err);
    return [];
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
// ─── IPC: Secure API key management ───────────────────────────────────────

ipcMain.handle("set-api-key", (_event, key) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return {
        ok: false,
        error: "Secure storage is not available on this system.",
      };
    }
    const encrypted = safeStorage.encryptString(key);
    fs.writeFileSync(API_KEY_FILE, encrypted.toString("base64"), "utf-8");
    return { ok: true };
  } catch (err) {
    console.error("set-api-key error:", err);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("has-api-key", () => fs.existsSync(API_KEY_FILE));

ipcMain.handle("clear-api-key", () => {
  try {
    if (fs.existsSync(API_KEY_FILE)) fs.unlinkSync(API_KEY_FILE);
    return { ok: true };
  } catch (err) {
    console.error("clear-api-key error:", err);
    return { ok: false, error: err.message };
  }
});

// ─── IPC: Claude AI enemy generation ──────────────────────────────────────────

ipcMain.handle("generate-enemy", async (_event, params, model) => {
  console.log(
    "[generate-enemy] invoked — params:",
    JSON.stringify(params),
    "model:",
    model,
  );
  try {
    if (!fs.existsSync(API_KEY_FILE)) {
      console.warn("[generate-enemy] no API key file at", API_KEY_FILE);
      return {
        ok: false,
        error:
          "No API key configured. Open AI Settings to add your Claude API key.",
      };
    }
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn("[generate-enemy] safeStorage not available");
      return {
        ok: false,
        error: "Secure storage is not available on this system.",
      };
    }

    // Decrypt — plaintext key lives only within this async call's scope
    const encBuf = Buffer.from(
      fs.readFileSync(API_KEY_FILE, "utf-8"),
      "base64",
    );
    const apiKey = safeStorage.decryptString(encBuf);
    console.log("[generate-enemy] key decrypted, length:", apiKey.length);

    const systemPrompt = [
      "You are a D&D 5e (2024 rules) monster stat block generator.",
      "Return ONLY a single valid JSON object. No markdown fences, no explanation, no extra text.",
      "",
      "Required fields: name, size, type, alignment, cr, xp, ac, ac_source, hp, hp_formula,",
      "  speed (object with walk integer), ability_scores (str/dex/con/int/wis/cha integers),",
      "  senses (object with passive_perception integer), languages (string array),",
      "  traits (array, may be empty []), actions (array with at least one entry).",
      "",
      "size values: Tiny | Small | Medium | Large | Huge | Gargantuan",
      "type values: Aberration | Beast | Celestial | Construct | Dragon | Elemental | Fey | Fiend | Giant | Humanoid | Monstrosity | Ooze | Plant | Undead",
      "action.type values (optional): weapon | spell | special | multiattack",
      "spellcasting.ability values (if present): STR | DEX | CON | INT | WIS | CHA",
      "hp_formula must match: NdN or NdN + N or NdN - N (e.g. '14d8 + 28')",
      "cr must be a number: 0, 0.125, 0.25, 0.5, or 1-30",
      "",
      "Include reactions and spellcasting only when thematically appropriate.",
    ].join("\n");

    const userPrompt = [
      `Generate a CR ${params.cr} ${params.focus}-focused ${params.type} enemy for D&D 5e 2024 rules.`,
      params.hints ? `Additional details: ${params.hints}` : "",
      "Return only the JSON stat block with no extra text.",
    ]
      .filter(Boolean)
      .join(" ");

    const requestBody = JSON.stringify({
      model: model || "claude-haiku-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    console.log("[generate-enemy] user prompt:", userPrompt);
    console.log("[generate-enemy] sending request to Anthropic...");
    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(requestBody),
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            reject(new Error("Failed to parse API response"));
          }
        });
      });

      req.on("error", reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error("Request timed out after 30 seconds"));
      });

      req.write(requestBody);
      req.end();
    });

    console.log("[generate-enemy] HTTP status:", result.status);
    console.log("[generate-enemy] response body:", JSON.stringify(result.body));

    if (result.status !== 200) {
      const msg =
        result.body?.error?.message ??
        `Claude API error (HTTP ${result.status})`;
      console.error("[generate-enemy] API error:", msg);
      return { ok: false, error: msg };
    }

    // Extract text from response and strip any accidental markdown fences
    let text = result.body?.content?.[0]?.text ?? "";
    console.log(
      "[generate-enemy] raw text length:",
      text.length,
      "| stop_reason:",
      result.body?.stop_reason,
    );
    console.log("[generate-enemy] raw text (first 500):", text.slice(0, 500));

    text = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    console.log(
      "[generate-enemy] stripped text (first 200):",
      text.slice(0, 200),
    );

    let enemy;
    try {
      enemy = JSON.parse(text);
      console.log("[generate-enemy] JSON parsed OK — enemy name:", enemy?.name);
    } catch (parseErr) {
      console.error("[generate-enemy] JSON.parse failed:", parseErr.message);
      console.error("[generate-enemy] full text that failed to parse:", text);
      return {
        ok: false,
        error: "Model returned invalid JSON. Try regenerating.",
      };
    }

    // Inject library key — not part of the Claude schema
    enemy.id = crypto.randomUUID();
    const usage = result.body?.usage ?? { input_tokens: 0, output_tokens: 0 };
    console.log(
      "[generate-enemy] returning ok, id:",
      enemy.id,
      "| usage:",
      usage,
    );

    return { ok: true, enemy, usage };
  } catch (err) {
    console.error("[generate-enemy] caught unexpected error:", err);
    return {
      ok: false,
      error: err.message ?? "Unknown error during generation",
    };
  }
});
// ─── IPC: Update check ───────────────────────────────────────────────────────
function isNewerVersion(current, latest) {
  const parse = (v) => v.replace(/^v/, "").split(".").map(Number);
  const c = parse(current);
  const l = parse(latest);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}

ipcMain.handle("check-for-update", () => {
  return new Promise((resolve) => {
    const options = {
      hostname: "api.github.com",
      path: "/repos/RSXII/iraelyas-toolbox/releases/latest",
      headers: { "User-Agent": "iraelyas-toolbox" },
    };
    const req = https.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const latestVersion = json.tag_name ?? null;
          if (!latestVersion) {
            resolve({ available: false });
            return;
          }
          const available = isNewerVersion(app.getVersion(), latestVersion);
          resolve({ available, latestVersion });
        } catch {
          resolve({ available: false });
        }
      });
    });
    req.on("error", () => resolve({ available: false }));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ available: false });
    });
  });
});
