<script lang="ts">
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { FavorTier } from '@/types/index';

  interface Props {
    open: boolean;
    onclose: () => void;
    onexportbackup: () => void;
  }

  let { open, onclose, onexportbackup }: Props = $props();

  // ─── Checkbox state ───────────────────────────────────────────
  let exportFavorTiers = $state(true);

  const anySelected = $derived(exportFavorTiers);

  // ─── Helpers ─────────────────────────────────────────────────
  function favorLabel(score: number, tiers: FavorTier[]): string {
    const sorted = [...tiers].sort((a, b) => b.threshold - a.threshold);
    const match = sorted.find((t) => score >= t.threshold);
    const fallback = sorted[sorted.length - 1];
    return match?.label ?? fallback?.label ?? '—';
  }

  function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function isoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  // ─── Export player view ───────────────────────────────────────
  async function exportPlayerView(): Promise<void> {
    const cid = store.activeCampaignId;
    if (!cid) { showToast('No active campaign'); return; }

    const cd = store.activeCampaignData;
    if (!cd) { showToast('No campaign data found'); return; }

    const campaignLabel = store.campaigns.find((c) => c.id === cid)?.label ?? cid;
    const pcs = store.getParty(cid).pcs;
    const npcs = cd.schema.npcs;
    const tiers = store.getFavorSettings(cid).tiers;

    // ─── Build markdown ───────────────────────────────────────
    const lines: string[] = [];

    // YAML frontmatter
    lines.push('---');
    lines.push(`campaign: "${campaignLabel.replace(/"/g, '\\"')}"`);
    lines.push(`exported: "${isoDate()}"`);
    lines.push('---');
    lines.push('');

    // Title
    lines.push(`# ${campaignLabel} — Player View`);
    lines.push('');

    // ── Favor tiers section ───────────────────────────────────
    if (exportFavorTiers) {
      lines.push('## Player Favor Tiers');
      lines.push('');

      if (!pcs.length) {
        lines.push('*No players in party.*');
        lines.push('');
      } else if (!npcs.length) {
        lines.push('*No NPCs in schema.*');
        lines.push('');
      } else {
        // Collect unique factions in the order they appear in the NPC list
        const factionOrder: string[] = [];
        for (const npc of npcs) {
          if (!factionOrder.includes(npc.faction)) factionOrder.push(npc.faction);
        }

        for (const pc of pcs) {
          lines.push(`### ${pc.name}`);
          lines.push('');
          lines.push('| NPC | Faction | Tier |');
          lines.push('|-----|---------|------|');

          const scores = store.getPlayerData(cid, pc.id)?.scores ?? {};

          for (const faction of factionOrder) {
            const group = npcs.filter((n) => n.faction === faction);
            for (const npc of group) {
              const score = scores[npc.id] ?? 50;
              const tier = favorLabel(score, tiers);
              lines.push(`| ${npc.name} | ${faction} | ${tier} |`);
            }
          }

          lines.push('');
        }
      }
    }

    const markdown = lines.join('\n');
    const filename = `${slugify(campaignLabel)}-player-view.md`;

    const result = await window.toolbox.exportFile(filename, markdown, [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] },
    ]);
    if (result.ok) {
      showToast('Player view exported');
      onclose();
    }
  }

  function handleBackup(): void {
    onexportbackup();
    onclose();
  }
</script>

<div class="modal-overlay" class:open>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop-hit" onclick={onclose}></div>

  <div class="modal export-modal">
    <h3>Export</h3>

    <!-- ── Export Backup ─────────────────────────────────────── -->
    <div class="export-section">
      <div class="export-section-header">Export Backup</div>
      <p class="export-desc">Full JSON snapshot of all campaigns. Use this to back up or transfer your data.</p>
      <button class="btn btn-sm btn-gold" onclick={handleBackup}>Export Backup</button>
    </div>

    <div class="export-divider"></div>

    <!-- ── Export Player View ────────────────────────────────── -->
    <div class="export-section">
      <div class="export-section-header">Export Player View</div>
      <p class="export-desc">Generates an Obsidian-friendly <code>.md</code> file with selected campaign data for your players.</p>

      <div class="export-checklist">
        <label class="export-check-row">
          <input type="checkbox" bind:checked={exportFavorTiers} />
          <span>Player Favor Tiers</span>
        </label>
      </div>

      <button
        class="btn btn-sm"
        onclick={exportPlayerView}
        disabled={!anySelected}
      >
        Export Player View
      </button>
    </div>

    <button class="export-close btn btn-sm" onclick={onclose}>Cancel</button>
  </div>
</div>

<style>
  .export-modal {
    width: 420px;
    max-width: 92vw;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 1.5rem;
  }

  .export-modal h3 {
    margin: 0 0 1.25rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
  }

  .export-section {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .export-section-header {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--gold);
  }

  .export-desc {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-dim);
    line-height: 1.5;
  }

  .export-desc code {
    font-family: monospace;
    color: var(--text);
    background: var(--surface);
    padding: 0.1em 0.3em;
    border-radius: 3px;
  }

  .export-divider {
    height: 1px;
    background: var(--border, rgba(255,255,255,0.08));
    margin: 1.25rem 0;
  }

  .export-checklist {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 0.25rem;
  }

  .export-check-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text);
    cursor: pointer;
  }

  .export-check-row input[type="checkbox"] {
    width: 14px;
    height: 14px;
    accent-color: var(--gold);
    cursor: pointer;
    flex-shrink: 0;
  }

  .export-close {
    margin-top: 1.25rem;
    align-self: flex-end;
  }
</style>
