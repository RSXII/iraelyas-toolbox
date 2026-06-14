<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import TrackerCard from './TrackerCard.svelte';
  import TrackerEntryModal from './TrackerEntryModal.svelte';
  import type { TrackerEntry } from '@/types/index';

  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  // ─── Reactive data ────────────────────────────────────────────
  const campaignId = $derived(store.activeCampaignId);
  const entries    = $derived(campaignId ? store.getTracker(campaignId).entries : []);
  const categories = $derived([...new Set(entries.map((e) => e.category))]);

  // ─── Filter state ─────────────────────────────────────────────
  let activeFilter = $state('all');

  const visibleCats = $derived(
    activeFilter === 'all' ? categories : categories.filter((c) => c === activeFilter)
  );

  // ─── Modal state ──────────────────────────────────────────────
  let showModal    = $state(false);
  let editingEntry = $state<TrackerEntry | null>(null);

  function openAdd(): void {
    editingEntry = null;
    showModal    = true;
  }

  function openEdit(entry: TrackerEntry): void {
    editingEntry = entry;
    showModal    = true;
  }

  function handleSave(entry: TrackerEntry): void {
    if (!campaignId) return;
    const isNew = !editingEntry;
    store.upsertTrackerEntry(campaignId, entry);
    showModal    = false;
    editingEntry = null;
    showToast(isNew ? `${entry.name} added` : `${entry.name} updated`);
  }

  function handleDelete(entry: TrackerEntry): void {
    if (!campaignId) return;
    if (!confirm(`Delete "${entry.name}"?`)) return;
    store.deleteTrackerEntry(campaignId, entry.id);
    showToast(`${entry.name} deleted`);
  }
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
      {#if !campaignId}
        <div class="empty-state">Select or create a campaign to begin.</div>
      {:else if !entries.length}
        <div class="empty-state">No trackers yet — add one below.</div>
      {:else if !visibleCats.length}
        <div class="empty-state">No trackers in this category.</div>
      {:else}
        {#each visibleCats as cat}
          {@const group = entries.filter((e) => e.category === cat)}
          {#if group.length}
            <div class="section-head">
              <span class="section-name">{cat}</span>
              <div class="section-line"></div>
            </div>
            {#each group as entry, i (entry.id)}
              <TrackerCard
                {entry}
                groupIdx={i}
                groupLength={group.length}
                onedit={openEdit}
                ondelete={handleDelete}
              />
            {/each}
          {/if}
        {/each}
      {/if}
    </div>

  </div>
</div>

<TrackerEntryModal
  open={showModal}
  editing={editingEntry}
  onsave={handleSave}
  onclose={() => { showModal = false; editingEntry = null; }}
/>
