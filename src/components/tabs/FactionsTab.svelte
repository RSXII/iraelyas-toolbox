<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { FactionConfig, FactionRank } from '@/types/index';

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

  function genId(): string {
    return `rid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  // ─── Derived state ───────────────────────────────────────────
  const campaignId = $derived(store.activeCampaignId);
  const cd         = $derived(campaignId ? store.getCampaignData(campaignId) : null);
  const factions   = $derived(campaignId ? store.getFactions(campaignId).factions : []);

  const schemaFactionHeaders = $derived(
    cd?.schema.npcs.filter((n) => n.isFactionHeader) ?? []
  );

  const availableFactionHeaders = $derived(
    schemaFactionHeaders.filter(
      (n) => !factions.find((fc) => fc.factionNpcId === n.id)
    )
  );

  function getFactionNPC(npcId: string) {
    return cd?.schema.npcs.find((n) => n.id === npcId) ?? null;
  }

  function getPC(pcId: string) {
    return cd?.party.pcs.find((p) => p.id === pcId) ?? null;
  }

  function getFavorScore(pcId: string, npcId: string): number {
    return cd?.players[pcId]?.scores[npcId] ?? 50;
  }

  function availablePCs(fc: FactionConfig) {
    const memberIds = new Set(fc.members.map((m) => m.pcId));
    return cd?.party.pcs.filter((p) => !memberIds.has(p.id)) ?? [];
  }

  // ─── UI state ────────────────────────────────────────────────
  let showAddFaction  = $state(false);
  let newFactionNpcId = $state('');

  // Rank editing
  let editingRanksFor = $state<string | null>(null);
  let rankDraft       = $state<FactionRank[]>([]);
  let newRankName     = $state('');

  // Member adding
  let addMemberFor    = $state<string | null>(null);
  let newMemberPcId   = $state('');
  let newMemberRankId = $state('');

  // ─── Actions ─────────────────────────────────────────────────
  function addFaction() {
    if (!campaignId || !newFactionNpcId) return;
    store.addFactionConfig(campaignId, newFactionNpcId);
    newFactionNpcId = '';
    showAddFaction = false;
    showToast('Faction added');
  }

  function removeFaction(factionId: string) {
    if (!campaignId) return;
    store.removeFactionConfig(campaignId, factionId);
    if (editingRanksFor === factionId) { editingRanksFor = null; rankDraft = []; }
    if (addMemberFor   === factionId) { addMemberFor = null; }
    showToast('Faction removed');
  }

  function openRankEditor(fc: FactionConfig) {
    editingRanksFor = fc.id;
    rankDraft = fc.ranks.map((r) => ({ ...r }));
    newRankName = '';
  }

  function addRankToDraft() {
    const name = newRankName.trim();
    if (!name) return;
    rankDraft.push({ id: genId(), name });
    newRankName = '';
  }

  function removeRankFromDraft(rankId: string) {
    rankDraft = rankDraft.filter((r) => r.id !== rankId);
  }

  function saveRanks() {
    if (!campaignId || !editingRanksFor) return;
    store.setFactionRanks(campaignId, editingRanksFor, [...rankDraft]);
    editingRanksFor = null;
    rankDraft = [];
    showToast('Ranks updated');
  }

  function cancelRanks() {
    editingRanksFor = null;
    rankDraft = [];
  }

  function openAddMember(fc: FactionConfig) {
    addMemberFor    = fc.id;
    newMemberPcId   = '';
    newMemberRankId = fc.ranks[0]?.id ?? '';
  }

  function addMember() {
    if (!campaignId || !addMemberFor || !newMemberPcId) return;
    store.addFactionMember(campaignId, addMemberFor, newMemberPcId, newMemberRankId);
    addMemberFor    = null;
    newMemberPcId   = '';
    newMemberRankId = '';
    showToast('Member added');
  }

  function removeMember(factionId: string, pcId: string) {
    if (!campaignId) return;
    store.removeFactionMember(campaignId, factionId, pcId);
  }

  function setMemberRank(factionId: string, pcId: string, rankId: string) {
    if (!campaignId) return;
    store.setMemberRank(campaignId, factionId, pcId, rankId);
  }
</script>

<div class="tab-panel" id="panel-factions" class:active>

  {#if !cd}
    <p class="empty-msg">No campaign selected.</p>
  {:else}

    <!-- ─── Header bar ─── -->
    <div class="factions-top-bar">
      <h2 class="factions-title">Faction Memberships</h2>
      <button class="btn-add-faction" onclick={() => { showAddFaction = !showAddFaction; newFactionNpcId = ''; }}>
        + Add Faction
      </button>
    </div>

    <!-- ─── Add Faction picker ─── -->
    {#if showAddFaction}
      <div class="add-faction-bar">
        {#if availableFactionHeaders.length === 0}
          <span class="hint-text">All schema factions are already configured.</span>
        {:else}
          <select bind:value={newFactionNpcId} class="faction-select">
            <option value="">— select a faction —</option>
            {#each availableFactionHeaders as npc (npc.id)}
              <option value={npc.id}>{npc.name}</option>
            {/each}
          </select>
          <button class="btn-confirm" onclick={addFaction} disabled={!newFactionNpcId}>Add</button>
        {/if}
        <button class="btn-cancel" onclick={() => { showAddFaction = false; newFactionNpcId = ''; }}>Cancel</button>
      </div>
    {/if}

    <!-- ─── Faction cards ─── -->
    {#if factions.length === 0}
      <p class="empty-msg">No factions configured yet. Use "Add Faction" to get started.</p>
    {:else}
      <div class="faction-cards">
        {#each factions as fc (fc.id)}
          {@const factionNPC = getFactionNPC(fc.factionNpcId)}
          <div class="faction-card">

            <!-- Card header -->
            <div class="faction-card-header">
              <div class="faction-card-title">
                <span class="faction-name">{factionNPC?.name ?? fc.factionNpcId}</span>
                {#if factionNPC?.role}
                  <span class="faction-role">{factionNPC.role}</span>
                {/if}
              </div>
              <button
                class="btn-icon btn-delete-faction"
                onclick={() => removeFaction(fc.id)}
                title="Remove faction config"
              >✕</button>
            </div>

            <!-- Ranks section -->
            <div class="ranks-section">
              {#if editingRanksFor === fc.id}
                <!-- Rank editor -->
                <div class="ranks-editor">
                  <span class="section-label">Ranks</span>
                  <div class="ranks-list">
                    {#each rankDraft as rank, i (rank.id)}
                      <div class="rank-edit-row">
                        <span class="rank-num">{i + 1}.</span>
                        <input
                          class="rank-input"
                          type="text"
                          bind:value={rank.name}
                          placeholder="Rank name"
                        />
                        <button class="btn-icon" onclick={() => removeRankFromDraft(rank.id)} title="Remove rank">✕</button>
                      </div>
                    {/each}
                    <div class="rank-edit-row rank-add-row">
                      <input
                        class="rank-input"
                        type="text"
                        bind:value={newRankName}
                        placeholder="New rank name…"
                        onkeydown={(e) => { if (e.key === 'Enter') addRankToDraft(); }}
                      />
                      <button class="btn-icon btn-add-rank" onclick={addRankToDraft} title="Add rank">+</button>
                    </div>
                  </div>
                  <div class="ranks-editor-actions">
                    <button class="btn-confirm" onclick={saveRanks}>Save Ranks</button>
                    <button class="btn-cancel"  onclick={cancelRanks}>Cancel</button>
                  </div>
                </div>
              {:else}
                <!-- Rank display -->
                <div class="ranks-display">
                  <span class="section-label">Ranks</span>
                  {#if fc.ranks.length === 0}
                    <span class="hint-text">No ranks defined.</span>
                  {:else}
                    <div class="rank-chips">
                      {#each fc.ranks as rank, i (rank.id)}
                        <span class="rank-chip">{i + 1}. {rank.name}</span>
                      {/each}
                    </div>
                  {/if}
                  <button class="btn-edit-ranks" onclick={() => openRankEditor(fc)}>Edit Ranks</button>
                </div>
              {/if}
            </div>

            <!-- Members section -->
            <div class="members-section">
              {#if fc.members.length > 0}
                <div class="members-table">
                  <div class="members-table-head">
                    <span>PC</span>
                    <span>Rank</span>
                    <span>Faction Favor</span>
                    <span></span>
                  </div>
                  {#each fc.members as member (member.pcId)}
                    {@const pc    = getPC(member.pcId)}
                    {@const score = getFavorScore(member.pcId, fc.factionNpcId)}
                    {@const meta  = favorMeta(score)}
                    <div class="member-row">
                      <span class="member-name">{pc?.name ?? member.pcId}</span>
                      <select
                        class="rank-select"
                        value={member.rankId}
                        onchange={(e) => setMemberRank(fc.id, member.pcId, (e.target as HTMLSelectElement).value)}
                      >
                        <option value="">— unranked —</option>
                        {#each fc.ranks as rank (rank.id)}
                          <option value={rank.id}>{rank.name}</option>
                        {/each}
                      </select>
                      <div class="favor-cell">
                        <span class="favor-word" style="color: {meta.color}">{meta.word}</span>
                        <div class="favor-bar-track">
                          <div class="favor-bar-fill" style="width: {score}%; background: {meta.color}"></div>
                        </div>
                        <span class="favor-num">{score}</span>
                      </div>
                      <button
                        class="btn-icon btn-remove-member"
                        onclick={() => removeMember(fc.id, member.pcId)}
                        title="Remove member"
                      >✕</button>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Add member row -->
              {#if addMemberFor === fc.id}
                {@const pcs = availablePCs(fc)}
                <div class="add-member-bar">
                  {#if pcs.length === 0}
                    <span class="hint-text">All party members are already in this faction.</span>
                  {:else}
                    <select bind:value={newMemberPcId} class="faction-select">
                      <option value="">— select PC —</option>
                      {#each pcs as pc (pc.id)}
                        <option value={pc.id}>{pc.name}</option>
                      {/each}
                    </select>
                    <select bind:value={newMemberRankId} class="rank-select">
                      <option value="">— unranked —</option>
                      {#each fc.ranks as rank (rank.id)}
                        <option value={rank.id}>{rank.name}</option>
                      {/each}
                    </select>
                    <button class="btn-confirm" onclick={addMember} disabled={!newMemberPcId}>Add</button>
                  {/if}
                  <button class="btn-cancel" onclick={() => { addMemberFor = null; }}>Cancel</button>
                </div>
              {:else if availablePCs(fc).length > 0}
                <button class="btn-add-member" onclick={() => openAddMember(fc)}>+ Add Member</button>
              {/if}
            </div>

          </div>
        {/each}
      </div>
    {/if}

  {/if}

</div>
