import { store } from "@/state/store";
import { showToast } from "./app";

// ── Helpers ────────────────────────────────────────────────────────────────

function favorMeta(s: number): { word: string; color: string } {
  if (s < 20) return { word: "Hostile", color: "var(--hostile)" };
  if (s < 40) return { word: "Wary", color: "var(--wary)" };
  if (s < 60) return { word: "Neutral", color: "var(--neutral)" };
  if (s < 80) return { word: "Friendly", color: "var(--friendly)" };
  return { word: "Allied", color: "var(--allied)" };
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

// ── State ──────────────────────────────────────────────────────────────────

let activeFilter = "all";
let deleteEnabled = false;

// ── Player select ──────────────────────────────────────────────────────────

export function renderPlayerSelect(): void {
  const cd = store.activeCampaignData;
  const players = cd ? Object.keys(cd.players) : [];
  const sel = document.getElementById("player-select") as HTMLSelectElement;

  sel.innerHTML = players.length
    ? players
        .map(
          (p) =>
            `<option value="${p}"${p === store.activePlayerId ? " selected" : ""}>${cap(p)}</option>`,
        )
        .join("")
    : '<option value="">No players</option>';

  const display = document.getElementById("favor-player-display")!;

  if (players.length && !store.activePlayerId) {
    store.setActivePlayer(players[0]);
    sel.value = players[0];
  }
  display.textContent = store.activePlayerId ? cap(store.activePlayerId) : "—";
}

export function switchPlayer(name: string): void {
  if (!name) return;
  store.setActivePlayer(name);
  document.getElementById("favor-player-display")!.textContent = cap(name);
  const cid = store.activeCampaignId;
  if (cid) store.patchPlayerScores(cid, name);
  renderFavor();
}

export function setFavorDeleteEnabled(val: boolean): void {
  deleteEnabled = val;
}

// ── Filter chips ───────────────────────────────────────────────────────────

function buildFilterChips(): void {
  const cd = store.activeCampaignData;
  const factions = cd ? [...new Set(cd.schema.npcs.map((n) => n.faction))] : [];
  const all = ["all", ...factions];
  const row = document.getElementById("filter-row")!;

  row.innerHTML =
    '<span class="filter-label">Filter:</span>' +
    all
      .map(
        (f) =>
          `<button class="filter-chip${f === activeFilter ? " active" : ""}"
        data-faction="${f}">${f === "all" ? "All" : f}</button>`,
      )
      .join("");

  row.querySelectorAll<HTMLButtonElement>(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.faction!;
      row
        .querySelectorAll(".filter-chip")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderFavor();
    });
  });
}

// ── Main render ────────────────────────────────────────────────────────────

