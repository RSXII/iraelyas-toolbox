<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { InitiativeEntry } from '@/types/index';
  import AddCombatantModal from './AddCombatantModal.svelte';
  import AddEnemyModal from './AddEnemyModal.svelte';
  import PrefillPartyModal from './PrefillPartyModal.svelte';

  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  // ─── Persistent state ────────────────────────────────────────
  let entries      = $state<InitiativeEntry[]>([]);
  let currentIndex = $state(0);
  let turnNumber   = $state(1);

  // ─── Turn number inline editing ───────────────────────────────
  let editingTurn    = $state(false);
  let editingTurnVal = $state<number | ''>('');

  function startEditTurn(): void {
    editingTurnVal = turnNumber;
    editingTurn = true;
  }

  function commitEditTurn(): void {
    const n = Number(editingTurnVal);
    if (editingTurnVal !== '' && !isNaN(n) && n >= 1) {
      turnNumber = Math.round(n);
    }
    editingTurn = false;
  }

  function handleTurnKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') commitEditTurn();
    if (e.key === 'Escape') editingTurn = false;
  }

  // ─── Derived sorted list ──────────────────────────────────────
  const sortedEntries = $derived(
    [...entries].sort((a, b) => b.roll - a.roll)
  );

  const currentCombatant = $derived(
    sortedEntries.length > 0 ? sortedEntries[currentIndex] ?? null : null
  );

  // ─── Helpers ─────────────────────────────────────────────────
  function activeIndices(): number[] {
    return sortedEntries.reduce<number[]>((acc, e, i) => {
      if (!e.incapacitated) acc.push(i);
      return acc;
    }, []);
  }

  function clampIndex(list: InitiativeEntry[]): void {
    if (list.length === 0) { currentIndex = 0; return; }
    if (currentIndex >= list.length) currentIndex = list.length - 1;
    const sorted = [...list].sort((a, b) => b.roll - a.roll);
    if (sorted[currentIndex]?.incapacitated) {
      const actives = sorted.reduce<number[]>((acc, e, i) => {
        if (!e.incapacitated) acc.push(i);
        return acc;
      }, []);
      if (actives.length > 0) {
        currentIndex = actives.find((i) => i >= currentIndex) ?? actives[0];
      }
    }
  }

  // ─── Turn navigation ─────────────────────────────────────────
  function nextTurn(): void {
    const actives = activeIndices();
    if (actives.length === 0) return;
    const posInActives = actives.indexOf(currentIndex);
    if (posInActives === actives.length - 1) {
      turnNumber += 1;
      currentIndex = actives[0];
    } else {
      currentIndex = actives[posInActives + 1] ?? actives[0];
    }
    saveToStore();
  }

  function prevTurn(): void {
    const actives = activeIndices();
    if (actives.length === 0) return;
    const posInActives = actives.indexOf(currentIndex);
    if (posInActives <= 0) {
      turnNumber = Math.max(1, turnNumber - 1);
      currentIndex = actives[actives.length - 1];
    } else {
      currentIndex = actives[posInActives - 1] ?? actives[actives.length - 1];
    }
    saveToStore();
  }

  // ─── Incapacitated ───────────────────────────────────────────
  function toggleIncapacitated(id: string): void {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    entry.incapacitated = !entry.incapacitated;
    if (entry.incapacitated && currentCombatant?.id === id) {
      const actives = activeIndices();
      if (actives.length > 0) {
        currentIndex = actives.find((i) => i > currentIndex) ?? actives[0];
      }
    }
    saveToStore();
  }

  // ─── Persistence ─────────────────────────────────────────────
  function saveToStore(): void {
    const cid = store.activeCampaignId;
    if (!cid) return;
    store.setInitiative(cid, { entries: [...entries], currentIndex, turnNumber });
  }

  function loadFromStore(): void {
    const cid = store.activeCampaignId;
    if (!cid) return;
    const saved = store.getInitiative(cid);
    if (!saved) return;
    entries      = saved.entries ?? [];
    currentIndex = saved.currentIndex ?? 0;
    turnNumber   = saved.turnNumber ?? 1;
    clampIndex(entries);
  }

  $effect(() => {
    if (active) loadFromStore();
  });

  // ─── Remove / Clear ──────────────────────────────────────────
  function removeEntry(id: string): void {
    entries = entries.filter((e) => e.id !== id);
    clampIndex(entries);
    saveToStore();
  }

  function clearAll(): void {
    entries = [];
    currentIndex = 0;
    turnNumber = 1;
    const cid = store.activeCampaignId;
    if (cid) store.clearInitiative(cid);
  }

  // ─── Modal open state ─────────────────────────────────────────
  let showAddModal     = $state(false);
  let addModalType     = $state<'pc' | 'friendly'>('pc');
  let showEnemyModal   = $state(false);
  let showPrefillModal = $state(false);

  const partyPcs = $derived(
    store.activeCampaignId ? store.getParty(store.activeCampaignId).pcs : []
  );

  function openAddModal(type: 'pc' | 'friendly'): void {
    addModalType = type;
    showAddModal = true;
  }

  function openPrefillModal(): void {
    if (partyPcs.length === 0) { showToast('No party members found'); return; }
    showPrefillModal = true;
  }

  // ─── Modal callbacks ──────────────────────────────────────────
  function handleAddEntry(entry: InitiativeEntry): void {
    entries = [...entries, entry];
    saveToStore();
  }

  function handleAddEntries(newEntries: InitiativeEntry[]): void {
    entries = [...entries, ...newEntries];
    saveToStore();
  }

  // ─── Inline roll editing ─────────────────────────────────────
  let editingRollId  = $state<string | null>(null);
  let editingRollVal = $state<number | ''>('');

  function startEditRoll(entry: InitiativeEntry): void {
    editingRollId  = entry.id;
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
    saveToStore();
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

    <!-- ── Turn counter ── -->
    <div class="init-turn-row">
      <span class="init-turn-label">Turn</span>
      {#if editingTurn}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="init-turn-input"
          type="number"
          bind:value={editingTurnVal}
          onblur={commitEditTurn}
          onkeydown={handleTurnKeydown}
          autofocus
        />
      {:else}
        <button class="init-turn-num" onclick={startEditTurn} title="Click to edit turn">{turnNumber}</button>
      {/if}
    </div>

    <!-- ── Current turn banner ── -->
    <div class="init-nav-row">
      <button
        class="init-arrow-btn"
        onclick={prevTurn}
        disabled={activeIndices().length === 0}
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
        disabled={activeIndices().length === 0}
        aria-label="Next turn"
      >›</button>
    </div>

    <!-- ── Toolbar ── -->
    <div class="init-controls">
      <button class="btn btn-green btn-sm" onclick={() => openAddModal('pc')}>Add PC</button>
      <button class="btn btn-blue btn-sm" onclick={() => openAddModal('friendly')}>Add Friendly NPC</button>
      <button class="btn btn-sm btn-danger" onclick={() => (showEnemyModal = true)}>Add Enemy</button>
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
            class:incapacitated={entry.incapacitated}
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

            <!-- Incapacitate toggle -->
            <button
              class="init-incap-btn"
              class:is-incapacitated={entry.incapacitated}
              onclick={() => toggleIncapacitated(entry.id)}
              aria-label={entry.incapacitated ? 'Remove incapacitated from ' + entry.name : 'Incapacitate ' + entry.name}
              title={entry.incapacitated ? 'Remove Incapacitated' : 'Incapacitate'}
            >⊘</button>

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

<!-- ── Modals ── -->
<AddCombatantModal
  open={showAddModal}
  type={addModalType}
  onadd={handleAddEntry}
  onclose={() => (showAddModal = false)}
/>

<AddEnemyModal
  open={showEnemyModal}
  onadd={handleAddEntries}
  onclose={() => (showEnemyModal = false)}
/>

<PrefillPartyModal
  open={showPrefillModal}
  partyPcs={partyPcs}
  onadd={handleAddEntries}
  onclose={() => (showPrefillModal = false)}
/>
