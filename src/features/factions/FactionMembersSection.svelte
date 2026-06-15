<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { FactionConfig } from '@/types/index';

  interface Props { fc: FactionConfig; }
  let { fc }: Props = $props();

  const campaignId = $derived(store.activeCampaignId);
  const cd         = $derived(campaignId ? store.getCampaignData(campaignId) : null);

  // ─── Helpers ─────────────────────────────────────────────────
  function favorMeta(s: number): { word: string; color: string } {
    if (s < 20) return { word: 'Hostile',  color: 'var(--hostile)'  };
    if (s < 40) return { word: 'Wary',     color: 'var(--wary)'     };
    if (s < 60) return { word: 'Neutral',  color: 'var(--neutral)'  };
    if (s < 80) return { word: 'Friendly', color: 'var(--friendly)' };
    return             { word: 'Allied',   color: 'var(--allied)'   };
  }

  function getPC(pcId: string) {
    return cd?.party.pcs.find((p) => p.id === pcId) ?? null;
  }

  function getFavorScore(pcId: string): number {
    return fc.renown?.[pcId] ?? 50;
  }

  function availablePCs() {
    const memberIds = new Set(fc.members.map((m) => m.pcId));
    return cd?.party.pcs.filter((p) => !memberIds.has(p.id)) ?? [];
  }

  // ─── Add member state ─────────────────────────────────────────
  let isAdding        = $state(false);
  let newMemberPcId   = $state('');
  let newMemberRankId = $state('');

  function openAddMember(): void {
    newMemberPcId   = '';
    newMemberRankId = fc.ranks[0]?.id ?? '';
    isAdding        = true;
  }

  function addMember(): void {
    if (!campaignId || !newMemberPcId) return;
    store.addFactionMember(campaignId, fc.id, newMemberPcId, newMemberRankId);
    isAdding        = false;
    newMemberPcId   = '';
    newMemberRankId = '';
    showToast('Member added');
  }

  function removeMember(pcId: string): void {
    if (!campaignId) return;
    store.removeFactionMember(campaignId, fc.id, pcId);
  }

  function setMemberRank(pcId: string, rankId: string): void {
    if (!campaignId) return;
    store.setMemberRank(campaignId, fc.id, pcId, rankId);
  }
</script>

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
        {@const score = getFavorScore(member.pcId)}
        {@const meta  = favorMeta(score)}
        <div class="member-row">
          <span class="member-name">{pc?.name ?? member.pcId}</span>
          <select
            class="rank-select"
            value={member.rankId}
            onchange={(e) => setMemberRank(member.pcId, (e.target as HTMLSelectElement).value)}
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
            onclick={() => removeMember(member.pcId)}
            title="Remove member"
          >✕</button>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Add member row -->
  {#if isAdding}
    {@const pcs = availablePCs()}
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
      <button class="btn-cancel" onclick={() => (isAdding = false)}>Cancel</button>
    </div>
  {:else if availablePCs().length > 0}
    <button class="btn-add-member" onclick={openAddMember}>+ Add Member</button>
  {/if}
</div>
