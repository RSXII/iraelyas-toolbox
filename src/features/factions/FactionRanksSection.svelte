<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { FactionConfig, FactionRank } from '@/types/index';

  interface Props { fc: FactionConfig; }
  let { fc }: Props = $props();

  const campaignId = $derived(store.activeCampaignId);

  function genId(): string {
    return `rid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  let isEditing   = $state(false);
  let rankDraft   = $state<FactionRank[]>([]);
  let newRankName = $state('');

  function openEditor(): void {
    rankDraft   = fc.ranks.map((r) => ({ ...r }));
    newRankName = '';
    isEditing   = true;
  }

  function addRankToDraft(): void {
    const name = newRankName.trim();
    if (!name) return;
    rankDraft.push({ id: genId(), name });
    newRankName = '';
  }

  function removeRankFromDraft(rankId: string): void {
    rankDraft = rankDraft.filter((r) => r.id !== rankId);
  }

  function saveRanks(): void {
    if (!campaignId) return;
    store.setFactionRanks(campaignId, fc.id, [...rankDraft]);
    isEditing = false;
    rankDraft = [];
    showToast('Ranks updated');
  }

  function cancelRanks(): void {
    isEditing = false;
    rankDraft = [];
  }
</script>

<div class="ranks-section">
  {#if isEditing}
    <div class="ranks-editor">
      <span class="section-label">Ranks</span>
      <div class="ranks-list">
        {#each rankDraft as rank, i (rank.id)}
          <div class="rank-edit-row">
            <span class="rank-num">{i + 1}.</span>
            <input
              class="rank-input"
              type="text"
              bind:value={rank.name}
              placeholder="Rank name"
            />
            <button class="btn-icon" onclick={() => removeRankFromDraft(rank.id)} title="Remove rank">✕</button>
          </div>
        {/each}
        <div class="rank-edit-row rank-add-row">
          <input
            class="rank-input"
            type="text"
            bind:value={newRankName}
            placeholder="New rank name…"
            onkeydown={(e) => { if (e.key === 'Enter') addRankToDraft(); }}
          />
          <button class="btn-icon btn-add-rank" onclick={addRankToDraft} title="Add rank">+</button>
        </div>
      </div>
      <div class="ranks-editor-actions">
        <button class="btn-confirm" onclick={saveRanks}>Save Ranks</button>
        <button class="btn-cancel" onclick={cancelRanks}>Cancel</button>
      </div>
    </div>
  {:else}
    <div class="ranks-display">
      <span class="section-label">Ranks</span>
      {#if fc.ranks.length === 0}
        <span class="hint-text">No ranks defined.</span>
      {:else}
        <div class="rank-chips">
          {#each fc.ranks as rank, i (rank.id)}
            <span class="rank-chip">{i + 1}. {rank.name}</span>
          {/each}
        </div>
      {/if}
      <button class="btn-edit-ranks" onclick={openEditor}>Edit Ranks</button>
    </div>
  {/if}
</div>
