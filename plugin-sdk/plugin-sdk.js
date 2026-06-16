/**
 * Iraelya's Toolbox — Plugin SDK  v1
 *
 * Drop this file into your plugin folder and include it in your index.html:
 *   <script src="plugin-sdk.js"></script>
 *
 * Then use the PluginAPI global:
 *   const { actions, data, events, context } = PluginAPI;
 *
 * Available as both a plain IIFE (window.PluginAPI) and an ES module default export.
 *
 * Protocol version: 1
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PluginAPI = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // ─── Internal state ─────────────────────────────────────────────────────────

  let _campaignId = null;
  let _pluginId = null;
  let _apiVersion = null;
  let _ready = false;

  /** Pending action requests: requestId → { resolve, reject } */
  const _pending = new Map();

  /** Event listeners: eventName → Set<function> */
  const _listeners = new Map();

  /** Callbacks waiting for the init message */
  const _readyCallbacks = [];

  // ─── Message handling ────────────────────────────────────────────────────────

  window.addEventListener("message", function (event) {
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "toolbox-init") {
      _campaignId = msg.campaignId;
      _pluginId = msg.pluginId;
      _apiVersion = msg.apiVersion;
      _ready = true;
      _readyCallbacks.forEach(function (cb) {
        try {
          cb();
        } catch (e) {
          console.error("[PluginAPI] onReady callback threw:", e);
        }
      });
      _readyCallbacks.length = 0;
      return;
    }

    if (msg.type === "toolbox-response") {
      const pending = _pending.get(msg.requestId);
      if (!pending) return;
      _pending.delete(msg.requestId);
      if (msg.ok) {
        pending.resolve(msg.result);
      } else {
        pending.reject(new Error(msg.error || "Action failed"));
      }
      return;
    }

    if (msg.type === "toolbox-event") {
      // Re-dispatch updated campaignId on campaign change
      if (
        msg.event === "campaign.changed" &&
        msg.payload &&
        msg.payload.campaignId
      ) {
        _campaignId = msg.payload.campaignId;
      }
      const handlers = _listeners.get(msg.event);
      if (handlers) {
        handlers.forEach(function (cb) {
          try {
            cb(msg.payload);
          } catch (e) {
            console.error("[PluginAPI] event handler threw:", e);
          }
        });
      }
      return;
    }
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function _genRequestId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  }

  /**
   * Send an action to the app and return a Promise for the result.
   * @param {string} action
   * @param {*} payload
   * @returns {Promise<*>}
   */
  function _sendAction(action, payload) {
    return new Promise(function (resolve, reject) {
      const requestId = _genRequestId();
      _pending.set(requestId, { resolve, reject });
      window.parent.postMessage(
        { type: "toolbox-action", action, payload, requestId },
        "*",
      );
      // 10-second timeout — prevents dangling promises if the app doesn't respond
      setTimeout(function () {
        if (_pending.has(requestId)) {
          _pending.delete(requestId);
          reject(new Error("Request timed out: " + action));
        }
      }, 10000);
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  const PluginAPI = {
    /**
     * Register a callback to run once the plugin has received its init
     * message from the app (i.e. campaignId is known). If already ready,
     * the callback fires synchronously.
     * @param {function} cb
     */
    onReady: function (cb) {
      if (_ready) {
        cb();
        return;
      }
      _readyCallbacks.push(cb);
    },

    /** Read-only context provided by the app */
    context: {
      /** The currently active campaign ID (string | null) */
      get campaignId() {
        return _campaignId;
      },
      /** This plugin's ID as declared in plugin.json */
      get pluginId() {
        return _pluginId;
      },
      /** Plugin API version string */
      get apiVersion() {
        return _apiVersion;
      },
    },

    /**
     * App action methods. Each returns a Promise.
     * The app validates all inputs — errors reject the Promise.
     */
    actions: {
      /**
       * Create or update a tracker entry.
       * @param {object} params
       * @param {string} params.name        Required
       * @param {string} params.category    Required
       * @param {number} [params.min]       Default 0
       * @param {number} [params.max]       Default 10
       * @param {number} [params.current]   Default = min
       * @param {'countup'|'countdown'} [params.direction]  Default 'countup'
       * @param {string} [params.id]        Provide to update an existing entry
       * @returns {Promise<{id: string}>}
       */
      createEntry: function (params) {
        return _sendAction("tracker.createEntry", params);
      },

      /**
       * Adjust a tracker entry's current value by a delta (+ or -).
       * The app clamps to [min, max].
       * @param {string} entryId
       * @param {number} delta
       * @returns {Promise<{newValue: number}>}
       */
      adjustTrackerValue: function (entryId, delta) {
        return _sendAction("tracker.adjustValue", { entryId, delta });
      },

      /**
       * Set a tracker entry's current value directly.
       * The app clamps to [min, max].
       * @param {string} entryId
       * @param {number} value
       * @returns {Promise<{newValue: number}>}
       */
      setTrackerValue: function (entryId, value) {
        return _sendAction("tracker.setValue", { entryId, value });
      },

      /**
       * Get all tracker entries for the current campaign (read-only snapshot).
       * @returns {Promise<TrackerEntry[]>}
       */
      getTrackerEntries: function () {
        return _sendAction("tracker.getEntries", null);
      },

      /**
       * Get the current session number and note.
       * @returns {Promise<{number: number, note: string}>}
       */
      getCurrentSession: function () {
        return _sendAction("sessions.getCurrent", null);
      },

      /**
       * Get all party members (PCs) for the current campaign.
       * @returns {Promise<PCCard[]>}
       */
      getPartyMembers: function () {
        return _sendAction("party.getMembers", null);
      },
    },

    /**
     * Plugin-scoped persistent data storage.
     * Data is stored in the app's main data file under a namespaced key.
     * The app never reads or modifies these values.
     */
    data: {
      /**
       * Load this plugin's stored data for the current campaign.
       * Returns an empty object if nothing has been saved yet.
       * @returns {Promise<object>}
       */
      load: function () {
        return _sendAction("data.load", null);
      },

      /**
       * Save this plugin's data for the current campaign.
       * Replaces the entire stored object (not a merge).
       * @param {object} value
       * @returns {Promise<void>}
       */
      save: function (value) {
        return _sendAction("data.save", { value });
      },
    },

    /**
     * Subscribe to app events.
     */
    events: {
      /**
       * Register a listener for an app event.
       *
       * Available events:
       *   "campaign.changed"        — payload: { campaignId }
       *   "session.changed"         — payload: { number, note }
       *   "tracker.entryChanged"    — payload: TrackerEntry (the updated entry)
       *
       * @param {string} eventName
       * @param {function} callback
       */
      on: function (eventName, callback) {
        if (!_listeners.has(eventName)) _listeners.set(eventName, new Set());
        _listeners.get(eventName).add(callback);
      },

      /**
       * Remove a previously registered listener.
       * @param {string} eventName
       * @param {function} callback
       */
      off: function (eventName, callback) {
        const handlers = _listeners.get(eventName);
        if (handlers) handlers.delete(callback);
      },
    },
  };

  return PluginAPI;
});
