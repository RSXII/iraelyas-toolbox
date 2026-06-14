<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { resolvedType } from './utils';
  import NpcSceneFields from './NpcSceneFields.svelte';
  import NpcRecurringFields from './NpcRecurringFields.svelte';
  import NpcMajorFields from './NpcMajorFields.svelte';
  import type { NPC, NPCType, FactionConfig } from '@/types/index';

  interface Props {
    npc: NPC | null;
    factionConfigs: FactionConfig[];
    onclose: () => void;
  }
  let { npc, factionConfigs, onclose }: Props = $props();

  const open = $derived(npc !== null);
  const cid  = $derived(store.activeCampaignId);
  const t    = $derived(npc ? resolvedType(npc) : 'scene');

  // ─── Helpers ──────────────────────────────────────────────────
  function patch(update: Partial<Omit<NPC, 'id'>>): void {
    if (!cid || !npc) return;
    store.updateNPC(cid, npc.id, update);
  }

  function onNameChange(val: string): void {
    const name = val.trim() || npc!.name;
    patch({ name });
  }

  function onTypeChange(newType: NPCType): void {
    patch({ npcType: newType });
  }

  function onFactionChange(factionId: string): void {
    const fc = factionConfigs.find((f) => f.id === factionId);
    patch({ factionId: factionId || undefined, faction: fc?.name ?? 'Unaffiliated' });
  }

  // ─── Keyboard: Escape to close ────────────────────────────────
  $effect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onclose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

<div class="modal-overlay" class:open onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}>
  {#if npc}
    <div class="modal modal-npc-detail">

      <!-- Modal header -->
      <div class="npc-detail-modal-header">
        <h3 class="npc-detail-modal-title">{npc.name}</h3>
        <button class="btn-icon" aria-label="Close" onclick={onclose}>✕</button>
      </div>

      <!-- Top row: name / role / faction / type -->
      <div class="npc-card-body-top">
        <div class="npc-field-group">
          <label class="npc-field-label" for="npc-name-{npc.id}">Name</label>
          <input id="npc-name-{npc.id}" type="text" class="npc-field-input"
            value={npc.name}
            onchange={(e) => onNameChange((e.target as HTMLInputElement).value)} />
        </div>
        <div class="npc-field-group">
          <label class="npc-field-label" for="npc-role-{npc.id}">Role / Title</label>
          <input id="npc-role-{npc.id}" type="text" class="npc-field-input"
            value={npc.role}
            onchange={(e) => patch({ role: (e.target as HTMLInputElement).value.trim() || '—' })} />
        </div>
        <div class="npc-field-group">
          <label class="npc-field-label" for="npc-faction-{npc.id}">Faction</label>
          <select id="npc-faction-{npc.id}" class="npc-field-input"
            value={npc.factionId ?? ''}
            onchange={(e) => onFactionChange((e.target as HTMLSelectElement).value)}>
            <option value="">Unaffiliated</option>
            {#each factionConfigs as fc (fc.id)}
              <option value={fc.id}>{fc.name}</option>
            {/each}
          </select>
        </div>
        <div class="npc-field-group" style="grid-column: span 2;">
          <div class="npc-field-label">NPC Type</div>
          <div class="npc-type-selector">
            <button class="npc-type-btn" class:active-scene={t === 'scene'}
              onclick={() => onTypeChange('scene')}>Scene</button>
            <button class="npc-type-btn" class:active-recurring={t === 'recurring'}
              onclick={() => onTypeChange('recurring')}>Recurring</button>
            <button class="npc-type-btn" class:active-major={t === 'major'}
              onclick={() => onTypeChange('major')}>Major</button>
          </div>
          <p class="npc-type-description">
            {#if t === 'scene'}
              <span class="npc-type-description-title">Scene NPC.</span>
              One scene, probably never seen again. Needs a name, a function, one distinctive detail, and one need that could make them interesting if the party pushes.
            {:else if t === 'recurring'}
              <span class="npc-type-description-title">Recurring NPC.</span>
              Shows up multiple times, has a relationship with the party, could become significant.
            {:else}
              <span class="npc-type-description-title">Major NPC.</span>
              Full hierarchy treatment, has internal contradictions, multiple relationships that pull in different directions, a self-actualization question they can't answer.
            {/if}
          </p>
        </div>
      </div>

      <!-- Tier field sections -->
      <NpcSceneFields {npc} />
      {#if t === 'recurring' || t === 'major'}
        <NpcRecurringFields {npc} />
      {/if}
      {#if t === 'major'}
        <NpcMajorFields {npc} />
      {/if}

      <div class="modal-foot">
        <button class="btn btn-gold" onclick={onclose}>Done</button>
      </div>

    </div>
  {/if}
</div>
