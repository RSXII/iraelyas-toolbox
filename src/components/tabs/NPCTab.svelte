<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { NPC, NPCType } from '@/types/index';

  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  // ─── Helpers ─────────────────────────────────────────────────
  function initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  }

  function npcTypeLabel(t: NPCType | undefined): string {
    if (t === 'recurring') return 'Recurring';
    if (t === 'major')     return 'Major';
    return 'Scene';
  }

  function resolvedType(npc: NPC): NPCType {
    return npc.npcType ?? 'scene';
  }

  function slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  // ─── Reactive data ────────────────────────────────────────────
  const cid          = $derived(store.activeCampaignId);
  const npcs         = $derived(cid ? store.getSchema(cid).npcs : []);
  const factionConfigs = $derived(cid ? store.getFactions(cid).factions : []);

  // Filter-chip faction list from FactionConfigs
  const factionFilterList = $derived(factionConfigs.map((fc) => ({ id: fc.id, name: fc.name })));

  // ─── Filters ──────────────────────────────────────────────────
  // factionFilter: 'all' | FactionConfig.id | '__unaffiliated__'
  let factionFilter = $state('all');
  let typeFilter    = $state<NPCType | 'all'>('all');

  const displayNpcs = $derived.by(() => {
    const factionIdSet = new Set(factionConfigs.map((f) => f.id));
    let list = npcs.filter((n) => !n.isFactionHeader); // exclude legacy header NPCs
    if (factionFilter === '__unaffiliated__') {
      list = list.filter((n) => !n.factionId || !factionIdSet.has(n.factionId));
    } else if (factionFilter !== 'all') {
      list = list.filter((n) => n.factionId === factionFilter);
    }
    if (typeFilter !== 'all') {
      list = list.filter((n) => resolvedType(n) === typeFilter);
    }
    return list;
  });

  // ─── Collapse state ───────────────────────────────────────────
  let collapsedCards = $state(new Set<string>());

  function toggleCollapse(id: string): void {
    const next = new Set(collapsedCards);
    if (next.has(id)) next.delete(id); else next.add(id);
    collapsedCards = next;
  }

  // ─── Edit / delete mode ───────────────────────────────────────
  let editEnabled = $state(false);

  // ─── Delete ───────────────────────────────────────────────────
  function deleteNPC(npc: NPC): void {
    if (!cid) return;
    if (!confirm(`Remove ${npc.name}? This will delete their scores for all players.`)) return;
    store.deleteNPC(cid, npc.id);
    showToast(`${npc.name} removed`);
  }

  // ─── Field update helpers ─────────────────────────────────────
  function patch(npcId: string, update: Partial<Omit<NPC, 'id'>>): void {
    if (!cid) return;
    store.updateNPC(cid, npcId, update);
  }

  function onNameChange(npc: NPC, val: string): void {
    const name = val.trim() || npc.name;
    patch(npc.id, { name });
  }

  function onTypeChange(npc: NPC, t: NPCType): void {
    patch(npc.id, { npcType: t });
  }

  function onFactionChange(npc: NPC, factionId: string): void {
    const fc = factionConfigs.find((f) => f.id === factionId);
    patch(npc.id, { factionId: factionId || undefined, faction: fc?.name ?? 'Unaffiliated' });
  }

  // ─── Add NPC form ─────────────────────────────────────────────
  let showAddForm      = $state(false);
  let addName          = $state('');
  let addRole          = $state('');
  let addFaction       = $state('');
  let addFactionNew    = $state('');
  let addType          = $state<NPCType>('scene');
  let addNameInputEl   = $state<HTMLInputElement | null>(null);

  function openAddForm(): void {
    addName       = '';
    addRole       = '';
    addFaction    = factionConfigs[0]?.id ?? '';
    addFactionNew = '';
    addType       = 'scene';
    showAddForm   = true;
    setTimeout(() => addNameInputEl?.focus(), 50);
  }

  function cancelAdd(): void {
    showAddForm = false;
  }

  function confirmAdd(): void {
    const name = addName.trim();
    if (!name) { showToast('Name required'); return; }
    if (!cid)  { showToast('Select a campaign first'); return; }

    const selectedFc = factionConfigs.find((fc) => fc.id === addFaction);
    const faction    = selectedFc ? selectedFc.name : 'Unaffiliated';
    const factionId  = selectedFc ? selectedFc.id   : undefined;

    let id = slugify(name);
    // Disambiguate if id already exists
    const existing = store.getSchema(cid).npcs;
    if (existing.find((n) => n.id === id)) {
      id = `${id}_${Date.now()}`;
    }

    store.addNPC(cid, {
      id,
      name,
      role: addRole.trim() || '—',
      faction,
      factionId,
      npcType: addType,
    });

    showAddForm = false;
    showToast(`${name} added`);
  }
