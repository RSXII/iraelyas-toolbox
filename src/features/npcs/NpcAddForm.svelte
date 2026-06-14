<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import { slugify } from './utils';
  import type { NPCType, FactionConfig } from '@/types/index';

  interface Props {
    factionConfigs: FactionConfig[];
    onclose: () => void;
  }
  let { factionConfigs, onclose }: Props = $props();

  const cid = $derived(store.activeCampaignId);

  // ─── Form state ───────────────────────────────────────────────
  let addName        = $state('');
  let addRole        = $state('');
  let addFaction     = $state('');
  let addType        = $state<NPCType>('scene');
  let addNameInputEl = $state<HTMLInputElement | null>(null);

  // Reset + focus when mounted
  $effect(() => {
    addName    = '';
    addRole    = '';
    addFaction = factionConfigs[0]?.id ?? '';
    addType    = 'scene';
    setTimeout(() => addNameInputEl?.focus(), 50);
  });

  // ─── Actions ──────────────────────────────────────────────────
  function confirmAdd(): void {
    const name = addName.trim();
    if (!name) { showToast('Name required');              return; }
    if (!cid)  { showToast('Select a campaign first');   return; }

    const selectedFc = factionConfigs.find((fc) => fc.id === addFaction);
    const faction    = selectedFc ? selectedFc.name : 'Unaffiliated';
    const factionId  = selectedFc ? selectedFc.id   : undefined;

    let id = slugify(name);
    const existing = store.getSchema(cid).npcs;
    if (existing.find((n) => n.id === id)) {
      id = `${id}_${Date.now()}`;
    }

    store.addNPC(cid, {
      id,
      name,
      role: addRole.trim() || '—',
      faction,
      factionId,
      npcType: addType,
    });

    showToast(`${name} added`);
    onclose();
  }
</script>

<div class="npc-add-form">
  <div class="npc-add-form-title">New NPC</div>
  <div class="npc-add-form-grid">
    <div class="npc-field-group">
      <label class="npc-field-label" for="add-npc-name">Name</label>
      <input id="add-npc-name" type="text" class="npc-field-input"
        bind:value={addName}
        bind:this={addNameInputEl}
        onkeydown={(e) => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') onclose(); }}
        placeholder="NPC name" />
    </div>
    <div class="npc-field-group">
      <label class="npc-field-label" for="add-npc-role">Role / Title</label>
      <input id="add-npc-role" type="text" class="npc-field-input"
        bind:value={addRole}
        placeholder="e.g. Guard Captain" />
    </div>
    <div class="npc-field-group">
      <label class="npc-field-label" for="add-npc-faction">Faction</label>
      <select id="add-npc-faction" class="npc-field-input" bind:value={addFaction}>
        <option value="">Unaffiliated</option>
        {#each factionConfigs as fc (fc.id)}
          <option value={fc.id}>{fc.name}</option>
        {/each}
      </select>
    </div>
  </div>
  <div class="npc-add-form-type-row">
    <span class="npc-add-form-type-label">Type:</span>
    <div class="npc-type-selector" style="flex:1;">
      <button class="npc-type-btn" class:active-scene={addType === 'scene'}
        onclick={() => addType = 'scene'}>Scene</button>
      <button class="npc-type-btn" class:active-recurring={addType === 'recurring'}
        onclick={() => addType = 'recurring'}>Recurring</button>
      <button class="npc-type-btn" class:active-major={addType === 'major'}
        onclick={() => addType = 'major'}>Major</button>
    </div>
  </div>
  <div class="npc-add-form-actions">
    <button class="btn btn-sm" onclick={onclose}>Cancel</button>
    <button class="btn btn-gold btn-sm" onclick={confirmAdd}>Add NPC</button>
  </div>
</div>
