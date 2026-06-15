<script lang="ts">
  import { showToast } from '@/state/toast.svelte';
  import type { InitiativeEntry, PCCard } from '@/types/index';
  import { genId } from './utils';

  interface Props {
    open: boolean;
    partyPcs: PCCard[];
    onadd: (entries: InitiativeEntry[]) => void;
    onclose: () => void;
  }
  let { open, partyPcs, onadd, onclose }: Props = $props();

  let prefillRolls = $state<Record<string, number | ''>>({});

  $effect(() => {
    if (!open) return;
    prefillRolls = Object.fromEntries(partyPcs.map((pc) => [pc.id, '']));
  });

  function confirmPrefill(): void {
    const newEntries: InitiativeEntry[] = partyPcs
      .filter((pc) => prefillRolls[pc.id] !== '' && !isNaN(Number(prefillRolls[pc.id])))
      .map((pc) => ({
        id: genId(),
        name: pc.name,
        roll: Number(prefillRolls[pc.id]),
        type: 'pc' as const,
      }));
    if (newEntries.length === 0) { showToast('Enter at least one roll'); return; }
    onadd(newEntries);
    onclose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="modal-overlay"
  class:open
  role="presentation"
  onclick={onclose}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal init-modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <h3>Prefill Party</h3>
    <p style="font-size: 12px; color: var(--text-dim); margin-bottom: 1rem;">Enter each PC's initiative roll. Leave blank to skip.</p>
    {#each partyPcs as pc (pc.id)}
      <div class="field-group">
        <label class="field-label" for="prefill-{pc.id}">{pc.name}</label>
        <input
          id="prefill-{pc.id}"
          type="number"
          placeholder="Roll"
          bind:value={prefillRolls[pc.id]}
          onkeydown={(e) => { if (e.key === 'Enter') confirmPrefill(); if (e.key === 'Escape') onclose(); }}
        />
      </div>
    {/each}
    <div class="modal-foot">
      <button class="btn btn-gold" onclick={confirmPrefill}>Add to Initiative</button>
      <button class="btn" onclick={onclose}>Cancel</button>
    </div>
  </div>
</div>
