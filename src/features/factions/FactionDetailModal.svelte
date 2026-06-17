<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import { pickAndCompressPortrait } from '@/utils/npc-image';
  import type { FactionConfig } from '@/types/index';
  import FactionRanksSection from './FactionRanksSection.svelte';
  import FactionMembersSection from './FactionMembersSection.svelte';
  import FactionNpcSection from './FactionNpcSection.svelte';

  interface Props {
    fc: FactionConfig | null;
    fcIdx: number;
    totalFactions: number;
    onclose: () => void;
  }
  let { fc, fcIdx, totalFactions, onclose }: Props = $props();

  const open = $derived(fc !== null);
  const campaignId = $derived(store.activeCampaignId);

  function patch(p: { name?: string; leader?: string; insignia?: string }): void {
    if (!campaignId || !fc) return;
    store.patchFaction(campaignId, fc.id, p);
  }

  function onNameChange(val: string): void {
    const name = val.trim() || fc!.name;
    patch({ name });
  }

  function onLeaderChange(val: string): void {
    patch({ leader: val.trim() || '' });
  }

  async function handlePickInsignia(): Promise<void> {
    const dataUrl = await pickAndCompressPortrait();
    if (dataUrl) patch({ insignia: dataUrl });
  }

  function handleRemoveInsignia(): void {
    patch({ insignia: undefined });
  }

  function moveFaction(direction: 'up' | 'down'): void {
    if (!campaignId || !fc) return;
    store.moveFactionConfig(campaignId, fc.id, direction);
  }

  function removeFaction(): void {
    if (!campaignId || !fc) return;
    if (!confirm(`Remove "${fc.name}"? This cannot be undone.`)) return;
    store.removeFactionConfig(campaignId, fc.id);
    showToast('Faction removed');
    onclose();
  }

  // Escape key closes
  $effect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onclose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }
</script>

<div class="modal-overlay" class:open onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}>
  {#if fc}
    <div class="modal modal-faction-detail">

      <!-- Modal header -->
      <div class="faction-detail-header">

        <!-- Insignia section -->
        <div class="faction-insignia-section">
          {#if fc.insignia}
            <img class="faction-insignia-preview" src={fc.insignia} alt="Insignia for {fc.name}" />
            <div class="faction-insignia-actions">
              <button class="btn btn-sm" onclick={handlePickInsignia}>Change</button>
              <button class="btn btn-sm" onclick={handleRemoveInsignia}>✕ Remove</button>
            </div>
          {:else}
            <!-- svelte-ignore a11y_interactive_supports_focus -->
            <div
              class="faction-insignia-placeholder"
              role="button"
              tabindex="0"
              onclick={handlePickInsignia}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePickInsignia(); } }}
            >
              <div class="faction-insignia-placeholder-inner">
                <span class="faction-insignia-placeholder-icon">🛡</span>
                <span>Add Insignia</span>
              </div>
            </div>
          {/if}
        </div>

        <!-- Name + leader fields -->
        <div class="faction-detail-meta">
          <input
            class="faction-detail-title"
            type="text"
            aria-label="Faction name"
            value={fc.name}
            onchange={(e) => onNameChange((e.target as HTMLInputElement).value)}
            onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
          <div class="faction-detail-field-group">
            <label class="faction-detail-field-label" for="faction-leader-{fc.id}">Leader</label>
            <input
              id="faction-leader-{fc.id}"
              class="faction-detail-field-input"
              type="text"
              placeholder="—"
              value={fc.leader ?? ''}
              onchange={(e) => onLeaderChange((e.target as HTMLInputElement).value)}
            />
          </div>
        </div>

        <!-- Close button -->
        <button class="btn-icon faction-detail-close" aria-label="Close" onclick={onclose}>✕</button>

      </div>
      <!-- /faction-detail-header -->

      <!-- Body: existing sections unchanged -->
      <div class="faction-detail-body">
        <FactionRanksSection {fc} />
        <FactionMembersSection {fc} />
        <FactionNpcSection {fc} />
      </div>

      <!-- Footer -->
      <div class="modal-foot faction-detail-foot">
        <div class="faction-detail-foot-left">
          <button
            class="btn-icon btn-reorder"
            onclick={() => moveFaction('up')}
            disabled={fcIdx === 0}
            title="Move up"
          >▲</button>
          <button
            class="btn-icon btn-reorder"
            onclick={() => moveFaction('down')}
            disabled={fcIdx === totalFactions - 1}
            title="Move down"
          >▼</button>
          <button class="btn-delete-faction" onclick={removeFaction}>Delete Faction</button>
        </div>
        <button class="btn btn-gold" onclick={onclose}>Done</button>
      </div>

    </div>
  {/if}
</div>
