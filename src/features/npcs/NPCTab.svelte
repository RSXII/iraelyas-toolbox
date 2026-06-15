<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import NpcFilterRow from './NpcFilterRow.svelte';
  import NpcListRow from './NpcListRow.svelte';
  import NpcDetailModal from './NpcDetailModal.svelte';
  import NpcAddForm from './NpcAddForm.svelte';
  import type { NPC, NPCType } from '@/types/index';

  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  // ─── Reactive data ────────────────────────────────────────────
  const cid            = $derived(store.activeCampaignId);
  const npcs           = $derived(cid ? store.getSchema(cid).npcs : []);
  const factionConfigs = $derived(cid ? store.getFactions(cid).factions : []);
  const factionFilterList = $derived(factionConfigs.map((fc) => ({ id: fc.id, name: fc.name })));

  // ─── Filters ──────────────────────────────────────────────────
  let factionFilter = $state('all');
  let typeFilter    = $state<NPCType | 'all'>('all');

  const hasUnaffiliated = $derived.by(() => {
    const factionIdSet = new Set(factionConfigs.map((f) => f.id));
    return npcs.some((n) => !n.factionId || !factionIdSet.has(n.factionId));
  });

  const displayNpcs = $derived.by(() => {
    const factionIdSet = new Set(factionConfigs.map((f) => f.id));
    let list = npcs.filter((n) => !n.isFactionHeader);
    if (factionFilter === '__unaffiliated__') {
      list = list.filter((n) => !n.factionId || !factionIdSet.has(n.factionId));
    } else if (factionFilter !== 'all') {
      list = list.filter((n) => n.factionId === factionFilter);
    }
    if (typeFilter !== 'all') {
      list = list.filter((n) => (n.npcType ?? 'scene') === typeFilter);
    }
    return list;
  });

  // ─── Selection + edit state ───────────────────────────────────
  let selectedNpc  = $state<NPC | null>(null);
  let editEnabled  = $state(false);
  let showAddForm  = $state(false);

  // Keep selectedNpc in sync when store updates (e.g. name change in modal)
  $effect(() => {
    if (!selectedNpc) return;
    const refreshed = npcs.find((n) => n.id === selectedNpc!.id);
    if (refreshed) selectedNpc = refreshed;
  });

  function deleteNPC(npc: NPC): void {
    if (!cid) return;
    if (!confirm(`Remove ${npc.name}? This will delete their scores for all players.`)) return;
    if (selectedNpc?.id === npc.id) selectedNpc = null;
    store.deleteNPC(cid, npc.id);
    showToast(`${npc.name} removed`);
  }
</script>

<div class="tab-panel" id="panel-npcs" class:active>
  <div class="npc-creator-inner">

    <!-- Header -->
    <div class="npc-creator-header">
      <span class="npc-creator-title">NPC Creator</span>
      <button class="btn btn-gold btn-sm" onclick={() => { showAddForm = !showAddForm; }}>+ Add NPC</button>
    </div>

    <!-- Filters -->
    <NpcFilterRow
      factions={factionFilterList}
      {hasUnaffiliated}
      {factionFilter}
      {typeFilter}
      onfactionchange={(id) => (factionFilter = id)}
      ontypechange={(t) => (typeFilter = t)}
    />

    <!-- Add NPC form (inline) -->
    {#if showAddForm}
      <NpcAddForm {factionConfigs} onclose={() => (showAddForm = false)} />
    {/if}

    <!-- NPC list -->
    {#if !cid}
      <div class="npc-empty">Select or create a campaign to begin.</div>
    {:else if displayNpcs.length === 0}
      <div class="npc-empty">
        No NPCs found.
        <div class="npc-empty-hint">Add your first NPC above, or adjust the filters.</div>
      </div>
    {:else}
      <div class="npc-list">
        {#each displayNpcs as npc (npc.id)}
          <NpcListRow
            {npc}
            {editEnabled}
            onselect={(n) => (selectedNpc = n)}
            ondelete={deleteNPC}
          />
        {/each}
      </div>
    {/if}

    <!-- Edit mode bar -->
    <div class="npc-edit-bar">
      <input type="checkbox" id="npc-edit-mode" bind:checked={editEnabled} />
      <label for="npc-edit-mode">Enable deletion</label>
    </div>

  </div>
</div>

<!-- NPC detail modal -->
<NpcDetailModal
  npc={selectedNpc}
  {factionConfigs}
  onclose={() => (selectedNpc = null)}
/>
