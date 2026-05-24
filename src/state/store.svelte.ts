import type {
  AppState,
  Campaign,
  CampaignData,
  ConvoPC,
  ConvoState,
  FactionRank,
  FavorSettings,
  FavorTier,
  FactionsData,
  HouseData,
  HouseMember,
  NPC,
  PlayerData,
  Schema,
  TabId,
  ThemeSettings,
  TimelineData,
  UIState,
  TrackerData,
  TrackerEntry,
  PartyData,
  PCCard,
} from "@/types/index";
import { DEFAULT_THEME } from "@/utils/theme";

// ═══════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONVO_PCS: ConvoPC[] = Array.from({ length: 6 }, (_, i) => ({
  name: `PC ${i + 1}`,
  score: 5,
}));

const DEFAULT_CONVO: ConvoState = {
  title: "Generic Conversation",
  pcCount: 4,
  pcs: DEFAULT_CONVO_PCS,
};

const DEFAULT_UI: UIState = {
  activeCampaign: "",
  activePlayer: "",
  activeHouse: "",
  activeTab: "favor",
  convo: DEFAULT_CONVO,
};

export const DEFAULT_FAVOR_TIERS: FavorTier[] = [
  { id: "hostile", label: "Hostile", threshold: 0, color: "#b84040" },
  { id: "wary", label: "Wary", threshold: 20, color: "#c08840" },
  { id: "neutral", label: "Neutral", threshold: 40, color: "#7a7060" },
  { id: "friendly", label: "Friendly", threshold: 60, color: "#4a8c60" },
  { id: "allied", label: "Allied", threshold: 80, color: "#4a70b0" },
];

export const DEFAULT_FAVOR_SETTINGS: FavorSettings = {
  tiers: DEFAULT_FAVOR_TIERS,
  increment: 5,
};

function defaultFavorSettings(): FavorSettings {
  return {
    tiers: DEFAULT_FAVOR_TIERS.map((t) => ({ ...t })),
    increment: 5,
  };
}

function defaultCampaignData(): CampaignData {
  return {
    schema: { npcs: [] },
    players: {},
    houses: {},
    timeline: null,
    tracker: { entries: [] },
    party: { pcs: [] },
    factions: { factions: [] },
    favor: defaultFavorSettings(),
  };
}

function defaultState(): AppState {
  return {
    version: 1,
    campaigns: [],
    campaignData: {},
    ui: {
      ...DEFAULT_UI,
      convo: { ...DEFAULT_CONVO, pcs: [...DEFAULT_CONVO_PCS] },
    },
    theme: { ...DEFAULT_THEME },
  };
}

// ═══════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════

