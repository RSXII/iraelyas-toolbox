<script lang="ts">
  import { store } from '@/state/store.svelte';
  import type { MonsterStatBlock, MonsterType } from '@/types/index';
  import EnemyCard from '@/components/ui/EnemyCard.svelte';
  import EnemyFormModal from '@/components/ui/EnemyFormModal.svelte';
  import EnemyGenerateModal from '@/components/ui/EnemyGenerateModal.svelte';
  import ApiKeyModal from '@/components/ui/ApiKeyModal.svelte';

  interface Props { active?: boolean; }
  let { active = false }: Props = $props();

  const TYPES: MonsterType[] = [
    'Aberration','Beast','Celestial','Construct','Dragon','Elemental',
    'Fey','Fiend','Giant','Humanoid','Monstrosity','Ooze','Plant','Undead',
  ];

  let enemies       = $state<MonsterStatBlock[]>([]);
  let searchQuery   = $state('');
  let filterType    = $state<string>('all');
  let showForm      = $state(false);
  let showGenerate  = $state(false);
  let showApiKey    = $state(false);
  let editingEnemy  = $state<MonsterStatBlock | undefined>(undefined);

  $effect(() => {
    if (active) enemies = store.enemies;
  });

  const filtered = $derived(
    enemies.filter((e) => {
      const matchType = filterType === 'all' || e.type === filterType;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q);
      return matchType && matchSearch;
    })
  );

  function openNew(): void {
    editingEnemy = undefined;
    showForm = true;
  }

  function openEdit(enemy: MonsterStatBlock): void {
    editingEnemy = enemy;
    showForm = true;
  }

  function handleSave(enemy: MonsterStatBlock): void {
    if (editingEnemy) {
      store.updateEnemy(enemy);
    } else {
      store.addEnemy(enemy);
    }
    enemies = store.enemies;
    showForm = false;
    editingEnemy = undefined;
  }

  function handleDelete(id: string): void {
    store.deleteEnemy(id);
    enemies = store.enemies;
  }

  function handleGenerateSave(enemy: MonsterStatBlock): void {
    store.addEnemy(enemy);
    enemies = store.enemies;
    showGenerate = false;
  }
</script>

<div class="tab-panel" id="panel-enemies" class:active>
  <div class="enemies-inner">

    <!-- Toolbar -->
    <div class="enemies-toolbar">
      <input
        type="search"
        class="enemies-search"
        placeholder="Search enemies…"
        bind:value={searchQuery}
      />
      <select class="enemies-filter" bind:value={filterType}>
        <option value="all">All Types</option>
        {#each TYPES as t}<option value={t}>{t}</option>{/each}
      </select>
      <div class="enemies-toolbar-spacer"></div>
      <button class="btn" onclick={openNew}>+ New Enemy</button>
      {#if !store.hideAiFeatures}
        <button class="btn btn-gold" onclick={() => { showGenerate = true; }}>✦ Generate with AI</button>
      {/if}
      <button class="btn" title="AI Settings" onclick={() => { showApiKey = true; }}>
        ⚙{#if !store.hideAiFeatures}&nbsp;AI Settings{/if}
      </button>
    </div>

    <!-- Card grid -->
    {#if filtered.length}
      <div class="enemies-grid">
        {#each filtered as enemy (enemy.id)}
          <EnemyCard
            {enemy}
            onedit={() => openEdit(enemy)}
            ondelete={() => handleDelete(enemy.id)}
          />
        {/each}
      </div>
    {:else}
      <div class="enemies-empty">
        <div class="enemies-empty-title">No enemies yet</div>
        {#if searchQuery || filterType !== 'all'}
          No enemies match your current filters.
        {:else}
          Create one manually or generate one with AI.
        {/if}
      </div>
    {/if}

  </div>
</div>

<!-- Modals -->
<EnemyFormModal
  open={showForm}
  enemy={editingEnemy}
  onsave={handleSave}
  onclose={() => { showForm = false; editingEnemy = undefined; }}
/>

<EnemyGenerateModal
  open={showGenerate}
  onsave={handleGenerateSave}
  onclose={() => { showGenerate = false; }}
  onopenaisettings={() => { showGenerate = false; showApiKey = true; }}
/>

<ApiKeyModal
  open={showApiKey}
  onclose={() => { showApiKey = false; }}
/>

<style>
  @import '../../css/enemies.css';
</style>
