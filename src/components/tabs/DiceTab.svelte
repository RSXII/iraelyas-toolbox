<script lang="ts">
  import { store } from '@/state/store.svelte';

  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
  type AdvMode = 'none' | 'advantage' | 'disadvantage';

  interface ACCheckResult {
    targetName: string;
    ac: number;
    outcome: 'hit' | 'miss' | 'meet';
  }

  interface RollResult {
    id: string;
    diceType: DiceType;
    modifier: number;
    mode: AdvMode;
    rolls: number[];       // all dice rolled (2 for adv/dis, quantity otherwise)
    keptIndices: number[]; // indices of rolls that count toward total
    total: number;
    formulaLabel: string;
    timestamp: number;
    acCheck: ACCheckResult | null;
    acWarning: string | null;
  }

  const DICE_TYPES: DiceType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

  type SaveType = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
  const SAVE_TYPES: { key: SaveType; label: string }[] = [
    { key: 'str', label: 'STR' }, { key: 'dex', label: 'DEX' },
    { key: 'con', label: 'CON' }, { key: 'int', label: 'INT' },
    { key: 'wis', label: 'WIS' }, { key: 'cha', label: 'CHA' },
  ];

  let selectedDice     = $state<DiceType>('d20');
  let quantity         = $state(1);
  let modifier         = $state(0);
  let mode             = $state<AdvMode>('none');
  let selectedTargetId = $state('');
  let history          = $state<RollResult[]>([]);
  let spellSaveMode    = $state(false);
  let spellDC          = $state(13);
  let selectedSaveType = $state<SaveType>('dex');

  const partyPCs         = $derived(store.activeCampaignId ? store.getParty(store.activeCampaignId).pcs : []);
  const showAdvDis       = $derived(selectedDice === 'd20');
  const showTargetSelect = $derived(selectedDice === 'd20' && partyPCs.length > 0);
  const displayQty       = $derived(mode !== 'none' ? 1 : quantity);

  const percentToHit = $derived.by((): string => {
    if (!selectedTargetId) return '';
    const target = partyPCs.find(p => p.id === selectedTargetId);
    if (!target) return '';
    const acVal = parseInt(target.ac);
    if (!target.ac || isNaN(acVal)) return '';
    const neededRoll = acVal - modifier;
    const hitFaces   = Math.max(0, Math.min(20, 21 - neededRoll));
    let pct: number;
    if (mode === 'advantage') {
      const missFaces = Math.max(0, Math.min(20, neededRoll - 1));
      pct = (1 - (missFaces / 20) ** 2) * 100;
    } else if (mode === 'disadvantage') {
      pct = ((hitFaces / 20) ** 2) * 100;
    } else {
      pct = (hitFaces / 20) * 100;
    }
    // D&D 5e: nat 1 always misses, nat 20 always hits
    return Math.round(Math.max(5, Math.min(95, pct))) + '%';
  });

  const saveResults = $derived.by(() =>
    partyPCs.map(pc => {
      const rawSave = pc.saves[selectedSaveType];
      const saveBonus = parseInt(rawSave);
      const hasBonus = rawSave !== undefined && rawSave !== '' && !isNaN(saveBonus);
      if (!hasBonus) return { id: pc.id, name: pc.name, bonus: null as number | null, pct: null as number | null };
      const successFaces = Math.max(0, Math.min(20, 21 - spellDC + saveBonus));
      return { id: pc.id, name: pc.name, bonus: saveBonus, pct: Math.round((successFaces / 20) * 100) };
    })
  );

  const formulaDisplay = $derived(
    mode !== 'none'
      ? `d20 with ${mode === 'advantage' ? 'Advantage' : 'Disadvantage'}${modifier !== 0 ? (modifier > 0 ? ' + ' : ' − ') + Math.abs(modifier) : ''}`
      : `${quantity}${selectedDice}${modifier !== 0 ? (modifier > 0 ? ' + ' : ' − ') + Math.abs(modifier) : ''}`
  );

  function selectDice(d: DiceType): void {
    spellSaveMode = false;
    selectedDice = d;
    if (d !== 'd20') {
      mode = 'none';
      selectedTargetId = '';
    }
  }

  function rollDie(sides: number): number {
    return Math.floor(Math.random() * sides) + 1;
  }

  function roll(): void {
    const sides = parseInt(selectedDice.slice(1));
    let rolls: number[];
    let keptIndices: number[];

    if (mode !== 'none') {
      // Advantage / Disadvantage: roll 2d20, keep higher or lower
      const r0 = rollDie(sides);
      const r1 = rollDie(sides);
      rolls = [r0, r1];
      if (mode === 'advantage') {
        keptIndices = [r0 >= r1 ? 0 : 1];
      } else {
        keptIndices = [r0 <= r1 ? 0 : 1];
      }
    } else {
      rolls = Array.from({ length: quantity }, () => rollDie(sides));
      keptIndices = rolls.map((_, i) => i);
    }

    const keptSum = keptIndices.reduce((sum, i) => sum + rolls[i], 0);
    const total   = Math.max(1, keptSum + modifier);

    let formulaLabel: string;
    if (mode !== 'none') {
      formulaLabel = `d20 w/${mode === 'advantage' ? 'Adv' : 'Dis'}${modifier !== 0 ? (modifier > 0 ? '+' : '') + modifier : ''}`;
    } else {
      formulaLabel = `${quantity}${selectedDice}${modifier !== 0 ? (modifier > 0 ? '+' : '') + modifier : ''}`;
    }

    let acCheck: ACCheckResult | null = null;
    let acWarning: string | null = null;

    if (selectedTargetId && selectedDice === 'd20') {
      const target = partyPCs.find(p => p.id === selectedTargetId);
      if (target) {
        const acVal = parseInt(target.ac);
        if (!target.ac || isNaN(acVal)) {
          acWarning = `${target.name}'s AC is not set!`;
        } else {
          acCheck = {
            targetName: target.name,
            ac: acVal,
            outcome: total > acVal ? 'hit' : total === acVal ? 'meet' : 'miss',
          };
        }
      }
    }

    const result: RollResult = {
      id: `roll_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      diceType: selectedDice,
      modifier,
      mode,
      rolls,
      keptIndices,
      total,
      formulaLabel,
      timestamp: Date.now(),
      acCheck,
      acWarning,
    };

    history = [result, ...history].slice(0, 50);
  }
</script>

<div class="tab-panel" id="panel-dice" class:active>
  <div class="dice-inner">

    <!-- ── Die Type Picker ─────────────────────── -->
    <div class="dice-section-label">Die Type</div>
    <div class="dice-type-row">
      {#each DICE_TYPES as d}
        <button
          class="die-btn"
          class:active={!spellSaveMode && selectedDice === d}
          onclick={() => selectDice(d)}
        >{d}</button>
      {/each}
      <button
        class="die-btn spell-save-btn"
        class:active={spellSaveMode}
        onclick={() => { spellSaveMode = true; }}
      >Spell Save</button>
    </div>

    {#if !spellSaveMode}
    <!-- ── Roll Configuration ──────────────────────── -->
    <div class="dice-config-row">

      <div class="dice-field">
        <div class="field-label">Quantity</div>
        <div class="qty-control">
          <button
            class="qty-btn"
            onclick={() => { quantity = Math.max(1, quantity - 1); }}
            disabled={mode !== 'none'}
          >−</button>
          <span class="qty-value">{displayQty}</span>
          <button
            class="qty-btn"
            onclick={() => { quantity = Math.min(10, quantity + 1); }}
            disabled={mode !== 'none'}
          >+</button>
        </div>
      </div>

      <div class="dice-field">
        <label class="field-label" for="dice-modifier">Modifier</label>
        <div class="mod-row">
          <input
            id="dice-modifier"
            class="mod-input"
            type="number"
            bind:value={modifier}
            min="-20"
            max="20"
          />
          <button class="mod-inc-btn" onclick={() => { modifier = Math.min(20, modifier + 1); }}>+1</button>
          <button class="mod-inc-btn" onclick={() => { modifier = Math.min(20, modifier + 5); }}>+5</button>
          <button class="mod-inc-btn mod-clear-btn" onclick={() => { modifier = 0; }}>Clear</button>
        </div>
      </div>

      {#if showAdvDis}
      <div class="dice-field">
        <div class="field-label">Roll Type</div>
        <div class="adv-toggle">
          <button
            class="adv-btn"
            class:active={mode === 'none'}
            onclick={() => { mode = 'none'; }}
          >Normal</button>
          <button
            class="adv-btn adv-btn--adv"
            class:active={mode === 'advantage'}
            onclick={() => { mode = 'advantage'; }}
          >Adv</button>
          <button
            class="adv-btn adv-btn--dis"
            class:active={mode === 'disadvantage'}
            onclick={() => { mode = 'disadvantage'; }}
          >Dis</button>
        </div>
      </div>
      {/if}

      {#if showTargetSelect}
      <div class="dice-field">
        <div class="field-label">Target (AC Check)</div>
        <select class="target-select" bind:value={selectedTargetId}>
          <option value="">— None —</option>
          {#each partyPCs as pc}
            <option value={pc.id}>{pc.name}</option>
          {/each}
        </select>
        {#if percentToHit}
          <div class="pct-to-hit">% to Hit: <span class="pct-value">{percentToHit}</span></div>
        {/if}
      </div>
      {/if}

    </div>

    <!-- ── Roll Button ─────────────────────────── -->
    <div class="dice-roll-area">
      <span class="formula-preview">{formulaDisplay}</span>
      <button class="btn btn-gold dice-roll-btn" onclick={roll}>Roll</button>
    </div>

    <!-- ── Last Result ─────────────────────────── -->
    {#if history.length > 0}
    {@const last = history[0]}
    {@const naturalRoll = last.diceType === 'd20' && last.keptIndices.length === 1 ? last.rolls[last.keptIndices[0]] : null}
    <div class="dice-result-card">
      <div class="dice-total">{last.total}</div>
      <div class="dice-faces">
        {#each last.rolls as r, i}
          <span
            class="die-face"
            class:die-face--kept={last.mode !== 'none' && last.keptIndices.includes(i)}
            class:die-face--dropped={last.mode !== 'none' && !last.keptIndices.includes(i)}
          >{r}</span>
        {/each}
        {#if last.modifier !== 0}
          <span class="die-modifier">{last.modifier > 0 ? '+' : ''}{last.modifier}</span>
        {/if}
      </div>
      <div class="dice-result-label">{last.formulaLabel}</div>
      {#if naturalRoll === 1}
        <div class="ac-outcome ac-outcome--crit-fail">Critical Failure!</div>
      {:else if naturalRoll === 20}
        <div class="ac-outcome ac-outcome--crit-success">Critical Success!</div>
      {:else if last.acWarning}
        <div class="ac-warning">⚠ {last.acWarning}</div>
      {:else if last.acCheck}
        <div class="ac-outcome ac-outcome--{last.acCheck.outcome}">
          {last.acCheck.outcome === 'hit' ? 'HIT' : last.acCheck.outcome === 'miss' ? 'MISS' : 'MEET'}
          <span class="ac-outcome-sub">vs {last.acCheck.targetName} (AC {last.acCheck.ac})</span>
        </div>
      {/if}
    </div>
    {/if}

    <!-- ── History ─────────────────────────────── -->
    {#if history.length > 0}
    <div class="dice-history-head">
      <span class="section-name">Roll History</span>
      <button class="btn btn-sm btn-danger" onclick={() => { history = []; }}>Clear</button>
    </div>
    <div class="dice-history">
      {#each history as r (r.id)}
        {@const histNatural = r.diceType === 'd20' && r.keptIndices.length === 1 ? r.rolls[r.keptIndices[0]] : null}
        <div class="dice-history-row">
          <span class="hist-formula">{r.formulaLabel}</span>
          <span class="hist-rolls">[{r.keptIndices.map(i => r.rolls[i]).join(', ')}]{r.modifier !== 0 ? (r.modifier > 0 ? '+' : '') + r.modifier : ''}</span>
          <span class="hist-total">{r.total}</span>
          {#if histNatural === 1}
            <span class="hist-ac hist-ac--crit-fail">NAT 1</span>
          {:else if histNatural === 20}
            <span class="hist-ac hist-ac--crit-success">NAT 20</span>
          {:else if r.acWarning}
            <span class="hist-ac hist-ac--warn" title={r.acWarning}>⚠</span>
          {:else if r.acCheck}
            <span class="hist-ac hist-ac--{r.acCheck.outcome}">{r.acCheck.outcome.toUpperCase()}</span>
          {:else}
            <span class="hist-ac"></span>
          {/if}
          <span class="hist-time">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      {/each}
    </div>
    {/if}

    {:else}
    <!-- ── Spell Save Panel ─────────────────────────── -->
    <div class="spell-save-section">
      <div class="dice-section-label">Save Type</div>
      <div class="save-type-row">
        {#each SAVE_TYPES as st}
          <button class="save-type-btn" class:active={selectedSaveType === st.key}
            onclick={() => { selectedSaveType = st.key; }}>{st.label}</button>
        {/each}
      </div>
      <div class="dice-config-row">
        <div class="dice-field">
          <label class="field-label" for="spell-dc">Spell DC</label>
          <div class="mod-row">
            <input id="spell-dc" class="mod-input" type="number" bind:value={spellDC} min="1" max="30" />
            <button class="mod-inc-btn" onclick={() => { spellDC = Math.min(30, spellDC + 1); }}>+1</button>
            <button class="mod-inc-btn" onclick={() => { spellDC = Math.min(30, spellDC + 5); }}>+5</button>
            <button class="mod-inc-btn mod-clear-btn" onclick={() => { spellDC = 13; }}>Reset</button>
          </div>
        </div>
      </div>
      {#if partyPCs.length === 0}
        <div class="empty-state">No party members — add them in the Party tab.</div>
      {:else}
        <div class="dice-section-label">Success Chance by Member</div>
        <div class="save-results">
          {#each saveResults as r}
          <div class="save-result-row">
            <span class="save-name">{r.name}</span>
            {#if r.bonus === null}
              <span class="save-bonus save-bonus--empty">not set</span>
              <span class="save-pct save-pct--empty">—</span>
            {:else}
              <span class="save-bonus">{r.bonus >= 0 ? '+' : ''}{r.bonus}</span>
              <span class="save-pct save-pct--{(r.pct ?? 0) >= 60 ? 'high' : (r.pct ?? 0) > 35 ? 'mid' : 'low'}">{r.pct}%</span>
            {/if}
          </div>
          {/each}
        </div>
      {/if}
    </div>
    {/if}

  </div>
</div>
