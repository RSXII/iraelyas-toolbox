<script lang="ts">
  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  type TTView = 'wound' | 'body' | 'head';
  let view = $state<TTView>('wound');

  const WOUND_STATES = [
    {
      state: 'Lightly Wounded',
      threshold: 'Less than Full HP',
      effect: 'None',
      effectBold: false,
      stabilizationDV: 'DV10',
    },
    {
      state: 'Seriously Wounded',
      threshold: 'Less than ½ HP (round up)',
      effect: '-2 to all Actions',
      effectBold: false,
      stabilizationDV: 'DV13',
    },
    {
      state: 'Mortally Wounded',
      threshold: 'Less than 1 HP',
      effect: null,
      effectLines: [
        { text: '-4 to all Actions', bold: false },
        { text: '-6 to MOVE (Minimum 1)', bold: false },
        { text: 'Must make a ', bold: false, inline: [{ text: 'Death Save', bold: true }, { text: ' at start of each one of their Turns.', bold: false }] },
        { text: 'Mortally Wounded Characters suffer a ', bold: false, inline: [{ text: 'Critical Injury', bold: true }, { text: ' whenever they are damaged by a Melee or Ranged Attack. In addition their ', bold: false }, { text: 'Death Save Penalty', bold: true }, { text: ' increases by 1.', bold: false }] },
      ],
      effectBold: false,
      stabilizationDV: 'DV15 to heal back to 1 HP, and Unconscious (Gone from the world for 1 minute)',
    },
    {
      state: 'Dead',
      threshold: 'One failed Death Save',
      effect: 'Death',
      effectBold: false,
      stabilizationDV: 'Never coming back',
    },
  ] as const;

  const BODY_CRITS: { roll: string; injury: string; effect: string; boldParts?: string[]; quickFix: string; treatment: string }[] = [
    {
      roll: '2',
      injury: 'Dismembered Arm',
      effect: 'The Dismembered Arm is gone. You drop any items in that dismembered arm\'s hand immediately. Base Death Save Penalty is increased by 1.',
      boldParts: ['Base Death Save Penalty is increased by 1.'],
      quickFix: 'N/A',
      treatment: 'Surgery DV17',
    },
    {
      roll: '3',
      injury: 'Dismembered Hand',
      effect: 'The Dismembered Hand is gone. You drop any items in the dismembered hand immediately. Base Death Save Penalty is increased by 1.',
      boldParts: ['Base Death Save Penalty is increased by 1.'],
      quickFix: 'N/A',
      treatment: 'Surgery DV17',
    },
    {
      roll: '4',
      injury: 'Collapsed Lung',
      effect: '-2 to MOVE (minimum 1)\nBase Death Save Penalty is increased by 1.',
      boldParts: ['Base Death Save Penalty is increased by 1.'],
      quickFix: 'Paramedic DV15',
      treatment: 'Surgery DV15',
    },
    {
      roll: '5',
      injury: 'Broken Ribs',
      effect: 'At the end of every Turn where you move further than 4m/yds on foot, you re-suffer this Critical Injury\'s Bonus Damage directly to your Hit Points.',
      quickFix: 'Paramedic DV13',
      treatment: 'Paramedic DV15 or Surgery DV13',
    },
    {
      roll: '6',
      injury: 'Broken Arm',
      effect: 'The Broken Arm cannot be used. You drop any items in that arm\'s hand immediately.',
      quickFix: 'Paramedic DV13',
      treatment: 'Paramedic DV15 or Surgery DV13',
    },
    {
      roll: '7',
      injury: 'Foreign Object',
      effect: 'At the end of every Turn where you move further than 4m/yds on foot, you re-suffer this Critical Injury\'s Bonus Damage directly to your Hit Points.',
      quickFix: 'First Aid or Paramedic DV13',
      treatment: 'Quick Fix removes Injury Effect permanently',
    },
    {
      roll: '8',
      injury: 'Broken Leg',
      effect: '-4 to MOVE (minimum 1)',
      quickFix: 'Paramedic DV13',
      treatment: 'Paramedic DV15 or Surgery DV13',
    },
    {
      roll: '9',
      injury: 'Torn Muscle',
      effect: '-2 to Melee Attacks',
      quickFix: 'First Aid or Paramedic DV13',
      treatment: 'Quick Fix removes Injury Effect permanently',
    },
    {
      roll: '10',
      injury: 'Spinal Injury',
      effect: 'Next Turn, you cannot take an Action, but you can still take a Move Action. Base Death Save Penalty is increased by 1.',
      boldParts: ['Base Death Save Penalty is increased by 1.'],
      quickFix: 'Paramedic DV15',
      treatment: 'Surgery DV15',
    },
    {
      roll: '11',
      injury: 'Crushed Fingers',
      effect: '-4 to all Actions involving that hand',
      quickFix: 'Paramedic DV13',
      treatment: 'Surgery DV15',
    },
    {
      roll: '12',
      injury: 'Dismembered Leg',
      effect: 'The Dismembered Leg is gone. -6 to MOVE (minimum 1) You cannot dodge attacks. Base Death Save Penalty is increased by 1.',
      boldParts: ['Base Death Save Penalty is increased by 1.'],
      quickFix: 'N/A',
      treatment: 'Surgery DV17',
    },
  ];

  const HEAD_CRITS: { roll: string; injury: string; effect: string; boldParts?: string[]; quickFix: string; treatment: string }[] = [
    {
      roll: '2',
      injury: 'Lost Eye',
      effect: 'The Lost Eye is gone. -4 to Ranged Attacks & Perception Checks involving vision. Base Death Save Penalty is increased by 1.',
      boldParts: ['Base Death Save Penalty is increased by 1.'],
      quickFix: 'N/A',
      treatment: 'Surgery DV17',
    },
    {
      roll: '3',
      injury: 'Brain Injury',
      effect: '-2 to all Actions. Base Death Save Penalty is increased by 1.',
      boldParts: ['Base Death Save Penalty is increased by 1.'],
      quickFix: 'N/A',
      treatment: 'Surgery DV17',
    },
    {
      roll: '4',
      injury: 'Damaged Eye',
      effect: '-2 to Ranged Attacks & Perception Checks involving vision.',
      quickFix: 'Paramedic DV15',
      treatment: 'Surgery DV13',
    },
    {
      roll: '5',
      injury: 'Concussion',
      effect: '-2 to all Actions',
      quickFix: 'First Aid or Paramedic DV13',
      treatment: 'Quick Fix removes Injury Effect permanently',
    },
    {
      roll: '6',
      injury: 'Broken Jaw',
      effect: '-4 to all Actions involving speech',
      quickFix: 'Paramedic DV13',
      treatment: 'Paramedic or Surgery DV13',
    },
    {
      roll: '7',
      injury: 'Foreign Object',
      effect: 'At the end of every Turn where you move further than 4m/yds on foot, you re-suffer this Critical Injury\'s Bonus Damage directly to your Hit Points.',
      quickFix: 'First Aid or Paramedic DV13',
      treatment: 'Quick Fix removes Injury Effect permanently',
    },
    {
      roll: '8',
      injury: 'Whiplash',
      effect: 'Base Death Save Penalty is increased by 1.',
      boldParts: ['Base Death Save Penalty is increased by 1.'],
      quickFix: 'Paramedic DV13',
      treatment: 'Paramedic or Surgery DV13',
    },
    {
      roll: '9',
      injury: 'Cracked Skull',
      effect: 'Aimed Shots to your head multiply the damage that gets through your SP by 3 instead of 2. Base Death Save Penalty is increased by 1.',
      boldParts: ['Base Death Save Penalty is increased by 1.'],
      quickFix: 'Paramedic DV15',
      treatment: 'Paramedic or Surgery DV15',
    },
    {
      roll: '10',
      injury: 'Damaged Ear',
      effect: 'Whenever you move further than 4m/yds on foot in a Turn, you cannot take a Move Action on your next Turn. Additionally you take a -2 to Perception Checks involving hearing.',
      quickFix: 'Paramedic DV13',
      treatment: 'Surgery DV13',
    },
    {
      roll: '11',
      injury: 'Crushed Windpipe',
      effect: 'You cannot speak. Base Death Save Penalty is increased by 1.',
      boldParts: ['Base Death Save Penalty is increased by 1.'],
      quickFix: 'N/A',
      treatment: 'Surgery DV15',
    },
    {
      roll: '12',
      injury: 'Lost Ear',
      effect: 'The Lost Ear is gone. Whenever you move further than 4m/yds on foot in a Turn, you cannot take a Move Action on your next Turn. Additionally you take a -4 to Perception Checks involving hearing. Base Death Save Penalty is increased by 1.',
      boldParts: ['Base Death Save Penalty is increased by 1.'],
      quickFix: 'N/A',
      treatment: 'Surgery DV17',
    },
  ];

  function renderEffect(text: string, boldParts?: string[]): string {
    if (!boldParts?.length) return text;
    let result = text;
    for (const part of boldParts) {
      result = result.replace(part, `<strong>${part}</strong>`);
    }
    return result;
  }
