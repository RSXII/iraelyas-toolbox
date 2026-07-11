// ═══════════════════════════════════════════════════════════════
// ELECTRON BRIDGE
// ═══════════════════════════════════════════════════════════════

export interface FileResult {
  name: string;
  content: string;
}

export interface SaveResult {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

export interface ToolboxBridge {
  loadData: () => Promise<AppState | null>;
  saveData: (data: AppState) => Promise<{ ok: boolean }>;
  importFile: (filters: FileFilter[]) => Promise<FileResult[] | null>;
  exportFile: (filename: string, content: string) => Promise<SaveResult>;
  getVersion: () => Promise<string>;
  getDataPath: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
  checkForUpdate: () => Promise<{ available: boolean; latestVersion?: string }>;
  platform: "darwin" | "win32" | "linux";
  isBeta: boolean;

  // Timeline editor window
  openTimelineEditor: () => Promise<void>;
  getTimeline: (campaignId: string) => Promise<TimelineData | null>;
  saveTimeline: (
    campaignId: string,
    data: TimelineData,
  ) => Promise<{ ok: boolean; error?: string }>;
  getEditorContext: () => Promise<EditorContext | null>;
  onTimelineUpdated: (cb: () => void) => void;
  offTimelineUpdated: (cb: () => void) => void;

