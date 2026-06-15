<script lang="ts">
  import { showToast } from '@/state/toast.svelte';
  import { genId } from './utils';
  import type {
    TrackerEntry,
    TrackerWarning,
    TrackerDirection,
    SessionDiffDirection,
    SessionTriggerMode,
  } from '@/types/index';

  interface Props {
    open: boolean;
    editing: TrackerEntry | null;
    sessionNumbers: number[];
    prefill?: { reminderText: string } | null;
    onsave: (entry: TrackerEntry) => void;
    onclose: () => void;
  }
  let { open, editing, sessionNumbers, prefill = null, onsave, onclose }: Props = $props();

  // ─── Form state ───────────────────────────────────────────────
  let modalName     = $state('');
  let modalCat      = $state('');
  let modalMin      = $state(0);
  let modalMax      = $state(10);
  let modalStart    = $state(0);
  let modalDir      = $state<TrackerDirection>('countup');
  let modalWarnings = $state<TrackerWarning[]>([]);
  let modalUseSessionTie = $state(false);
  let modalAnchorSession = $state(1);
  let modalSessionDirection = $state<SessionDiffDirection>('countup');
  let modalSessionDistance = $state(3);
  let modalTriggerMode = $state<SessionTriggerMode>('once');
  let modalReminderText = $state('');
  let nameInputEl   = $state<HTMLInputElement | null>(null);

  // ─── Populate / reset when modal opens ───────────────────────
  $effect(() => {
    if (!open) return;
    if (editing) {
      modalName     = editing.name;
      modalCat      = editing.category;
      modalMin      = editing.min;
      modalMax      = editing.max;
      modalStart    = editing.current;
      modalDir      = editing.direction;
      modalWarnings = editing.warnings.map((w) => ({ ...w }));
      modalUseSessionTie = editing.sessionLink?.enabled ?? false;
      modalAnchorSession = editing.sessionLink?.anchorSession ?? (sessionNumbers[0] ?? 1);
      modalSessionDirection = editing.sessionLink?.direction ?? 'countup';
      modalSessionDistance = editing.sessionLink?.distance ?? 3;
      modalTriggerMode = editing.sessionLink?.triggerMode ?? 'once';
      modalReminderText = editing.sessionLink?.reminderText ?? '';
    } else {
      modalName     = '';
      modalCat      = '';
      modalMin      = 0;
      modalMax      = 10;
      modalStart    = 0;
      modalDir      = 'countup';
      modalWarnings = [];
      modalUseSessionTie = prefill != null;
      modalAnchorSession = sessionNumbers[0] ?? 1;
      modalSessionDirection = 'countup';
      modalSessionDistance = 3;
      modalTriggerMode = 'once';
      modalReminderText = prefill?.reminderText ?? '';
    }
    setTimeout(() => nameInputEl?.focus(), 50);
  });

  // ─── Keyboard shortcuts scoped to open ───────────────────────
  $effect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onclose(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { save(); }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // ─── Save ─────────────────────────────────────────────────────
  function save(): void {
    const name = modalName.trim();
    const cat  = modalCat.trim();

    if (!name)                              { showToast('Name is required');                    return; }
    if (!cat)                               { showToast('Category is required');                return; }
    if (isNaN(modalMin) || isNaN(modalMax)) { showToast('Min and max are required');            return; }
    if (modalMax <= modalMin)               { showToast('Max must be greater than min');        return; }
    if (modalStart < modalMin || modalStart > modalMax) {
      showToast(`Starting value must be between ${modalMin} and ${modalMax}`);
      return;
    }

    const validWarnings = modalWarnings.filter((w) => w.label.trim() !== '');
    const bad = validWarnings.find((w) => w.value < modalMin || w.value > modalMax);
    if (bad) {
      showToast(`Warning value ${bad.value} is outside range ${modalMin}–${modalMax}`);
      return;
    }

    onsave({
      id:        editing?.id ?? genId(),
      name,
      category:  cat,
      min:       modalMin,
      max:       modalMax,
      current:   modalStart,
      direction: modalDir,
      warnings:  validWarnings,
      sessionLink: modalUseSessionTie
        ? {
            enabled: true,
            anchorSession: Math.max(1, Math.floor(modalAnchorSession || 1)),
            direction: modalSessionDirection,
            distance: Math.max(1, Math.floor(modalSessionDistance || 1)),
            triggerMode: modalTriggerMode,
            reminderText: modalReminderText.trim(),
          }
        : undefined,
    });
  }
</script>

<div class="modal-overlay" class:open>
  <div class="modal modal-tracker">
    <h3>{editing ? 'Edit Custom Tracker' : 'Add Custom Tracker'}</h3>

    <div class="field-group" style="margin-bottom: 10px">
      <label class="field-label" for="tracker-name-input">Name</label>
      <input id="tracker-name-input" type="text" bind:this={nameInputEl} bind:value={modalName}
        placeholder="e.g. Reginald's Deaths" />
    </div>

    <div class="field-group" style="margin-bottom: 10px">
      <label class="field-label" for="tracker-cat-input">Category</label>
      <input id="tracker-cat-input" type="text" bind:value={modalCat} placeholder="e.g. Characters" />
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
      <div class="field-group">
        <label class="field-label" for="tracker-min-input">Min</label>
        <input id="tracker-min-input" type="number" bind:value={modalMin} />
      </div>
      <div class="field-group">
        <label class="field-label" for="tracker-max-input">Max</label>
        <input id="tracker-max-input" type="number" bind:value={modalMax} />
      </div>
      <div class="field-group">
        <label class="field-label" for="tracker-start-input">Start at</label>
        <input id="tracker-start-input" type="number" bind:value={modalStart} />
      </div>
    </div>

    <div class="field-group" style="margin-bottom: 10px">
      <label class="field-label">Direction</label>
      <div class="direction-toggle">
        <button class="direction-option" class:active={modalDir === 'countup'}
          onclick={() => (modalDir = 'countup')}>↑ Count Up</button>
        <button class="direction-option" class:active={modalDir === 'countdown'}
          onclick={() => (modalDir = 'countdown')}>↓ Count Down</button>
      </div>
    </div>

    <div class="warnings-section-label">Warning Thresholds</div>
    <div class="warnings-list">
      {#each modalWarnings as w, wi}
        <div class="warning-row">
          <input type="number" value={w.value} placeholder="At value"
            oninput={(e) => { w.value = parseInt((e.target as HTMLInputElement).value) || 0; }} />
          <input type="text" value={w.label} placeholder="Warning message…"
            oninput={(e) => { w.label = (e.target as HTMLInputElement).value; }} />
          <button class="btn-icon danger" title="Remove warning"
            onclick={() => modalWarnings.splice(wi, 1)}>✕</button>
        </div>
      {/each}
    </div>
    <button class="add-warning-btn" onclick={() => modalWarnings.push({ value: 0, label: '' })}>
      + Add Warning Threshold
    </button>

    <div class="warnings-section-label">Session Trigger</div>
    <div class="session-link-wrap">
      <label class="session-link-toggle">
        <input type="checkbox" bind:checked={modalUseSessionTie} />
        <span>Tie this tracker to session progression</span>
      </label>

      {#if modalUseSessionTie}
        <div class="session-link-grid">
          <div class="field-group">
            <label class="field-label" for="session-anchor-select">Anchor Session</label>
            <select id="session-anchor-select" bind:value={modalAnchorSession}>
              {#each sessionNumbers as n}
                <option value={n}>Session {n}</option>
              {/each}
            </select>
          </div>

          <div class="field-group">
            <label class="field-label" for="session-diff-direction">Count Direction</label>
            <select id="session-diff-direction" bind:value={modalSessionDirection}>
              <option value="countup">Count Up (after anchor)</option>
              <option value="countdown">Count Down (before anchor)</option>
            </select>
          </div>

          <div class="field-group">
            <label class="field-label" for="session-distance">Session Distance</label>
            <input id="session-distance" type="number" min="1" bind:value={modalSessionDistance} />
          </div>

          <div class="field-group">
            <label class="field-label" for="session-trigger-mode">Trigger Mode</label>
            <select id="session-trigger-mode" bind:value={modalTriggerMode}>
              <option value="once">Once</option>
              <option value="repeat">Repeat</option>
            </select>
          </div>
        </div>

        <div class="field-group" style="margin-top: 8px">
          <label class="field-label" for="session-reminder-text">Reminder Text (optional)</label>
          <input
            id="session-reminder-text"
            type="text"
            bind:value={modalReminderText}
            placeholder="Defaults to an automatic reminder message"
          />
        </div>
      {/if}
    </div>

    <div class="modal-foot">
      <button class="btn" onclick={onclose}>Cancel</button>
      <button class="btn btn-gold" onclick={save}>Save</button>
    </div>
  </div>
</div>
