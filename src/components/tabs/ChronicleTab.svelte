<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '@/state/store.svelte';
  import { packRows } from '@/utils/chronicle-layout';
  import { showToast } from '@/state/toast.svelte';
  import type { TimelineData, TimelinePoint, TimelineSpan, TintConfig } from '@/types/index';

  let { active = false }: { active?: boolean } = $props();

  // ── Default tints ──────────────────────────────────────────────
  const DEFAULT_TINTS: Record<string, TintConfig> = {
    lore:      { tint: 'rgba(225,215,195,0.88)', accent: '#9a7848', text: '#3a2e1e' },
    war:       { tint: 'rgba(205,178,162,0.88)', accent: '#8a4830', text: '#3a1a0e' },
    intrigue:  { tint: 'rgba(136,150,207,0.88)', accent: '#7080bf', text: '#1e1630' },
    civic:     { tint: 'rgba(198,208,192,0.88)', accent: '#5a6848', text: '#202818' },
    political: { tint: 'rgba(218,208,175,0.88)', accent: '#807040', text: '#302810' },
    noble:     { tint: 'rgba(205,192,222,0.88)', accent: '#68509a', text: '#2a1e48' },
    faculty:   { tint: 'rgba(215,208,188,0.88)', accent: '#7a6838', text: '#302a18' },
    student:   { tint: 'rgba(188,210,200,0.88)', accent: '#4a6858', text: '#182820' },
  };

  // ── Reactive state ─────────────────────────────────────────────
  let yrWidth = $state(68);

  let cid = $derived(store.activeCampaignId);
  let data: TimelineData | null = $derived(cid ? store.getTimeline(cid) : null);
  let tints = $derived(data ? { ...DEFAULT_TINTS, ...(data.tints ?? {}) } : DEFAULT_TINTS);
  let packedSections = $derived(
    data ? data.sections.map(s => ({ section: s, rows: packRows(s.items) })) : []
  );
  let totalYears = $derived(data ? data.config.endYear - data.config.startYear : 0);
  let labelEvery = $derived(yrWidth < 20 ? 10 : yrWidth < 36 ? 5 : 1);
  let vaultTitle = $derived(data ? data.config.vault : 'Chronicle');
  let chronicleTitle = $derived(data ? `${data.config.vault} — Chronicle` : 'Chronicle');

  // ── DOM refs ───────────────────────────────────────────────────
  let scrollAreaEl = $state<HTMLElement | null>(null);
  let gridInnerEl  = $state<HTMLElement | null>(null);
  let labelColEl   = $state<HTMLElement | null>(null);

  // Label float positions (computed from DOM after render)
  let labelPositions = $state<Record<string, { top: number; height: number }>>({});

  // ── Effects ────────────────────────────────────────────────────
  // Re-align section labels after any layout-changing change
  $effect(() => {
    void data;
    void yrWidth;
    if (!active) return;
    requestAnimationFrame(() => alignLabels());
  });

  // Scroll to current year when tab becomes active or new data loads
  $effect(() => {
    if (active && data) {
      requestAnimationFrame(() => scrollToNow());
    }
  });

  // ── Functions ──────────────────────────────────────────────────
  function alignLabels(): void {
    if (!labelColEl || !gridInnerEl) return;
    const baseTop = gridInnerEl.getBoundingClientRect().top;
    const newPos: Record<string, { top: number; height: number }> = {};
    gridInnerEl.querySelectorAll<HTMLElement>('.tl-section-grid').forEach(grid => {
      const id = grid.dataset.sectionId!;
      const rect = grid.getBoundingClientRect();
      newPos[id] = { top: rect.top - baseTop, height: rect.height };
    });
    labelPositions = newPos;
  }

  function scrollToNow(): void {
    if (!scrollAreaEl || !data) return;
    const nowPx = (data.config.currentYear - data.config.startYear) * yrWidth;
    scrollAreaEl.scrollLeft = nowPx - scrollAreaEl.clientWidth / 2;
  }

  async function importTimelineFile(): Promise<void> {
    const files = await window.toolbox.importFile([
      { name: 'JavaScript', extensions: ['js'] },
      { name: 'JSON', extensions: ['json'] },
    ]);
    if (!files || !files.length) return;
    if (!cid) { showToast('Select a campaign first'); return; }
    try {
      let raw = files[0].content;
      raw = raw
        .replace(/^\s*const\s+TIMELINE_DATA\s*=\s*/, '')
        .replace(/;\s*$/, '');
      const parsed: TimelineData = JSON.parse(raw);
      store.setTimeline(cid, parsed);
      showToast('Timeline imported');
    } catch (err) {
      showToast(`Could not parse timeline — ${(err as Error).message}`);
    }
  }

  function exportTimelineFile(): void {
    if (!cid) return;
    const d = store.getTimeline(cid);
    if (!d) { showToast('No timeline data to export'); return; }
    const output = `const TIMELINE_DATA = ${JSON.stringify(d, null, 2)};\n`;
    window.toolbox.exportFile('timeline-data.js', output).then(result => {
      if (result.ok) showToast('Timeline exported');
    });
  }

  // ── IPC: listen for saves made in the timeline editor window ──
  onMount(() => {
    const onUpdate = async () => {
      const currentCid = store.activeCampaignId;
      if (!currentCid) return;
      const fresh = await window.toolbox.getTimeline(currentCid);
      if (fresh) store.setTimeline(currentCid, fresh);
    };
    window.toolbox.onTimelineUpdated(onUpdate);
    return () => window.toolbox.offTimelineUpdated(onUpdate);
  });
