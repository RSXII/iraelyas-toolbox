<script lang="ts">
  import { store } from '@/state/store.svelte';
  import type { FactionConfig } from '@/types/index';

  interface Props { fc: FactionConfig; }
  let { fc }: Props = $props();

  const campaignId  = $derived(store.activeCampaignId);
  const cd          = $derived(campaignId ? store.getCampaignData(campaignId) : null);
  const factionNpcs = $derived(
    cd ? cd.schema.npcs.filter((n) => n.factionId === fc.id) : []
  );
</script>

<div class="npc-members-section">
  <div class="npc-members-header">
    <span class="section-label">NPCs</span>
  </div>
  {#if factionNpcs.length === 0}
    <p class="hint-text npc-members-empty">No NPCs in this faction yet.</p>
  {:else if fc.ranks.length === 0}
    <div class="npc-members-list">
      {#each factionNpcs as npc (npc.id)}
        <div class="npc-member-row">
          <span class="npc-member-name">{npc.name}</span>
          <span class="npc-member-role">{npc.role}</span>
          <span class="hint-text npc-rank-hint">Set up ranks first</span>
        </div>
      {/each}
    </div>
  {:else}
    <div class="npc-members-list">
      {#each factionNpcs as npc (npc.id)}
        <div class="npc-member-row">
          <span class="npc-member-name">{npc.name}</span>
          <span class="npc-member-role">{npc.role}</span>
          <select
            class="rank-select npc-rank-select"
            value={fc.npcRanks?.[npc.id] ?? ''}
            onchange={(e) => store.setNPCRank(campaignId!, fc.id, npc.id, (e.target as HTMLSelectElement).value)}
          >
            <option value="">— no rank —</option>
            {#each fc.ranks as rank (rank.id)}
              <option value={rank.id}>{rank.name}</option>
            {/each}
          </select>
        </div>
      {/each}
    </div>
  {/if}
</div>
