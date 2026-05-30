<script lang="ts">
  import { store } from '@/state/store.svelte';
  import type { AiModel } from '@/types/index';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  let keyInput = $state('');
  let hasKey = $state(false);
  let saving = $state(false);
  let error = $state('');

  const MODEL_OPTIONS: { value: AiModel; label: string; desc: string }[] = [
    { value: 'claude-haiku-4-5',  label: 'Haiku 4.5',  desc: 'Fast & economical' },
    { value: 'claude-sonnet-4-5', label: 'Sonnet 4.5', desc: 'Balanced' },
    { value: 'claude-opus-4-5',   label: 'Opus 4.5',   desc: 'Most capable' },
  ];

  $effect(() => {
    if (open) {
      keyInput = '';
      error = '';
      window.toolbox.hasApiKey().then((v) => { hasKey = v; });
    }
  });

  async function saveKey(): Promise<void> {
    const trimmed = keyInput.trim();
    if (!trimmed) { error = 'Key cannot be empty.'; return; }
    saving = true;
    error = '';
    const result = await window.toolbox.setApiKey(trimmed);
    saving = false;
    if (result.ok) {
      keyInput = ''; // clear plaintext from component state immediately
      hasKey = true;
    } else {
      error = result.error ?? 'Failed to save key.';
    }
  }

  async function clearKey(): Promise<void> {
    await window.toolbox.clearApiKey();
    hasKey = false;
  }
</script>

<div class="modal-overlay" class:open>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop-hit" onclick={onclose}></div>
  <div class="modal" style="max-width:420px">
    <h3>AI Settings</h3>

    <!-- Model selection -->
    <div class="ai-settings-section">
      <span class="ai-settings-label">Claude Model</span>
      <div class="model-toggle">
        {#each MODEL_OPTIONS as opt}
          <button
            class="model-toggle-btn"
            class:active={store.aiModel === opt.value}
            onclick={() => store.setAiModel(opt.value)}
            title={opt.desc}
          >
            {opt.label}
          </button>
        {/each}
      </div>
      <div class="model-description">
        {MODEL_OPTIONS.find((o) => o.value === store.aiModel)?.desc ?? ''}
      </div>
    </div>

    <!-- Hide AI features toggle -->
    <div class="ai-settings-section">
      <label class="ai-toggle-row">
        <span class="ai-settings-label" style="margin-bottom:0">Hide AI Features</span>
        <button
          class="ai-toggle-btn"
          class:active={store.hideAiFeatures}
          onclick={() => store.setHideAiFeatures(!store.hideAiFeatures)}
          title={store.hideAiFeatures ? 'AI features are hidden' : 'AI features are visible'}
        >
          {store.hideAiFeatures ? 'Hidden' : 'Visible'}
        </button>
      </label>
      <div class="model-description">
        {store.hideAiFeatures
          ? 'Generate button is hidden. Settings button shows icon only.'
          : 'Generate and Settings buttons are shown in the Enemies tab.'}
      </div>
    </div>

    <!-- Token usage -->
    {#if store.tokenUsage.generationCount > 0}
      {@const tu = store.tokenUsage}
      <div class="ai-settings-section">
        <span class="ai-settings-label">Token Usage (this app)</span>
        <div class="token-usage-grid">
          <span class="token-usage-row">
            <span class="token-usage-key">Total tokens</span>
            <span class="token-usage-val">{(tu.lifetimeInput + tu.lifetimeOutput).toLocaleString()}</span>
          </span>
          <span class="token-usage-row token-usage-divider">
            <span class="token-usage-key">Generations</span>
            <span class="token-usage-val">{tu.generationCount}</span>
          </span>
          <span class="token-usage-row">
            <span class="token-usage-key">Last generation</span>
            <span class="token-usage-val">{tu.lastInput.toLocaleString()} in / {tu.lastOutput.toLocaleString()} out</span>
          </span>
        </div>
        <div class="model-description" style="margin-top:0.4rem">
          Counts only generations made through this app. Monitor your Anthropic API usage and costs directly on Anthropic's platform.
We have no visibility into your account or billing.
          <!-- svelte-ignore a11y_invalid_attribute -->
          <a href="#" class="ai-external-link" onclick={(e) => { e.preventDefault(); window.toolbox.openExternal('https://platform.claude.com/cost'); }}>
            Open Anthropic Cost Dashboard ↗
          </a>
        </div>
      </div>
    {/if}

    <!-- API key -->
    <div class="ai-settings-section">
      <span class="ai-settings-label">Claude API Key</span>

      {#if hasKey}
        <div class="api-key-masked">
          <span class="api-key-dots">••••••••••••••••</span>
          <button class="btn btn-danger btn-sm" onclick={clearKey}>Clear Key</button>
        </div>
        <div class="model-description" style="margin-top:0.4rem">
          Key is stored encrypted by the OS. It cannot be read back.
        </div>
      {:else}
        <input
          type="password"
          class="form-input"
          placeholder="sk-ant-..."
          bind:value={keyInput}
          autocomplete="off"
          onkeydown={(e) => { if (e.key === 'Enter') saveKey(); }}
        />
        {#if error}
          <div class="generate-error" style="margin-top:0.4rem">{error}</div>
        {/if}
      {/if}
    </div>

    <div class="modal-footer">
      {#if !hasKey}
        <button class="btn btn-gold" onclick={saveKey} disabled={saving}>
          {saving ? 'Saving…' : 'Save Key'}
        </button>
      {/if}
      <button class="btn" onclick={onclose}>Close</button>
    </div>
  </div>
</div>

<style>
  @import '../../css/enemies.css';
</style>
