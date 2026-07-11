<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { PCCard } from '@/types/index';
  import CPRPCCard from './CPRPCCard.svelte';
  import { mapFieldsToPC } from '@/utils/cpr-sheet-import';

  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  const pcs = $derived(store.activeCampaignId ? store.getParty(store.activeCampaignId).pcs : []);

  // ─── Total eddies ─────────────────────────────────────────────
  const totalPlat = $derived(pcs.reduce((s, p) => s + (p.cprStats?.plat ?? 0), 0));

  // ─── Add character modal ──────────────────────────────────────
  let showAddModal = $state(false);
  let newName      = $state('');
  let nameInputEl  = $state<HTMLInputElement | null>(null);

  function genId(): string {
    return `pc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function defaultPC(name: string): PCCard {
    return {
      id: genId(), name,
      ac: '',
      saves:    { str: '', dex: '', con: '', int: '', wis: '', cha: '' },
      passives: { perception: '', insight: '', investigation: '' },
      currency: { platinum: 0, gold: 0 },
      custom: [],
      cprStats: {},
    };
  }

  function openAdd(): void {
    newName = '';
    showAddModal = true;
    setTimeout(() => nameInputEl?.focus(), 50);
  }

  function confirmAdd(): void {
    const name = newName.trim();
    if (!name) { showToast('Name required'); return; }
    const cid = store.activeCampaignId;
    if (!cid) { showToast('Select a campaign first'); return; }
    store.addPC(cid, defaultPC(name));
    showAddModal = false;
    showToast(`${name} added to crew`);
  }

  // ─── Import from PDF sheet ────────────────────────────────────
  let importingSheet = $state(false);

  async function importFromSheet(): Promise<void> {
    const cid = store.activeCampaignId;
    if (!cid) { showToast('Select a campaign first'); return; }
    importingSheet = true;
    try {
      const result = await window.toolbox.importCharacterSheet();
      if (!result) return;
      if (!result.ok || !result.fields) { showToast(result?.error ?? 'Failed to read PDF'); return; }
      const pc = mapFieldsToPC(result.fields, genId());
      store.addPC(cid, pc);
      showToast(`${pc.name} added to crew`);
    } finally {
      importingSheet = false;
    }
  }

  // ─── Delete ───────────────────────────────────────────────────
  let deleteEnabled  = $state(false);
  let deletePending  = $state<PCCard | null>(null);

  function promptDelete(pc: PCCard): void { deletePending = pc; }

  function confirmDelete(removeRelationships: boolean): void {
    const cid = store.activeCampaignId;
    if (!cid || !deletePending) return;
    if (removeRelationships) store.removeFavorPlayer(cid, deletePending.id);
    store.deletePC(cid, deletePending.id);
    showToast(`${deletePending.name} removed`);
    deletePending = null;
  }
</script>

<div class="tab-panel" id="panel-party" class:active>
  <div class="cpr-party-inner">

    <!-- Page header -->
    <div class="cpr-party-header">
      <div>
        <h1 class="cpr-party-title">CREW</h1>
        <p class="cpr-party-sub">
          {pcs.length} member{pcs.length !== 1 ? 's' : ''}
          {#if totalPlat > 0}
            · {totalPlat.toLocaleString()} Plat total
          {/if}
        </p>
      </div>
      <div class="cpr-party-actions">
        <button class="btn btn-sm btn-danger" class:active={deleteEnabled}
          onclick={() => deleteEnabled = !deleteEnabled}>
          {deleteEnabled ? 'Done' : 'Remove'}
        </button>
        <button class="btn btn-sm" onclick={importFromSheet} disabled={importingSheet}>
          {importingSheet ? 'Reading…' : 'Import Sheet'}
        </button>
        <button class="cpr-add-btn" onclick={openAdd}>+ ADD CHARACTER</button>
      </div>
    </div>

    <!-- Card grid -->
    <div class="cpr-pc-grid">
      {#if !store.activeCampaignId}
        <div class="empty-state" style="grid-column:1/-1">Select or create a campaign to begin.</div>
      {:else if !pcs.length}
        <div class="cpr-empty-crew">No crew yet. Add your first character.</div>
      {:else}
        {#each pcs as pc (pc.id)}
          <CPRPCCard {pc} {deleteEnabled} ondelete={() => promptDelete(pc)} />
        {/each}
      {/if}
    </div>

  </div>
</div>

<!-- Delete confirm modal -->
{#if deletePending}
<div class="modal-overlay open">
  <div class="modal">
    <h3>Remove {deletePending.name}?</h3>
    <p style="color: var(--text-dim); font-size: 13px; margin: 8px 0 16px">
      Remove their relationship history too?
    </p>
    <div class="modal-foot" style="gap: 8px; flex-wrap: wrap">
      <button class="btn" onclick={() => (deletePending = null)}>Cancel</button>
      <button class="btn" onclick={() => confirmDelete(false)}>Keep History</button>
      <button class="btn btn-danger" onclick={() => confirmDelete(true)}>Remove Everything</button>
    </div>
  </div>
</div>
{/if}

<!-- Add character modal -->
<div class="modal-overlay" class:open={showAddModal}>
  <div class="modal modal-party">
    <h3>Add Crew Member</h3>
    <div class="field-group">
      <label class="field-label" for="cpr-new-pc-name">Character name</label>
      <input
        type="text"
        id="cpr-new-pc-name"
        bind:this={nameInputEl}
        bind:value={newName}
        placeholder="e.g. Regi-X"
        onkeydown={(e) => { if (e.key === 'Enter') confirmAdd(); }}
      />
    </div>
    <div class="modal-foot">
      <button class="btn" onclick={() => (showAddModal = false)}>Cancel</button>
      <button class="btn btn-gold" onclick={confirmAdd}>Add</button>
    </div>
  </div>
</div>
