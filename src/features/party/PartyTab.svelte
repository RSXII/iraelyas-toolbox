<script lang="ts">
  import { store } from '@/state/store.svelte';
  import Dnd5ePartyTab from './dnd5e/PartyTab.svelte';
  import CprPartyTab from './cpr/PartyTab.svelte';

  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  const gameSystem = $derived(store.activeCampaignGameSystem);
</script>

{#if gameSystem === 'cpr'}
  <CprPartyTab {active} />
{:else}
  <Dnd5ePartyTab {active} />
{/if}
