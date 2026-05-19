import { store } from "@/state/store.svelte";
import type { AppState, Campaign } from "@/types/index";
import { showToast } from "./ui/toast";
import { openModal } from "./ui/modal";

// ═══════════════════════════════════════════════════════════════
// FRESH-START FLAG
// ═══════════════════════════════════════════════════════════════

let freshStart = false;

export function getFreshStart(): boolean {
  return freshStart;
}

export function clearFreshStart(): void {
  freshStart = false;
}

// ═══════════════════════════════════════════════════════════════
// MIGRATION STATE
// ═══════════════════════════════════════════════════════════════

interface MigrationData {
  campaigns: { campaigns: Campaign[] } | null;
  schema: unknown | null;
  players: Array<{ player: string; scores: Record<string, number> }>;
  house: unknown | null;
  timeline: unknown | null;
}

const migData: MigrationData = {
  campaigns: null,
  schema: null,
  players: [],
  house: null,
  timeline: null,
};

// ═══════════════════════════════════════════════════════════════
// STATUS HELPERS
// ═══════════════════════════════════════════════════════════════

function setMigStatus(type: string, label: string): void {
  const btn = document.getElementById(
    `mig-btn-${type}`,
  ) as HTMLButtonElement | null;
  const status = document.getElementById(
    `mig-status-${type}`,
  ) as HTMLElement | null;
  if (btn) {
    btn.classList.add("done");
    btn.textContent = "✓ Loaded";
    btn.disabled = true;
  }
  if (status) {
    status.style.display = "";
    status.textContent = label;
    status.classList.add("done");
  }
}

// ═══════════════════════════════════════════════════════════════
// FILE LOADERS
// ═══════════════════════════════════════════════════════════════

export async function migLoadBackup(bootFn: () => void): Promise<void> {
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
    store.replaceState(imported);
    setMigStatus("backup", "Loaded");
    setTimeout(() => {
      document.getElementById("migration-overlay")!.classList.add("hidden");
      bootFn();
    }, 500);
  } catch {
    showToast("Invalid backup file");
  }
}

export async function migLoadFile(type: string): Promise<void> {
  const isJS = type === "timeline";
  const isMulti = type === "players";
  const filters = isJS
    ? [{ name: "JavaScript", extensions: ["js"] }]
    : [{ name: "JSON", extensions: ["json"] }];

  const files = await window.toolbox.importFile(filters);
  if (!files || !files.length) return;

  try {
    if (type === "campaigns") {
      migData.campaigns = JSON.parse(files[0].content);
      setMigStatus("campaigns", "Loaded");
    } else if (type === "schema") {
      migData.schema = JSON.parse(files[0].content);
      setMigStatus("schema", "Loaded");
    } else if (type === "players") {
      migData.players = files.map((f) => JSON.parse(f.content));
      setMigStatus(
        "players",
        `${files.length} file${files.length > 1 ? "s" : ""}`,
      );
    } else if (type === "house") {
      migData.house = JSON.parse(files[0].content);
      setMigStatus("house", "Loaded");
    } else if (type === "timeline") {
      let raw = files[0].content;
      raw = raw
        .replace(/^\s*const\s+TIMELINE_DATA\s*=\s*/, "")
        .replace(/;\s*$/, "");
      migData.timeline = JSON.parse(raw);
      setMigStatus("timeline", "Loaded");
    }
  } catch (err) {
    showToast(`Error parsing ${type}: ${(err as Error).message}`);
  }
  void isMulti; // suppress unused warning
}

// ═══════════════════════════════════════════════════════════════
// FLOW ACTIONS
// ═══════════════════════════════════════════════════════════════

export function migStartFresh(): void {
  (document.getElementById("new-campaign-label") as HTMLInputElement).value =
    "";
  (document.getElementById("new-campaign-id") as HTMLInputElement).value = "";
  freshStart = true;
  openModal("modal-add-campaign");
}

export function migFinish(bootFn: () => void): void {
  if (
    !migData.campaigns &&
    migData.players.length === 0 &&
    !migData.schema &&
    !migData.house &&
    !migData.timeline
  ) {
    migStartFresh();
    return;
  }

  const campaigns: Campaign[] = migData.campaigns?.campaigns ?? [
    { id: "new_campaign", label: "New Campaign" },
  ];
  campaigns.forEach((c) => store.addCampaign(c));

  const firstId = campaigns[0]?.id;
  if (!firstId) {
    migStartFresh();
    return;
  }

  if (migData.schema) {
    store.getCampaignData(firstId).schema =
      migData.schema as typeof store.getCampaignData extends (
        ...args: unknown[]
      ) => infer R
        ? R extends { schema: infer S }
          ? S
          : never
        : never;
  }

  migData.players.forEach((pd) => {
    const key = pd.player
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    store.upsertPlayer(firstId, key, pd);
  });

  if (migData.house) {
    const hd = migData.house as { house?: string };
    const key = (hd.house ?? "house").toLowerCase().replace(/[^a-z0-9]+/g, "_");
    store.upsertHouse(
      firstId,
      key,
      migData.house as Parameters<typeof store.upsertHouse>[2],
    );
    store.setActiveHouse(key);
  }

  if (migData.timeline) {
    store.setTimeline(
      firstId,
      migData.timeline as Parameters<typeof store.setTimeline>[1],
    );
  }

  store.setActiveCampaign(firstId);
  document.getElementById("migration-overlay")!.classList.add("hidden");
  bootFn();
}
