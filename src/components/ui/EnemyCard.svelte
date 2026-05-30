<script lang="ts">
  import type { MonsterStatBlock } from '@/types/index';

  interface Props {
    enemy: MonsterStatBlock;
    onedit?: () => void;
    ondelete?: () => void;
    readonly?: boolean;
  }

  let { enemy, onedit, ondelete, readonly = false }: Props = $props();

  let expanded = $state(false);

  function mod(score: number): string {
    const m = Math.floor((score - 10) / 2);
    return m >= 0 ? `+${m}` : `${m}`;
  }

  function crLabel(cr: number): string {
    if (cr === 0.125) return '1/8';
    if (cr === 0.25)  return '1/4';
    if (cr === 0.5)   return '1/2';
    return String(cr);
  }

  function speedStr(speed: MonsterStatBlock['speed']): string {
    const parts: string[] = [`${speed.walk} ft.`];
    if (speed.fly)    parts.push(`fly ${speed.fly} ft.`);
    if (speed.swim)   parts.push(`swim ${speed.swim} ft.`);
    if (speed.climb)  parts.push(`climb ${speed.climb} ft.`);
    if (speed.burrow) parts.push(`burrow ${speed.burrow} ft.`);
    return parts.join(', ');
  }

  function sensesStr(senses: MonsterStatBlock['senses']): string {
    const parts: string[] = [];
    if (senses.darkvision)  parts.push(`Darkvision ${senses.darkvision} ft.`);
    if (senses.blindsight)  parts.push(`Blindsight ${senses.blindsight} ft.`);
    if (senses.truesight)   parts.push(`Truesight ${senses.truesight} ft.`);
    if (senses.tremorsense) parts.push(`Tremorsense ${senses.tremorsense} ft.`);
    parts.push(`Passive Perception ${senses.passive_perception}`);
    return parts.join(', ');
  }

  function savingThrowsStr(saves: Partial<Record<string, number>>): string {
    const labels: Record<string, string> = { str:'Str', dex:'Dex', con:'Con', int:'Int', wis:'Wis', cha:'Cha' };
    return Object.entries(saves)
      .map(([k, v]) => `${labels[k] ?? k} ${v! >= 0 ? '+' : ''}${v}`)
      .join(', ');
  }

  function skillsStr(skills: Record<string, number>): string {
    return Object.entries(skills)
      .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${v >= 0 ? '+' : ''}${v}`)
      .join(', ');
  }

  const ABILITY_LABELS = ['STR','DEX','CON','INT','WIS','CHA'] as const;
  const ABILITY_KEYS   = ['str','dex','con','int','wis','cha'] as const;

  // Claude occasionally returns comma-separated strings instead of arrays.
  // This normalizer ensures .join() always works regardless.
  function toArr(v: string | string[] | undefined | null): string[] {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  }
</script>

<div class="enemy-card" class:expanded>
  <!-- Header (always visible) -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="enemy-card-header" onclick={() => { expanded = !expanded; }}>
    <span class="enemy-card-name">{enemy.name}</span>

    <!-- Secondary info: hidden off-right when collapsed, slides in on hover -->
    {#if !expanded}
      <div class="enemy-card-peek">
        <span class="enemy-cr-badge">CR {crLabel(enemy.cr)}</span>
        <span class="enemy-type-pill">{enemy.size} {enemy.type}</span>
        <span class="enemy-card-stats">
          <span class="enemy-card-stat">AC {enemy.ac}</span>
          <span class="enemy-card-stat">HP {enemy.hp}</span>
        </span>
        {#if !readonly}
          <div class="enemy-card-actions">
            <button
              class="enemy-card-btn"
              title="Edit"
              onclick={(e) => { e.stopPropagation(); onedit?.(); }}
            >✏</button>
            <button
              class="enemy-card-btn danger"
              title="Delete"
              onclick={(e) => { e.stopPropagation(); ondelete?.(); }}
            >✕</button>
          </div>
        {/if}
        <span class="enemy-card-chevron">▼</span>
      </div>
    {:else}
      <!-- When expanded keep chevron visible outside the peek wrapper -->
      <span class="enemy-card-chevron">▼</span>
    {/if}
  </div>

  <!-- Expanded stat block -->
  {#if expanded}
    <div class="enemy-stat-block">
      <!-- Creature name / meta -->
      <div class="sb-header">
        <div class="sb-creature-name">{enemy.name}</div>
        <div class="sb-creature-meta">
          {enemy.size} {enemy.type}{enemy.subtype ? ` (${enemy.subtype})` : ''}, {enemy.alignment}
        </div>
      </div>

      <!-- AC / HP / Speed -->
      <div class="sb-divider-row">
        <div class="sb-stat-item">
          <span class="sb-stat-label">Armor Class</span>
          <span class="sb-stat-value">{enemy.ac} ({enemy.ac_source})</span>
        </div>
        <div class="sb-stat-item">
          <span class="sb-stat-label">Hit Points</span>
          <span class="sb-stat-value">{enemy.hp} ({enemy.hp_formula})</span>
        </div>
        <div class="sb-stat-item">
          <span class="sb-stat-label">Speed</span>
          <span class="sb-stat-value">{speedStr(enemy.speed)}</span>
        </div>
      </div>

      <!-- Ability scores -->
      <div class="sb-ability-grid">
        {#each ABILITY_KEYS as key, i}
          <div class="sb-ability-cell">
            <span class="sb-ability-name">{ABILITY_LABELS[i]}</span>
            <span class="sb-ability-score">{enemy.ability_scores[key]}</span>
            <span class="sb-ability-mod">({mod(enemy.ability_scores[key])})</span>
          </div>
        {/each}
      </div>

      <!-- Proficiency details -->
      {#if enemy.saving_throws && Object.keys(enemy.saving_throws).length}
        <div class="sb-section">
          <span class="sb-stat-label">Saving Throws</span>
          <span> {savingThrowsStr(enemy.saving_throws as Record<string, number>)}</span>
        </div>
      {/if}
      {#if enemy.skills && Object.keys(enemy.skills).length}
        <div class="sb-section">
          <span class="sb-stat-label">Skills</span>
          <span> {skillsStr(enemy.skills)}</span>
        </div>
      {/if}
      {#if enemy.damage_immunities?.length}
        <div class="sb-section">
          <span class="sb-stat-label">Damage Immunities</span>
          <span> {toArr(enemy.damage_immunities).join(', ')}</span>
        </div>
      {/if}
      {#if enemy.damage_resistances?.length}
        <div class="sb-section">
          <span class="sb-stat-label">Damage Resistances</span>
          <span> {toArr(enemy.damage_resistances).join(', ')}</span>
        </div>
      {/if}
      {#if enemy.damage_vulnerabilities?.length}
        <div class="sb-section">
          <span class="sb-stat-label">Damage Vulnerabilities</span>
          <span> {toArr(enemy.damage_vulnerabilities).join(', ')}</span>
        </div>
      {/if}
      {#if enemy.condition_immunities?.length}
        <div class="sb-section">
          <span class="sb-stat-label">Condition Immunities</span>
          <span> {toArr(enemy.condition_immunities).join(', ')}</span>
        </div>
      {/if}

      <!-- Senses / Languages / CR / XP -->
      <div class="sb-section">
        <span class="sb-stat-label">Senses</span>
        <span> {sensesStr(enemy.senses)}</span>
      </div>
      {#if toArr(enemy.languages).length}
        <div class="sb-section">
          <span class="sb-stat-label">Languages</span>
          <span> {toArr(enemy.languages).join(', ')}</span>
        </div>
      {/if}
      <div class="sb-section">
        <span class="sb-stat-label">Challenge</span>
        <span> {crLabel(enemy.cr)} ({enemy.xp.toLocaleString()} XP)</span>
      </div>

      <!-- Traits -->
      {#if enemy.traits.length}
        <div class="sb-section">
          <div class="sb-section-label">Traits</div>
          {#each enemy.traits as trait}
            <div class="sb-entry">
              <span class="sb-entry-name">{trait.name}.</span>
              <span class="sb-entry-desc"> {trait.description}</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Actions -->
      <div class="sb-section">
        <div class="sb-section-label">Actions</div>
        {#each enemy.actions as action}
          <div class="sb-entry">
            <span class="sb-entry-name">{action.name}{action.type ? ` (${action.type})` : ''}.</span>
            <span class="sb-entry-desc"> {action.description}</span>
          </div>
        {/each}
      </div>

      <!-- Reactions -->
      {#if enemy.reactions?.length}
        <div class="sb-section">
          <div class="sb-section-label">Reactions</div>
          {#each enemy.reactions as reaction}
            <div class="sb-entry">
              <span class="sb-entry-name">{reaction.name}.</span>
              <span class="sb-entry-desc"> <em>Trigger:</em> {reaction.trigger} — {reaction.description}</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Spellcasting -->
      {#if enemy.spellcasting}
        {@const sc = enemy.spellcasting}
        <div class="sb-section">
          <div class="sb-section-label">Spellcasting</div>
          <div class="sb-entry-desc">
            {enemy.name} is a spellcaster. Spellcasting ability: {sc.ability}
            (spell save DC {sc.spell_save_dc}, +{sc.spell_attack_bonus} to hit).
            {#if sc.notes}<em>{sc.notes}</em>{/if}
          </div>
          {#if sc.at_will?.length}
            <div class="sb-spell-group">
              <span class="sb-spell-group-label">At will:</span>
              <span class="sb-spell-list">{toArr(sc.at_will).join(', ')}</span>
            </div>
          {/if}
          {#each Object.entries(sc.per_day ?? {}) as [uses, spells]}
            <div class="sb-spell-group">
              <span class="sb-spell-group-label">{uses}/day:</span>
              <span class="sb-spell-list">{toArr(spells).join(', ')}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  @import '../../css/enemies.css';
</style>
