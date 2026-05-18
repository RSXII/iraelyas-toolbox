import { store } from '@/state/store';
import { showToast } from './app';

// ── Helpers ────────────────────────────────────────────────────────────────

function favorMeta(s: number): { word: string; color: string } {
  if (s < 20) return { word: 'Hostile',  color: 'var(--hostile)'  };
  if (s < 40) return { word: 'Wary',     color: 'var(--wary)'     };
  if (s < 60) return { word: 'Neutral',  color: 'var(--neutral)'  };
  if (s < 80) return { word: 'Friendly', color: 'var(--friendly)' };
  return               { word: 'Allied',  color: 'var(--allied)'   };
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// ── State ──────────────────────────────────────────────────────────────────

let activeFilter = 'all';

// ── Player select ──────────────────────────────────────────────────────────

export function renderPlayerSelect(): void {
  const cd = store.activeCampaignData;
  const players = cd ? Object.keys(cd.players) : [];
  const sel = document.getElementById('player-select') as HTMLSelectElement;

  sel.innerHTML = players.length
    ? players.map(p =>
        `<option value="${p}"${p === store.activePlayerId ? ' selected' : ''}>${cap(p)}</option>`
      ).join('')
    : '<option value="">No players</option>';

  const display = document.getElementById('favor-player-display')!;

  if (players.length && !store.activePlayerId) {
    store.setActivePlayer(players[0]);
    sel.value = players[0];
  }
  display.textContent = store.activePlayerId ? cap(store.activePlayerId) : '—';
}

export function switchPlayer(name: string): void {
  if (!name) return;
  store.setActivePlayer(name);
  document.getElementById('favor-player-display')!.textContent = cap(name);
  const cid = store.activeCampaignId;
  if (cid) store.patchPlayerScores(cid, name);
  renderFavor();
}

// ── Filter chips ───────────────────────────────────────────────────────────

function buildFilterChips(): void {
  const cd = store.activeCampaignData;
  const factions = cd ? [...new Set(cd.schema.npcs.map(n => n.faction))] : [];
  const all = ['all', ...factions];
  const row = document.getElementById('filter-row')!;

  row.innerHTML = '<span class="filter-label">Filter:</span>' +
    all.map(f =>
      `<button class="filter-chip${f === activeFilter ? ' active' : ''}"
        data-faction="${f}">${f === 'all' ? 'All' : f}</button>`
    ).join('');

  row.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.faction!;
      row.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderFavor();
    });
  });
}

// ── Main render ────────────────────────────────────────────────────────────

export function renderFavor(): void {
  buildFilterChips();

  const cid = store.activeCampaignId;
  const cd  = store.activeCampaignData;
  const el  = document.getElementById('npc-list')!;

  if (!cd || !cid) {
    el.innerHTML = '<div class="empty-state">Select or create a campaign to begin.</div>';
    return;
  }

  const pid = store.activePlayerId;
  const pd  = pid ? cd.players[pid] : null;
  const schema = cd.schema;

  const factions = activeFilter === 'all'
    ? [...new Set(schema.npcs.map(n => n.faction))]
    : [activeFilter];

  let html = '';
  factions.forEach(f => {
    const list = schema.npcs.filter(n => n.faction === f);
    if (!list.length) return;

    html += `<div class="section-head">
      <span class="section-name">${f}</span>
      <div class="section-line"></div>
    </div>`;

    list.forEach(npc => {
      const score = pd?.scores?.[npc.id] ?? 50;
      const { word, color } = favorMeta(score);
      html += `
        <div class="npc-row">
          <div class="npc-left">
            <div class="npc-initials">${initials(npc.name)}</div>
            <div class="npc-info">
              <div class="npc-name">${npc.name}</div>
              <div class="npc-role">${npc.role}</div>
            </div>
          </div>
          <div class="npc-right">
            <div class="meter-wrap">
              <div class="meter-top">
                <span class="favor-word" style="color:${color}">${word}</span>
                <span class="score-num">${score}</span>
              </div>
              <div class="meter-track">
                <div class="meter-fill" style="width:${score}%;background:${color}"></div>
              </div>
            </div>
            <div class="step-btns">
              <button class="step-btn" data-npc="${npc.id}" data-delta="-5">−</button>
              <button class="step-btn" data-npc="${npc.id}" data-delta="5">+</button>
            </div>
          </div>
        </div>`;
    });
  });

  if (!html) html = '<div class="empty-state">No NPCs in schema yet — add one below.</div>';
  el.innerHTML = html;

  // Attach step button listeners
  el.querySelectorAll<HTMLButtonElement>('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const npcId = btn.dataset.npc!;
      const delta = parseInt(btn.dataset.delta!);
      const cid   = store.activeCampaignId;
      const pid   = store.activePlayerId;
      if (!cid || !pid) { showToast('Select a player first'); return; }
      store.adjustFavorScore(cid, pid, npcId, delta);
      renderFavor();
    });
  });
}

// ── Save ───────────────────────────────────────────────────────────────────

export function savePlayer(): void {
  const cid = store.activeCampaignId;
  const pid = store.activePlayerId;
  if (!cid || !pid) return;
  store.patchPlayerScores(cid, pid);
  store.forceSave();
  showToast(`${cap(pid)} saved`);
}

// ── Add player ─────────────────────────────────────────────────────────────

export function createPlayer(): void {
  const input = document.getElementById('new-player-name') as HTMLInputElement;
  const raw = input.value.trim();
  if (!raw) return;

  const cid = store.activeCampaignId;
  if (!cid) { showToast('Select a campaign first'); return; }

  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const cd  = store.getCampaignData(cid);
  const scores: Record<string, number> = {};
  cd.schema.npcs.forEach(n => { scores[n.id] = 50; });

  store.upsertPlayer(cid, key, { player: raw, scores });
  input.value = '';
  renderPlayerSelect();
  switchPlayer(key);
  showToast(`${raw} created`);
}

// ── Add NPC ────────────────────────────────────────────────────────────────

export function addNPC(): void {
  const nameEl    = document.getElementById('new-npc-name') as HTMLInputElement;
  const roleEl    = document.getElementById('new-npc-role') as HTMLInputElement;
  const factionEl = document.getElementById('new-npc-faction') as HTMLInputElement;

  const name    = nameEl.value.trim();
  const role    = roleEl.value.trim();
  const faction = factionEl.value.trim();

  if (!name) { showToast('Name required'); return; }

  const cid = store.activeCampaignId;
  if (!cid) { showToast('Select a campaign first'); return; }

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  if (store.getCampaignData(cid).schema.npcs.find(n => n.id === id)) {
    showToast('NPC already exists');
    return;
  }

  store.addNPC(cid, { id, name, role: role || '—', faction: faction || 'Unaffiliated' });

  nameEl.value = '';
  roleEl.value = '';
  factionEl.value = '';

  renderFavor();
  showToast(`${name} added`);
}
