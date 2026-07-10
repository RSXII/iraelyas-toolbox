<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { NPC, PCCard } from '@/types/index';

  interface Props {
    npc: NPC;
    players: PCCard[];
  }
  let { npc, players }: Props = $props();

  const cid = $derived(store.activeCampaignId);

  // Tier definitions: score → metadata
  const TIERS = [
    { score: -3, label: 'Enemy',        modifier: -8,  color: '#9b2020' },
    { score: -2, label: 'Hostile',      modifier: -4,  color: '#c0392b' },
    { score: -1, label: 'Cold',         modifier: -2,  color: '#c07030' },
    { score:  0, label: 'Stranger',     modifier:  0,  color: '#7a7060' },
    { score:  1, label: 'Known',        modifier:  1,  color: '#2980b9' },
    { score:  2, label: 'Trusted',      modifier:  2,  color: '#27ae60' },
    { score:  3, label: 'Relied Upon',  modifier:  4,  color: '#c09830' },
    { score:  4, label: 'Confidant',    modifier:  6,  color: '#8e44ad' },
    { score:  5, label: 'Inner Circle', modifier: 10,  color: '#9b59b6' },
  ] as const;

  function tierFor(score: number) {
    return TIERS.find((t) => t.score === score) ?? TIERS[3]; // fallback Stranger
  }

  function modifierLabel(mod: number): string {
    return mod > 0 ? `+${mod}` : `${mod}`;
  }

  function initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  }

  // Player colors — cycle through a set if the party is large
  const PLAYER_COLORS = ['#2980b9', '#c0392b', '#8e44ad', '#27ae60', '#c07030', '#16a085'];
  function playerColor(idx: number): string {
    return PLAYER_COLORS[idx % PLAYER_COLORS.length];
  }

  function getScore(playerId: string): number {
    if (!cid) return 0;
    return store.getCprRelationship(cid, npc.id, playerId);
  }

  function adjust(playerId: string, delta: 1 | -1): void {
    if (!cid) { showToast('No campaign selected'); return; }
    store.adjustCprRelationship(cid, npc.id, playerId, delta);
  }

  // Pip helpers — 3 negative, 5 positive
  const NEG_PIPS = [-3, -2, -1] as const;
  const POS_PIPS = [1, 2, 3, 4, 5] as const;

  function negPipFilled(score: number, pip: number): boolean {
    // pip is -3, -2, or -1; filled when score <= pip
    return score <= pip;
  }

  function posPipFilled(score: number, pip: number): boolean {
    // pip is 1–5; filled when score >= pip
    return score >= pip;
  }
</script>

<div class="cpr-card">
  <!-- NPC header -->
  <div class="cpr-card-header">
    <div class="cpr-npc-avatar" class:has-portrait={!!npc.portrait}>
      {#if npc.portrait}
        <img src={npc.portrait} alt="" aria-hidden="true" />
      {:else}
        {initials(npc.name)}
      {/if}
    </div>
    <div class="cpr-npc-info">
      <div class="cpr-npc-name">{npc.name}</div>
      <div class="cpr-npc-role">{npc.role}{npc.faction ? ` · ${npc.faction}` : ''}</div>
    </div>
  </div>

  <!-- Player relationship rows -->
  <div class="cpr-player-rows">
    {#each players as pc, idx (pc.id)}
      {@const score = getScore(pc.id)}
      {@const tier  = tierFor(score)}
      {@const color = playerColor(idx)}
      <div class="cpr-player-row">
        <div class="cpr-player-dot" style="background: {color}"></div>
        <div class="cpr-player-name">{pc.name}</div>
        <div class="cpr-pip-track">
          <!-- Negative pips (left side, fill right→left toward 0) -->
          <div class="cpr-neg-pips">
            {#each NEG_PIPS as pip}
              <span
                class="cpr-pip neg"
                class:filled={negPipFilled(score, pip)}
                style={negPipFilled(score, pip) ? `background:${tier.color};border-color:${tier.color}` : ''}
              ></span>
            {/each}
          </div>
          <div class="cpr-pip-divider"></div>
          <!-- Positive pips (right side, fill left→right from 0) -->
          <div class="cpr-pos-pips">
            {#each POS_PIPS as pip}
              <span
                class="cpr-pip pos"
                class:filled={posPipFilled(score, pip)}
                style={posPipFilled(score, pip) ? `background:${tier.color};border-color:${tier.color}` : ''}
              ></span>
            {/each}
          </div>
        </div>
        <div class="cpr-tier-info">
          <span class="cpr-modifier" style="color:{tier.color}">{modifierLabel(tier.modifier)}</span>
          <span class="cpr-tier-label">{tier.label}</span>
        </div>
        <div class="cpr-adj-btns">
          <button
            class="cpr-adj-btn"
            disabled={score <= -3}
            onclick={() => adjust(pc.id, -1)}
            aria-label="Decrease relationship"
          >−</button>
          <button
            class="cpr-adj-btn"
            disabled={score >= 5}
            onclick={() => adjust(pc.id, 1)}
            aria-label="Increase relationship"
          >+</button>
        </div>
      </div>
    {/each}

    {#if !players.length}
      <div class="cpr-no-players">Add players in the Party tab.</div>
    {/if}
  </div>
</div>
