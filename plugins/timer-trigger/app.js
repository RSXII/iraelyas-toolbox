"use strict";

// ─── State ────────────────────────────────────────────────────────────────────

/** The config persisted via PluginAPI.data. null = nothing saved yet. */
let savedConfig = null;

/** Handle for the active setInterval countdown tick. */
let countdownInterval = null;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const states = {
  loading: document.getElementById("state-loading"),
  setup: document.getElementById("state-setup"),
  armed: document.getElementById("state-armed"),
  fired: document.getElementById("state-fired"),
  error: document.getElementById("state-error"),
};

// Setup
const entrySelect = document.getElementById("entry-select");
const noEntriesMsg = document.getElementById("no-entries-msg");
const datetimeInput = document.getElementById("datetime-input");
const deltaInput = document.getElementById("delta-input");
const setupError = document.getElementById("setup-error");
const saveBtn = document.getElementById("save-btn");

// Armed
const armedEntryName = document.getElementById("armed-entry-name");
const armedTargetLabel = document.getElementById("armed-target-label");
const armedDeltaLabel = document.getElementById("armed-delta-label");
const countdownDisplay = document.getElementById("countdown-display");
const resetBtn = document.getElementById("reset-btn");

// Fired
const firedEntryName = document.getElementById("fired-entry-name");
const firedSummary = document.getElementById("fired-summary");
const newTimerBtn = document.getElementById("new-timer-btn");

// Error
const errorMessage = document.getElementById("error-message");
const errorResetBtn = document.getElementById("error-reset-btn");

// ─── UI helpers ───────────────────────────────────────────────────────────────

/** Show one state panel, hide all others. */
function showState(name) {
  Object.entries(states).forEach(function (pair) {
    pair[1].classList.toggle("hidden", pair[0] !== name);
  });
}

/** Format a remaining-millisecond value into a human-readable countdown string. */
function formatCountdown(ms) {
  if (ms <= 0) return "0s";
  var totalSec = Math.floor(ms / 1000);
  var sec = totalSec % 60;
  var totalMin = Math.floor(totalSec / 60);
  var min = totalMin % 60;
  var totalHr = Math.floor(totalMin / 60);
  var hr = totalHr % 24;
  var days = Math.floor(totalHr / 24);
  if (days > 0) return days + "d " + hr + "h";
  if (hr > 0) return hr + "h " + min + "m";
  if (min > 0) return min + "m " + sec + "s";
  return sec + "s";
}

