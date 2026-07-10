<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { pickAndCompressPortrait } from '@/utils/npc-image';
  import type { PCCard } from '@/types/index';

  interface Props {
    pc: PCCard;
    deleteEnabled?: boolean;
    ondelete?: () => void;
  }
  let { pc, deleteEnabled = false, ondelete }: Props = $props();

  const cid = $derived(store.activeCampaignId);

  const ROLES = ['Exec', 'Fixer', 'Lawman', 'Media', 'Medtech', 'Netrunner', 'Nomad', 'Rockerboy', 'Solo', 'Tech'] as const;

  const BASE_STATS: [string, string][] = [
    ['Int',  'statInt'],
    ['Ref',  'statRef'],
    ['Dex',  'statDex'],
    ['Tech', 'statTech'],
    ['Cool', 'statCool'],
    ['Will', 'statWill'],
    ['Luck', 'statLuck'],
    ['Move', 'statMove'],
    ['Body', 'statBody'],
    ['Emp',  'statEmp'],
  ];

  function initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  }

  async function pickPortrait(): Promise<void> {
    const dataUrl = await pickAndCompressPortrait();
    if (dataUrl) { pc.portrait = dataUrl; store.save(); }
  }

  function saveField(key: string, value: string): void {
    if (!cid) return;
    store.updateCprPCStats(cid, pc.id, { [key]: value });
  }

  function savePlat(value: string): void {
    if (!cid) return;
    const n = parseInt(value);
    store.updateCprPCStats(cid, pc.id, { plat: isNaN(n) || n < 0 ? 0 : n });
  }

  function saveName(value: string): void {
    const name = value.trim() || 'Unnamed';
    pc.name = name;
    if (cid) {
      const pd = store.getCampaignData(cid).players[pc.id];
      if (pd) pd.player = name;
    }
    store.save();
  }

  function saveRole(value: string): void {
    if (!cid) return;
    store.updateCprPCStats(cid, pc.id, { role: value });
  }

  const s = $derived(pc.cprStats ?? {});

  function genId(): string {
    return `cf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }
</script>

<div class="cpr-pc-card">

  <!-- Header: portrait column + name/role -->
  <div class="cpr-pc-header">
    <!-- Portrait column -->
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="cpr-pc-avatar" role="button" tabindex="0"
      title="Click to change portrait"
      onclick={pickPortrait}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickPortrait(); } }}>
      {#if pc.portrait}
        <img src={pc.portrait} alt="" aria-hidden="true" />
      {:else}
        {initials(pc.name)}
      {/if}
    </div>

    <!-- Name / role -->
    <div class="cpr-pc-info">
      <input
        class="cpr-pc-name-input"
        type="text"
        value={pc.name}
        placeholder="Character name"
        onchange={(e) => saveName((e.target as HTMLInputElement).value)}
      />
      <select
        class="cpr-pc-role-select"
        value={s.role ?? ''}
        onchange={(e) => saveRole((e.target as HTMLSelectElement).value)}
      >
        <option value="">Role</option>
        {#each ROLES as r}
          <option value={r}>{r}</option>
        {/each}
      </select>
    </div>

    {#if deleteEnabled}
      <button class="btn-icon danger cpr-pc-delete-btn" title="Remove character" onclick={ondelete}>✕</button>
    {/if}
  </div>

  <!-- Base stats grid: 5 across × 2 rows -->
  <div class="cpr-base-stats">
    {#each BASE_STATS as [label, key]}
      <div class="cpr-base-stat-cell">
        <div class="cpr-base-stat-label">{label}</div>
        <input
          class="cpr-base-stat-input"
          type="text"
          value={(s as Record<string, string>)[key] ?? ''}
          placeholder="—"
          onchange={(e) => saveField(key, (e.target as HTMLInputElement).value.trim())}
        />
      </div>
    {/each}
  </div>

  <!-- Combat stats row: HP | Armor SP | Humanity -->
  <div class="cpr-pc-stats-row">
    <div class="cpr-stat-cell">
      <div class="cpr-stat-label">HP</div>
      <div class="cpr-stat-inputs">
        <input class="cpr-stat-input" type="text" value={s.hp ?? ''} placeholder="—"
          onchange={(e) => saveField('hp', (e.target as HTMLInputElement).value.trim())} />
        <span class="cpr-stat-sep">/</span>
        <input class="cpr-stat-input" type="text" value={s.hpMax ?? ''} placeholder="—"
          onchange={(e) => saveField('hpMax', (e.target as HTMLInputElement).value.trim())} />
      </div>
    </div>
    <div class="cpr-stat-cell">
      <div class="cpr-stat-label">Armor SP</div>
      <div class="cpr-stat-inputs">
        <input class="cpr-stat-input wide" type="text" value={s.armorSP ?? ''} placeholder="—"
          onchange={(e) => saveField('armorSP', (e.target as HTMLInputElement).value.trim())} />
      </div>
    </div>
    <div class="cpr-stat-cell">
      <div class="cpr-stat-label">Humanity</div>
      <div class="cpr-stat-inputs">
        <input class="cpr-stat-input" type="text" value={s.humanity ?? ''} placeholder="—"
          onchange={(e) => saveField('humanity', (e.target as HTMLInputElement).value.trim())} />
        <span class="cpr-stat-sep">/</span>
        <input class="cpr-stat-input" type="text" value={s.humanityMax ?? ''} placeholder="—"
          onchange={(e) => saveField('humanityMax', (e.target as HTMLInputElement).value.trim())} />
      </div>
    </div>
  </div>

  <!-- Resources row: Street Cred | Luck pts | Plat -->
  <div class="cpr-pc-stats-row cpr-pc-stats-row-2">
    <div class="cpr-stat-cell">
      <div class="cpr-stat-label">Street Cred</div>
      <div class="cpr-stat-inputs">
        <input class="cpr-stat-input wide" type="text" value={s.streetCred ?? ''} placeholder="—"
          onchange={(e) => saveField('streetCred', (e.target as HTMLInputElement).value.trim())} />
      </div>
    </div>
    <div class="cpr-stat-cell">
      <div class="cpr-stat-label">Luck Pts</div>
      <div class="cpr-stat-inputs">
        <input class="cpr-stat-input" type="text" value={s.luck ?? ''} placeholder="—"
          onchange={(e) => saveField('luck', (e.target as HTMLInputElement).value.trim())} />
        <span class="cpr-stat-sep">/</span>
        <input class="cpr-stat-input" type="text" value={s.luckMax ?? ''} placeholder="—"
          onchange={(e) => saveField('luckMax', (e.target as HTMLInputElement).value.trim())} />
      </div>
    </div>
    <div class="cpr-stat-cell">
      <div class="cpr-stat-label">Plat</div>
      <div class="cpr-stat-inputs">
        <input class="cpr-stat-input wide" type="number" min="0" value={s.plat ?? 0} placeholder="0"
          onchange={(e) => savePlat((e.target as HTMLInputElement).value)} />
      </div>
    </div>
  </div>

  <!-- Custom fields -->
  <div class="cpr-pc-custom">
    {#each pc.custom as field, fi (field.id)}
      <div class="cpr-custom-row">
        <input class="cpr-custom-name" type="text" value={field.name} placeholder="Field"
          onchange={(e) => { field.name = (e.target as HTMLInputElement).value.trim() || 'Field'; store.save(); }} />
        <input class="cpr-custom-value" type="text" value={field.value} placeholder="—"
          onchange={(e) => { field.value = (e.target as HTMLInputElement).value; store.save(); }} />
        <button class="cpr-custom-del" title="Remove"
          onclick={() => { pc.custom.splice(fi, 1); store.save(); }}>✕</button>
      </div>
    {/each}
    <button class="cpr-add-field"
      onclick={() => { pc.custom.push({ id: genId(), name: 'Field', value: '' }); store.save(); }}>
      + Add Field
    </button>
  </div>

</div>
