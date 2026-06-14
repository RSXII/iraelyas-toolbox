<script lang="ts">
  import type { NPCType } from '@/types/index';

  interface Props {
    factions: { id: string; name: string }[];
    hasUnaffiliated: boolean;
    factionFilter: string;
    typeFilter: NPCType | 'all';
    onfactionchange: (id: string) => void;
    ontypechange: (t: NPCType | 'all') => void;
  }
  let { factions, hasUnaffiliated, factionFilter, typeFilter, onfactionchange, ontypechange }: Props = $props();
</script>

<div class="npc-filter-row">
  <span class="npc-filter-label">Faction</span>
  <div class="npc-filter-group">
    <button class="chip" class:active={factionFilter === 'all'}
      onclick={() => onfactionchange('all')}>All</button>
    {#each factions as fc (fc.id)}
      <button class="chip" class:active={factionFilter === fc.id}
        onclick={() => onfactionchange(fc.id)}>{fc.name}</button>
    {/each}
    {#if hasUnaffiliated}
      <button class="chip" class:active={factionFilter === '__unaffiliated__'}
        onclick={() => onfactionchange('__unaffiliated__')}>Unaffiliated</button>
    {/if}
  </div>

  <div class="npc-filter-divider"></div>

  <span class="npc-filter-label">Type</span>
  <div class="npc-filter-group">
    <button class="chip" class:active={typeFilter === 'all'}
      onclick={() => ontypechange('all')}>All</button>
    <button class="chip" class:active={typeFilter === 'scene'}
      onclick={() => ontypechange('scene')}>Scene</button>
    <button class="chip" class:active={typeFilter === 'recurring'}
      onclick={() => ontypechange('recurring')}>Recurring</button>
    <button class="chip" class:active={typeFilter === 'major'}
      onclick={() => ontypechange('major')}>Major</button>
  </div>
</div>
