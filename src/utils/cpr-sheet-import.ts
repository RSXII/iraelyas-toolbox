import type { NPC, PCCard, CPRBaseStats, CPRSkills, CPRCombatData, CPRWeapon } from '@/types/index';

type Fields = Record<string, string>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(fields: Fields, key: string): number | undefined {
  const v = fields[key];
  if (!v || v === '(empty)') return undefined;
  const n = parseInt(v, 10);
  return isNaN(n) ? undefined : n;
}

function str(fields: Fields, key: string): string {
  const v = fields[key];
  return !v || v === '(empty)' ? '' : v.trim();
}

/** Returns the max numeric value across several indexed field variants, or undefined if all empty. */
function maxOf(fields: Fields, ...keys: string[]): number | undefined {
  let best: number | undefined;
  for (const k of keys) {
    const v = num(fields, k);
    if (v !== undefined && (best === undefined || v > best)) best = v;
  }
  return best;
}

// ─── Sub-mappers ──────────────────────────────────────────────────────────────

function mapBaseStats(fields: Fields): CPRBaseStats {
  return {
    statInt:  str(fields, 'INT')  || undefined,
    statRef:  str(fields, 'REF')  || undefined,
    statDex:  str(fields, 'DEX')  || undefined,
    statTech: str(fields, 'TECH') || undefined,
    statCool: str(fields, 'COOL') || undefined,
    statWill: str(fields, 'WILL') || undefined,
    statLuck: str(fields, 'LUCK') || undefined,
    statMove: str(fields, 'MOVE') || undefined,
    statBody: str(fields, 'BODY') || undefined,
    statEmp:  str(fields, 'EMP')  || undefined,
  };
}

function mapSkills(fields: Fields): CPRSkills {
  // The app stores the "Base" value (stat + skill rank) used directly in rolls.
  // The PDF calls this the *Total* column (e.g. ConcentrationTotal = WILL + rank).
  return {
    accounting:              num(fields, 'AccountingTotal'),
    acting:                  num(fields, 'ActingTotal'),
    airVehicleTech:          num(fields, 'AirVehicleTechTotal'),
    animalHandling:          num(fields, 'AnimalHandlingTotal'),
    archery:                 num(fields, 'ArcheryTotal'),
    athletics:               num(fields, 'AthleticsTotal'),
    autofire:                num(fields, 'AutofireTotal'),
    basicTech:               num(fields, 'BasicTechTotal'),
    brawling:                num(fields, 'BrawlingTotal'),
    bribery:                 num(fields, 'BriberyTotal'),
    bureaucracy:             num(fields, 'BureaucracyTotal'),
    business:                num(fields, 'BusinessTotal'),
    composition:             num(fields, 'CompositionTotal'),
    concealRevealObject:     num(fields, 'ConcealRevealTotal'),
    concentration:           num(fields, 'ConcentrationTotal'),
    contortionist:           num(fields, 'ContortionistTotal'),
    conversation:            num(fields, 'ConversationTotal'),
    criminology:             num(fields, 'CriminologyTotal'),
    cryptography:            num(fields, 'CryptographyTotal'),
    cybertech:               num(fields, 'CybertechTotal'),
    dance:                   num(fields, 'DanceTotal'),
    deduction:               num(fields, 'DeductionTotal'),
    demolitions:             num(fields, 'DemolitionsTotal'),
    driveLandVehicle:        num(fields, 'DriveLandVehicleTotal'),
    education:               num(fields, 'EducationTotal'),
    electronicsSecurityTech: num(fields, 'ElectronicsSecurityTechTotal'),
    endurance:               num(fields, 'EnduranceTotal'),
    evasion:                 num(fields, 'EvasionTotal'),
    firstAid:                num(fields, 'FirstAidTotal'),
    forgery:                 num(fields, 'ForgeryTotal'),
    gamble:                  num(fields, 'GambleTotal'),
    handgun:                 num(fields, 'HandgunTotal'),
    heavyWeapons:            num(fields, 'HeavyWeaponsTotal'),
    humanPerception:         num(fields, 'HumanPerceptionTotal'),
    interrogation:           num(fields, 'InterrogationTotal'),
    landVehicleTech:         num(fields, 'LandVehicleTechTotal'),
    language:                maxOf(fields, 'LanguageCustom0Total', 'LanguageCustom1Total', 'LanguageCustom2Total'),
    librarySearch:           num(fields, 'LibrarySearchTotal'),
    lipReading:              num(fields, 'LipReadingTotal'),
    localExpert:             maxOf(fields, 'LocalExpertCustom0Total', 'LocalExpertCustom1Total', 'LocalExpertCustom2Total'),
    martialArts:             num(fields, 'MartialArtsTotal'),
    meleeWeapon:             num(fields, 'MeleeWeaponTotal'),
    paintDrawSculpt:         num(fields, 'PaintDrawSculptTotal'),
    paramedic:               num(fields, 'ParamedicTotal'),
    perception:              num(fields, 'PerceptionTotal'),
    personalGrooming:        num(fields, 'PersonalGroomingTotal'),
    persuasion:              num(fields, 'PersuasionTotal'),
    photographyFilm:         num(fields, 'PhotographyFilmTotal'),
    pickLock:                num(fields, 'PickLockTotal'),
    pickPocket:              num(fields, 'PickPocketTotal'),
    pilotAirVehicle:         num(fields, 'PilotAirTotal'),
    pilotSeaVehicle:         num(fields, 'PilotSeaVehicleTotal'),
    playInstrument:          maxOf(fields, 'InstrumentCustom1Total', 'InstrumentCustom2Total'),
    resistTortureDrugs:      num(fields, 'ResistTortureDrugsTotal'),
    riding:                  num(fields, 'RidingTotal'),
    science:                 maxOf(fields, 'ScienceCustom1Total', 'ScienceCustom2Total'),
    seaVehicleTech:          num(fields, 'SeaVehicleTechTotal'),
    shoulderArms:            num(fields, 'ShoulderArmsTotal'),
    stealth:                 num(fields, 'StealthTotal'),
    streetwise:              num(fields, 'StreetwiseTotal'),
    tactics:                 num(fields, 'TacticsTotal'),
    tracking:                num(fields, 'TrackingTotal'),
    trading:                 num(fields, 'TradingTotal'),
    wardrobeStyle:           num(fields, 'WardrobeStyleTotal'),
    weaponstech:             num(fields, 'WeaponstechTotal'),
    wildernesssurvival:      num(fields, 'WildernessSurvivalTotal'),
  };
}

