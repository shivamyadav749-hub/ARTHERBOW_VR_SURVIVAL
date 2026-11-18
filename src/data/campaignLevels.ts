import {
  ArrowTypeId,
  DifficultyTier,
  EnemyArchetype,
  EnemySpawnPhase,
  EnemySpawnSpec,
  EnemyWeaponType,
  LevelConfig,
  SeasonConfig,
} from '../types/archery';

export const SEASONS: SeasonConfig[] = [
  {
    id: 1,
    name: 'Alpine Dawn',
    subtitle: 'Bronze Frontier Scouts',
    difficulty: 'Easy',
    requiredStarsToUnlock: 0,
    accentHex: '#22C55E',
    badgeBgHex: 'rgba(34, 197, 94, 0.16)',
    levelRange: [1, 10],
    atmosphere: {
      fogHex: 0x102033,
      fogDensity: 0.0095,
      hemiSkyHex: 0x7dd3fc,
      hemiGroundHex: 0x1e293b,
      hemiIntensity: 0.9,
      sunHex: 0xffe4b5,
      sunIntensity: 2.35,
      rimHex: 0x38bdf8,
      rimIntensity: 0.75,
    },
  },
  {
    id: 2,
    name: 'Emerald Valley',
    subtitle: 'Shielded Hoplite Phalanx',
    difficulty: 'Moderate',
    requiredStarsToUnlock: 12,
    accentHex: '#38BDF8',
    badgeBgHex: 'rgba(56, 189, 248, 0.16)',
    levelRange: [11, 20],
    atmosphere: {
      fogHex: 0x0c2126,
      fogDensity: 0.011,
      hemiSkyHex: 0x38bdf8,
      hemiGroundHex: 0x132a23,
      hemiIntensity: 0.82,
      sunHex: 0xfef3c7,
      sunIntensity: 2.1,
      rimHex: 0x2dd4bf,
      rimIntensity: 0.9,
    },
  },
  {
    id: 3,
    name: 'Crimson Dusk',
    subtitle: 'Javelin Crossfire Canyon',
    difficulty: 'Challenging',
    requiredStarsToUnlock: 28,
    accentHex: '#F59E0B',
    badgeBgHex: 'rgba(245, 158, 11, 0.16)',
    levelRange: [21, 30],
    atmosphere: {
      fogHex: 0x1f1421,
      fogDensity: 0.012,
      hemiSkyHex: 0xfb923c,
      hemiGroundHex: 0x1e1b2e,
      hemiIntensity: 0.78,
      sunHex: 0xfdba74,
      sunIntensity: 2.3,
      rimHex: 0xf97316,
      rimIntensity: 1.05,
    },
  },
  {
    id: 4,
    name: 'Frostbound Peak',
    subtitle: 'Iron Centurion Siege',
    difficulty: 'Hard',
    requiredStarsToUnlock: 48,
    accentHex: '#A855F7',
    badgeBgHex: 'rgba(168, 85, 247, 0.16)',
    levelRange: [31, 40],
    atmosphere: {
      fogHex: 0x091628,
      fogDensity: 0.013,
      hemiSkyHex: 0x67e8f9,
      hemiGroundHex: 0x0f172a,
      hemiIntensity: 0.74,
      sunHex: 0xe0f2fe,
      sunIntensity: 1.95,
      rimHex: 0x22d3ee,
      rimIntensity: 1.15,
    },
  },
  {
    id: 5,
    name: 'Eclipse Summit',
    subtitle: 'Gilded Imperial Vanguard',
    difficulty: 'Master',
    requiredStarsToUnlock: 70,
    accentHex: '#EF4444',
    badgeBgHex: 'rgba(239, 68, 68, 0.16)',
    levelRange: [41, 50],
    atmosphere: {
      fogHex: 0x070914,
      fogDensity: 0.014,
      hemiSkyHex: 0xc084fc,
      hemiGroundHex: 0x090d16,
      hemiIntensity: 0.68,
      sunHex: 0xfde68a,
      sunIntensity: 1.8,
      rimHex: 0xa855f7,
      rimIntensity: 1.35,
    },
  },
];