/** Format an ISO datetime string for display. */
function formatDatetime(iso) {
  var d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Clear the countdown interval if one is running. */
function stopInterval() {
  if (countdownInterval !== null) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

/** Persist config and update local savedConfig reference. */
async function persistConfig(config) {
  savedConfig = config;
  await PluginAPI.data.save(config);
}

/** Clear all saved data and reset local state. */
async function clearConfig() {
  savedConfig = null;
  await PluginAPI.data.save({});
}

// ─── Tracker entry picker ─────────────────────────────────────────────────────

/**
 * Fetch tracker entries for the current campaign and populate the select.
 * Shows a help message if the campaign has no entries yet.
 */
async function populateEntrySelect() {
  entrySelect.innerHTML = '<option value="">— select an entry —</option>';
  try {
    var entries = await PluginAPI.actions.getTrackerEntries();
    if (!entries || entries.length === 0) {
      noEntriesMsg.classList.remove("hidden");
      entrySelect.classList.add("hidden");
      return;
    }
    noEntriesMsg.classList.add("hidden");
    entrySelect.classList.remove("hidden");
    entries.forEach(function (e) {
      var opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = e.name + " (" + e.category + ")";
      entrySelect.appendChild(opt);
    });
  } catch (err) {
    console.error("[TimerTrigger] getTrackerEntries failed:", err);
  }
}

// ─── State renderers ──────────────────────────────────────────────────────────

async function enterSetupState() {
  stopInterval();
  showState("setup");
  setupError.classList.add("hidden");
  setupError.textContent = "";
  await populateEntrySelect();
}

function enterArmedState() {
  if (!savedConfig) return;
  armedEntryName.textContent = savedConfig.entryName;
  armedTargetLabel.textContent =
    "Fires at: " + formatDatetime(savedConfig.targetDatetime);
  var d = savedConfig.delta;
  armedDeltaLabel.textContent = "Adjusts tracker by: " + (d > 0 ? "+" : "") + d;
  showState("armed");
  startCountdown();
}

function enterFiredState() {
  if (!savedConfig) return;
  firedEntryName.textContent = savedConfig.entryName;
  var d = savedConfig.delta;
  var deltaStr = (d > 0 ? "+" : "") + d;
  var when = savedConfig.triggeredAt
    ? formatDatetime(savedConfig.triggeredAt)
    : formatDatetime(savedConfig.targetDatetime);
  firedSummary.textContent =
    "Triggered on " +
    when +
    '. Adjusted "' +
    savedConfig.entryName +
    '" by ' +
    deltaStr +
    ".";
  showState("fired");
}

function enterErrorState(message) {
  stopInterval();
  errorMessage.textContent = message;
  showState("error");
}

// ─── Fire ─────────────────────────────────────────────────────────────────────

/**
 * Execute the tracker adjustment, mark config as triggered, and show the
 * Fired state. If the action fails (e.g. the entry was deleted), show Error.
 */
async function fireTimer() {
  stopInterval();
  if (!savedConfig) return;

  try {
    await PluginAPI.actions.adjustTrackerValue(
      savedConfig.entryId,
      savedConfig.delta,
    );
    await persistConfig(
      Object.assign({}, savedConfig, {
        triggered: true,
        triggeredAt: new Date().toISOString(),
      }),
    );
    enterFiredState();
  } catch (err) {
    // The most likely cause: the tracker entry was deleted after the timer was armed.
    enterErrorState(
      'Could not adjust tracker entry "' +
        savedConfig.entryName +
        '". ' +
        "It may have been deleted. Click Reset to start over.",
    );
  }
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function startCountdown() {
  stopInterval();
  tick(); // immediate first render
  countdownInterval = setInterval(tick, 5000);

  function tick() {
    if (!savedConfig) {
      stopInterval();
      return;
    }
    var remaining = new Date(savedConfig.targetDatetime).getTime() - Date.now();
    if (remaining <= 0) {
      countdownDisplay.textContent = "Firing…";
      fireTimer();
    } else {
      countdownDisplay.textContent = formatCountdown(remaining);
    }
  }
}

// ─── Initialise ───────────────────────────────────────────────────────────────

/**
 * Load persisted config for the current campaign and branch to the correct state.
 * Called on first ready and on every campaign change.
 */
async function initialize() {
  stopInterval();
  showState("loading");

  var config = null;
  try {
    config = await PluginAPI.data.load();
  } catch (err) {
    console.error("[TimerTrigger] data.load failed:", err);
  }

  // No saved config or empty object — show Setup
  if (
    !config ||
    typeof config !== "object" ||
    !config.targetDatetime ||
    !config.entryId
  ) {
    savedConfig = null;
    await enterSetupState();
    return;
  }

  savedConfig = config;

  // Already fired in a previous session — show Fired
  if (config.triggered) {
    enterFiredState();
    return;
  }

  // Target has already passed (app was closed and reopened after the target time)
  if (Date.now() >= new Date(config.targetDatetime).getTime()) {
    await fireTimer();
    return;
  }

  // Target is in the future — arm the countdown
  enterArmedState();
}

// ─── Button event handlers ────────────────────────────────────────────────────

saveBtn.addEventListener("click", async function () {
  // Clear previous inline error
  setupError.classList.add("hidden");
  setupError.textContent = "";

  var entryId = entrySelect.value;
  var entryText = entrySelect.options[entrySelect.selectedIndex]
    ? entrySelect.options[entrySelect.selectedIndex].text
    : "";
  // Store just the entry name (strip the " (Category)" suffix for cleaner display)
  var entryName = entryText.replace(/\s*\([^)]*\)\s*$/, "").trim() || entryText;
  var targetDatetime = datetimeInput.value;
  var delta = parseInt(deltaInput.value, 10);

  // Validation
  if (!entryId) {
    showSetupError("Please select a tracker entry.");
    return;
  }
  if (!targetDatetime) {
    showSetupError("Please choose a target date and time.");
    return;
  }
  if (new Date(targetDatetime).getTime() <= Date.now()) {
    showSetupError("Target time must be in the future.");
    return;
  }
  if (!Number.isFinite(delta) || delta === 0) {
    showSetupError("Adjust value must be a non-zero whole number.");
    return;
  }

  await persistConfig({
    targetDatetime: targetDatetime,
    entryId: entryId,
    entryName: entryName,
    delta: delta,
    triggered: false,
    triggeredAt: null,
  });

  enterArmedState();
});

resetBtn.addEventListener("click", async function () {
  await clearConfig();
  await enterSetupState();
});

newTimerBtn.addEventListener("click", async function () {
  await clearConfig();
  await enterSetupState();
});

errorResetBtn.addEventListener("click", async function () {
  await clearConfig();
  await enterSetupState();
});

function showSetupError(msg) {
  setupError.textContent = msg;
  setupError.classList.remove("hidden");
}

// ─── Campaign changes ─────────────────────────────────────────────────────────

// When the user switches campaigns, stop any running timer and reload data
// for the new campaign. The SDK has already updated its internal campaignId
// by the time this event fires.
PluginAPI.events.on("campaign.changed", function () {
  initialize();
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

PluginAPI.onReady(function () {
  initialize();
});
