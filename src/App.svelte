<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '@/state/store.svelte';
  import type { TabId } from '@/types/index';
  import Toast from '@/components/ui/Toast.svelte';
  import Modal from '@/components/ui/Modal.svelte';

  // Vanilla modules — progressively replaced as each tab is converted to Svelte
  import { openModal, closeModal } from '@/modules/ui/modal';
  import {
    renderCampaignSelect,
    createCampaign,
    renameCampaign,
    confirmRenameCampaign,
  } from '@/modules/campaign';
  import { exportBackup, importBackup } from '@/modules/backup';
  import {
    migLoadBackup,
    migLoadFile,
    migStartFresh,
    migFinish,
  } from '@/modules/migration';
  import {
    showDangerStep,
    openDangerOverlay,
    closeDangerOverlay,
    dangerDownloadAndContinue,
    dangerClearAll,
  } from '@/modules/danger';
  import {
    renderFavor,
    renderPlayerSelect,
    switchPlayer,
    savePlayer,
    createPlayer,
    addNPC,
    setFavorDeleteEnabled,
  } from '@/modules/favor';
  import {
    renderConvoSliders,
    resetConvo,
    initConvoPCButtons,
    syncPCCountButtons,
    initConvoTitle,
  } from '@/modules/convo';
  import {
    initTree,
    renderHouseSelect,
    switchHouse,
    importHouseFile,
    resetTreeView,
  } from '@/modules/tree';
  import {
    renderChronicle,
    initChronicle,
    importTimelineFile,
    exportTimelineFile,
    scrollToNow,
  } from '@/modules/chronicle';
  import { renderTracker, initTracker } from '@/modules/tracker';
  import { renderParty, initParty } from '@/modules/party';

  // ─── State ───────────────────────────────────────────────────
  let showMigrationOverlay = $state(true);
  let activeTab = $state<TabId>('favor');

  // ─── Tab switching ───────────────────────────────────────────
  function switchTab(id: TabId): void {
    activeTab = id;
    store.setActiveTab(id);
    if (id === 'tree') setTimeout(() => initTree(), 10);
    if (id === 'chronicle') setTimeout(() => renderChronicle(), 10);
    if (id === 'tracker') renderTracker();
    if (id === 'party') renderParty();
  }

  // ─── Campaign switching ──────────────────────────────────────
  function switchCampaign(id: string): void {
    if (!id) return;
    store.setActiveCampaign(id);
    renderCampaignSelect();
    renderPlayerSelect();
    renderHouseSelect();
    renderFavor();
    if (activeTab === 'tree') initTree();
    if (activeTab === 'chronicle') renderChronicle();
    if (activeTab === 'tracker') renderTracker();
    if (activeTab === 'party') renderParty();
  }

  // ─── Boot ────────────────────────────────────────────────────
  function boot(): void {
    showMigrationOverlay = false;
    renderCampaignSelect();
    if (store.activeCampaignId) {
      renderPlayerSelect();
      renderHouseSelect();
      renderFavor();
    }
    activeTab = store.activeTab;
    initConvoTitle();
    syncPCCountButtons();
    renderConvoSliders();
    initTracker();
    if (activeTab === 'tracker') renderTracker();
    initParty();
    if (activeTab === 'party') renderParty();
    if (activeTab === 'tree') setTimeout(() => initTree(), 10);
    if (activeTab === 'chronicle') setTimeout(() => renderChronicle(), 10);
  }

  // ─── Mount ───────────────────────────────────────────────────
  onMount(async () => {
    const hasData = await store.load();
    if (hasData && store.campaigns.length > 0) {
      boot();
    }

    initConvoPCButtons();
    initChronicle();

    // Listen for saves made in the timeline editor window
    const onTimelineUpdated = async () => {
      const cid = store.activeCampaignId;
      if (cid) {
        const fresh = await window.toolbox.getTimeline(cid);
        if (fresh) store.setTimeline(cid, fresh);
      }
      renderChronicle();
    };
    window.toolbox.onTimelineUpdated(onTimelineUpdated);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const dangerOpen = document
          .getElementById('modal-danger')
          ?.classList.contains('open');
        if (dangerOpen) {
          const onStep1 =
            (document.getElementById('danger-step-1') as HTMLElement)
              .style.display !== 'none';
          if (onStep1) closeDangerOverlay();
          return;
        }
        document
          .querySelectorAll('.modal-overlay.open')
          .forEach((m) => m.classList.remove('open'));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        savePlayer();
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
      <button class="mig-file-btn" onclick={() => migLoadBackup(boot)}>Load backup</button>
      <span class="mig-step-status" id="mig-status-backup" style="display: none"></span>
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
      <button class="mig-file-btn" onclick={() => migLoadFile('campaigns')}>Load file</button>
      <span class="mig-step-status" id="mig-status-campaigns">Pending</span>
    </div>

    <div class="migration-step">
      <div class="mig-step-num">2</div>
      <div class="mig-step-info">
        <div class="mig-step-title">NPC Schema</div>
        <div class="mig-step-desc">schema.json — NPC list for the campaign</div>
      </div>
      <button class="mig-file-btn" onclick={() => migLoadFile('schema')}>Load file</button>
      <span class="mig-step-status optional" id="mig-status-schema">Optional</span>
    </div>

    <div class="migration-step">
      <div class="mig-step-num">3</div>
      <div class="mig-step-info">
        <div class="mig-step-title">Player files</div>
        <div class="mig-step-desc">
          terry.json, ophelia.json, neromi.json — select all at once
        </div>
      </div>
      <button class="mig-file-btn" onclick={() => migLoadFile('players')}>Load files</button>
      <span class="mig-step-status optional" id="mig-status-players">Optional</span>
    </div>

    <div class="migration-step">
      <div class="mig-step-num">4</div>
      <div class="mig-step-info">
        <div class="mig-step-title">House / Family Tree</div>
        <div class="mig-step-desc">house_aigner.json — genealogy data</div>
      </div>
      <button class="mig-file-btn" onclick={() => migLoadFile('house')}>Load file</button>
      <span class="mig-step-status optional" id="mig-status-house">Optional</span>
    </div>

    <div class="migration-step">
      <div class="mig-step-num">5</div>
      <div class="mig-step-info">
        <div class="mig-step-title">Timeline data</div>
        <div class="mig-step-desc">timeline-data.js — chronicle events</div>
      </div>
      <button class="mig-file-btn" onclick={() => migLoadFile('timeline')}>Load file</button>
      <span class="mig-step-status optional" id="mig-status-timeline">Optional</span>
    </div>

    <div class="migration-footer">
      <span class="migration-note">You can import more data later from each tool.</span>
      <div style="display: flex; gap: 8px">
        <button class="btn" onclick={migStartFresh}>Start Fresh</button>
        <button class="btn btn-gold" onclick={() => migFinish(boot)}>Launch Toolbox</button>
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
      id="campaign-select"
      onchange={(e) => switchCampaign((e.target as HTMLSelectElement).value)}
    ></select>
    <button class="btn btn-sm" onclick={renameCampaign}>✎</button>
    <button class="btn btn-sm" onclick={() => openModal('modal-add-campaign')}>+ Campaign</button>
  </div>
  <div class="topbar-actions">
    <button class="btn btn-sm" onclick={exportBackup}>Export Backup</button>
    <button class="btn btn-sm btn-gold" onclick={() => importBackup(boot)}>Import Backup</button>
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
  <div class="tab-panel" id="panel-favor" class:active={activeTab === 'favor'}>
    <div class="favor-inner">
      <div class="favor-header">
        <div class="favor-player-block">
          <h2>Viewing as</h2>
          <div class="favor-player-name" id="favor-player-display">—</div>
        </div>
        <div class="favor-controls">
          <select
            class="topbar-select"
            id="player-select"
            style="min-width: 160px"
            onchange={(e) => switchPlayer((e.target as HTMLSelectElement).value)}
          ></select>
          <button class="btn btn-gold btn-sm" onclick={savePlayer}>Save</button>
          <button class="btn btn-sm" onclick={() => openModal('modal-add-player')}>+ Player</button>
        </div>
      </div>
      <div class="filter-row" id="filter-row">
        <span class="filter-label">Filter:</span>
      </div>
      <div id="npc-list"></div>
      <div class="add-npc-panel">
        <h3>Add NPC to Schema</h3>
        <div class="add-npc-grid">
          <div class="field-group">
            <label class="field-label">Name</label>
            <input type="text" id="new-npc-name" placeholder="Full name" />
          </div>
          <div class="field-group">
            <label class="field-label">Role</label>
            <input type="text" id="new-npc-role" placeholder="Role or title" />
          </div>
          <div class="field-group">
            <label class="field-label">Faction</label>
            <input type="text" id="new-npc-faction" placeholder="Faction" />
          </div>
          <button class="btn btn-gold" id="btn-add-npc" style="align-self: end" onclick={addNPC}>Add</button>
        </div>
        <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px">
          <input
            type="checkbox"
            id="new-npc-is-header"
            style="accent-color: var(--gold); width: 14px; height: 14px; cursor: pointer"
          />
          <label
            for="new-npc-is-header"
            style='font-family: "Cinzel", serif; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-dim); cursor: pointer'
          >
            Faction header — tracks renown for the faction as a whole
          </label>
        </div>
      </div>
      <div class="favor-options">
        <label class="favor-option-toggle">
          <input
            type="checkbox"
            id="favor-delete-toggle"
            onchange={(e) => {
              setFavorDeleteEnabled((e.target as HTMLInputElement).checked);
              renderFavor();
            }}
          />
          <span>Enable NPC deletion</span>
        </label>
      </div>
      <div class="favor-legend">
        <div class="leg-item">
          <div class="leg-dot" style="background: var(--hostile)"></div>
          Hostile (0–19)
        </div>
        <div class="leg-item">
          <div class="leg-dot" style="background: var(--wary)"></div>
          Wary (20–39)
        </div>
        <div class="leg-item">
          <div class="leg-dot" style="background: var(--neutral)"></div>
          Neutral (40–59)
        </div>
        <div class="leg-item">
          <div class="leg-dot" style="background: var(--friendly)"></div>
          Friendly (60–79)
        </div>
        <div class="leg-item">
          <div class="leg-dot" style="background: var(--allied)"></div>
          Allied (80–100)
        </div>
      </div>
    </div>
  </div>

  <!-- ── CONVERSATION TRACKER ── -->
  <div class="tab-panel" id="panel-convo" class:active={activeTab === 'convo'}>
    <div class="convo-inner">
      <div class="convo-top">
        <input
          type="text"
          class="convo-title-input"
          id="convo-title"
          placeholder="Conversation name…"
        />
      </div>
      <div class="convo-setup-row">
        <span class="convo-pc-count-label">Active PCs</span>
        <div style="display: flex; gap: 6px" id="pc-count-btns">
          <button class="filter-chip" data-count="1">1</button>
          <button class="filter-chip" data-count="2">2</button>
          <button class="filter-chip" data-count="3">3</button>
          <button class="filter-chip" data-count="4">4</button>
          <button class="filter-chip active" data-count="5">5</button>
          <button class="filter-chip" data-count="6">6</button>
        </div>
        <div style="margin-left: auto">
          <button class="btn btn-sm" onclick={resetConvo}>Reset to 5</button>
        </div>
      </div>
      <div class="convo-sliders" id="convo-sliders"></div>
      <div class="convo-aggregate">
        <div>
          <div class="agg-label">Room Average</div>
          <div class="agg-mood" id="agg-mood">Neutral</div>
        </div>
        <div class="agg-bar-wrap">
          <div class="agg-bar-fill" id="agg-bar"></div>
        </div>
        <div class="agg-score-block">
          <span class="agg-score-num" id="agg-score">5.0</span>
          <span class="agg-score-denom">/ 10</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ── FAMILY TREE ── -->
  <div class="tab-panel" id="panel-tree" class:active={activeTab === 'tree'}>
    <div class="tree-toolbar">
      <span class="tree-house-label">House</span>
      <span class="tree-title" id="tree-title">—</span>
      <div class="tree-toolbar-right">
        <select
          class="topbar-select"
          id="house-select"
          style="min-width: 180px"
          onchange={(e) => switchHouse((e.target as HTMLSelectElement).value)}
        ></select>
        <button class="btn btn-sm" onclick={importHouseFile}>Import House JSON</button>
        <button class="btn btn-sm" onclick={resetTreeView}>Reset View</button>
      </div>
    </div>
    <div class="tree-wrap" id="tree-wrap">
      <div id="tree-svg-container"></div>
    </div>
    <div class="tree-legend" id="tree-legend"></div>
    <div class="tree-tip" id="tree-tip"></div>
  </div>

  <!-- ── CHRONICLE ── -->
  <div class="tab-panel" id="panel-chronicle" class:active={activeTab === 'chronicle'}>
    <div class="chronicle-toolbar">
      <span class="chronicle-title" id="chronicle-title">Chronicle</span>
      <div class="chronicle-toolbar-right">
        <span class="chronicle-yr-label">Zoom</span>
        <input
          type="range"
          min="4"
          max="120"
          step="2"
          id="yr-width-slider"
          value="68"
          style="width: 90px; accent-color: var(--gold)"
        />
        <button class="btn btn-sm" onclick={scrollToNow}>Jump to Now</button>
        <button class="btn btn-sm" onclick={importTimelineFile}>Import Timeline</button>
        <button class="btn btn-sm btn-gold" onclick={exportTimelineFile}>Export Timeline JS</button>
        <button class="btn btn-sm" onclick={() => window.toolbox.openTimelineEditor()}>Edit Timeline</button>
      </div>
    </div>
    <div class="chronicle-scroll" id="chronicle-scroll">
      <div class="tl-page-header">
        <div>
          <div class="tl-page-title" id="tl-vault-title">Chronicle</div>
          <div class="tl-page-sub">Chronicle of the realm</div>
        </div>
      </div>
      <div class="tl-card" id="tl-root">
        <div class="tl-empty">
          No timeline data — import a timeline-data.js file above.
        </div>
      </div>
    </div>
  </div>

  <!-- ── TRACKER ── -->
  <div class="tab-panel" id="panel-tracker" class:active={activeTab === 'tracker'}>
    <div class="tracker-inner">
      <div class="tracker-header">
        <div style='font-family: "Cinzel", serif; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold-dim)'>
          Custom Trackers
        </div>
        <button class="btn btn-gold btn-sm" id="btn-add-tracker">+ Add Tracker</button>
      </div>
      <div class="filter-row" id="tracker-filter-row">
        <span class="filter-label">Filter:</span>
      </div>
      <div id="tracker-list"></div>
    </div>
  </div>

  <!-- ── PARTY QUICK VIEW ── -->
  <div class="tab-panel" id="panel-party" class:active={activeTab === 'party'}>
    <div class="party-inner">
      <!-- Wealth tally -->
      <div class="party-tally">
        <span class="party-tally-label">Party Wealth</span>
        <div class="party-tally-item">
          <span class="tally-icon">◆</span>
          <span class="tally-value" id="tally-pp">0</span>
          <span class="tally-unit">pp</span>
        </div>
        <div class="party-tally-item">
          <span class="tally-icon">◈</span>
          <span class="tally-value" id="tally-gp">0</span>
          <span class="tally-unit">gp</span>
        </div>
        <span class="party-tally-members" id="tally-members">0 members</span>
      </div>

      <!-- Header -->
      <div class="party-header">
        <div style='font-family: "Cinzel", serif; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold-dim)'>
          Party Members
        </div>
        <button class="btn btn-gold btn-sm" id="btn-add-pc">+ Add PC</button>
      </div>

      <!-- Card grid -->
      <div class="party-grid" id="party-grid"></div>
    </div>
  </div>

</div>
<!-- /content-area -->

<!-- ═══════════════════════════════════════════════════════════════
     MODALS
═══════════════════════════════════════════════════════════════ -->

<!-- Add Campaign -->
<Modal id="modal-add-campaign">
  <div class="modal">
    <h3>New Campaign</h3>
    <div class="field-group" style="margin-bottom: 10px">
      <label class="field-label">Display name</label>
      <input type="text" id="new-campaign-label" placeholder="e.g. Goldhaven Arc" />
    </div>
    <div class="field-group">
      <label class="field-label">ID (no spaces)</label>
      <input type="text" id="new-campaign-id" placeholder="e.g. goldhaven_arc" />
    </div>
    <div class="modal-foot">
      <button class="btn" onclick={() => closeModal('modal-add-campaign')}>Cancel</button>
      <button class="btn btn-gold" onclick={() => createCampaign(switchCampaign)}>Create</button>
    </div>
  </div>
</Modal>

<!-- Rename Campaign -->
<Modal id="modal-rename-campaign">
  <div class="modal">
    <h3>Rename Campaign</h3>
    <div class="field-group">
      <label class="field-label">Display name</label>
      <input type="text" id="rename-campaign-label" placeholder="e.g. Goldhaven Arc" />
    </div>
    <div class="modal-foot">
      <button class="btn" onclick={() => closeModal('modal-rename-campaign')}>Cancel</button>
      <button class="btn btn-gold" onclick={confirmRenameCampaign}>Rename</button>
    </div>
  </div>
</Modal>

<!-- Add Player -->
<Modal id="modal-add-player">
  <div class="modal">
    <h3>New Player</h3>
    <div class="field-group">
      <label class="field-label">Player name</label>
      <input type="text" id="new-player-name" placeholder="e.g. Anna" />
    </div>
    <div class="modal-foot">
      <button class="btn" onclick={() => closeModal('modal-add-player')}>Cancel</button>
      <button class="btn btn-gold" onclick={() => { createPlayer(); closeModal('modal-add-player'); }}>Create</button>
    </div>
  </div>
</Modal>

<!-- Add / Edit Tracker -->
<Modal id="modal-tracker">
  <div class="modal modal-tracker">
    <h3 id="tracker-modal-title">Add Custom Tracker</h3>
    <div class="field-group" style="margin-bottom: 10px">
      <label class="field-label">Name</label>
      <input type="text" id="tracker-name-input" placeholder="e.g. Reginald's Deaths" />
    </div>
    <div class="field-group" style="margin-bottom: 10px">
      <label class="field-label">Category</label>
      <input type="text" id="tracker-cat-input" placeholder="e.g. Characters" />
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px">
      <div class="field-group">
        <label class="field-label">Min</label>
        <input type="number" id="tracker-min-input" value="0" />
      </div>
      <div class="field-group">
        <label class="field-label">Max</label>
        <input type="number" id="tracker-max-input" value="10" />
      </div>
      <div class="field-group">
        <label class="field-label">Start at</label>
        <input type="number" id="tracker-start-input" value="0" />
      </div>
    </div>
    <div class="field-group" style="margin-bottom: 10px">
      <label class="field-label">Direction</label>
      <div class="direction-toggle">
        <button class="direction-option active" data-dir="countup">↑ Count Up</button>
        <button class="direction-option" data-dir="countdown">↓ Count Down</button>
      </div>
    </div>
    <div class="warnings-section-label">Warning Thresholds</div>
    <div class="warnings-list" id="warnings-list"></div>
    <button class="add-warning-btn" id="btn-add-warning">+ Add Warning Threshold</button>
    <div class="modal-foot">
      <button class="btn" id="btn-tracker-cancel">Cancel</button>
      <button class="btn btn-gold" id="btn-tracker-save">Save</button>
    </div>
  </div>
</Modal>

<!-- Add PC -->
<Modal id="modal-add-pc">
  <div class="modal modal-party">
    <h3>Add Party Member</h3>
    <div class="field-group">
      <label class="field-label">Character name</label>
      <input type="text" id="new-pc-name-input" placeholder="e.g. Reginald Thelonious" />
    </div>
    <div class="modal-foot">
      <button class="btn" id="btn-cancel-add-pc">Cancel</button>
      <button class="btn btn-gold" id="btn-confirm-add-pc">Add</button>
    </div>
  </div>
</Modal>

<!-- ═══════════════════════════════════════════════════════════════
     DANGEROUS ACTIONS OVERLAY
═══════════════════════════════════════════════════════════════ -->
<Modal id="modal-danger">
  <div class="modal modal-danger">
    <div class="danger-header">
      <span class="danger-icon">⚠</span>
      <h3>Dangerous Actions</h3>
    </div>
    <p class="danger-subtitle">These actions are irreversible. Proceed with caution.</p>

    <!-- Step 1 -->
    <div id="danger-step-1">
      <div class="danger-action-card">
        <div class="danger-action-info">
          <div class="danger-action-title">Clear All Data</div>
          <div class="danger-action-desc">
            Permanently deletes all campaigns, NPCs, players, houses, timelines,
            trackers, and party data. The app will return to the first-launch screen.
          </div>
        </div>
        <button class="btn btn-red" onclick={() => showDangerStep(2)}>Clear All Data</button>
      </div>
    </div>

    <!-- Step 2 -->
    <div id="danger-step-2" style="display: none">
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

    <!-- Step 3 -->
    <div id="danger-step-3" style="display: none">
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

    <!-- Close button -->
    <button class="danger-close" onclick={closeDangerOverlay}>✕</button>
  </div>
</Modal>

<Toast />
