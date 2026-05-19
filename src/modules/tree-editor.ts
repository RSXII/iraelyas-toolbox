import type {
  HouseData,
  HouseMember,
  MemberType,
  ColValue,
  Campaign,
} from "@/types/index";

// ═══════════════════════════════════════════════════════════════
// TOAST (standalone — no Svelte runtime in this window)
// ═══════════════════════════════════════════════════════════════

let _toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string): void {
  const el = document.getElementById("toast")!;
  el.textContent = msg;
  el.classList.add("show");
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ═══════════════════════════════════════════════════════════════
// MODAL HELPERS
// ═══════════════════════════════════════════════════════════════

function openModal(id: string): void {
  document.getElementById(id)?.classList.add("open");
}

function closeModal(id: string): void {
  document.getElementById(id)?.classList.remove("open");
}

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let campaigns: Campaign[] = [];
let activeCampaign = "";

// Working copy of all houses for the active campaign.
// The editor mutates this directly; on save it is sent to main via IPC.
let houses: Record<string, HouseData> = {};

let selectedHouseId = "";

// ── Modal contexts ────────────────────────────────────────────

type TreeCtx = { mode: "add" | "edit" };
let treeCtx: TreeCtx | null = null;

type MemberCtx = { mode: "add" | "edit"; memberId: string | null };
let memberCtx: MemberCtx | null = null;

type ConfirmCtx = { onConfirm: () => void };
let confirmCtx: ConfirmCtx | null = null;

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

async function init(): Promise<void> {
  const ctx = await window.toolbox.getTreeContext("");
  if (!ctx) {
    document.getElementById("te-campaign-label")!.textContent =
      "No data file found";
    return;
  }

  campaigns = ctx.campaigns;
  activeCampaign = ctx.activeCampaign;

  // Populate campaign selector
  const sel = document.getElementById("te-campaign-select") as HTMLSelectElement;
  sel.innerHTML = "";
  if (!campaigns.length) {
    sel.innerHTML = '<option value="">No campaigns</option>';
  } else {
    campaigns.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      if (c.id === activeCampaign) opt.selected = true;
      sel.appendChild(opt);
    });
  }
  sel.addEventListener("change", () => loadCampaign(sel.value));

  if (activeCampaign) {
    await loadCampaign(activeCampaign);
  }
}

async function loadCampaign(campaignId: string): Promise<void> {
  activeCampaign = campaignId;
  const campaign = campaigns.find((c) => c.id === campaignId);
  document.getElementById("te-campaign-label")!.textContent =
    campaign?.label ?? campaignId;

  const ctx = await window.toolbox.getTreeContext(campaignId);
  houses = ctx?.houses ?? {};
  selectedHouseId = "";

  renderTreeList();
  renderMainPanel();
}

// ═══════════════════════════════════════════════════════════════
// SAVE / DELETE HOUSE (IPC calls)
// ═══════════════════════════════════════════════════════════════

async function persistHouse(houseId: string): Promise<void> {
  if (!activeCampaign) {
    showToast("No campaign selected");
    return;
  }
  const result = await window.toolbox.saveHouse(
    activeCampaign,
    houseId,
    houses[houseId],
  );
  if (!result?.ok) showToast(`Save failed: ${result?.error ?? "unknown error"}`);
}

