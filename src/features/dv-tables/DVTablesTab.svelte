<script lang="ts">
  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  const RANGES = [
    { label: '0–6',     unit: 'm/yds' },
    { label: '7–12',    unit: 'm/yds' },
    { label: '13–25',   unit: 'm/yds' },
    { label: '26–50',   unit: 'm/yds' },
    { label: '51–100',  unit: 'm/yds' },
    { label: '101–200', unit: 'm/yds' },
    { label: '201–400', unit: 'm/yds' },
    { label: '401–800', unit: 'm/yds' },
  ] as const;

  const RANGED_WEAPONS: { name: string; dv: (number | null)[] }[] = [
    { name: 'Pistol',           dv: [13, 15, 20, 25, 30, 30, null, null] },
    { name: 'SMG',              dv: [15, 13, 15, 20, 25, 25,   30, null] },
    { name: 'Shotgun (Slug)',   dv: [13, 15, 20, 25, 30, 35, null, null] },
    { name: 'Assault Rifle',    dv: [17, 16, 15, 13, 15, 20,   25,   30] },
    { name: 'Sniper Rifle',     dv: [30, 25, 25, 20, 15, 16,   17,   20] },
    { name: 'Bows & Crossbow',  dv: [15, 13, 15, 17, 20, 22, null, null] },
    { name: 'Grenade Launcher', dv: [16, 15, 15, 17, 20, 22,   25, null] },
    { name: 'Rocket Launcher',  dv: [17, 16, 15, 15, 20, 20,   25,   30] },
  ];
</script>

<div class="tab-panel" id="panel-dvtables" class:active>
  <div class="dv-inner">

    <div class="dv-header">
      <h1 class="dv-title">DV Tables</h1>
      <p class="dv-sub">Difficulty values for ranged attacks by weapon type and range band</p>
    </div>

    <div class="dv-section-label">Ranged Weapons</div>

    <div class="dv-table-wrap">
      <table class="dv-table">
        <thead>
          <tr>
            <th>Weapon Type</th>
            {#each RANGES as r}
              <th>
                {r.label}
                <span class="dv-range-unit">{r.unit}</span>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each RANGED_WEAPONS as weapon}
            <tr>
              <td class="dv-weapon-cell">{weapon.name}</td>
              {#each weapon.dv as val}
                <td class="dv-cell" class:dv-na={val === null}>
                  {val !== null ? val : 'N/A'}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <p class="dv-footnote">DV = Difficulty Value · Roll REF + Skill + 1d10 vs. DV to hit</p>

  </div>
</div>
