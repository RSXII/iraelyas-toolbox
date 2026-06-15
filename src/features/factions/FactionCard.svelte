<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { FactionConfig } from '@/types/index';
  import FactionRanksSection from './FactionRanksSection.svelte';
  import FactionMembersSection from './FactionMembersSection.svelte';
  import FactionNpcSection from './FactionNpcSection.svelte';

  interface Props {
    fc: FactionConfig;
    fcIdx: number;
    totalFactions: number;
  }
  let { fc, fcIdx, totalFactions }: Props = $props();

  const campaignId = $derived(store.activeCampaignId);

  function moveFaction(direction: 'up' | 'down'): void {
    if (!campaignId) return;
    store.moveFactionConfig(campaignId, fc.id, direction);
  }

  function removeFaction(): void {
    if (!campaignId) return;
    store.removeFactionConfig(campaignId, fc.id);
    showToast('Faction removed');
  }
</script>

<div class="faction-card">

  <!-- Card header -->
  <div class="faction-card-header">
    <div class="faction-card-title">
      <span class="faction-name">{fc.name}</span>
    </div>
    <div class="faction-card-actions">
      <button
        class="btn-icon btn-reorder"
        onclick={() => moveFaction('up')}
        disabled={fcIdx === 0}
        title="Move up"
      >▲</button>
      <button
        class="btn-icon btn-reorder"
        onclick={() => moveFaction('down')}
        disabled={fcIdx === totalFactions - 1}
        title="Move down"
      >▼</button>
      <button
        class="btn-icon btn-delete-faction"
        onclick={removeFaction}
        title="Remove faction config"
      >✕</button>
    </div>
  </div>

  <FactionRanksSection {fc} />
  <FactionMembersSection {fc} />
  <FactionNpcSection {fc} />

</div>