</script>

<div class="tab-panel" id="panel-traumateam" class:active>
  <div class="tt-inner">

    <div class="tt-header">
      <h1 class="tt-title">Trauma Team</h1>
      <p class="tt-sub">Wound states, stabilization DVs, and critical injury tables</p>
    </div>

    <div class="dv-toggle-row">
      <button
        class="dv-toggle-btn"
        class:dv-toggle-active={view === 'wound'}
        onclick={() => view = 'wound'}
      >Wound State</button>
      <button
        class="dv-toggle-btn"
        class:dv-toggle-active={view === 'body'}
        onclick={() => view = 'body'}
      >Critical Body</button>
      <button
        class="dv-toggle-btn"
        class:dv-toggle-active={view === 'head'}
        onclick={() => view = 'head'}
      >Critical Head</button>
    </div>

    {#if view === 'wound'}

      <div class="tt-section-label">Wound States</div>
      <p class="tt-body">Your Wound State is determined by the amount of Hit Points you have remaining.</p>

      <div class="tt-table-wrap">
        <table class="tt-table">
          <thead>
            <tr>
              <th class="tt-th tt-th-state">Wound State</th>
              <th class="tt-th">Threshold</th>
              <th class="tt-th tt-th-effect">Wound Effect</th>
              <th class="tt-th">Stabilization DV</th>
            </tr>
          </thead>
          <tbody>
            {#each WOUND_STATES as row, i}
              <tr class:tt-row-alt={i % 2 === 1}>
                <td class="tt-td tt-td-state">{row.state}</td>
                <td class="tt-td tt-td-center">{row.threshold}</td>
                <td class="tt-td tt-td-effect">
                  {#if 'effectLines' in row && row.effectLines}
                    <ul class="tt-effect-list">
                      {#each row.effectLines as line}
                        <li>
                          {#if 'inline' in line && line.inline}
                            {#each line.inline as chunk}
                              {#if chunk.bold}<strong>{chunk.text}</strong>{:else}{chunk.text}{/if}
                            {/each}
                          {:else}
                            {line.text}
                          {/if}
                        </li>
                      {/each}
                    </ul>
                  {:else}
                    {row.effect}
                  {/if}
                </td>
                <td class="tt-td tt-td-center tt-td-dv">{row.stabilizationDV}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="tt-section-label" style="margin-top: 2rem;">Critical Injuries</div>

      <div class="tt-callout">
        <p class="tt-callout-main">
          Whenever two or more dice rolled for damage from a Melee or Ranged Attack come up 6, you've inflicted a <strong>Critical Injury!</strong>
        </p>
      </div>

      <p class="tt-body">
        <strong>Roll 2d6 on the appropriate Critical Injury Table until you get a Critical Injury that the target isn't currently suffering.</strong>
        If you weren't using an Aimed Shot to target the head, roll on the Critical Injuries to the Body Table.
      </p>

    {:else if view === 'body'}

      <div class="tt-section-label">Critical Injuries to the Body</div>
      <p class="tt-body">Roll 2d6. If two or more dice come up 6, a Critical Injury is inflicted.</p>

      <div class="tt-table-wrap">
        <table class="tt-table tt-table-crits">
          <thead>
            <tr>
              <th class="tt-th tt-th-roll">Roll<br><span class="tt-th-sub">(2d6)</span></th>
              <th class="tt-th tt-th-injury">Injury</th>
              <th class="tt-th tt-th-effect">Injury Effect</th>
              <th class="tt-th tt-th-fix">Quick Fix</th>
              <th class="tt-th tt-th-treatment">Treatment</th>
            </tr>
          </thead>
          <tbody>
            {#each BODY_CRITS as row, i}
              <tr class:tt-row-alt={i % 2 === 1}>
                <td class="tt-td tt-td-roll">{row.roll}</td>
                <td class="tt-td tt-td-injury">{row.injury}</td>
                <td class="tt-td tt-td-effect">{@html renderEffect(row.effect, row.boldParts)}</td>
                <td class="tt-td tt-td-center">{row.quickFix}</td>
                <td class="tt-td tt-td-center">{row.treatment}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    {:else}

      <div class="tt-section-label">Critical Injuries to the Head</div>
      <p class="tt-body">Roll 2d6. Only applies when using an Aimed Shot targeting the head.</p>

      <div class="tt-table-wrap">
        <table class="tt-table tt-table-crits">
          <thead>
            <tr>
              <th class="tt-th tt-th-roll">Roll<br><span class="tt-th-sub">(2d6)</span></th>
              <th class="tt-th tt-th-injury">Injury</th>
              <th class="tt-th tt-th-effect">Injury Effect</th>
              <th class="tt-th tt-th-fix">Quick Fix</th>
              <th class="tt-th tt-th-treatment">Treatment</th>
            </tr>
          </thead>
          <tbody>
            {#each HEAD_CRITS as row, i}
              <tr class:tt-row-alt={i % 2 === 1}>
                <td class="tt-td tt-td-roll">{row.roll}</td>
                <td class="tt-td tt-td-injury">{row.injury}</td>
                <td class="tt-td tt-td-effect">{@html renderEffect(row.effect, row.boldParts)}</td>
                <td class="tt-td tt-td-center">{row.quickFix}</td>
                <td class="tt-td tt-td-center">{row.treatment}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    {/if}

  </div>
</div>
