export type ArrowTypeId = 'standard' | 'explosive' | 'ice' | 'shock' | 'split';

export interface ArrowTypeConfig {
  id: ArrowTypeId;
  hotkey: string;
  name: string;
  unityEnumName: string;
  shortTag: string;
  description: string;
  specialAbilityLabel: string;
  // Physics & Ballistics
  baseDamage: number;
  mass: number;
  muzzleVelocity: number;
  gravityMultiplier: number;
  dragCoefficient: number;
  scoreMultiplier: number;
  // Special Ability Parameters
  blastRadius: number;
  freezeDuration: number;
  chainRange: number;
  maxChainTargets: number;
  splitDelay: number;
  splitSpreadDeg: number;
  // Visual Palette
  primaryHex: string;
  emissiveHex: string;
  fletchingHex: string;
  shaftHex: string;
}

export const ARROW_TYPES: Record<ArrowTypeId, ArrowTypeConfig> = {
  standard: {
    id: 'standard',
    hotkey: '1',
    name: 'Carbon Broadhead',
    unityEnumName: 'ArrowCategory.CarbonBroadhead',
    shortTag: 'Precision Headshot',
    description:
      'High-velocity woven carbon shaft with a 3-blade broadhead. Ideal for piercing above raised shields for 2.5x critical headshots.',
    specialAbilityLabel: '2.5x Headshot Precision & Armor Piercing',
    baseDamage: 100,
    mass: 1.0,
    muzzleVelocity: 64,
    gravityMultiplier: 1.0,
    dragCoefficient: 0.004,
    scoreMultiplier: 1.25,
    blastRadius: 0,
    freezeDuration: 0,
    chainRange: 0,
    maxChainTargets: 0,
    splitDelay: 0,
    splitSpreadDeg: 0,
    primaryHex: '#38BDF8',
    emissiveHex: '#0284C7',
    fletchingHex: '#E2E8F0',
    shaftHex: '#1E293B',
  },
  explosive: {
    id: 'explosive',
    hotkey: '2',
    name: 'Thermite Detonator',
    unityEnumName: 'ArrowCategory.ThermiteDetonator',
    shortTag: 'Shield-Bypass Blast',
    description:
      'Ordnance warhead that detonates on impact, bypassing raised enemy shields with a 5.5m OverlapSphere blast wave.',
    specialAbilityLabel: 'Bypasses Shields (5.5m AoE Blast)',
    baseDamage: 145,
    mass: 1.4,
    muzzleVelocity: 49,
    gravityMultiplier: 1.3,
    dragCoefficient: 0.008,
    scoreMultiplier: 1.0,
    blastRadius: 5.5,
    freezeDuration: 0,
    chainRange: 0,
    maxChainTargets: 0,
    splitDelay: 0,
    splitSpreadDeg: 0,
    primaryHex: '#F97316',
    emissiveHex: '#EA580C',
    fletchingHex: '#FDBA74',
    shaftHex: '#27272A',
  },
  ice: {
    id: 'ice',
    hotkey: '3',
    name: 'Cryo-Frost Shard',
    unityEnumName: 'ArrowCategory.CryoFrostShard',
    shortTag: 'Freeze Chargers (6s)',
    description:
      'Sub-zero crystal shaft that freezes charging enemies by 88% for 6 seconds, exposing their heads and halting melee rushes.',
    specialAbilityLabel: 'Cryo Stasis (Slows Chargers & Ranged 88%)',
    baseDamage: 85,
    mass: 0.95,
    muzzleVelocity: 58,
    gravityMultiplier: 0.95,
    dragCoefficient: 0.005,
    scoreMultiplier: 1.15,
    blastRadius: 2.2,
    freezeDuration: 6.0,
    chainRange: 0,
    maxChainTargets: 0,
    splitDelay: 0,
    splitSpreadDeg: 0,
    primaryHex: '#22D3EE',
    emissiveHex: '#06B6D4',
    fletchingHex: '#CFFAFE',
    shaftHex: '#0F172A',
  },
  shock: {
    id: 'shock',
    hotkey: '4',
    name: 'Volt-Arc Seeker',
    unityEnumName: 'ArrowCategory.VoltArcSeeker',
    shortTag: 'Chain Around Shields',
    description:
      'Hyper-velocity plasma tip that arcs electricity across 2 nearby armored warriors within 10.5m, striking around bronze shields.',
    specialAbilityLabel: 'Arc Discharge (Chains to 2 Nearby Enemies)',
    baseDamage: 92,
    mass: 0.78,
    muzzleVelocity: 72,
    gravityMultiplier: 0.65,
    dragCoefficient: 0.002,
    scoreMultiplier: 1.1,
    blastRadius: 0,
    freezeDuration: 0,
    chainRange: 10.5,
    maxChainTargets: 2,
    splitDelay: 0,
    splitSpreadDeg: 0,
    primaryHex: '#A855F7',
    emissiveHex: '#9333EA',
    fletchingHex: '#F3E8FF',
    shaftHex: '#1E1B4B',
  },
  split: {
    id: 'split',
    hotkey: '5',
    name: 'Chrono-Split Volley',
    unityEnumName: 'ArrowCategory.ChronoSplitVolley',
    shortTag: 'Tri-Vector Crowd',
    description:
      'Harmonic shaft that splits mid-flight into 3 phase-locked arrows to overwhelm advancing phalanx formations.',
    specialAbilityLabel: 'Mid-Flight Tri-Bifurcation (3 Arrows)',
    baseDamage: 75,
    mass: 0.9,
    muzzleVelocity: 60,
    gravityMultiplier: 0.95,
    dragCoefficient: 0.004,
    scoreMultiplier: 1.0,
    blastRadius: 0,
    freezeDuration: 0,
    chainRange: 0,
    maxChainTargets: 0,
    splitDelay: 0.16,
    splitSpreadDeg: 3.6,
    primaryHex: '#10B981',
    emissiveHex: '#059669',
    fletchingHex: '#D1FAE5',
    shaftHex: '#064E3B',
  },
};

