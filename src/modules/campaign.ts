import { store } from "@/state/store";
import type { Campaign } from "@/types/index";
import { showToast } from "./ui/toast";
import { openModal, closeModal } from "./ui/modal";
import { getFreshStart, clearFreshStart } from "./migration";

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN SELECT
// ═══════════════════════════════════════════════════════════════

export function renderCampaignSelect(): void {
  const sel = document.getElementById("campaign-select") as HTMLSelectElement;
  const cid = store.activeCampaignId;

  sel.innerHTML = store.campaigns.length
    ? store.campaigns
        .map(
          (c) =>
            `<option value="${c.id}"${c.id === cid ? " selected" : ""}>${c.label}</option>`,
        )
        .join("")
    : '<option value="">No campaigns</option>';
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN CRUD
// ═══════════════════════════════════════════════════════════════

export function createCampaign(switchCampaignFn: (id: string) => void): void {
  const labelEl = document.getElementById(
    "new-campaign-label",
  ) as HTMLInputElement;
  const idEl = document.getElementById("new-campaign-id") as HTMLInputElement;
  const label = labelEl.value.trim();
  let id = idEl.value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  if (!label) {
    showToast("Name required");
    return;
  }
  if (!id)
    id = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  if (store.campaigns.find((c) => c.id === id)) {
    showToast("Campaign already exists");
    return;
  }

  const campaign: Campaign = { id, label };
  store.addCampaign(campaign);
  closeModal("modal-add-campaign");
  labelEl.value = "";
  idEl.value = "";
  renderCampaignSelect();
  switchCampaignFn(id);
  showToast(`${label} created`);

  if (getFreshStart()) {
    clearFreshStart();
    document.getElementById("migration-overlay")!.classList.add("hidden");
  }
}

export function renameCampaign(): void {
  const cid = store.activeCampaignId;
  if (!cid) {
    showToast("No campaign selected");
    return;
  }
  const current = store.campaigns.find((c) => c.id === cid);
  if (!current) return;
  (document.getElementById("rename-campaign-label") as HTMLInputElement).value =
    current.label;
  openModal("modal-rename-campaign");
}

export function confirmRenameCampaign(): void {
  const cid = store.activeCampaignId;
  const input = document.getElementById(
    "rename-campaign-label",
  ) as HTMLInputElement;
  const label = input.value.trim();
  if (!label) {
    showToast("Name required");
    return;
  }
  if (!cid) {
    showToast("No campaign selected");
    return;
  }
  store.renameCampaign(cid, label);
  closeModal("modal-rename-campaign");
  renderCampaignSelect();
  showToast(`Renamed to ${label}`);
}
