<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { PCCard } from '@/types/index';

  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  // ─── Type helpers ────────────────────────────────────────────
  type SaveKey     = keyof PCCard['saves'];
  type PassiveKey  = keyof PCCard['passives'];
  type CurrencyKey = keyof PCCard['currency'];

  const SAVE_KEYS: SaveKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  const PASSIVE_ROWS: [string, PassiveKey][] = [
    ['Perception',    'perception'],
    ['Insight',       'insight'],
    ['Investigation', 'investigation'],
  ];

  const CURRENCY_ROWS: [string, CurrencyKey][] = [
    ['Platinum', 'platinum'],
    ['Gold',     'gold'],
  ];

  // ─── Helpers ─────────────────────────────────────────────────
  function genId(): string {
    return `pc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function defaultPC(name: string): PCCard {
    return {
      id: genId(), name, ac: '',
      saves: { str: '', dex: '', con: '', int: '', wis: '', cha: '' },
      passives: { perception: '', insight: '', investigation: '' },
      currency: { platinum: 0, gold: 0 },
      custom: [],
    };
  }

  // ─── Reactive data ───────────────────────────────────────────
  const pcs     = $derived(store.activeCampaignId ? store.getParty(store.activeCampaignId).pcs : []);
  const totalPP = $derived(pcs.reduce((s, p) => s + (p.currency.platinum || 0), 0));
  const totalGP = $derived(pcs.reduce((s, p) => s + (p.currency.gold || 0), 0));

  // ─── Add PC modal ─────────────────────────────────────────────
  let showAddModal  = $state(false);
  let newPCName     = $state('');
  let nameInputEl   = $state<HTMLInputElement | null>(null);

  function openAdd(): void {
    newPCName = '';
    showAddModal = true;
    setTimeout(() => nameInputEl?.focus(), 50);
  }

  function confirmAdd(): void {
    const name = newPCName.trim();
    if (!name) { showToast('Name required'); return; }
    const cid = store.activeCampaignId;
    if (!cid) { showToast('Select a campaign first'); return; }
    store.addPC(cid, defaultPC(name));
    showAddModal = false;
    showToast(`${name} added`);
  }

  // ─── Delete PC modal ──────────────────────────────────────────
  let deletePending = $state<PCCard | null>(null);

  function promptDeletePC(pc: PCCard): void {
    deletePending = pc;
  }

  function confirmDeletePC(removeFavor: boolean): void {
    const cid = store.activeCampaignId;
    if (!cid || !deletePending) return;
    if (removeFavor) store.removeFavorPlayer(cid, deletePending.id);
    store.deletePC(cid, deletePending.id);
    showToast(`${deletePending.name} removed`);
    deletePending = null;
  }

  // ─── Card collapse state ──────────────────────────────────────
  let collapsedCards = $state(new Set<string>());

  function toggleCollapse(id: string): void {
    const next = new Set(collapsedCards);
    if (next.has(id)) next.delete(id); else next.add(id);
    collapsedCards = next;
  }

  function collapseAll(): void { collapsedCards = new Set(pcs.map(p => p.id)); }
  function expandAll(): void   { collapsedCards = new Set(); }
  // ─── Delete toggle ───────────────────────────────────────────────────────
  let deleteEnabled = $state(false);</script>

<div class="tab-panel" id="panel-party" class:active>
  <div class="party-inner">

    <!-- Wealth tally -->
    <div class="party-tally">
      <span class="party-tally-label">Party Wealth</span>
      <div class="party-tally-item">
        <span class="tally-icon">◆</span>
        <span class="tally-value">{totalPP.toLocaleString()}</span>
        <span class="tally-unit">pp</span>
        <div class="tally-tooltip">
          {#each pcs as pc}
            <div class="tally-tooltip-row">
              <span class="tally-tooltip-name">{pc.name}</span>
              <span class="tally-tooltip-val">{(pc.currency.platinum || 0).toLocaleString()} pp</span>
            </div>
          {/each}
        </div>
      </div>
      <div class="party-tally-item">
        <span class="tally-icon">◈</span>
        <span class="tally-value">{totalGP.toLocaleString()}</span>
        <span class="tally-unit">gp</span>
        <div class="tally-tooltip">
          {#each pcs as pc}
            <div class="tally-tooltip-row">
              <span class="tally-tooltip-name">{pc.name}</span>
              <span class="tally-tooltip-val">{(pc.currency.gold || 0).toLocaleString()} gp</span>
            </div>
          {/each}
        </div>
      </div>
      <span class="party-tally-members">{pcs.length} member{pcs.length !== 1 ? 's' : ''}</span>
    </div>

    <!-- Header -->
    <div class="party-header">
      <div style='font-family:"Cinzel",serif;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold-dim)'>
        Party Members
      </div>
      <div class="party-header-actions">
        <button class="btn btn-sm" onclick={collapseAll}>Collapse All</button>
        <button class="btn btn-sm" onclick={expandAll}>Expand All</button>
        <button class="btn btn-sm btn-danger" class:active={deleteEnabled}
          onclick={() => deleteEnabled = !deleteEnabled}>
          {deleteEnabled ? 'Disable Deletion' : 'Enable Deletion'}
        </button>
        <button class="btn btn-gold btn-sm" onclick={openAdd}>+ Add PC</button>
      </div>
    </div>

    <!-- Card grid -->
    <div class="party-grid">
      {#if !store.activeCampaignId}
        <div class="empty-state" style="grid-column:1/-1">Select or create a campaign to begin.</div>
      {:else if !pcs.length}
        <div class="empty-state" style="grid-column:1/-1">No party members yet — add a PC above.</div>
      {:else}
        {#each pcs as pc (pc.id)}
          <div class="pc-card">

            <!-- Card header: name + delete -->
            <div class="pc-card-head">
              <div class="pc-name-wrap">
                <input
                  type="text"
                  class="pc-field-value pc-name"
                  value={pc.name}
                  placeholder="Character name"
                  style='font-family:"Cinzel",serif;font-size:14px;font-weight:600;color:var(--gold-pale);letter-spacing:0.04em;text-align:left;'
                  onchange={(e) => {
                    const newName = (e.target as HTMLInputElement).value.trim() || 'Unnamed';
                    pc.name = newName;
                    // Sync display name into favor tracker (key/GUID unchanged)
                    const cid = store.activeCampaignId;
                    if (cid) {
                      const pd = store.getCampaignData(cid).players[pc.id];
                      if (pd) pd.player = newName;
                    }
                    store.save();
                  }}
                />
              </div>
              <div class="pc-card-head-actions">
                <button class="btn-icon pc-collapse-btn" title={collapsedCards.has(pc.id) ? 'Expand card' : 'Collapse card'}
                  onclick={() => toggleCollapse(pc.id)}
                  class:collapsed={collapsedCards.has(pc.id)}>
                  ▾
                </button>
                <button class="btn-icon danger" title="Remove PC" onclick={() => promptDeletePC(pc)}
                  style="display: {deleteEnabled ? 'flex' : 'none'}">✕</button>
              </div>
            </div>

            <!-- Card body -->
            <div class="pc-card-body">

              <!-- Combat -->
              <div class="pc-section-label">Combat</div>
              <div class="pc-field-row">
                <div class="pc-field-label">AC</div>
                <input type="text" class="pc-field-value" value={pc.ac} placeholder="—"
                  onchange={(e) => { pc.ac = (e.target as HTMLInputElement).value.trim(); store.save(); }} />
              </div>

              <!-- Saving Throws -->
              <div class="pc-section-label">Saving Throws</div>
              <div class="pc-saves-grid">
                {#each SAVE_KEYS as key}
                  <div class="pc-save-cell">
                    <div class="pc-save-abbr">{key.toUpperCase()}</div>
                    <input type="text" class="pc-save-val" value={pc.saves[key]} placeholder="—"
                      onchange={(e) => { pc.saves[key] = (e.target as HTMLInputElement).value.trim(); store.save(); }} />
                  </div>
                {/each}
              </div>

              <!-- Collapsible lower sections -->
              <div class="pc-card-extra" class:collapsed={collapsedCards.has(pc.id)}>

              <!-- Passives -->
              <div class="pc-section-label">Passives</div>
              {#each PASSIVE_ROWS as [label, key]}
                <div class="pc-field-row">
                  <div class="pc-field-label">{label}</div>
                  <input type="text" class="pc-field-value" value={pc.passives[key]} placeholder="—"
                    onchange={(e) => { pc.passives[key] = (e.target as HTMLInputElement).value.trim(); store.save(); }} />
                </div>
              {/each}

              <!-- Currency -->
              <div class="pc-section-label">Currency</div>
              {#each CURRENCY_ROWS as [label, key]}
                <div class="pc-field-row">
                  <div class="pc-field-label">{label}</div>
                  <input type="number" class="pc-field-value currency" value={pc.currency[key]} min="0" placeholder="0"
                    onchange={(e) => {
                      const n = parseInt((e.target as HTMLInputElement).value);
                      pc.currency[key] = isNaN(n) || n < 0 ? 0 : n;
                      store.save();
                    }} />
                </div>
              {/each}

              <!-- Custom fields -->
              <div class="pc-section-label">Custom</div>
              <div class="pc-custom-list">
                {#each pc.custom as field, fi (field.id)}
                  <div class="pc-custom-row">
                    <input type="text" class="pc-custom-name" value={field.name} placeholder="Field name"
                      onchange={(e) => { field.name = (e.target as HTMLInputElement).value.trim() || 'Field'; store.save(); }} />
                    <input type="text" class="pc-custom-value" value={field.value} placeholder="—"
                      onchange={(e) => { field.value = (e.target as HTMLInputElement).value; store.save(); }} />
                    <button class="pc-custom-del" title="Remove field"
                      onclick={() => { pc.custom.splice(fi, 1); store.save(); }}>✕</button>
                  </div>
                {/each}
              </div>
              <button class="pc-add-field"
                onclick={() => { pc.custom.push({ id: genId(), name: 'Field', value: '' }); store.save(); }}>
                + Add Field
              </button>

              </div><!-- /pc-card-extra -->

            </div><!-- /pc-card-body -->
          </div><!-- /pc-card -->
        {/each}
      {/if}
    </div><!-- /party-grid -->

  </div><!-- /party-inner -->
</div><!-- /tab-panel -->

<!-- Delete PC modal -->
{#if deletePending}
<div class="modal-overlay open">
  <div class="modal">
    <h3>Remove {deletePending.name}?</h3>
    <p style="color: var(--text-dim); font-size: 13px; margin: 8px 0 16px">
      What should happen to their favor tracker history?
    </p>
    <div class="modal-foot" style="gap: 8px; flex-wrap: wrap">
      <button class="btn" onclick={() => (deletePending = null)}>Cancel</button>
      <button class="btn" onclick={() => confirmDeletePC(false)}>Keep Favor Data</button>
      <button class="btn btn-danger" onclick={() => confirmDeletePC(true)}>Delete Favor Data Too</button>
    </div>
  </div>
</div>
{/if}

<!-- Add PC modal -->
<div class="modal-overlay" class:open={showAddModal}>
  <div class="modal modal-party">
    <h3>Add Party Member</h3>
    <div class="field-group">
      <label class="field-label" for="new-pc-name-svelte">Character name</label>
      <input
        type="text"
        id="new-pc-name-svelte"
        bind:this={nameInputEl}
        bind:value={newPCName}
        placeholder="e.g. Reginald Thelonious"
        onkeydown={(e) => { if (e.key === 'Enter') confirmAdd(); }}
      />
    </div>
    <div class="modal-foot">
      <button class="btn" onclick={() => (showAddModal = false)}>Cancel</button>
      <button class="btn btn-gold" onclick={confirmAdd}>Add</button>
    </div>
  </div>
</div>
