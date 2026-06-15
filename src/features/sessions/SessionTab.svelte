<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import TrackerEntryModal from '@/features/tracker/TrackerEntryModal.svelte';
  import type { SessionEntry, SessionReminder, TrackerEntry } from '@/types/index';

  interface Props {
    active?: boolean;
  }
  let { active = false }: Props = $props();

  const campaignId = $derived(store.activeCampaignId);
  const sessions   = $derived(campaignId ? store.getSessions(campaignId) : null);

  const historyEntries = $derived.by(() => {
    if (!sessions) return [] as SessionEntry[];
    return [...sessions.entries].sort((a, b) => b.timestamp - a.timestamp);
  });

  const sessionNumbers = $derived.by(() => {
    if (!sessions) return [] as number[];
    const unique = new Set<number>([sessions.currentNumber, ...sessions.entries.map((s) => s.number)]);
    return [...unique].sort((a, b) => b - a);
  });

  // ── Session phase ─────────────────────────────────────────────
  type SessionPhase = 'idle' | 'running' | 'summary';
  let sessionPhase    = $state<SessionPhase>('idle');
  let frozenIntroNote = $state('');
  let activeNotes     = $state<string[]>([]);
  let newNoteInput    = $state('');

  // Reminders are reactive — populated by prepareSessionReminders
  const pendingReminders = $derived.by(() => {
    if (!sessions) return [] as SessionReminder[];
    const maybe = sessions.currentData?.reminders;
    return Array.isArray(maybe) ? (maybe as SessionReminder[]) : [];
  });

  // Reset phase state when campaign changes
  let _trackedCampaignId = $state<string | null | undefined>(null);
  $effect(() => {
    const id = campaignId;
    if (id !== _trackedCampaignId) {
      _trackedCampaignId = id;
      if (sessionPhase !== 'idle') {
        sessionPhase    = 'idle';
        frozenIntroNote = '';
        activeNotes     = [];
        newNoteInput    = '';
        showTrackerModal    = false;
        trackerPrefillNote  = '';
      }
    }
  });

  // ── In-session tracker modal ──────────────────────────────────
  let showTrackerModal   = $state(false);
  let trackerPrefillNote = $state('');

  function openAddTracker(noteText: string): void {
    trackerPrefillNote = noteText;
    showTrackerModal   = true;
  }

  function handleTrackerSave(entry: TrackerEntry): void {
    if (!campaignId) return;
    store.upsertTrackerEntry(campaignId, entry);
    showTrackerModal   = false;
    trackerPrefillNote = '';
    showToast(`${entry.name} added to Custom Trackers`);
  }

  function closeTrackerModal(): void {
    showTrackerModal   = false;
    trackerPrefillNote = '';
  }

  // ── Phase handlers ────────────────────────────────────────────
  function handleStartSession(): void {
    if (!campaignId || !sessions) return;
    frozenIntroNote = sessions.currentNote;
    store.prepareSessionReminders(campaignId);
    activeNotes  = [];
    newNoteInput = '';
    sessionPhase = 'running';
  }

  function handleEndSession(): void {
    sessionPhase = 'summary';
  }

  function handleDone(): void {
    if (!campaignId || !sessions) return;
    const committedNumber = sessions.currentNumber;
    store.startSession(campaignId, activeNotes);
    showToast(`Session ${committedNumber} saved`);
    sessionPhase    = 'idle';
    frozenIntroNote = '';
    activeNotes     = [];
    newNoteInput    = '';
  }

  // ── Active note management ────────────────────────────────────
  function addNote(): void {
    const text = newNoteInput.trim();
    if (!text) return;
    activeNotes  = [...activeNotes, text];
    newNoteInput = '';
  }

  function onNewNoteKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); addNote(); }
  }

  function removeNote(index: number): void {
    activeNotes = activeNotes.filter((_, i) => i !== index);
  }

  // ── History inline note editing ───────────────────────────────
  let editingId = $state<string | null>(null);
  let editDraft = $state('');

  function beginEdit(entry: SessionEntry): void {
    editingId = entry.id;
    editDraft = entry.note;
  }

  function commitEdit(): void {
    if (!campaignId || !editingId) return;
    store.updateSessionEntryNote(campaignId, editingId, editDraft);
    editingId = null;
    editDraft = '';
  }

  function cancelEdit(): void {
    editingId = null;
    editDraft = '';
  }

  function onEditKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); commitEdit(); }
  }

  // ── History data helpers ──────────────────────────────────────
  function getReminders(entry: SessionEntry): SessionReminder[] {
    const maybe = entry.data?.reminders;
    return Array.isArray(maybe) ? (maybe as SessionReminder[]) : [];
  }

  function getActiveNotes(entry: SessionEntry): string[] {
    const maybe = entry.data?.activeNotes;
    return Array.isArray(maybe) ? (maybe as string[]) : [];
  }

  // ── History deletion ──────────────────────────────────────────
  function handleDeleteSession(entry: SessionEntry): void {
    if (!campaignId) return;
    const affected = store.getTracker(campaignId).entries.filter(
      (t) => t.sessionLink?.enabled && t.sessionLink.anchorSession === entry.number,
    ).length;
    const trackerWarning = affected > 0
      ? `\n\nNote: ${affected} custom tracker${affected === 1 ? '' : 's'} reference${affected === 1 ? 's' : ''} session ${entry.number} — their reminder anchors will not be changed.`
      : '';
    if (!confirm(`Delete Session ${entry.number}? This cannot be undone.${trackerWarning}`)) return;
    store.deleteSessionEntry(campaignId, entry.id);
    showToast(`Session ${entry.number} deleted`);
  }

  // ── Idle: session setup ───────────────────────────────────────
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

    <!-- ══ IDLE ══════════════════════════════════════════════════ -->
    {#if sessionPhase === 'idle'}
      <div class="sessions-header">
        <div class="sessions-title-wrap">
          <div class="sessions-title">Session Tracker</div>
          <div class="sessions-subtitle">Campaign-level session progression and notes</div>
        </div>
        <button
          class="btn btn-gold session-start-btn"
          onclick={handleStartSession}
          disabled={!campaignId || !sessions}
        >Start Session</button>
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
              onkeydown={(e) => { if (e.key === 'Enter') updateCurrentNumber((e.target as HTMLInputElement).value); }}
            />
            <div class="sessions-hint">Adjust this directly if you need to skip or correct numbering.</div>
          </div>

          <div class="sessions-card">
            <label class="sessions-label" for="current-session-note">Session Intro Note</label>
            <textarea
              id="current-session-note"
              class="sessions-textarea"
              placeholder="Add a note or agenda for this session before starting..."
              value={sessions.currentNote}
              oninput={(e) => updateCurrentNote((e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </div>
        </div>

        <!-- History -->
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
                {@const reminders    = getReminders(entry)}
                {@const entryNotes   = getActiveNotes(entry)}
                {@const isThisEditing = editingId === entry.id}
                <div class="sessions-history-item" class:is-editing={isThisEditing}>
                  <div class="sessions-history-item-top">
                    <span class="sessions-chip">Session {entry.number}</span>
                    <span class="sessions-date">{new Date(entry.timestamp).toLocaleDateString()}</span>
                    {#if !isThisEditing}
                      <button class="sessions-edit-btn" onclick={() => beginEdit(entry)} title="Edit note">Edit</button>
                      <button class="sessions-delete-btn" onclick={() => handleDeleteSession(entry)} title="Delete session">Delete</button>
                    {/if}
                  </div>

                  {#if isThisEditing}
                    <textarea
                      class="sessions-note-edit"
                      value={editDraft}
                      oninput={(e) => { editDraft = (e.target as HTMLTextAreaElement).value; }}
                      onkeydown={onEditKeydown}
                      placeholder="Add a note for this session..."
                    ></textarea>
                    <div class="sessions-note-actions">
                      <button class="btn sessions-note-cancel-btn" onclick={cancelEdit}>Cancel</button>
                      <button class="btn btn-gold sessions-note-save-btn" onclick={commitEdit}>Save</button>
                    </div>
                  {:else}
                    <div class="sessions-note">{entry.note || 'No note.'}</div>
                  {/if}

                  {#if entryNotes.length > 0 && !isThisEditing}
                    <div class="sessions-history-active-notes">
                      <div class="sessions-reminders-label">Session Notes</div>
                      <ul class="sessions-history-notes-list">
                        {#each entryNotes as n}
                          <li class="sessions-history-note-item">{n}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}

                  {#if reminders.length > 0 && !isThisEditing}
                    <div class="sessions-reminders">
                      <div class="sessions-reminders-label">Triggered Reminders</div>
                      <div class="sessions-reminders-list">
                        {#each reminders as reminder (reminder.id)}
                          <div class="sessions-reminder-item">
                            <span class="sessions-reminder-source">{reminder.sourceName}</span>
                            <span class="sessions-reminder-message">{reminder.message}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

    <!-- ══ RUNNING ════════════════════════════════════════════════ -->
    {:else if sessionPhase === 'running'}
      <div class="sessions-running-banner">
        <div class="sessions-running-info">
          <div class="sessions-running-label">Session In Progress</div>
          <div class="sessions-running-number">Session {sessions?.currentNumber}</div>
        </div>
        <button class="btn sessions-end-btn" onclick={handleEndSession}>End Session</button>
      </div>

      {#if frozenIntroNote}
        <div class="sessions-intro-card">
          <div class="sessions-label">Intro Note</div>
          <div class="sessions-intro-text">{frozenIntroNote}</div>
        </div>
      {/if}

      {#if pendingReminders.length > 0}
        <div class="sessions-reminders-section">
          <div class="sessions-reminders-section-head">
            <span class="sessions-reminders-section-title">Triggered Reminders</span>
            <span class="sessions-history-count">{pendingReminders.length}</span>
          </div>
          <div class="sessions-reminders-list">
            {#each pendingReminders as reminder (reminder.id)}
              <div class="sessions-reminder-item sessions-reminder-item--live">
                <span class="sessions-reminder-source">{reminder.sourceName}</span>
                <span class="sessions-reminder-message">{reminder.message}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="sessions-active-notes">
        <div class="sessions-active-notes-head">
          <span class="sessions-active-notes-title">Active Notes</span>
          <span class="sessions-history-count">{activeNotes.length} added</span>
        </div>
        <div class="sessions-active-input-row">
          <textarea
            class="sessions-textarea sessions-active-input"
            placeholder="Note something that happened this session... (Cmd+Enter to add)"
            value={newNoteInput}
            oninput={(e) => { newNoteInput = (e.target as HTMLTextAreaElement).value; }}
            onkeydown={onNewNoteKeydown}
          ></textarea>
          <button
            class="btn btn-gold sessions-add-note-btn"
            onclick={addNote}
            disabled={!newNoteInput.trim()}
          >Add Note</button>
        </div>

        {#if activeNotes.length > 0}
          <div class="sessions-active-notes-list">
            {#each activeNotes as note, i}
              <div class="sessions-active-note-item">
                <div class="sessions-active-note-text">{note}</div>
                <div class="sessions-active-note-actions">
                  <button class="btn sessions-add-tracker-btn" onclick={() => openAddTracker(note)}>+ Add Tracker</button>
                  <button class="sessions-remove-note-btn" onclick={() => removeNote(i)} title="Remove note" aria-label="Remove note">✕</button>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="sessions-active-notes-empty">No notes added yet.</div>
        {/if}
      </div>

    <!-- ══ SUMMARY ════════════════════════════════════════════════ -->
    {:else if sessionPhase === 'summary'}
      <div class="sessions-summary">
        <div class="sessions-summary-head">
          <div class="sessions-summary-title-wrap">
            <div class="sessions-running-label">Session Summary</div>
            <div class="sessions-running-number">Session {sessions?.currentNumber}</div>
          </div>
          <button class="btn btn-gold sessions-done-btn" onclick={handleDone}>Done — Save & Continue</button>
        </div>

        {#if frozenIntroNote}
          <div class="sessions-intro-card">
            <div class="sessions-label">Intro Note</div>
            <div class="sessions-intro-text">{frozenIntroNote}</div>
          </div>
        {/if}

        {#if activeNotes.length > 0}
          <div class="sessions-active-notes">
            <div class="sessions-active-notes-head">
              <span class="sessions-active-notes-title">Session Notes</span>
              <span class="sessions-history-count">{activeNotes.length} total</span>
            </div>
            <div class="sessions-active-notes-list">
              {#each activeNotes as note, i}
                <div class="sessions-active-note-item">
                  <div class="sessions-active-note-text">{note}</div>
                  <div class="sessions-active-note-actions">
                    <button class="btn sessions-add-tracker-btn" onclick={() => openAddTracker(note)}>+ Add Tracker</button>
                    <button class="sessions-remove-note-btn" onclick={() => removeNote(i)} title="Remove note" aria-label="Remove note">✕</button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="sessions-summary-no-notes">No notes were added during this session.</div>
        {/if}

        {#if pendingReminders.length > 0}
          <div class="sessions-reminders-section">
            <div class="sessions-reminders-section-head">
              <span class="sessions-reminders-section-title">Triggered Reminders</span>
              <span class="sessions-history-count">{pendingReminders.length}</span>
            </div>
            <div class="sessions-reminders-list">
              {#each pendingReminders as reminder (reminder.id)}
                <div class="sessions-reminder-item sessions-reminder-item--live">
                  <span class="sessions-reminder-source">{reminder.sourceName}</span>
                  <span class="sessions-reminder-message">{reminder.message}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- TrackerEntryModal — available during running & summary -->
    {#if sessionPhase !== 'idle'}
      <TrackerEntryModal
        open={showTrackerModal}
        editing={null}
        prefill={trackerPrefillNote ? { reminderText: trackerPrefillNote } : null}
        {sessionNumbers}
        onsave={handleTrackerSave}
        onclose={closeTrackerModal}
      />
    {/if}

  </div>
</div>
