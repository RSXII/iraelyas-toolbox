import type {
  AppState, Campaign, CampaignData, ConvoPC, ConvoState,
  HouseData, NPC, PlayerData, Schema, TabId,
  TimelineData, UIState, TrackerData, TrackerEntry,
  PartyData, PCCard, PCCustomField,
} from '@/types/index';

// ═══════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONVO_PCS: ConvoPC[] = Array.from({ length: 6 }, (_, i) => ({
  name:  `PC ${i + 1}`,
  score: 5,
}));

const DEFAULT_CONVO: ConvoState = {
  title:   'Generic Conversation',
  pcCount: 4,
  pcs:     DEFAULT_CONVO_PCS,
};

const DEFAULT_UI: UIState = {
  activeCampaign: '',
  activePlayer:   '',
  activeHouse:    '',
  activeTab:      'favor',
  convo:          DEFAULT_CONVO,
};

function defaultCampaignData(): CampaignData {
  return {
    schema:   { npcs: [] },
    players:  {},
    houses:   {},
    timeline: null,
    tracker:  { entries: [] },
    party:    { pcs: [] },
  };
}

function defaultState(): AppState {
  return {
    version:      1,
    campaigns:    [],
    campaignData: {},
    ui:           { ...DEFAULT_UI, convo: { ...DEFAULT_CONVO, pcs: [...DEFAULT_CONVO_PCS] } },
  };
}

// ═══════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════

class Store {
  private _state: AppState = defaultState();
  private _dirty = false;
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Boot ─────────────────────────────────────────────────────

  async load(): Promise<boolean> {
    try {
      const saved = await window.toolbox.loadData();
      if (!saved) return false;
      this._state = this._migrate(saved);
      return true;
    } catch (err) {
      console.error('Store.load failed:', err);
      return false;
    }
  }

  /** Run any version migrations needed on loaded data */
  private _migrate(raw: AppState): AppState {
    const s = { ...defaultState(), ...raw };
    // Ensure every campaign has a full data bucket
    s.campaigns.forEach(c => {
      if (!s.campaignData[c.id]) {
        s.campaignData[c.id] = defaultCampaignData();
      }
    });
    // Ensure convo pcs array always has 6 entries
    while (s.ui.convo.pcs.length < 6) {
      const i = s.ui.convo.pcs.length;
      s.ui.convo.pcs.push({ name: `PC ${i + 1}`, score: 5 });
    }
    return s;
  }

