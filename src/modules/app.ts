import { store } from '@/state/store';
import type { AppState, Campaign, TabId } from '@/types/index';

// Lazy imports per module to keep boot fast
import {
  renderFavor, renderPlayerSelect, switchPlayer,
  savePlayer, createPlayer, addNPC,
} from './favor';
import {
  renderConvoSliders, resetConvo, initConvoPCButtons,
  syncPCCountButtons, initConvoTitle,
} from './convo';
import {
  initTree, renderHouseSelect, switchHouse,
  importHouseFile, resetTreeView,
} from './tree';
import {
  renderChronicle, initChronicle, importTimelineFile,
  exportTimelineFile, scrollToNow,
} from './chronicle';
import { renderTracker, initTracker } from './tracker';
import { renderParty, initParty } from './party';

// ═══════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string): void {
  const t = document.getElementById('toast')!;
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ═══════════════════════════════════════════════════════════════
// MODAL HELPERS
// ═══════════════════════════════════════════════════════════════

export function openModal(id: string): void {
  document.getElementById(id)?.classList.add('open');
}

export function closeModal(id: string): void {
  document.getElementById(id)?.classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════════

function switchTab(id: TabId): void {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${id}`)?.classList.add('active');
  document.getElementById(`panel-${id}`)?.classList.add('active');
  store.setActiveTab(id);

  // Trigger renders that need DOM to be visible first
  if (id === 'tree')      setTimeout(() => initTree(), 10);
  if (id === 'chronicle') setTimeout(() => renderChronicle(), 10);
  if (id === 'tracker')   renderTracker();
  if (id === 'party')     renderParty();
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN
// ═══════════════════════════════════════════════════════════════

function renderCampaignSelect(): void {
  const sel = document.getElementById('campaign-select') as HTMLSelectElement;
  const cid = store.activeCampaignId;

  sel.innerHTML = store.campaigns.length
    ? store.campaigns.map(c =>
        `<option value="${c.id}"${c.id === cid ? ' selected' : ''}>${c.label}</option>`
      ).join('')
    : '<option value="">No campaigns</option>';
}

function switchCampaign(id: string): void {
  if (!id) return;
  store.setActiveCampaign(id);
  renderCampaignSelect();
  renderPlayerSelect();
  renderHouseSelect();
  renderFavor();

  const activeTab = store.activeTab;
  if (activeTab === 'tree')      initTree();
  if (activeTab === 'chronicle') renderChronicle();
  if (activeTab === 'tracker')   renderTracker();
  if (activeTab === 'party')     renderParty();
}

function createCampaign(): void {
  const labelEl = document.getElementById('new-campaign-label') as HTMLInputElement;
  const idEl    = document.getElementById('new-campaign-id')    as HTMLInputElement;
  const label   = labelEl.value.trim();
  let id        = idEl.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  if (!label) { showToast('Name required'); return; }
  if (!id)    id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  if (store.campaigns.find(c => c.id === id)) { showToast('Campaign already exists'); return; }

  const campaign: Campaign = { id, label };
  store.addCampaign(campaign);
  closeModal('modal-add-campaign');
  labelEl.value = '';
  idEl.value    = '';
  renderCampaignSelect();
  switchCampaign(id);
  showToast(`${label} created`);
}

// ═══════════════════════════════════════════════════════════════
// EXPORT / IMPORT
// ═══════════════════════════════════════════════════════════════

async function exportBackup(): Promise<void> {
  const content = store.toJSON();
  const result  = await window.toolbox.exportFile('toolbox_backup.json', content);
  if (result.ok) showToast('Backup exported');
}

async function importBackup(): Promise<void> {
  const files = await window.toolbox.importFile([{ name: 'JSON', extensions: ['json'] }]);
  if (!files || !files.length) return;
  try {
    const imported = JSON.parse(files[0].content) as AppState;
    if (!imported.campaigns || !imported.campaignData) {
      showToast('File does not look like a toolbox backup');
      return;
    }
    store.mergeImport(imported);
    boot();
    showToast('Backup imported');
  } catch {
    showToast('Invalid backup file');
  }
}

// ═══════════════════════════════════════════════════════════════
// MIGRATION FLOW
// ═══════════════════════════════════════════════════════════════

interface MigrationData {
  campaigns: { campaigns: Campaign[] } | null;
  schema:    unknown | null;
  players:   Array<{ player: string; scores: Record<string, number> }>;
  house:     unknown | null;
  timeline:  unknown | null;
}

const migData: MigrationData = {
  campaigns: null, schema: null, players: [], house: null, timeline: null,
};

function setMigStatus(type: string, label: string): void {
  const btn    = document.getElementById(`mig-btn-${type}`) as HTMLButtonElement | null;
  const status = document.getElementById(`mig-status-${type}`) as HTMLElement | null;
  if (btn)    { btn.classList.add('done'); btn.textContent = '✓ Loaded'; btn.disabled = true; }
  if (status) { status.style.display = ''; status.textContent = label; status.classList.add('done'); }
}

async function migLoadBackup(): Promise<void> {
  const files = await window.toolbox.importFile([{ name: 'JSON', extensions: ['json'] }]);
  if (!files || !files.length) return;
  try {
    const imported = JSON.parse(files[0].content) as AppState;
    if (!imported.campaigns || !imported.campaignData) {
      showToast('File does not look like a toolbox backup'); return;
    }
    store.replaceState(imported);
    setMigStatus('backup', 'Loaded');
    setTimeout(() => {
      document.getElementById('migration-overlay')!.classList.add('hidden');
      boot();
    }, 500);
  } catch {
    showToast('Invalid backup file');
  }
}

async function migLoadFile(type: string): Promise<void> {
  const isJS      = type === 'timeline';
  const isMulti   = type === 'players';
  const filters   = isJS
    ? [{ name: 'JavaScript', extensions: ['js'] }]
    : [{ name: 'JSON',       extensions: ['json'] }];

  const files = await window.toolbox.importFile(filters);
  if (!files || !files.length) return;

  try {
    if (type === 'campaigns') {
      migData.campaigns = JSON.parse(files[0].content);
      setMigStatus('campaigns', 'Loaded');
    } else if (type === 'schema') {
      migData.schema = JSON.parse(files[0].content);
      setMigStatus('schema', 'Loaded');
    } else if (type === 'players') {
      migData.players = files.map(f => JSON.parse(f.content));
      setMigStatus('players', `${files.length} file${files.length > 1 ? 's' : ''}`);
    } else if (type === 'house') {
      migData.house = JSON.parse(files[0].content);
      setMigStatus('house', 'Loaded');
    } else if (type === 'timeline') {
      let raw = files[0].content;
      raw = raw.replace(/^\s*const\s+TIMELINE_DATA\s*=\s*/, '').replace(/;\s*$/, '');
      migData.timeline = JSON.parse(raw);
      setMigStatus('timeline', 'Loaded');
    }
  } catch (err) {
    showToast(`Error parsing ${type}: ${(err as Error).message}`);
  }
  void isMulti; // suppress unused warning
}

function migStartFresh(): void {
  const id    = 'my_campaign';
  const label = 'My Campaign';
  store.addCampaign({ id, label });
  store.setActiveCampaign(id);
  document.getElementById('migration-overlay')!.classList.add('hidden');
  boot();
}

function migFinish(): void {
  // Build campaigns list
  const campaigns: Campaign[] = migData.campaigns?.campaigns ?? [{ id: 'velis_arcanum', label: 'Velis Arcanum — Intermission' }];
  campaigns.forEach(c => store.addCampaign(c));

  const firstId = campaigns[0]?.id;
  if (!firstId) { migStartFresh(); return; }

  // Populate first campaign
  if (migData.schema) {
    store.getCampaignData(firstId).schema = migData.schema as typeof store.getCampaignData extends (...args: unknown[]) => infer R ? R extends { schema: infer S } ? S : never : never;
  }

  migData.players.forEach(pd => {
    const key = pd.player.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    store.upsertPlayer(firstId, key, pd);
  });

  if (migData.house) {
    const hd = migData.house as { house?: string };
    const key = (hd.house ?? 'house').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    store.upsertHouse(firstId, key, migData.house as Parameters<typeof store.upsertHouse>[2]);
    store.setActiveHouse(key);
  }

  if (migData.timeline) {
    store.setTimeline(firstId, migData.timeline as Parameters<typeof store.setTimeline>[1]);
  }

  store.setActiveCampaign(firstId);
  document.getElementById('migration-overlay')!.classList.add('hidden');
  boot();
}

// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════

function boot(): void {
  renderCampaignSelect();

  if (store.activeCampaignId) {
    renderPlayerSelect();
    renderHouseSelect();
    renderFavor();
  }

  // Restore active tab
  const tab = store.activeTab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  document.getElementById(`panel-${tab}`)?.classList.add('active');

  // Convo
  initConvoTitle();
  syncPCCountButtons();
  renderConvoSliders();

  // Tracker
  initTracker();
  if (tab === 'tracker') renderTracker();

  // Party
  initParty();
  if (tab === 'party') renderParty();

  // Tree / Chronicle if on those tabs
  if (tab === 'tree')      setTimeout(() => initTree(), 10);
  if (tab === 'chronicle') setTimeout(() => renderChronicle(), 10);
}

// ═══════════════════════════════════════════════════════════════
// WIRE UP ALL EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  // Load persisted data
  const hasData = await store.load();

  // Migration overlay
  if (hasData && store.campaigns.length > 0) {
    document.getElementById('migration-overlay')!.classList.add('hidden');
    boot();
  }
  // else: migration overlay stays visible (default in HTML)

  // ── Tab buttons ──
  document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab as TabId));
  });

  // ── Campaign ──
  document.getElementById('campaign-select')!
    .addEventListener('change', e => switchCampaign((e.target as HTMLSelectElement).value));

  document.getElementById('btn-add-campaign')!
    .addEventListener('click', () => openModal('modal-add-campaign'));

  document.getElementById('btn-create-campaign')!
    .addEventListener('click', createCampaign);

  // ── Favor ──
  document.getElementById('player-select')!
    .addEventListener('change', e => switchPlayer((e.target as HTMLSelectElement).value));

  document.getElementById('btn-save-player')!
    .addEventListener('click', savePlayer);

  document.getElementById('btn-add-player')!
    .addEventListener('click', () => openModal('modal-add-player'));

  document.getElementById('btn-create-player')!
    .addEventListener('click', () => { createPlayer(); closeModal('modal-add-player'); });

  document.getElementById('btn-add-npc')!
    .addEventListener('click', addNPC);

  // ── Convo ──
  initConvoPCButtons();
  document.getElementById('btn-reset-convo')!
    .addEventListener('click', resetConvo);

  // ── Tree ──
  document.getElementById('house-select')!
    .addEventListener('change', e => switchHouse((e.target as HTMLSelectElement).value));

  document.getElementById('btn-import-house')!
    .addEventListener('click', importHouseFile);

  document.getElementById('btn-reset-tree')!
    .addEventListener('click', resetTreeView);

  // ── Chronicle ──
  initChronicle();
  document.getElementById('btn-open-editor')!
    .addEventListener('click', () => window.toolbox.openTimelineEditor());

  // Listen for saves made in the editor window
  const onTimelineUpdated = () => renderChronicle();
  window.toolbox.onTimelineUpdated(onTimelineUpdated);

  document.getElementById('btn-import-timeline')!
    .addEventListener('click', importTimelineFile);
  window.toolbox.onTimelineUpdated(onTimelineUpdated);

  document.getElementById('btn-export-timeline')!
    .addEventListener('click', exportTimelineFile);

  document.getElementById('btn-jump-now')!
    .addEventListener('click', scrollToNow);

  // ── Export / Import backup ──
  document.getElementById('btn-export-backup')!
    .addEventListener('click', exportBackup);

  document.getElementById('btn-import-backup')!
    .addEventListener('click', importBackup);

  // ── Modal close: data-close attribute pattern ──
  document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close!));
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      savePlayer();
    }
  });

  // ── Migration buttons ──
  document.getElementById('mig-btn-backup')!
    .addEventListener('click', migLoadBackup);

  ['campaigns', 'schema', 'players', 'house', 'timeline'].forEach(type => {
    document.getElementById(`mig-btn-${type}`)!
      .addEventListener('click', () => migLoadFile(type));
  });

  document.getElementById('mig-btn-fresh')!
    .addEventListener('click', migStartFresh);

  document.getElementById('mig-btn-launch')!
    .addEventListener('click', migFinish);

  // ── Save on window close (belt-and-suspenders) ──
  window.addEventListener('beforeunload', () => {
    store.forceSave();
  });
}

main().catch(console.error);
