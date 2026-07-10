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
  class="faction-grid-card"
  role="button"
  tabindex="0"
  onclick={onselect}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onselect();
    }
  }}
>
  <!-- Image header — insignia as full-width background -->
  <div
    class="faction-grid-card-header"
    class:has-insignia={!!fc.insignia}
    style={fc.insignia ? `background-image: url('${fc.insignia}')` : ''}
  >
    {#if !fc.insignia}
      <span class="faction-grid-card-initials">{initials(fc.name)}</span>
    {/if}
  </div>

  <!-- Body: name, leader, PC favor row -->
  <div class="faction-grid-card-body">
    <div class="faction-grid-card-name">{fc.name}</div>
    {#if fc.leader}
      <div class="faction-grid-card-leader">{fc.leader}</div>
    {/if}

    {#if partyPcs.length > 0}
      <div class="faction-grid-card-pcs">
        {#each partyPcs as pc (pc.id)}
          {@const score = fc.renown?.[pc.id] ?? 50}
          <div class="faction-grid-card-pc">
            <span
              class="faction-grid-card-pc-dot"
              style="background: {favorColor(score)}"
            ></span>
            <span class="faction-grid-card-pc-name">{pc.name}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