class Store {
  private _state = $state<AppState>(defaultState());
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
      console.error("Store.load failed:", err);
      return false;
    }
  }

  /** Run any version migrations needed on loaded data */
  private _migrate(raw: AppState): AppState {
    const s = { ...defaultState(), ...raw };
    // Ensure theme keys added in later versions are present with defaults
    s.theme = { ...DEFAULT_THEME, ...raw.theme };
    // Ensure every campaign has a full data bucket
    s.campaigns.forEach((c) => {
      if (!s.campaignData[c.id]) {
        s.campaignData[c.id] = defaultCampaignData();
      }
      // Lazy-init factions for older saves that predate this field
      if (!s.campaignData[c.id].factions) {
        s.campaignData[c.id].factions = { factions: [] };
      }
      // Lazy-init npcRanks on any FactionConfig that predates the field
      s.campaignData[c.id].factions.factions.forEach((fc) => {
        if (!fc.npcRanks) fc.npcRanks = {};
      });
      // Lazy-init favor settings for saves that predate this field
      if (!s.campaignData[c.id].favor) {
        s.campaignData[c.id].favor = defaultFavorSettings();
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
      // $state.snapshot() converts the reactive proxy to a plain object
      // so Electron's IPC structured-clone serialization works correctly
      await window.toolbox.saveData($state.snapshot(this._state));
    } catch (err) {
      console.error("Store._flush failed:", err);
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
    if (this._state.campaigns.find((c) => c.id === campaign.id)) return;
    this._state.campaigns.push(campaign);
    this._state.campaignData[campaign.id] = defaultCampaignData();
    this.save();
  }

  setActiveCampaign(id: string): void {
    this._state.ui.activeCampaign = id;
    this._state.ui.activePlayer = "";
    this._state.ui.activeHouse = "";
    this.save();
  }

  renameCampaign(id: string, label: string): void {
    const campaign = this._state.campaigns.find((c) => c.id === id);
    if (!campaign) return;
    campaign.label = label;
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
    cd.schema.npcs.forEach((n) => {
      if (!(n.id in pd.scores)) {
        pd.scores[n.id] = 50;
        patched = true;
      }
    });
    if (patched) this.save();
    return patched;
  }

  adjustFavorScore(
    campaignId: string,
    playerId: string,
    npcId: string,
    delta: number,
  ): void {
    const pd = this.getCampaignData(campaignId).players[playerId];
    if (!pd) return;
    const current = pd.scores[npcId] ?? 50;
    pd.scores[npcId] = Math.max(0, Math.min(100, current + delta));
    this.save();
  }

  // ── Favor settings helpers ────────────────────────────────────

  getFavorSettings(campaignId: string): FavorSettings {
    return this.getCampaignData(campaignId).favor ?? defaultFavorSettings();
  }

  setFavorIncrement(campaignId: string, step: 1 | 5 | 10 | 25): void {
    const cd = this.getCampaignData(campaignId);
    if (!cd.favor) cd.favor = defaultFavorSettings();
    cd.favor.increment = step;
    this.save();
  }

  addFavorTier(campaignId: string, partial: Omit<FavorTier, "id">): void {
    const cd = this.getCampaignData(campaignId);
    if (!cd.favor) cd.favor = defaultFavorSettings();
    const id = `tier_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    cd.favor.tiers.push({ id, ...partial });
    cd.favor.tiers.sort((a, b) => a.threshold - b.threshold);
    this.save();
  }

  updateFavorTier(
    campaignId: string,
    tierId: string,
    patch: Partial<Omit<FavorTier, "id">>,
  ): void {
    const cd = this.getCampaignData(campaignId);
    if (!cd.favor) cd.favor = defaultFavorSettings();
    const tier = cd.favor.tiers.find((t) => t.id === tierId);
    if (!tier) return;
    if (patch.label !== undefined) tier.label = patch.label;
    if (patch.threshold !== undefined) tier.threshold = patch.threshold;
    if (patch.color !== undefined) tier.color = patch.color;
    cd.favor.tiers.sort((a, b) => a.threshold - b.threshold);
    this.save();
  }

  deleteFavorTier(campaignId: string, tierId: string): void {
    const cd = this.getCampaignData(campaignId);
    if (!cd.favor) return;
    if (cd.favor.tiers.length <= 1) return; // must keep at least one
    cd.favor.tiers = cd.favor.tiers.filter((t) => t.id !== tierId);
    this.save();
  }

  // ── Schema helpers ────────────────────────────────────────────

  getSchema(campaignId: string): Schema {
    return this.getCampaignData(campaignId).schema;
  }

  addNPC(campaignId: string, npc: NPC): void {
    const cd = this.getCampaignData(campaignId);
    if (cd.schema.npcs.find((n) => n.id === npc.id)) return;
    // Auto-create a faction header if this faction doesn't have one yet
    if (
      !npc.isFactionHeader &&
      !cd.schema.npcs.some(
        (n) => n.isFactionHeader && n.faction === npc.faction,
      )
    ) {
      const headerId = `faction_header_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      const headerNpc: NPC = {
        id: headerId,
        name: npc.faction,
        role: "Faction",
        faction: npc.faction,
        isFactionHeader: true,
      };
      cd.schema.npcs.push(headerNpc);
      Object.values(cd.players).forEach((pd) => {
        if (!(headerId in pd.scores)) pd.scores[headerId] = 50;
      });
    }
    cd.schema.npcs.push(npc);
    // Patch all existing players
    Object.values(cd.players).forEach((pd) => {
      if (!(npc.id in pd.scores)) pd.scores[npc.id] = 50;
    });
    this.save();
  }

  deleteNPC(campaignId: string, npcId: string): void {
    const cd = this.getCampaignData(campaignId);
    cd.schema.npcs = cd.schema.npcs.filter((n) => n.id !== npcId);
    Object.values(cd.players).forEach((pd) => {
      delete pd.scores[npcId];
    });
    this.save();
  }

  updateNPCRole(campaignId: string, npcId: string, role: string): void {
    const npc = this.getCampaignData(campaignId).schema.npcs.find(
      (n) => n.id === npcId,
    );
    if (!npc) return;
    npc.role = role;
    this.save();
  }

  /** Move an NPC up or down within its faction group only */
  reorderNPC(campaignId: string, npcId: string, direction: -1 | 1): void {
    const cd = this.getCampaignData(campaignId);
    const npcs = cd.schema.npcs;
    const idx = npcs.findIndex((n) => n.id === npcId);
    if (idx === -1) return;

    const faction = npcs[idx].faction;
    // All indices in this faction group, in order
    const groupIdxs = npcs.reduce<number[]>((acc, n, i) => {
      if (n.faction === faction) acc.push(i);
      return acc;
    }, []);

    const posInGroup = groupIdxs.indexOf(idx);
    const targetPos = posInGroup + direction;
    if (targetPos < 0 || targetPos >= groupIdxs.length) return;

    const targetIdx = groupIdxs[targetPos];
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

  deleteHouse(campaignId: string, houseId: string): void {
    const cd = this.getCampaignData(campaignId);
    delete cd.houses[houseId];
    if (this._state.ui.activeHouse === houseId) {
      this._state.ui.activeHouse = Object.keys(cd.houses)[0] ?? "";
    }
    this.save();
  }

  /** Reload just the houses for one campaign from disk (called after tree editor saves). */
  async refreshHouses(campaignId: string): Promise<void> {
    const ctx = await window.toolbox.getTreeContext(campaignId);
    if (!ctx) return;
    const cd = this.getCampaignData(campaignId);
    cd.houses = ctx.houses;
    // No save() — we just synced from disk; saving would race with the editor
  }

  addMember(campaignId: string, houseId: string, member: HouseMember): void {
    const house = this.getCampaignData(campaignId).houses[houseId];
    if (!house) return;
    house.members.push(member);
    this.save();
  }

  updateMember(
    campaignId: string,
    houseId: string,
    memberId: string,
    updates: Partial<HouseMember>,
  ): void {
    const house = this.getCampaignData(campaignId).houses[houseId];
    if (!house) return;
    const idx = house.members.findIndex((m) => m.id === memberId);
    if (idx === -1) return;
    house.members[idx] = { ...house.members[idx], ...updates };
    this.save();
  }

  deleteMember(campaignId: string, houseId: string, memberId: string): void {
    const house = this.getCampaignData(campaignId).houses[houseId];
    if (!house) return;
    house.members = house.members.filter((m) => m.id !== memberId);
    this.save();
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
    this._state.ui.convo.pcs.forEach((pc) => {
      pc.score = 5;
    });
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

  // ── Theme helpers ─────────────────────────────────────────────

  get theme(): ThemeSettings {
    return this._state.theme;
  }

  updateTheme(patch: Partial<ThemeSettings>): void {
    this._state.theme = { ...this._state.theme, ...patch };
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
    const idx = tracker.entries.findIndex((e) => e.id === entry.id);
    if (idx >= 0) {
      tracker.entries[idx] = entry;
    } else {
      tracker.entries.push(entry);
    }
    this.save();
  }

  adjustTrackerValue(campaignId: string, entryId: string, delta: number): void {
    const tracker = this.getTracker(campaignId);
    const entry = tracker.entries.find((e) => e.id === entryId);
    if (!entry) return;
    entry.current = Math.max(
      entry.min,
      Math.min(entry.max, entry.current + delta),
    );
    this.save();
  }

  deleteTrackerEntry(campaignId: string, entryId: string): void {
    const tracker = this.getTracker(campaignId);
    tracker.entries = tracker.entries.filter((e) => e.id !== entryId);
    this.save();
  }

  reorderTrackerEntry(
    campaignId: string,
    entryId: string,
    direction: -1 | 1,
  ): void {
    const tracker = this.getTracker(campaignId);
    const entries = tracker.entries;
    const idx = entries.findIndex((e) => e.id === entryId);
    if (idx === -1) return;

    const category = entries[idx].category;
    const groupIdxs = entries.reduce<number[]>((acc, e, i) => {
      if (e.category === category) acc.push(i);
      return acc;
    }, []);

    const posInGroup = groupIdxs.indexOf(idx);
    const targetPos = posInGroup + direction;
    if (targetPos < 0 || targetPos >= groupIdxs.length) return;

    const targetIdx = groupIdxs[targetPos];
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
    // Auto-initialise the favor tracker entry keyed by the PC's GUID
    const cd = this.getCampaignData(campaignId);
    if (!cd.players[pc.id]) {
      cd.players[pc.id] = { player: pc.name, scores: {} };
      cd.schema.npcs.forEach((n) => {
        cd.players[pc.id].scores[n.id] = 50;
      });
    }
    this.save();
  }

  removeFavorPlayer(campaignId: string, pcId: string): void {
    const cd = this.getCampaignData(campaignId);
    delete cd.players[pcId];
    this.save();
  }

  syncConvoPCsFromParty(campaignId: string): void {
    const pcs = this.getParty(campaignId).pcs.slice(0, 6);
    pcs.forEach((pc, i) => {
      this._state.ui.convo.pcs[i].name = pc.name;
    });
    this._state.ui.convo.pcCount = Math.max(1, pcs.length);
    this.save();
  }

  updatePC(campaignId: string, pc: PCCard): void {
    const party = this.getParty(campaignId);
    const idx = party.pcs.findIndex((p) => p.id === pc.id);
    if (idx >= 0) party.pcs[idx] = pc;
    this.save();
  }

  deletePC(campaignId: string, pcId: string): void {
    const party = this.getParty(campaignId);
    party.pcs = party.pcs.filter((p) => p.id !== pcId);
    this.save();
  }

  // ── Factions helpers ─────────────────────────────────────────────

  getFactions(campaignId: string): FactionsData {
    const cd = this.getCampaignData(campaignId);
    if (!cd.factions) cd.factions = { factions: [] };
    return cd.factions;
  }

  addFactionConfig(campaignId: string, factionNpcId: string): void {
    const fd = this.getFactions(campaignId);
    if (fd.factions.find((fc) => fc.factionNpcId === factionNpcId)) return;
    const id = `fc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    fd.factions.push({
      id,
      factionNpcId,
      ranks: [],
      members: [],
      npcRanks: {},
    });
    this.save();
  }

  removeFactionConfig(campaignId: string, factionId: string): void {
    const fd = this.getFactions(campaignId);
    fd.factions = fd.factions.filter((fc) => fc.id !== factionId);
    this.save();
  }

  moveFactionConfig(
    campaignId: string,
    factionId: string,
    direction: "up" | "down",
  ): void {
    const fd = this.getFactions(campaignId);
    const idx = fd.factions.findIndex((fc) => fc.id === factionId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= fd.factions.length) return;
    [fd.factions[idx], fd.factions[swapIdx]] = [
      fd.factions[swapIdx],
      fd.factions[idx],
    ];
    this.save();
  }

  setFactionRanks(
    campaignId: string,
    factionId: string,
    ranks: FactionRank[],
  ): void {
    const fc = this.getFactions(campaignId).factions.find(
      (f) => f.id === factionId,
    );
    if (!fc) return;
    const validIds = new Set(ranks.map((r) => r.id));
    // Reset any PC member whose rankId no longer exists
    fc.members.forEach((m) => {
      if (m.rankId && !validIds.has(m.rankId)) m.rankId = "";
    });
    // Remove any NPC rank entries whose rankId no longer exists
    if (fc.npcRanks) {
      for (const npcId of Object.keys(fc.npcRanks)) {
        if (!validIds.has(fc.npcRanks[npcId])) delete fc.npcRanks[npcId];
      }
    }
    fc.ranks = ranks;
    this.save();
  }

  addFactionMember(
    campaignId: string,
    factionId: string,
    pcId: string,
    rankId: string,
  ): void {
    const fc = this.getFactions(campaignId).factions.find(
      (f) => f.id === factionId,
    );
    if (!fc) return;
    if (fc.members.find((m) => m.pcId === pcId)) return;
    fc.members.push({ pcId, rankId });
    this.save();
  }

  setMemberRank(
    campaignId: string,
    factionId: string,
    pcId: string,
    rankId: string,
  ): void {
    const fc = this.getFactions(campaignId).factions.find(
      (f) => f.id === factionId,
    );
    if (!fc) return;
    const member = fc.members.find((m) => m.pcId === pcId);
    if (!member) return;
    member.rankId = rankId;
    this.save();
  }

  removeFactionMember(
    campaignId: string,
    factionId: string,
    pcId: string,
  ): void {
    const fc = this.getFactions(campaignId).factions.find(
      (f) => f.id === factionId,
    );
    if (!fc) return;
    fc.members = fc.members.filter((m) => m.pcId !== pcId);
    this.save();
  }

  setNPCRank(
    campaignId: string,
    factionId: string,
    npcId: string,
    rankId: string,
  ): void {
    const fc = this.getFactions(campaignId).factions.find(
      (f) => f.id === factionId,
    );
    if (!fc) return;
    if (!fc.npcRanks) fc.npcRanks = {};
    if (rankId) {
      fc.npcRanks[npcId] = rankId;
    } else {
      delete fc.npcRanks[npcId];
    }
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
    incoming.campaigns.forEach((c) => {
      if (!this._state.campaigns.find((x) => x.id === c.id)) {
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
