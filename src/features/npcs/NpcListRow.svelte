<script lang="ts">
  import { initials, npcTypeLabel, resolvedType } from './utils';
  import type { NPC } from '@/types/index';

  interface Props {
    npc: NPC;
    editEnabled: boolean;
    onselect: (npc: NPC) => void;
    ondelete: (npc: NPC) => void;
  }
  let { npc, editEnabled, onselect, ondelete }: Props = $props();

  const t = $derived(resolvedType(npc));
</script>

<div
  class="npc-list-row npc-card-header"
  class:has-portrait={!!npc.portrait}
  style={npc.portrait ? `--npc-portrait-url: url('${npc.portrait}')` : undefined}
  role="button"
  tabindex="0"
  onclick={() => onselect(npc)}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onselect(npc); } }}
>
  <div class="npc-card-initials" class:npc-list-portrait={!!npc.portrait}>
    {#if npc.portrait}
      <img src={npc.portrait} alt="" aria-hidden="true" />
    {:else}
      {initials(npc.name)}
    {/if}
  </div>
  <div class="npc-card-identity">
    <div class="npc-card-name">{npc.name}</div>
    <div class="npc-card-role">{npc.role}</div>
  </div>
  <div class="npc-card-badges">
    {#if npc.faction && npc.faction !== 'Unaffiliated'}
      <span class="npc-faction-badge">{npc.faction}</span>
    {/if}
    <span class="npc-type-badge {t}">{npcTypeLabel(npc.npcType)}</span>
  </div>
  {#if editEnabled}
    <button
      class="npc-list-delete-btn npc-card-delete-btn"
      aria-label="Delete NPC"
      onclick={(e) => { e.stopPropagation(); ondelete(npc); }}
    >✕</button>
  {/if}
</div>