export const ARROW_TYPE_LIST: ArrowTypeConfig[] = [
  ARROW_TYPES.standard,
  ARROW_TYPES.explosive,
  ARROW_TYPES.ice,
  ARROW_TYPES.shock,
  ARROW_TYPES.split,
];

export type GameState =
  | 'title'
  | 'playing'
  | 'paused'
  | 'level_complete'
  | 'level_failed';

export type DifficultyTier = 'Easy' | 'Moderate' | 'Challenging' | 'Hard' | 'Master';

export type EnemyArchetype = 'shield_hoplite' | 'javelineer' | 'centurion';

export type EnemyWeaponType = 'spear' | 'bow' | 'javelin' | 'halberd';

export type EnemySpawnPhase = 'initial' | 'ambush_wall' | 'ambush_mid' | 'ambush_finish';

export type HitboxZone = 'head' | 'torso' | 'limb' | 'shield';

export const HITBOX_MULTIPLIERS: Record<HitboxZone, number> = {
  head: 2.5,
  torso: 1.0,
  limb: 0.65,
  shield: 0.0,
};

export interface SeasonConfig {
  id: number; // 1..5
  name: string;
  subtitle: string;
  difficulty: DifficultyTier;
  requiredStarsToUnlock: number;
  accentHex: string;
  badgeBgHex: string;
  levelRange: [number, number];
  atmosphere: {
    fogHex: number;
    fogDensity: number;
    hemiSkyHex: number;
    hemiGroundHex: number;
    hemiIntensity: number;
    sunHex: number;
    sunIntensity: number;
    rimHex: number;
    rimIntensity: number;
  };
}

export interface EnemySpawnSpec {
  id: number;
  archetype: EnemyArchetype;
  weaponType: EnemyWeaponType;
  weaponTier: number; // 1..5 upgraded by level/season
  spawnPhase: EnemySpawnPhase;
  x: number;
  z: number;
  maxHp: number;
  moveSpeed: number;
  attackDamage: number;
  attackCooldown: number;
  hasShield: boolean;
  armorHex: number;
  shieldHex: number;
}

export interface LevelConfig {
  level: number; // 1..50
  seasonId: number; // 1..5
  title: string;
  difficulty: DifficultyTier;
  coinReward: number;
  windSpeedX: number;
  recommendedArrow: ArrowTypeId;
  enemies: EnemySpawnSpec[];
}

export interface ArmorGearItem {
  id: string;
  slot: 'armor' | 'helmet';
  name: string;
  eraLabel: string;
  description: string;
  costCoins: number;
  bonusMaxHp: number;
  damageReductionPct: number; // 0..45
  primaryHex: string;
  trimHex: string;
}

export interface ScorePopup {
  id: number;
  x: number;
  y: number;
  points: number;
  ringLabel: string;
  arrowType: ArrowTypeId;
  detailText?: string;
}

export interface RadarBlip {
  id: number;
  relX: number; // + right, - left relative to player view (meters)
  relZ: number; // + ahead, - behind relative to player view (meters)
  distanceMeters: number;
  archetype: EnemyArchetype;
  weaponType: EnemyWeaponType;
  behindSafetyWall: boolean;
  isAmbush: boolean;
}

export interface RadarWallMarker {
  id: string;
  relX: number;
  relZ: number;
}

export interface LiveBallisticsTelemetry {
  drawPercent: number;
  drawLengthMeters: number;
  launchSpeedMs: number;
  lastImpactDistance: number;
  lastHitRing: string;
  lastDamageDealt: number;
  activeArrowsInFlight: number;
  distanceToFinishMeters: number;
  routeProgressPct: number;
  crossedFinishLine: boolean;
  radarBlips: RadarBlip[];
  radarWalls: RadarWallMarker[];
  behindWallAlertCount: number;
}

export type MobileControlMode = 'auto' | 'on' | 'off';

export interface MobileControlInput {
  moveX: number; // -1 (left) to +1 (right)
  moveY: number; // -1 (back) to +1 (forward)
  sprintLocked: boolean;
}

export interface MobileControlBridge {
  startDraw: () => void;
  releaseDraw: (cancel?: boolean) => void;
  addLookDelta: (deltaX: number, deltaY: number) => void;
  toggleCrouch: () => void;
  recenterAim: () => void;
}

export interface CalibrationSettings {
  virtualIpdMm: number;
  dominantEye: 'right' | 'left';
  stringHandOffsetCm: {
    x: number;
    y: number;
    z: number;
  };
  touchSensitivity: number;
  mobileControlsMode: MobileControlMode;
}

export const DEFAULT_CALIBRATION_SETTINGS: CalibrationSettings = {
  virtualIpdMm: 63.0,
  dominantEye: 'right',
  stringHandOffsetCm: {
    x: 0.0,
    y: 1.5,
    z: -2.0,
  },
  touchSensitivity: 1.0,
  mobileControlsMode: 'auto',
};

export type ImpactMaterial = 'wood' | 'stone' | 'metal';