async function deleteHouseById(houseId: string): Promise<void> {
  const result = await window.toolbox.deleteHouse(activeCampaign, houseId);
  if (!result?.ok) {
    showToast("Delete failed");
    return;
  }
  delete houses[houseId];
  if (selectedHouseId === houseId) {
    selectedHouseId = Object.keys(houses)[0] ?? "";
  }
  renderTreeList();
  renderMainPanel();
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR — TREE LIST
// ═══════════════════════════════════════════════════════════════

function renderTreeList(): void {
  const list = document.getElementById("te-tree-list")!;
  list.innerHTML = "";

  const ids = Object.keys(houses);
  if (!ids.length) {
    const empty = document.createElement("div");
    empty.className = "te-no-members";
    empty.textContent = "No trees yet";
    list.appendChild(empty);
    return;
  }

  ids.forEach((hid) => {
    const house = houses[hid];
    const row = document.createElement("div");
    row.className = `te-tree-row${hid === selectedHouseId ? " active" : ""}`;

    const nameEl = document.createElement("span");
    nameEl.className = "te-tree-row-name";
    nameEl.textContent = house.house;

    const actions = document.createElement("div");
    actions.className = "te-tree-row-actions";
    actions.appendChild(makeIconBtn("✎", false, (e) => { e.stopPropagation(); openTreeModal("edit", hid); }));
    actions.appendChild(makeIconBtn("✕", true, (e) => {
      e.stopPropagation();
      promptConfirm(
        `Delete "${house.house}"? This cannot be undone.`,
        () => deleteHouseById(hid),
      );
    }));

    row.appendChild(nameEl);
    row.appendChild(actions);
    row.addEventListener("click", () => selectHouse(hid));
    list.appendChild(row);
  });
}

function selectHouse(houseId: string): void {
  selectedHouseId = houseId;
  renderTreeList();
  renderMainPanel();
}

// ═══════════════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════════════

function renderMainPanel(): void {
  const empty = document.getElementById("te-empty")!;
  const panel = document.getElementById("te-panel")!;

  if (!selectedHouseId || !houses[selectedHouseId]) {
    empty.style.display = "";
    panel.style.display = "none";
    return;
  }
  empty.style.display = "none";
  panel.style.display = "";

  const house = houses[selectedHouseId];
  document.getElementById("te-panel-name")!.textContent = house.house;
  document.getElementById("te-panel-subtitle")!.textContent =
    house.subtitle ?? "";

  renderMemberList();
}

function renderMemberList(): void {
  const list = document.getElementById("te-member-list")!;
  list.innerHTML = "";

  const house = houses[selectedHouseId];
  if (!house?.members.length) {
    const empty = document.createElement("div");
    empty.className = "te-no-members";
    empty.textContent = "No members yet — add one to get started.";
    list.appendChild(empty);
    return;
  }

  // Sort: spine first, then by row, then by col
  const sorted = [...house.members].sort((a, b) => {
    if (a.col === "spine" && b.col !== "spine") return -1;
    if (a.col !== "spine" && b.col === "spine") return 1;
    if (a.row !== b.row) return a.row - b.row;
    const ac = a.col === "spine" ? 0 : (a.col as number);
    const bc = b.col === "spine" ? 0 : (b.col as number);
    return ac - bc;
  });

  sorted.forEach((member) => {
    const row = document.createElement("div");
    row.className = "te-member-row";

    const info = document.createElement("div");
    info.className = "te-member-info";

    const name = document.createElement("div");
    name.className = "te-member-name";
    name.textContent = member.label;

    const meta = document.createElement("div");
    meta.className = "te-member-meta";
    const colStr = member.col === "spine" ? "Spine" : `Col ${member.col}`;
    const typeLabel: Record<MemberType, string> = {
      bio: "Bio",
      current: "Current Head",
      heir: "Heir",
      priestess: "Priestess/Former",
      unknown: "Unknown",
    };
    meta.textContent = `Row ${member.row} · ${colStr} · ${typeLabel[member.type] ?? member.type}`;

    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "te-member-actions";
    actions.appendChild(makeIconBtn("✎", false, () => openMemberModal("edit", member.id)));
    actions.appendChild(makeIconBtn("✕", true, () => {
      promptConfirm(
        `Remove "${member.label}" from this tree?`,
        () => deleteMemberById(member.id),
      );
    }));

    row.appendChild(info);
    row.appendChild(actions);
    list.appendChild(row);
  });
}

// ═══════════════════════════════════════════════════════════════
// CONFIRM MODAL
// ═══════════════════════════════════════════════════════════════

function promptConfirm(message: string, onConfirm: () => void): void {
  confirmCtx = { onConfirm };
  document.getElementById("te-confirm-msg")!.textContent = message;
  openModal("modal-confirm");
}

// ═══════════════════════════════════════════════════════════════
// TREE MODAL
// ═══════════════════════════════════════════════════════════════

function openTreeModal(mode: "add" | "edit", houseId?: string): void {
  treeCtx = { mode };
  const title = document.getElementById("modal-tree-title")!;
  const nameEl = document.getElementById("tree-name") as HTMLInputElement;
  const subEl  = document.getElementById("tree-subtitle") as HTMLInputElement;

  if (mode === "edit" && houseId && houses[houseId]) {
    title.textContent = "Edit Tree";
    nameEl.value = houses[houseId].house;
    subEl.value  = houses[houseId].subtitle ?? "";
    // Store the houseId we're editing
    (document.getElementById("modal-tree") as HTMLElement).dataset.editId = houseId;
  } else {
    title.textContent = "New Tree";
    nameEl.value = "";
    subEl.value  = "";
    delete (document.getElementById("modal-tree") as HTMLElement).dataset.editId;
  }

  openModal("modal-tree");
  setTimeout(() => nameEl.select(), 50);
}

async function saveTreeModal(): Promise<void> {
  const nameEl = document.getElementById("tree-name") as HTMLInputElement;
  const subEl  = document.getElementById("tree-subtitle") as HTMLInputElement;
  const modalEl = document.getElementById("modal-tree") as HTMLElement;

  const name = nameEl.value.trim();
  if (!name) {
    showToast("House name is required");
    return;
  }

  const editId = modalEl.dataset.editId;

  if (treeCtx?.mode === "edit" && editId && houses[editId]) {
    houses[editId].house    = name;
    houses[editId].subtitle = subEl.value.trim() || undefined;
    await persistHouse(editId);
    closeModal("modal-tree");
    renderTreeList();
    renderMainPanel();
    showToast("Tree updated");
  } else {
    // New tree — generate a GUID for the key
    const houseId = crypto.randomUUID();
    houses[houseId] = {
      house:    name,
      subtitle: subEl.value.trim() || undefined,
      members:  [],
    };
    await persistHouse(houseId);
    closeModal("modal-tree");
    selectedHouseId = houseId;
    renderTreeList();
    renderMainPanel();
    showToast(`${name} created`);
  }
}

// ═══════════════════════════════════════════════════════════════
// MEMBER MODAL
// ═══════════════════════════════════════════════════════════════

function openMemberModal(mode: "add" | "edit", memberId: string | null): void {
  memberCtx = { mode, memberId };

  const title    = document.getElementById("modal-member-title")!;
  const labelEl  = document.getElementById("mem-label")  as HTMLInputElement;
  const typeEl   = document.getElementById("mem-type")   as HTMLSelectElement;
  const rowEl    = document.getElementById("mem-row")    as HTMLInputElement;
  const colEl    = document.getElementById("mem-col")    as HTMLSelectElement;
  const noteEl   = document.getElementById("mem-note")   as HTMLTextAreaElement;
  const imgEl    = document.getElementById("mem-img")    as HTMLInputElement;

  const house   = houses[selectedHouseId];
  const members = house?.members ?? [];

  // Build relationship dropdowns from current members (excluding self)
  const othersForSelect = members.filter((m) => m.id !== memberId);
  ["mem-mother", "mem-father", "mem-spouse", "mem-adoptive"].forEach((selId) => {
    populateRelSelect(selId, othersForSelect, null);
  });

  if (mode === "edit" && memberId) {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;
    title.textContent  = "Edit Member";
    labelEl.value      = member.label;
    typeEl.value       = member.type;
    rowEl.value        = String(member.row);
    colEl.value        = String(member.col);
    noteEl.value       = member.note ?? "";
    imgEl.value        = member.img  ?? "";
    // Set relationship dropdown values
    setRelSelect("mem-mother",   member.mother);
    setRelSelect("mem-father",   member.father);
    setRelSelect("mem-spouse",   member.spouse);
    setRelSelect("mem-adoptive", member.adoptive);
  } else {
    title.textContent  = "New Member";
    labelEl.value      = "";
    typeEl.value       = "bio";
    rowEl.value        = "1";
    colEl.value        = "1";
    noteEl.value       = "";
    imgEl.value        = "";
  }

  openModal("modal-member");
  setTimeout(() => labelEl.select(), 50);
}

function populateRelSelect(
  selId: string,
  members: HouseMember[],
  currentValue: string | null,
): void {
  const sel = document.getElementById(selId) as HTMLSelectElement;
  const newInput = document.getElementById(
    (sel.dataset.newId as string) ?? selId + "-new",
  ) as HTMLInputElement;

  sel.innerHTML = "";

  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "— none —";
  sel.appendChild(noneOpt);

  const newOpt = document.createElement("option");
  newOpt.value = "__new__";
  newOpt.textContent = "+ New Member";
  sel.appendChild(newOpt);

  members.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    sel.appendChild(opt);
  });

  sel.value = currentValue ?? "";
  newInput.style.display = "none";
  newInput.value = "";
}

