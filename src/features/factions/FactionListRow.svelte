<script lang="ts">
  import type { FactionConfig, PCCard } from '@/types/index';

  interface Props {
    fc: FactionConfig;
    partyPcs: PCCard[];
    onselect: () => void;
  }
  let { fc, partyPcs, onselect }: Props = $props();

  function initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  function favorColor(score: number): string {
    if (score < 20) return 'var(--hostile)';
    if (score < 40) return 'var(--wary)';
    if (score < 60) return 'var(--neutral)';
    if (score < 80) return 'var(--friendly)';
    return 'var(--allied)';
  }
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
  class="faction-list-row"
  role="button"
  tabindex="0"
  onclick={onselect}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onselect(); } }}
>

  <!-- Insignia circle -->
  <div class="faction-insignia">
    {#if fc.insignia}
      <img src={fc.insignia} alt="" aria-hidden="true" class="faction-insignia-img" />
    {:else}
      <span class="faction-insignia-initials">{initials(fc.name)}</span>
    {/if}
  </div>

  <!-- Name + leader -->
  <div class="faction-row-center">
    <span class="faction-row-name">{fc.name}</span>
    {#if fc.leader}
      <span class="faction-row-leader">Leader: {fc.leader}</span>
    {/if}
  </div>

  <!-- Per-PC favor dots -->
  {#if partyPcs.length > 0}
    <div class="faction-row-favor">
      {#each partyPcs as pc (pc.id)}
        {@const score = fc.renown?.[pc.id] ?? 50}
        {@const isMember = fc.members.some((m) => m.pcId === pc.id)}
        <div class="faction-favor-pc">
          <span class="faction-favor-label" style={isMember ? 'color: #9999FA' : undefined}>{pc.name}</span>
          <span class="faction-favor-dot" style="background: {favorColor(score)}"></span>
        </div>
      {/each}
    </div>
  {/if}

</div>
