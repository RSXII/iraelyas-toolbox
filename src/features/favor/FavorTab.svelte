<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import FavorNpcList from './FavorNpcList.svelte';
  import TierEditor from './TierEditor.svelte';

  interface Props {
    active?: boolean;
    onswitchToNPCs?: () => void;
  }
  let { active = false, onswitchToNPCs }: Props = $props();

  // ─── Reactive campaign data ───────────────────────────────────
  const cid      = $derived(store.activeCampaignId);
  const cd       = $derived(store.activeCampaignData);
  const players  = $derived(cid ? store.getParty(cid).pcs : []);
  const pid      = $derived(store.activePlayerId);
  const pd       = $derived(pid && cd ? cd.players[pid] : null);

  const factionConfigs = $derived(cid ? store.getFactions(cid).factions : []);
  const factionIds     = $derived(new Set(factionConfigs.map((fc) => fc.id)));

  const unaffiliatedNpcs = $derived(
    cd ? cd.schema.npcs.filter(
      (n) => !n.isFactionHeader && (!n.factionId || !factionIds.has(n.factionId))
    ) : []
  );

  const tiers    = $derived(cid ? (store.getFavorSettings(cid)?.tiers ?? []) : []);
  const tiersAsc = $derived([...tiers].sort((a, b) => a.threshold - b.threshold));

  // ─── Auto-init effects ────────────────────────────────────────
  $effect(() => {
    if (cid && players.length && (!pid || !players.find((p) => p.id === pid))) {
      store.setActivePlayer(players[0].id);
      store.patchPlayerScores(cid, players[0].id);
    }
  });

  $effect(() => {
    if (!cid || !cd) return;
    players.forEach((pc) => {
      if (!cd.players[pc.id]) {
        store.upsertPlayer(cid, pc.id, { player: pc.name, scores: {} });
        store.patchPlayerScores(cid, pc.id);
      }
    });
  });

  // ─── Filter & edit state ──────────────────────────────────────
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

  // ─── DOM ref for tier editor scroll anchor ────────────────────
  let optionsEl = $state<HTMLElement | null>(null);
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

    <!-- NPC list -->
    <FavorNpcList
      {editEnabled}
      {visibleConfigs}
      {unaffiliatedNpcs}
      {showUnaffiliated}
    />

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

    <!-- Tier editor -->
    {#if editEnabled && cid}
      <TierEditor {optionsEl} />
    {/if}

    <!-- Edit toggle -->
    <div class="favor-options" bind:this={optionsEl}>
      <label class="favor-option-toggle">
        <input type="checkbox" bind:checked={editEnabled} />
        <span>Enable NPC editing</span>
      </label>
    </div>

    <!-- Legend -->
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