function setRelSelect(selId: string, value: string | null): void {
  const sel = document.getElementById(selId) as HTMLSelectElement;
  sel.value = value ?? "";
}

async function saveMemberModal(): Promise<void> {
  const labelEl = document.getElementById("mem-label") as HTMLInputElement;
  const typeEl  = document.getElementById("mem-type")  as HTMLSelectElement;
  const rowEl   = document.getElementById("mem-row")   as HTMLInputElement;
  const colEl   = document.getElementById("mem-col")   as HTMLSelectElement;
  const noteEl  = document.getElementById("mem-note")  as HTMLTextAreaElement;
  const imgEl   = document.getElementById("mem-img")   as HTMLInputElement;

  const label = labelEl.value.trim();
  if (!label) {
    showToast("Name is required");
    return;
  }

  const rowRaw = parseInt(rowEl.value);
  const row = isNaN(rowRaw) || rowRaw < 1 ? 1 : rowRaw;
  const colRaw = colEl.value;
  const col: ColValue = colRaw === "spine" ? "spine" : (parseInt(colRaw) || 1);

  const house = houses[selectedHouseId];

  // Resolve relationship fields — may create stub members for "+ New Member" picks
  const mother   = resolveRelField("mem-mother");
  const father   = resolveRelField("mem-father");
  const spouse   = resolveRelField("mem-spouse");
  const adoptive = resolveRelField("mem-adoptive");

  if (memberCtx?.mode === "edit" && memberCtx.memberId) {
    const idx = house.members.findIndex((m) => m.id === memberCtx!.memberId);
    if (idx !== -1) {
      house.members[idx] = {
        ...house.members[idx],
        label:    label,
        type:     typeEl.value as MemberType,
        row,
        col,
        note:     noteEl.value.trim() || null,
        img:      imgEl.value.trim() || null,
        mother,
        father,
        spouse,
        adoptive,
      };
    }
  } else {
    const newMember: HouseMember = {
      id:       crypto.randomUUID(),
      label,
      type:     typeEl.value as MemberType,
      row,
      col,
      note:     noteEl.value.trim() || null,
      img:      imgEl.value.trim() || null,
      mother,
      father,
      spouse,
      adoptive,
    };
    house.members.push(newMember);
  }

  await persistHouse(selectedHouseId);
  closeModal("modal-member");
  renderMemberList();
  showToast(memberCtx?.mode === "edit" ? "Member updated" : "Member added");
}

