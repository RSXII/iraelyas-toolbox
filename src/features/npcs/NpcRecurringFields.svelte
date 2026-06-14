<script lang="ts">
  import { store } from '@/state/store.svelte';
  import type { NPC } from '@/types/index';

  interface Props { npc: NPC; }
  let { npc }: Props = $props();

  const cid = $derived(store.activeCampaignId);
</script>

<div class="npc-fields-section">
  <div class="npc-fields-section-title">Recurring NPC</div>
  <div class="npc-field-group">
    <label class="npc-field-label" for="npc-wound-{npc.id}">Wound</label>
    <textarea id="npc-wound-{npc.id}" class="npc-field-input"
      value={npc.wound ?? ''}
      onchange={(e) => cid && store.updateNPC(cid, npc.id, { wound: (e.target as HTMLTextAreaElement).value })}
    ></textarea>
  </div>
  <div class="npc-field-group">
    <label class="npc-field-label" for="npc-gap-{npc.id}">Gap</label>
    <textarea id="npc-gap-{npc.id}" class="npc-field-input"
      value={npc.gap ?? ''}
      onchange={(e) => cid && store.updateNPC(cid, npc.id, { gap: (e.target as HTMLTextAreaElement).value })}
    ></textarea>
  </div>
  <div class="npc-field-group">
    <label class="npc-field-label" for="npc-prot-{npc.id}">Protecting</label>
    <textarea id="npc-prot-{npc.id}" class="npc-field-input"
      value={npc.protecting ?? ''}
      onchange={(e) => cid && store.updateNPC(cid, npc.id, { protecting: (e.target as HTMLTextAreaElement).value })}
    ></textarea>
  </div>
  <div class="npc-field-group">
    <label class="npc-field-label" for="npc-break-{npc.id}">What Would Break Them</label>
    <textarea id="npc-break-{npc.id}" class="npc-field-input"
      value={npc.whatWouldBreakThem ?? ''}
      onchange={(e) => cid && store.updateNPC(cid, npc.id, { whatWouldBreakThem: (e.target as HTMLTextAreaElement).value })}
    ></textarea>
  </div>
</div>
