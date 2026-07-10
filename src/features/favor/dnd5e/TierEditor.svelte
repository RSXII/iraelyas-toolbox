<script lang="ts">
  import { slide } from 'svelte/transition';
  import { store } from '@/state/store.svelte';
  import type { FavorTier } from '@/types/index';

  interface Props {
    optionsEl: HTMLElement | null;
  }
  let { optionsEl }: Props = $props();

  // ─── Derived from store ───────────────────────────────────────
  const cid       = $derived(store.activeCampaignId);
  const tiers     = $derived(cid ? (store.getFavorSettings(cid)?.tiers ?? []) : []);
  const tiersAsc  = $derived([...tiers].sort((a, b) => a.threshold - b.threshold));
  const increment = $derived(cid ? (store.getFavorSettings(cid)?.increment ?? 5) : 5);

  const STEP_OPTIONS = [1, 5, 10, 25] as const;

  // ─── Actions ─────────────────────────────────────────────────
  function setIncrement(v: 1 | 5 | 10 | 25): void {
    if (!cid) return;
    store.setFavorIncrement(cid, v);
  }

  function addTier(): void {
    if (!cid) return;
    const maxThreshold = tiers.length ? Math.max(...tiers.map((t) => t.threshold)) : 0;
    const newThreshold = Math.min(99, maxThreshold + 10);
    store.addFavorTier(cid, { label: 'New Tier', threshold: newThreshold, color: '#888888' });
  }

  function updateTierLabel(tier: FavorTier, value: string): void {
    if (!cid) return;
    store.updateFavorTier(cid, tier.id, { label: value });
  }

  function updateTierThreshold(tier: FavorTier, value: number): void {
    if (!cid) return;
    const clamped = Math.max(0, Math.min(99, Math.round(value)));
    store.updateFavorTier(cid, tier.id, { threshold: clamped });
  }

  function updateTierColor(tier: FavorTier, value: string): void {
    if (!cid) return;
    store.updateFavorTier(cid, tier.id, { color: value });
  }

  function deleteTier(tier: FavorTier): void {
    if (!cid || tiers.length <= 1) return;
    store.deleteFavorTier(cid, tier.id);
  }

  // ─── Scroll anchor ────────────────────────────────────────────
  let tierEditorEl = $state<HTMLElement | null>(null);

  $effect(() => {
    if (!tierEditorEl || !optionsEl) return;

    const panel = tierEditorEl.closest<HTMLElement>('.tab-panel');
    if (!panel) return;

    const panelRect      = panel.getBoundingClientRect();
    const optionsRect    = optionsEl.getBoundingClientRect();
    const distFromBottom = panelRect.bottom - optionsRect.bottom;
    if (distFromBottom > 200) return;

    let lastHeight = 0;
    const ro = new ResizeObserver((entries) => {
      const newHeight = entries[0].contentRect.height;
      const delta = newHeight - lastHeight;
      lastHeight = newHeight;
      if (delta > 0) panel.scrollBy({ top: delta, behavior: 'instant' });
    });
    ro.observe(tierEditorEl);
    return () => ro.disconnect();
  });
</script>

<div class="tier-editor" transition:slide={{ duration: 220 }} bind:this={tierEditorEl}>
  <div class="tier-editor-header">
    <span class="tier-editor-title">Favor Tiers</span>
    <button class="btn btn-sm" onclick={addTier}>+ Add Tier</button>
  </div>
  <!-- Increment step selector -->
  <div class="tier-editor-step-row">
    <span class="tier-threshold-label">Score increment</span>
    <div class="step-selector">
      {#each STEP_OPTIONS as v}
        <button
          class="step-sel-btn"
          class:active={increment === v}
          onclick={() => setIncrement(v)}
        >±{v}</button>
      {/each}
    </div>
  </div>
  {#each tiersAsc as tier (tier.id)}
    <div class="tier-editor-row">
      <input
        class="tier-color-swatch"
        type="color"
        value={tier.color}
        oninput={(e) => updateTierColor(tier, (e.target as HTMLInputElement).value)}
        title="Tier color"
      />
      <input
        class="tier-label-input"
        type="text"
        value={tier.label}
        placeholder="Tier name"
        onchange={(e) => updateTierLabel(tier, (e.target as HTMLInputElement).value)}
      />
      <span class="tier-threshold-label">from</span>
      <input
        class="tier-threshold-input"
        type="number"
        min="0"
        max="99"
        value={tier.threshold}
        onchange={(e) => updateTierThreshold(tier, parseInt((e.target as HTMLInputElement).value, 10))}
      />
      <button
        class="btn-icon danger"
        title="Delete tier"
        disabled={tiers.length <= 1}
        onclick={() => deleteTier(tier)}
      >✕</button>
    </div>
  {/each}
</div>
