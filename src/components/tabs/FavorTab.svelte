<script lang="ts">
  import { slide } from 'svelte/transition';
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { NPC, FavorTier } from '@/types/index';

  interface Props { active?: boolean; onswitchToNPCs?: () => void; }
  let { active = false, onswitchToNPCs }: Props = $props();

  // ─── Helpers ─────────────────────────────────────────────────
  function favorMeta(score: number, tiers: FavorTier[]): { word: string; color: string } {
    const sorted = [...tiers].sort((a, b) => b.threshold - a.threshold);
    const match = sorted.find((t) => score >= t.threshold);
    const fallback = sorted[sorted.length - 1] ?? { label: '—', color: '#888888' };
    const tier = match ?? fallback;
    return { word: tier.label, color: tier.color };
  }

  function initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  }

  function cap(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  // ─── Reactive campaign data ───────────────────────────────────
  const cid      = $derived(store.activeCampaignId);
  const cd       = $derived(store.activeCampaignData);
  const players  = $derived(cid ? store.getParty(cid).pcs : []);
  const pid      = $derived(store.activePlayerId);
  const pd       = $derived(pid && cd ? cd.players[pid] : null);

  // FactionConfig entries drive all grouping now
  const factionConfigs = $derived(cid ? store.getFactions(cid).factions : []);
  const factionIds     = $derived(new Set(factionConfigs.map((fc) => fc.id)));

  // NPCs with no factionId (or unknown factionId)
  const unaffiliatedNpcs = $derived(
    cd ? cd.schema.npcs.filter(
      (n) => !n.isFactionHeader && (!n.factionId || !factionIds.has(n.factionId))
    ) : []
  );

  // Favor settings (tiers + increment) for the active campaign
  const favorSettings = $derived(cid ? store.getFavorSettings(cid) : null);
  const tiers         = $derived(favorSettings?.tiers ?? []);
  const increment     = $derived(favorSettings?.increment ?? 5);

  // Tiers sorted ascending for display (legend, tier editor)
  const tiersAsc = $derived([...tiers].sort((a, b) => a.threshold - b.threshold));

  // Auto-select first player if none is valid for this campaign
  $effect(() => {
    if (cid && players.length && (!pid || !players.find((p) => p.id === pid))) {
      store.setActivePlayer(players[0].id);
      store.patchPlayerScores(cid, players[0].id);
    }
  });

  // Auto-initialise PlayerData for any party PC that doesn't have an entry yet
  // (handles manual JSON migration: existing entries keyed by GUID just work)
  $effect(() => {
    if (!cid || !cd) return;
    players.forEach((pc) => {
      if (!cd.players[pc.id]) {
        store.upsertPlayer(cid, pc.id, { player: pc.name, scores: {} });
        store.patchPlayerScores(cid, pc.id);
      }
    });
  });

  // ─── Faction ordering ─────────────────────────────────────────
  // factionConfigs already ordered by FactionConfig array order

  // ─── Filter & display state ───────────────────────────────────
  // activeFilter: 'all' | FactionConfig.id | '__unaffiliated__'
  let activeFilter = $state('all');
  let editEnabled  = $state(false);

  const visibleConfigs = $derived(
    activeFilter === 'all' || activeFilter === '__unaffiliated__'
      ? factionConfigs
      : factionConfigs.filter((fc) => fc.id === activeFilter)
  );
  const showUnaffiliated = $derived(
    unaffiliatedNpcs.length > 0 && (activeFilter === 'all' || activeFilter === '__unaffiliated__')
  );

  // ─── Player actions ───────────────────────────────────────────
  function switchPlayer(id: string): void {
    if (!id || !cid) return;
    store.setActivePlayer(id);
    store.patchPlayerScores(cid, id);
  }

  async function savePlayer(): Promise<void> {
    if (!cid || !pid) return;
    store.patchPlayerScores(cid, pid);
    await store.forceSave();
    showToast(`${pd?.player ?? pid} saved`);
  }

  // ─── NPC actions ─────────────────────────────────────────────
  function deleteNPC(npc: NPC): void {
    if (!cid) return;
    if (!confirm(`Remove ${npc.name}? This will delete their scores for all players.`)) return;
    store.deleteNPC(cid, npc.id);
  }

  function adjust(npcId: string, delta: number): void {
    if (!cid || !pid) { showToast('Select a player first'); return; }
    store.adjustFavorScore(cid, pid, npcId, delta);
  }

  function adjustRenown(factionId: string, delta: number): void {
    if (!cid || !pid) { showToast('Select a player first'); return; }
    store.adjustFactionRenown(cid, factionId, pid, delta);
  }

  function moveFaction(factionId: string, direction: 'up' | 'down'): void {
    if (!cid) return;
    store.moveFactionConfig(cid, factionId, direction);
  }

  // ─── Tier editor helpers ──────────────────────────────────────
  const STEP_OPTIONS = [1, 5, 10, 25] as const;

  function setIncrement(v: 1 | 5 | 10 | 25): void {
    if (!cid) return;
    store.setFavorIncrement(cid, v);
  }

  function addTier(): void {
    if (!cid) return;
    // Default new tier at midpoint of last gap or at 50
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

  // ─── Scroll anchor: keep options row pinned when tier editor expands ──
  let tierEditorEl = $state<HTMLElement | null>(null);
  let optionsEl    = $state<HTMLElement | null>(null);

  $effect(() => {
    if (!tierEditorEl || !optionsEl) return;

    const panel = tierEditorEl.closest<HTMLElement>('.tab-panel');
    if (!panel) return;

    // Only anchor when options row is near the bottom of the panel viewport
    const panelRect   = panel.getBoundingClientRect();
    const optionsRect = optionsEl.getBoundingClientRect();
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

<div class="tab-panel" id="panel-favor" class:active>
  <div class="favor-inner">

    <!-- Header: player viewer + controls -->
    <div class="favor-header">
      <div class="favor-player-block">
        <h2>Viewing as</h2>
        <div class="favor-player-name">{pd?.player ?? '—'}</div>
      </div>
      <div class="favor-controls">
        <select
          class="topbar-select"
          style="min-width: 160px"
          value={pid}
          onchange={(e) => switchPlayer((e.target as HTMLSelectElement).value)}
        >
          {#if players.length}
            {#each players as pc}
              <option value={pc.id}>{pc.name}</option>
            {/each}
          {:else}
            <option value="">No players</option>
          {/if}
        </select>
        <button class="btn btn-gold btn-sm" onclick={savePlayer}>Save</button>
      </div>
    </div>

    <!-- Faction filter chips -->
    <div class="filter-row">
      <span class="filter-label">Filter:</span>
      <button class="filter-chip" class:active={activeFilter === 'all'} onclick={() => (activeFilter = 'all')}>All</button>
      {#each factionConfigs as fc (fc.id)}
        <button class="filter-chip" class:active={activeFilter === fc.id} onclick={() => (activeFilter = fc.id)}>{fc.name}</button>
      {/each}
      {#if unaffiliatedNpcs.length}
        <button class="filter-chip" class:active={activeFilter === '__unaffiliated__'} onclick={() => (activeFilter = '__unaffiliated__')}>Unaffiliated</button>
      {/if}
    </div>

    <!-- NPC list grouped by FactionConfig -->
    <div id="npc-list">
      {#if !cd || !cid}
        <div class="empty-state">Select or create a campaign to begin.</div>
      {:else if !players.length}
        <div class="empty-state">Add players in the Party tab to track favor.</div>
      {:else if !factionConfigs.length && !unaffiliatedNpcs.length}
        <div class="empty-state">No factions or NPCs yet — create factions in the Factions tab, then add NPCs in NPC Creator.</div>
      {:else}
        {#each visibleConfigs as fc, fcIdx (fc.id)}
          {@const factionNpcs = cd.schema.npcs.filter((n) => n.factionId === fc.id)}
          {@const renownScore = fc.renown?.[pid ?? ''] ?? 50}
          {@const renownMeta  = favorMeta(renownScore, tiers)}

          <div class="section-head">
            <span class="section-name">{fc.name}</span>
            {#if editEnabled}
              <div class="faction-reorder-btns">
                <button class="reorder-arrow" title="Move faction up"
                  disabled={fcIdx === 0}
                  onclick={() => moveFaction(fc.id, 'up')}>▲</button>
                <button class="reorder-arrow" title="Move faction down"
                  disabled={fcIdx >= visibleConfigs.length - 1}
                  onclick={() => moveFaction(fc.id, 'down')}>▼</button>
              </div>
            {/if}
            <div class="section-line"></div>
          </div>

          <!-- Renown row -->
          <div class="npc-row faction-header">
            <div class="npc-left">
              <div style="width:28px"></div>
              <div class="reorder-btns" style="visibility:hidden">
                <button class="reorder-arrow" disabled>▲</button>
                <button class="reorder-arrow" disabled>▼</button>
              </div>
              <div class="npc-initials" style="font-size:10px">{fc.name.slice(0,2).toUpperCase()}</div>
              <div class="npc-info">
                <div class="npc-name">{fc.name} <span class="faction-header-badge">Renown</span></div>
                <div class="npc-role">Faction</div>
              </div>
            </div>
            <div class="npc-right">
              <div class="meter-wrap">
                <div class="meter-top">
                  <span class="favor-word" style="color: {renownMeta.color}">{renownMeta.word}</span>
                  <span class="score-num">{renownScore}</span>
                </div>
                <div class="meter-track">
                  <div class="meter-fill" style="width: {renownScore}%; background: {renownMeta.color}"></div>
                </div>
              </div>
              <div class="step-btns">
                <button class="step-btn" onclick={() => adjustRenown(fc.id, -increment)}>−</button>
                <button class="step-btn" onclick={() => adjustRenown(fc.id, increment)}>+</button>
              </div>
            </div>
          </div>

          <!-- Member NPCs -->
          {#each factionNpcs as npc, i (npc.id)}
            {@const score = pd?.scores[npc.id] ?? 50}
            {@const { word, color } = favorMeta(score, tiers)}
            {@const rankName = fc.ranks.find((r) => r.id === fc.npcRanks?.[npc.id])?.name}
            <div class="npc-row">
              <div class="npc-left">
                <button class="btn-icon danger" title="Remove NPC"
                  style="display: {editEnabled ? 'flex' : 'none'}"
                  onclick={() => deleteNPC(npc)}>✕</button>
                <div class="reorder-btns">
                  <button class="reorder-arrow" title="Move up" disabled={i === 0}
                    onclick={() => store.reorderNPC(cid!, npc.id, -1)}>▲</button>
                  <button class="reorder-arrow" title="Move down" disabled={i === factionNpcs.length - 1}
                    onclick={() => store.reorderNPC(cid!, npc.id, 1)}>▼</button>
                </div>
                <div class="npc-initials">{initials(npc.name)}</div>
                <div class="npc-info">
                  <div class="npc-name">{npc.name}</div>
                  {#if editEnabled}
                    <input class="npc-role-input" type="text" value={npc.role} placeholder="Role or title"
                      onchange={(e) => store.updateNPCRole(cid!, npc.id, (e.target as HTMLInputElement).value)} />
                  {:else}
                    <div class="npc-role">{npc.role}</div>
                  {/if}
                  {#if rankName}<div class="npc-rank-label">{rankName}</div>{/if}
                  <span class="npc-type-badge {npc.npcType ?? 'scene'}">{npc.npcType === 'recurring' ? 'Recurring' : npc.npcType === 'major' ? 'Major' : 'Scene'}</span>
                </div>
              </div>
              <div class="npc-right">
                <div class="meter-wrap">
                  <div class="meter-top">
                    <span class="favor-word" style="color: {color}">{word}</span>
                    <span class="score-num">{score}</span>
                  </div>
                  <div class="meter-track">
                    <div class="meter-fill" style="width: {score}%; background: {color}"></div>
                  </div>
                </div>
                <div class="step-btns">
                  <button class="step-btn" onclick={() => adjust(npc.id, -increment)}>−</button>
                  <button class="step-btn" onclick={() => adjust(npc.id, increment)}>+</button>
                </div>
              </div>
            </div>
          {/each}
        {/each}

        <!-- Unaffiliated group -->
        {#if showUnaffiliated}
          <div class="section-head">
            <span class="section-name">Unaffiliated</span>
            <div class="section-line"></div>
          </div>
          {#each unaffiliatedNpcs as npc, i (npc.id)}
            {@const score = pd?.scores[npc.id] ?? 50}
            {@const { word, color } = favorMeta(score, tiers)}
            <div class="npc-row">
              <div class="npc-left">
                <button class="btn-icon danger" title="Remove NPC"
                  style="display: {editEnabled ? 'flex' : 'none'}"
                  onclick={() => deleteNPC(npc)}>✕</button>
                <div class="reorder-btns">
                  <button class="reorder-arrow" disabled>▲</button>
                  <button class="reorder-arrow" disabled>▼</button>
                </div>
                <div class="npc-initials">{initials(npc.name)}</div>
                <div class="npc-info">
                  <div class="npc-name">{npc.name}</div>
                  {#if editEnabled}
                    <input class="npc-role-input" type="text" value={npc.role} placeholder="Role or title"
                      onchange={(e) => store.updateNPCRole(cid!, npc.id, (e.target as HTMLInputElement).value)} />
                  {:else}
                    <div class="npc-role">{npc.role}</div>
                  {/if}
                  <span class="npc-type-badge {npc.npcType ?? 'scene'}">{npc.npcType === 'recurring' ? 'Recurring' : npc.npcType === 'major' ? 'Major' : 'Scene'}</span>
                </div>
              </div>
              <div class="npc-right">
                <div class="meter-wrap">
                  <div class="meter-top">
                    <span class="favor-word" style="color: {color}">{word}</span>
                    <span class="score-num">{score}</span>
                  </div>
                  <div class="meter-track">
                    <div class="meter-fill" style="width: {score}%; background: {color}"></div>
                  </div>
                </div>
                <div class="step-btns">
                  <button class="step-btn" onclick={() => adjust(npc.id, -increment)}>−</button>
                  <button class="step-btn" onclick={() => adjust(npc.id, increment)}>+</button>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      {/if}
    </div><!-- /npc-list -->

    <!-- Create NPC shortcut -->
    <div class="add-npc-panel">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <span style='font-family:"Cinzel",serif;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold-dim)'>
          NPCs are managed in the NPC Creator tab
        </span>
        <button class="btn btn-gold btn-sm" onclick={() => onswitchToNPCs?.()}>
          ➕ Create NPC →
        </button>
      </div>
    </div>

    <!-- Tier editor (visible when editing is enabled) -->
    {#if editEnabled && cid}
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
    {/if}

    <!-- Edit toggle -->
    <div class="favor-options" bind:this={optionsEl}>
      <label class="favor-option-toggle">
        <input type="checkbox" bind:checked={editEnabled} />
        <span>Enable NPC editing</span>
      </label>
    </div>

    <!-- Legend (dynamic, from campaign tiers) -->
    <div class="favor-legend">
      {#each tiersAsc as t, i}
        {@const nextThreshold = tiersAsc[i + 1]?.threshold ?? 101}
        <div class="leg-item">
          <div class="leg-dot" style="background: {t.color}"></div>
          {t.label} ({t.threshold}–{nextThreshold - 1})
        </div>
      {/each}
    </div>

  </div>
</div>

<!-- (Add Player modal removed — players are managed in the Party tab) -->
