<script lang="ts">
  import { store } from '@/state/store.svelte';
  import RelationshipCard from './RelationshipCard.svelte';

  interface Props {
    active?: boolean;
    onswitchToNPCs?: () => void;
  }
  let { active = false, onswitchToNPCs }: Props = $props();

  const cid     = $derived(store.activeCampaignId);
  const cd      = $derived(store.activeCampaignData);
  const players = $derived(cid ? store.getParty(cid).pcs : []);

  const majorNpcs = $derived(
    cd ? cd.schema.npcs.filter((n) => n.npcType === 'major') : []
  );
</script>

<div class="tab-panel" id="panel-favor" class:active>
  <div class="cpr-favor-inner">

    <div class="cpr-favor-header">
      <div>
        <h2 class="cpr-favor-title">Reputation Tracker</h2>
        <p class="cpr-favor-sub">Personal reputation per major NPC — stacks as a flat modifier on social rolls.</p>
      </div>
      <button class="btn btn-gold btn-sm" onclick={() => onswitchToNPCs?.()}>
        ➕ Add NPC →
      </button>
    </div>

    {#if !cid}
      <div class="empty-state">Select or create a campaign to begin.</div>
    {:else if !majorNpcs.length}
      <div class="empty-state cpr-empty">
        <p>No major NPCs yet.</p>
        <p>Create NPCs in the NPC Creator tab and set their type to <strong>Major</strong> to track reputation here.</p>
        <button class="btn btn-gold btn-sm" onclick={() => onswitchToNPCs?.()}>Go to NPC Creator →</button>
      </div>
    {:else}
      <div class="cpr-card-grid">
        {#each majorNpcs as npc (npc.id)}
          <RelationshipCard {npc} {players} />
        {/each}
      </div>
    {/if}

    <!-- Legend -->
    <div class="cpr-legend">
      <span class="cpr-legend-label">Tiers:</span>
      <span class="cpr-legend-item" style="color:#9b2020">−3 Enemy (−8)</span>
      <span class="cpr-legend-sep">·</span>
      <span class="cpr-legend-item" style="color:#c0392b">−2 Hostile (−4)</span>
      <span class="cpr-legend-sep">·</span>
      <span class="cpr-legend-item" style="color:#c07030">−1 Cold (−2)</span>
      <span class="cpr-legend-sep">·</span>
      <span class="cpr-legend-item" style="color:#7a7060">0 Stranger (0)</span>
      <span class="cpr-legend-sep">·</span>
      <span class="cpr-legend-item" style="color:#2980b9">+1 Known (+1)</span>
      <span class="cpr-legend-sep">·</span>
      <span class="cpr-legend-item" style="color:#27ae60">+2 Trusted (+2)</span>
      <span class="cpr-legend-sep">·</span>
      <span class="cpr-legend-item" style="color:#c09830">+3 Relied Upon (+4)</span>
      <span class="cpr-legend-sep">·</span>
      <span class="cpr-legend-item" style="color:#8e44ad">+4 Confidant (+6)</span>
      <span class="cpr-legend-sep">·</span>
      <span class="cpr-legend-item" style="color:#9b59b6">+5 Inner Circle (+10)</span>
    </div>

  </div>
</div>