/**
 * Resolve one relationship field.
 * If "__new__" is selected and a name was typed, create a stub HouseMember,
 * push it onto the working house, and return its GUID.
 */
function resolveRelField(selId: string): string | null {
  const sel = document.getElementById(selId) as HTMLSelectElement;
  if (!sel.value || sel.value === "") return null;
  if (sel.value !== "__new__") return sel.value;

  const newInputId = (sel.dataset.newId as string) ?? selId + "-new";
  const newInput = document.getElementById(newInputId) as HTMLInputElement;
  const name = newInput.value.trim();
  if (!name) return null;

  const stub: HouseMember = {
    id:       crypto.randomUUID(),
    label:    name,
    type:     "bio",
    row:      1,
    col:      1,
    mother:   null,
    father:   null,
    adoptive: null,
    spouse:   null,
    img:      null,
    note:     null,
  };
  houses[selectedHouseId].members.push(stub);
  return stub.id;
}

function deleteMemberById(memberId: string): void {
  const house = houses[selectedHouseId];
  if (!house) return;
  house.members = house.members.filter((m) => m.id !== memberId);
  persistHouse(selectedHouseId).then(() => {
    renderMemberList();
    showToast("Member removed");
  });
}

// ═══════════════════════════════════════════════════════════════
// IMAGE PICKER
// ═══════════════════════════════════════════════════════════════

