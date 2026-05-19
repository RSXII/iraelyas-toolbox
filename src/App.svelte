<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { TabId, Campaign, AppState, Schema, HouseData, TimelineData } from '@/types/index';
  import Toast from '@/components/ui/Toast.svelte';
  import ConvoTab from '@/components/tabs/ConvoTab.svelte';
  import PartyTab from '@/components/tabs/PartyTab.svelte';
  import TrackerTab from '@/components/tabs/TrackerTab.svelte';
  import FavorTab from '@/components/tabs/FavorTab.svelte';
  import ChronicleTab from '@/components/tabs/ChronicleTab.svelte';
  import TreeTab from '@/components/tabs/TreeTab.svelte';

  // ─── App state ────────────────────────────────────────────────
  let showMigrationOverlay = $state(true);
  let activeTab = $state<TabId>('favor');

  // ─── Campaign modals ──────────────────────────────────────────
  let showAddCampaign = $state(false);
  let showRenameCampaign = $state(false);
  let newCampaignLabel = $state('');
  let newCampaignId = $state('');
  let renameCampaignLabel = $state('');

  // ─── Migration status ─────────────────────────────────────────
  interface MigStatusItem { text: string; done: boolean; optional: boolean; }
  let migStatuses = $state<Record<string, MigStatusItem>>({
    backup:    { text: '',          done: false, optional: false },
    campaigns: { text: 'Pending',   done: false, optional: false },
    schema:    { text: 'Optional',  done: false, optional: true  },
    players:   { text: 'Optional',  done: false, optional: true  },
    house:     { text: 'Optional',  done: false, optional: true  },
    timeline:  { text: 'Optional',  done: false, optional: true  },
  });

  // ─── Migration data (not reactive — only used in functions) ───
  let migData = {
    campaigns: null as { campaigns: Campaign[] } | null,
    schema:    null as Schema | null,
    players:   [] as Array<{ player: string; scores: Record<string, number> }>,
    house:     null as unknown,
    timeline:  null as unknown,
  };
  let freshStart = false;

  // ─── Danger overlay ───────────────────────────────────────────
  let showDanger = $state(false);
  let dangerStep = $state<1 | 2 | 3>(1);

  // ─── Tab switching ────────────────────────────────────────────
  function switchTab(id: TabId): void {
    activeTab = id;
    store.setActiveTab(id);
  }

  // ─── Campaign switching ───────────────────────────────────────
  function switchCampaign(id: string): void {
    if (!id) return;
    store.setActiveCampaign(id);
  }

  // ─── Boot ─────────────────────────────────────────────────────
  function boot(): void {
    showMigrationOverlay = false;
    activeTab = store.activeTab;
  }

  // ─── Campaign CRUD ────────────────────────────────────────────
  function createCampaign(): void {
    const label = newCampaignLabel.trim();
    let id = newCampaignId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    if (!label) { showToast('Name required'); return; }
    if (!id) id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (store.campaigns.find((c) => c.id === id)) { showToast('Campaign already exists'); return; }
    store.addCampaign({ id, label });
    newCampaignLabel = '';
    newCampaignId = '';
    showAddCampaign = false;
    switchCampaign(id);
    showToast(`${label} created`);
    if (freshStart) {
      freshStart = false;
      showMigrationOverlay = false;
    }
  }

  function openRenameCampaign(): void {
    const cid = store.activeCampaignId;
    if (!cid) { showToast('No campaign selected'); return; }
    const current = store.campaigns.find((c) => c.id === cid);
    if (!current) return;
    renameCampaignLabel = current.label;
    showRenameCampaign = true;
  }

  function confirmRenameCampaign(): void {
    const cid = store.activeCampaignId;
    const label = renameCampaignLabel.trim();
    if (!label) { showToast('Name required'); return; }
    if (!cid) { showToast('No campaign selected'); return; }
    store.renameCampaign(cid, label);
    showRenameCampaign = false;
    showToast(`Renamed to ${label}`);
  }

  // ─── Backup ───────────────────────────────────────────────────
  async function exportBackup(): Promise<void> {
    const result = await window.toolbox.exportFile('toolbox_backup.json', store.toJSON());
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

  // ─── Migration ────────────────────────────────────────────────
  function setMigStatus(type: string, text: string): void {
    if (type in migStatuses) {
      migStatuses[type].text = text;
      migStatuses[type].done = true;
    }
  }

  async function migLoadBackup(): Promise<void> {
    const files = await window.toolbox.importFile([{ name: 'JSON', extensions: ['json'] }]);
    if (!files || !files.length) return;
    try {
      const imported = JSON.parse(files[0].content) as AppState;
      if (!imported.campaigns || !imported.campaignData) {
        showToast('File does not look like a toolbox backup');
        return;
      }
      store.replaceState(imported);
      setMigStatus('backup', 'Loaded');
      setTimeout(boot, 500);
    } catch {
      showToast('Invalid backup file');
    }
  }

  async function migLoadFile(type: string): Promise<void> {
    const isJS = type === 'timeline';
    const filters = isJS
      ? [{ name: 'JavaScript', extensions: ['js'] }]
      : [{ name: 'JSON', extensions: ['json'] }];
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
        migData.players = files.map((f) => JSON.parse(f.content));
        setMigStatus('players', `${files.length} file${files.length > 1 ? 's' : ''}`);
      } else if (type === 'house') {
        migData.house = JSON.parse(files[0].content);
        setMigStatus('house', 'Loaded');
      } else if (type === 'timeline') {
        let raw = files[0].content;
        raw = raw
          .replace(/^\s*const\s+TIMELINE_DATA\s*=\s*/, '')
          .replace(/;\s*$/, '');
        migData.timeline = JSON.parse(raw);
        setMigStatus('timeline', 'Loaded');
      }
    } catch (err) {
      showToast(`Error parsing ${type}: ${(err as Error).message}`);
    }
  }

  function migStartFresh(): void {
    newCampaignLabel = '';
    newCampaignId = '';
    freshStart = true;
    showAddCampaign = true;
  }

  function migFinish(): void {
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
      { id: 'new_campaign', label: 'New Campaign' },
    ];
    campaigns.forEach((c) => store.addCampaign(c));
    const firstId = campaigns[0]?.id;
    if (!firstId) { migStartFresh(); return; }
    if (migData.schema) {
      store.getCampaignData(firstId).schema = migData.schema;
    }
    migData.players.forEach((pd) => {
      const key = pd.player
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      store.upsertPlayer(firstId, key, pd);
    });
    if (migData.house) {
      const hd = migData.house as { house?: string };
      const key = (hd.house ?? 'house').toLowerCase().replace(/[^a-z0-9]+/g, '_');
      store.upsertHouse(firstId, key, migData.house as HouseData);
      store.setActiveHouse(key);
    }
    if (migData.timeline) {
      store.setTimeline(firstId, migData.timeline as TimelineData);
    }
    store.setActiveCampaign(firstId);
    boot();
  }

  // ─── Danger zone ──────────────────────────────────────────────
  function openDangerOverlay(): void {
    dangerStep = 1;
    showDanger = true;
  }

  function closeDangerOverlay(): void {
    showDanger = false;
    setTimeout(() => { dangerStep = 1; }, 300);
  }

  async function dangerDownloadAndContinue(): Promise<void> {
    const result = await window.toolbox.exportFile('toolbox_backup.json', store.toJSON());
    if (result.canceled || !result.ok) {
      showToast('Backup not saved — download your backup to continue');
      return;
    }
    dangerStep = 3;
  }

  async function dangerClearAll(): Promise<void> {
    const emptyState: AppState = {
      version: 1,
      campaigns: [],
      campaignData: {},
      ui: {
        activeCampaign: '',
        activePlayer: '',
        activeHouse: '',
        activeTab: 'favor',
        convo: {
          title: 'Generic Conversation',
          pcCount: 4,
          pcs: Array.from({ length: 6 }, (_, i) => ({ name: `PC ${i + 1}`, score: 5 })),
        },
      },
    };
    await window.toolbox.saveData(emptyState);
    store.replaceState(emptyState);
    showDanger = false;
    showMigrationOverlay = true;
    showToast('All data cleared');
  }

  // ─── Mount ────────────────────────────────────────────────────
  onMount(async () => {
    const hasData = await store.load();
    if (hasData && store.campaigns.length > 0) {
      boot();
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (showDanger) {
          if (dangerStep === 1) closeDangerOverlay();
          return;
        }
        showAddCampaign = false;
        showRenameCampaign = false;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        store.forceSave();
      }
    });

    window.addEventListener('beforeunload', () => store.forceSave());
  });