</script>

<div class="tab-panel" id="panel-npcs" class:active>
  <div class="npc-creator-inner">

    <!-- ── Header ── -->
    <div class="npc-creator-header">
      <span class="npc-creator-title">NPC Creator</span>
      <button class="btn btn-gold btn-sm" onclick={openAddForm}>+ Add NPC</button>
    </div>

    <!-- ── Filters ── -->
    <div class="npc-filter-row">
      <span class="npc-filter-label">Faction</span>
      <div class="npc-filter-group">
        <button class="chip" class:active={factionFilter === 'all'}
          onclick={() => factionFilter = 'all'}>All</button>
        {#each factionFilterList as fc}
          <button class="chip" class:active={factionFilter === fc.id}
            onclick={() => factionFilter = fc.id}>{fc.name}</button>
        {/each}
        {#if npcs.some((n) => !n.factionId || !new Set(factionConfigs.map((f) => f.id)).has(n.factionId))}
          <button class="chip" class:active={factionFilter === '__unaffiliated__'}
            onclick={() => factionFilter = '__unaffiliated__'}>Unaffiliated</button>
        {/if}
      </div>

      <div class="npc-filter-divider"></div>

      <span class="npc-filter-label">Type</span>
      <div class="npc-filter-group">
        <button class="chip" class:active={typeFilter === 'all'}
          onclick={() => typeFilter = 'all'}>All</button>
        <button class="chip" class:active={typeFilter === 'scene'}
          onclick={() => typeFilter = 'scene'}>Scene</button>
        <button class="chip" class:active={typeFilter === 'recurring'}
          onclick={() => typeFilter = 'recurring'}>Recurring</button>
        <button class="chip" class:active={typeFilter === 'major'}
          onclick={() => typeFilter = 'major'}>Major</button>
      </div>
    </div>

    <!-- ── NPC cards ── -->
    {#if !cid}
      <div class="npc-empty">Select or create a campaign to begin.</div>
    {:else if displayNpcs.length === 0}
      <div class="npc-empty">
        No NPCs found.
        <div class="npc-empty-hint">Add your first NPC above, or adjust the filters.</div>
      </div>
    {:else}
      <div class="npc-cards-grid">
        {#each displayNpcs as npc (npc.id)}
          {@const t = resolvedType(npc)}
          {@const collapsed = collapsedCards.has(npc.id)}
          <div class="npc-card">

            <!-- Card header -->
            <div class="npc-card-header" onclick={() => toggleCollapse(npc.id)}
              role="button" tabindex="0"
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCollapse(npc.id); } }}>
              <div class="npc-card-initials">{initials(npc.name)}</div>
              <div class="npc-card-identity">
                <div class="npc-card-name">{npc.name}</div>
                <div class="npc-card-role">{npc.role}</div>
              </div>
              <div class="npc-card-badges">
                {#if npc.faction && npc.faction !== 'Unaffiliated'}
                  <span class="npc-faction-badge">{npc.faction}</span>
                {/if}
                <span class="npc-type-badge {t}">{npcTypeLabel(npc.npcType)}</span>
              </div>
              <button class="npc-card-collapse-btn" class:open={!collapsed}
                aria-label={collapsed ? 'Expand' : 'Collapse'}
                onclick={(e) => { e.stopPropagation(); toggleCollapse(npc.id); }}>▾</button>
              {#if editEnabled}
                <button class="npc-card-delete-btn" aria-label="Delete NPC"
                  onclick={(e) => { e.stopPropagation(); deleteNPC(npc); }}>✕</button>
              {/if}
            </div>

            <!-- Card body -->
            {#if !collapsed}
              <div class="npc-card-body">

                <!-- Name / Role / Faction row -->
                <div class="npc-card-body-top">
                  <div class="npc-field-group">
                    <label class="npc-field-label" for="npc-name-{npc.id}">Name</label>
                    <input id="npc-name-{npc.id}" type="text" class="npc-field-input"
                      value={npc.name}
                      onchange={(e) => onNameChange(npc, (e.target as HTMLInputElement).value)} />
                  </div>
                  <div class="npc-field-group">
                    <label class="npc-field-label" for="npc-role-{npc.id}">Role / Title</label>
                    <input id="npc-role-{npc.id}" type="text" class="npc-field-input"
                      value={npc.role}
                      onchange={(e) => patch(npc.id, { role: (e.target as HTMLInputElement).value.trim() || '—' })} />
                  </div>
                  <div class="npc-field-group">
                    <label class="npc-field-label" for="npc-faction-{npc.id}">Faction</label>
                    <select id="npc-faction-{npc.id}" class="npc-field-input"
                      value={npc.factionId ?? ''}
                      onchange={(e) => onFactionChange(npc, (e.target as HTMLSelectElement).value)}>
                      <option value="">Unaffiliated</option>
                      {#each factionConfigs as fc (fc.id)}
                        <option value={fc.id}>{fc.name}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="npc-field-group" style="grid-column: span 2;">
                    <div class="npc-field-label">NPC Type</div>
                    <div class="npc-type-selector">
                      <button class="npc-type-btn" class:active-scene={t === 'scene'}
                        onclick={() => onTypeChange(npc, 'scene')}>Scene</button>
                      <button class="npc-type-btn" class:active-recurring={t === 'recurring'}
                        onclick={() => onTypeChange(npc, 'recurring')}>Recurring</button>
                      <button class="npc-type-btn" class:active-major={t === 'major'}
                        onclick={() => onTypeChange(npc, 'major')}>Major</button>
                    </div>
                  </div>
                </div>

                <!-- Scene NPC fields (always shown) -->
                <div class="npc-fields-section">
                  <div class="npc-fields-section-title">Scene NPC</div>
                  <div class="npc-field-group">
                    <label class="npc-field-label" for="npc-fn-{npc.id}">Function</label>
                    <textarea id="npc-fn-{npc.id}" class="npc-field-input"
                      value={npc.npcFunction ?? ''}
                      onchange={(e) => patch(npc.id, { npcFunction: (e.target as HTMLTextAreaElement).value })}
                    ></textarea>
                  </div>
                  <div class="npc-field-group">
                    <label class="npc-field-label" for="npc-dd-{npc.id}">Distinct Detail</label>
                    <textarea id="npc-dd-{npc.id}" class="npc-field-input"
                      value={npc.distinctDetail ?? ''}
                      onchange={(e) => patch(npc.id, { distinctDetail: (e.target as HTMLTextAreaElement).value })}
                    ></textarea>
                  </div>
                  <div class="npc-field-group">
                    <label class="npc-field-label" for="npc-need-{npc.id}">Need</label>
                    <textarea id="npc-need-{npc.id}" class="npc-field-input"
                      value={npc.npcNeed ?? ''}
                      onchange={(e) => patch(npc.id, { npcNeed: (e.target as HTMLTextAreaElement).value })}
                    ></textarea>
                  </div>
                </div>

                <!-- Recurring NPC fields -->
                {#if t === 'recurring' || t === 'major'}
                  <div class="npc-fields-section">
                    <div class="npc-fields-section-title">Recurring NPC</div>
                    <div class="npc-field-group">
                      <label class="npc-field-label" for="npc-wound-{npc.id}">Wound</label>
                      <textarea id="npc-wound-{npc.id}" class="npc-field-input"
                        value={npc.wound ?? ''}
                        onchange={(e) => patch(npc.id, { wound: (e.target as HTMLTextAreaElement).value })}
                      ></textarea>
                    </div>
                    <div class="npc-field-group">
                      <label class="npc-field-label" for="npc-gap-{npc.id}">Gap</label>
                      <textarea id="npc-gap-{npc.id}" class="npc-field-input"
                        value={npc.gap ?? ''}
                        onchange={(e) => patch(npc.id, { gap: (e.target as HTMLTextAreaElement).value })}
                      ></textarea>
                    </div>
                    <div class="npc-field-group">
                      <label class="npc-field-label" for="npc-prot-{npc.id}">Protecting</label>
                      <textarea id="npc-prot-{npc.id}" class="npc-field-input"
                        value={npc.protecting ?? ''}
                        onchange={(e) => patch(npc.id, { protecting: (e.target as HTMLTextAreaElement).value })}
                      ></textarea>
                    </div>
                    <div class="npc-field-group">
                      <label class="npc-field-label" for="npc-break-{npc.id}">What Would Break Them</label>
                      <textarea id="npc-break-{npc.id}" class="npc-field-input"
                        value={npc.whatWouldBreakThem ?? ''}
                        onchange={(e) => patch(npc.id, { whatWouldBreakThem: (e.target as HTMLTextAreaElement).value })}
                      ></textarea>
                    </div>
                  </div>
                {/if}

                <!-- Major NPC fields -->
                {#if t === 'major'}
                  <div class="npc-fields-section">
                    <div class="npc-fields-section-title">Major NPC</div>
                    <div class="npc-field-group">
                      <label class="npc-field-label" for="npc-sb-{npc.id}">What They Believe About Themselves That Isn't True</label>
                      <textarea id="npc-sb-{npc.id}" class="npc-field-input"
                        value={npc.selfBelief ?? ''}
                        onchange={(e) => patch(npc.id, { selfBelief: (e.target as HTMLTextAreaElement).value })}
                      ></textarea>
                    </div>
                    <div class="npc-field-group">
                      <label class="npc-field-label" for="npc-rc-{npc.id}">Relationship Contradictions</label>
                      <textarea id="npc-rc-{npc.id}" class="npc-field-input"
                        value={npc.relationshipContradictions ?? ''}
                        onchange={(e) => patch(npc.id, { relationshipContradictions: (e.target as HTMLTextAreaElement).value })}
                      ></textarea>
                    </div>
                  </div>
                {/if}

              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- ── Add NPC form ── -->
    {#if showAddForm}
      <div class="npc-add-form">
        <div class="npc-add-form-title">New NPC</div>
        <div class="npc-add-form-grid">
          <div class="npc-field-group">
            <label class="npc-field-label" for="add-npc-name">Name</label>
            <input id="add-npc-name" type="text" class="npc-field-input"
              bind:value={addName}
              bind:this={addNameInputEl}
              onkeydown={(e) => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') cancelAdd(); }}
              placeholder="NPC name" />
          </div>
          <div class="npc-field-group">
            <label class="npc-field-label" for="add-npc-role">Role / Title</label>
            <input id="add-npc-role" type="text" class="npc-field-input"
              bind:value={addRole}
              placeholder="e.g. Guard Captain" />
          </div>
          <div class="npc-field-group">
            <label class="npc-field-label" for="add-npc-faction">Faction</label>
            <select id="add-npc-faction" class="npc-field-input" bind:value={addFaction}>
              <option value="">Unaffiliated</option>
              {#each factionConfigs as fc (fc.id)}
                <option value={fc.id}>{fc.name}</option>
              {/each}
            </select>
          </div>
        </div>
        <div class="npc-add-form-type-row">
          <span class="npc-add-form-type-label">Type:</span>
          <div class="npc-type-selector" style="flex:1;">
            <button class="npc-type-btn" class:active-scene={addType === 'scene'}
              onclick={() => addType = 'scene'}>Scene</button>
            <button class="npc-type-btn" class:active-recurring={addType === 'recurring'}
              onclick={() => addType = 'recurring'}>Recurring</button>
            <button class="npc-type-btn" class:active-major={addType === 'major'}
              onclick={() => addType = 'major'}>Major</button>
          </div>
        </div>
        <div class="npc-add-form-actions">
          <button class="btn btn-sm" onclick={cancelAdd}>Cancel</button>
          <button class="btn btn-gold btn-sm" onclick={confirmAdd}>Add NPC</button>
        </div>
      </div>
    {/if}

    <!-- ── Edit mode bar ── -->
    <div class="npc-edit-bar">
      <input type="checkbox" id="npc-edit-mode" bind:checked={editEnabled} />
      <label for="npc-edit-mode">Enable deletion</label>
    </div>

  </div>
</div>