  /** Debounced auto-save — coalesces rapid changes into one write */
  save(): void {
    this._dirty = true;
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._flush();
    }, 400);
  }

  private async _flush(): Promise<void> {
    if (!this._dirty) return;
    this._dirty = false;
    try {
      await window.toolbox.saveData(this._state);
    } catch (err) {
      console.error('Store._flush failed:', err);
    }
  }

  /** Force immediate save (e.g. before window close) */
  async forceSave(): Promise<void> {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    await this._flush();
  }

  // ── Raw state access (read-only snapshot) ─────────────────────

  get state(): Readonly<AppState> {
    return this._state;
  }

  // ── Campaign helpers ──────────────────────────────────────────

  get campaigns(): Campaign[] {
    return this._state.campaigns;
  }

  getCampaignData(id: string): CampaignData {
    if (!this._state.campaignData[id]) {
      this._state.campaignData[id] = defaultCampaignData();
    }
    return this._state.campaignData[id];
  }

  get activeCampaignId(): string {
    return this._state.ui.activeCampaign;
  }

  get activeCampaignData(): CampaignData | null {
    const id = this.activeCampaignId;
    return id ? this.getCampaignData(id) : null;
  }

  addCampaign(campaign: Campaign): void {
    if (this._state.campaigns.find(c => c.id === campaign.id)) return;
    this._state.campaigns.push(campaign);
    this._state.campaignData[campaign.id] = defaultCampaignData();
    this.save();
  }

  setActiveCampaign(id: string): void {
    this._state.ui.activeCampaign = id;
    this._state.ui.activePlayer   = '';
    this._state.ui.activeHouse    = '';
    this.save();
  }

  // ── Player helpers ────────────────────────────────────────────

  get activePlayerId(): string {
    return this._state.ui.activePlayer;
  }

  getPlayerData(campaignId: string, playerId: string): PlayerData | null {
    return this.getCampaignData(campaignId).players[playerId] ?? null;
  }

  setActivePlayer(id: string): void {
    this._state.ui.activePlayer = id;
    this.save();
  }

  upsertPlayer(campaignId: string, playerId: string, data: PlayerData): void {
    this.getCampaignData(campaignId).players[playerId] = data;
    this.save();
  }

  /** Patch player scores so every NPC in the schema has an entry */
  patchPlayerScores(campaignId: string, playerId: string): boolean {
    const cd = this.getCampaignData(campaignId);
    const pd = cd.players[playerId];
    if (!pd) return false;
    let patched = false;
    cd.schema.npcs.forEach(n => {
      if (!(n.id in pd.scores)) { pd.scores[n.id] = 50; patched = true; }
    });
    if (patched) this.save();
    return patched;
  }

  adjustFavorScore(campaignId: string, playerId: string, npcId: string, delta: number): void {
    const pd = this.getCampaignData(campaignId).players[playerId];
    if (!pd) return;
    const current = pd.scores[npcId] ?? 50;
    pd.scores[npcId] = Math.max(0, Math.min(100, current + delta));
    this.save();
  }

  // ── Schema helpers ────────────────────────────────────────────

  getSchema(campaignId: string): Schema {
    return this.getCampaignData(campaignId).schema;
  }

  addNPC(campaignId: string, npc: NPC): void {
    const cd = this.getCampaignData(campaignId);
    if (cd.schema.npcs.find(n => n.id === npc.id)) return;
    cd.schema.npcs.push(npc);
    // Patch all existing players
    Object.values(cd.players).forEach(pd => {
      if (!(npc.id in pd.scores)) pd.scores[npc.id] = 50;
    });
    this.save();
  }

  /** Move an NPC up or down within its faction group only */
  reorderNPC(campaignId: string, npcId: string, direction: -1 | 1): void {
    const cd   = this.getCampaignData(campaignId);
    const npcs = cd.schema.npcs;
    const idx  = npcs.findIndex(n => n.id === npcId);
    if (idx === -1) return;

    const faction     = npcs[idx].faction;
    // All indices in this faction group, in order
    const groupIdxs   = npcs.reduce<number[]>((acc, n, i) => {
      if (n.faction === faction) acc.push(i);
      return acc;
    }, []);

    const posInGroup  = groupIdxs.indexOf(idx);
    const targetPos   = posInGroup + direction;
    if (targetPos < 0 || targetPos >= groupIdxs.length) return;

    const targetIdx   = groupIdxs[targetPos];
    // Swap in the flat npcs array
    [npcs[idx], npcs[targetIdx]] = [npcs[targetIdx], npcs[idx]];
    this.save();
  }

  // ── House / Family Tree helpers ───────────────────────────────

  get activeHouseId(): string {
    return this._state.ui.activeHouse;
  }

  setActiveHouse(id: string): void {
    this._state.ui.activeHouse = id;
    this.save();
  }

  upsertHouse(campaignId: string, houseId: string, data: HouseData): void {
    this.getCampaignData(campaignId).houses[houseId] = data;
    this.save();
  }

  getHouse(campaignId: string, houseId: string): HouseData | null {
    return this.getCampaignData(campaignId).houses[houseId] ?? null;
  }

  // ── Timeline helpers ──────────────────────────────────────────

  getTimeline(campaignId: string): TimelineData | null {
    return this.getCampaignData(campaignId).timeline;
  }

  setTimeline(campaignId: string, data: TimelineData): void {
    this.getCampaignData(campaignId).timeline = data;
    this.save();
  }

  // ── Conversation helpers ──────────────────────────────────────

  get convo(): ConvoState {
    return this._state.ui.convo;
  }

  setConvoTitle(title: string): void {
    this._state.ui.convo.title = title;
    this.save();
  }

  setConvoPCCount(n: number): void {
    this._state.ui.convo.pcCount = n;
    this.save();
  }

  setConvoPCName(index: number, name: string): void {
    if (this._state.ui.convo.pcs[index]) {
      this._state.ui.convo.pcs[index].name = name;
      this.save();
    }
  }

  setConvoPCScore(index: number, score: number): void {
    if (this._state.ui.convo.pcs[index]) {
      this._state.ui.convo.pcs[index].score = Math.max(1, Math.min(10, score));
      this.save();
    }
  }

  resetConvo(): void {
    this._state.ui.convo.pcs.forEach(pc => { pc.score = 5; });
    this.save();
  }

  // ── UI helpers ────────────────────────────────────────────────

  get activeTab(): TabId {
    return this._state.ui.activeTab;
  }

  setActiveTab(tab: TabId): void {
    this._state.ui.activeTab = tab;
    this.save();
  }

  // ── Tracker helpers ───────────────────────────────────────────

  getTracker(campaignId: string): TrackerData {
    const cd = this.getCampaignData(campaignId);
    if (!cd.tracker) cd.tracker = { entries: [] };
    return cd.tracker;
  }

  upsertTrackerEntry(campaignId: string, entry: TrackerEntry): void {
    const tracker = this.getTracker(campaignId);
    const idx     = tracker.entries.findIndex(e => e.id === entry.id);
    if (idx >= 0) {
      tracker.entries[idx] = entry;
    } else {
      tracker.entries.push(entry);
    }
    this.save();
  }

  adjustTrackerValue(campaignId: string, entryId: string, delta: number): void {
    const tracker = this.getTracker(campaignId);
    const entry   = tracker.entries.find(e => e.id === entryId);
    if (!entry) return;
    entry.current = Math.max(entry.min, Math.min(entry.max, entry.current + delta));
    this.save();
  }

  deleteTrackerEntry(campaignId: string, entryId: string): void {
    const tracker   = this.getTracker(campaignId);
    tracker.entries = tracker.entries.filter(e => e.id !== entryId);
    this.save();
  }

  reorderTrackerEntry(campaignId: string, entryId: string, direction: -1 | 1): void {
    const tracker  = this.getTracker(campaignId);
    const entries  = tracker.entries;
    const idx      = entries.findIndex(e => e.id === entryId);
    if (idx === -1) return;

    const category   = entries[idx].category;
    const groupIdxs  = entries.reduce<number[]>((acc, e, i) => {
      if (e.category === category) acc.push(i);
      return acc;
    }, []);

    const posInGroup = groupIdxs.indexOf(idx);
    const targetPos  = posInGroup + direction;
    if (targetPos < 0 || targetPos >= groupIdxs.length) return;

    const targetIdx  = groupIdxs[targetPos];
    [entries[idx], entries[targetIdx]] = [entries[targetIdx], entries[idx]];
    this.save();
  }

  // ── Party helpers ─────────────────────────────────────────────

  getParty(campaignId: string): PartyData {
    const cd = this.getCampaignData(campaignId);
    if (!cd.party) cd.party = { pcs: [] };
    return cd.party;
  }

  addPC(campaignId: string, pc: PCCard): void {
    this.getParty(campaignId).pcs.push(pc);
    this.save();
  }

  updatePC(campaignId: string, pc: PCCard): void {
    const party = this.getParty(campaignId);
    const idx   = party.pcs.findIndex(p => p.id === pc.id);
    if (idx >= 0) party.pcs[idx] = pc;
    this.save();
  }

  deletePC(campaignId: string, pcId: string): void {
    const party   = this.getParty(campaignId);
    party.pcs     = party.pcs.filter(p => p.id !== pcId);
    this.save();
  }

  // ── Import / Export ───────────────────────────────────────────

  /** Full state replace — used by backup restore */
  replaceState(incoming: AppState): void {
    this._state = this._migrate(incoming);
    this.save();
  }

  /** Merge imported campaigns into existing state without wiping */
  mergeImport(incoming: AppState): void {
    incoming.campaigns.forEach(c => {
      if (!this._state.campaigns.find(x => x.id === c.id)) {
        this._state.campaigns.push(c);
      }
    });
    Object.assign(this._state.campaignData, incoming.campaignData);
    this.save();
  }

  toJSON(): string {
    return JSON.stringify(this._state, null, 2);
  }
}

// Singleton export
export const store = new Store();
