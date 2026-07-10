<script lang="ts">
  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  type MechanicView = 'facedown' | 'netrunning';
  let view = $state<MechanicView>('facedown');
</script>

<div class="tab-panel" id="panel-mechanics" class:active>
  <div class="mech-inner">

    <div class="mech-header">
      <h1 class="mech-title">Mechanics</h1>
      <p class="mech-sub">Quick reference for common CPR mechanics</p>
    </div>

    <div class="dv-toggle-row">
      <button
        class="dv-toggle-btn"
        class:dv-toggle-active={view === 'facedown'}
        onclick={() => view = 'facedown'}
      >Facedown</button>
      <button
        class="dv-toggle-btn"
        class:dv-toggle-active={view === 'netrunning'}
        onclick={() => view = 'netrunning'}
      >Netrunning</button>
    </div>

    {#if view === 'facedown'}

      <div class="mech-section-label">Challenge Roll</div>

      <div class="mech-callout">
        <div class="mech-callout-formula">COOL + Reputation* + 1d10</div>
        <p class="mech-callout-note">
          *If your defining Reputation Event is for cowardice your Reputation Level is treated as a negative number.
        </p>
      </div>

      <p class="mech-body">
        In a tie, both parties are unsure and nothing happens. Otherwise, the loser has the option of either:
      </p>

      <div class="mech-callout">
        <div class="mech-callout-options">
          <div class="mech-callout-option-title">Backing Down...</div>
          <div class="mech-callout-divider"></div>
          <div class="mech-callout-or">or</div>
          <div class="mech-callout-divider"></div>
          <div class="mech-callout-option-title">
            Taking a -2 to any future Actions made against this opponent<br>
            due to fear until they have defeated them once
          </div>
        </div>
      </div>

    {:else}

      <div class="mech-section-label">NET Actions &amp; Interface Abilities</div>

      <p class="mech-body">
        Your Netrunner can use these <strong>Interface Abilities</strong> with their <strong>NET Actions</strong> (save for Scanner).
      </p>

      <div class="mech-callout">
        <p class="mech-callout-resolution">
          Resolution for using any of these abilities (save for Zap) is as follows:
        </p>
        <div class="mech-callout-main">Interface + 1d10 vs. DV</div>
      </div>

    {/if}

  </div>
</div>
