/**
 * plugin-bridge.ts
 *
 * Manages the postMessage communication layer between plugin iframes
 * and the main app window.
 *
 * Responsibilities:
 *   - Listen for inbound "toolbox-action" messages from plugin iframes
 *   - Identify the source plugin by matching event.source against known iframe refs
 *   - Route the action through the allowlist; reject unknown actions silently
 *   - Send typed responses back to the originating iframe
 *   - Broadcast app events (tracker changes, session changes, etc.) to all iframes
 *
 * The app (campaignId) is always injected server-side — plugins never specify
 * which campaign they're operating on.
 */

import type { PluginManifest, TrackerEntry } from "@/types/index";
import { store } from "@/state/store.svelte";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A message sent from a plugin iframe to the app. */
interface PluginActionMessage {
  type: "toolbox-action";
  action: string;
  payload?: unknown;
  requestId: string;
}

/** A response sent from the app back to a plugin iframe. */
interface PluginResponseMessage {
  type: "toolbox-response";
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

/** An event broadcast from the app to all plugin iframes. */
interface PluginEventMessage {
  type: "toolbox-event";
  event: string;
  payload?: unknown;
}

/** An init message sent when the plugin iframe first loads. */
interface PluginInitMessage {
  type: "toolbox-init";
  campaignId: string;
  pluginId: string;
  apiVersion: string;
}

// ─── Bridge state ─────────────────────────────────────────────────────────────

/** Map from pluginId → iframe element ref */
let _iframeMap: Map<string, HTMLIFrameElement> = new Map();

/** Getter for the currently active campaign ID */
let _getActiveCampaignId: () => string = () => "";

/** Whether the bridge has been initialised */
let _initialised = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendResponse(
  iframe: HTMLIFrameElement,
  requestId: string,
  ok: boolean,
  result?: unknown,
  error?: string,
): void {
  const msg: PluginResponseMessage = {
    type: "toolbox-response",
    requestId,
    ok,
    result,
    error,
  };
  // Use "*" origin — plugins loaded via file:// or localhost both need this.
  // The message contains no sensitive data beyond what the plugin already has.
  iframe.contentWindow?.postMessage(msg, "*");
}

function sendToIframe(
  iframe: HTMLIFrameElement,
  msg: PluginEventMessage | PluginInitMessage,
): void {
  iframe.contentWindow?.postMessage(msg, "*");
}

/**
 * Strip Svelte 5 reactive proxies so the value is safe to pass to postMessage
 * (which uses the structured clone algorithm and cannot clone Proxy objects).
 */
function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** Generate a TrackerEntry id matching the app's existing util format */
function genTrackerId(): string {
  return `tracker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Action registry ──────────────────────────────────────────────────────────

type ActionResult = { ok: boolean; result?: unknown; error?: string };
type ActionHandler = (
  payload: unknown,
  campaignId: string,
  pluginId: string,
) => ActionResult | Promise<ActionResult>;

const ACTION_HANDLERS: Record<string, ActionHandler> = {
  // ── tracker.createEntry ───────────────────────────────────────
  "tracker.createEntry": (payload, campaignId) => {
    const p = payload as Partial<TrackerEntry>;
    if (!p || typeof p.name !== "string" || !p.name.trim()) {
      return { ok: false, error: "name is required" };
    }
    if (!p.category || typeof p.category !== "string" || !p.category.trim()) {
      return { ok: false, error: "category is required" };
    }
    const min = typeof p.min === "number" ? p.min : 0;
    const max = typeof p.max === "number" ? p.max : 10;
    if (max <= min) return { ok: false, error: "max must be greater than min" };
    const start =
      typeof p.current === "number"
        ? Math.max(min, Math.min(max, p.current))
        : min;

    const entry: TrackerEntry = {
      id: p.id ?? genTrackerId(),
      name: p.name.trim(),
      category: p.category.trim(),
      min,
      max,
      current: start,
      direction: p.direction === "countdown" ? "countdown" : "countup",
      warnings: Array.isArray(p.warnings) ? p.warnings : [],
    };

    store.upsertTrackerEntry(campaignId, entry);
    broadcastEvent("tracker.entryChanged", toPlain(entry));
    return { ok: true, result: { id: entry.id } };
  },

  // ── tracker.adjustValue ───────────────────────────────────────
  "tracker.adjustValue": (payload, campaignId) => {
    const p = payload as { entryId?: unknown; delta?: unknown };
    if (!p || typeof p.entryId !== "string") {
      return { ok: false, error: "entryId is required" };
    }
    if (typeof p.delta !== "number" || !isFinite(p.delta)) {
      return { ok: false, error: "delta must be a finite number" };
    }
    const tracker = store.getTracker(campaignId);
    const entry = tracker.entries.find((e) => e.id === p.entryId);
    if (!entry) return { ok: false, error: "entry not found" };

    store.adjustTrackerValue(campaignId, p.entryId, p.delta);
    // Re-read after mutation
    const updated = store
      .getTracker(campaignId)
      .entries.find((e) => e.id === p.entryId);
    if (updated) broadcastEvent("tracker.entryChanged", toPlain(updated));
    return {
      ok: true,
      result: { newValue: updated?.current ?? entry.current },
    };
  },

  // ── tracker.setValue ──────────────────────────────────────────
  "tracker.setValue": (payload, campaignId) => {
    const p = payload as { entryId?: unknown; value?: unknown };
    if (!p || typeof p.entryId !== "string") {
      return { ok: false, error: "entryId is required" };
    }
    if (typeof p.value !== "number" || !isFinite(p.value)) {
      return { ok: false, error: "value must be a finite number" };
    }
    const tracker = store.getTracker(campaignId);
    const entry = tracker.entries.find((e) => e.id === p.entryId);
    if (!entry) return { ok: false, error: "entry not found" };

    const delta = p.value - entry.current;
    store.adjustTrackerValue(campaignId, p.entryId, delta);
    const updated = store
      .getTracker(campaignId)
      .entries.find((e) => e.id === p.entryId);
    if (updated) broadcastEvent("tracker.entryChanged", toPlain(updated));
    return {
      ok: true,
      result: { newValue: updated?.current ?? entry.current },
    };
  },

  // ── tracker.getEntries ────────────────────────────────────────
  "tracker.getEntries": (_payload, campaignId) => {
    const entries = store.getTracker(campaignId).entries;
    return { ok: true, result: toPlain(entries) };
  },

  // ── sessions.getCurrent ───────────────────────────────────────
  "sessions.getCurrent": (_payload, campaignId) => {
    const cd = store.getCampaignData(campaignId);
    const sessions = cd.sessions;
    return {
      ok: true,
      result: {
        number: sessions?.currentNumber ?? 1,
        note: sessions?.currentNote ?? "",
      },
    };
  },

  // ── party.getMembers ──────────────────────────────────────────
  "party.getMembers": (_payload, campaignId) => {
    const pcs = store.getParty(campaignId).pcs;
    return { ok: true, result: toPlain(pcs) };
  },
  // ── data.load ──────────────────────────────────────────────────
  "data.load": async (_payload, campaignId, pluginId) => {
    try {
      const result = await window.toolbox.pluginData.get(pluginId, campaignId);
      return { ok: true, result };
    } catch (err) {
      return { ok: false, error: "Failed to load plugin data" };
    }
  },

  // ── data.save ──────────────────────────────────────────────────
  "data.save": async (payload, campaignId, pluginId) => {
    const p = payload as { value?: unknown };
    const data = (p?.value !== undefined ? p.value : p) as Record<
      string,
      unknown
    >;
    try {
      await window.toolbox.pluginData.set(pluginId, campaignId, data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: "Failed to save plugin data" };
    }
  },
};

// ─── Message handler ──────────────────────────────────────────────────────────

async function handleMessage(event: MessageEvent): Promise<void> {
  // Only process messages with the correct type envelope
  if (!event.data || event.data.type !== "toolbox-action") return;

  const msg = event.data as PluginActionMessage;
  if (typeof msg.requestId !== "string" || typeof msg.action !== "string")
    return;

  // Identify which plugin sent this message
  let sourcePlugin: PluginManifest | undefined;
  let sourceIframe: HTMLIFrameElement | undefined;

  for (const [pluginId, iframe] of _iframeMap) {
    if (event.source === iframe.contentWindow) {
      sourcePlugin = store.plugins.find((p) => p.id === pluginId);
      sourceIframe = iframe;
      break;
    }
  }

  // Unknown source — silently ignore
  if (!sourceIframe || !sourcePlugin) return;

  const campaignId = _getActiveCampaignId();
  if (!campaignId) {
    sendResponse(
      sourceIframe,
      msg.requestId,
      false,
      undefined,
      "No active campaign",
    );
    return;
  }

  const handler = ACTION_HANDLERS[msg.action];
  if (!handler) {
    // Unknown action — silently drop, do not error (don't leak action names)
    return;
  }

  try {
    const { ok, result, error } = await handler(
      msg.payload,
      campaignId,
      sourcePlugin.id,
    );
    sendResponse(sourceIframe, msg.requestId, ok, result, error);
  } catch (err) {
    console.error(`[plugin-bridge] action "${msg.action}" threw:`, err);
    sendResponse(
      sourceIframe,
      msg.requestId,
      false,
      undefined,
      "Internal error",
    );
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise the bridge. Call once from App.svelte after plugins are loaded.
 *
 * @param iframeMap  Live Map of pluginId → HTMLIFrameElement (mutate it as tabs
 *                   are added/removed; the bridge always reads the current state)
 * @param getActiveCampaignId  Getter for the currently active campaign ID
 */
export function initPluginBridge(
  iframeMap: Map<string, HTMLIFrameElement>,
  getActiveCampaignId: () => string,
): void {
  if (_initialised) return;
  _iframeMap = iframeMap;
  _getActiveCampaignId = getActiveCampaignId;
  window.addEventListener("message", handleMessage);
  _initialised = true;
}

/**
 * Send the init message to a plugin iframe so it knows the current campaign.
 * Call this after the iframe's `load` event fires.
 */
export function initPlugin(pluginId: string): void {
  const iframe = _iframeMap.get(pluginId);
  if (!iframe) return;
  const msg: PluginInitMessage = {
    type: "toolbox-init",
    campaignId: _getActiveCampaignId(),
    pluginId,
    apiVersion: "1",
  };
  sendToIframe(iframe, msg);
}

/**
 * Broadcast an app event to all registered plugin iframes.
 *
 * @param event    Event name, e.g. "tracker.entryChanged"
 * @param payload  Optional data payload
 */
export function broadcastEvent(event: string, payload?: unknown): void {
  if (!_initialised) return;
  const msg: PluginEventMessage = { type: "toolbox-event", event, payload };
  for (const iframe of _iframeMap.values()) {
    sendToIframe(iframe, msg);
  }
}

/**
 * Re-send the init message to all plugins (e.g. when the active campaign changes).
 */
export function broadcastCampaignChange(): void {
  if (!_initialised) return;
  const campaignId = _getActiveCampaignId();
  for (const [pluginId, iframe] of _iframeMap) {
    const msg: PluginInitMessage = {
      type: "toolbox-init",
      campaignId,
      pluginId,
      apiVersion: "1",
    };
    sendToIframe(iframe, msg);
  }
  broadcastEvent("campaign.changed", { campaignId });
}

/**
 * Remove the global message listener. Call on app teardown.
 */
export function destroyPluginBridge(): void {
  window.removeEventListener("message", handleMessage);
  _initialised = false;
}
