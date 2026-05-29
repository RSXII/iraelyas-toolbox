<script lang="ts">
  import { untrack } from 'svelte';
  import type {
    MonsterStatBlock, MonsterSize, MonsterType,
    MonsterTrait, MonsterAction, MonsterReaction,
    SpellcastingAbility,
  } from '@/types/index';

  interface Props {
    enemy?: MonsterStatBlock;
    open: boolean;
    onsave: (e: MonsterStatBlock) => void;
    onclose: () => void;
  }

  let { enemy, open, onsave, onclose }: Props = $props();

  // ── CR → XP lookup (D&D 2024) ──────────────────────────────────
  const CR_XP: Record<number, number> = {
    0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700,
    4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
    11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000,
    17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000,
    23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000,
    29: 135000, 30: 155000,
  };

  const SIZES: MonsterSize[]  = ['Tiny','Small','Medium','Large','Huge','Gargantuan'];
  const TYPES: MonsterType[]  = [
    'Aberration','Beast','Celestial','Construct','Dragon','Elemental',
    'Fey','Fiend','Giant','Humanoid','Monstrosity','Ooze','Plant','Undead',
  ];
  const CR_VALUES = [0, 0.125, 0.25, 0.5, ...Array.from({length:30}, (_,i) => i+1)];
  const SPELL_ABILITIES: SpellcastingAbility[] = ['STR','DEX','CON','INT','WIS','CHA'];
  const HP_FORMULA_RE = /^\d+d\d+(\s*[+-]\s*\d+)?$/;

  function crLabel(cr: number): string {
    if (cr === 0.125) return '1/8';
    if (cr === 0.25)  return '1/4';
    if (cr === 0.5)   return '1/2';
    return String(cr);
  }

  function mod(score: number): string {
    const m = Math.floor((score - 10) / 2);
    return m >= 0 ? `+${m}` : `${m}`;
  }

  // ── Form state ──────────────────────────────────────────────────
  let name       = $state('');
  let size       = $state<MonsterSize>('Medium');
  let type       = $state<MonsterType>('Humanoid');
  let subtype    = $state('');
  let alignment  = $state('');
  let cr         = $state(1);
  let xp         = $state(200);
  let ac         = $state(12);
  let ac_source  = $state('Natural Armor');
  let hp         = $state(30);
  let hp_formula = $state('4d8 + 12');
  let walk       = $state(30);
  let fly        = $state<number|undefined>(undefined);
  let swim       = $state<number|undefined>(undefined);
  let climb      = $state<number|undefined>(undefined);
  let burrow     = $state<number|undefined>(undefined);
  let str        = $state(10);
  let dex        = $state(10);
  let con        = $state(10);
  let int_score  = $state(10);
  let wis        = $state(10);
  let cha        = $state(10);

  // Saving throws (optional — empty string = not proficient)
  let st_str = $state(''); let st_dex = $state(''); let st_con = $state('');
  let st_int = $state(''); let st_wis = $state(''); let st_cha = $state('');

  // Skills: array of { name, bonus } pairs
  let skills = $state<{name:string; bonus:number}[]>([]);

  let dmg_immunities    = $state('');
  let dmg_resistances   = $state('');
  let dmg_vulnerabilities = $state('');
  let cond_immunities   = $state('');

  let darkvision  = $state<number|undefined>(undefined);
  let blindsight  = $state<number|undefined>(undefined);
  let truesight   = $state<number|undefined>(undefined);
  let tremorsense = $state<number|undefined>(undefined);
  let passive_perception = $state(10);
  let languages  = $state('Common');

  let traits   = $state<MonsterTrait[]>([]);
  let actions  = $state<MonsterAction[]>([{ name:'', description:'' }]);
  let reactions = $state<MonsterReaction[]>([]);

  let showReactions   = $state(false);
  let showSpellcasting = $state(false);

  let sc_ability    = $state<SpellcastingAbility>('INT');
  let sc_dc         = $state(12);
  let sc_atk        = $state(4);
  let sc_at_will    = $state('');
  let sc_per_day    = $state('');
  let sc_notes      = $state('');

  let hpFormulaInvalid = $state(false);
  let submitted = $state(false);

  // Populate from prop when modal opens.
  // untrack() prevents all the write targets from becoming tracked dependencies
  // of this effect — only `open` and `enemy` drive re-runs.
  $effect(() => {
    if (!open) return;
    const e = enemy; // track `enemy` prop here, outside untrack
    untrack(() => {
      submitted = false;
      hpFormulaInvalid = false;
      if (e) {
        name        = e.name;
        size        = e.size;
        type        = e.type;
        subtype     = e.subtype ?? '';
        alignment   = e.alignment;
        cr          = e.cr;
        xp          = e.xp;
        ac          = e.ac;
        ac_source   = e.ac_source;
        hp          = e.hp;
        hp_formula  = e.hp_formula;
        walk        = e.speed.walk;
        fly         = e.speed.fly;
        swim        = e.speed.swim;
        climb       = e.speed.climb;
        burrow      = e.speed.burrow;
        str         = e.ability_scores.str;
        dex         = e.ability_scores.dex;
        con         = e.ability_scores.con;
        int_score   = e.ability_scores.int;
        wis         = e.ability_scores.wis;
        cha         = e.ability_scores.cha;
        st_str      = e.saving_throws?.str != null ? String(e.saving_throws.str) : '';
        st_dex      = e.saving_throws?.dex != null ? String(e.saving_throws.dex) : '';
        st_con      = e.saving_throws?.con != null ? String(e.saving_throws.con) : '';
        st_int      = e.saving_throws?.int != null ? String(e.saving_throws.int) : '';
        st_wis      = e.saving_throws?.wis != null ? String(e.saving_throws.wis) : '';
        st_cha      = e.saving_throws?.cha != null ? String(e.saving_throws.cha) : '';
        skills      = Object.entries(e.skills ?? {}).map(([sk, b]) => ({ name: sk, bonus: b }));
        dmg_immunities      = (e.damage_immunities ?? []).join(', ');
        dmg_resistances     = (e.damage_resistances ?? []).join(', ');
        dmg_vulnerabilities = (e.damage_vulnerabilities ?? []).join(', ');
        cond_immunities     = (e.condition_immunities ?? []).join(', ');
        darkvision  = e.senses.darkvision;
        blindsight  = e.senses.blindsight;
        truesight   = e.senses.truesight;
        tremorsense = e.senses.tremorsense;
        passive_perception = e.senses.passive_perception;
        languages   = e.languages.join(', ');
        traits      = e.traits.map((t) => ({ ...t }));
        actions     = e.actions.map((a) => ({ ...a }));
        const r     = (e.reactions ?? []).map((rv) => ({ ...rv }));
        reactions   = r;
        showReactions    = r.length > 0;       // use local var — not a reactive read
        showSpellcasting = !!e.spellcasting;
        if (e.spellcasting) {
          const sc = e.spellcasting;
          sc_ability = sc.ability;
          sc_dc      = sc.spell_save_dc;
          sc_atk     = sc.spell_attack_bonus;
          sc_at_will = (sc.at_will ?? []).join(', ');
          sc_per_day = Object.entries(sc.per_day ?? {}).map(([k,v]) => `${k}:${v.join(',')}`).join('; ');
          sc_notes   = sc.notes ?? '';
        }
      } else {
        // Defaults for new enemy
        name=''; size='Medium'; type='Humanoid'; subtype=''; alignment='';
        cr=1; xp=200; ac=12; ac_source='Natural Armor'; hp=30; hp_formula='4d8 + 12';
        walk=30; fly=undefined; swim=undefined; climb=undefined; burrow=undefined;
        str=10; dex=10; con=10; int_score=10; wis=10; cha=10;
        st_str=''; st_dex=''; st_con=''; st_int=''; st_wis=''; st_cha='';
        skills=[]; dmg_immunities=''; dmg_resistances=''; dmg_vulnerabilities=''; cond_immunities='';
        darkvision=undefined; blindsight=undefined; truesight=undefined; tremorsense=undefined;
        passive_perception=10; languages='Common';
        traits=[]; actions=[{ name:'', description:'' }]; reactions=[];
        showReactions=false; showSpellcasting=false;
        sc_ability='INT'; sc_dc=12; sc_atk=4; sc_at_will=''; sc_per_day=''; sc_notes='';
      }
    });
  });

  // Auto-fill XP when CR changes (user-driven only — population effect sets xp directly).
  // untrack on the read side keeps this from looping if something else writes cr.
  $effect(() => {
    const newCr = cr;
    untrack(() => { xp = CR_XP[newCr] ?? 0; });
  });

  function parseSplit(raw: string): string[] {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  function parsePerDay(raw: string): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    raw.split(';').forEach((seg) => {
      const [k, rest] = seg.split(':');
      if (k?.trim() && rest?.trim()) {
        out[k.trim()] = rest.split(',').map((s) => s.trim()).filter(Boolean);
      }
    });
    return out;
  }

  function buildSavingThrows(): Partial<Record<string, number>> | undefined {
    const map: Record<string, string> = { str: st_str, dex: st_dex, con: st_con, int: st_int, wis: st_wis, cha: st_cha };
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(map)) {
      const n = parseInt(v);
      if (!isNaN(n)) result[k] = n;
    }
    return Object.keys(result).length ? result : undefined;
  }

  function submit(): void {
    submitted = true;
    hpFormulaInvalid = !HP_FORMULA_RE.test(hp_formula.trim());
    if (!name.trim() || !alignment.trim() || hpFormulaInvalid) return;

    const block: MonsterStatBlock = {
      id: enemy?.id ?? crypto.randomUUID(),
      name: name.trim(),
      size, type,
      ...(subtype.trim() ? { subtype: subtype.trim() } : {}),
      alignment: alignment.trim(),
      cr, xp, ac,
      ac_source: ac_source.trim(),
      hp,
      hp_formula: hp_formula.trim(),
      speed: {
        walk,
        ...(fly    != null ? { fly }    : {}),
        ...(swim   != null ? { swim }   : {}),
        ...(climb  != null ? { climb }  : {}),
        ...(burrow != null ? { burrow } : {}),
      },
      ability_scores: { str, dex, con, int: int_score, wis, cha },
      ...(buildSavingThrows() ? { saving_throws: buildSavingThrows() } : {}),
      ...(skills.length ? { skills: Object.fromEntries(skills.map((s) => [s.name, s.bonus])) } : {}),
      ...(dmg_immunities.trim()      ? { damage_immunities: parseSplit(dmg_immunities) }        : {}),
      ...(dmg_resistances.trim()     ? { damage_resistances: parseSplit(dmg_resistances) }      : {}),
      ...(dmg_vulnerabilities.trim() ? { damage_vulnerabilities: parseSplit(dmg_vulnerabilities) } : {}),
      ...(cond_immunities.trim()     ? { condition_immunities: parseSplit(cond_immunities) }    : {}),
      senses: {
        passive_perception,
        ...(darkvision  != null ? { darkvision }  : {}),
        ...(blindsight  != null ? { blindsight }  : {}),
        ...(truesight   != null ? { truesight }   : {}),
        ...(tremorsense != null ? { tremorsense } : {}),
      },
      languages: parseSplit(languages),
      traits: traits.filter((t) => t.name.trim()),
      actions: actions.filter((a) => a.name.trim()),
      ...(showReactions && reactions.length ? { reactions: reactions.filter((r) => r.name.trim()) } : {}),
      ...(showSpellcasting ? {
        spellcasting: {
          ability: sc_ability,
          spell_save_dc: sc_dc,
          spell_attack_bonus: sc_atk,
          ...(sc_at_will.trim() ? { at_will: parseSplit(sc_at_will) } : {}),
          ...(sc_per_day.trim() ? { per_day: parsePerDay(sc_per_day) } : {}),
          ...(sc_notes.trim()   ? { notes: sc_notes.trim() } : {}),
        },
      } : {}),
    };

    onsave(block);
  }

  function addTrait(): void  { traits  = [...traits,  { name: '', description: '' }]; }
  function addAction(): void { actions = [...actions, { name: '', description: '' }]; }
  function addReaction(): void { reactions = [...reactions, { name: '', trigger: '', description: '' }]; }
  function removeTrait(i: number): void   { traits   = traits.filter((_,j) => j !== i); }
  function removeAction(i: number): void  { actions  = actions.filter((_,j) => j !== i); }
  function removeReaction(i: number): void { reactions = reactions.filter((_,j) => j !== i); }
