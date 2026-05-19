import { store } from "@/state/store.svelte";
import type { AppState } from "@/types/index";
import { showToast } from "./ui/toast";

// ═══════════════════════════════════════════════════════════════
// BACKUP EXPORT / IMPORT
// ═══════════════════════════════════════════════════════════════

export async function exportBackup(): Promise<void> {
  const content = store.toJSON();
  const result = await window.toolbox.exportFile(
    "toolbox_backup.json",
    content,
  );
  if (result.ok) showToast("Backup exported");
}

export async function importBackup(bootFn: () => void): Promise<void> {
  const files = await window.toolbox.importFile([
    { name: "JSON", extensions: ["json"] },
  ]);
  if (!files || !files.length) return;
  try {
    const imported = JSON.parse(files[0].content) as AppState;
    if (!imported.campaigns || !imported.campaignData) {
      showToast("File does not look like a toolbox backup");
      return;
    }
    store.mergeImport(imported);
    bootFn();
    showToast("Backup imported");
  } catch {
    showToast("Invalid backup file");
  }
}
