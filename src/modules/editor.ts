import type {
  TimelineData, TimelineSection, TimelineItem,
  TimelineSpan, TimelinePoint, TintConfig, Campaign,
} from '@/types/index';

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let campaigns:      Campaign[]     = [];
let activeCampaign: string         = '';
let timeline:       TimelineData | null = null;

// Editing context for the item modal
type ItemModalContext = {
  mode:        'add' | 'edit';
  sectionIdx:  number;
  itemIdx:     number | null;   // null when adding
};
let itemCtx: ItemModalContext | null = null;

// Section rename context
let renamingSectionIdx: number | null = null;

// ═══════════════════════════════════════════════════════════════
// DEFAULT TINTS — shown in the tint dropdown
// ═══════════════════════════════════════════════════════════════

const DEFAULT_TINTS: Record<string, TintConfig> = {
  lore:      { tint: 'rgba(225,215,195,0.88)', accent: '#9a7848', text: '#3a2e1e' },
  war:       { tint: 'rgba(205,178,162,0.88)', accent: '#8a4830', text: '#3a1a0e' },
  intrigue:  { tint: 'rgba(136,150,207,0.88)', accent: '#7080bf', text: '#1e1630' },
  civic:     { tint: 'rgba(198,208,192,0.88)', accent: '#5a6848', text: '#202818' },
  political: { tint: 'rgba(218,208,175,0.88)', accent: '#807040', text: '#302810' },
  noble:     { tint: 'rgba(205,192,222,0.88)', accent: '#68509a', text: '#2a1e48' },
  faculty:   { tint: 'rgba(215,208,188,0.88)', accent: '#7a6838', text: '#302a18' },
  student:   { tint: 'rgba(188,210,200,0.88)', accent: '#4a6858', text: '#182820' },
};

function getTints(): Record<string, TintConfig> {
  return { ...DEFAULT_TINTS, ...(timeline?.tints ?? {}) };
}

function accentForTint(key: string): string {
  return getTints()[key]?.accent ?? '#9a7848';
}

// ═══════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string): void {
  const t = document.getElementById('toast')!;
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ═══════════════════════════════════════════════════════════════
// MODAL HELPERS
// ═══════════════════════════════════════════════════════════════

