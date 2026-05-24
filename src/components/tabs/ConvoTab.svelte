<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';

  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  function syncFromParty(): void {
    const cid = store.activeCampaignId;
    if (!cid) { showToast('Select a campaign first'); return; }
    const count = store.getParty(cid).pcs.length;
    if (!count) { showToast('No party members to sync'); return; }
    store.syncConvoPCsFromParty(cid);
    showToast('Synced from party');
  }

  // ─── Mood helper ─────────────────────────────────────────────
  function mood(score: number): { word: string; color: string } {
    if (score <= 3) return { word: 'Poor',     color: 'var(--poor)'     };
    if (score <= 6) return { word: 'Neutral',  color: 'var(--neutral)'  };
    if (score <= 9) return { word: 'Positive', color: 'var(--positive)' };
    return               { word: 'Revered',  color: 'var(--revered)'  };
  }

  // ─── Derived aggregate ───────────────────────────────────────
  const activePCs  = $derived(store.convo.pcs.slice(0, store.convo.pcCount));
  const avgScore   = $derived(activePCs.reduce((a, b) => a + b.score, 0) / activePCs.length);
  const aggMood    = $derived(mood(Math.round(avgScore)));
  const aggBarPct  = $derived(((avgScore - 1) / 9) * 100);
</script>

<div class="tab-panel" id="panel-convo" class:active>
  <div class="convo-inner">

    <!-- Title -->
    <div class="convo-top">
      <input
        type="text"
        class="convo-title-input"
        value={store.convo.title}
        placeholder="Conversation name…"
        onchange={(e) => store.setConvoTitle((e.target as HTMLInputElement).value || 'Generic Conversation')}
      />
    </div>

    <!-- PC count selector -->
    <div class="convo-setup-row">
      <span class="convo-pc-count-label">Active PCs</span>
      <div style="display: flex; gap: 6px">
        {#each [1, 2, 3, 4, 5, 6] as n}
          <button
            class="filter-chip"
            class:active={store.convo.pcCount === n}
            onclick={() => store.setConvoPCCount(n)}
          >{n}</button>
        {/each}
      </div>
      <div style="margin-left: auto; display: flex; gap: 6px">
        <button class="btn btn-sm" onclick={syncFromParty}>Sync from Party</button>
        <button class="btn btn-sm" onclick={() => store.resetConvo()}>Reset to 5</button>
      </div>
    </div>

    <!-- PC slider cards -->
    <div class="convo-sliders">
      {#each activePCs as pc, i}
        {@const m = mood(pc.score)}
        <div class="convo-slider-card">
          <div class="convo-slider-header">
            <input
              type="text"
              class="convo-pc-name-input"
              value={pc.name}
              placeholder="PC {i + 1}"
              onchange={(e) => store.setConvoPCName(i, (e.target as HTMLInputElement).value || `PC ${i + 1}`)}
            />
            <div class="convo-mood-display">
              <span class="convo-mood-word" style="color: {m.color}">{m.word}</span>
              <span class="convo-score-num"  style="color: {m.color}">{pc.score}</span>
            </div>
          </div>
          <div class="convo-track-wrap">
            <div class="convo-track-bg"></div>
            <input
              type="range"
              class="convo-slider"
              min="1" max="10" step="1"
              value={pc.score}
              oninput={(e) => store.setConvoPCScore(i, parseInt((e.target as HTMLInputElement).value))}
            />
          </div>
          <div class="convo-tick-row">
            {#each [1,2,3,4,5,6,7,8,9,10] as n}
              <span class="convo-tick" class:active={n === pc.score}>{n}</span>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <!-- Aggregate -->
    <div class="convo-aggregate">
      <div>
        <div class="agg-label">Room Average</div>
        <div class="agg-mood" style="color: {aggMood.color}">{aggMood.word}</div>
      </div>
      <div class="agg-bar-wrap">
        <div class="agg-bar-fill" style="width: {aggBarPct}%; background: {aggMood.color}"></div>
      </div>
      <div class="agg-score-block">
        <span class="agg-score-num" style="color: {aggMood.color}">{avgScore.toFixed(1)}</span>
        <span class="agg-score-denom">/ 10</span>
      </div>
    </div>

  </div>
</div>
