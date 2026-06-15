<script lang="ts">
  import { store } from '@/state/store.svelte';
  import type { NPC } from '@/types/index';
  import { scenePlaceholders } from './NpcPlaceholderText';

  interface Props { npc: NPC; }
  let { npc }: Props = $props();

  const cid = $derived(store.activeCampaignId);
</script>

<div class="npc-fields-section">
  <div class="npc-fields-section-title">Scene NPC</div>
  <div class="npc-field-group">
    <label class="npc-field-label" for="npc-fn-{npc.id}">Function</label>
    <textarea id="npc-fn-{npc.id}" class="npc-field-input"
      value={npc.npcFunction ?? ''}
      onchange={(e) => cid && store.updateNPC(cid, npc.id, { npcFunction: (e.target as HTMLTextAreaElement).value })}
    placeholder={scenePlaceholders.npcFunction}></textarea>
  </div>
  <div class="npc-field-group">
    <label class="npc-field-label" for="npc-dd-{npc.id}">Distinct Detail</label>
    <textarea id="npc-dd-{npc.id}" class="npc-field-input"
      value={npc.distinctDetail ?? ''}
      onchange={(e) => cid && store.updateNPC(cid, npc.id, { distinctDetail: (e.target as HTMLTextAreaElement).value })}
    placeholder={scenePlaceholders.distinctDetail}></textarea>
  </div>
  <div class="npc-field-group">
    <label class="npc-field-label" for="npc-need-{npc.id}">Need</label>
    <textarea id="npc-need-{npc.id}" class="npc-field-input"
      value={npc.npcNeed ?? ''}
      onchange={(e) => cid && store.updateNPC(cid, npc.id, { npcNeed: (e.target as HTMLTextAreaElement).value })}
    placeholder={scenePlaceholders.npcNeed}></textarea>
  </div>
</div>
