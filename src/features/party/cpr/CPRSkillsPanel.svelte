<script lang="ts">
  import type { CPRSkills } from '@/types/index';
  import { CPR_SKILL_DEFS, type CPRSkillDef } from './cprSkillDefs';
  import { showToast } from '@/state/toast.svelte';

  interface Props {
    skills: CPRSkills;
    onchange: (key: keyof CPRSkills, value: number | undefined) => void;
  }
  let { skills, onchange }: Props = $props();

  const mid = Math.ceil(CPR_SKILL_DEFS.length / 2);
  const colA = CPR_SKILL_DEFS.slice(0, mid);
  const colB = CPR_SKILL_DEFS.slice(mid);

  function d10(): number {
    return Math.floor(Math.random() * 10) + 1;
  }

  function rollSkill(def: CPRSkillDef, bonus: number | undefined): void {
    const b = bonus ?? 0;
    const initial = d10();
    const bonusPart = b !== 0 ? ` + ${b}` : '';

    let msg: string;
    if (initial === 10) {
      const extra = d10();
      const total = initial + extra + b;
      msg = `CRIT — ${def.name}: 10+${extra}${bonusPart} = ${total}`;
    } else if (initial === 1) {
      const extra = d10();
      const total = initial - extra + b;
      msg = `FUMBLE — ${def.name}: 1−${extra}${bonusPart} = ${total}`;
    } else {
      const total = initial + b;
      msg = `${def.name}: ${initial}${bonusPart} = ${total}`;
    }

    showToast(msg);
  }

  function handleChange(key: keyof CPRSkills, e: Event): void {
    const raw = (e.target as HTMLInputElement).value.trim();
    if (raw === '') {
      onchange(key, undefined);
    } else {
      const n = parseInt(raw, 10);
      if (!isNaN(n)) onchange(key, n);
    }
  }
</script>

<div class="cpr-skills-two-col">
  {#each [colA, colB] as col}
    <div class="cpr-skills-col">
      <div class="cpr-skills-header">
        <span>Name</span>
        <span>Base</span>
      </div>
      {#each col as def (def.key)}
        {@const val = skills[def.key]}
        <div class="cpr-skill-row">
          <!-- svelte-ignore a11y_interactive_supports_focus -->
          <div class="cpr-skill-name-wrap cpr-skill-rollable" role="button" tabindex="0"
            title="Roll {def.name}"
            onclick={() => rollSkill(def, val)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rollSkill(def, val); } }}>
            <span class="cpr-skill-name">{def.name}</span>
            <span class="cpr-skill-stat">({def.stat})</span>
          </div>
          <input
            class="cpr-skill-base-input"
            type="text"
            inputmode="numeric"
            value={val ?? ''}
            placeholder="—"
            onchange={(e) => handleChange(def.key, e)}
          />
        </div>
      {/each}
    </div>
  {/each}
</div>