</script>

<div class="modal-overlay" class:open>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop-hit" onclick={onclose}></div>
  <div class="modal" style="max-width:680px; max-height:86vh; overflow-y:auto">
    <h3>{enemy ? 'Edit Enemy' : 'New Enemy'}</h3>

    <div class="enemy-form">

      <!-- ── Header ── -->
      <div class="enemy-form-section">
        <div class="enemy-form-section-title">Identity</div>
        <div class="form-row">
          <div class="form-group" style="flex:2; min-width:160px">
            <label class="form-label" for="ef-name">Name *</label>
            <input id="ef-name" class="form-input" class:invalid={submitted && !name.trim()} bind:value={name} />
          </div>
          <div class="form-group">
            <label class="form-label" for="ef-size">Size</label>
            <select id="ef-size" class="form-select" bind:value={size}>
              {#each SIZES as s}<option value={s}>{s}</option>{/each}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="ef-type">Type</label>
            <select id="ef-type" class="form-select" bind:value={type}>
              {#each TYPES as t}<option value={t}>{t}</option>{/each}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="ef-subtype">Subtype</label>
            <input id="ef-subtype" class="form-input" placeholder="e.g. Demon" bind:value={subtype} />
          </div>
          <div class="form-group" style="flex:2">
            <label class="form-label" for="ef-align">Alignment *</label>
            <input id="ef-align" class="form-input" class:invalid={submitted && !alignment.trim()} placeholder="e.g. Chaotic Evil" bind:value={alignment} />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="ef-cr">CR</label>
            <select id="ef-cr" class="form-select" bind:value={cr}>
              {#each CR_VALUES as v}<option value={v}>{crLabel(v)}</option>{/each}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="ef-xp">XP</label>
            <input id="ef-xp" type="number" min="0" class="form-input" bind:value={xp} />
          </div>
        </div>
      </div>

      <!-- ── Defense ── -->
      <div class="enemy-form-section">
        <div class="enemy-form-section-title">Defense</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="ef-ac">AC</label>
            <input id="ef-ac" type="number" min="1" class="form-input" bind:value={ac} />
          </div>
          <div class="form-group" style="flex:2">
            <label class="form-label" for="ef-ac-src">AC Source</label>
            <input id="ef-ac-src" class="form-input" placeholder="Natural Armor" bind:value={ac_source} />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="ef-hp">Avg HP</label>
            <input id="ef-hp" type="number" min="1" class="form-input" bind:value={hp} />
          </div>
          <div class="form-group" style="flex:2">
            <label class="form-label" for="ef-formula">HP Formula *</label>
            <input id="ef-formula" class="form-input" placeholder="4d8 + 12"
              class:invalid={hpFormulaInvalid} bind:value={hp_formula}
              oninput={() => { hpFormulaInvalid = !HP_FORMULA_RE.test(hp_formula.trim()); }}
            />
          </div>
        </div>
      </div>

      <!-- ── Speed ── -->
      <div class="enemy-form-section">
        <div class="enemy-form-section-title">Speed (ft.)</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="ef-walk">Walk *</label>
            <input id="ef-walk" type="number" min="0" step="5" class="form-input" bind:value={walk} />
          </div>
          <div class="form-group">
            <label class="form-label" for="ef-fly">Fly</label>
            <input id="ef-fly" type="number" min="0" step="5" class="form-input" placeholder="—"
              value={fly ?? ''} oninput={(e) => { const v=(e.target as HTMLInputElement).value; fly=v?parseInt(v):undefined; }} />
          </div>
          <div class="form-group">
            <label class="form-label" for="ef-swim">Swim</label>
            <input id="ef-swim" type="number" min="0" step="5" class="form-input" placeholder="—"
              value={swim ?? ''} oninput={(e) => { const v=(e.target as HTMLInputElement).value; swim=v?parseInt(v):undefined; }} />
          </div>
          <div class="form-group">
            <label class="form-label" for="ef-climb">Climb</label>
            <input id="ef-climb" type="number" min="0" step="5" class="form-input" placeholder="—"
              value={climb ?? ''} oninput={(e) => { const v=(e.target as HTMLInputElement).value; climb=v?parseInt(v):undefined; }} />
          </div>
          <div class="form-group">
            <label class="form-label" for="ef-burrow">Burrow</label>
            <input id="ef-burrow" type="number" min="0" step="5" class="form-input" placeholder="—"
              value={burrow ?? ''} oninput={(e) => { const v=(e.target as HTMLInputElement).value; burrow=v?parseInt(v):undefined; }} />
          </div>
        </div>
      </div>

      <!-- ── Ability Scores ── -->
      <div class="enemy-form-section">
        <div class="enemy-form-section-title">Ability Scores</div>
        <div class="ability-grid-form">
          {#each ([['STR',str,'str'],['DEX',dex,'dex'],['CON',con,'con'],['INT',int_score,'int'],['WIS',wis,'wis'],['CHA',cha,'cha']] as const) as [label, val, key]}
            <div class="ability-cell-form">
              <span class="form-label">{label}</span>
              <input type="number" min="1" max="30" class="form-input" style="text-align:center; padding:6px 4px"
                value={val}
                oninput={(e) => {
                  const n = parseInt((e.target as HTMLInputElement).value) || 10;
                  if (key==='str') str=n; else if (key==='dex') dex=n; else if (key==='con') con=n;
                  else if (key==='int') int_score=n; else if (key==='wis') wis=n; else cha=n;
                }}
              />
              <span class="ability-modifier-preview">{mod(val)}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- ── Saving Throws ── -->
      <div class="enemy-form-section">
        <div class="enemy-form-section-title">Saving Throw Bonuses (proficient only)</div>
        <div class="form-row">
          {#each ([['STR',st_str],[' DEX',st_dex],['CON',st_con],['INT',st_int],['WIS',st_wis],['CHA',st_cha]] as const) as [label, val], i}
            <div class="form-group" style="min-width:56px">
              <label class="form-label">{label.trim()}</label>
              <input type="number" class="form-input" style="text-align:center" placeholder="—"
                value={val}
                oninput={(e) => {
                  const v=(e.target as HTMLInputElement).value;
                  if (i===0) st_str=v; else if (i===1) st_dex=v; else if (i===2) st_con=v;
                  else if (i===3) st_int=v; else if (i===4) st_wis=v; else st_cha=v;
                }}
              />
            </div>
          {/each}
        </div>
      </div>

      <!-- ── Skills ── -->
      <div class="enemy-form-section">
        <div class="enemy-form-section-title">Skills</div>
        {#each skills as skill, i}
          <div class="form-row" style="align-items:center">
            <div class="form-group" style="flex:2">
              <input class="form-input" placeholder="Skill name (e.g. Perception)" bind:value={skill.name} />
            </div>
            <div class="form-group" style="min-width:64px">
              <input type="number" class="form-input" style="text-align:center" bind:value={skill.bonus} />
            </div>
            <button class="dynamic-entry-remove" onclick={() => removeTrait(i)} title="Remove">✕</button>
          </div>
        {/each}
        <button class="btn btn-sm" onclick={() => { skills = [...skills, { name:'', bonus:0 }]; }}>+ Add Skill</button>
      </div>

      <!-- ── Damage & Conditions ── -->
      <div class="enemy-form-section">
        <div class="enemy-form-section-title">Damage &amp; Condition Tags (comma-separated)</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Immunities</label>
            <input class="form-input" placeholder="fire, poison…" bind:value={dmg_immunities} />
          </div>
          <div class="form-group">
            <label class="form-label">Resistances</label>
            <input class="form-input" placeholder="cold, lightning…" bind:value={dmg_resistances} />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Vulnerabilities</label>
            <input class="form-input" placeholder="thunder…" bind:value={dmg_vulnerabilities} />
          </div>
          <div class="form-group">
            <label class="form-label">Condition Immunities</label>
            <input class="form-input" placeholder="charmed, frightened…" bind:value={cond_immunities} />
          </div>
        </div>
      </div>

      <!-- ── Senses & Languages ── -->
      <div class="enemy-form-section">
        <div class="enemy-form-section-title">Senses &amp; Languages</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="ef-pp">Passive Perception</label>
            <input id="ef-pp" type="number" min="0" class="form-input" bind:value={passive_perception} />
          </div>
          <div class="form-group">
            <label class="form-label">Darkvision (ft.)</label>
            <input type="number" min="0" step="10" class="form-input" placeholder="—"
              value={darkvision ?? ''} oninput={(e) => { const v=(e.target as HTMLInputElement).value; darkvision=v?parseInt(v):undefined; }} />
          </div>
          <div class="form-group">
            <label class="form-label">Blindsight (ft.)</label>
            <input type="number" min="0" step="10" class="form-input" placeholder="—"
              value={blindsight ?? ''} oninput={(e) => { const v=(e.target as HTMLInputElement).value; blindsight=v?parseInt(v):undefined; }} />
          </div>
          <div class="form-group">
            <label class="form-label">Truesight (ft.)</label>
            <input type="number" min="0" step="10" class="form-input" placeholder="—"
              value={truesight ?? ''} oninput={(e) => { const v=(e.target as HTMLInputElement).value; truesight=v?parseInt(v):undefined; }} />
          </div>
          <div class="form-group">
            <label class="form-label">Tremorsense (ft.)</label>
            <input type="number" min="0" step="10" class="form-input" placeholder="—"
              value={tremorsense ?? ''} oninput={(e) => { const v=(e.target as HTMLInputElement).value; tremorsense=v?parseInt(v):undefined; }} />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group full">
            <label class="form-label">Languages (comma-separated)</label>
            <input class="form-input" placeholder="Common, Elvish…" bind:value={languages} />
          </div>
        </div>
      </div>

      <!-- ── Traits ── -->
      <div class="enemy-form-section">
        <div class="enemy-form-section-title">Traits</div>
        {#each traits as trait, i}
          <div class="dynamic-list-entry">
            <div class="dynamic-list-entry-header">
              <input class="form-input" placeholder="Trait name" bind:value={trait.name} />
              <button class="dynamic-entry-remove" onclick={() => removeTrait(i)} title="Remove">✕</button>
            </div>
            <textarea class="form-textarea" placeholder="Description" bind:value={trait.description}></textarea>
          </div>
        {/each}
        <button class="btn btn-sm" onclick={addTrait}>+ Add Trait</button>
      </div>

      <!-- ── Actions ── -->
      <div class="enemy-form-section">
        <div class="enemy-form-section-title">Actions</div>
        {#each actions as action, i}
          <div class="dynamic-list-entry">
            <div class="dynamic-list-entry-header">
              <input class="form-input" placeholder="Action name" bind:value={action.name} />
              <select class="form-select" style="max-width:130px" bind:value={action.type}>
                <option value={undefined}>—type—</option>
                <option value="weapon">Weapon</option>
                <option value="spell">Spell</option>
                <option value="special">Special</option>
                <option value="multiattack">Multiattack</option>
              </select>
              <button class="dynamic-entry-remove" onclick={() => removeAction(i)} title="Remove">✕</button>
            </div>
            <textarea class="form-textarea" placeholder="Full action description (displayed in stat block)" bind:value={action.description}></textarea>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Attack Bonus</label>
                <input type="number" class="form-input" style="text-align:center" placeholder="—"
                  value={action.attack_bonus ?? ''} oninput={(e) => { const v=(e.target as HTMLInputElement).value; action.attack_bonus=v?parseInt(v):undefined; }} />
              </div>
              <div class="form-group">
                <label class="form-label">Damage</label>
                <input class="form-input" placeholder="2d6 + 3" bind:value={action.damage} />
              </div>
              <div class="form-group">
                <label class="form-label">Damage Type</label>
                <input class="form-input" placeholder="slashing" bind:value={action.damage_type} />
              </div>
            </div>
          </div>
        {/each}
        <button class="btn btn-sm" onclick={addAction}>+ Add Action</button>
      </div>

      <!-- ── Reactions (optional) ── -->
      {#if !showReactions}
        <button class="optional-section-toggle" onclick={() => { showReactions = true; }}>+ Add Reactions</button>
      {:else}
        <div class="enemy-form-section">
          <div class="enemy-form-section-title">Reactions</div>
          {#each reactions as reaction, i}
            <div class="dynamic-list-entry">
              <div class="dynamic-list-entry-header">
                <input class="form-input" placeholder="Reaction name" bind:value={reaction.name} />
                <button class="dynamic-entry-remove" onclick={() => removeReaction(i)}>✕</button>
              </div>
              <input class="form-input" placeholder="Trigger condition" bind:value={reaction.trigger} style="margin-bottom:4px" />
              <textarea class="form-textarea" placeholder="Description" bind:value={reaction.description}></textarea>
            </div>
          {/each}
          <button class="btn btn-sm" onclick={addReaction}>+ Add Reaction</button>
        </div>
      {/if}

      <!-- ── Spellcasting (optional) ── -->
      {#if !showSpellcasting}
        <button class="optional-section-toggle" onclick={() => { showSpellcasting = true; }}>+ Add Spellcasting</button>
      {:else}
        <div class="enemy-form-section">
          <div class="enemy-form-section-title">Spellcasting</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Ability</label>
              <select class="form-select" bind:value={sc_ability}>
                {#each SPELL_ABILITIES as a}<option value={a}>{a}</option>{/each}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Spell Save DC</label>
              <input type="number" min="0" class="form-input" bind:value={sc_dc} />
            </div>
            <div class="form-group">
              <label class="form-label">Spell Attack Bonus</label>
              <input type="number" class="form-input" bind:value={sc_atk} />
            </div>
          </div>
          <div class="form-group full">
            <label class="form-label" for="ef-sc-atwill">At Will (comma-separated)</label>
            <input id="ef-sc-atwill" class="form-input" placeholder="detect magic, light…" bind:value={sc_at_will} />
          </div>
          <div class="form-group full">
            <label class="form-label" for="ef-sc-perday">Per Day (format: 3:fireball,lightning bolt; 1:wish)</label>
            <input id="ef-sc-perday" class="form-input" placeholder="3:fireball; 1:wish" bind:value={sc_per_day} />
          </div>
          <div class="form-group full">
            <label class="form-label" for="ef-sc-notes">Notes</label>
            <input id="ef-sc-notes" class="form-input" placeholder="Requires no material components…" bind:value={sc_notes} />
          </div>
          <button class="optional-section-toggle" onclick={() => { showSpellcasting = false; reactions=[]; }}>Remove Spellcasting</button>
        </div>
      {/if}

    </div><!-- /enemy-form -->

    <div class="modal-footer">
      <button class="btn btn-gold" onclick={submit}>
        {enemy ? 'Save Changes' : 'Add to Library'}
      </button>
      <button class="btn" onclick={onclose}>Cancel</button>
    </div>
  </div>
</div>

<style>
  @import '../../css/enemies.css';
</style>
