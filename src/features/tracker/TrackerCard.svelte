<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { barColor, activeWarnings } from './utils';
  import type { TrackerEntry } from '@/types/index';

  interface Props {
    entry: TrackerEntry;
    groupIdx: number;
    groupLength: number;
    onedit: (entry: TrackerEntry) => void;
    ondelete: (entry: TrackerEntry) => void;
  }
  let { entry, groupIdx, groupLength, onedit, ondelete }: Props = $props();

  const campaignId  = $derived(store.activeCampaignId);
  const range       = $derived(entry.max - entry.min);
  const pct         = $derived(range === 0 ? 0 : (entry.current - entry.min) / range);
  const warnings    = $derived(activeWarnings(entry));
  const hasWarning  = $derived(warnings.length > 0);
</script>

<div class="tracker-card" class:has-warning={hasWarning}>

  <!-- Top row -->
  <div class="tracker-card-top">
    <div class="tracker-card-left">
      <div class="reorder-btns">
        <button
          class="reorder-arrow"
          title="Move up"
          disabled={groupIdx === 0}
          onclick={() => campaignId && store.reorderTrackerEntry(campaignId, entry.id, -1)}
        >▲</button>
        <button
          class="reorder-arrow"
          title="Move down"
          disabled={groupIdx === groupLength - 1}
          onclick={() => campaignId && store.reorderTrackerEntry(campaignId, entry.id, 1)}
        >▼</button>
      </div>
      <div class="tracker-name">{entry.name}</div>
    </div>
    <div class="tracker-card-actions">
      <button class="btn-icon" title="Edit tracker" onclick={() => onedit(entry)}>✎</button>
      <button class="btn-icon danger" title="Delete tracker" onclick={() => ondelete(entry)}>✕</button>
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
      <button
        class="step-btn"
        disabled={entry.current <= entry.min}
        onclick={() => campaignId && store.adjustTrackerValue(campaignId, entry.id, -1)}
      >−</button>
      <button
        class="step-btn"
        disabled={entry.current >= entry.max}
        onclick={() => campaignId && store.adjustTrackerValue(campaignId, entry.id, 1)}
      >+</button>
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

</div>