const LEVEL_TITLES: string[] = [
  // Season 1 (1-10): Alpine Dawn (Easy)
  'Scout Skirmish',
  'Bronze Pair',
  'First Javelineer',
  'Shield Wall Intro',
  'Meadow Ambush',
  'Twin Chargers',
  'Spear & Buckler',
  'Flanking Raiders',
  'Vanguard Patrol',
  'Dawn Warlord',
  // Season 2 (11-20): Emerald Valley (Moderate)
  'Hoplite Line',
  'Crosswind Volley',
  'Twin Javelineers',
  'Shielded Advance',
  'Valley Pincer',
  'Thermite Breach',
  'Iron Skirmish',
  'Ridge Crossfire',
  'Phalanx March',
  'Valley Commander',
  // Season 3 (21-30): Crimson Dusk (Challenging)
  'Sunset Charge',
  'Triple Hoplites',
  'Javelin Storm',
  'Arcing Counter',
  'Centurion Debut',
  'Canyon Blitz',
  'Double Scutum',
  'Chrono Defense',
  'Dusk Onslaught',
  'Crimson Legate',
  // Season 4 (31-40): Frostbound Peak (Hard)
  'Permafrost Vanguard',
  'Cryo Hold',
  'Glacial Crossfire',
  'Twin Centurions',
  'Frozen Phalanx',
  'Headshot Overlook',
  'Obsidian Shieldwall',
  'Summit Chargers',
  'Avalanche Wave',
  'Peak Praetorian',
  // Season 5 (41-50): Eclipse Summit (Master)
  'Twilight Legion',
  'Volt Cascade',
  'Relentless March',
  'Tempest Javelins',
  'Citadel Phalanx',
  'Precision Siege',
  'Aegis Breakers',
  'Eclipse Crossfire',
  'Imperial Crucible',
  'Grandmaster Triumph',
];

const RECOMMENDED_ARROWS: ArrowTypeId[] = [
  'standard',
  'explosive',
  'ice',
  'shock',
  'split',
];

