import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Code2,
  Coins,
  Compass,
  Eye,
  EyeOff,
  Flag,
  Gamepad2,
  Glasses,
  Heart,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Skull,
  Sliders,
  Star,
  Trophy,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import {
  ARROW_TYPE_LIST,
  ARROW_TYPES,
  ArmorGearItem,
  ArrowTypeId,
  CalibrationSettings,
  DEFAULT_CALIBRATION_SETTINGS,
  GameState,
  ImpactMaterial,
  LiveBallisticsTelemetry,
  MobileControlBridge,
  MobileControlInput,
  ScorePopup,
} from './types/archery';
import { ArcheryCanvas } from './components/ArcheryCanvas';
import { MobileControlsOverlay } from './components/MobileControlsOverlay';
import { UnityScriptModal } from './components/UnityScriptModal';
import { SettingsModal } from './components/SettingsModal';
import { LevelProgressRecord, LevelSelectModal } from './components/LevelSelectModal';
import { ArmoryModal } from './components/ArmoryModal';
import { getLevelConfig, getLevelEnemyLimit, getSeasonForLevel, SEASONS } from './data/campaignLevels';
import { computePlayerDefenseStats } from './data/armoryData';
import { checkWebXRSupport } from './three/webxrVrRig';
import { soundEngine } from './audio/soundEngine';

export { soundEngine };