</script>

<div class="tab-panel" id="panel-chronicle" class:active>
  <!-- ── Toolbar ── -->
  <div class="chronicle-toolbar">
    <span class="chronicle-title">{chronicleTitle}</span>
    <div class="chronicle-toolbar-right">
      <span class="chronicle-yr-label">Zoom</span>
      <input
        type="range"
        min="4"
        max="120"
        step="2"
        style="width: 90px; accent-color: var(--gold)"
        bind:value={yrWidth}
      />
      <button class="btn btn-sm" onclick={scrollToNow}>Jump to Now</button>
      <button class="btn btn-sm" onclick={importTimelineFile}>Import Timeline</button>
      <button class="btn btn-sm btn-gold" onclick={exportTimelineFile}>Export Timeline JS</button>
      <button class="btn btn-sm" onclick={() => window.toolbox.openTimelineEditor()}>Edit Timeline</button>
    </div>
  </div>

  <!-- ── Parchment scroll area ── -->
  <div class="chronicle-scroll">
    <div class="tl-page-header">
      <div>
        <div class="tl-page-title">{vaultTitle}</div>
        <div class="tl-page-sub">Chronicle of the realm</div>
      </div>
    </div>

    <div class="tl-card">
      {#if !data}
        <div class="tl-empty">No timeline data — import a timeline-data.js file above.</div>
      {:else}
        <!-- ── Timeline body ── -->
        <div class="tl-body">
          <!-- Label column (pinned, positioned after DOM measurement) -->
          <div class="tl-label-col" bind:this={labelColEl}>
            {#each packedSections as { section } (section.id)}
              <div
                class="tl-label-float"
                data-section-id={section.id}
                style:top="{labelPositions[section.id]?.top ?? 0}px"
                style:height="{labelPositions[section.id]?.height ?? 0}px"
              >
                <span class="tl-section-label">{section.label}</span>
              </div>
            {/each}
          </div>

          <!-- Horizontal scroll area -->
          <div class="tl-scroll-area" bind:this={scrollAreaEl}>
            <div
              class="tl-grid-inner"
              style:width="{totalYears * yrWidth}px"
              bind:this={gridInnerEl}
            >
              <!-- Axis row -->
              <div class="tl-axis-row">
                {#each Array.from({ length: totalYears }, (_, i) => data.config.startYear + i) as yr (yr)}
                  <div class="tl-year-cell" style:width="{yrWidth}px">
                    {(yr - data.config.startYear) % labelEvery === 0 ? `Yr ${yr}` : ''}
                  </div>
                {/each}
              </div>

              <!-- Sections -->
              {#each packedSections as { section, rows }, si (section.id)}
                {#if si > 0}<div class="tl-section-divider"></div>{/if}
                <div class="tl-section-grid" data-section-id={section.id}>
                  <!-- "Now" vertical line -->
                  <div
                    class="tl-now-line"
                    style:left="{(data.config.currentYear - data.config.startYear) * yrWidth}px"
                  ></div>

                  <!-- Packed rows -->
                  {#each rows as rowItems, ri (ri)}
                    <div class="tl-packed-row" style:width="{totalYears * yrWidth}px">
                      <!-- Column guide lines -->
                      <div class="tl-col-lines">
                        {#each Array.from({ length: totalYears }) as _, ci (ci)}
                          <div class="tl-col-line" style:width="{yrWidth}px"></div>
                        {/each}
                      </div>

                      <!-- Timeline items (points and spans) -->
                      {#each rowItems as item, ii (ii)}
                        {#if item.type === 'point'}
                          {@const pt = item as TimelinePoint}
                          {@const tint = tints[pt.tint] ?? DEFAULT_TINTS.lore}
                          <div
                            class="tl-point"
                            style:left="{(pt.year - data.config.startYear) * yrWidth + 2}px"
                          >
                            <div class="tl-point-dot" style:background={tint.accent}></div>
                            <span class="tl-point-label" style:color={tint.text}>{pt.label}</span>
                          </div>
                        {:else}
                          {@const sp = item as TimelineSpan}
                          {@const tint = tints[sp.tint] ?? DEFAULT_TINTS.lore}
                          <div
                            class="tl-bar"
                            style:left="{(sp.start - data.config.startYear) * yrWidth + 1}px"
                            style:width="{(sp.end - sp.start) * yrWidth - 2}px"
                            style:background={tint.tint}
                            style:border-left-color={tint.accent}
                            style:color={tint.text}
                          >
                            <span>{sp.label}</span>
                          </div>
                        {/if}
                      {/each}
                    </div>
                  {/each}
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- ── Legend ── -->
        <div class="tl-legend">
          <div class="tl-leg-item">
            <div class="tl-leg-dot"></div>
            Point event
          </div>
          <div class="tl-leg-item">
            <div
              class="tl-leg-swatch"
              style="background:rgba(225,215,195,0.88);border-left-color:#9a7848;"
            ></div>
            Duration span
          </div>
          <div style="flex:1"></div>
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div class="tl-leg-item" id="tl-jump-now" onclick={scrollToNow}>
            ▎ Current year ({data.config.currentYear})
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
