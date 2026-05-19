import { store } from "@/state/store.svelte";
import type { TabId } from "@/types/index";
import { openModal, closeModal } from "./ui/modal";
import {
  renderCampaignSelect,
  createCampaign,
  renameCampaign,
  confirmRenameCampaign,
} from "./campaign";
import { exportBackup, importBackup } from "./backup";
import {
  migLoadBackup,
  migLoadFile,
  migStartFresh,
  migFinish,
} from "./migration";
import {
  showDangerStep,
  openDangerOverlay,
  closeDangerOverlay,
  dangerDownloadAndContinue,
  dangerClearAll,
} from "./danger";

import {
  renderFavor,
  renderPlayerSelect,
  switchPlayer,
  savePlayer,
  createPlayer,
  addNPC,
  setFavorDeleteEnabled,
} from "./favor";
import {
  renderConvoSliders,
  resetConvo,
  initConvoPCButtons,
  syncPCCountButtons,
  initConvoTitle,
} from "./convo";
import {
  initTree,
  renderHouseSelect,
  switchHouse,
  importHouseFile,
  resetTreeView,
} from "./tree";
import {
  renderChronicle,
  initChronicle,
  importTimelineFile,
  exportTimelineFile,
  scrollToNow,
} from "./chronicle";
import { renderTracker, initTracker } from "./tracker";
import { renderParty, initParty } from "./party";

// ═══════════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════════

