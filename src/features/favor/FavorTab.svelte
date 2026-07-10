<script lang="ts">
  import { store } from '@/state/store.svelte';
  import Dnd5eFavorTab from './dnd5e/FavorTab.svelte';
  import CprFavorTab from './cpr/FavorTab.svelte';

  interface Props {
    active?: boolean;
    onswitchToNPCs?: () => void;
  }
  let { active = false, onswitchToNPCs }: Props = $props();

  const gameSystem = $derived(store.activeCampaignGameSystem);
</script>

{#if gameSystem === 'cpr'}
  <CprFavorTab {active} {onswitchToNPCs} />
{:else}
  <Dnd5eFavorTab {active} {onswitchToNPCs} />
{/if}