  // Tree editor window
  openTreeEditor: () => Promise<void>;
  getTreeContext: (campaignId: string) => Promise<TreeEditorContext | null>;
  saveHouse: (
    campaignId: string,
    houseId: string,
    data: HouseData,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteHouse: (
    campaignId: string,
    houseId: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  pickImage: () => Promise<string | null>;
  onTreeUpdated: (cb: (campaignId: string) => void) => void;
  offTreeUpdated: (cb: (campaignId: string) => void) => void;

  // Enemy library / AI generation
  setApiKey: (key: string) => Promise<{ ok: boolean; error?: string }>;
  hasApiKey: () => Promise<boolean>;
  clearApiKey: () => Promise<{ ok: boolean }>;
  generateEnemy: (
    params: GenerateEnemyParams,
    model: AiModel,
  ) => Promise<{
    ok: boolean;
    enemy?: MonsterStatBlock;
    usage?: { input_tokens: number; output_tokens: number };
    error?: string;
  }>;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface EditorContext {
  campaigns: Campaign[];
  activeCampaign: string;
}

export interface TreeEditorContext {
  campaigns: Campaign[];
  activeCampaign: string;
  houses: Record<string, HouseData>;
}

// Augment Window so TypeScript knows about the bridge
declare global {
  interface Window {
    toolbox: ToolboxBridge;
  }
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════════════════════════════

export type GameSystem = "dnd5e" | "cpr";

export interface Campaign {
  id: string;
  label: string;
  gameSystem?: GameSystem;
}

// ═══════════════════════════════════════════════════════════════
// FAVOR TRACKER
// ═══════════════════════════════════════════════════════════════

export interface FavorTier {
  id: string; // stable slug identifier
  label: string; // display name (e.g. "Hostile")
  threshold: number; // minimum score for this tier (0–99)
  color: string; // hex color, e.g. "#b84040"
}

export interface FavorSettings {
  tiers: FavorTier[];
  increment: 1 | 5 | 10 | 25;
}

export type NPCType = "scene" | "recurring" | "major";

export interface CPRSkills {
  accounting?: number;
  acting?: number;
  airVehicleTech?: number;
  animalHandling?: number;
  archery?: number;
  athletics?: number;
  autofire?: number;
  basicTech?: number;
  brawling?: number;
  bribery?: number;
  bureaucracy?: number;
  business?: number;
  composition?: number;
  concealRevealObject?: number;
  concentration?: number;
  contortionist?: number;
  conversation?: number;
  criminology?: number;
  cryptography?: number;
  cybertech?: number;
  dance?: number;
  deduction?: number;
  demolitions?: number;
  driveLandVehicle?: number;
  education?: number;
  electronicsSecurityTech?: number;
  endurance?: number;
  evasion?: number;
  firstAid?: number;
  forgery?: number;
  gamble?: number;
  handgun?: number;
  heavyWeapons?: number;
  humanPerception?: number;
  interrogation?: number;
  landVehicleTech?: number;
  language?: number;
  librarySearch?: number;
  lipReading?: number;
  localExpert?: number;
  martialArts?: number;
  meleeWeapon?: number;
  paintDrawSculpt?: number;
  paramedic?: number;
  perception?: number;
  personalGrooming?: number;
  persuasion?: number;
  photographyFilm?: number;
  pickLock?: number;
  pickPocket?: number;
  pilotAirVehicle?: number;
  pilotSeaVehicle?: number;
  playInstrument?: number;
  resistTortureDrugs?: number;
  riding?: number;
  science?: number;
  seaVehicleTech?: number;
  shoulderArms?: number;
  stealth?: number;
  streetwise?: number;
  tactics?: number;
  tracking?: number;
  trading?: number;
  wardrobeStyle?: number;
  weaponstech?: number;
  wildernesssurvival?: number;
}

export interface CPRBaseStats {
  statInt?: string;
  statRef?: string;
  statDex?: string;
  statTech?: string;
  statCool?: string;
  statWill?: string;
  statLuck?: string;
  statMove?: string;
  statBody?: string;
  statEmp?: string;
}

export interface NPC {
  id: string;
  name: string;
  role: string;
  faction: string; // display label — kept for backward compat
  factionId?: string; // references FactionConfig.id
  isFactionHeader?: boolean; // deprecated — cleaned up by migration
  // NPC Creator fields
  npcType?: NPCType;
  // Scene NPC fields
  npcFunction?: string;
  distinctDetail?: string;
  npcNeed?: string;
  // Recurring NPC fields (cumulative)
  wound?: string;
  gap?: string;
  protecting?: string;
  whatWouldBreakThem?: string;
  // Major NPC fields (cumulative)
  selfBelief?: string;
  relationshipContradictions?: string;
  // Portrait image (compressed JPEG base64 — see src/utils/npc-image.ts for size config)
  portrait?: string;
  // CPR stats (optional, CPR campaigns only)
  cprBaseStats?: CPRBaseStats;
  cprSkills?: CPRSkills;
}

export interface Schema {
  npcs: NPC[];
}

export interface PlayerData {
  player: string;
  scores: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// FAMILY TREE
// ═══════════════════════════════════════════════════════════════

export type MemberType = "bio" | "priestess" | "current" | "heir" | "unknown";
export type ColValue = number | "spine";

export interface HouseMember {
  id: string;
  label: string;
  row: number;
  col: ColValue;
  type: MemberType;
  mother: string | null;
  father: string | null;
  adoptive: string | null;
  spouse: string | null;
  img: string | null;
  note: string | null;
}

export interface SpineConfig {
  enabled: boolean;
  label?: string;
  color?: string;
  badge_current?: string;
  badge_heir?: string;
  badge_former?: string;
}

export interface TreeLayoutConfig {
  row_height?: number;
  node_w?: number;
  node_h?: number;
  col_gap?: number;
  col_start?: number;
  spine_x?: number;
}

export interface HouseData {
  house: string;
  subtitle?: string;
  spine?: SpineConfig;
  layout?: TreeLayoutConfig;
  colors?: string[];
  members: HouseMember[];
}

// ═══════════════════════════════════════════════════════════════
// TIMELINE / CHRONICLE
// ═══════════════════════════════════════════════════════════════

export interface TintConfig {
  tint: string;
  accent: string;
  text: string;
}

export interface TimelineConfig {
  startYear: number;
  endYear: number;
  currentYear: number;
  vault: string;
  cardSurfaceOpacity?: number;
  textures?: {
    page?: string;
    card?: string;
    events?: string;
    characters?: string;
  };
}

export interface TimelineSpan {
  type: "span";
  label: string;
  tint: string;
  obs: string;
  start: number;
  end: number;
}

export interface TimelinePoint {
  type: "point";
  label: string;
  tint: string;
  obs: string;
  year: number;
}

export type TimelineItem = TimelineSpan | TimelinePoint;

export interface TimelineSection {
  id: string;
  label: string;
  items: TimelineItem[];
}

export interface TimelineData {
  config: TimelineConfig;
  tints: Record<string, TintConfig>;
  sections: TimelineSection[];
}

// ═══════════════════════════════════════════════════════════════
// CONVERSATION TRACKER
// ═══════════════════════════════════════════════════════════════

export interface ConvoPC {
  name: string;
  score: number;
}

export interface ConvoState {
  title: string;
  pcCount: number;
  pcs: ConvoPC[];
}

// ═══════════════════════════════════════════════════════════════
// TRACKER
// ═══════════════════════════════════════════════════════════════

export type TrackerDirection = "countup" | "countdown";
export type SessionDiffDirection = "countup" | "countdown";
export type SessionTriggerMode = "once" | "repeat";

export interface TrackerWarning {
  value: number;
  label: string;
}

export interface SessionLinkRule {
  enabled: boolean;
  anchorSession: number;
  direction: SessionDiffDirection;
  distance: number;
  triggerMode: SessionTriggerMode;
  reminderText: string;
}

export interface TrackerEntry {
  id: string;
  name: string;
  category: string;
  min: number;
  max: number;
  current: number;
  direction: TrackerDirection;
  warnings: TrackerWarning[];
  sessionLink?: SessionLinkRule;
}

export interface TrackerData {
  entries: TrackerEntry[];
}

export interface SessionReminder {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  message: string;
  anchorSession: number;
  direction: SessionDiffDirection;
  distance: number;
  triggeredAtSession: number;
}

export interface SessionEntryData {
  reminders?: SessionReminder[];
  activeNotes?: string[];
  [key: string]: unknown;
}

export interface SessionEntry {
  id: string;
  number: number;
  note: string;
  timestamp: number;
  data: SessionEntryData;
}

export interface SessionTrackerData {
  currentNumber: number;
  currentNote: string;
  currentData: SessionEntryData;
  entries: SessionEntry[];
}

// ═══════════════════════════════════════════════════════════════
// PARTY QUICK VIEW
// ═══════════════════════════════════════════════════════════════

export interface PCCustomField {
  id: string;
  name: string;
  value: string;
}

export interface CPRPCStats {
  role?: string;
  // Base stats (0–10)
  statInt?: string;
  statRef?: string;
  statDex?: string;
  statTech?: string;
  statCool?: string;
  statWill?: string;
  statLuck?: string;
  statMove?: string;
  statBody?: string;
  statEmp?: string;
  // Combat / resources
  hp?: string;
  hpMax?: string;
  armorSP?: string;
  humanity?: string;
  humanityMax?: string;
  streetCred?: string;
  luck?: string;
  luckMax?: string;
  plat?: number;
  // Skills
  skills?: CPRSkills;
}

export interface PCCard {
  id: string;
  name: string;
  portrait?: string; // base64 compressed JPEG — same format as NPC portrait
  ac: string;
  saves: {
    str: string;
    dex: string;
    con: string;
    int: string;
    wis: string;
    cha: string;
  };
  passives: {
    perception: string;
    insight: string;
    investigation: string;
  };
  currency: {
    platinum: number;
    gold: number;
  };
  custom: PCCustomField[];
  cprStats?: CPRPCStats;
}

export interface PartyData {
  pcs: PCCard[];
}

// ═══════════════════════════════════════════════════════════════
// FACTIONS
// ═══════════════════════════════════════════════════════════════

export interface FactionRank {
  id: string;
  name: string;
}

export interface FactionMember {
  pcId: string;
  rankId: string;
}

export interface FactionConfig {
  id: string;
  name: string; // faction display name
  leader?: string; // faction leader name (display only)
  insignia?: string; // base64 compressed JPEG — same format as NPC portrait
  colors?: string[]; // up to 5 hex color strings, e.g. "#a83b3b"
  factionNpcId?: string; // deprecated — used only during migration
  renown: Record<string, number>; // playerId → score (0–100)
  ranks: FactionRank[];
  members: FactionMember[];
  npcRanks: Record<string, string>; // npcId → rankId
}

export interface FactionsData {
  factions: FactionConfig[];
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN DATA (per-campaign bucket)
// ═══════════════════════════════════════════════════════════════

export interface CampaignData {
  schema: Schema;
  players: Record<string, PlayerData>;
  houses: Record<string, HouseData>;
  timeline: TimelineData | null;
  tracker: TrackerData;
  sessions?: SessionTrackerData;
  party: PartyData;
  factions: FactionsData;
  favor?: FavorSettings;
  initiative?: InitiativeState | null;
  // CPR-only: npcId → playerId → score (-3 to 5)
  cprRelationships?: Record<string, Record<string, number>>;
}

// ═══════════════════════════════════════════════════════════════
// UI STATE
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// INITIATIVE TRACKER
// ═══════════════════════════════════════════════════════════════

export interface InitiativeEntry {
  id: string;
  name: string;
  roll: number;
  type: "pc" | "friendly" | "enemy";
  incapacitated?: boolean;
}

export interface InitiativeState {
  entries: InitiativeEntry[];
  currentIndex: number;
  turnNumber: number;
}

export type TabId =
  | "favor"
  | "npcs"
  | "convo"
  | "tree"
  | "chronicle"
  | "tracker"
  | "sessions"
  | "party"
  | "factions"
  | "initiative"
  | "dice"
  | "enemies"
  | "dvtables"
  | "mechanics";

export type GroupId = "session" | "game" | "world" | "toolbox" | "custom";

export interface UIState {
  activeCampaign: string;
  activePlayer: string;
  activeHouse: string;
  activeTab: TabId;
  activeGroup: GroupId;
  lastTabPerGroup: Partial<Record<GroupId, TabId>>;
  customGroupName: string;
  customGroupTabs: TabId[];
  convo: ConvoState;
}

// ═══════════════════════════════════════════════════════════════
// ROOT APP STATE
// ═══════════════════════════════════════════════════════════════

export interface TokenUsage {
  lifetimeInput: number;
  lifetimeOutput: number;
  lastInput: number;
  lastOutput: number;
  generationCount: number;
}

export interface AppState {
  version: number; // for future migrations
  campaigns: Campaign[];
  campaignData: Record<string, CampaignData>;
  ui: UIState;
  enemies: MonsterStatBlock[];
  aiModel: AiModel;
  tokenUsage: TokenUsage;
  hideAiFeatures: boolean;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

export function isTimelineSpan(item: TimelineItem): item is TimelineSpan {
  return item.type === "span";
}

export function isTimelinePoint(item: TimelineItem): item is TimelinePoint {
  return item.type === "point";
}

// ═══════════════════════════════════════════════════════════════
// ENEMY LIBRARY
// ═══════════════════════════════════════════════════════════════

export type AiModel =
  | "claude-haiku-4-5"
  | "claude-sonnet-4-5"
  | "claude-opus-4-5";

export type MonsterSize =
  | "Tiny"
  | "Small"
  | "Medium"
  | "Large"
  | "Huge"
  | "Gargantuan";

export type MonsterType =
  | "Aberration"
  | "Beast"
  | "Celestial"
  | "Construct"
  | "Dragon"
  | "Elemental"
  | "Fey"
  | "Fiend"
  | "Giant"
  | "Humanoid"
  | "Monstrosity"
  | "Ooze"
  | "Plant"
  | "Undead";

export type SpellcastingAbility = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

export interface SpeedBlock {
  walk: number;
  fly?: number;
  swim?: number;
  climb?: number;
  burrow?: number;
}

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface SensesBlock {
  passive_perception: number;
  darkvision?: number;
  blindsight?: number;
  truesight?: number;
  tremorsense?: number;
}

export interface MonsterTrait {
  name: string;
  description: string;
}

export interface ActionRange {
  normal: number;
  long?: number;
}

export interface MonsterAction {
  name: string;
  description: string;
  type?: "weapon" | "spell" | "special" | "multiattack";
  attack_bonus?: number;
  reach?: number;
  range?: ActionRange;
  targets?: number;
  damage?: string;
  damage_type?: string;
  extra_damage?: string;
  extra_damage_type?: string;
}

export interface MonsterReaction {
  name: string;
  trigger: string;
  description: string;
}

export interface MonsterSpellcasting {
  ability: SpellcastingAbility;
  spell_save_dc: number;
  spell_attack_bonus: number;
  at_will?: string[];
  per_day?: Record<string, string[]>;
  notes?: string;
}

export interface MonsterStatBlock {
  /** Library key — injected by the app, not part of the JSON schema */
  id: string;
  name: string;
  size: MonsterSize;
  type: MonsterType;
  subtype?: string;
  alignment: string;
  cr: number;
  xp: number;
  ac: number;
  ac_source: string;
  hp: number;
  hp_formula: string;
  speed: SpeedBlock;
  ability_scores: AbilityScores;
  saving_throws?: Partial<AbilityScores>;
  skills?: Record<string, number>;
  damage_immunities?: string[];
  damage_resistances?: string[];
  damage_vulnerabilities?: string[];
  condition_immunities?: string[];
  senses: SensesBlock;
  languages: string[];
  traits: MonsterTrait[];
  actions: MonsterAction[];
  reactions?: MonsterReaction[];
  spellcasting?: MonsterSpellcasting;
}

export type EnemyFocus = "physical" | "hybrid" | "spellcaster";

export interface GenerateEnemyParams {
  cr: number;
  focus: EnemyFocus;
  type: MonsterType;
  hints?: string;
}
