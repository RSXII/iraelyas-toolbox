import type {
  AppState,
  AiModel,
  Campaign,
  CampaignData,
  ConvoPC,
  ConvoState,
  FactionRank,
  FavorSettings,
  FavorTier,
  GroupId,
  TokenUsage,
  FactionsData,
  HouseData,
  HouseMember,
  MonsterStatBlock,
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
  InitiativeState,
  SessionEntry,
  SessionReminder,
  SessionTrackerData,
  SessionEntryData,
} from "@/types/index";
import { DEFAULT_THEME } from "@/utils/theme";

interface SessionReminderCandidate {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  anchorSession: number;
  direction: "countup" | "countdown";
  distance: number;
  triggerMode: "once" | "repeat";
  message: string;
}

type SessionReminderProvider = (
  campaignId: string,
  currentSession: number,
) => SessionReminderCandidate[];

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
  activeGroup: "world",
  lastTabPerGroup: {},
  customGroupName: "My View",
  customGroupTabs: [],
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
    sessions: {
      currentNumber: 1,
      currentNote: "",
      currentData: {},
      entries: [],
    },
    party: { pcs: [] },
    factions: { factions: [] },
    favor: defaultFavorSettings(),
    initiative: null,
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
    enemies: [],
    aiModel: "claude-haiku-4-5",
    hideAiFeatures: false,
    tokenUsage: {
      lifetimeInput: 0,
      lifetimeOutput: 0,
      lastInput: 0,
      lastOutput: 0,
      generationCount: 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// GROUP NAV HELPERS
// ═══════════════════════════════════════════════════════════════

const GROUP_TABS_MAP: Record<
  "session" | "game" | "world" | "toolbox",
  TabId[]
> = {
  session: ["sessions"],
  game: ["initiative", "dice", "convo", "party"],
  world: ["favor", "npcs", "factions", "chronicle", "tree"],
  toolbox: ["enemies", "tracker"],
};

function inferGroupFromTab(tab: TabId): GroupId {
  for (const [group, tabs] of Object.entries(GROUP_TABS_MAP) as Array<
    ["session" | "game" | "world" | "toolbox", TabId[]]
  >) {
    if (tabs.includes(tab)) return group;
  }
  return "session";
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
        if (!fc.renown) fc.renown = {};
      });
      // Migrate faction-header NPCs → FactionConfig.name + FactionConfig.renown
      this._migrateFactionHeaders(s.campaignData[c.id]);
      // Lazy-init favor settings for saves that predate this field
      if (!s.campaignData[c.id].favor) {
        s.campaignData[c.id].favor = defaultFavorSettings();
      }
      // Lazy-init sessions for saves that predate this field
      if (!s.campaignData[c.id].sessions) {
        s.campaignData[c.id].sessions = {
          currentNumber: 1,
          currentNote: "",
          currentData: {},
          entries: [],
        };
      }
      // Lazy-init initiative for saves that predate this field
      if (!("initiative" in s.campaignData[c.id])) {
        s.campaignData[c.id].initiative = null;
      }
    });
    // Ensure convo pcs array always has 6 entries
    while (s.ui.convo.pcs.length < 6) {
      const i = s.ui.convo.pcs.length;
      s.ui.convo.pcs.push({ name: `PC ${i + 1}`, score: 5 });
    }
    // Lazy-init global enemy library for saves that predate this field
    if (!s.enemies) s.enemies = [];
    // Lazy-init aiModel preference for saves that predate this field
    if (!s.aiModel) s.aiModel = "claude-haiku-4-5";
    // Lazy-init hideAiFeatures flag for saves that predate this field
    if (s.hideAiFeatures === undefined) s.hideAiFeatures = false;
    // Lazy-init token usage counter for saves that predate this field
    if (!s.tokenUsage)
      s.tokenUsage = {
        lifetimeInput: 0,
        lifetimeOutput: 0,
        lastInput: 0,
        lastOutput: 0,
        generationCount: 0,
      };
    // Lazy-init two-level nav fields for saves that predate this feature
    if (!s.ui.activeGroup) s.ui.activeGroup = inferGroupFromTab(s.ui.activeTab);
    if (!s.ui.lastTabPerGroup) s.ui.lastTabPerGroup = {};
    if (!s.ui.customGroupName) s.ui.customGroupName = "My View";
    if (!s.ui.customGroupTabs) s.ui.customGroupTabs = [];
    return s;
  }

  /**
   * One-time migration: converts faction-header NPCs into first-class
   * FactionConfig entries (name + renown), then removes the header NPCs.
   * Safe to call on already-migrated data — skips FactionConfigs that
   * already have a name set.
   */
  private _migrateFactionHeaders(
    cd: import("@/types/index").CampaignData,
  ): void {
    const npcs = cd.schema.npcs;
    const players = cd.players;
    const factions = cd.factions.factions;

    for (const fc of factions) {
      // Already migrated — has a name
      if (fc.name) continue;
      // Legacy entry with no factionNpcId either — give it a placeholder name
      if (!fc.factionNpcId) {
        fc.name = "Unknown Faction";
        continue;
      }

      const headerNpc = npcs.find((n) => n.id === fc.factionNpcId);
      if (!headerNpc) {
        fc.name = fc.factionNpcId;
        fc.factionNpcId = undefined;
        continue;
      }

      // Populate name from the header NPC
      fc.name = headerNpc.name;

      // Lift renown scores from player score maps
      if (!fc.renown) fc.renown = {};
      Object.entries(players).forEach(([playerId, pd]) => {
        if (fc.factionNpcId && fc.factionNpcId in pd.scores) {
          fc.renown[playerId] = pd.scores[fc.factionNpcId];
          delete pd.scores[fc.factionNpcId];
        }
      });

      // Assign factionId to every NPC in this faction
      const headerFactionLabel = headerNpc.faction;
      npcs.forEach((n) => {
        if (
          !n.isFactionHeader &&
          n.faction === headerFactionLabel &&
          !n.factionId
        ) {
          n.factionId = fc.id;
        }
      });

      // Drop the header NPC itself
      const headerIdx = npcs.findIndex((n) => n.id === fc.factionNpcId);
      if (headerIdx !== -1) npcs.splice(headerIdx, 1);

      // Clear the deprecated reference
      fc.factionNpcId = undefined;
    }

    // Also wire up any NPCs that reference a faction name matching a FactionConfig
    // but weren't covered above (e.g. created before FactionConfig existed)
    npcs.forEach((n) => {
      if (n.isFactionHeader || n.factionId) return;
      const match = factions.find((fc) => fc.name === n.faction);
      if (match) n.factionId = match.id;
    });
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
    // If factionId is provided, sync the faction display name from FactionConfig
    if (npc.factionId) {
      const fc = cd.factions?.factions.find((f) => f.id === npc.factionId);
      if (fc) npc.faction = fc.name;
    }
    cd.schema.npcs.push(npc);
    // Patch all existing players with a default favor score
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

  updateNPC(
    campaignId: string,
    npcId: string,
    patch: Partial<Omit<NPC, "id">>,
  ): void {
    const npc = this.getCampaignData(campaignId).schema.npcs.find(
      (n) => n.id === npcId,
    );
    if (!npc) return;
    Object.assign(npc, patch);
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

  get activeGroup(): GroupId {
    return this._state.ui.activeGroup ?? "world";
  }

  setActiveGroup(group: GroupId): void {
    this._state.ui.activeGroup = group;
    this.save();
  }

  get lastTabPerGroup(): Partial<Record<GroupId, TabId>> {
    return this._state.ui.lastTabPerGroup ?? {};
  }

  setLastTabForGroup(group: GroupId, tab: TabId): void {
    if (!this._state.ui.lastTabPerGroup) this._state.ui.lastTabPerGroup = {};
    this._state.ui.lastTabPerGroup[group] = tab;
    this.save();
  }

  get customGroupName(): string {
    return this._state.ui.customGroupName || "My View";
  }

  setCustomGroupName(name: string): void {
    this._state.ui.customGroupName = name;
    this.save();
  }

  get customGroupTabs(): TabId[] {
    return this._state.ui.customGroupTabs ?? [];
  }

  setCustomGroupTabs(tabs: TabId[]): void {
    this._state.ui.customGroupTabs = tabs;
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

  // ── Initiative helpers ────────────────────────────────────────────

  getInitiative(campaignId: string): InitiativeState | null {
    return this.getCampaignData(campaignId).initiative ?? null;
  }

  setInitiative(campaignId: string, state: InitiativeState): void {
    this.getCampaignData(campaignId).initiative = state;
    this.save();
  }

  clearInitiative(campaignId: string): void {
    this.getCampaignData(campaignId).initiative = null;
    this.save();
  }

  // ── Session helpers ─────────────────────────────────────────────

  private getSessionReminderProviders(): SessionReminderProvider[] {
    return [this.trackerSessionReminderProvider.bind(this)];
  }

  private collectSessionReminderCandidates(
    campaignId: string,
    currentSession: number,
  ): SessionReminderCandidate[] {
    const providers = this.getSessionReminderProviders();
    return providers.flatMap((provider) =>
      provider(campaignId, currentSession),
    );
  }

  private trackerSessionReminderProvider(
    campaignId: string,
    _currentSession: number,
  ): SessionReminderCandidate[] {
    const candidates: SessionReminderCandidate[] = [];

    for (const entry of this.getTracker(campaignId).entries) {
      const link = entry.sessionLink;
      if (!link?.enabled) continue;

      const anchorSession = Math.max(1, Math.floor(link.anchorSession || 1));
      const distance = Math.max(1, Math.floor(link.distance || 1));
      const direction = link.direction;

      const message =
        link.reminderText?.trim() ||
        `${entry.name}: ${distance} session${distance === 1 ? "" : "s"} ${direction === "countup" ? "after" : "before"} session ${anchorSession}.`;

      candidates.push({
        sourceType: "tracker",
        sourceId: entry.id,
        sourceName: entry.name,
        anchorSession,
        direction,
        distance,
        triggerMode: link.triggerMode,
        message,
      });
    }

    return candidates;
  }

  getSessions(campaignId: string): SessionTrackerData {
    const cd = this.getCampaignData(campaignId);
    if (!cd.sessions) {
      cd.sessions = {
        currentNumber: 1,
        currentNote: "",
        currentData: {},
        entries: [],
      };
    }
    return cd.sessions;
  }

  setCurrentSessionNumber(campaignId: string, number: number): void {
    const sessions = this.getSessions(campaignId);
    sessions.currentNumber = Math.max(1, Math.floor(number || 1));
    this.save();
  }

  setCurrentSessionNote(campaignId: string, note: string): void {
    this.getSessions(campaignId).currentNote = note;
    this.save();
  }

  updateSessionEntryNote(
    campaignId: string,
    entryId: string,
    note: string,
  ): void {
    const sessions = this.getSessions(campaignId);
    const entry = sessions.entries.find((e) => e.id === entryId);
    if (entry) {
      entry.note = note;
      this.save();
    }
  }

  deleteSessionEntry(campaignId: string, entryId: string): void {
    const sessions = this.getSessions(campaignId);
    sessions.entries = sessions.entries.filter((e) => e.id !== entryId);
    this.save();
  }

  /** Resets currentData and runs reminder calculations without committing. Call at session start. */
  prepareSessionReminders(campaignId: string): void {
    const sessions = this.getSessions(campaignId);
    sessions.currentData = {};
    this.runSessionCalculations(campaignId);
  }

  startSession(campaignId: string, activeNotes?: string[]): void {
    const sessions = this.getSessions(campaignId);

    // Rebuild per-session derived data (e.g. reminders) just before snapshot.
    sessions.currentData = {};
    this.runSessionCalculations(campaignId);

    const extraData: Record<string, unknown> = {};
    if (activeNotes && activeNotes.length > 0) {
      extraData.activeNotes = activeNotes;
    }

    const snapshot: SessionEntry = {
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      number: sessions.currentNumber,
      note: sessions.currentNote,
      timestamp: Date.now(),
      data: { ...sessions.currentData, ...extraData },
    };

    sessions.entries.push(snapshot);
    sessions.currentNumber += 1;
    sessions.currentNote = "";
    sessions.currentData = {};
    this.save();
  }

  runSessionCalculations(campaignId: string): void {
    const sessions = this.getSessions(campaignId);
    const currentSession = sessions.currentNumber;
    const reminders: SessionReminder[] = [];

    for (const candidate of this.collectSessionReminderCandidates(
      campaignId,
      currentSession,
    )) {
      const {
        sourceType,
        sourceId,
        sourceName,
        anchorSession,
        direction,
        distance,
        triggerMode,
        message,
      } = candidate;

      const delta =
        direction === "countup"
          ? currentSession - anchorSession
          : anchorSession - currentSession;

      if (delta < distance) continue;

      const reminderId = `${sourceType}:${sourceId}:${anchorSession}:${direction}:${distance}`;

      if (triggerMode === "once") {
        const alreadyTriggered = sessions.entries.some((sessionEntry) => {
          const existing = sessionEntry.data?.reminders;
          if (!Array.isArray(existing)) return false;
          return (existing as SessionReminder[]).some(
            (r) => r.id === reminderId,
          );
        });
        if (alreadyTriggered) continue;
      }

      reminders.push({
        id:
          triggerMode === "repeat"
            ? `${reminderId}:s${currentSession}`
            : reminderId,
        sourceType,
        sourceId,
        sourceName,
        message,
        anchorSession,
        direction,
        distance,
        triggeredAtSession: currentSession,
      });
    }

    const nextData: SessionEntryData = { ...sessions.currentData };
    if (reminders.length) {
      nextData.reminders = reminders;
    } else {
      delete nextData.reminders;
    }
    sessions.currentData = nextData;
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
      name: factionNpcId, // fallback; caller should migrate this
      factionNpcId,
      renown: {},
      ranks: [],
      members: [],
      npcRanks: {},
    });
    this.save();
  }

  /** Create a faction directly by name — no NPC required. */
  addFaction(campaignId: string, name: string): void {
    const fd = this.getFactions(campaignId);
    const trimmed = name.trim();
    if (!trimmed) return;
    if (
      fd.factions.find((fc) => fc.name.toLowerCase() === trimmed.toLowerCase())
    )
      return;
    const id = `fc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    fd.factions.push({
      id,
      name: trimmed,
      renown: {},
      ranks: [],
      members: [],
      npcRanks: {},
    });
    this.save();
  }

  /** Adjust the faction renown score for a specific player. */
  adjustFactionRenown(
    campaignId: string,
    factionId: string,
    playerId: string,
    delta: number,
  ): void {
    const fd = this.getFactions(campaignId);
    const fc = fd.factions.find((f) => f.id === factionId);
    if (!fc) return;
    if (!fc.renown) fc.renown = {};
    const current = fc.renown[playerId] ?? 50;
    fc.renown[playerId] = Math.max(0, Math.min(100, current + delta));
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

  patchFaction(
    campaignId: string,
    factionId: string,
    patch: { name?: string; leader?: string; insignia?: string },
  ): void {
    const fc = this.getFactions(campaignId).factions.find(
      (f) => f.id === factionId,
    );
    if (!fc) return;
    if ('name' in patch) fc.name = patch.name!;
    if ('leader' in patch) fc.leader = patch.leader;
    if ('insignia' in patch) fc.insignia = patch.insignia;
    this.save();
  }

  // ── Enemy library helpers ─────────────────────────────────────

  get enemies(): MonsterStatBlock[] {
    return this._state.enemies;
  }

  addEnemy(enemy: MonsterStatBlock): void {
    this._state.enemies.push(enemy);
    this.save();
  }

  updateEnemy(enemy: MonsterStatBlock): void {
    const idx = this._state.enemies.findIndex((e) => e.id === enemy.id);
    if (idx >= 0) this._state.enemies[idx] = enemy;
    this.save();
  }

  deleteEnemy(id: string): void {
    this._state.enemies = this._state.enemies.filter((e) => e.id !== id);
    this.save();
  }

  // ── AI model helpers ──────────────────────────────────────────

  get aiModel(): AiModel {
    return this._state.aiModel;
  }

  setAiModel(model: AiModel): void {
    this._state.aiModel = model;
    this.save();
  }

  // ── Hide AI features toggle ─────────────────────────────────

  get hideAiFeatures(): boolean {
    return this._state.hideAiFeatures;
  }

  setHideAiFeatures(value: boolean): void {
    this._state.hideAiFeatures = value;
    this.save();
  }

  // ── Token usage helpers ───────────────────────────────────────

  get tokenUsage(): TokenUsage {
    return this._state.tokenUsage;
  }

  addTokenUsage(inputTokens: number, outputTokens: number): void {
    const t = this._state.tokenUsage;
    t.lifetimeInput += inputTokens;
    t.lifetimeOutput += outputTokens;
    t.lastInput = inputTokens;
    t.lastOutput = outputTokens;
    t.generationCount += 1;
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
