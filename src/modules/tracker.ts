import { store } from '@/state/store';
import { showToast } from './app';
import type { TrackerEntry, TrackerWarning, TrackerDirection } from '@/types/index';

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let activeFilter    = 'all';
let editingEntryId: string | null = null;

// Warning rows being built in the modal
let modalWarnings: TrackerWarning[] = [];
let modalDirection: TrackerDirection = 'countup';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function barColor(pct: number, hasWarning: boolean): string {
  if (hasWarning) return 'var(--hostile)';
  if (pct >= 0.75) return 'var(--allied)';
  if (pct >= 0.4)  return 'var(--friendly)';
  return 'var(--neutral)';
}

function activeWarnings(entry: TrackerEntry): TrackerWarning[] {
  return entry.warnings
    .filter(w => entry.current >= w.value)
    .sort((a, b) => a.value - b.value);
}

function genId(): string {
  return `tracker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ═══════════════════════════════════════════════════════════════
// FILTER CHIPS
// ═══════════════════════════════════════════════════════════════

function buildFilterChips(): void {
  const cid      = store.activeCampaignId;
  const entries  = cid ? store.getTracker(cid).entries : [];
  const cats     = [...new Set(entries.map(e => e.category))];
  const all      = ['all', ...cats];

  const row = document.getElementById('tracker-filter-row')!;
  row.innerHTML = '<span class="filter-label">Filter:</span>' +
    all.map(c =>
      `<button class="filter-chip${c === activeFilter ? ' active' : ''}"
        data-cat="${c}">${c === 'all' ? 'All' : c}</button>`
    ).join('');

  row.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.cat!;
      row.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTracker();
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════════

export function renderTracker(): void {
  buildFilterChips();

  const cid     = store.activeCampaignId;
  const listEl  = document.getElementById('tracker-list')!;
  listEl.innerHTML = '';

  if (!cid) {
    listEl.innerHTML = '<div class="empty-state">Select or create a campaign to begin.</div>';
    return;
  }

  const entries = store.getTracker(cid).entries;
  const cats    = activeFilter === 'all'
    ? [...new Set(entries.map(e => e.category))]
    : [activeFilter];

  let anyRendered = false;

  cats.forEach(cat => {
    const group = entries.filter(e => e.category === cat);
    if (!group.length) return;
    anyRendered = true;

    // Section header
    const head = document.createElement('div');
    head.className = 'section-head';
    head.innerHTML = `<span class="section-name">${cat}</span><div class="section-line"></div>`;
    listEl.appendChild(head);

    group.forEach((entry, idxInGroup) => {
      listEl.appendChild(buildEntryCard(entry, idxInGroup, group.length));
    });
  });

  if (!anyRendered) {
    listEl.innerHTML = '<div class="empty-state">No trackers yet — add one below.</div>';
  }
}

// ═══════════════════════════════════════════════════════════════
// ENTRY CARD
// ═══════════════════════════════════════════════════════════════

function buildEntryCard(entry: TrackerEntry, idxInGroup: number, groupSize: number): HTMLElement {
  const range      = entry.max - entry.min;
  const pct        = range === 0 ? 0 : (entry.current - entry.min) / range;
  const warnings   = activeWarnings(entry);
  const hasWarning = warnings.length > 0;
  const cid        = store.activeCampaignId!;
  const isFirst    = idxInGroup === 0;
  const isLast     = idxInGroup === groupSize - 1;

  const card = document.createElement('div');
  card.className = `tracker-card${hasWarning ? ' has-warning' : ''}`;

  // ── Top row ──
  const top = document.createElement('div');
  top.className = 'tracker-card-top';

  const left = document.createElement('div');
  left.className = 'tracker-card-left';

  // Reorder arrows
  const reorder = document.createElement('div');
  reorder.className = 'reorder-btns';

  const upBtn = document.createElement('button');
  upBtn.className   = 'reorder-arrow';
  upBtn.textContent = '▲';
  upBtn.title       = 'Move up';
  upBtn.disabled    = isFirst;
  upBtn.addEventListener('click', () => {
    store.reorderTrackerEntry(cid, entry.id, -1);
    renderTracker();
  });

  const downBtn = document.createElement('button');
  downBtn.className   = 'reorder-arrow';
  downBtn.textContent = '▼';
  downBtn.title       = 'Move down';
  downBtn.disabled    = isLast;
  downBtn.addEventListener('click', () => {
    store.reorderTrackerEntry(cid, entry.id, 1);
    renderTracker();
  });

  reorder.appendChild(upBtn);
  reorder.appendChild(downBtn);

  const nameEl = document.createElement('div');
  nameEl.className   = 'tracker-name';
  nameEl.textContent = entry.name;

  left.appendChild(reorder);
  left.appendChild(nameEl);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'tracker-card-actions';

  const editBtn = document.createElement('button');
  editBtn.className   = 'btn-icon';
  editBtn.textContent = '✎';
  editBtn.title       = 'Edit tracker';
  editBtn.addEventListener('click', () => openModal(entry));

  const delBtn = document.createElement('button');
  delBtn.className   = 'btn-icon danger';
  delBtn.textContent = '✕';
  delBtn.title       = 'Delete tracker';
  delBtn.addEventListener('click', () => deleteEntry(entry));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  top.appendChild(left);
  top.appendChild(actions);

  // ── Progress row ──
  const progressRow = document.createElement('div');
  progressRow.className = 'tracker-progress-row';

  // Bar
  const barWrap = document.createElement('div');
  barWrap.className = 'tracker-bar-wrap';

  const fill = document.createElement('div');
  fill.className = `tracker-bar-fill ${entry.direction}`;
  fill.style.width      = `${pct * 100}%`;
  fill.style.background = barColor(pct, hasWarning);

  barWrap.appendChild(fill);

  // Value display
  const valueDisplay = document.createElement('div');
  valueDisplay.className = 'tracker-value-display';
  valueDisplay.innerHTML =
    `${entry.current} <span class="tracker-max">/ ${entry.max}</span>`;

  // Step buttons
  const stepBtns = document.createElement('div');
  stepBtns.className = 'tracker-step-btns';

  const minusBtn = document.createElement('button');
  minusBtn.className   = 'step-btn';
  minusBtn.textContent = '−';
  minusBtn.disabled    = entry.current <= entry.min;
  minusBtn.addEventListener('click', () => {
    store.adjustTrackerValue(cid, entry.id, -1);
    renderTracker();
  });

  const plusBtn = document.createElement('button');
  plusBtn.className   = 'step-btn';
  plusBtn.textContent = '+';
  plusBtn.disabled    = entry.current >= entry.max;
  plusBtn.addEventListener('click', () => {
    store.adjustTrackerValue(cid, entry.id, 1);
    renderTracker();
  });

  stepBtns.appendChild(minusBtn);
  stepBtns.appendChild(plusBtn);

  progressRow.appendChild(barWrap);
  progressRow.appendChild(valueDisplay);
  progressRow.appendChild(stepBtns);

  // ── Warning labels ──
  card.appendChild(top);
  card.appendChild(progressRow);

  if (warnings.length > 0) {
    const warningsEl = document.createElement('div');
    warningsEl.className = 'tracker-warnings';
    warnings.forEach(w => {
      const wEl = document.createElement('div');
      wEl.className   = 'tracker-warning-label';
      wEl.textContent = w.label;
      warningsEl.appendChild(wEl);
    });
    card.appendChild(warningsEl);
  }

  return card;
}

// ═══════════════════════════════════════════════════════════════
// MODAL — ADD / EDIT
// ═══════════════════════════════════════════════════════════════

export function openModal(entry?: TrackerEntry): void {
  editingEntryId = entry?.id ?? null;
  modalWarnings  = entry ? [...entry.warnings.map(w => ({ ...w }))] : [];
  modalDirection = entry?.direction ?? 'countup';

  const titleEl = document.getElementById('tracker-modal-title')!;
  titleEl.textContent = entry ? 'Edit Custom Tracker' : 'Add Custom Tracker';

  // Populate fields
  (document.getElementById('tracker-name-input')  as HTMLInputElement).value =
    entry?.name     ?? '';
  (document.getElementById('tracker-cat-input')   as HTMLInputElement).value =
    entry?.category ?? '';
  (document.getElementById('tracker-min-input')   as HTMLInputElement).value =
    String(entry?.min ?? 0);
  (document.getElementById('tracker-max-input')   as HTMLInputElement).value =
    String(entry?.max ?? 10);
  (document.getElementById('tracker-start-input') as HTMLInputElement).value =
    String(entry?.current ?? entry?.min ?? 0);

  // Direction toggle
  syncDirectionToggle(modalDirection);

  // Warnings
  renderWarningRows();

  document.getElementById('modal-tracker')!.classList.add('open');
  setTimeout(() => (document.getElementById('tracker-name-input') as HTMLInputElement).focus(), 50);
}

function syncDirectionToggle(dir: TrackerDirection): void {
  modalDirection = dir;
  document.querySelectorAll<HTMLButtonElement>('.direction-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.dir === dir);
  });
}

function renderWarningRows(): void {
  const list = document.getElementById('warnings-list')!;
  list.innerHTML = '';

  modalWarnings.forEach((w, i) => {
    const row = document.createElement('div');
    row.className = 'warning-row';

    const valInput = document.createElement('input');
    valInput.type        = 'number';
    valInput.value       = String(w.value);
    valInput.placeholder = 'At value';
    valInput.addEventListener('input', () => {
      modalWarnings[i].value = parseInt(valInput.value) || 0;
    });

    const labelInput = document.createElement('input');
    labelInput.type        = 'text';
    labelInput.value       = w.label;
    labelInput.placeholder = 'Warning message…';
    labelInput.addEventListener('input', () => {
      modalWarnings[i].label = labelInput.value;
    });

    const delBtn = document.createElement('button');
    delBtn.className   = 'btn-icon danger';
    delBtn.textContent = '✕';
    delBtn.title       = 'Remove warning';
    delBtn.addEventListener('click', () => {
      modalWarnings.splice(i, 1);
      renderWarningRows();
    });

    row.appendChild(valInput);
    row.appendChild(labelInput);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

function addWarningRow(): void {
  modalWarnings.push({ value: 0, label: '' });
  renderWarningRows();
}

function saveModal(): void {
  const cid = store.activeCampaignId;
  if (!cid) return;

  const name    = (document.getElementById('tracker-name-input')  as HTMLInputElement).value.trim();
  const cat     = (document.getElementById('tracker-cat-input')   as HTMLInputElement).value.trim();
  const min     = parseInt((document.getElementById('tracker-min-input')   as HTMLInputElement).value);
  const max     = parseInt((document.getElementById('tracker-max-input')   as HTMLInputElement).value);
  const current = parseInt((document.getElementById('tracker-start-input') as HTMLInputElement).value);

  if (!name)          { showToast('Name is required');           return; }
  if (!cat)           { showToast('Category is required');       return; }
  if (isNaN(min) || isNaN(max)) { showToast('Min and max are required'); return; }
  if (max <= min)     { showToast('Max must be greater than min'); return; }
  if (isNaN(current) || current < min || current > max) {
    showToast(`Starting value must be between ${min} and ${max}`); return;
  }

  // Validate warnings
  const validWarnings = modalWarnings.filter(w => w.label.trim() !== '');
  const badWarning    = validWarnings.find(w => w.value < min || w.value > max);
  if (badWarning) {
    showToast(`Warning value ${badWarning.value} is outside range ${min}–${max}`);
    return;
  }

  const entry: TrackerEntry = {
    id:        editingEntryId ?? genId(),
    name,
    category:  cat,
    min,
    max,
    current,
    direction: modalDirection,
    warnings:  validWarnings,
  };

  store.upsertTrackerEntry(cid, entry);
  closeTrackerModal();
  renderTracker();
  showToast(editingEntryId ? `${name} updated` : `${name} added`);
}

function closeTrackerModal(): void {
  document.getElementById('modal-tracker')!.classList.remove('open');
  editingEntryId = null;
  modalWarnings  = [];
}

// ═══════════════════════════════════════════════════════════════
// DELETE
// ═══════════════════════════════════════════════════════════════

function deleteEntry(entry: TrackerEntry): void {
  if (!confirm(`Delete "${entry.name}"?`)) return;
  const cid = store.activeCampaignId;
  if (!cid) return;
  store.deleteTrackerEntry(cid, entry.id);
  renderTracker();
  showToast(`${entry.name} deleted`);
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

export function initTracker(): void {
  // Direction toggle buttons
  document.querySelectorAll<HTMLButtonElement>('.direction-option').forEach(btn => {
    btn.addEventListener('click', () => syncDirectionToggle(btn.dataset.dir as TrackerDirection));
  });

  // Add warning button
  document.getElementById('btn-add-warning')!
    .addEventListener('click', addWarningRow);

  // Modal save / cancel
  document.getElementById('btn-tracker-save')!
    .addEventListener('click', saveModal);

  document.getElementById('btn-tracker-cancel')!
    .addEventListener('click', closeTrackerModal);

  // Add tracker button
  document.getElementById('btn-add-tracker')!
    .addEventListener('click', () => openModal());

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTrackerModal();
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (document.getElementById('modal-tracker')?.classList.contains('open')) {
        saveModal();
      }
    }
  });
}