function openModal(id: string): void {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id: string): void {
  document.getElementById(id)?.classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════

async function saveTimeline(): Promise<void> {
  if (!timeline || !activeCampaign) return;
  const result = await window.toolbox.saveTimeline(activeCampaign, timeline);
  if (!result.ok) {
    showToast(`Save failed: ${result.error ?? 'unknown error'}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN SWITCHING
// ═══════════════════════════════════════════════════════════════

async function loadCampaignTimeline(campaignId: string): Promise<void> {
  activeCampaign = campaignId;
  const campaign = campaigns.find(c => c.id === campaignId);
  document.getElementById('ed-campaign-label')!.textContent =
    campaign?.label ?? campaignId;

  timeline = await window.toolbox.getTimeline(campaignId);
  renderBody();
}

// ═══════════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════════

function renderBody(): void {
  const body    = document.getElementById('ed-body')!;
  const sections = timeline?.sections ?? [];

  body.innerHTML = '';

  if (!timeline) {
    body.innerHTML = '<div class="empty-state">No timeline data for this campaign.<br>Import a timeline-data.js from the main window first.</div>';
    return;
  }

  // Render each section
  sections.forEach((section, si) => {
    body.appendChild(buildSectionEl(section, si));
  });

  // Add section button at bottom
  const addBtn = document.createElement('button');
  addBtn.className   = 'ed-add-section';
  addBtn.textContent = '+ Add Section';
  addBtn.addEventListener('click', () => addSection());
  body.appendChild(addBtn);
}

// ═══════════════════════════════════════════════════════════════
// SECTION ELEMENT
// ═══════════════════════════════════════════════════════════════

// Track which sections are open
const openSections = new Set<number>();

function buildSectionEl(section: TimelineSection, si: number): HTMLElement {
  const isOpen = openSections.has(si);

  const wrapper = document.createElement('div');
  wrapper.className = `ed-section${isOpen ? ' open' : ''}`;
  wrapper.dataset.sectionIdx = String(si);

  // ── Head ──
  const head = document.createElement('div');
  head.className = 'ed-section-head';

  const chevron = document.createElement('span');
  chevron.className   = 'ed-section-chevron';
  chevron.textContent = '▶';

  const name = document.createElement('span');
  name.className   = 'ed-section-name';
  name.textContent = section.label;

  const count = document.createElement('span');
  count.className   = 'ed-section-count';
  count.textContent = `${section.items.length}`;

  const actions = document.createElement('div');
  actions.className = 'ed-section-actions';

  const renameBtn = makeIconBtn('✎', 'Rename section', false, e => {
    e.stopPropagation();
    openSectionRename(si);
  });

  const deleteBtn = makeIconBtn('✕', 'Delete section', true, e => {
    e.stopPropagation();
    deleteSection(si);
  });

  actions.appendChild(renameBtn);
  actions.appendChild(deleteBtn);

  head.appendChild(chevron);
  head.appendChild(name);
  head.appendChild(count);
  head.appendChild(actions);

  // Toggle open/close on head click
  head.addEventListener('click', () => {
    if (openSections.has(si)) {
      openSections.delete(si);
    } else {
      openSections.add(si);
    }
    renderBody();
  });

  wrapper.appendChild(head);

  // ── Body (collapsible) ──
  const body = document.createElement('div');
  body.className = 'ed-section-body';

  // Item list
  const list = document.createElement('div');
  list.className = 'ed-item-list';

  if (section.items.length === 0) {
    const empty = document.createElement('div');
    empty.className   = 'empty-state';
    empty.textContent = 'No items yet.';
    list.appendChild(empty);
  } else {
    section.items.forEach((item, ii) => {
      list.appendChild(buildItemRow(item, si, ii, section.items.length));
    });
  }

  body.appendChild(list);

  // Add item row
  const addRow = document.createElement('div');
  addRow.className = 'ed-add-item-row';

  const addSpan = document.createElement('button');
  addSpan.className   = 'btn btn-sm';
  addSpan.textContent = '+ Span';
  addSpan.addEventListener('click', () => openItemModal('add', si, null, 'span'));

  const addPoint = document.createElement('button');
  addPoint.className   = 'btn btn-sm';
  addPoint.textContent = '+ Point';
  addPoint.addEventListener('click', () => openItemModal('add', si, null, 'point'));

  addRow.appendChild(addSpan);
  addRow.appendChild(addPoint);
  body.appendChild(addRow);

  wrapper.appendChild(body);
  return wrapper;
}

// ═══════════════════════════════════════════════════════════════
// ITEM ROW
// ═══════════════════════════════════════════════════════════════

function buildItemRow(
  item: TimelineItem,
  si: number,
  ii: number,
  total: number,
): HTMLElement {
  const tints  = getTints();
  const tint   = tints[item.tint] ?? DEFAULT_TINTS.lore;

  const row = document.createElement('div');
  row.className = 'ed-item-row';

  // ── Up/down arrows ──
  const reorder = document.createElement('div');
  reorder.className = 'ed-reorder';

  const upBtn = document.createElement('button');
  upBtn.className   = 'ed-arrow';
  upBtn.textContent = '▲';
  upBtn.title       = 'Move up';
  upBtn.disabled    = ii === 0;
  upBtn.addEventListener('click', () => moveItem(si, ii, -1));

  const downBtn = document.createElement('button');
  downBtn.className   = 'ed-arrow';
  downBtn.textContent = '▼';
  downBtn.title       = 'Move down';
  downBtn.disabled    = ii === total - 1;
  downBtn.addEventListener('click', () => moveItem(si, ii, 1));

  reorder.appendChild(upBtn);
  reorder.appendChild(downBtn);

  // ── Tint pip ──
  const pip = document.createElement('div');
  pip.className        = 'ed-item-tint';
  pip.style.background = tint.accent;

  // ── Info ──
  const info = document.createElement('div');
  info.className = 'ed-item-info';

  const label = document.createElement('div');
  label.className   = 'ed-item-label';
  label.textContent = item.label;

  const meta = document.createElement('div');
  meta.className   = 'ed-item-meta';
  meta.textContent = item.type === 'span'
    ? `Span · ${item.start} – ${item.end}`
    : `Point · ${item.year}`;

  info.appendChild(label);
  info.appendChild(meta);

  // ── Actions ──
  const actions = document.createElement('div');
  actions.className = 'ed-item-actions';

  const editBtn = makeIconBtn('✎', 'Edit item', false, () => openItemModal('edit', si, ii));
  const delBtn  = makeIconBtn('✕', 'Delete item', true,  () => deleteItem(si, ii));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  row.appendChild(reorder);
  row.appendChild(pip);
  row.appendChild(info);
  row.appendChild(actions);

  return row;
}

// ═══════════════════════════════════════════════════════════════
// ICON BUTTON FACTORY
// ═══════════════════════════════════════════════════════════════

function makeIconBtn(
  icon: string,
  title: string,
  danger: boolean,
  handler: (e: MouseEvent) => void,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className   = `btn-icon${danger ? ' danger' : ''}`;
  btn.textContent = icon;
  btn.title       = title;
  btn.addEventListener('click', handler);
  return btn;
}

// ═══════════════════════════════════════════════════════════════
// MOVE ITEM (up/down)
// ═══════════════════════════════════════════════════════════════

function moveItem(si: number, ii: number, direction: -1 | 1): void {
  if (!timeline) return;
  const items  = timeline.sections[si].items;
  const target = ii + direction;
  if (target < 0 || target >= items.length) return;

  // Swap
  [items[ii], items[target]] = [items[target], items[ii]];

  saveTimeline();
  renderBody();
}

// ═══════════════════════════════════════════════════════════════
// SECTION OPERATIONS
// ═══════════════════════════════════════════════════════════════

function addSection(): void {
  if (!timeline) return;
  const id    = `section_${Date.now()}`;
  const label = `New Section ${timeline.sections.length + 1}`;
  timeline.sections.push({ id, label, items: [] });
  // Auto-open the new section
  openSections.add(timeline.sections.length - 1);
  saveTimeline();
  renderBody();
}

function deleteSection(si: number): void {
  if (!timeline) return;
  const section = timeline.sections[si];
  if (section.items.length > 0) {
    if (!confirm(`Delete "${section.label}" and all ${section.items.length} items?`)) return;
  }
  timeline.sections.splice(si, 1);
  openSections.delete(si);
  // Shift open section indices down
  const shifted = new Set<number>();
  openSections.forEach(idx => { if (idx < si) shifted.add(idx); else if (idx > si) shifted.add(idx - 1); });
  openSections.clear();
  shifted.forEach(idx => openSections.add(idx));
  saveTimeline();
  renderBody();
}

function openSectionRename(si: number): void {
  if (!timeline) return;
  renamingSectionIdx = si;
  const input = document.getElementById('section-label-input') as HTMLInputElement;
  input.value = timeline.sections[si].label;
  openModal('modal-section');
  setTimeout(() => input.select(), 50);
}

function saveSectionRename(): void {
  if (!timeline || renamingSectionIdx === null) return;
  const input = document.getElementById('section-label-input') as HTMLInputElement;
  const label = input.value.trim();
  if (!label) { showToast('Label cannot be empty'); return; }
  timeline.sections[renamingSectionIdx].label = label;
  renamingSectionIdx = null;
  closeModal('modal-section');
  saveTimeline();
  renderBody();
}

// ═══════════════════════════════════════════════════════════════
// ITEM MODAL
// ═══════════════════════════════════════════════════════════════

function populateTintSelect(selectedKey: string): void {
  const sel    = document.getElementById('item-tint') as HTMLSelectElement;
  const tints  = getTints();
  sel.innerHTML = Object.keys(tints)
    .map(k => `<option value="${k}"${k === selectedKey ? ' selected' : ''}>${k}</option>`)
    .join('');
}

function syncTypeFields(type: string): void {
  const spanFields  = document.getElementById('span-fields')!;
  const pointFields = document.getElementById('point-fields')!;
  spanFields.style.display  = type === 'span'  ? ''     : 'none';
  pointFields.style.display = type === 'point' ? ''     : 'none';
}

function openItemModal(
  mode: 'add' | 'edit',
  si: number,
  ii: number | null,
  defaultType: 'span' | 'point' = 'span',
): void {
  if (!timeline) return;

  itemCtx = { mode, sectionIdx: si, itemIdx: ii };

  const titleEl = document.getElementById('modal-item-title')!;
  titleEl.textContent = mode === 'add' ? 'Add Item' : 'Edit Item';

  const typeEl  = document.getElementById('item-type')  as HTMLSelectElement;
  const labelEl = document.getElementById('item-label') as HTMLInputElement;
  const startEl = document.getElementById('item-start') as HTMLInputElement;
  const endEl   = document.getElementById('item-end')   as HTMLInputElement;
  const yearEl  = document.getElementById('item-year')  as HTMLInputElement;
  const obsEl   = document.getElementById('item-obs')   as HTMLInputElement;

  if (mode === 'edit' && ii !== null) {
    const item = timeline.sections[si].items[ii];
    typeEl.value  = item.type;
    labelEl.value = item.label;
    obsEl.value   = item.obs ?? '';
    populateTintSelect(item.tint);

    if (item.type === 'span') {
      startEl.value = String(item.start);
      endEl.value   = String(item.end);
      yearEl.value  = '';
    } else {
      yearEl.value  = String(item.year);
      startEl.value = '';
      endEl.value   = '';
    }
  } else {
    // Defaults for new item
    const cfg     = timeline.config;
    typeEl.value  = defaultType;
    labelEl.value = '';
    obsEl.value   = 'Events/NewEvent';
    populateTintSelect('lore');

    const midYear = Math.round((cfg.startYear + cfg.endYear) / 2);
    startEl.value = String(midYear);
    endEl.value   = String(midYear + 5);
    yearEl.value  = String(midYear);
  }

  syncTypeFields(typeEl.value);
  openModal('modal-item');
  setTimeout(() => labelEl.select(), 50);
}

function saveItemModal(): void {
  if (!timeline || !itemCtx) return;

  const typeEl  = document.getElementById('item-type')  as HTMLSelectElement;
  const labelEl = document.getElementById('item-label') as HTMLInputElement;
  const startEl = document.getElementById('item-start') as HTMLInputElement;
  const endEl   = document.getElementById('item-end')   as HTMLInputElement;
  const yearEl  = document.getElementById('item-year')  as HTMLInputElement;
  const obsEl   = document.getElementById('item-obs')   as HTMLInputElement;
  const tintEl  = document.getElementById('item-tint')  as HTMLSelectElement;

  const label = labelEl.value.trim();
  if (!label) { showToast('Label is required'); return; }

  const type  = typeEl.value as 'span' | 'point';
  const tint  = tintEl.value;
  const obs   = obsEl.value.trim() || 'Events/NewEvent';

  let item: TimelineItem;

  if (type === 'span') {
    const start = parseInt(startEl.value);
    const end   = parseInt(endEl.value);
    if (isNaN(start) || isNaN(end)) { showToast('Start and end year required'); return; }
    if (end <= start) { showToast('End year must be after start year'); return; }
    const span: TimelineSpan = { type: 'span', label, tint, obs, start, end };
    item = span;
  } else {
    const year = parseInt(yearEl.value);
    if (isNaN(year)) { showToast('Year is required'); return; }
    const point: TimelinePoint = { type: 'point', label, tint, obs, year };
    item = point;
  }

  const { mode, sectionIdx, itemIdx } = itemCtx;
  const items = timeline.sections[sectionIdx].items;

  if (mode === 'add') {
    items.push(item);
  } else if (itemIdx !== null) {
    items[itemIdx] = item;
  }

  closeModal('modal-item');
  itemCtx = null;
  saveTimeline();
  renderBody();
}

// ═══════════════════════════════════════════════════════════════
// DELETE ITEM
// ═══════════════════════════════════════════════════════════════

function deleteItem(si: number, ii: number): void {
  if (!timeline) return;
  const item = timeline.sections[si].items[ii];
  if (!confirm(`Delete "${item.label}"?`)) return;
  timeline.sections[si].items.splice(ii, 1);
  saveTimeline();
  renderBody();
}

// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  // Load campaign context
  const ctx = await window.toolbox.getEditorContext();

  if (!ctx || !ctx.campaigns.length) {
    document.getElementById('ed-body')!.innerHTML =
      '<div class="empty-state">No campaigns found.<br>Create a campaign in the main window first.</div>';
    return;
  }

  campaigns      = ctx.campaigns;
  activeCampaign = ctx.activeCampaign || ctx.campaigns[0].id;

  // Populate campaign selector
  const sel = document.getElementById('ed-campaign-select') as HTMLSelectElement;
  sel.innerHTML = campaigns
    .map(c => `<option value="${c.id}"${c.id === activeCampaign ? ' selected' : ''}>${c.label}</option>`)
    .join('');

  sel.addEventListener('change', () => {
    loadCampaignTimeline(sel.value);
  });

  // Load initial timeline
  await loadCampaignTimeline(activeCampaign);

  // ── Item modal events ──
  const typeEl = document.getElementById('item-type') as HTMLSelectElement;
  typeEl.addEventListener('change', () => syncTypeFields(typeEl.value));

  document.getElementById('modal-item-save')!
    .addEventListener('click', saveItemModal);

  document.getElementById('modal-item-cancel')!
    .addEventListener('click', () => { closeModal('modal-item'); itemCtx = null; });

  // ── Section rename modal events ──
  document.getElementById('modal-section-save')!
    .addEventListener('click', saveSectionRename);

  document.getElementById('modal-section-cancel')!
    .addEventListener('click', () => { closeModal('modal-section'); renamingSectionIdx = null; });

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('modal-item');
      closeModal('modal-section');
      itemCtx            = null;
      renamingSectionIdx = null;
    }
    // Cmd/Ctrl+Enter saves whichever modal is currently open
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const itemOpen    = document.getElementById('modal-item')?.classList.contains('open');
      const sectionOpen = document.getElementById('modal-section')?.classList.contains('open');
      if (itemOpen)    saveItemModal();
      if (sectionOpen) saveSectionRename();
    }
  });
}

main().catch(console.error);
