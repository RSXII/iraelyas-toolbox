<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { SessionEntry } from '@/types/index';

  interface Props {
    active?: boolean;
  }
  let { active = false }: Props = $props();

  const campaignId = $derived(store.activeCampaignId);
  const sessions = $derived(campaignId ? store.getSessions(campaignId) : null);

  const historyEntries = $derived.by(() => {
    if (!sessions) return [] as SessionEntry[];
    return [...sessions.entries].sort((a, b) => b.timestamp - a.timestamp);
  });

  function startSession(): void {
    if (!campaignId || !sessions) return;
    const started = sessions.currentNumber;
    store.startSession(campaignId);
    showToast(`Session ${started} started`);
  }

  function updateCurrentNumber(raw: string): void {
    if (!campaignId) return;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;
    store.setCurrentSessionNumber(campaignId, parsed);
  }

  function updateCurrentNote(note: string): void {
    if (!campaignId) return;
    store.setCurrentSessionNote(campaignId, note);
  }
</script>

<div class="tab-panel" id="panel-sessions" class:active>
  <div class="sessions-inner">
    <div class="sessions-header">
      <div class="sessions-title-wrap">
        <div class="sessions-title">Session Tracker</div>
        <div class="sessions-subtitle">Campaign-level session progression and notes</div>
      </div>
      <button class="btn btn-gold session-start-btn" onclick={startSession}>Start Session</button>
    </div>

    {#if !campaignId || !sessions}
      <div class="empty-state">Select or create a campaign to begin.</div>
    {:else}
      <div class="sessions-editor-grid">
        <div class="sessions-card">
          <label class="sessions-label" for="current-session-number">Current Session</label>
          <input
            id="current-session-number"
            class="sessions-input"
            type="number"
            min="1"
            value={sessions.currentNumber}
            onblur={(e) => updateCurrentNumber((e.target as HTMLInputElement).value)}
            onkeydown={(e) => {
              if (e.key === 'Enter') updateCurrentNumber((e.target as HTMLInputElement).value);
            }}
          />
          <div class="sessions-hint">Adjust this directly if you need to skip or correct numbering.</div>
        </div>

        <div class="sessions-card">
          <label class="sessions-label" for="current-session-note">Current Session Note</label>
          <textarea
            id="current-session-note"
            class="sessions-textarea"
            placeholder="Add a note for this session..."
            value={sessions.currentNote}
            oninput={(e) => updateCurrentNote((e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>
      </div>

      <div class="sessions-history">
        <div class="sessions-history-head">
          <span class="sessions-history-title">History</span>
          <span class="sessions-history-count">{sessions.entries.length} total</span>
        </div>

        {#if historyEntries.length === 0}
          <div class="sessions-empty">No completed sessions yet. Click Start Session to record the first one.</div>
        {:else}
          <div class="sessions-history-list">
            {#each historyEntries as entry (entry.id)}
              <div class="sessions-history-item">
                <div class="sessions-history-item-top">
                  <span class="sessions-chip">Session {entry.number}</span>
                  <span class="sessions-date">{new Date(entry.timestamp).toLocaleDateString()}</span>
                </div>
                <div class="sessions-note">{entry.note || 'No note.'}</div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