</script>

<!-- ═══════════════════════════════════════════════════════════════
     MIGRATION OVERLAY
═══════════════════════════════════════════════════════════════ -->
{#if showMigrationOverlay}
<div id="migration-overlay">
  <div class="migration-box">
    <h2>Iraelya's 5e Toolbox</h2>
    <p class="migration-subtitle">
      Welcome — restore your data or set up from scratch.
    </p>

    <!-- Primary: restore from backup -->
    <div class="mig-backup-card">
      <div class="mig-backup-icon">🗂</div>
      <div class="mig-backup-info">
        <div class="mig-backup-title">Restore from Backup</div>
        <div class="mig-backup-desc">
          Load a <code>toolbox_backup.json</code> — restores everything in
          one step.
        </div>
      </div>
      <button
        class="mig-file-btn"
        class:done={migStatuses.backup.done}
        disabled={migStatuses.backup.done}
        onclick={migLoadBackup}
      >{migStatuses.backup.done ? '✓ Loaded' : 'Load backup'}</button>
      {#if migStatuses.backup.done}
        <span class="mig-step-status done">{migStatuses.backup.text}</span>
      {/if}
    </div>

    <!-- Divider -->
    <div class="mig-or-divider">
      <div class="mig-or-line"></div>
      <span class="mig-or-text">or migrate individual files</span>
      <div class="mig-or-line"></div>
    </div>

    <!-- Individual file steps -->
    <div class="migration-step">
      <div class="mig-step-num">1</div>
      <div class="mig-step-info">
        <div class="mig-step-title">Campaigns list</div>
        <div class="mig-step-desc">campaigns.json — your campaign index</div>
      </div>
      <button
        class="mig-file-btn"
        class:done={migStatuses.campaigns.done}
        disabled={migStatuses.campaigns.done}
        onclick={() => migLoadFile('campaigns')}
      >{migStatuses.campaigns.done ? '✓ Loaded' : 'Load file'}</button>
      <span
        class="mig-step-status"
        class:done={migStatuses.campaigns.done}
      >{migStatuses.campaigns.text}</span>
    </div>

    <div class="migration-step">
      <div class="mig-step-num">2</div>
      <div class="mig-step-info">
        <div class="mig-step-title">NPC Schema</div>
        <div class="mig-step-desc">schema.json — NPC list for the campaign</div>
      </div>
      <button
        class="mig-file-btn"
        class:done={migStatuses.schema.done}
        disabled={migStatuses.schema.done}
        onclick={() => migLoadFile('schema')}
      >{migStatuses.schema.done ? '✓ Loaded' : 'Load file'}</button>
      <span
        class="mig-step-status"
        class:optional={migStatuses.schema.optional}
        class:done={migStatuses.schema.done}
      >{migStatuses.schema.text}</span>
    </div>

    <div class="migration-step">
      <div class="mig-step-num">3</div>
      <div class="mig-step-info">
        <div class="mig-step-title">Player files</div>
        <div class="mig-step-desc">
          terry.json, ophelia.json, neromi.json — select all at once
        </div>
      </div>
      <button
        class="mig-file-btn"
        class:done={migStatuses.players.done}
        disabled={migStatuses.players.done}
        onclick={() => migLoadFile('players')}
      >{migStatuses.players.done ? '✓ Loaded' : 'Load files'}</button>
      <span
        class="mig-step-status"
        class:optional={migStatuses.players.optional}
        class:done={migStatuses.players.done}
      >{migStatuses.players.text}</span>
    </div>

    <div class="migration-step">
      <div class="mig-step-num">4</div>
      <div class="mig-step-info">
        <div class="mig-step-title">House / Family Tree</div>
        <div class="mig-step-desc">house_aigner.json — genealogy data</div>
      </div>
      <button
        class="mig-file-btn"
        class:done={migStatuses.house.done}
        disabled={migStatuses.house.done}
        onclick={() => migLoadFile('house')}
      >{migStatuses.house.done ? '✓ Loaded' : 'Load file'}</button>
      <span
        class="mig-step-status"
        class:optional={migStatuses.house.optional}
        class:done={migStatuses.house.done}
      >{migStatuses.house.text}</span>
    </div>

    <div class="migration-step">
      <div class="mig-step-num">5</div>
      <div class="mig-step-info">
        <div class="mig-step-title">Timeline data</div>
        <div class="mig-step-desc">timeline-data.js — chronicle events</div>
      </div>
      <button
        class="mig-file-btn"
        class:done={migStatuses.timeline.done}
        disabled={migStatuses.timeline.done}
        onclick={() => migLoadFile('timeline')}
      >{migStatuses.timeline.done ? '✓ Loaded' : 'Load file'}</button>
      <span
        class="mig-step-status"
        class:optional={migStatuses.timeline.optional}
        class:done={migStatuses.timeline.done}
      >{migStatuses.timeline.text}</span>
    </div>

    <div class="migration-footer">
      <span class="migration-note">You can import more data later from each tool.</span>
      <div style="display: flex; gap: 8px">
        <button class="btn" onclick={migStartFresh}>Start Fresh</button>
        <button class="btn btn-gold" onclick={migFinish}>Launch Toolbox</button>
      </div>
    </div>
  </div>
</div>
{/if}

<!-- ═══════════════════════════════════════════════════════════════
     TOP BAR
═══════════════════════════════════════════════════════════════ -->
<div class="topbar">
  <div class="topbar-brand">
    <span class="topbar-brand-name">Iraelya's 5e Toolbox</span>
    <span class="topbar-brand-sub">Dungeon Master's Dashboard</span>
  </div>
  <div class="topbar-divider"></div>
  <div class="topbar-campaign">
    <span class="topbar-label">Campaign</span>
    <select
      class="topbar-select"
      onchange={(e) => switchCampaign((e.target as HTMLSelectElement).value)}
    >
      {#if store.campaigns.length}
        {#each store.campaigns as c (c.id)}
          <option value={c.id} selected={c.id === store.activeCampaignId}>{c.label}</option>
        {/each}
      {:else}
        <option value="">No campaigns</option>
      {/if}
    </select>
    <button class="btn btn-sm" onclick={openRenameCampaign}>✎</button>
    <button class="btn btn-sm" onclick={() => (showAddCampaign = true)}>+ Campaign</button>
  </div>
  <div class="topbar-actions">
    <button class="btn btn-sm" onclick={exportBackup}>Export Backup</button>
    <button class="btn btn-sm btn-gold" onclick={importBackup}>Import Backup</button>
    <button class="btn btn-sm btn-danger-subtle" onclick={openDangerOverlay}>⚠ Danger Zone</button>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     TAB NAV
═══════════════════════════════════════════════════════════════ -->
<div class="tab-nav">
  <button
    class="tab-btn"
    class:active={activeTab === 'favor'}
    id="tab-favor"
    onclick={() => switchTab('favor')}
  >
    <span class="tab-icon">⚖</span> Favor Tracker
  </button>
  <button
    class="tab-btn"
    class:active={activeTab === 'convo'}
    id="tab-convo"
    onclick={() => switchTab('convo')}
  >
    <span class="tab-icon">💬</span> Conversation
  </button>
  <button
    class="tab-btn"
    class:active={activeTab === 'tree'}
    id="tab-tree"
    onclick={() => switchTab('tree')}
  >
    <span class="tab-icon">🌳</span> Family Tree
  </button>
  <button
    class="tab-btn"
    class:active={activeTab === 'chronicle'}
    id="tab-chronicle"
    onclick={() => switchTab('chronicle')}
  >
    <span class="tab-icon">📜</span> Chronicle
  </button>
  <button
    class="tab-btn"
    class:active={activeTab === 'tracker'}
    id="tab-tracker"
    onclick={() => switchTab('tracker')}
  >
    <span class="tab-icon">🎯</span> Custom Trackers
  </button>
  <button
    class="tab-btn"
    class:active={activeTab === 'party'}
    id="tab-party"
    onclick={() => switchTab('party')}
  >
    <span class="tab-icon">⚔</span> Party
  </button>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     CONTENT AREA
═══════════════════════════════════════════════════════════════ -->
<div class="content-area">

  <!-- ── FAVOR TRACKER ── -->
  <FavorTab active={activeTab === 'favor'} />

  <!-- ── CONVERSATION TRACKER ── -->
  <ConvoTab active={activeTab === 'convo'} />

  <!-- ── FAMILY TREE ── -->
  <TreeTab active={activeTab === 'tree'} />

  <!-- ── CHRONICLE ── -->
  <ChronicleTab active={activeTab === 'chronicle'} />

  <!-- ── TRACKER ── -->
  <TrackerTab active={activeTab === 'tracker'} />

  <!-- ── PARTY QUICK VIEW ── -->
  <PartyTab active={activeTab === 'party'} />

</div>
<!-- /content-area -->

<!-- ═══════════════════════════════════════════════════════════════
     MODALS
═══════════════════════════════════════════════════════════════ -->

<!-- Add Campaign -->
<div
  class="modal-overlay"
  class:open={showAddCampaign}
  role="presentation"
  onclick={() => (showAddCampaign = false)}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <h3>New Campaign</h3>
    <div class="field-group" style="margin-bottom: 10px">
      <label class="field-label" for="new-campaign-label">Display name</label>
      <input
        id="new-campaign-label"
        type="text"
        placeholder="e.g. Goldhaven Arc"
        bind:value={newCampaignLabel}
      />
    </div>
    <div class="field-group">
      <label class="field-label" for="new-campaign-id">ID (no spaces)</label>
      <input
        id="new-campaign-id"
        type="text"
        placeholder="e.g. goldhaven_arc"
        bind:value={newCampaignId}
      />
    </div>
    <div class="modal-foot">
      <button class="btn" onclick={() => (showAddCampaign = false)}>Cancel</button>
      <button class="btn btn-gold" onclick={createCampaign}>Create</button>
    </div>
  </div>
</div>

<!-- Rename Campaign -->
<div
  class="modal-overlay"
  class:open={showRenameCampaign}
  role="presentation"
  onclick={() => (showRenameCampaign = false)}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <h3>Rename Campaign</h3>
    <div class="field-group">
      <label class="field-label" for="rename-campaign-label">Display name</label>
      <input
        id="rename-campaign-label"
        type="text"
        placeholder="e.g. Goldhaven Arc"
        bind:value={renameCampaignLabel}
      />
    </div>
    <div class="modal-foot">
      <button class="btn" onclick={() => (showRenameCampaign = false)}>Cancel</button>
      <button class="btn btn-gold" onclick={confirmRenameCampaign}>Rename</button>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     DANGEROUS ACTIONS OVERLAY
═══════════════════════════════════════════════════════════════ -->
<div class="modal-overlay" class:open={showDanger}>
  <div class="modal modal-danger">
    <div class="danger-header">
      <span class="danger-icon">⚠</span>
      <h3>Dangerous Actions</h3>
    </div>
    <p class="danger-subtitle">These actions are irreversible. Proceed with caution.</p>

    {#if dangerStep === 1}
    <!-- Step 1 -->
    <div>
      <div class="danger-action-card">
        <div class="danger-action-info">
          <div class="danger-action-title">Clear All Data</div>
          <div class="danger-action-desc">
            Permanently deletes all campaigns, NPCs, players, houses, timelines,
            trackers, and party data. The app will return to the first-launch screen.
          </div>
        </div>
        <button class="btn btn-red" onclick={() => (dangerStep = 2)}>Clear All Data</button>
      </div>
    </div>
    {/if}

    {#if dangerStep === 2}
    <!-- Step 2 -->
    <div>
      <div class="danger-step-notice">
        <div class="danger-step-notice-icon">💾</div>
        <div>
          <div class="danger-step-notice-title">Download your backup first</div>
          <div class="danger-step-notice-desc">
            You must save a backup before clearing your data. If you cancel the
            save dialog, you will need to try again.
          </div>
        </div>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 1rem">
        <button class="btn" onclick={closeDangerOverlay}>Cancel</button>
        <button class="btn btn-gold" onclick={dangerDownloadAndContinue}>Download Backup &amp; Continue</button>
      </div>
    </div>
    {/if}

    {#if dangerStep === 3}
    <!-- Step 3 -->
    <div>
      <div class="danger-final-warning">
        <div class="danger-final-warning-title">Are you absolutely sure?</div>
        <div class="danger-final-warning-desc">
          Your backup has been saved. This will permanently delete
          <strong>all data</strong> in the toolbox. This cannot be undone.
        </div>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 1rem; justify-content: flex-end">
        <button class="btn" onclick={closeDangerOverlay}>No, keep my data</button>
        <button class="btn btn-red" onclick={dangerClearAll}>Yes, delete everything</button>
      </div>
    </div>
    {/if}

    <!-- Close button -->
    <button class="danger-close" onclick={closeDangerOverlay}>✕</button>
  </div>
</div>

<Toast />
