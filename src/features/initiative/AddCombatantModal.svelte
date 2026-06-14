<script lang="ts">
  import { showToast } from '@/state/toast.svelte';
  import type { InitiativeEntry } from '@/types/index';
  import { genId, rollD20 } from './utils';

  interface Props {
    open: boolean;
    type: 'pc' | 'friendly';
    onadd: (entry: InitiativeEntry) => void;
    onclose: () => void;
  }
  let { open, type, onadd, onclose }: Props = $props();

  let addName      = $state('');
  let addRoll      = $state<number | ''>('');
  let addRollMod   = $state(0);
  let addNameInput = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (!open) return;
    addName    = '';
    addRoll    = '';
    addRollMod = 0;
    setTimeout(() => addNameInput?.focus(), 50);
  });

  function confirmAdd(): void {
    const name = addName.trim();
    if (!name) { showToast('Name required'); return; }
    if (addRoll === '' || isNaN(Number(addRoll))) { showToast('Roll required'); return; }
    onadd({ id: genId(), name, roll: Number(addRoll), type });
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
    <h3>Add {type === 'pc' ? 'PC' : 'Friendly NPC'}</h3>
    <div class="field-group">
      <label class="field-label" for="init-add-name">Name</label>
      <input
        id="init-add-name"
        type="text"
        placeholder="Character name"
        bind:value={addName}
        bind:this={addNameInput}
        onkeydown={(e) => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') onclose(); }}
      />
    </div>
    <div class="field-group">
      <label class="field-label" for="init-add-roll">Initiative Roll</label>
      <div class="init-roll-with-dice">
        <input
          id="init-add-roll"
          type="number"
          placeholder="e.g. 18"
          bind:value={addRoll}
          onkeydown={(e) => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') onclose(); }}
        />
        <button
          class="btn init-dice-btn"
          onclick={() => (addRoll = rollD20(addRollMod))}
          title="Roll d20 + modifier"
        >{addRollMod > 0 ? `d20+${addRollMod}` : 'd20'}</button>
        <button
          class="btn init-mod-btn"
          onclick={() => addRollMod++}
          title="Increase modifier"
        >+1</button>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-gold" onclick={confirmAdd}>Add</button>
      <button class="btn" onclick={onclose}>Cancel</button>
    </div>
  </div>
</div>
