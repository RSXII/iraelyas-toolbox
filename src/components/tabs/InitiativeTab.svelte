<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { InitiativeEntry } from '@/types/index';

  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  // ─── Session-local state (never persisted) ───────────────────
  let entries      = $state<InitiativeEntry[]>([]);
  let currentIndex = $state(0);

  // ─── Derived sorted list (descending roll, stable for ties) ──
  const sortedEntries = $derived(
    [...entries].sort((a, b) => b.roll - a.roll)
  );

  const currentCombatant = $derived(
    sortedEntries.length > 0 ? sortedEntries[currentIndex] : null
  );

  // ─── Helpers ─────────────────────────────────────────────────
  function genId(): string {
    return `init_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function clampIndex(list: InitiativeEntry[]): void {
    if (list.length === 0) { currentIndex = 0; return; }
    if (currentIndex >= list.length) currentIndex = list.length - 1;
  }

  // ─── Turn navigation ─────────────────────────────────────────
  function prevTurn(): void {
    if (sortedEntries.length === 0) return;
    currentIndex = (currentIndex - 1 + sortedEntries.length) % sortedEntries.length;
  }

  function nextTurn(): void {
    if (sortedEntries.length === 0) return;
    currentIndex = (currentIndex + 1) % sortedEntries.length;
  }

  // ─── Remove / Clear ──────────────────────────────────────────
  function removeEntry(id: string): void {
    entries = entries.filter((e) => e.id !== id);
    clampIndex(entries);
  }

  function clearAll(): void {
    entries = [];
    currentIndex = 0;
  }

  // ─── Add PC / NPC modal ──────────────────────────────────────
  let showAddModal  = $state(false);
  let addModalType  = $state<'pc' | 'friendly' | 'enemy'>('enemy');
  let addName       = $state('');
  let addRoll       = $state<number | ''>('');
  let addNameInput  = $state<HTMLInputElement | null>(null);

  function openAddModal(type: 'pc' | 'friendly' | 'enemy'): void {
    if (type === 'enemy') { openEnemyModal(); return; }
    addModalType = type;
    addName = '';
    addRoll = '';
    showAddModal = true;
    setTimeout(() => addNameInput?.focus(), 50);
  }

  function confirmAdd(): void {
    const name = addName.trim();
    if (!name) { showToast('Name required'); return; }
    if (addRoll === '' || isNaN(Number(addRoll))) { showToast('Roll required'); return; }
    entries = [...entries, { id: genId(), name, roll: Number(addRoll), type: addModalType }];
    showAddModal = false;
  }

  // ─── Enemy modal (two-step) ───────────────────────────────────
  interface EnemyRow { name: string; roll: number | ''; }

  let showEnemyModal = $state(false);
  let enemyCount     = $state<number | null>(null);
  let enemyRows      = $state<EnemyRow[]>([]);

  function openEnemyModal(): void {
    enemyCount = null;
    enemyRows = [];
    showEnemyModal = true;
  }

  function selectEnemyCount(n: number): void {
    enemyCount = n;
    enemyRows = Array.from({ length: n }, () => ({ name: '', roll: '' }));
  }

  function confirmAddEnemies(): void {
    const valid = enemyRows.filter((r) => r.name.trim() && r.roll !== '' && !isNaN(Number(r.roll)));
    if (valid.length === 0) { showToast('Fill in at least one enemy'); return; }
    entries = [
      ...entries,
      ...valid.map((r) => ({ id: genId(), name: r.name.trim(), roll: Number(r.roll), type: 'enemy' as const })),
    ];
    showEnemyModal = false;
  }

  // ─── Prefill Party modal ──────────────────────────────────────
  const partyPcs = $derived(
    store.activeCampaignId ? store.getParty(store.activeCampaignId).pcs : []
  );

  let showPrefillModal = $state(false);
  // rolls keyed by PC id
  let prefillRolls = $state<Record<string, number | ''>>({});

  function openPrefillModal(): void {
    if (partyPcs.length === 0) { showToast('No party members found'); return; }
    prefillRolls = Object.fromEntries(partyPcs.map((pc) => [pc.id, '']));
    showPrefillModal = true;
  }

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
    entries = [...entries, ...newEntries];
    showPrefillModal = false;
  }

  // ─── Inline roll editing ─────────────────────────────────────
  let editingRollId = $state<string | null>(null);
  let editingRollVal = $state<number | ''>('');

  function startEditRoll(entry: InitiativeEntry): void {
    editingRollId = entry.id;
    editingRollVal = entry.roll;
  }

  function commitEditRoll(id: string): void {
    if (editingRollVal === '' || isNaN(Number(editingRollVal))) {
      editingRollId = null;
      return;
    }
    entries = entries.map((e) =>
      e.id === id ? { ...e, roll: Number(editingRollVal) } : e
    );
    editingRollId = null;
  }

  function handleRollKeydown(e: KeyboardEvent, id: string): void {
    if (e.key === 'Enter') commitEditRoll(id);
    if (e.key === 'Escape') editingRollId = null;
  }
</script>

<!-- ═══════════════════════════════════════════════════════════════
     PANEL
═══════════════════════════════════════════════════════════════ -->
<div class="tab-panel" id="panel-initiative" class:active>
  <div class="init-inner">

    <!-- ── Current turn banner ── -->
    <div class="init-nav-row">
      <button
        class="init-arrow-btn"
        onclick={prevTurn}
        disabled={sortedEntries.length === 0}
        aria-label="Previous turn"
      >‹</button>

      <div class="init-current-display">
        {#if currentCombatant}
          <span class="init-current-label">Current Turn</span>
          <span class="init-current-name">{currentCombatant.name}</span>
        {:else}
          <span class="init-current-empty">No combatants yet</span>
        {/if}
      </div>

      <button
        class="init-arrow-btn"
        onclick={nextTurn}
        disabled={sortedEntries.length === 0}
        aria-label="Next turn"
      >›</button>
    </div>

    <!-- ── Toolbar ── -->
    <div class="init-controls">
      <button class="btn btn-green btn-sm" onclick={() => openAddModal('pc')}>Add PC</button>
      <button class="btn btn-blue btn-sm" onclick={() => openAddModal('friendly')}>Add Friendly NPC</button>
      <button class="btn btn-sm btn-danger" onclick={() => openAddModal('enemy')}>Add Enemy</button>
      <button class="btn btn-sm" onclick={clearAll}>Clear</button>
    </div>

    <!-- ── Combatant list ── -->
    {#if sortedEntries.length === 0}
      <div class="init-empty">
        <div class="empty-state">No combatants — add some to begin.</div>
        <button class="btn btn-gold btn-sm" onclick={openPrefillModal}>Prefill Party</button>
      </div>
    {:else}
      <div class="init-list">
        {#each sortedEntries as entry (entry.id)}
          <div
            class="init-card"
            class:active-turn={entry.id === currentCombatant?.id}
            class:init-type-pc={entry.type === 'pc'}
            class:init-type-friendly={entry.type === 'friendly'}
            class:init-type-enemy={entry.type === 'enemy'}
          >
            <!-- Roll -->
            <div class="init-roll-col">
              {#if editingRollId === entry.id}
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  class="init-roll-input"
                  type="number"
                  bind:value={editingRollVal}
                  onblur={() => commitEditRoll(entry.id)}
                  onkeydown={(e) => handleRollKeydown(e, entry.id)}
                  autofocus
                />
              {:else}
                <button
                  class="init-roll"
                  onclick={() => startEditRoll(entry)}
                  title="Click to edit roll"
                >{entry.roll}</button>
              {/if}
            </div>

            <!-- Name + type badge -->
            <div class="init-name-col">
              <span class="init-name">{entry.name}</span>
              <span class="init-type-badge">{entry.type === 'pc' ? 'PC' : entry.type === 'friendly' ? 'Friendly' : 'Enemy'}</span>
            </div>

            <!-- Remove -->
            <button
              class="init-remove-btn"
              onclick={() => removeEntry(entry.id)}
              aria-label="Remove {entry.name}"
            >×</button>
          </div>
        {/each}
      </div>
    {/if}

  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     ADD PC / NPC MODAL
═══════════════════════════════════════════════════════════════ -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="modal-overlay"
  class:open={showAddModal}
  role="presentation"
  onclick={() => (showAddModal = false)}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal init-modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <h3>Add {addModalType === 'pc' ? 'PC' : addModalType === 'friendly' ? 'Friendly NPC' : 'Enemy'}</h3>
    <div class="field-group">
      <label class="field-label" for="init-add-name">Name</label>
      <input
        id="init-add-name"
        type="text"
        placeholder="Character name"
        bind:value={addName}
        bind:this={addNameInput}
        onkeydown={(e) => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') showAddModal = false; }}
      />
    </div>
    <div class="field-group">
      <label class="field-label" for="init-add-roll">Initiative Roll</label>
      <input
        id="init-add-roll"
        type="number"
        placeholder="e.g. 18"
        bind:value={addRoll}
        onkeydown={(e) => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') showAddModal = false; }}
      />
    </div>
    <div class="modal-foot">
      <button class="btn btn-gold" onclick={() => confirmAdd()}>Add</button>
      <button class="btn" onclick={() => (showAddModal = false)}>Cancel</button>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     ADD ENEMY MODAL
═══════════════════════════════════════════════════════════════ -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="modal-overlay"
  class:open={showEnemyModal}
  role="presentation"
  onclick={() => (showEnemyModal = false)}
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
        <button class="btn" onclick={() => (showEnemyModal = false)}>Cancel</button>
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
              onkeydown={(e) => { if (e.key === 'Escape') showEnemyModal = false; }}
            />
          </div>
          <div class="field-group" style="margin-bottom:0">
            <label class="field-label" for="enemy-roll-{i}">Initiative Roll</label>
            <input
              id="enemy-roll-{i}"
              type="number"
              placeholder="e.g. 12"
              bind:value={row.roll}
              onkeydown={(e) => { if (e.key === 'Escape') showEnemyModal = false; }}
            />
          </div>
        </div>
      {/each}
      <div class="modal-foot">
        <button class="btn btn-danger" onclick={confirmAddEnemies}>Add</button>
        <button class="btn" onclick={() => (enemyCount = null)}>Back</button>
        <button class="btn" onclick={() => (showEnemyModal = false)}>Cancel</button>
      </div>
    {/if}
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     PREFILL PARTY MODAL
═══════════════════════════════════════════════════════════════ -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="modal-overlay"
  class:open={showPrefillModal}
  role="presentation"
  onclick={() => (showPrefillModal = false)}
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
          onkeydown={(e) => { if (e.key === 'Enter') confirmPrefill(); if (e.key === 'Escape') showPrefillModal = false; }}
        />
      </div>
    {/each}
    <div class="modal-foot">
      <button class="btn btn-gold" onclick={confirmPrefill}>Add to Initiative</button>
      <button class="btn" onclick={() => (showPrefillModal = false)}>Cancel</button>
    </div>
  </div>
</div>
