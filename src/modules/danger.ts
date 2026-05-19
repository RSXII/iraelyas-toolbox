import { store } from "@/state/store.svelte";
import type { AppState } from "@/types/index";
import { showToast } from "./ui/toast";
import { openModal, closeModal } from "./ui/modal";

// ═══════════════════════════════════════════════════════════════
// STEP VISIBILITY
// ═══════════════════════════════════════════════════════════════

export function showDangerStep(step: 1 | 2 | 3): void {
  document.getElementById("danger-step-1")!.style.display =
    step === 1 ? "" : "none";
  document.getElementById("danger-step-2")!.style.display =
    step === 2 ? "" : "none";
  document.getElementById("danger-step-3")!.style.display =
    step === 3 ? "" : "none";
}

// ═══════════════════════════════════════════════════════════════
// OVERLAY OPEN / CLOSE
// ═══════════════════════════════════════════════════════════════

export function openDangerOverlay(): void {
  showDangerStep(1);
  openModal("modal-danger");
}

export function closeDangerOverlay(): void {
  closeModal("modal-danger");
  setTimeout(() => showDangerStep(1), 300);
}

// ═══════════════════════════════════════════════════════════════
// MULTI-STEP ACTIONS
// ═══════════════════════════════════════════════════════════════

export async function dangerDownloadAndContinue(): Promise<void> {
  const content = store.toJSON();
  const result = await window.toolbox.exportFile(
    "toolbox_backup.json",
    content,
  );

  if (result.canceled || !result.ok) {
    showToast("Backup not saved — download your backup to continue");
    return;
  }

  showDangerStep(3);
}

export async function dangerClearAll(): Promise<void> {
  const emptyState: AppState = {
    version: 1,
    campaigns: [],
    campaignData: {},
    ui: {
      activeCampaign: "",
      activePlayer: "",
      activeHouse: "",
      activeTab: "favor",
      convo: {
        title: "Generic Conversation",
        pcCount: 4,
        pcs: Array.from({ length: 6 }, (_, i) => ({
          name: `PC ${i + 1}`,
          score: 5,
        })),
      },
    },
  };

  await window.toolbox.saveData(emptyState);
  store.replaceState(emptyState);
  closeModal("modal-danger");
  document.getElementById("migration-overlay")!.classList.remove("hidden");
  showToast("All data cleared");
}
