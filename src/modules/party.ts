import { store } from '@/state/store';
import { showToast } from './app';
import type { PCCard, PCCustomField } from '@/types/index';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function genId(): string {
  return `pc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function defaultPC(name: string): PCCard {
  return {
    id:   genId(),
    name,
    ac:   '',
    saves: { str: '', dex: '', con: '', int: '', wis: '', cha: '' },
    passives: { perception: '', insight: '', investigation: '' },
    currency: { platinum: 0, gold: 0 },
    custom: [],
  };
}

// Deep-clone a PC so we always write a full object to the store
function clonePC(pc: PCCard): PCCard {
  return JSON.parse(JSON.stringify(pc));
}

// ═══════════════════════════════════════════════════════════════
// TALLY
// ═══════════════════════════════════════════════════════════════

function renderTally(): void {
  const cid  = store.activeCampaignId;
  const pcs  = cid ? store.getParty(cid).pcs : [];

  const totalPP = pcs.reduce((sum, p) => sum + (p.currency.platinum || 0), 0);
  const totalGP = pcs.reduce((sum, p) => sum + (p.currency.gold     || 0), 0);

  document.getElementById('tally-pp')!.textContent      = totalPP.toLocaleString();
  document.getElementById('tally-gp')!.textContent      = totalGP.toLocaleString();
  document.getElementById('tally-members')!.textContent = `${pcs.length} member${pcs.length !== 1 ? 's' : ''}`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════════

export function renderParty(): void {
  renderTally();

  const cid   = store.activeCampaignId;
  const grid  = document.getElementById('party-grid')!;
  grid.innerHTML = '';

  if (!cid) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Select or create a campaign to begin.</div>';
    return;
  }

  const pcs = store.getParty(cid).pcs;

  if (!pcs.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No party members yet — add a PC above.</div>';
    return;
  }

  pcs.forEach(pc => grid.appendChild(buildCard(pc)));
}

// ═══════════════════════════════════════════════════════════════
// CARD BUILDER
// ═══════════════════════════════════════════════════════════════

function buildCard(pc: PCCard): HTMLElement {
  const cid  = store.activeCampaignId!;

  // We work on a live clone; flush to store on any field change
  const draft = clonePC(pc);

  function flush(): void {
    store.updatePC(cid, clonePC(draft));
    renderTally();
  }

  const card = document.createElement('div');
  card.className = 'pc-card';

  // ── Header: name + delete ──
  const head = document.createElement('div');
  head.className = 'pc-card-head';

  const nameWrap = document.createElement('div');
  nameWrap.className = 'pc-name-wrap';

  // Name is an inline input styled to look like a heading
  const nameInput = document.createElement('input');
  nameInput.type        = 'text';
  nameInput.className   = 'pc-field-value pc-name';
  nameInput.value       = draft.name;
  nameInput.placeholder = 'Character name';
  nameInput.style.cssText = 'font-family:"Cinzel",serif;font-size:14px;font-weight:600;color:var(--gold-pale);letter-spacing:0.04em;text-align:left;';
  nameInput.addEventListener('change', () => { draft.name = nameInput.value.trim() || 'Unnamed'; flush(); });

  nameWrap.appendChild(nameInput);

  const headActions = document.createElement('div');
  headActions.className = 'pc-card-head-actions';

  const delBtn = document.createElement('button');
  delBtn.className   = 'btn-icon danger';
  delBtn.textContent = '✕';
  delBtn.title       = 'Remove PC';
  delBtn.addEventListener('click', () => {
    if (!confirm(`Remove ${draft.name} from the party?`)) return;
    store.deletePC(cid, draft.id);
    renderParty();
  });

  headActions.appendChild(delBtn);
  head.appendChild(nameWrap);
  head.appendChild(headActions);

  // ── Body ──
  const body = document.createElement('div');
  body.className = 'pc-card-body';

  // AC
  body.appendChild(makeSectionLabel('Combat'));
  body.appendChild(makeFieldRow('AC', draft.ac, v => { draft.ac = v; flush(); }));

  // Saves
  body.appendChild(makeSectionLabel('Saving Throws'));
  const savesGrid = document.createElement('div');
  savesGrid.className = 'pc-saves-grid';

  const saveKeys: Array<keyof PCCard['saves']> = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  saveKeys.forEach(key => {
    const cell = document.createElement('div');
    cell.className = 'pc-save-cell';

    const abbr = document.createElement('div');
    abbr.className   = 'pc-save-abbr';
    abbr.textContent = key.toUpperCase();

    const val = document.createElement('input');
    val.type        = 'text';
    val.className   = 'pc-save-val';
    val.value       = draft.saves[key];
    val.placeholder = '—';
    val.addEventListener('change', () => { draft.saves[key] = val.value.trim(); flush(); });

    cell.appendChild(abbr);
    cell.appendChild(val);
    savesGrid.appendChild(cell);
  });
  body.appendChild(savesGrid);

  // Passives
  body.appendChild(makeSectionLabel('Passives'));
  body.appendChild(makeFieldRow('Perception',    draft.passives.perception,    v => { draft.passives.perception    = v; flush(); }));
  body.appendChild(makeFieldRow('Insight',       draft.passives.insight,       v => { draft.passives.insight       = v; flush(); }));
  body.appendChild(makeFieldRow('Investigation', draft.passives.investigation, v => { draft.passives.investigation = v; flush(); }));

  // Currency
  body.appendChild(makeSectionLabel('Currency'));
  body.appendChild(makeCurrencyRow('Platinum', draft.currency.platinum, v => { draft.currency.platinum = v; flush(); }));
  body.appendChild(makeCurrencyRow('Gold',     draft.currency.gold,     v => { draft.currency.gold     = v; flush(); }));

  // Custom fields
  const customSection = makeSectionLabel('Custom');
  body.appendChild(customSection);

  const customList = document.createElement('div');
  customList.className = 'pc-custom-list';
  customList.id        = `custom-list-${draft.id}`;

  function rebuildCustomList(): void {
    customList.innerHTML = '';
    draft.custom.forEach((field, i) => {
      customList.appendChild(makeCustomRow(field, i, () => {
        draft.custom.splice(i, 1);
        flush();
        rebuildCustomList();
      }, () => flush()));
    });
  }
  rebuildCustomList();
  body.appendChild(customList);

  // Add custom field button
  const addFieldBtn = document.createElement('button');
  addFieldBtn.className   = 'pc-add-field';
  addFieldBtn.textContent = '+ Add Field';
  addFieldBtn.addEventListener('click', () => {
    draft.custom.push({ id: genId(), name: 'Field', value: '' });
    flush();
    rebuildCustomList();
    // Focus the new name input
    setTimeout(() => {
      const inputs = customList.querySelectorAll<HTMLInputElement>('.pc-custom-name');
      inputs[inputs.length - 1]?.focus();
      inputs[inputs.length - 1]?.select();
    }, 30);
  });
  body.appendChild(addFieldBtn);

  card.appendChild(head);
  card.appendChild(body);
  return card;
}

// ═══════════════════════════════════════════════════════════════
// FIELD BUILDERS
// ═══════════════════════════════════════════════════════════════

function makeSectionLabel(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className   = 'pc-section-label';
  el.textContent = text;
  return el;
}

function makeFieldRow(
  label: string,
  value: string,
  onChange: (v: string) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pc-field-row';

  const labelEl = document.createElement('div');
  labelEl.className   = 'pc-field-label';
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.type        = 'text';
  input.className   = 'pc-field-value';
  input.value       = value;
  input.placeholder = '—';
  input.addEventListener('change', () => onChange(input.value.trim()));

  row.appendChild(labelEl);
  row.appendChild(input);
  return row;
}

function makeCurrencyRow(
  label: string,
  value: number,
  onChange: (v: number) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pc-field-row';

  const labelEl = document.createElement('div');
  labelEl.className   = 'pc-field-label';
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.type        = 'number';
  input.className   = 'pc-field-value currency';
  input.value       = String(value);
  input.min         = '0';
  input.placeholder = '0';
  input.addEventListener('change', () => {
    const n = parseInt(input.value);
    onChange(isNaN(n) || n < 0 ? 0 : n);
    renderTally();
  });

  row.appendChild(labelEl);
  row.appendChild(input);
  return row;
}

function makeCustomRow(
  field: PCCustomField,
  _index: number,
  onDelete: () => void,
  onFlush: () => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pc-custom-row';

  const nameInput = document.createElement('input');
  nameInput.type        = 'text';
  nameInput.className   = 'pc-custom-name';
  nameInput.value       = field.name;
  nameInput.placeholder = 'Field name';
  nameInput.addEventListener('change', () => { field.name = nameInput.value.trim() || 'Field'; onFlush(); });

  const valueInput = document.createElement('input');
  valueInput.type        = 'text';
  valueInput.className   = 'pc-custom-value';
  valueInput.value       = field.value;
  valueInput.placeholder = '—';
  valueInput.addEventListener('change', () => { field.value = valueInput.value; onFlush(); });

  const delBtn = document.createElement('button');
  delBtn.className   = 'pc-custom-del';
  delBtn.textContent = '✕';
  delBtn.title       = 'Remove field';
  delBtn.addEventListener('click', onDelete);

  row.appendChild(nameInput);
  row.appendChild(valueInput);
  row.appendChild(delBtn);
  return row;
}

// ═══════════════════════════════════════════════════════════════
// ADD PC FLOW
// ═══════════════════════════════════════════════════════════════

export function openAddPCModal(): void {
  const input = document.getElementById('new-pc-name-input') as HTMLInputElement;
  input.value = '';
  document.getElementById('modal-add-pc')!.classList.add('open');
  setTimeout(() => input.focus(), 50);
}

export function confirmAddPC(): void {
  const input = document.getElementById('new-pc-name-input') as HTMLInputElement;
  const name  = input.value.trim();
  if (!name) { showToast('Name required'); return; }

  const cid = store.activeCampaignId;
  if (!cid) { showToast('Select a campaign first'); return; }

  store.addPC(cid, defaultPC(name));
  document.getElementById('modal-add-pc')!.classList.remove('open');
  renderParty();
  showToast(`${name} added`);
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

export function initParty(): void {
  document.getElementById('btn-add-pc')!
    .addEventListener('click', openAddPCModal);

  document.getElementById('btn-confirm-add-pc')!
    .addEventListener('click', confirmAddPC);

  document.getElementById('btn-cancel-add-pc')!
    .addEventListener('click', () => {
      document.getElementById('modal-add-pc')!.classList.remove('open');
    });

  // Enter key in name input confirms
  document.getElementById('new-pc-name-input')!
    .addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmAddPC();
    });
}