function mapWeapons(fields: Fields): CPRWeapon[] {
  const weapons: CPRWeapon[] = [];
  for (let i = 1; i <= 6; i++) {
    const name = str(fields, `WEAPONRow${i}`);
    if (!name) continue;
    weapons.push({
      name,
      dmg:   str(fields, `DMGRow${i}`),
      ammo:  str(fields, `AMMORow${i}`),
      rof:   str(fields, `ROFRow${i}`),
      notes: str(fields, `NOTESRow${i}`),
    });
  }
  return weapons;
}

function mapGear(fields: Fields): string[] {
  const gear: string[] = [];
  for (let i = 1; i <= 54; i++) {
    const item = str(fields, `Gear${i}`);
    if (item) gear.push(item);
  }
  return gear;
}

function mapCombat(fields: Fields): CPRCombatData {
  return {
    currentHp:                num(fields, 'CurrentHP'),
    maxHp:                    num(fields, 'MaxHP'),
    seriouslyWoundedThreshold: num(fields, 'SeriouslyWoundedThreshhold'),
    deathSave:                num(fields, 'DeathSave'),
    currentHumanity:          num(fields, 'CurrentHumanity'),
    maxHumanity:              num(fields, 'MaxHumanity'),
    luck:                     num(fields, 'LUCK'),
    luckMax:                  num(fields, 'LUCKMAX'),
    armorHeadSp:              num(fields, 'SPHead'),
    armorBodySp:              num(fields, 'SPBody'),
    armorShieldSp:            num(fields, 'SPShield'),
    weapons:                  mapWeapons(fields),
    gear:                     mapGear(fields),
    aliases:                  str(fields, 'Aliases')     || undefined,
    cash:                     str(fields, 'Cash')        || undefined,
    reputation:               num(fields, 'Reputation'),
    housing:                  str(fields, 'Housing')     || undefined,
    fashion:                  str(fields, 'Fashion')     || undefined,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return only the stats/skills/combat portion of a sheet — used when importing
 * onto an existing NPC without overwriting its name, portrait, or narrative fields.
 */
export function mapFieldsToNPCPatch(fields: Fields) {
  return {
    cprBaseStats: mapBaseStats(fields),
    cprSkills:    mapSkills(fields),
    cprCombat:    mapCombat(fields),
  };
}

/**
 * Return only the cprStats portion of a sheet — used when importing onto an
 * existing PC without overwriting its name or portrait.
 */
export function mapFieldsToPCStats(fields: Fields) {
  return {
    role:         str(fields, 'Role')            || undefined,
    statInt:      str(fields, 'INT')             || undefined,
    statRef:      str(fields, 'REF')             || undefined,
    statDex:      str(fields, 'DEX')             || undefined,
    statTech:     str(fields, 'TECH')            || undefined,
    statCool:     str(fields, 'COOL')            || undefined,
    statWill:     str(fields, 'WILL')            || undefined,
    statLuck:     str(fields, 'LUCK')            || undefined,
    statMove:     str(fields, 'MOVE')            || undefined,
    statBody:     str(fields, 'BODY')            || undefined,
    statEmp:      str(fields, 'EMP')             || undefined,
    hp:           str(fields, 'CurrentHP')       || undefined,
    hpMax:        str(fields, 'MaxHP')           || undefined,
    humanity:     str(fields, 'CurrentHumanity') || undefined,
    humanityMax:  str(fields, 'MaxHumanity')     || undefined,
    luck:         str(fields, 'LUCK')            || undefined,
    luckMax:      str(fields, 'LUCKMAX')         || undefined,
    armorSP:      str(fields, 'SPBody')          || undefined,
    skills:       mapSkills(fields),
    weapons:      mapWeapons(fields),
    gear:         mapGear(fields),
  };
}

/** Build a partial NPC from raw PDF AcroForm fields. Caller must supply id, faction, factionId. */
export function mapFieldsToNPC(
  fields: Fields,
  overrides: Pick<NPC, 'id' | 'faction'> & Partial<Pick<NPC, 'factionId' | 'npcType'>>,
): NPC {
  return {
    id:       overrides.id,
    name:     str(fields, 'Handle') || 'Unnamed',
    role:     str(fields, 'Role')   || '—',
    faction:  overrides.faction,
    factionId: overrides.factionId,
    npcType:  overrides.npcType ?? 'recurring',
    cprBaseStats: mapBaseStats(fields),
    cprSkills:    mapSkills(fields),
    cprCombat:    mapCombat(fields),
  };
}

/** Build a PCCard from raw PDF AcroForm fields. Caller must supply id. */
export function mapFieldsToPC(fields: Fields, id: string): PCCard {
  return {
    id,
    name: str(fields, 'Handle') || 'Unnamed',
    ac:   '',
    saves:    { str: '', dex: '', con: '', int: '', wis: '', cha: '' },
    passives: { perception: '', insight: '', investigation: '' },
    currency: { platinum: 0, gold: 0 },
    custom:   [],
    cprStats: {
      role:         str(fields, 'Role')           || undefined,
      statInt:      str(fields, 'INT')            || undefined,
      statRef:      str(fields, 'REF')            || undefined,
      statDex:      str(fields, 'DEX')            || undefined,
      statTech:     str(fields, 'TECH')           || undefined,
      statCool:     str(fields, 'COOL')           || undefined,
      statWill:     str(fields, 'WILL')           || undefined,
      statLuck:     str(fields, 'LUCK')           || undefined,
      statMove:     str(fields, 'MOVE')           || undefined,
      statBody:     str(fields, 'BODY')           || undefined,
      statEmp:      str(fields, 'EMP')            || undefined,
      hp:           str(fields, 'CurrentHP')      || undefined,
      hpMax:        str(fields, 'MaxHP')          || undefined,
      humanity:     str(fields, 'CurrentHumanity') || undefined,
      humanityMax:  str(fields, 'MaxHumanity')    || undefined,
      luck:         str(fields, 'LUCK')           || undefined,
      luckMax:      str(fields, 'LUCKMAX')        || undefined,
      armorSP:      str(fields, 'SPBody')         || undefined,
      skills:       mapSkills(fields),
      weapons:      mapWeapons(fields),
      gear:         mapGear(fields),
    },
  };
}
