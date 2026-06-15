<script lang="ts">
  import { showToast } from '@/state/toast.svelte';
  import type { InitiativeEntry } from '@/types/index';
  import { genId, rollD20 } from './utils';

  interface Props {
    open: boolean;
    onadd: (entries: InitiativeEntry[]) => void;
    onclose: () => void;
  }
  let { open, onadd, onclose }: Props = $props();

  interface EnemyRow { name: string; roll: number | ''; mod: number; }

  let enemyCount = $state<number | null>(null);
  let enemyRows  = $state<EnemyRow[]>([]);

  $effect(() => {
    if (!open) return;
    enemyCount = null;
    enemyRows  = [];
  });

  function selectEnemyCount(n: number): void {
    enemyCount = n;
    enemyRows  = Array.from({ length: n }, () => ({ name: '', roll: '', mod: 0 }));
  }

  function confirmAddEnemies(): void {
    const valid = enemyRows.filter((r) => r.name.trim() && r.roll !== '' && !isNaN(Number(r.roll)));
    if (valid.length === 0) { showToast('Fill in at least one enemy'); return; }
    onadd(valid.map((r) => ({ id: genId(), name: r.name.trim(), roll: Number(r.roll), type: 'enemy' as const })));
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
    {#if enemyCount === null}
      <!-- Step 1: pick a count -->
      <h3>Add Enemies</h3>
      <p style="font-size: 12px; color: var(--text-dim); margin-bottom: 1.25rem;">How many enemies?</p>
      <div class="init-count-row">
        {#each [1, 2, 3, 4, 5] as n}
          <button class="btn btn-danger init-count-btn" onclick={() => selectEnemyCount(n)}>{n}</button>
        {/each}
      </div>
      <div class="modal-foot">
        <button class="btn" onclick={onclose}>Cancel</button>
      </div>
    {:else}
      <!-- Step 2: fill in each enemy -->
      <h3>Add {enemyCount === 1 ? 'Enemy' : `${enemyCount} Enemies`}</h3>
      {#each enemyRows as row, i}
        <div class="init-enemy-row">
          <div class="field-group" style="margin-bottom:0">
            <label class="field-label" for="enemy-name-{i}">Name</label>
            <input
              id="enemy-name-{i}"
              type="text"
              placeholder="Enemy name"
              bind:value={row.name}
              onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
            />
          </div>
          <div class="field-group" style="margin-bottom:0">
            <label class="field-label" for="enemy-roll-{i}">Initiative Roll</label>
            <div class="init-roll-with-dice">
              <input
                id="enemy-roll-{i}"
                type="number"
                placeholder="e.g. 12"
                bind:value={row.roll}
                onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
              />
              <button
                class="btn init-dice-btn"
                onclick={() => (row.roll = rollD20(row.mod))}
                title="Roll d20 + modifier"
              >{row.mod > 0 ? `d20+${row.mod}` : 'd20'}</button>
              <button
                class="btn init-mod-btn"
                onclick={() => row.mod++}
                title="Increase modifier"
              >+1</button>
            </div>
          </div>
        </div>
      {/each}
      <div class="modal-foot">
        <button class="btn btn-danger" onclick={confirmAddEnemies}>Add</button>
        <button class="btn" onclick={() => (enemyCount = null)}>Back</button>
        <button class="btn" onclick={onclose}>Cancel</button>
      </div>
    {/if}
  </div>
</div>
