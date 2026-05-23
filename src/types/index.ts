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

export interface Campaign {
  id: string;
  label: string;
}

// ═══════════════════════════════════════════════════════════════
// FAVOR TRACKER
// ═══════════════════════════════════════════════════════════════

export interface NPC {
  id: string;
  name: string;
  role: string;
  faction: string;
  isFactionHeader?: boolean;
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

export interface TrackerWarning {
  value: number;
  label: string;
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
}

export interface TrackerData {
  entries: TrackerEntry[];
}

// ═══════════════════════════════════════════════════════════════
// PARTY QUICK VIEW
// ═══════════════════════════════════════════════════════════════

export interface PCCustomField {
  id: string;
  name: string;
  value: string;
}

export interface PCCard {
  id: string;
  name: string;
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
  factionNpcId: string; // references NPC.id where isFactionHeader === true
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
  party: PartyData;
  factions: FactionsData;
}

// ═══════════════════════════════════════════════════════════════
// UI STATE
// ═══════════════════════════════════════════════════════════════

export type TabId =
  | "favor"
  | "convo"
  | "tree"
  | "chronicle"
  | "tracker"
  | "party"
  | "factions";

export interface UIState {
  activeCampaign: string;
  activePlayer: string;
  activeHouse: string;
  activeTab: TabId;
  convo: ConvoState;
}

// ═══════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════

export interface ThemeSettings {
  uiScale: number; // 0.80 – 1.20, applied as CSS zoom on <html>
  bgColor: string; // hex — base background; surface/card stack derived from this
  textColor: string; // hex — primary text color (--text)
  accentColor: string; // hex — accent color; gold scale derived from this
}

// ═══════════════════════════════════════════════════════════════
// ROOT APP STATE
// ═══════════════════════════════════════════════════════════════

export interface AppState {
  version: number; // for future migrations
  campaigns: Campaign[];
  campaignData: Record<string, CampaignData>;
  ui: UIState;
  theme: ThemeSettings;
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