function switchTab(id: TabId): void {
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(`tab-${id}`)?.classList.add("active");
  document.getElementById(`panel-${id}`)?.classList.add("active");
  store.setActiveTab(id);

  // Trigger renders that need DOM to be visible first
  if (id === "tree") setTimeout(() => initTree(), 10);
  if (id === "chronicle") setTimeout(() => renderChronicle(), 10);
  if (id === "tracker") renderTracker();
  if (id === "party") renderParty();
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN SWITCHING (orchestrator — calls multiple modules)
// ═══════════════════════════════════════════════════════════════

function switchCampaign(id: string): void {
  if (!id) return;
  store.setActiveCampaign(id);
  renderCampaignSelect();
  renderPlayerSelect();
  renderHouseSelect();
  renderFavor();

  const activeTab = store.activeTab;
  if (activeTab === "tree") initTree();
  if (activeTab === "chronicle") renderChronicle();
  if (activeTab === "tracker") renderTracker();
  if (activeTab === "party") renderParty();
}

function boot(): void {
  renderCampaignSelect();

  if (store.activeCampaignId) {
    renderPlayerSelect();
    renderHouseSelect();
    renderFavor();
  }

  // Restore active tab
  const tab = store.activeTab;
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(`tab-${tab}`)?.classList.add("active");
  document.getElementById(`panel-${tab}`)?.classList.add("active");

  // Convo
  initConvoTitle();
  syncPCCountButtons();
  renderConvoSliders();

  // Tracker
  initTracker();
  if (tab === "tracker") renderTracker();

  // Party
  initParty();
  if (tab === "party") renderParty();

  // Tree / Chronicle if on those tabs
  if (tab === "tree") setTimeout(() => initTree(), 10);
  if (tab === "chronicle") setTimeout(() => renderChronicle(), 10);
}

// ═══════════════════════════════════════════════════════════════
// WIRE UP ALL EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  // Load persisted data
  const hasData = await store.load();

  // Migration overlay
  if (hasData && store.campaigns.length > 0) {
    document.getElementById("migration-overlay")!.classList.add("hidden");
    boot();
  }
  // else: migration overlay stays visible (default in HTML)

  // ── Tab buttons ──
  document.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab as TabId));
  });

  // ── Campaign ──
  document
    .getElementById("campaign-select")!
    .addEventListener("change", (e) =>
      switchCampaign((e.target as HTMLSelectElement).value),
    );

  document
    .getElementById("btn-add-campaign")!
    .addEventListener("click", () => openModal("modal-add-campaign"));

  document
    .getElementById("btn-create-campaign")!
    .addEventListener("click", () => createCampaign(switchCampaign));

  document
    .getElementById("btn-rename-campaign")!
    .addEventListener("click", renameCampaign);

  document
    .getElementById("btn-confirm-rename-campaign")!
    .addEventListener("click", confirmRenameCampaign);

  // ── Favor ──
  document
    .getElementById("player-select")!
    .addEventListener("change", (e) =>
      switchPlayer((e.target as HTMLSelectElement).value),
    );

  document
    .getElementById("btn-save-player")!
    .addEventListener("click", savePlayer);

  document
    .getElementById("btn-add-player")!
    .addEventListener("click", () => openModal("modal-add-player"));

  document
    .getElementById("btn-create-player")!
    .addEventListener("click", () => {
      createPlayer();
      closeModal("modal-add-player");
    });

  document.getElementById("btn-add-npc")!.addEventListener("click", addNPC);

  document
    .getElementById("favor-delete-toggle")!
    .addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      // Import and set the flag — need to export a setter from favor.ts
      setFavorDeleteEnabled(checked);
      renderFavor();
    });

  // ── Convo ──
  initConvoPCButtons();
  document
    .getElementById("btn-reset-convo")!
    .addEventListener("click", resetConvo);

  // ── Tree ──
  document
    .getElementById("house-select")!
    .addEventListener("change", (e) =>
      switchHouse((e.target as HTMLSelectElement).value),
    );

  document
    .getElementById("btn-import-house")!
    .addEventListener("click", importHouseFile);

  document
    .getElementById("btn-reset-tree")!
    .addEventListener("click", resetTreeView);

  // ── Chronicle ──
  initChronicle();
  document
    .getElementById("btn-open-editor")!
    .addEventListener("click", () => window.toolbox.openTimelineEditor());

  // Listen for saves made in the editor window
  const onTimelineUpdated = async () => {
    const cid = store.activeCampaignId;
    if (cid) {
      const fresh = await window.toolbox.getTimeline(cid);
      if (fresh) store.setTimeline(cid, fresh);
    }
    renderChronicle();
  };
  window.toolbox.onTimelineUpdated(onTimelineUpdated);

  document
    .getElementById("btn-import-timeline")!
    .addEventListener("click", importTimelineFile);

  document
    .getElementById("btn-export-timeline")!
    .addEventListener("click", exportTimelineFile);

  document
    .getElementById("btn-jump-now")!
    .addEventListener("click", scrollToNow);

  // ── Export / Import backup ──
  document
    .getElementById("btn-export-backup")!
    .addEventListener("click", exportBackup);

  document
    .getElementById("btn-import-backup")!
    .addEventListener("click", () => importBackup(boot));

  // ── Modal close: data-close attribute pattern ──
  document
    .querySelectorAll<HTMLButtonElement>("[data-close]")
    .forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.close!));
    });

  // ── Danger zone ──
  document
    .getElementById("btn-dangerous-actions")!
    .addEventListener("click", openDangerOverlay);

  document
    .getElementById("btn-danger-close")!
    .addEventListener("click", closeDangerOverlay);

  document
    .getElementById("btn-clear-step1")!
    .addEventListener("click", () => showDangerStep(2));

  document
    .getElementById("btn-danger-cancel-step2")!
    .addEventListener("click", closeDangerOverlay);

  document
    .getElementById("btn-danger-download")!
    .addEventListener("click", dangerDownloadAndContinue);

  document
    .getElementById("btn-danger-cancel-step3")!
    .addEventListener("click", closeDangerOverlay);

  document
    .getElementById("btn-danger-confirm")!
    .addEventListener("click", dangerClearAll);

  // ── Keyboard shortcuts ──
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const dangerOpen = document
        .getElementById("modal-danger")
        ?.classList.contains("open");
      if (dangerOpen) {
        // Only close danger overlay from step 1 — step 2/3 require explicit cancel
        const onStep1 =
          document.getElementById("danger-step-1")!.style.display !== "none";
        if (onStep1) closeDangerOverlay();
        return;
      }
      document
        .querySelectorAll(".modal-overlay.open")
        .forEach((m) => m.classList.remove("open"));
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      savePlayer();
    }
  });

  // ── Migration buttons ──
  document
    .getElementById("mig-btn-backup")!
    .addEventListener("click", () => migLoadBackup(boot));

  ["campaigns", "schema", "players", "house", "timeline"].forEach((type) => {
    document
      .getElementById(`mig-btn-${type}`)!
      .addEventListener("click", () => migLoadFile(type));
  });

  document
    .getElementById("mig-btn-fresh")!
    .addEventListener("click", migStartFresh);

  document
    .getElementById("mig-btn-launch")!
    .addEventListener("click", () => migFinish(boot));

  // ── Save on window close (belt-and-suspenders) ──
  window.addEventListener("beforeunload", () => {
    store.forceSave();
  });
}

main().catch(console.error);
