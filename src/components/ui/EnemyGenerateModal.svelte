<script lang="ts">
  import { untrack } from 'svelte';
  import { store } from '@/state/store.svelte';
  import type { MonsterStatBlock, MonsterType, EnemyFocus, GenerateEnemyParams } from '@/types/index';
  import EnemyCard from './EnemyCard.svelte';

  interface Props {
    open: boolean;
    onsave: (e: MonsterStatBlock) => void;
    onclose: () => void;
    onopenaisettings: () => void;
  }

  let { open, onsave, onclose, onopenaisettings }: Props = $props();

  const TYPES: MonsterType[] = [
    'Aberration','Beast','Celestial','Construct','Dragon','Elemental',
    'Fey','Fiend','Giant','Humanoid','Monstrosity','Ooze','Plant','Undead',
  ];

  const CR_VALUES = [0, 0.125, 0.25, 0.5, ...Array.from({length:30}, (_,i) => i+1)];

  function crLabel(cr: number): string {
    if (cr === 0.125) return '1/8';
    if (cr === 0.25)  return '1/4';
    if (cr === 0.5)   return '1/2';
    return String(cr);
  }

  // ── Form state ──────────────────────────────────────────────────
  let cr       = $state(5);
  let focus    = $state<EnemyFocus>('physical');
  let type     = $state<MonsterType>('Humanoid');
  let hints    = $state('');

  // ── Generation state ────────────────────────────────────────────
  type Phase = 'form' | 'loading' | 'preview' | 'error';
  let phase    = $state<Phase>('form');
  let errorMsg = $state('');
  let preview  = $state<MonsterStatBlock | null>(null);
  let lastParams = $state<GenerateEnemyParams | null>(null);

  $effect(() => {
    if (open) {
      // Only reset if we're returning from a completed/errored state.
      // untrack prevents phase from becoming a dependency of this effect,
      // which would cause it to re-run and reset phase = 'form' every time
      // generate() advances phase to 'preview' or 'error'.
      untrack(() => {
        if (phase === 'preview' || phase === 'error') phase = 'form';
      });
    }
  });

  async function generate(): Promise<void> {
    const params: GenerateEnemyParams = { cr, focus, type, hints: hints.trim() || undefined };
    lastParams = params;
    phase = 'loading';
    errorMsg = '';

    console.log('[EnemyGenerateModal] calling generateEnemy', params, store.aiModel);
    const result = await window.toolbox.generateEnemy(params, store.aiModel);
    console.log('[EnemyGenerateModal] result:', JSON.stringify(result));
    if (result.ok && result.enemy) {
      preview = result.enemy;
      phase = 'preview';
      if (result.usage) {
        store.addTokenUsage(result.usage.input_tokens, result.usage.output_tokens);
      }
    } else {
      errorMsg = result.error ?? 'Generation failed. Please try again.';
      phase = 'error';
    }
  }

  function regenerate(): void {
    phase = 'form';
  }

  function save(): void {
    if (preview) {
      onsave(preview);
      preview = null;
      phase = 'form';
    }
  }
</script>

<div class="modal-overlay" class:open>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop-hit" onclick={onclose}></div>
  <div class="modal" style="max-width:560px">
    <h3>Generate Enemy with AI</h3>
    {#if phase === 'form' || phase === 'error'}
      <div class="generate-form">

        <!-- CR -->
        <div class="form-group">
          <label class="form-label" for="gen-cr">Challenge Rating</label>
          <select id="gen-cr" class="form-select" bind:value={cr}>
            {#each CR_VALUES as v}<option value={v}>{crLabel(v)}</option>{/each}
          </select>
        </div>

        <!-- Focus -->
        <div class="form-group">
          <span class="form-label">Combat Focus</span>
          <div class="generate-focus-group">
            <button class="generate-focus-btn" class:active={focus === 'physical'} onclick={() => { focus = 'physical'; }}>Physical</button>
            <button class="generate-focus-btn" class:active={focus === 'hybrid'}   onclick={() => { focus = 'hybrid'; }}>Hybrid</button>
            <button class="generate-focus-btn" class:active={focus === 'spellcaster'} onclick={() => { focus = 'spellcaster'; }}>Spellcaster</button>
          </div>
        </div>

        <!-- Type -->
        <div class="form-group">
          <label class="form-label" for="gen-type">Creature Type</label>
          <select id="gen-type" class="form-select" bind:value={type}>
            {#each TYPES as t}<option value={t}>{t}</option>{/each}
          </select>
        </div>

        <!-- Hints -->
        <div class="form-group">
          <label class="form-label" for="gen-hints">Optional Hints</label>
          <input id="gen-hints" class="form-input" placeholder="e.g. desert assassin, uses poison, spider motif" bind:value={hints} />
        </div>

        <!-- Model indicator -->
        <div class="generate-model-row">
          <span>Model: <strong>{store.aiModel}</strong></span>
          <button class="generate-model-link" onclick={onopenaisettings}>change</button>
          
        </div>

        {#if phase === 'error'}
          <div class="generate-error">{errorMsg}</div>
        {/if}

        <div class="modal-footer">
          <button class="btn btn-gold" onclick={generate}>Generate</button>
          <button class="btn" onclick={onclose}>Cancel</button>
        </div>
      </div>

    {:else if phase === 'loading'}
      <div class="generate-loading">
        <div class="generate-spinner"></div>
        Generating with {store.aiModel}…
      </div>

    {:else if phase === 'preview' && preview}
      <div class="generate-preview">
        <div class="generate-preview-scroll">
          <EnemyCard enemy={preview} readonly={true} />
        </div>
        <div class="generate-preview-actions">
          <button class="btn" onclick={regenerate}>Regenerate</button>
          <button class="btn" onclick={onclose}>Discard</button>
          <button class="btn btn-gold" onclick={save}>Save to Library</button>
        </div>
      </div>
    {/if}

  </div>
</div>

<style>
  @import '../../css/enemies.css';
</style>