const WIND_PRESETS = [0, 2.4, -3.2, 4.8, -1.8];
const STORAGE_PROGRESS_KEY = 'aetherbow_survival_progress_v2';
const STORAGE_UNLOCKED_KEY = 'aetherbow_survival_unlocked_v2';
const STORAGE_UNLOCK_ALL_KEY = 'aetherbow_survival_unlock_all_v2';
const STORAGE_COINS_KEY = 'aetherbow_survival_coins_v2';
const STORAGE_OWNED_GEAR_KEY = 'aetherbow_owned_gear_v2';
const STORAGE_EQUIPPED_ARMOR_KEY = 'aetherbow_equipped_armor_v2';
const STORAGE_EQUIPPED_HELMET_KEY = 'aetherbow_equipped_helmet_v2';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('title');
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_UNLOCKED_KEY);
      return saved ? Math.max(1, Math.min(50, Number(saved))) : 1;
    } catch {
      return 1;
    }
  });
  const [unlockAllLevels, setUnlockAllLevels] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_UNLOCK_ALL_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [progressByLevel, setProgressByLevel] = useState<Record<number, LevelProgressRecord>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PROGRESS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Economy & Ancient Armory State
  const [coins, setCoins] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_COINS_KEY);
      return saved ? Math.max(0, Number(saved)) : 120; // Starter purse
    } catch {
      return 120;
    }
  });
  const [ownedGearIds, setOwnedGearIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_OWNED_GEAR_KEY);
      return raw ? JSON.parse(raw) : ['armor-recruit-leather', 'helm-leather-hood'];
    } catch {
      return ['armor-recruit-leather', 'helm-leather-hood'];
    }
  });
  const [equippedArmorId, setEquippedArmorId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_EQUIPPED_ARMOR_KEY) || 'armor-recruit-leather';
    } catch {
      return 'armor-recruit-leather';
    }
  });
  const [equippedHelmetId, setEquippedHelmetId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_EQUIPPED_HELMET_KEY) || 'helm-leather-hood';
    } catch {
      return 'helm-leather-hood';
    }
  });

  const defenseStats = computePlayerDefenseStats(equippedArmorId, equippedHelmetId);
  const levelConfig = getLevelConfig(currentLevel);
  const levelEnemyLimit = getLevelEnemyLimit(currentLevel);
  const seasonConfig = getSeasonForLevel(currentLevel);

  const [selectedArrowType, setSelectedArrowType] = useState<ArrowTypeId>('standard');
  const [playerHp, setPlayerHp] = useState<number>(defenseStats.maxHp);
  const [enemiesRemaining, setEnemiesRemaining] = useState<number>(levelConfig.enemies.length);
  const [enemiesDefeatedCount, setEnemiesDefeatedCount] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [levelCoinsEarned, setLevelCoinsEarned] = useState<number>(0);
  const [shotsFired, setShotsFired] = useState<number>(0);
  const [hitsCount, setHitsCount] = useState<number>(0);
  const [headshotsCount, setHeadshotsCount] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [windSpeedX, setWindSpeedX] = useState<number>(levelConfig.windSpeedX);
  const [showTrajectoryArc, setShowTrajectoryArc] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isLevelModalOpen, setIsLevelModalOpen] = useState<boolean>(false);
  const [isArmoryModalOpen, setIsArmoryModalOpen] = useState<boolean>(false);
  const [calibration, setCalibration] = useState<CalibrationSettings>(
    DEFAULT_CALIBRATION_SETTINGS
  );
  const [clearArrowsSignal, setClearArrowsSignal] = useState<number>(0);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const [earnedStars, setEarnedStars] = useState<number>(0);
  const [vrSupported, setVrSupported] = useState<boolean>(false);
  const [vrSupportReason, setVrSupportReason] = useState<string>('');
  const [isInVr, setIsInVr] = useState<boolean>(false);
  const [vrNotice, setVrNotice] = useState<string | null>(null);
  const [isTouchViewport, setIsTouchViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      window.innerWidth < 1024 ||
      'ontouchstart' in window
    );
  });
  const [isCrouchedState, setIsCrouchedState] = useState<boolean>(false);
  const [showMobileTools, setShowMobileTools] = useState<boolean>(false);
  const vrToggleRef = useRef<(() => Promise<void>) | null>(null);
  const mobileInputRef = useRef<MobileControlInput>({
    moveX: 0,
    moveY: 0,
    sprintLocked: false,
  });
  const mobileBridgeRef = useRef<MobileControlBridge | null>(null);

  useEffect(() => {
    const updateViewportMode = () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      setIsTouchViewport(coarse || window.innerWidth < 1024 || 'ontouchstart' in window);
    };
    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, []);

  useEffect(() => {
    let mounted = true;
    checkWebXRSupport().then((info) => {
      if (!mounted) return;
      setVrSupported(info.supported);
      setVrSupportReason(info.reason || '');
    });
    return () => {
      mounted = false;
    };
  }, []);

  const [telemetry, setTelemetry] = useState<LiveBallisticsTelemetry>({
    drawPercent: 0,
    drawLengthMeters: 0,
    launchSpeedMs: ARROW_TYPES.standard.muzzleVelocity,
    lastImpactDistance: 0,
    lastHitRing: '—',
    lastDamageDealt: 0,
    activeArrowsInFlight: 0,
    distanceToFinishMeters: 26,
    routeProgressPct: 0,
    crossedFinishLine: false,
  });

  const [lastHitSummary, setLastHitSummary] = useState<{
    ring: string;
    damage: number;
    distance: number;
    material?: ImpactMaterial;
  }>({
    ring: 'Defend the Barricade',
    damage: 0,
    distance: 0,
  });

  const activeArrowCfg = ARROW_TYPES[selectedArrowType];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_UNLOCKED_KEY, String(maxUnlockedLevel));
      localStorage.setItem(STORAGE_UNLOCK_ALL_KEY, String(unlockAllLevels));
      localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(progressByLevel));
      localStorage.setItem(STORAGE_COINS_KEY, String(coins));
      localStorage.setItem(STORAGE_OWNED_GEAR_KEY, JSON.stringify(ownedGearIds));
      localStorage.setItem(STORAGE_EQUIPPED_ARMOR_KEY, equippedArmorId);
      localStorage.setItem(STORAGE_EQUIPPED_HELMET_KEY, equippedHelmetId);
    } catch {
      // Ignore storage errors
    }
  }, [
    maxUnlockedLevel,
    unlockAllLevels,
    progressByLevel,
    coins,
    ownedGearIds,
    equippedArmorId,
    equippedHelmetId,
  ]);

  const startLevel = useCallback(
    (targetLevel: number, enterPlay: boolean = true) => {
      const clamped = Math.max(1, Math.min(50, targetLevel));
      const nextCfg = getLevelConfig(clamped);
      const nextDefense = computePlayerDefenseStats(equippedArmorId, equippedHelmetId);

      soundEngine.stopAllWhistles();
      setCurrentLevel(clamped);
      setPlayerHp(nextDefense.maxHp);
      setEnemiesRemaining(nextCfg.enemies.length);
      setEnemiesDefeatedCount(0);
      setScore(0);
      setLevelCoinsEarned(0);
      setShotsFired(0);
      setHitsCount(0);
      setHeadshotsCount(0);
      setStreak(0);
      setEarnedStars(0);
      setWindSpeedX(nextCfg.windSpeedX);
      setIsCrouchedState(false);
      setClearArrowsSignal((c) => c + 1);
      setTelemetry((prev) => ({
        ...prev,
        distanceToFinishMeters: 26,
        routeProgressPct: 0,
        crossedFinishLine: false,
      }));
      setLastHitSummary({
        ring: `Wave ${clamped}: ${nextCfg.title}`,
        damage: 0,
        distance: 0,
      });
      if (enterPlay) {
        setGameState('playing');
      }
    },
    [equippedArmorId, equippedHelmetId]
  );

  const handleSelectArrow = useCallback((type: ArrowTypeId) => {
    setSelectedArrowType(type);
    soundEngine.playArrowSelect(type);
  }, []);

  const handleCycleWind = useCallback(() => {
    setWindSpeedX((prev) => {
      const idx = WIND_PRESETS.findIndex((w) => Math.abs(w - prev) < 0.05);
      return WIND_PRESETS[(idx + 1) % WIND_PRESETS.length];
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleScoreHit = useCallback(
    (
      points: number,
      ringLabel: string,
      isCritical: boolean,
      damage: number,
      distance: number,
      material: ImpactMaterial,
      coinsGained: number,
      popup: Omit<ScorePopup, 'id'>
    ) => {
      if (points > 0) {
        setScore((prev) => prev + points);
        setHitsCount((prev) => prev + 1);
        setStreak((prev) => prev + 1);
      } else {
        setStreak(0);
      }
      if (isCritical) {
        setHeadshotsCount((prev) => prev + 1);
      }
      if (coinsGained > 0) {
        setCoins((prev) => prev + coinsGained);
        setLevelCoinsEarned((prev) => prev + coinsGained);
      }

      setLastHitSummary({ ring: ringLabel, damage, distance, material });

      const id = Date.now() + Math.random();
      setScorePopups((prev) => [...prev.slice(-5), { ...popup, id }]);
      setTimeout(() => {
        setScorePopups((prev) => prev.filter((p) => p.id !== id));
      }, 1350);
    },
    []
  );

  const handleEnemyDefeated = useCallback(
    (_enemyId: number, aliveLeft: number, _headshotKill: boolean) => {
      setEnemiesRemaining(aliveLeft);
      setEnemiesDefeatedCount((prev) => prev + 1);
    },
    []
  );

  const handleEnemySpawned = useCallback((aliveNow: number) => {
    setEnemiesRemaining(aliveNow);
  }, []);

  const handlePlayerDamaged = useCallback(
    (rawDamage: number, sourceLabel: string) => {
      const mitigated = Math.max(
        1,
        Math.round(rawDamage * (1 - defenseStats.damageReductionPct / 100))
      );
      setPlayerHp((prev) => Math.max(0, prev - mitigated));
      setLastHitSummary({
        ring: `${sourceLabel} (-${mitigated} HP)`,
        damage: mitigated,
        distance: 0,
      });
    },
    [defenseStats.damageReductionPct]
  );

  const handleShotFired = useCallback(() => {
    setShotsFired((prev) => prev + 1);
  }, []);

  const handlePurchaseAndEquip = useCallback(
    (item: ArmorGearItem) => {
      if (coins < item.costCoins || ownedGearIds.includes(item.id)) return;
      setCoins((c) => c - item.costCoins);
      setOwnedGearIds((prev) => [...prev, item.id]);
      if (item.slot === 'armor') {
        setEquippedArmorId(item.id);
      } else {
        setEquippedHelmetId(item.id);
      }
      soundEngine.playArrowSelect('shock');
    },
    [coins, ownedGearIds]
  );

  const handleEquipGear = useCallback((item: ArmorGearItem) => {
    if (item.slot === 'armor') {
      setEquippedArmorId(item.id);
    } else {
      setEquippedHelmetId(item.id);
    }
    soundEngine.playArrowSelect('standard');
  }, []);

  // Survival Victory & Defeat Detection
  useEffect(() => {
    if (
      gameState !== 'playing' ||
      isScriptModalOpen ||
      isSettingsModalOpen ||
      isLevelModalOpen ||
      isArmoryModalOpen
    ) {
      return;
    }

    if (playerHp <= 0) {
      const failTimer = window.setTimeout(() => {
        setGameState('level_failed');
      }, 450);
      return () => window.clearTimeout(failTimer);
    }

    if (telemetry.crossedFinishLine) {
      const winTimer = window.setTimeout(() => {
        const hpRatio = playerHp / Math.max(1, defenseStats.maxHp);
        const stars = hpRatio >= 0.8 ? 3 : hpRatio >= 0.45 ? 2 : 1;
        const extractionBonus = 30;
        const completionBonus = levelConfig.coinReward + stars * 15 + extractionBonus;

        setEarnedStars(stars);
        setCoins((c) => c + completionBonus);
        setLevelCoinsEarned((c) => c + completionBonus);
        setProgressByLevel((prev) => {
          const existing = prev[currentLevel];
          return {
            ...prev,
            [currentLevel]: {
              bestScore: Math.max(existing?.bestScore || 0, score),
              stars: Math.max(existing?.stars || 0, stars),
            },
          };
        });
        setMaxUnlockedLevel((prev) => Math.max(prev, Math.min(50, currentLevel + 1)));
        setGameState('level_complete');
      }, 320);
      return () => window.clearTimeout(winTimer);
    }
  }, [
    gameState,
    playerHp,
    defenseStats.maxHp,
    telemetry.crossedFinishLine,
    currentLevel,
    levelConfig.coinReward,
    score,
    isScriptModalOpen,
    isSettingsModalOpen,
    isLevelModalOpen,
    isArmoryModalOpen,
  ]);

  useEffect(() => {
    if (
      gameState !== 'playing' ||
      isScriptModalOpen ||
      isSettingsModalOpen ||
      isLevelModalOpen ||
      isArmoryModalOpen
    ) {
      soundEngine.stopAllWhistles();
    }
  }, [
    gameState,
    isScriptModalOpen,
    isSettingsModalOpen,
    isLevelModalOpen,
    isArmoryModalOpen,
  ]);

  // Keyboard & Mouse Wheel Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Digit1') handleSelectArrow('standard');
      else if (e.code === 'Digit2') handleSelectArrow('explosive');
      else if (e.code === 'Digit3') handleSelectArrow('ice');
      else if (e.code === 'Digit4') handleSelectArrow('shock');
      else if (e.code === 'Digit5') handleSelectArrow('split');
      else if (e.code === 'KeyC') {
        setIsSettingsModalOpen(false);
        setIsLevelModalOpen(false);
        setIsArmoryModalOpen(false);
        setIsScriptModalOpen((prev) => !prev);
      } else if (e.code === 'KeyK') {
        setIsScriptModalOpen(false);
        setIsLevelModalOpen(false);
        setIsArmoryModalOpen(false);
        setIsSettingsModalOpen((prev) => !prev);
      } else if (e.code === 'KeyL') {
        setIsScriptModalOpen(false);
        setIsSettingsModalOpen(false);
        setIsArmoryModalOpen(false);
        setIsLevelModalOpen((prev) => !prev);
      } else if (e.code === 'KeyI') {
        setIsScriptModalOpen(false);
        setIsSettingsModalOpen(false);
        setIsLevelModalOpen(false);
        setIsArmoryModalOpen((prev) => !prev);
      } else if (
        e.code === 'KeyH' &&
        !isScriptModalOpen &&
        !isSettingsModalOpen &&
        !isLevelModalOpen &&
        !isArmoryModalOpen
      ) {
        setIsDockCollapsed((prev) => !prev);
      } else if (
        e.code === 'KeyR' &&
        !isScriptModalOpen &&
        !isSettingsModalOpen &&
        !isLevelModalOpen &&
        !isArmoryModalOpen
      ) {
        if (gameState === 'level_failed') {
          startLevel(currentLevel, true);
        } else {
          handleCycleWind();
        }
      } else if (
        e.code === 'KeyM' &&
        !isScriptModalOpen &&
        !isSettingsModalOpen &&
        !isLevelModalOpen &&
        !isArmoryModalOpen
      ) {
        handleToggleMute();
      } else if (e.code === 'Escape') {
        if (isArmoryModalOpen) setIsArmoryModalOpen(false);
        else if (isLevelModalOpen) setIsLevelModalOpen(false);
        else if (isSettingsModalOpen) setIsSettingsModalOpen(false);
        else if (isScriptModalOpen) setIsScriptModalOpen(false);
        else if (gameState === 'playing') setGameState('paused');
        else if (gameState === 'paused') setGameState('playing');
      } else if (
        (e.code === 'Enter' || e.code === 'Space') &&
        !isScriptModalOpen &&
        !isSettingsModalOpen &&
        !isLevelModalOpen &&
        !isArmoryModalOpen
      ) {
        if (gameState === 'title') {
          e.preventDefault();
          startLevel(currentLevel, true);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (
        isScriptModalOpen ||
        isSettingsModalOpen ||
        isLevelModalOpen ||
        isArmoryModalOpen ||
        gameState !== 'playing'
      ) {
        return;
      }
      const currentIdx = ARROW_TYPE_LIST.findIndex((a) => a.id === selectedArrowType);
      const dir = e.deltaY > 0 ? 1 : -1;
      const nextIdx = (currentIdx + dir + ARROW_TYPE_LIST.length) % ARROW_TYPE_LIST.length;
      handleSelectArrow(ARROW_TYPE_LIST[nextIdx].id);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('wheel', onWheel);
    };
  }, [
    gameState,
    currentLevel,
    isScriptModalOpen,
    isSettingsModalOpen,
    isLevelModalOpen,
    isArmoryModalOpen,
    selectedArrowType,
    handleSelectArrow,
    handleCycleWind,
    handleToggleMute,
    startLevel,
  ]);

  const totalStarsEarned = Object.values(progressByLevel).reduce(
    (sum, rec) => sum + (rec.stars || 0),
    0
  );

  const nextLevel = currentLevel < 50 ? currentLevel + 1 : 1;
  const nextSeason = getSeasonForLevel(nextLevel);
  const canAdvanceToNextLevel =
    unlockAllLevels ||
    nextLevel === 1 ||
    totalStarsEarned >= nextSeason.requiredStarsToUnlock;

  const anyModalOpen =
    isScriptModalOpen || isSettingsModalOpen || isLevelModalOpen || isArmoryModalOpen;
  const effectiveCanvasState: GameState = anyModalOpen ? 'paused' : gameState;
  const hpPercent = Math.round((playerHp / Math.max(1, defenseStats.maxHp)) * 100);
  const mobileControlsActive =
    !isInVr &&
    (calibration.mobileControlsMode === 'on' ||
      (calibration.mobileControlsMode === 'auto' && isTouchViewport));

  const handleToggleTouchControls = useCallback(() => {
    setCalibration((prev) => ({
      ...prev,
      mobileControlsMode:
        prev.mobileControlsMode === 'on' ||
        (prev.mobileControlsMode === 'auto' && isTouchViewport)
          ? 'off'
          : 'on',
    }));
  }, [isTouchViewport]);

  const handleEnterOrExitVR = useCallback(async () => {
    setVrNotice(null);
    if (!vrToggleRef.current) return;
    if (!vrSupported && !isInVr) {
      setVrNotice(
        vrSupportReason ||
          'No WebXR VR headset detected. Open this link in Meta Quest Browser (or Chrome with PCVR SteamVR / Meta Link connected) to enter VR.'
      );
      return;
    }
    try {
      if (!isInVr && gameState === 'title') {
        startLevel(currentLevel, true);
      }
      await vrToggleRef.current();
    } catch (err) {
      setVrNotice(
        err instanceof Error
          ? err.message
          : 'Could not start WebXR session. Make sure your VR headset is awake and allowed in the browser.'
      );
    }
  }, [vrSupported, vrSupportReason, isInVr, gameState, startLevel, currentLevel]);

  const handleVrOutcomeAction = useCallback(() => {
    if (gameState === 'paused') {
      setGameState('playing');
    } else if (gameState === 'level_failed') {
      startLevel(currentLevel, true);
    } else if (gameState === 'level_complete') {
      if (canAdvanceToNextLevel) {
        startLevel(nextLevel, true);
      } else {
        startLevel(currentLevel, true);
      }
    }
  }, [gameState, canAdvanceToNextLevel, nextLevel, currentLevel, startLevel]);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#070B12] select-none touch-none">
      {/* Isolated 60fps Three.js WebGL Viewport */}
      <ArcheryCanvas
        gameState={effectiveCanvasState}
        selectedArrowType={selectedArrowType}
        windSpeedX={windSpeedX}
        showTrajectoryArc={showTrajectoryArc}
        calibration={calibration}
        seasonConfig={seasonConfig}
        levelConfig={levelConfig}
        playerHp={playerHp}
        maxPlayerHp={defenseStats.maxHp}
        equippedArmorPrimaryHex={defenseStats.armor.primaryHex}
        equippedArmorTrimHex={defenseStats.helmet.trimHex}
        earnedStars={earnedStars}
        coins={coins}
        clearArrowsSignal={clearArrowsSignal}
        isMobileTouchActive={mobileControlsActive}
        mobileInputRef={mobileInputRef}
        mobileBridgeRef={mobileBridgeRef}
        onCrouchStateChange={setIsCrouchedState}
        vrToggleRef={vrToggleRef}
        onVrStateChange={setIsInVr}
        onSelectArrowFromVr={handleSelectArrow}
        onVrOutcomeAction={handleVrOutcomeAction}
        onScoreHit={handleScoreHit}
        onEnemyDefeated={handleEnemyDefeated}
        onEnemySpawned={handleEnemySpawned}
        onPlayerDamaged={handlePlayerDamaged}
        onShotFired={handleShotFired}
        onUpdateTelemetry={setTelemetry}
      />

      {/* WebXR Headset Status Notice */}
      {vrNotice && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[min(420px,calc(100vw-24px))] bg-[#0B101B]/95 border border-sky-400/50 text-slate-200 rounded-xl px-4 py-3 shadow-2xl flex items-start gap-3">
          <Glasses className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed flex-1">{vrNotice}</p>
          <button
            onClick={() => setVrNotice(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
            aria-label="Dismiss VR notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. TITLE SCREEN OVERLAY */}
      {gameState === 'title' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between gap-6 overflow-y-auto p-4 sm:p-8 md:p-14 bg-gradient-to-t from-[#070B12]/95 via-[#070B12]/45 to-transparent pointer-events-auto">
          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-300 font-mono">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white">AETHERBOW VR SURVIVAL</span>
              <span className="hidden sm:inline" aria-hidden="true">·</span>
              <span className="hidden sm:inline">5 Seasons · Levels 1–50 · Diegetic Armor Armory</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
              <button
                onClick={() => setIsArmoryModalOpen(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-amber-300 bg-[#0B101B]/90 hover:bg-[#151F32] border border-amber-400/40 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                <span>{coins} Coins</span>
              </button>
              <button
                onClick={() => setIsLevelModalOpen(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-200 bg-[#0B101B]/90 hover:bg-[#151F32] border border-white/15 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" />
                <span>5 Seasons (★ {totalStarsEarned}/150)</span>
              </button>
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-200 bg-[#0B101B]/90 hover:bg-[#151F32] border border-white/15 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                <span>Settings</span>
              </button>
              <button
                onClick={() => setIsScriptModalOpen(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-sky-300 bg-[#0B101B]/90 hover:bg-[#151F32] border border-sky-400/40 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Code2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Unity C# (28)</span>
              </button>
            </div>
          </div>

          <div className="max-w-2xl my-auto pt-4 sm:pt-10">
            <div className="text-[11px] sm:text-xs font-mono tracking-wider text-sky-400 mb-2">
              META QUEST VR · DESKTOP · MOBILE TOUCH ARCHERY SURVIVAL
            </div>
            <h1
              className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white font-display leading-[1.06] mb-3.5 sm:mb-5"
              style={{ textWrap: 'balance' }}
            >
              AetherBow VR: Ancient Shieldwall Survival
            </h1>

            <p className="text-xs sm:text-sm md:text-base text-slate-300 leading-relaxed mb-5 sm:mb-7 max-w-xl">
              Strafe, sprint, and crouch behind stone bastions & timber cover across 5 Seasons and
              50 levels. Break enemy sightlines to dodge incoming javelins, land 2.5x headshots above
              bronze shields, forge ancient armor with earned coins, and inspect the 28-script Unity
              Quest C# codebase.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3.5">
              <button
                onClick={() => startLevel(currentLevel, true)}
                className="flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg shadow-lg transition-transform active:scale-98 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  Defend Level {currentLevel} · {seasonConfig.name}
                </span>
              </button>

              <button
                onClick={handleEnterOrExitVR}
                className={`flex items-center justify-center gap-2.5 px-5 py-3 sm:py-3.5 text-sm font-bold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                  vrSupported
                    ? 'text-emerald-200 bg-emerald-950/80 hover:bg-emerald-900 border-emerald-400/60'
                    : 'text-sky-200 bg-[#0F172A] hover:bg-slate-800 border-sky-400/40'
                }`}
              >
                <Glasses className="w-4 h-4 text-emerald-400" />
                <span>{isInVr ? 'Exit VR' : vrSupported ? 'Enter VR Headset' : 'VR Mode (WebXR)'}</span>
              </button>

              <div className="grid grid-cols-2 sm:flex gap-2.5 sm:gap-3.5">
                <button
                  onClick={() => setIsArmoryModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold text-amber-300 bg-[#0F172A] hover:bg-slate-800 border border-amber-400/40 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Armory</span>
                </button>

                <button
                  onClick={() => setIsLevelModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold text-white bg-[#0F172A] hover:bg-slate-800 border border-white/15 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>50 Levels</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-3 sm:pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 sm:gap-4 text-[11px] sm:text-xs text-slate-400 font-mono">
            {mobileControlsActive ? (
              <span>
                Touch Controls: Left Stick Move/Sprint · Swipe Viewport Aim · Hold Draw & Slide to Aim · Crouch Toggle
              </span>
            ) : (
              <span>
                WASD / Arrows Move · Shift Run · X / Q Crouch & Hide · Mouse Aim · Hold LMB / Space
                Shoot · 1–5 Arrows · I Armory · C C# Code
              </span>
            )}
            <span className="text-slate-300">
              {defenseStats.armor.name} + {defenseStats.helmet.name} ({defenseStats.maxHp} HP)
            </span>
          </div>
        </div>
      )}

      {/* 2. PLAYING HUD */}
      {gameState !== 'title' && (
        <>
          <div
            className="fixed top-0 left-0 right-0 z-10 p-2.5 sm:p-4 md:px-6 flex items-start justify-between gap-2 sm:gap-3 pointer-events-none"
            style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
          >
            {/* Top-Left Survival Health, Wave & Hitbox Readout */}
            <div className="bg-[#0B101B]/90 border border-white/10 rounded-lg px-3 py-2 sm:px-4 sm:py-3 pointer-events-auto flex-1 max-w-[390px] sm:flex-none sm:min-w-[340px] min-w-0">
              <div className="flex items-center justify-between gap-2 pb-1.5 sm:pb-2 mb-1.5 sm:mb-2 border-b border-white/10">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono min-w-0">
                  <span className="font-bold text-white shrink-0">LVL {currentLevel}/50</span>
                  <span className="text-slate-400 shrink-0">·</span>
                  <span className="text-slate-200 font-semibold truncate">
                    S{seasonConfig.id}: {seasonConfig.name}
                  </span>
                </div>
                <span
                  className="text-[10px] font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded shrink-0"
                  style={{
                    color: seasonConfig.accentHex,
                    backgroundColor: seasonConfig.badgeBgHex,
                  }}
                >
                  {seasonConfig.difficulty}
                </span>
              </div>

              <div className="flex items-center gap-2.5 sm:gap-4 font-mono tabular-nums">
                <div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1">
                    <Heart className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="hidden sm:inline">HEALTH ({defenseStats.damageReductionPct}% ARMOR)</span>
                    <span className="sm:hidden">HP ({defenseStats.damageReductionPct}%)</span>
                  </div>
                  <div
                    className={`text-sm sm:text-lg font-bold ${
                      hpPercent <= 35 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {playerHp}{' '}
                    <span className="text-[11px] sm:text-xs font-normal text-slate-400">
                      / {defenseStats.maxHp}
                    </span>
                  </div>
                </div>
                <div className="h-6 sm:h-7 w-px bg-white/10" />
                <div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400">ACTIVE · LIMIT</div>
                  <div className="text-sm sm:text-lg font-bold text-amber-400">
                    {enemiesRemaining}{' '}
                    <span className="text-[11px] sm:text-xs font-normal text-slate-400">
                      · {enemiesDefeatedCount}/{levelEnemyLimit}
                    </span>
                  </div>
                </div>
                <div className="hidden sm:block h-7 w-px bg-white/10" />
                <div className="hidden sm:block">
                  <div className="text-[11px] text-slate-400">COINS</div>
                  <div className="text-lg font-bold text-amber-300 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span>{coins}</span>
                  </div>
                </div>
                <div className="hidden md:block h-7 w-px bg-white/10" />
                <div className="hidden md:block">
                  <div className="text-[11px] text-slate-400">CROSSWIND</div>
                  <div className="text-sm font-semibold text-sky-300 flex items-center gap-1 mt-0.5">
                    <Wind className="w-3.5 h-3.5" />
                    <span>
                      {windSpeedX === 0
                        ? '0.0'
                        : `${windSpeedX > 0 ? '+' : ''}${windSpeedX.toFixed(1)} m/s`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Player Health Bar */}
              <div className="mt-1.5 sm:mt-2 w-full h-1.5 bg-[#070B12] rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full transition-all duration-200 rounded-full"
                  style={{
                    width: `${hpPercent}%`,
                    backgroundColor:
                      hpPercent > 60 ? '#22C55E' : hpPercent > 30 ? '#F59E0B' : '#EF4444',
                  }}
                />
              </div>

              {/* Mission Task: Waves until Crossing Ending Line */}
              <div className="mt-2 pt-1.5 sm:pt-2 border-t border-white/10">
                <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-mono mb-1">
                  <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
                    <Flag
                      className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${
                        telemetry.crossedFinishLine ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    />
                    <span className="font-semibold truncate">
                      {telemetry.crossedFinishLine
                        ? 'ENDING LINE REACHED!'
                        : `REACH ENDING LINE (${enemiesRemaining} ACTIVE)`}
                    </span>
                  </div>
                  <span
                    className={`font-bold tabular-nums shrink-0 ${
                      telemetry.crossedFinishLine ? 'text-emerald-400' : 'text-amber-300'
                    }`}
                  >
                    {telemetry.crossedFinishLine
                      ? '0.0m'
                      : `${telemetry.distanceToFinishMeters.toFixed(1)}m`}
                  </span>
                </div>

                <div className="relative w-full h-1.5 sm:h-2 bg-[#070B12] rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full transition-all duration-150 rounded-full"
                    style={{
                      width: `${telemetry.routeProgressPct}%`,
                      backgroundColor: telemetry.crossedFinishLine ? '#10B981' : '#F59E0B',
                    }}
                  />
                </div>
                <div className="hidden sm:flex mt-1 items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>START LINE</span>
                  <span>
                    {telemetry.routeProgressPct}% TRAIL ({telemetry.distanceToFinishMeters.toFixed(1)}m left)
                  </span>
                  <span className={telemetry.crossedFinishLine ? 'text-emerald-400 font-bold' : ''}>
                    ENDING GATE
                  </span>
                </div>
              </div>

              {/* Last Hitbox Impact Line (Desktop & Tablet) */}
              <div className="hidden sm:flex mt-2 pt-2 border-t border-white/10 items-center gap-2 text-xs text-slate-300 font-mono tabular-nums">
                <span className="text-slate-400">Combat:</span>
                <span className="text-white font-semibold truncate">{lastHitSummary.ring}</span>
                {lastHitSummary.damage > 0 && lastHitSummary.distance > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{lastHitSummary.damage} DMG</span>
                    <span aria-hidden="true">·</span>
                    <span>{lastHitSummary.distance}m</span>
                  </>
                )}
                {streak > 1 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-400">{streak}x Streak</span>
                  </>
                )}
              </div>
            </div>

            {/* Top-Right Quick Action Cluster */}
            <div className="flex flex-col sm:flex-row flex-wrap items-end sm:items-center justify-end gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={handleToggleTouchControls}
                  className={`flex items-center gap-1.5 p-2 md:px-3 md:py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    mobileControlsActive
                      ? 'text-sky-300 bg-sky-950/70 border-sky-400/50'
                      : 'text-slate-300 bg-[#0B101B]/90 hover:bg-[#162033] border-white/15'
                  }`}
                  title="Toggle On-Screen Mobile Touch Controls"
                  aria-label="Toggle Touch Controls"
                >
                  <Gamepad2 className="w-4 h-4" />
                  <span className="hidden md:inline">{mobileControlsActive ? 'Touch On' : 'Touch Off'}</span>
                </button>

                <button
                  onClick={handleEnterOrExitVR}
                  className={`hidden sm:flex items-center gap-2 p-2 md:px-3.5 md:py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    isInVr
                      ? 'text-rose-200 bg-rose-950/90 border-rose-400/50'
                      : vrSupported
                      ? 'text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 border-emerald-400/50'
                      : 'text-sky-200 bg-[#0B101B]/90 hover:bg-[#162033] border-sky-400/40'
                  }`}
                  aria-label={isInVr ? 'Exit VR' : 'Enter VR'}
                >
                  <Glasses className="w-4 h-4 text-emerald-400" />
                  <span className="hidden md:inline">{isInVr ? 'Exit VR' : 'Enter VR'}</span>
                </button>

                <button
                  onClick={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
                  className="p-2 text-slate-200 hover:text-white bg-[#0B101B]/90 hover:bg-[#162033] border border-white/15 rounded-lg transition-colors cursor-pointer"
                  aria-label="Pause Game"
                >
                  <Pause className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setIsArmoryModalOpen(true)}
                  className="flex items-center gap-1.5 p-2 md:px-3.5 md:py-2 text-xs font-semibold text-amber-300 bg-[#0B101B]/90 hover:bg-[#162033] border border-amber-400/40 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  aria-label="Open Armory"
                >
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span className="hidden md:inline">Armory [I]</span>
                </button>

                <button
                  onClick={() => setIsLevelModalOpen(true)}
                  className="hidden sm:flex items-center gap-1.5 p-2 md:px-3.5 md:py-2 text-xs font-semibold text-white bg-[#0B101B]/90 hover:bg-[#162033] border border-white/15 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  aria-label="Open Levels"
                >
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span className="hidden md:inline">Levels [L]</span>
                </button>

                <button
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="flex items-center gap-1.5 p-2 md:px-3.5 md:py-2 text-xs font-semibold text-white bg-[#0B101B]/90 hover:bg-[#162033] border border-emerald-400/40 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  aria-label="Open Calibration & Settings"
                >
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span className="hidden md:inline">Calibration [K]</span>
                </button>

                <button
                  onClick={() => setIsScriptModalOpen(true)}
                  className="hidden sm:flex items-center gap-1.5 p-2 md:px-3.5 md:py-2 text-xs font-semibold text-white bg-[#0B101B]/90 hover:bg-[#162033] border border-sky-400/50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  aria-label="Inspect Unity C# Scripts"
                >
                  <Code2 className="w-4 h-4 text-sky-400" />
                  <span className="hidden md:inline">Unity C# [C]</span>
                </button>
              </div>
            </div>
          </div>

          {/* Center Dynamic Bow Sight Reticle */}
          <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-10">
            <div className="relative flex items-center justify-center">
              <svg width="64" height="64" viewBox="0 0 64 64" className="overflow-visible">
                <circle
                  cx="32"
                  cy="32"
                  r="20"
                  fill="none"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="1.5"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="20"
                  fill="none"
                  stroke={activeArrowCfg.primaryHex}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={125.6}
                  strokeDashoffset={125.6 * (1 - telemetry.drawPercent / 100)}
                  transform="rotate(-90 32 32)"
                />
                <circle cx="32" cy="32" r="2.2" fill={activeArrowCfg.primaryHex} />
                <line x1="29" y1="40" x2="35" y2="40" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
                <line x1="30" y1="46" x2="34" y2="46" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
              </svg>

              {telemetry.drawPercent > 5 && (
                <div className="absolute top-14 whitespace-nowrap text-[11px] font-mono font-semibold text-white bg-[#0B101B]/90 px-2 py-0.5 rounded border border-white/10 tabular-nums">
                  {telemetry.drawPercent}% Draw · {telemetry.launchSpeedMs} m/s
                </div>
              )}
            </div>
          </div>

          {/* Floating 3D-Projected Combat Popups */}
          <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
            {scorePopups.map((p) => {
              const cfg = ARROW_TYPES[p.arrowType];
              return (
                <div
                  key={p.id}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 bg-[#0B101B]/95 border border-white/15 px-3 py-1.5 rounded-lg shadow-lg transition-all duration-300"
                >
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold tabular-nums">
                    {p.points > 0 && <span style={{ color: cfg.primaryHex }}>+{p.points}</span>}
                    <span className="text-white">{p.ringLabel}</span>
                  </div>
                  {p.detailText && (
                    <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                      {p.detailText}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 3. BOTTOM ARROW QUIVER & UTILITY DOCK */}
          {mobileControlsActive ? (
            /* Mobile-Ergonomic Compact Quiver Bar: above thumbs in portrait, centered between thumbs in landscape */
            <div className="fixed bottom-[154px] sm:bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(420px,calc(100vw-20px))] sm:w-[min(320px,calc(100vw-330px))] md:w-[min(390px,calc(100vw-370px))] pointer-events-auto">
              {showMobileTools && (
                <div className="mb-1.5 flex items-center justify-center gap-1.5 bg-[#0B101B]/95 border border-white/15 rounded-lg p-1.5 shadow-xl">
                  <button
                    onClick={() => setShowTrajectoryArc((prev) => !prev)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 bg-[#070B12] border border-white/10 rounded-md cursor-pointer"
                  >
                    {showTrajectoryArc ? <Eye className="w-3.5 h-3.5 text-sky-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{showTrajectoryArc ? 'Arc On' : 'Arc Off'}</span>
                  </button>
                  <button
                    onClick={handleCycleWind}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 bg-[#070B12] border border-white/10 rounded-md cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    <span>Wind {windSpeedX === 0 ? '0' : windSpeedX.toFixed(1)}</span>
                  </button>
                  <button
                    onClick={() => startLevel(currentLevel, true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 bg-[#070B12] border border-white/10 rounded-md cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-300" />
                    <span>Restart</span>
                  </button>
                  <button
                    onClick={handleToggleMute}
                    className="p-1.5 text-slate-200 bg-[#070B12] border border-white/10 rounded-md cursor-pointer"
                    aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                </div>
              )}

              <div className="bg-[#0B101B]/90 border border-white/15 rounded-xl p-1.5 shadow-xl flex items-center gap-1">
                <div className="grid grid-cols-5 gap-1 flex-1 min-w-0">
                  {ARROW_TYPE_LIST.map((arr) => {
                    const isSelected = arr.id === selectedArrowType;
                    const shortLabel = arr.name.split(' ')[0];
                    return (
                      <button
                        key={arr.id}
                        onClick={() => handleSelectArrow(arr.id)}
                        className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border transition-colors cursor-pointer min-w-0 ${
                          isSelected
                            ? 'bg-[#162033] border-sky-400 text-white'
                            : 'bg-[#070B12]/90 border-white/10 text-slate-400'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-xs mb-0.5 shrink-0"
                          style={{ backgroundColor: arr.primaryHex }}
                        />
                        <span className="text-[10px] font-mono font-bold truncate w-full text-center">
                          {shortLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowMobileTools((prev) => !prev)}
                  className={`px-2 py-2 rounded-lg border text-[10px] font-mono font-bold shrink-0 cursor-pointer ${
                    showMobileTools
                      ? 'bg-sky-400 text-slate-950 border-sky-400'
                      : 'bg-[#070B12] text-slate-300 border-white/10'
                  }`}
                  aria-label="Toggle Range Tools"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(940px,94vw)] transition-transform duration-200 pointer-events-auto ${
                isDockCollapsed ? 'translate-y-[calc(100%-28px)]' : 'translate-y-0'
              }`}
            >
              <div className="flex justify-center mb-1">
                <button
                  onClick={() => setIsDockCollapsed((prev) => !prev)}
                  className="px-3.5 py-1 text-[11px] font-mono font-medium text-slate-300 hover:text-white bg-[#0B101B]/95 border border-white/15 rounded-t-lg cursor-pointer"
                >
                  {isDockCollapsed ? '▴ Show Quiver & Controls [H]' : '▾ Hide Controls [H]'}
                </button>
              </div>

              <div className="bg-[#0B101B]/95 border border-white/15 rounded-xl p-3.5 shadow-2xl">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                  {ARROW_TYPE_LIST.map((arr) => {
                    const isSelected = arr.id === selectedArrowType;
                    return (
                      <button
                        key={arr.id}
                        onClick={() => handleSelectArrow(arr.id)}
                        className={`flex flex-col justify-between p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#162033] border-sky-400 text-white'
                            : 'bg-[#070B12] border-white/10 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold truncate">
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: arr.primaryHex }}
                            />
                            <span className="truncate">{arr.name}</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            [{arr.hotkey}]
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 truncate mb-1">
                          {arr.shortTag}
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 tabular-nums pt-1 border-t border-white/5">
                          <span>{arr.baseDamage} DMG</span>
                          <span>{arr.muzzleVelocity} m/s</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-white/10 text-xs">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-slate-300 tabular-nums">
                    <span className="font-semibold" style={{ color: activeArrowCfg.primaryHex }}>
                      {activeArrowCfg.name}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{activeArrowCfg.specialAbilityLabel}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowTrajectoryArc((prev) => !prev)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#070B12] hover:bg-slate-800 border border-white/10 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {showTrajectoryArc ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-sky-400" />
                          <span>Arc On</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                          <span>Arc Off</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleCycleWind}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#070B12] hover:bg-slate-800 border border-white/10 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Compass className="w-3.5 h-3.5 text-sky-400" />
                      <span>Shift Wind</span>
                    </button>

                    <button
                      onClick={() => startLevel(currentLevel, true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#070B12] hover:bg-slate-800 border border-white/10 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-300" />
                      <span>Restart</span>
                    </button>

                    <button
                      onClick={handleToggleMute}
                      className="p-1.5 text-slate-300 hover:text-white bg-[#070B12] hover:bg-slate-800 border border-white/10 rounded-lg transition-colors cursor-pointer"
                      aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3B. MULTI-TOUCH MOBILE CONTROLS OVERLAY */}
          <MobileControlsOverlay
            visible={gameState === 'playing' && !anyModalOpen && mobileControlsActive}
            drawPercent={telemetry.drawPercent}
            arrowPrimaryHex={activeArrowCfg.primaryHex}
            isCrouched={isCrouchedState}
            mobileInputRef={mobileInputRef}
            mobileBridgeRef={mobileBridgeRef}
          />
        </>
      )}

      {/* 4. PAUSE MODAL */}
      {gameState === 'paused' && !anyModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6 bg-black/75 pointer-events-auto">
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#0B101B] border border-white/15 rounded-xl p-5 sm:p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-white font-display mb-1">
              Simulation Paused
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              Season {seasonConfig.id}: {seasonConfig.name} · Level {currentLevel} ({levelConfig.title})
            </p>

            <div className="bg-[#070B12] border border-white/10 rounded-lg p-4 mb-6 space-y-2 text-xs font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-400">Player Health</span>
                <span className="text-emerald-400 font-bold">
                  {playerHp} / {defenseStats.maxHp} HP
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Warriors Slain / Limit</span>
                <span className="text-amber-400 font-bold">
                  {enemiesDefeatedCount} / {levelEnemyLimit} ({enemiesRemaining} active)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Headshots (2.5x)</span>
                <span className="text-sky-300 font-bold">{headshotsCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Accuracy</span>
                <span className="text-white font-bold">
                  {shotsFired > 0 ? Math.round((hitsCount / shotsFired) * 100) : 0}% ({hitsCount}/
                  {shotsFired})
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setGameState('playing')}
                className="w-full py-2.5 px-4 text-xs font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors cursor-pointer"
              >
                Resume Combat [Esc]
              </button>
              <button
                onClick={() => setIsArmoryModalOpen(true)}
                className="w-full py-2.5 px-4 text-xs font-semibold text-amber-300 bg-[#162033] hover:bg-slate-800 border border-amber-400/40 rounded-lg transition-colors cursor-pointer"
              >
                Ancient Armory ({coins} Coins) [I]
              </button>
              <button
                onClick={() => setIsLevelModalOpen(true)}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#162033] hover:bg-slate-800 border border-white/15 rounded-lg transition-colors cursor-pointer"
              >
                5 Seasons / 50 Levels [L]
              </button>
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#162033] hover:bg-slate-800 border border-emerald-400/40 rounded-lg transition-colors cursor-pointer"
              >
                Calibration & Settings [K]
              </button>
              <button
                onClick={() => setIsScriptModalOpen(true)}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#162033] hover:bg-slate-800 border border-sky-400/40 rounded-lg transition-colors cursor-pointer"
              >
                Inspect Unity C# Scripts (28 Files)
              </button>
              <button
                onClick={() => startLevel(currentLevel, true)}
                className="w-full py-2.5 px-4 text-xs font-semibold text-slate-300 hover:text-white bg-[#070B12] hover:bg-slate-900 border border-white/10 rounded-lg transition-colors cursor-pointer"
              >
                Restart Level {currentLevel}
              </button>
              <button
                onClick={() => setGameState('title')}
                className="w-full py-2.5 px-4 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4B. LEVEL COMPLETE OVERLAY */}
      {gameState === 'level_complete' && !anyModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6 bg-black/75 pointer-events-auto">
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#0B101B] border border-emerald-400/35 rounded-xl p-5 sm:p-6 shadow-2xl text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-400/30 mb-3">
              <Trophy className="w-6 h-6 text-emerald-400" />
            </div>

            <div className="text-xs font-mono text-emerald-400 mb-1">
              SEASON {seasonConfig.id}: {seasonConfig.name.toUpperCase()} · {seasonConfig.difficulty.toUpperCase()}
            </div>
            <h2 className="text-2xl font-bold text-white font-display mb-1">
              {currentLevel === 50
                ? 'Grandmaster Campaign Complete!'
                : `Level ${currentLevel} Cleared & Extracted`}
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              {levelConfig.title} · Ending Line Reached (+30 Bonus Coins)
            </p>

            {/* 1-3 Stars Row (based on HP remaining) */}
            <div className="flex items-center justify-center gap-2 mb-5">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  className={`w-7 h-7 ${
                    s <= earnedStars ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                  }`}
                />
              ))}
            </div>

            <div className="bg-[#070B12] border border-white/10 rounded-lg p-4 mb-5 space-y-2 text-xs font-mono tabular-nums text-left">
              <div className="flex justify-between">
                <span className="text-slate-400">HP Remaining</span>
                <span className="text-emerald-400 font-bold">
                  {playerHp} / {defenseStats.maxHp} ({hpPercent}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Coins Earned</span>
                <span className="text-amber-300 font-bold">+{levelCoinsEarned} Coins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Critical Headshots</span>
                <span className="text-sky-300 font-bold">{headshotsCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Campaign Stars</span>
                <span className="text-amber-400 font-bold">★ {totalStarsEarned} / 150</span>
              </div>
            </div>

            {!canAdvanceToNextLevel && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-400/30 text-xs text-rose-300">
                Season {nextSeason.id} ({nextSeason.name}) requires{' '}
                <strong>{nextSeason.requiredStarsToUnlock} Stars</strong> to unlock. Replay earlier
                levels for 3★ HP ratings!
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {canAdvanceToNextLevel ? (
                <button
                  onClick={() => startLevel(nextLevel, true)}
                  className="w-full py-3 px-4 flex items-center justify-center gap-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
                >
                  <span>
                    {currentLevel < 50 ? `Next Level (${nextLevel}/50)` : 'Play Again from Level 1'}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setIsLevelModalOpen(true)}
                  className="w-full py-3 px-4 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer"
                >
                  Select Level to Earn More Stars
                </button>
              )}

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => startLevel(currentLevel, true)}
                  className="py-2.5 px-2 text-xs font-semibold text-white bg-[#162033] hover:bg-slate-800 border border-white/15 rounded-lg transition-colors cursor-pointer"
                >
                  Replay
                </button>
                <button
                  onClick={() => setIsArmoryModalOpen(true)}
                  className="py-2.5 px-2 text-xs font-semibold text-amber-300 bg-[#162033] hover:bg-slate-800 border border-amber-400/35 rounded-lg transition-colors cursor-pointer"
                >
                  Armory
                </button>
                <button
                  onClick={() => setIsLevelModalOpen(true)}
                  className="py-2.5 px-2 text-xs font-semibold text-sky-300 bg-[#162033] hover:bg-slate-800 border border-sky-400/35 rounded-lg transition-colors cursor-pointer"
                >
                  Levels
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4C. PLAYER DEFEATED OVERLAY */}
      {gameState === 'level_failed' && !anyModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6 bg-black/75 pointer-events-auto">
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#0B101B] border border-rose-500/40 rounded-xl p-5 sm:p-6 shadow-2xl text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/15 border border-rose-400/30 mb-3">
              <Skull className="w-6 h-6 text-rose-400" />
            </div>

            <div className="text-xs font-mono text-rose-400 mb-1">
              BARRICADE BREACHED · LEVEL {currentLevel} ({seasonConfig.name})
            </div>
            <h2 className="text-2xl font-bold text-white font-display mb-1">You Were Defeated</h2>
            <p className="text-xs text-slate-400 mb-5">
              Upgrade your armor & helmet in the Armory using coins earned in combat, or counter shields with Thermite & Volt arrows.
            </p>

            <div className="bg-[#070B12] border border-white/10 rounded-lg p-4 mb-6 space-y-2 text-xs font-mono tabular-nums text-left">
              <div className="flex justify-between">
                <span className="text-slate-400">Coins Kept</span>
                <span className="text-amber-300 font-bold">+{levelCoinsEarned} ({coins} total)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Warriors Slain / Limit</span>
                <span className="text-rose-400 font-bold">
                  {enemiesDefeatedCount} / {levelEnemyLimit} ({enemiesRemaining} active)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recommended Arrow</span>
                <span className="text-sky-300 font-bold">
                  {ARROW_TYPES[levelConfig.recommendedArrow].name}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => startLevel(currentLevel, true)}
                className="w-full py-3 px-4 flex items-center justify-center gap-2 text-xs font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry Level {currentLevel} [R]</span>
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setIsArmoryModalOpen(true)}
                  className="py-2.5 px-3 text-xs font-semibold text-amber-300 bg-[#162033] hover:bg-slate-800 border border-amber-400/35 rounded-lg transition-colors cursor-pointer"
                >
                  Open Armory [I]
                </button>
                <button
                  onClick={() => setIsLevelModalOpen(true)}
                  className="py-2.5 px-3 text-xs font-semibold text-white bg-[#162033] hover:bg-slate-800 border border-white/15 rounded-lg transition-colors cursor-pointer"
                >
                  50 Levels [L]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. UNITY C# SCRIPT INSPECTOR MODAL */}
      <UnityScriptModal
        isOpen={isScriptModalOpen}
        onClose={() => setIsScriptModalOpen(false)}
        selectedArrowType={selectedArrowType}
        onSelectArrowType={handleSelectArrow}
      />

      {/* 6. SETTINGS & CALIBRATION MODAL */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        calibration={calibration}
        onChangeCalibration={setCalibration}
        showTrajectoryArc={showTrajectoryArc}
        onToggleTrajectoryArc={() => setShowTrajectoryArc((prev) => !prev)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        windSpeedX={windSpeedX}
        onCycleWind={handleCycleWind}
      />

      {/* 7. 5 SEASONS / 50 LEVELS SELECTOR MODAL */}
      <LevelSelectModal
        isOpen={isLevelModalOpen}
        onClose={() => setIsLevelModalOpen(false)}
        currentLevel={currentLevel}
        maxUnlockedLevel={maxUnlockedLevel}
        unlockAllLevels={unlockAllLevels}
        onToggleUnlockAll={() => setUnlockAllLevels((prev) => !prev)}
        progressByLevel={progressByLevel}
        onSelectLevel={(lvl) => startLevel(lvl, true)}
      />

      {/* 8. ANCIENT ARMORY MODAL */}
      <ArmoryModal
        isOpen={isArmoryModalOpen}
        onClose={() => setIsArmoryModalOpen(false)}
        coins={coins}
        ownedGearIds={ownedGearIds}
        equippedArmorId={equippedArmorId}
        equippedHelmetId={equippedHelmetId}
        onPurchaseAndEquip={handlePurchaseAndEquip}
        onEquip={handleEquipGear}
      />
    </div>
  );
}
