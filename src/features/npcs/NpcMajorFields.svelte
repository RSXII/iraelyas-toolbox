<script lang="ts">
  import { store } from '@/state/store.svelte';
  import type { NPC } from '@/types/index';

  interface Props { npc: NPC; }
  let { npc }: Props = $props();

  const cid = $derived(store.activeCampaignId);
</script>

<div class="npc-fields-section">
  <div class="npc-fields-section-title">Major NPC</div>
  <div class="npc-field-group">
    <label class="npc-field-label" for="npc-sb-{npc.id}">What They Believe About Themselves That Isn't True</label>
    <textarea id="npc-sb-{npc.id}" class="npc-field-input"
      value={npc.selfBelief ?? ''}
      onchange={(e) => cid && store.updateNPC(cid, npc.id, { selfBelief: (e.target as HTMLTextAreaElement).value })}
    ></textarea>
  </div>
  <div class="npc-field-group">
    <label class="npc-field-label" for="npc-rc-{npc.id}">Relationship Contradictions</label>
    <textarea id="npc-rc-{npc.id}" class="npc-field-input"
      value={npc.relationshipContradictions ?? ''}
      onchange={(e) => cid && store.updateNPC(cid, npc.id, { relationshipContradictions: (e.target as HTMLTextAreaElement).value })}
    ></textarea>
  </div>
</div>
