<script lang="ts">
  import { store } from '@/state/store.svelte';
  import type { TabId } from '@/types/index';

  interface Props {
    show: boolean;
    tabMeta: Record<TabId, { label: string; icon: string }>;
    onclose: () => void;
    onsave: (name: string, tabs: TabId[]) => void;
  }

  let { show, tabMeta, onclose, onsave }: Props = $props();

  // All available tab IDs in a stable display order
  const ALL_TABS: TabId[] = [
    'initiative', 'dice', 'convo', 'party',
    'favor', 'npcs', 'factions', 'chronicle', 'tree',
    'enemies', 'tracker',
  ];

  // Local editable copies — reset each time the modal opens
  let localName = $state('');
  let localSelected = $state<Set<TabId>>(new Set());

  $effect(() => {
    if (show) {
      localName = store.customGroupName;
      localSelected = new Set(store.customGroupTabs);
    }
  });

  function toggleTab(tid: TabId): void {
    const next = new Set(localSelected);
    if (next.has(tid)) next.delete(tid); else next.add(tid);
    localSelected = next;
  }

  function handleSave(): void {
    const name = localName.trim() || 'My View';
    // Preserve insertion order from ALL_TABS
    const tabs = ALL_TABS.filter((t) => localSelected.has(t));
    onsave(name, tabs);
    onclose();
  }
</script>

<div class="modal-overlay" class:open={show} role="presentation" onclick={onclose}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal custom-group-modal" role="dialog" aria-modal="true" tabindex="-1"
    onclick={(e) => e.stopPropagation()}>

    <h3>Configure Custom Group</h3>

    <div class="field-group">
      <label class="field-label" for="custom-group-name">Group Name</label>
      <input id="custom-group-name" type="text" placeholder="My View"
        bind:value={localName} />
    </div>

    <div class="field-label" style="margin-bottom: 6px;">Tabs to include</div>
    <div class="custom-group-checklist">
      {#each ALL_TABS as tid (tid)}
        {@const meta = tabMeta[tid]}
        {@const checked = localSelected.has(tid)}
        <label class="custom-group-item" class:checked>
          <input type="checkbox" {checked}
            onchange={() => toggleTab(tid)} />
          <span class="custom-group-icon">{meta.icon}</span>
          <span class="custom-group-label">{meta.label}</span>
        </label>
      {/each}
    </div>

    {#if localSelected.size === 0}
      <p class="custom-group-hint">Select at least one tab to show in your custom group.</p>
    {/if}

    <div class="modal-foot">
      <button class="btn" onclick={onclose}>Cancel</button>
      <button class="btn btn-gold" onclick={handleSave}>Save</button>
    </div>
  </div>
</div>