async function pickPortraitImage(): Promise<void> {
  const filePath = await window.toolbox.pickImage();
  if (!filePath) return;
  const imgEl = document.getElementById("mem-img") as HTMLInputElement;
  imgEl.value = filePath;
}

// ═══════════════════════════════════════════════════════════════
// DOM HELPERS
// ═══════════════════════════════════════════════════════════════

function makeIconBtn(
  icon: string,
  isDanger: boolean,
  onClick: (e: MouseEvent) => void,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = `btn-icon${isDanger ? " danger" : ""}`;
  btn.textContent = icon;
  btn.addEventListener("click", onClick);
  return btn;
}

// ═══════════════════════════════════════════════════════════════
// WIRE UP STATIC EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════

function wireEvents(): void {
  // ── Sidebar ──
  document
    .getElementById("te-add-tree-btn")!
    .addEventListener("click", () => openTreeModal("add"));

  // ── Tree panel ──
  document
    .getElementById("te-edit-tree-btn")!
    .addEventListener("click", () => openTreeModal("edit", selectedHouseId));

  document
    .getElementById("te-add-member-btn")!
    .addEventListener("click", () => openMemberModal("add", null));

  // ── Tree modal ──
  document
    .getElementById("modal-tree-cancel")!
    .addEventListener("click", () => closeModal("modal-tree"));

  document
    .getElementById("modal-tree-save")!
    .addEventListener("click", () => saveTreeModal());

  document.getElementById("tree-name")!.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") saveTreeModal();
  });

  // ── Member modal ──
  document
    .getElementById("modal-member-cancel")!
    .addEventListener("click", () => closeModal("modal-member"));

  document
    .getElementById("modal-member-save")!
    .addEventListener("click", () => saveMemberModal());

  // Show/hide "new member" text inputs for each relationship select
  ["mem-mother", "mem-father", "mem-spouse", "mem-adoptive"].forEach((selId) => {
    const sel = document.getElementById(selId) as HTMLSelectElement;
    sel.addEventListener("change", () => {
      const newInputId = (sel.dataset.newId as string) ?? selId + "-new";
      const newInput = document.getElementById(newInputId) as HTMLInputElement;
      if (sel.value === "__new__") {
        newInput.style.display = "";
        newInput.focus();
      } else {
        newInput.style.display = "none";
        newInput.value = "";
      }
    });
  });

  // Image picker
  document
    .getElementById("mem-img-browse")!
    .addEventListener("click", () => pickPortraitImage());

  document
    .getElementById("mem-img-clear")!
    .addEventListener("click", () => {
      (document.getElementById("mem-img") as HTMLInputElement).value = "";
    });

  // ── Confirm modal ──
  document
    .getElementById("modal-confirm-cancel")!
    .addEventListener("click", () => {
      confirmCtx = null;
      closeModal("modal-confirm");
    });

  document
    .getElementById("modal-confirm-ok")!
    .addEventListener("click", () => {
      const fn = confirmCtx?.onConfirm;
      confirmCtx = null;
      closeModal("modal-confirm");
      fn?.();
    });

  // Close modals on overlay click
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal((overlay as HTMLElement).id);
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════

wireEvents();
init();
