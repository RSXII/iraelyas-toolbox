<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { NPC, FavorTier, FactionConfig } from '@/types/index';

  interface Props {
    editEnabled: boolean;
    visibleConfigs: FactionConfig[];
    unaffiliatedNpcs: NPC[];
    showUnaffiliated: boolean;
  }
  let { editEnabled, visibleConfigs, unaffiliatedNpcs, showUnaffiliated }: Props = $props();

  // ─── Derived from store ───────────────────────────────────────
  const cid            = $derived(store.activeCampaignId);
  const cd             = $derived(store.activeCampaignData);
  const players        = $derived(cid ? store.getParty(cid).pcs : []);
  const pid            = $derived(store.activePlayerId);
  const pd             = $derived(pid && cd ? cd.players[pid] : null);
  const factionConfigs = $derived(cid ? store.getFactions(cid).factions : []);
  const tiers          = $derived(cid ? (store.getFavorSettings(cid)?.tiers ?? []) : []);
  const increment      = $derived(cid ? (store.getFavorSettings(cid)?.increment ?? 5) : 5);

  // ─── Helpers ─────────────────────────────────────────────────
  function favorMeta(score: number, tierList: FavorTier[]): { word: string; color: string } {
    const sorted = [...tierList].sort((a, b) => b.threshold - a.threshold);
    const match = sorted.find((t) => score >= t.threshold);
    const fallback = sorted[sorted.length - 1] ?? { label: '—', color: '#888888' };
    const tier = match ?? fallback;
    return { word: tier.label, color: tier.color };
  }

  function initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  }

  // ─── Actions ─────────────────────────────────────────────────
  function adjust(npcId: string, delta: number): void {
    if (!cid || !pid) { showToast('Select a player first'); return; }
    store.adjustFavorScore(cid, pid, npcId, delta);
  }

  function adjustRenown(factionId: string, delta: number): void {
    if (!cid || !pid) { showToast('Select a player first'); return; }
    store.adjustFactionRenown(cid, factionId, pid, delta);
  }

  function deleteNPC(npc: NPC): void {
    if (!cid) return;
    if (!confirm(`Remove ${npc.name}? This will delete their scores for all players.`)) return;
    store.deleteNPC(cid, npc.id);
  }

  function moveFaction(factionId: string, direction: 'up' | 'down'): void {
    if (!cid) return;
    store.moveFactionConfig(cid, factionId, direction);
  }
</script>

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
            <div class="npc-initials" class:npc-favor-portrait={!!npc.portrait}>
              {#if npc.portrait}
                <img src={npc.portrait} alt="" aria-hidden="true" />
              {:else}
                {initials(npc.name)}
              {/if}
            </div>
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
      {#each unaffiliatedNpcs as npc (npc.id)}
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
            <div class="npc-initials" class:npc-favor-portrait={!!npc.portrait}>
              {#if npc.portrait}
                <img src={npc.portrait} alt="" aria-hidden="true" />
              {:else}
                {initials(npc.name)}
              {/if}
            </div>
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
</div>
