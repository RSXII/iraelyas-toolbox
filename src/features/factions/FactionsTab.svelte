<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import FactionListRow from './FactionListRow.svelte';
  import FactionDetailModal from './FactionDetailModal.svelte';
  import type { FactionConfig } from '@/types/index';

  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  const campaignId = $derived(store.activeCampaignId);
  const cd         = $derived(campaignId ? store.getCampaignData(campaignId) : null);
  const factions   = $derived(campaignId ? store.getFactions(campaignId).factions : []);
  const partyPcs   = $derived(cd?.party.pcs ?? []);

  let showAddFaction = $state(false);
  let newFactionName = $state('');

  // ─── Selection state ──────────────────────────────────────────
  let selectedFaction = $state<FactionConfig | null>(null);

  const selectedFactionIdx = $derived(
    selectedFaction ? factions.findIndex((f) => f.id === selectedFaction!.id) : -1
  );

  // Keep selectedFaction in sync when store mutates (name edits, etc.)
  $effect(() => {
    if (!selectedFaction) return;
    const refreshed = factions.find((f) => f.id === selectedFaction!.id);
    if (refreshed) selectedFaction = refreshed;
    else selectedFaction = null;
  });

  function addFaction(): void {
    if (!campaignId || !newFactionName.trim()) return;
    store.addFaction(campaignId, newFactionName.trim());
    newFactionName = '';
    showAddFaction = false;
    showToast('Faction added');
  }
</script>

<div class="tab-panel" id="panel-factions" class:active>

  {#if !cd}
    <p class="empty-msg">No campaign selected.</p>
  {:else}

    <!-- Header bar -->
    <div class="factions-top-bar">
      <h2 class="factions-title">Faction Memberships</h2>
      <button class="btn-add-faction" onclick={() => { showAddFaction = !showAddFaction; newFactionName = ''; }}>
        + Add Faction
      </button>
    </div>

    <!-- Add Faction form -->
    {#if showAddFaction}
      <div class="add-faction-bar">
        <input
          type="text"
          class="faction-select"
          bind:value={newFactionName}
          placeholder="Faction name…"
          onkeydown={(e) => { if (e.key === 'Enter') addFaction(); if (e.key === 'Escape') { showAddFaction = false; newFactionName = ''; } }}
        />
        <button class="btn-confirm" onclick={addFaction} disabled={!newFactionName.trim()}>Add</button>
        <button class="btn-cancel" onclick={() => { showAddFaction = false; newFactionName = ''; }}>Cancel</button>
      </div>
    {/if}

    <!-- Faction list -->
    {#if factions.length === 0}
      <p class="empty-msg">No factions configured yet. Use "Add Faction" to get started.</p>
    {:else}
      <div class="faction-list">
        {#each factions as fc (fc.id)}
          <FactionListRow {fc} {partyPcs} onselect={() => (selectedFaction = fc)} />
        {/each}
      </div>
    {/if}

  {/if}

</div>

<!-- Faction detail modal (outside panel so it overlays correctly) -->
<FactionDetailModal
  fc={selectedFaction}
  fcIdx={selectedFactionIdx}
  totalFactions={factions.length}
  onclose={() => (selectedFaction = null)}
/>
