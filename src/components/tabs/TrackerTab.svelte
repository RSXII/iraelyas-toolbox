// This file has been refactored into src/features/tracker/
// It is safe to delete.

  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  // ─── Helpers ─────────────────────────────────────────────────
  function genId(): string {
    return `tracker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function barColor(pct: number, hasWarning: boolean): string {
    if (hasWarning) return 'var(--hostile)';
    if (pct >= 0.75) return 'var(--allied)';
    if (pct >= 0.4) return 'var(--friendly)';
    return 'var(--neutral)';
  }

  function activeWarnings(entry: TrackerEntry): TrackerWarning[] {
    return entry.warnings
      .filter((w) => entry.current >= w.value)
      .sort((a, b) => a.value - b.value);
  }

  // ─── Reactive tracker data ───────────────────────────────────
  const entries    = $derived(store.activeCampaignId ? store.getTracker(store.activeCampaignId).entries : []);
  const categories = $derived([...new Set(entries.map((e) => e.category))]);

  // ─── Filter state ─────────────────────────────────────────────
  let activeFilter = $state('all');

  const visibleCats = $derived(
    activeFilter === 'all' ? categories : categories.filter((c) => c === activeFilter)
  );

  // ─── Modal state ─────────────────────────────────────────────
  let showModal       = $state(false);
  let editingId       = $state<string | null>(null);
  let modalTitle      = $state('Add Custom Tracker');
  let modalName       = $state('');
  let modalCat        = $state('');
  let modalMin        = $state(0);
  let modalMax        = $state(10);
  let modalStart      = $state(0);
  let modalDir        = $state<TrackerDirection>('countup');
  let modalWarnings   = $state<TrackerWarning[]>([]);
  let nameInputEl     = $state<HTMLInputElement | null>(null);

  function openAdd(): void {
    editingId     = null;
    modalTitle    = 'Add Custom Tracker';
    modalName     = '';
    modalCat      = '';
    modalMin      = 0;
    modalMax      = 10;
    modalStart    = 0;
    modalDir      = 'countup';
    modalWarnings = [];
    showModal     = true;
    setTimeout(() => nameInputEl?.focus(), 50);
  }

  function openEdit(entry: TrackerEntry): void {
    editingId     = entry.id;
    modalTitle    = 'Edit Custom Tracker';
    modalName     = entry.name;
    modalCat      = entry.category;
    modalMin      = entry.min;
    modalMax      = entry.max;
    modalStart    = entry.current;
    modalDir      = entry.direction;
    modalWarnings = entry.warnings.map((w) => ({ ...w }));
    showModal     = true;
    setTimeout(() => nameInputEl?.focus(), 50);
  }

  function closeModal(): void {
    showModal   = false;
    editingId   = null;
    modalWarnings = [];
  }

  function saveModal(): void {
    const cid = store.activeCampaignId;
    if (!cid) return;

    const name = modalName.trim();
    const cat  = modalCat.trim();

    if (!name)                       { showToast('Name is required');             return; }
    if (!cat)                        { showToast('Category is required');          return; }
    if (isNaN(modalMin) || isNaN(modalMax)) { showToast('Min and max are required'); return; }
    if (modalMax <= modalMin)        { showToast('Max must be greater than min');  return; }
    if (modalStart < modalMin || modalStart > modalMax) {
      showToast(`Starting value must be between ${modalMin} and ${modalMax}`);
      return;
    }

    const validWarnings = modalWarnings.filter((w) => w.label.trim() !== '');
    const bad = validWarnings.find((w) => w.value < modalMin || w.value > modalMax);
    if (bad) {
      showToast(`Warning value ${bad.value} is outside range ${modalMin}–${modalMax}`);
      return;
    }

    const entry: TrackerEntry = {
      id: editingId ?? genId(),
      name, category: cat,
      min: modalMin, max: modalMax, current: modalStart,
      direction: modalDir,
      warnings: validWarnings,
    };

    store.upsertTrackerEntry(cid, entry);
    closeModal();
    showToast(editingId ? `${name} updated` : `${name} added`);
  }

  function deleteEntry(entry: TrackerEntry): void {
    if (!confirm(`Delete "${entry.name}"?`)) return;
    const cid = store.activeCampaignId;
    if (!cid) return;
    store.deleteTrackerEntry(cid, entry.id);
    showToast(`${entry.name} deleted`);
  }

  // ─── Keyboard shortcuts ───────────────────────────────────────
  onMount(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && showModal) closeModal();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && showModal) saveModal();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

<div class="tab-panel" id="panel-tracker" class:active>
  <div class="tracker-inner">

    <!-- Header -->
    <div class="tracker-header">
      <div style='font-family:"Cinzel",serif;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold-dim)'>
        Custom Trackers
      </div>
      <button class="btn btn-gold btn-sm" onclick={openAdd}>+ Add Tracker</button>
    </div>

    <!-- Filter chips -->
    <div class="filter-row">
      <span class="filter-label">Filter:</span>
      <button class="filter-chip" class:active={activeFilter === 'all'} onclick={() => (activeFilter = 'all')}>All</button>
      {#each categories as cat}
        <button class="filter-chip" class:active={activeFilter === cat} onclick={() => (activeFilter = cat)}>{cat}</button>
      {/each}
    </div>

    <!-- Entry list -->
    <div class="tracker-list">
      {#if !store.activeCampaignId}
        <div class="empty-state">Select or create a campaign to begin.</div>
      {:else if !entries.length}
        <div class="empty-state">No trackers yet — add one below.</div>
      {:else if !visibleCats.length}
        <div class="empty-state">No trackers in this category.</div>
      {:else}
        {#each visibleCats as cat}
          {@const group = entries.filter((e) => e.category === cat)}
          {#if group.length}
            <!-- Section header -->
            <div class="section-head">
              <span class="section-name">{cat}</span>
              <div class="section-line"></div>
            </div>
            <!-- Cards -->
            {#each group as entry, i (entry.id)}
              {@const range      = entry.max - entry.min}
              {@const pct        = range === 0 ? 0 : (entry.current - entry.min) / range}
              {@const warnings   = activeWarnings(entry)}
              {@const hasWarning = warnings.length > 0}
              <div class="tracker-card" class:has-warning={hasWarning}>

                <!-- Top row -->
                <div class="tracker-card-top">
                  <div class="tracker-card-left">
                    <div class="reorder-btns">
                      <button class="reorder-arrow" title="Move up" disabled={i === 0}
                        onclick={() => store.reorderTrackerEntry(store.activeCampaignId!, entry.id, -1)}>▲</button>
                      <button class="reorder-arrow" title="Move down" disabled={i === group.length - 1}
                        onclick={() => store.reorderTrackerEntry(store.activeCampaignId!, entry.id, 1)}>▼</button>
                    </div>
                    <div class="tracker-name">{entry.name}</div>
                  </div>
                  <div class="tracker-card-actions">
                    <button class="btn-icon" title="Edit tracker" onclick={() => openEdit(entry)}>✎</button>
                    <button class="btn-icon danger" title="Delete tracker" onclick={() => deleteEntry(entry)}>✕</button>
                  </div>
                </div>

                <!-- Progress row -->
                <div class="tracker-progress-row">
                  <div class="tracker-bar-wrap">
                    <div
                      class="tracker-bar-fill {entry.direction}"
                      style="width: {pct * 100}%; background: {barColor(pct, hasWarning)}"
                    ></div>
                  </div>
                  <div class="tracker-value-display">
                    {entry.current} <span class="tracker-max">/ {entry.max}</span>
                  </div>
                  <div class="tracker-step-btns">
                    <button class="step-btn" disabled={entry.current <= entry.min}
                      onclick={() => store.adjustTrackerValue(store.activeCampaignId!, entry.id, -1)}>−</button>
                    <button class="step-btn" disabled={entry.current >= entry.max}
                      onclick={() => store.adjustTrackerValue(store.activeCampaignId!, entry.id, 1)}>+</button>
                  </div>
                </div>

                <!-- Warning labels -->
                {#if warnings.length}
                  <div class="tracker-warnings">
                    {#each warnings as w}
                      <div class="tracker-warning-label">{w.label}</div>
                    {/each}
                  </div>
                {/if}

              </div><!-- /tracker-card -->
            {/each}
          {/if}
        {/each}
      {/if}
    </div><!-- /tracker-list -->

  </div>
</div>

<!-- Add / Edit Tracker modal -->
<div class="modal-overlay" class:open={showModal}>
  <div class="modal modal-tracker">
    <h3>{modalTitle}</h3>

    <div class="field-group" style="margin-bottom: 10px">
      <label class="field-label" for="tracker-name-svelte">Name</label>
      <input id="tracker-name-svelte" type="text" bind:this={nameInputEl} bind:value={modalName}
        placeholder="e.g. Reginald's Deaths" />
    </div>

    <div class="field-group" style="margin-bottom: 10px">
      <label class="field-label" for="tracker-cat-svelte">Category</label>
      <input id="tracker-cat-svelte" type="text" bind:value={modalCat} placeholder="e.g. Characters" />
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
      <div class="field-group">
        <label class="field-label" for="tracker-min-svelte">Min</label>
        <input id="tracker-min-svelte" type="number" bind:value={modalMin} />
      </div>
      <div class="field-group">
        <label class="field-label" for="tracker-max-svelte">Max</label>
        <input id="tracker-max-svelte" type="number" bind:value={modalMax} />
      </div>
      <div class="field-group">
        <label class="field-label" for="tracker-start-svelte">Start at</label>
        <input id="tracker-start-svelte" type="number" bind:value={modalStart} />
      </div>
    </div>

    <div class="field-group" style="margin-bottom: 10px">
      <label class="field-label">Direction</label>
      <div class="direction-toggle">
        <button class="direction-option" class:active={modalDir === 'countup'}
          onclick={() => (modalDir = 'countup')}>↑ Count Up</button>
        <button class="direction-option" class:active={modalDir === 'countdown'}
          onclick={() => (modalDir = 'countdown')}>↓ Count Down</button>
      </div>
    </div>

    <div class="warnings-section-label">Warning Thresholds</div>
    <div class="warnings-list">
      {#each modalWarnings as w, wi}
        <div class="warning-row">
          <input type="number" value={w.value} placeholder="At value"
            oninput={(e) => { w.value = parseInt((e.target as HTMLInputElement).value) || 0; }} />
          <input type="text" value={w.label} placeholder="Warning message…"
            oninput={(e) => { w.label = (e.target as HTMLInputElement).value; }} />
          <button class="btn-icon danger" title="Remove warning"
            onclick={() => modalWarnings.splice(wi, 1)}>✕</button>
        </div>
      {/each}
    </div>
    <button class="add-warning-btn" onclick={() => modalWarnings.push({ value: 0, label: '' })}>
      + Add Warning Threshold
    </button>

    <div class="modal-foot">
      <button class="btn" onclick={closeModal}>Cancel</button>
      <button class="btn btn-gold" onclick={saveModal}>Save</button>
    </div>
  </div>
</div>
