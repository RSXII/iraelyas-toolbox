<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { NPC } from '@/types/index';

  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  // ─── Helpers ─────────────────────────────────────────────────
  function favorMeta(s: number): { word: string; color: string } {
    if (s < 20) return { word: 'Hostile',  color: 'var(--hostile)'  };
    if (s < 40) return { word: 'Wary',     color: 'var(--wary)'     };
    if (s < 60) return { word: 'Neutral',  color: 'var(--neutral)'  };
    if (s < 80) return { word: 'Friendly', color: 'var(--friendly)' };
    return             { word: 'Allied',   color: 'var(--allied)'   };
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
  // Player list is now driven entirely by the party roster
  const players  = $derived(cid ? store.getParty(cid).pcs : []);
  const pid      = $derived(store.activePlayerId);
  const pd       = $derived(pid && cd ? cd.players[pid] : null);
  const factions = $derived(cd ? [...new Set(cd.schema.npcs.map((n) => n.faction))] : []);

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

  // ─── Filter & display state ───────────────────────────────────
  let activeFilter  = $state('all');
  let editEnabled = $state(false);

  const visibleFactions = $derived(
    activeFilter === 'all' ? factions : factions.filter((f) => f === activeFilter)
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

  // ─── Add NPC form ─────────────────────────────────────────────
  let npcName          = $state('');
  let npcRole          = $state('');
  let npcFactionSelect = $state('');
  let npcFactionNew    = $state('');
  let npcHeader        = $state(false);

  function addNPC(): void {
    const name = npcName.trim();
    const role = npcRole.trim();

    let faction: string;
    if (npcFactionSelect === '__new__') {
      const raw = npcFactionNew.trim();
      // Re-use an existing faction if it matches case-insensitively
      const match = factions.find((f) => f.toLowerCase() === raw.toLowerCase());
      faction = match ?? (raw || 'Unaffiliated');
    } else {
      faction = npcFactionSelect || 'Unaffiliated';
    }

    if (!name) { showToast('Name required'); return; }
    if (!cid)  { showToast('Select a campaign first'); return; }
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (store.getCampaignData(cid).schema.npcs.find((n) => n.id === id)) {
      showToast('NPC already exists');
      return;
    }
    store.addNPC(cid, {
      id, name,
      role: role || '—',
      faction,
      isFactionHeader: npcHeader || undefined,
    });
    npcName = ''; npcRole = ''; npcFactionSelect = ''; npcFactionNew = ''; npcHeader = false;
    showToast(`${name} added`);
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
      {#each factions as f}
        <button class="filter-chip" class:active={activeFilter === f} onclick={() => (activeFilter = f)}>{f}</button>
      {/each}
    </div>

    <!-- NPC list grouped by faction -->
    <div id="npc-list">
      {#if !cd || !cid}
        <div class="empty-state">Select or create a campaign to begin.</div>
      {:else if !cd.schema.npcs.length}
        <div class="empty-state">No NPCs in schema yet — add one below.</div>
      {:else if !players.length}
        <div class="empty-state">Add players in the Party tab to track favor.</div>
      {:else if !visibleFactions.length}
        <div class="empty-state">No NPCs in this faction.</div>
      {:else}
        {#each visibleFactions as f}
          {@const group = cd.schema.npcs.filter((n) => n.faction === f)}
          {#if group.length}
            <div class="section-head">
              <span class="section-name">{f}</span>
              <div class="section-line"></div>
            </div>
            {#each group as npc, i (npc.id)}
              {@const score      = pd?.scores[npc.id] ?? 50}
              {@const { word, color } = favorMeta(score)}
              <div class="npc-row" class:faction-header={npc.isFactionHeader === true}>

                <!-- Left: delete btn + reorder + badge + info -->
                <div class="npc-left">
                  <button
                    class="btn-icon danger"
                    title="Remove NPC"
                    style="display: {editEnabled ? 'flex' : 'none'}"
                    onclick={() => deleteNPC(npc)}
                  >✕</button>
                  <div class="reorder-btns">
                    <button class="reorder-arrow" title="Move up" disabled={i === 0}
                      onclick={() => store.reorderNPC(cid!, npc.id, -1)}>▲</button>
                    <button class="reorder-arrow" title="Move down" disabled={i === group.length - 1}
                      onclick={() => store.reorderNPC(cid!, npc.id, 1)}>▼</button>
                  </div>
                  <div class="npc-initials">{initials(npc.name)}</div>
                  <div class="npc-info">
                    <div class="npc-name">
                      {npc.name}
                      {#if npc.isFactionHeader}<span class="faction-header-badge">Renown</span>{/if}
                    </div>
                    {#if editEnabled}
                      <input
                        class="npc-role-input"
                        type="text"
                        value={npc.role}
                        placeholder="Role or title"
                        onchange={(e) => store.updateNPCRole(cid!, npc.id, (e.target as HTMLInputElement).value)}
                      />
                    {:else}
                      <div class="npc-role">{npc.role}</div>
                    {/if}
                  </div>
                </div>

                <!-- Right: meter + step buttons -->
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
                    <button class="step-btn" onclick={() => adjust(npc.id, -5)}>−</button>
                    <button class="step-btn" onclick={() => adjust(npc.id, 5)}>+</button>
                  </div>
                </div>

              </div><!-- /npc-row -->
            {/each}
          {/if}
        {/each}
      {/if}
    </div><!-- /npc-list -->

    <!-- Add NPC panel -->
    <div class="add-npc-panel">
      <h3>Add NPC to Schema</h3>
      <div class="add-npc-grid">
        <div class="field-group">
          <label class="field-label" for="new-npc-name-svelte">Name</label>
          <input id="new-npc-name-svelte" type="text" bind:value={npcName} placeholder="Full name" />
        </div>
        <div class="field-group">
          <label class="field-label" for="new-npc-role-svelte">Role</label>
          <input id="new-npc-role-svelte" type="text" bind:value={npcRole} placeholder="Role or title" />
        </div>
        <div class="field-group">
          <label class="field-label" for="new-npc-faction-svelte">Faction</label>
          <select id="new-npc-faction-svelte" class="topbar-select" style="width:100%;min-width:0" bind:value={npcFactionSelect}>
            <option value="">— none —</option>
            <option value="__new__">+ New Faction</option>
            {#each factions as f}
              <option value={f}>{f}</option>
            {/each}
          </select>
          {#if npcFactionSelect === '__new__'}
            <input
              class="faction-new-input"
              type="text"
              bind:value={npcFactionNew}
              placeholder="New faction name…"
              style="margin-top:6px"
            />
          {/if}
        </div>
        <button class="btn btn-gold" style="align-self: end" onclick={addNPC}>Add</button>
      </div>
      <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px">
        <input
          type="checkbox"
          id="new-npc-is-header-svelte"
          bind:checked={npcHeader}
          style="accent-color: var(--gold); width: 14px; height: 14px; cursor: pointer"
        />
        <label
          for="new-npc-is-header-svelte"
          style='font-family:"Cinzel",serif;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim);cursor:pointer'
        >
          Faction header — tracks renown for the faction as a whole
        </label>
      </div>
    </div>

    <!-- Edit toggle -->
    <div class="favor-options">
      <label class="favor-option-toggle">
        <input type="checkbox" bind:checked={editEnabled} />
        <span>Enable NPC editing</span>
      </label>
    </div>

    <!-- Legend -->
    <div class="favor-legend">
      <div class="leg-item"><div class="leg-dot" style="background: var(--hostile)"></div>Hostile (0–19)</div>
      <div class="leg-item"><div class="leg-dot" style="background: var(--wary)"></div>Wary (20–39)</div>
      <div class="leg-item"><div class="leg-dot" style="background: var(--neutral)"></div>Neutral (40–59)</div>
      <div class="leg-item"><div class="leg-dot" style="background: var(--friendly)"></div>Friendly (60–79)</div>
      <div class="leg-item"><div class="leg-dot" style="background: var(--allied)"></div>Allied (80–100)</div>
    </div>

  </div>
</div>

<!-- (Add Player modal removed — players are managed in the Party tab) -->