function deterministicRand(seedInput: number): () => number {
  let s = (seedInput * 747796405 + 2891336453) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildEnemySquad(level: number, seasonId: number): EnemySpawnSpec[] {
  const rand = deterministicRand(level * 131 + seasonId * 17);
  const progress = (level - 1) / 49; // 0..1
  const levelInSeason = ((level - 1) % 10) + 1;

  // Number of enemies scales smoothly from 2 (Lv 1) -> 7 (Lv 50)
  const enemyCount =
    level === 1
      ? 2
      : level <= 4
      ? 3
      : level <= 15
      ? 4
      : level <= 30
      ? 5
      : level <= 42
      ? 6
      : 7;

  const seasonArmorPalette: Record<number, { armor: number; shield: number }> = {
    1: { armor: 0x92400e, shield: 0xb45309 }, // Bronze / Leather
    2: { armor: 0x475569, shield: 0xd97706 }, // Iron + Bronze Aspis
    3: { armor: 0x7c2d12, shield: 0xb91c1c }, // Crimson Warplate
    4: { armor: 0x1e293b, shield: 0x38bdf8 }, // Frost Steel
    5: { armor: 0x312e81, shield: 0xfacc15 }, // Gilded Eclipse Plate
  };

  const palette = seasonArmorPalette[seasonId] || seasonArmorPalette[1];
  const specs: EnemySpawnSpec[] = [];

  for (let i = 0; i < enemyCount; i++) {
    const tFrac = i / (enemyCount - 1);
    const laneX = Number(((tFrac - 0.5) * 11.5 + (rand() - 0.5) * 1.6).toFixed(2));
    const spawnDist = Math.round(24 + (i % 3) * 7 + rand() * 8 + progress * 10);

    // Archetype distribution by season & level
    let archetype: EnemyArchetype = 'shield_hoplite';
    if (level <= 2) {
      archetype = i === 1 && level === 2 ? 'javelineer' : 'shield_hoplite';
    } else if (level >= 25 && (i === Math.floor(enemyCount / 2) || (levelInSeason === 10 && i < 2))) {
      archetype = 'centurion';
    } else if (i % 2 === 1 && level >= 3) {
      archetype = 'javelineer';
    } else {
      archetype = 'shield_hoplite';
    }

    // Weapon in hand: Hoplites carry War Spear (Bhala), Javelineers mix Dhanus (Bow) & Throwing Bhala, Centurions carry upgraded Halberd
    const weaponTier = Math.max(1, Math.min(5, seasonId));
    let weaponType: EnemyWeaponType = 'spear';
    if (archetype === 'centurion') {
      weaponType = 'halberd';
    } else if (archetype === 'javelineer') {
      weaponType = (i + level) % 2 === 0 ? 'bow' : 'javelin';
    } else {
      weaponType = 'spear';
    }

    // Staged spawning: some enemies appear at the start, others ambush suddenly from behind road safety walls as player advances toward finish line
    const initialCount = level === 1 ? 2 : Math.min(3, Math.ceil(enemyCount * 0.5));
    let spawnPhase: EnemySpawnPhase = 'initial';
    if (i >= initialCount) {
      const ambushIdx = i - initialCount;
      spawnPhase =
        ambushIdx % 3 === 0
          ? 'ambush_wall'
          : ambushIdx % 3 === 1
          ? 'ambush_mid'
          : 'ambush_finish';
    }

    // Only introduce raised shields gradually (Lv 1-2 have no shields so players learn aiming first!)
    const hasShield =
      archetype === 'centurion' ||
      (archetype === 'shield_hoplite' && level >= 3);

    const baseHp =
      archetype === 'centurion'
        ? 240 + progress * 220
        : archetype === 'shield_hoplite'
        ? 110 + progress * 135
        : 90 + progress * 100;

    const moveSpeed =
      archetype === 'centurion'
        ? 1.55 + progress * 0.9
        : archetype === 'shield_hoplite'
        ? 1.9 + progress * 1.45
        : 1.35 + progress * 0.7;

    // Weapon & Shield damage scales up cleanly with level/weaponTier
    const tierDamageBonus = (weaponTier - 1) * 2.5 + (weaponType === 'halberd' ? 4 : weaponType === 'bow' ? 2 : 0);
    const attackDamage =
      archetype === 'centurion'
        ? Math.round(18 + progress * 16 + tierDamageBonus)
        : archetype === 'shield_hoplite'
        ? Math.round(11 + progress * 13 + tierDamageBonus)
        : Math.round(9 + progress * 12 + tierDamageBonus);

    const attackCooldown =
      archetype === 'javelineer'
        ? Number(Math.max(2.1, 4.6 - progress * 1.8 - (weaponTier - 1) * 0.15).toFixed(2))
        : Number(Math.max(1.4, 2.6 - progress * 0.9 - (weaponTier - 1) * 0.08).toFixed(2));

    specs.push({
      id: i + 1,
      archetype,
      weaponType,
      weaponTier,
      spawnPhase,
      x: Math.max(-7.2, Math.min(7.2, laneX)),
      z: -spawnDist,
      maxHp: Math.round(baseHp / 5) * 5,
      moveSpeed: Number(moveSpeed.toFixed(2)),
      attackDamage,
      attackCooldown,
      hasShield,
      armorHex: palette.armor,
      shieldHex: palette.shield,
    });
  }

  return specs;
}

export const CAMPAIGN_LEVELS: LevelConfig[] = Array.from({ length: 50 }, (_, idx) => {
  const level = idx + 1;
  const seasonIdx = Math.floor(idx / 10);
  const season = SEASONS[seasonIdx];
  const progress = idx / 49;
  const levelInSeason = (idx % 10) + 1;

  const rand = deterministicRand(level * 97 + 13);
  const windSign = level % 2 === 0 ? 1 : -1;
  const rawWind =
    level <= 5
      ? 0
      : level <= 10
      ? windSign * (0.6 + (level - 5) * 0.16)
      : windSign * (1.2 + progress * 4.8 + (rand() - 0.5) * 0.7);
  const windSpeedX = Number(rawWind.toFixed(1));

  // Coins scale nicely with difficulty so players can steadily buy armor & helmets
  const isBossMilestone = levelInSeason === 5 || levelInSeason === 10;
  const coinReward = Math.round((45 + level * 5 + (isBossMilestone ? 55 : 0)) / 5) * 5;

  let recommendedArrow: ArrowTypeId = 'standard';
  if (season.id === 1) {
    recommendedArrow = level >= 6 ? 'explosive' : 'standard';
  } else if (season.id === 2) {
    recommendedArrow = levelInSeason % 2 === 0 ? 'explosive' : 'standard';
  } else if (season.id === 3) {
    recommendedArrow = RECOMMENDED_ARROWS[(level + 1) % RECOMMENDED_ARROWS.length];
  } else if (season.id === 4) {
    recommendedArrow = levelInSeason % 2 === 0 ? 'ice' : 'shock';
  } else {
    recommendedArrow = levelInSeason === 10 ? 'shock' : RECOMMENDED_ARROWS[levelInSeason % 5];
  }

  return {
    level,
    seasonId: season.id,
    title: LEVEL_TITLES[idx] || `Wave ${level}`,
    difficulty: season.difficulty as DifficultyTier,
    coinReward,
    windSpeedX,
    recommendedArrow,
    enemies: buildEnemySquad(level, season.id),
  };
});

export function getSeasonForLevel(levelNumber: number): SeasonConfig {
  const clamped = Math.max(1, Math.min(50, levelNumber));
  return SEASONS[Math.floor((clamped - 1) / 10)];
}

export function getLevelConfig(levelNumber: number): LevelConfig {
  const clamped = Math.max(1, Math.min(50, levelNumber));
  return CAMPAIGN_LEVELS[clamped - 1];
}

export function getLevelEnemyLimit(levelNumber: number): number {
  const cfg = getLevelConfig(levelNumber);
  const reinforcementCap = Math.min(6, 2 + Math.floor((cfg.level - 1) / 8));
  return cfg.enemies.length + reinforcementCap;
}

export function getLevelConcurrentLimit(levelNumber: number): number {
  const cfg = getLevelConfig(levelNumber);
  return Math.min(5, Math.max(2, cfg.enemies.length));
}