export function renderFavor(): void {
  buildFilterChips();

  const cid = store.activeCampaignId;
  const cd = store.activeCampaignData;
  const listEl = document.getElementById("npc-list")!;
  listEl.innerHTML = "";

  if (!cd || !cid) {
    listEl.innerHTML =
      '<div class="empty-state">Select or create a campaign to begin.</div>';
    return;
  }

  const pid = store.activePlayerId;
  const pd = pid ? cd.players[pid] : null;
  const schema = cd.schema;

  const factions =
    activeFilter === "all"
      ? [...new Set(schema.npcs.map((n) => n.faction))]
      : [activeFilter];

  let anyRendered = false;

  factions.forEach((f) => {
    const list = schema.npcs.filter((n) => n.faction === f);
    if (!list.length) return;
    anyRendered = true;

    // Section header
    const head = document.createElement("div");
    head.className = "section-head";
    head.innerHTML = `<span class="section-name">${f}</span><div class="section-line"></div>`;
    listEl.appendChild(head);

    list.forEach((npc, idxInGroup) => {
      const score = pd?.scores?.[npc.id] ?? 50;
      const { word, color } = favorMeta(score);
      const isHeader = npc.isFactionHeader === true;
      const isFirst = idxInGroup === 0;
      const isLast = idxInGroup === list.length - 1;

      // ── Row ──
      const row = document.createElement("div");
      row.className = `npc-row${isHeader ? " faction-header" : ""}`;

      // ── Left: reorder + initials + info ──
      const left = document.createElement("div");
      left.className = "npc-left";

      const delBtn = document.createElement("button");
      delBtn.className = "btn-icon danger";
      delBtn.textContent = "✕";
      delBtn.title = "Remove NPC";
      delBtn.addEventListener("click", () => {
        if (
          !confirm(
            `Remove ${npc.name}? This will delete their scores for all players.`,
          )
        )
          return;
        store.deleteNPC(cid, npc.id);
        renderFavor();
      });

      // Reorder arrows
      const reorder = document.createElement("div");
      reorder.className = "reorder-btns";

      const upBtn = document.createElement("button");
      upBtn.className = "reorder-arrow";
      upBtn.textContent = "▲";
      upBtn.title = "Move up";
      upBtn.disabled = isFirst;
      upBtn.addEventListener("click", () => {
        store.reorderNPC(cid, npc.id, -1);
        renderFavor();
      });

      const downBtn = document.createElement("button");
      downBtn.className = "reorder-arrow";
      downBtn.textContent = "▼";
      downBtn.title = "Move down";
      downBtn.disabled = isLast;
      downBtn.addEventListener("click", () => {
        store.reorderNPC(cid, npc.id, 1);
        renderFavor();
      });

      reorder.appendChild(upBtn);
      reorder.appendChild(downBtn);

      // Initials badge
      const badge = document.createElement("div");
      badge.className = "npc-initials";
      badge.textContent = initials(npc.name);

      // Info block
      const info = document.createElement("div");
      info.className = "npc-info";

      const nameDiv = document.createElement("div");
      nameDiv.className = "npc-name";

      if (isHeader) {
        nameDiv.innerHTML = `${npc.name} <span class="faction-header-badge">Renown</span>`;
      } else {
        nameDiv.textContent = npc.name;
      }

      const roleDiv = document.createElement("div");
      roleDiv.className = "npc-role";
      roleDiv.textContent = npc.role;

      info.appendChild(nameDiv);
      info.appendChild(roleDiv);

      left.appendChild(delBtn);

      left.appendChild(reorder);
      left.appendChild(badge);
      left.appendChild(info);

      delBtn.style.display = deleteEnabled ? "flex" : "none";

      // ── Right: meter + step buttons ──
      const right = document.createElement("div");
      right.className = "npc-right";

      const meter = document.createElement("div");
      meter.className = "meter-wrap";
      meter.innerHTML = `
        <div class="meter-top">
          <span class="favor-word" style="color:${color}">${word}</span>
          <span class="score-num">${score}</span>
        </div>
        <div class="meter-track">
          <div class="meter-fill" style="width:${score}%;background:${color}"></div>
        </div>`;

      const stepBtns = document.createElement("div");
      stepBtns.className = "step-btns";

      right.appendChild(meter);
      right.appendChild(stepBtns);

      const minusBtn = document.createElement("button");
      minusBtn.className = "step-btn";
      minusBtn.textContent = "−";
      minusBtn.addEventListener("click", () => {
        if (!pid) {
          showToast("Select a player first");
          return;
        }
        store.adjustFavorScore(cid, pid, npc.id, -5);
        renderFavor();
      });

      const plusBtn = document.createElement("button");
      plusBtn.className = "step-btn";
      plusBtn.textContent = "+";
      plusBtn.addEventListener("click", () => {
        if (!pid) {
          showToast("Select a player first");
          return;
        }
        store.adjustFavorScore(cid, pid, npc.id, 5);
        renderFavor();
      });

      stepBtns.appendChild(minusBtn);
      stepBtns.appendChild(plusBtn);
      right.appendChild(meter);
      right.appendChild(stepBtns);

      row.appendChild(left);
      row.appendChild(right);
      listEl.appendChild(row);
    });
  });

  if (!anyRendered) {
    listEl.innerHTML =
      '<div class="empty-state">No NPCs in schema yet — add one below.</div>';
  }
}

// ── Save ───────────────────────────────────────────────────────────────────

export function savePlayer(): void {
  const cid = store.activeCampaignId;
  const pid = store.activePlayerId;
  if (!cid || !pid) return;
  store.patchPlayerScores(cid, pid);
  store.forceSave();
  showToast(`${cap(pid)} saved`);
}

// ── Add player ─────────────────────────────────────────────────────────────

export function createPlayer(): void {
  const input = document.getElementById("new-player-name") as HTMLInputElement;
  const raw = input.value.trim();
  if (!raw) return;

  const cid = store.activeCampaignId;
  if (!cid) {
    showToast("Select a campaign first");
    return;
  }

  const key = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const cd = store.getCampaignData(cid);
  const scores: Record<string, number> = {};
  cd.schema.npcs.forEach((n) => {
    scores[n.id] = 50;
  });

  store.upsertPlayer(cid, key, { player: raw, scores });
  input.value = "";
  renderPlayerSelect();
  switchPlayer(key);
  showToast(`${raw} created`);
}

// ── Add NPC ────────────────────────────────────────────────────────────────

export function addNPC(): void {
  const nameEl = document.getElementById("new-npc-name") as HTMLInputElement;
  const roleEl = document.getElementById("new-npc-role") as HTMLInputElement;
  const factionEl = document.getElementById(
    "new-npc-faction",
  ) as HTMLInputElement;
  const headerEl = document.getElementById(
    "new-npc-is-header",
  ) as HTMLInputElement;

  const name = nameEl.value.trim();
  const role = roleEl.value.trim();
  const faction = factionEl.value.trim();
  const isFactionHeader = headerEl.checked;

  if (!name) {
    showToast("Name required");
    return;
  }

  const cid = store.activeCampaignId;
  if (!cid) {
    showToast("Select a campaign first");
    return;
  }

  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  if (store.getCampaignData(cid).schema.npcs.find((n) => n.id === id)) {
    showToast("NPC already exists");
    return;
  }

  store.addNPC(cid, {
    id,
    name,
    role: role || "—",
    faction: faction || "Unaffiliated",
    isFactionHeader: isFactionHeader || undefined,
  });

  nameEl.value = "";
  roleEl.value = "";
  factionEl.value = "";
  headerEl.checked = false;

  renderFavor();
  showToast(`${name} added`);
}
