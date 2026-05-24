<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { DEFAULT_THEME } from '@/utils/theme';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  // Local hex text input values — kept in sync with store.theme but allow
  // free-form typing without committing invalid values mid-edit.
  let bgHex = $state(store.theme.bgColor);
  let textHex = $state(store.theme.textColor);
  let accentHex = $state(store.theme.accentColor);

  // Keep local hex inputs current whenever the modal is opened or theme
  // is changed externally (e.g. reset to defaults).
  $effect(() => {
    if (open) {
      bgHex = store.theme.bgColor;
      textHex = store.theme.textColor;
      accentHex = store.theme.accentColor;
    }
  });

  const HEX_RE = /^#[0-9a-fA-F]{6}$/;

  function onColorPicker(field: 'bgColor' | 'textColor' | 'accentColor', value: string): void {
    store.updateTheme({ [field]: value });
    if (field === 'bgColor') bgHex = value;
    else if (field === 'textColor') textHex = value;
    else accentHex = value;
  }

  function onHexInput(field: 'bgColor' | 'textColor' | 'accentColor', value: string): void {
    if (field === 'bgColor') bgHex = value;
    else if (field === 'textColor') textHex = value;
    else accentHex = value;
    // Only commit to store when the value is a valid full hex
    if (HEX_RE.test(value)) {
      store.updateTheme({ [field]: value.toLowerCase() });
    }
  }

  function onScale(value: number): void {
    store.updateTheme({ uiScale: value });
  }

  function resetDefaults(): void {
    store.updateTheme({ ...DEFAULT_THEME });
    bgHex = DEFAULT_THEME.bgColor;
    textHex = DEFAULT_THEME.textColor;
    accentHex = DEFAULT_THEME.accentColor;
  }
</script>

<div class="modal-overlay" class:open>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop-hit" onclick={onclose}></div>
  <div class="modal theme-modal">
    <h3>Appearance Settings</h3>

    <!-- UI Scale -->
    <div class="theme-row">
      <label class="theme-label" for="theme-scale">UI Scale</label>
      <div class="theme-control theme-scale-control">
        <input
          id="theme-scale"
          type="range"
          min="0.80"
          max="1.20"
          step="0.05"
          value={store.theme.uiScale}
          oninput={(e) => onScale(parseFloat((e.target as HTMLInputElement).value))}
        />
        <span class="theme-scale-label">{Math.round(store.theme.uiScale * 100)}%</span>
      </div>
    </div>

    <div class="theme-divider"></div>

    <!-- Background Color -->
    <div class="theme-row">
      <label class="theme-label" for="theme-bg-picker">Background</label>
      <div class="theme-control theme-color-control">
        <input
          id="theme-bg-picker"
          type="color"
          class="theme-color-picker"
          value={store.theme.bgColor}
          oninput={(e) => onColorPicker('bgColor', (e.target as HTMLInputElement).value)}
        />
        <input
          type="text"
          class="theme-hex-input"
          value={bgHex}
          maxlength={7}
          placeholder="#rrggbb"
          oninput={(e) => onHexInput('bgColor', (e.target as HTMLInputElement).value)}
        />
      </div>
    </div>

    <!-- Text Color -->
    <div class="theme-row">
      <label class="theme-label" for="theme-text-picker">Text Color</label>
      <div class="theme-control theme-color-control">
        <input
          id="theme-text-picker"
          type="color"
          class="theme-color-picker"
          value={store.theme.textColor}
          oninput={(e) => onColorPicker('textColor', (e.target as HTMLInputElement).value)}
        />
        <input
          type="text"
          class="theme-hex-input"
          value={textHex}
          maxlength={7}
          placeholder="#rrggbb"
          oninput={(e) => onHexInput('textColor', (e.target as HTMLInputElement).value)}
        />
      </div>
    </div>

    <!-- Accent Color -->
    <div class="theme-row">
      <label class="theme-label" for="theme-accent-picker">Accent Color</label>
      <div class="theme-control theme-color-control">
        <input
          id="theme-accent-picker"
          type="color"
          class="theme-color-picker"
          value={store.theme.accentColor}
          oninput={(e) => onColorPicker('accentColor', (e.target as HTMLInputElement).value)}
        />
        <input
          type="text"
          class="theme-hex-input"
          value={accentHex}
          maxlength={7}
          placeholder="#rrggbb"
          oninput={(e) => onHexInput('accentColor', (e.target as HTMLInputElement).value)}
        />
      </div>
    </div>

    <div class="theme-divider"></div>

    <div class="theme-footer">
      <button class="btn btn-sm btn-danger-subtle" onclick={resetDefaults}>Reset to Defaults</button>
      <button class="btn btn-sm btn-gold" onclick={onclose}>Done</button>
    </div>

    <button class="danger-close" onclick={onclose}>✕</button>
  </div>
</div>

<style>
  /* Backdrop hit area sits behind the modal box to close on outside click */
  .modal-backdrop-hit {
    position: absolute;
    inset: 0;
    cursor: default;
  }

  .theme-modal {
    position: relative;
    width: 420px;
    z-index: 1;
  }

  /* ── Row layout ─────────────────────────────────────────────── */
  .theme-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.55rem 0;
  }

  .theme-label {
    font-family: "Cinzel", serif;
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-dim);
    flex-shrink: 0;
    width: 90px;
  }

  .theme-control {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* ── Scale row ──────────────────────────────────────────────── */
  .theme-scale-control input[type="range"] {
    flex: 1;
    accent-color: var(--gold);
    cursor: pointer;
  }

  .theme-scale-label {
    font-family: "Cinzel", serif;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--gold);
    min-width: 38px;
    text-align: right;
  }

  /* ── Color rows ─────────────────────────────────────────────── */
  .theme-color-control {
    gap: 8px;
  }

  .theme-color-picker {
    width: 34px;
    height: 34px;
    padding: 2px;
    border: 1px solid var(--border-h);
    border-radius: var(--radius);
    background: var(--surface);
    cursor: pointer;
    flex-shrink: 0;
  }

  .theme-hex-input {
    /* Override the global input[type="text"] width: 100% */
    width: 100px !important;
    font-family: "Crimson Pro", serif;
    font-size: 13px;
    letter-spacing: 0.06em;
    padding: 6px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    transition: border-color 0.15s;
  }

  .theme-hex-input:focus {
    outline: none;
    border-color: var(--gold-dim);
  }

  /* ── Divider ────────────────────────────────────────────────── */
  .theme-divider {
    height: 1px;
    background: var(--border);
    margin: 0.6rem 0;
  }

  /* ── Footer ─────────────────────────────────────────────────── */
  .theme-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.75rem;
  }
</style>
