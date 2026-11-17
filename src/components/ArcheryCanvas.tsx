import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ARROW_TYPE_LIST,
  ARROW_TYPES,
  ArrowTypeId,
  CalibrationSettings,
  GameState,
  HITBOX_MULTIPLIERS,
  HitboxZone,
  ImpactMaterial,
  LevelConfig,
  LiveBallisticsTelemetry,
  ScorePopup,
  SeasonConfig,
} from '../types/archery';
import {
  ARROW_TIP_OFFSET,
  ArmoredEnemyEntity,
  BowModelHandle,
  CoverObstacle,
  createAlpineEnvironment,
  createArmoredEnemyModel,
  createArrowModel,
  createEnemyJavelinModel,
  createVRBowModel,
  groundHeightAt,
} from '../three/proceduralModels';
import { createWebXRRig, WebXRRigHandle } from '../three/webxrVrRig';
import { getLevelConcurrentLimit, getLevelEnemyLimit } from '../data/campaignLevels';
import { soundEngine } from '../audio/soundEngine';

interface ArcheryCanvasProps {
  gameState: GameState;
  selectedArrowType: ArrowTypeId;
  windSpeedX: number;
  showTrajectoryArc: boolean;
  calibration: CalibrationSettings;
  seasonConfig: SeasonConfig;
  levelConfig: LevelConfig;
  playerHp: number;
  maxPlayerHp: number;
  equippedArmorPrimaryHex: string;
  equippedArmorTrimHex: string;
  earnedStars?: number;
  coins?: number;
  clearArrowsSignal: number;
  vrToggleRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  onVrStateChange?: (isInVr: boolean) => void;
  onSelectArrowFromVr?: (arrowType: ArrowTypeId) => void;
  onVrOutcomeAction?: () => void;
  onScoreHit: (
    points: number,
    ringLabel: string,
    isCritical: boolean,
    damage: number,
    distance: number,
    material: ImpactMaterial,
    coinsEarned: number,
    popup: Omit<ScorePopup, 'id'>
  ) => void;
  onEnemyDefeated: (enemyId: number, enemiesRemaining: number, headshotKill: boolean) => void;
  onEnemySpawned?: (aliveCount: number) => void;
  onPlayerDamaged: (rawDamage: number, sourceLabel: string) => void;
  onShotFired: () => void;
  onUpdateTelemetry: (telemetry: LiveBallisticsTelemetry) => void;
}

interface FlyingArrow {
  audioId: number;
  mesh: THREE.Group;
  type: ArrowTypeId;
  velocity: THREE.Vector3;
  prevTipPos: THREE.Vector3;
  drawTension: number;
  flightTime: number;
  hasSplit: boolean;
  active: boolean;
}

interface IncomingJavelin {
  mesh: THREE.Group;
  colliderMesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  active: boolean;
}

interface ShockwaveVfx {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  maxRadius: number;
  age: number;
  duration: number;
}

interface LightningBoltVfx {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  age: number;
  duration: number;
}

interface BurstParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
}

// Reusable module-scope math objects (Zero GC in render loop)
const _forward = new THREE.Vector3(0, 0, -1);
const _up = new THREE.Vector3(0, 1, 0);
const _prevTip = new THREE.Vector3();
const _currTip = new THREE.Vector3();
const _stepVec = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _screenProj = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _tmpVec = new THREE.Vector3();
const _losDir = new THREE.Vector3();
const _enemyEyePos = new THREE.Vector3();
const _prevJavPos = new THREE.Vector3();
const _camWorldPos = new THREE.Vector3();
const _camWorldQuat = new THREE.Quaternion();
const _vrAimDir = new THREE.Vector3();
const _vrBowUp = new THREE.Vector3();
const _vrAimTarget = new THREE.Vector3();
const _vrMat4 = new THREE.Matrix4();

function resolveCircleRectPushout(
  x: number,
  z: number,
  radius: number,
  obs: CoverObstacle
): { x: number; z: number; collided: boolean } {
  const closestX = THREE.MathUtils.clamp(x, obs.x - obs.halfWidth, obs.x + obs.halfWidth);
  const closestZ = THREE.MathUtils.clamp(z, obs.z - obs.halfDepth, obs.z + obs.halfDepth);
  const dx = x - closestX;
  const dz = z - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= radius * radius) {
    return { x, z, collided: false };
  }

  if (distSq > 0.00001) {
    const dist = Math.sqrt(distSq);
    const overlap = radius - dist;
    return {
      x: x + (dx / dist) * overlap,
      z: z + (dz / dist) * overlap,
      collided: true,
    };
  }

  const penLeft = Math.abs(x - (obs.x - obs.halfWidth));
  const penRight = Math.abs(obs.x + obs.halfWidth - x);
  const penBack = Math.abs(z - (obs.z - obs.halfDepth));
  const penFront = Math.abs(obs.z + obs.halfDepth - z);
  const minPen = Math.min(penLeft, penRight, penBack, penFront);

  if (minPen === penLeft) return { x: obs.x - obs.halfWidth - radius, z, collided: true };
  if (minPen === penRight) return { x: obs.x + obs.halfWidth + radius, z, collided: true };
  if (minPen === penBack) return { x, z: obs.z - obs.halfDepth - radius, collided: true };
  return { x, z: obs.z + obs.halfDepth + radius, collided: true };
}

function findBlockingObstacle(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  pad: number,
  obstacles: CoverObstacle[]
): CoverObstacle | null {
  const dx = bx - ax;
  const dz = bz - az;
  let bestT = 1.0;
  let bestObs: CoverObstacle | null = null;

  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    const minX = obs.x - obs.halfWidth - pad;
    const maxX = obs.x + obs.halfWidth + pad;
    const minZ = obs.z - obs.halfDepth - pad;
    const maxZ = obs.z + obs.halfDepth + pad;

    let tMin = 0.0;
    let tMax = 1.0;

    if (Math.abs(dx) < 1e-6) {
      if (ax < minX || ax > maxX) continue;
    } else {
      const invDx = 1 / dx;
      let t1 = (minX - ax) * invDx;
      let t2 = (maxX - ax) * invDx;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) continue;
    }

    if (Math.abs(dz) < 1e-6) {
      if (az < minZ || az > maxZ) continue;
    } else {
      const invDz = 1 / dz;
      let t1 = (minZ - az) * invDz;
      let t2 = (maxZ - az) * invDz;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) continue;
    }

    if (tMin < bestT && tMax > 0.0) {
      bestT = tMin;
      bestObs = obs;
    }
  }

  return bestObs;
}

export const ArcheryCanvas: React.FC<ArcheryCanvasProps> = ({
  gameState,
  selectedArrowType,
  windSpeedX,
  showTrajectoryArc,
  calibration,
  seasonConfig,
  levelConfig,
  playerHp,
  maxPlayerHp,
  equippedArmorPrimaryHex,
  equippedArmorTrimHex,
  earnedStars = 0,
  coins = 0,
  clearArrowsSignal,
  vrToggleRef,
  onVrStateChange,
  onSelectArrowFromVr,
  onVrOutcomeAction,
  onScoreHit,
  onEnemyDefeated,
  onEnemySpawned,
  onPlayerDamaged,
  onShotFired,
  onUpdateTelemetry,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gaugeFillRef = useRef<HTMLDivElement | null>(null);
  const gaugePercentRef = useRef<HTMLSpanElement | null>(null);
  const gaugeVelocityRef = useRef<HTMLSpanElement | null>(null);
  const gaugeTierRef = useRef<HTMLSpanElement | null>(null);
  const damageFlashRef = useRef<HTMLDivElement | null>(null);
  const stanceBadgeRef = useRef<HTMLDivElement | null>(null);
  const stanceDotRef = useRef<HTMLSpanElement | null>(null);
  const stanceLabelRef = useRef<HTMLSpanElement | null>(null);
  const stanceSubRef = useRef<HTMLSpanElement | null>(null);

  const stateRef = useRef({
    gameState,
    selectedArrowType,
    windSpeedX,
    showTrajectoryArc,
    calibration,
    seasonConfig,
    levelConfig,
    playerHp,
    maxPlayerHp,
    equippedArmorPrimaryHex,
    equippedArmorTrimHex,
    earnedStars,
    coins,
    onVrStateChange,
    onSelectArrowFromVr,
    onVrOutcomeAction,
    onScoreHit,
    onEnemyDefeated,
    onEnemySpawned,
    onPlayerDamaged,
    onShotFired,
    onUpdateTelemetry,
  });

  useEffect(() => {
    stateRef.current = {
      gameState,
      selectedArrowType,
      windSpeedX,
      showTrajectoryArc,
      calibration,
      seasonConfig,
      levelConfig,
      playerHp,
      maxPlayerHp,
      equippedArmorPrimaryHex,
      equippedArmorTrimHex,
      earnedStars,
      coins,
      onVrStateChange,
      onSelectArrowFromVr,
      onVrOutcomeAction,
      onScoreHit,
      onEnemyDefeated,
      onEnemySpawned,
      onPlayerDamaged,
      onShotFired,
      onUpdateTelemetry,
    };
  }, [
    gameState,
    selectedArrowType,
    windSpeedX,
    showTrajectoryArc,
    calibration,
    seasonConfig,
    levelConfig,
    playerHp,
    maxPlayerHp,
    equippedArmorPrimaryHex,
    equippedArmorTrimHex,
    earnedStars,
    coins,
    onVrStateChange,
    onSelectArrowFromVr,
    onVrOutcomeAction,
    onScoreHit,
    onEnemyDefeated,
    onEnemySpawned,
    onPlayerDamaged,
    onShotFired,
    onUpdateTelemetry,
  ]);

  const swapNockedArrowRef = useRef<((newType: ArrowTypeId) => void) | null>(null);
  const clearStuckArrowsRef = useRef<(() => void) | null>(null);
  const rebuildLevelRef = useRef<((lvl: LevelConfig, season: SeasonConfig) => void) | null>(null);

  useEffect(() => {
    if (swapNockedArrowRef.current) {
      swapNockedArrowRef.current(selectedArrowType);
    }
  }, [selectedArrowType]);

  useEffect(() => {
    if (clearArrowsSignal > 0 && clearStuckArrowsRef.current) {
      clearStuckArrowsRef.current();
    }
  }, [clearArrowsSignal]);

  useEffect(() => {
    if (rebuildLevelRef.current) {
      rebuildLevelRef.current(levelConfig, seasonConfig);
    }
  }, [levelConfig, seasonConfig]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    // Scene & Dynamic Seasonal Sky/Fog
    const scene = new THREE.Scene();
    const initialAtmo = stateRef.current.seasonConfig.atmosphere;
    const fogColor = new THREE.Color(initialAtmo.fogHex);
    const expFog = new THREE.FogExp2(initialAtmo.fogHex, initialAtmo.fogDensity);
    scene.background = fogColor;
    scene.fog = expFog;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Camera + WebXR Player Rig
    const camera = new THREE.PerspectiveCamera(
      62,
      container.clientWidth / container.clientHeight,
      0.08,
      240
    );
    camera.position.set(0, 1.68, 0);
    const vrRig: WebXRRigHandle = createWebXRRig(renderer, scene, camera, (presenting) => {
      if (presenting) {
        vrRig.bowMountGroup.add(bowHandle.group);
        bowHandle.group.position.set(0, 0, 0);
        bowHandle.group.rotation.set(0, 0, 0);
        vrRig.playerRig.rotation.y = 0;
      } else {
        bowHandle.group.position.set(0.24, -0.15, -0.48);
        bowHandle.group.rotation.set(0.02, 0.06, -0.08);
        camera.add(bowHandle.group);
        vrRig.playerRig.rotation.y = 0;
      }
      stateRef.current.onVrStateChange?.(presenting);
    });

    if (vrToggleRef) {
      vrToggleRef.current = async () => {
        if (vrRig.isPresenting()) {
          await vrRig.exitVR();
        } else {
          await vrRig.enterVR();
        }
      };
    }

    // 3-Point Seasonal Lighting
    const hemiLight = new THREE.HemisphereLight(
      initialAtmo.hemiSkyHex,
      initialAtmo.hemiGroundHex,
      initialAtmo.hemiIntensity
    );
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);

    const keySunLight = new THREE.DirectionalLight(initialAtmo.sunHex, initialAtmo.sunIntensity);
    keySunLight.position.set(18, 28, 16);
    keySunLight.castShadow = !isSoftwareGl;
    keySunLight.shadow.mapSize.width = isSoftwareGl ? 1024 : 2048;
    keySunLight.shadow.mapSize.height = isSoftwareGl ? 1024 : 2048;
    const d = 44;
    keySunLight.shadow.camera.left = -d;
    keySunLight.shadow.camera.right = d;
    keySunLight.shadow.camera.top = d;
    keySunLight.shadow.camera.bottom = -d;
    keySunLight.shadow.camera.near = 1;
    keySunLight.shadow.camera.far = 110;
    keySunLight.shadow.bias = -0.0005;
    keySunLight.shadow.normalBias = 0.02;
    scene.add(keySunLight);

    const rimLight = new THREE.DirectionalLight(initialAtmo.rimHex, initialAtmo.rimIntensity);
    rimLight.position.set(-14, 12, -35);
    scene.add(rimLight);

    // Environment, Tactical 3D Cover Walls, Starting/Ending Lines & 8K PBR Terrain
    const {
      coverObstacles,
      coverColliders,
      startLineZ,
      finishLineZ,
      applySeasonAtmosphere,
      updateEnvironment,
    } = createAlpineEnvironment(scene, renderer.capabilities.getMaxAnisotropy());
    applySeasonAtmosphere(stateRef.current.seasonConfig.id);

    // Dynamic Armored Enemy Wave Container
    const enemiesContainer = new THREE.Group();
    scene.add(enemiesContainer);

    const enemies: ArmoredEnemyEntity[] = [];
    const enemyHitboxMeshes: THREE.Mesh[] = [];
    const incomingJavelins: IncomingJavelin[] = [];
    let nextReinforcementId = 100;
    let totalSpawnedInLevel = 0;
    let reinforcementTimer = 3.2;

    const populateLevelEnemies = (lvl: LevelConfig) => {
      while (enemiesContainer.children.length > 0) {
        enemiesContainer.remove(enemiesContainer.children[0]);
      }
      enemies.length = 0;
      enemyHitboxMeshes.length = 0;
      nextReinforcementId = Math.max(100, lvl.enemies.length + 10);
      totalSpawnedInLevel = lvl.enemies.length;
      reinforcementTimer = 3.2;

      lvl.enemies.forEach((spec) => {
        const entity = createArmoredEnemyModel(spec);
        enemies.push(entity);
        enemiesContainer.add(entity.rootGroup);
        entity.hitboxMeshes.forEach((m) => enemyHitboxMeshes.push(m));
      });
    };

    const spawnReinforcementEnemy = (lvl: LevelConfig, currentPlayerZ: number) => {
      const totalLimit = getLevelEnemyLimit(lvl.level);
      if (totalSpawnedInLevel >= totalLimit) return;

      const templates = lvl.enemies;
      if (!templates || templates.length === 0) return;
      const tpl = templates[nextReinforcementId % templates.length];
      const spawnX = THREE.MathUtils.clamp((Math.random() - 0.5) * 12.4, -7.2, 7.2);
      // Spawn beyond the Ending Line Gate marching toward the player up to the level enemy limit
      const deepGateZ = Math.min(finishLineZ - 4.5, currentPlayerZ - 14.5) - Math.random() * 8.5;
      const spawnZ = THREE.MathUtils.clamp(deepGateZ, -46, finishLineZ - 3.5);

      const newId = nextReinforcementId++;
      totalSpawnedInLevel++;
      const entity = createArmoredEnemyModel({
        ...tpl,
        id: newId,
        x: spawnX,
        z: spawnZ,
      });
      enemies.push(entity);
      enemiesContainer.add(entity.rootGroup);
      entity.hitboxMeshes.forEach((m) => enemyHitboxMeshes.push(m));

      const aliveNow = enemies.filter((e) => e.aiState !== 'defeated').length;
      stateRef.current.onEnemySpawned?.(aliveNow);
    };

    populateLevelEnemies(stateRef.current.levelConfig);

    // Bow & Diegetic Wrist/Riser UI attached to Camera
    const bowHandle: BowModelHandle = createVRBowModel();
    bowHandle.group.position.set(0.24, -0.15, -0.48);
    bowHandle.group.rotation.set(0.02, 0.06, -0.08);
    camera.add(bowHandle.group);

    let nockedArrowMesh: THREE.Group | null = null;
    const rebuildNockedArrow = (type: ArrowTypeId) => {
      if (nockedArrowMesh) {
        bowHandle.nockSocketGroup.remove(nockedArrowMesh);
      }
      nockedArrowMesh = createArrowModel(type);
      bowHandle.nockSocketGroup.add(nockedArrowMesh);
      bowHandle.updateBowDraw(
        drawDistance,
        MAX_DRAW_DISTANCE,
        ARROW_TYPES[type].primaryHex
      );
    };

    // Trajectory Preview Line
    const TRAJ_STEPS = 32;
    const trajPositions = new Float32Array(TRAJ_STEPS * 3);
    const trajGeo = new THREE.BufferGeometry();
    trajGeo.setAttribute('position', new THREE.BufferAttribute(trajPositions, 3));
    const trajMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
    });
    const trajLine = new THREE.Line(trajGeo, trajMat);
    trajLine.frustumCulled = false;
    trajLine.visible = false;
    scene.add(trajLine);

    // VFX & Arrow Pools
    const flyingArrows: FlyingArrow[] = [];
    const stuckArrows: THREE.Object3D[] = [];
    const shockwaves: ShockwaveVfx[] = [];
    const lightningBolts: LightningBoltVfx[] = [];
    const particles: BurstParticle[] = [];
    const particleGeo = new THREE.OctahedronGeometry(0.06, 0);
    const javelinColliderGeo = new THREE.SphereGeometry(0.28, 8, 8);

    const spawnParticleBurst = (
      origin: THREE.Vector3,
      hexColor: string,
      count: number,
      speedScale: number = 1
    ) => {
      const mat = new THREE.MeshBasicMaterial({ color: hexColor });
      for (let i = 0; i < count; i++) {
        const pMesh = new THREE.Mesh(particleGeo, mat);
        pMesh.position.copy(origin);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const speed = (2.2 + Math.random() * 5.5) * speedScale;
        const vel = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.abs(Math.cos(phi)) * speed + 1.5,
          Math.sin(phi) * Math.sin(theta) * speed
        );
        scene.add(pMesh);
        particles.push({ mesh: pMesh, velocity: vel, age: 0, maxAge: 0.45 + Math.random() * 0.35 });
      }
    };

    const spawnShockwaveSphere = (origin: THREE.Vector3, radius: number, hexColor: string) => {
      const geo = new THREE.SphereGeometry(1, 20, 16);
      const mat = new THREE.MeshBasicMaterial({
        color: hexColor,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(origin);
      mesh.scale.setScalar(0.1);
      scene.add(mesh);
      shockwaves.push({ mesh, mat, maxRadius: radius, age: 0, duration: 0.42 });
    };

    const spawnLightningArc = (start: THREE.Vector3, end: THREE.Vector3) => {
      const segments = 9;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const pt = new THREE.Vector3().lerpVectors(start, end, t);
        if (i > 0 && i < segments) {
          pt.x += (Math.random() - 0.5) * 0.65;
          pt.y += (Math.random() - 0.5) * 0.65;
          pt.z += (Math.random() - 0.5) * 0.45;
        }
        pts.push(pt);
      }
      const lGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lMat = new THREE.LineBasicMaterial({
        color: 0xd8b4fe,
        transparent: true,
        opacity: 1,
      });
      const line = new THREE.Line(lGeo, lMat);
      scene.add(line);
      lightningBolts.push({ line, mat: lMat, age: 0, duration: 0.32 });
    };

    // Interaction, 3D Locomotion & Combat State
    const MAX_DRAW_DISTANCE = 0.65;
    let isDrawing = false;
    let drawDistance = 0;
    let lastDrawTickSoundDist = 0;
    let targetYaw = 0;
    let targetPitch = 0.03;
    let currentYaw = 0;
    let currentPitch = 0.03;
    let hitstopTimer = 0;
    let cameraShakeIntensity = 0;
    let damageFlashAlpha = 0;
    let lastTelemetryPush = 0;
    let nextArrowAudioId = 1;

    // 3D Player Locomotion State (WASD Left/Right/Forward/Back + Shift Run + X/Q Crouch/Hide)
    const keysDown = new Set<string>();
    const playerPos = new THREE.Vector3(0, 0, startLineZ);
    let playerVelX = 0;
    let playerVelZ = 0;
    let isCrouched = false;
    let currentEyeHeight = 1.68;
    let walkBobPhase = 0;
    let lastStanceKey = '';

    const _bowWorldPos = new THREE.Vector3();
    const _camFwd = new THREE.Vector3();
    const _camUp = new THREE.Vector3();

    rebuildNockedArrow(stateRef.current.selectedArrowType);
    swapNockedArrowRef.current = rebuildNockedArrow;

    const clearRangeProjectiles = () => {
      while (flyingArrows.length > 0) {
        const fa = flyingArrows.pop();
        if (fa) {
          soundEngine.stopArrowFlightWhistle(fa.audioId);
          scene.remove(fa.mesh);
        }
      }
      while (incomingJavelins.length > 0) {
        const jav = incomingJavelins.pop();
        if (jav) {
          scene.remove(jav.mesh);
        }
      }
      while (stuckArrows.length > 0) {
        const arr = stuckArrows.pop();
        if (arr && arr.parent) {
          arr.parent.remove(arr);
        }
      }
      damageFlashAlpha = 0;
      if (damageFlashRef.current) {
        damageFlashRef.current.style.opacity = '0';
      }
    };

    clearStuckArrowsRef.current = clearRangeProjectiles;

    rebuildLevelRef.current = (lvl: LevelConfig, season: SeasonConfig) => {
      clearRangeProjectiles();
      populateLevelEnemies(lvl);

      // Reset player spawn at the Starting Line on wave start/retry
      playerPos.set(0, 0, startLineZ);
      playerVelX = 0;
      playerVelZ = 0;
      isCrouched = false;
      currentEyeHeight = 1.68;
      walkBobPhase = 0;
      keysDown.clear();

      const atmo = season.atmosphere;
      fogColor.setHex(atmo.fogHex);
      expFog.color.setHex(atmo.fogHex);
      expFog.density = atmo.fogDensity;

      hemiLight.color.setHex(atmo.hemiSkyHex);
      hemiLight.groundColor.setHex(atmo.hemiGroundHex);
      hemiLight.intensity = atmo.hemiIntensity;

      keySunLight.color.setHex(atmo.sunHex);
      keySunLight.intensity = atmo.sunIntensity;

      rimLight.color.setHex(atmo.rimHex);
      rimLight.intensity = atmo.rimIntensity;

      applySeasonAtmosphere(season.id);
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Input Handlers (Wide Look Yaw for Flanking + Bow Draw + WASD / Shift / Crouch)
    const onPointerMove = (e: PointerEvent) => {
      if (stateRef.current.gameState !== 'playing') return;
      const rect = renderer.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      targetYaw = -nx * 1.15;
      targetPitch = THREE.MathUtils.clamp(ny * 0.34 + 0.02, -0.28, 0.4);
    };

    const getAimWorldTransform = (outPos: THREE.Vector3, outQuat: THREE.Quaternion) => {
      bowHandle.nockSocketGroup.getWorldPosition(outPos);
      if (vrRig.isPresenting()) {
        vrRig.bowMountGroup.getWorldQuaternion(outQuat);
      } else {
        camera.getWorldQuaternion(outQuat);
      }
    };

    const startBowDraw = () => {
      if (stateRef.current.gameState !== 'playing') return;
      isDrawing = true;
      lastDrawTickSoundDist = 0;
      if (nockedArrowMesh) nockedArrowMesh.visible = true;
    };

    const releaseBowString = () => {
      if (!isDrawing) return;
      isDrawing = false;

      const ratio = THREE.MathUtils.clamp(drawDistance / MAX_DRAW_DISTANCE, 0, 1);
      if (ratio >= 0.14 && stateRef.current.gameState === 'playing') {
        const activeType = stateRef.current.selectedArrowType;
        const cfg = ARROW_TYPES[activeType];

        const spawnPos = new THREE.Vector3();
        const spawnQuat = new THREE.Quaternion();
        getAimWorldTransform(spawnPos, spawnQuat);

        const launchDir = _forward.clone().applyQuaternion(spawnQuat).normalize();
        if (!vrRig.isPresenting()) {
          launchDir.y += 0.02;
          launchDir.normalize();
        }

        const launchSpeed = cfg.muzzleVelocity * (0.24 + 0.76 * ratio);
        const velocity = launchDir.multiplyScalar(launchSpeed);

        const projectileMesh = createArrowModel(activeType);
        projectileMesh.position.copy(spawnPos);
        projectileMesh.quaternion.copy(spawnQuat);
        scene.add(projectileMesh);

        const arrowAudioId = nextArrowAudioId++;
        flyingArrows.push({
          audioId: arrowAudioId,
          mesh: projectileMesh,
          type: activeType,
          velocity,
          prevTipPos: spawnPos.clone(),
          drawTension: ratio,
          flightTime: 0,
          hasSplit: false,
          active: true,
        });

        soundEngine.playArrowRelease(ratio, activeType, spawnPos);
        soundEngine.startArrowFlightWhistle(arrowAudioId, activeType, spawnPos, launchSpeed);
        stateRef.current.onShotFired();
        cameraShakeIntensity = Math.max(cameraShakeIntensity, 0.004 * ratio);
        if (vrRig.isPresenting()) {
          vrRig.pulseHaptic('both', 0.35 + ratio * 0.4, 65);
        }
      }

      drawDistance = 0;
      trajLine.visible = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      startBowDraw();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      releaseBowString();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.gameState === 'playing') {
        if (
          e.code === 'ArrowUp' ||
          e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' ||
          e.code === 'ArrowRight' ||
          e.code === 'Space'
        ) {
          e.preventDefault();
        }
        keysDown.add(e.code);

        if (e.code === 'Space' && !e.repeat) {
          startBowDraw();
        } else if ((e.code === 'KeyX' || e.code === 'KeyQ') && !e.repeat) {
          isCrouched = !isCrouched;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
      if (e.code === 'Space') {
        releaseBowString();
      }
    };

    const onWindowBlur = () => {
      keysDown.clear();
      isDrawing = false;
      drawDistance = 0;
      trajLine.visible = false;
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointermove', onPointerMove);
    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);

    // Hitbox Combat Damage Evaluation
    const raycaster = new THREE.Raycaster();

    const updateEnemyHpVisual = (enemy: ArmoredEnemyEntity) => {
      const hpPct = THREE.MathUtils.clamp(enemy.hp / Math.max(1, enemy.maxHp), 0, 1);
      enemy.hpBarFillMesh.scale.x = Math.max(0.01, hpPct);
      if (hpPct > 0.55) {
        enemy.hpBarFillMat.color.setHex(0x22c55e);
      } else if (hpPct > 0.28) {
        enemy.hpBarFillMat.color.setHex(0xf59e0b);
      } else {
        enemy.hpBarFillMat.color.setHex(0xef4444);
      }
    };

    const applyDamageToEnemy = (
      enemy: ArmoredEnemyEntity,
      hitPointWorld: THREE.Vector3,
      hitboxZone: HitboxZone,
      arrowType: ArrowTypeId,
      drawTension: number,
      damageScale: number = 1.0,
      customBadge?: string,
      bypassShield: boolean = false
    ): { isCritical: boolean; blocked: boolean } => {
      if (enemy.aiState === 'defeated') return { isCritical: false, blocked: false };

      const cfg = ARROW_TYPES[arrowType];
      // Generous tension floor so quick snap-shots still wound & kill cleanly
      const tensionScale = 0.45 + 0.75 * drawTension;
      const distanceMeters = Math.max(
        1,
        Math.round(enemy.rootGroup.position.distanceTo(playerPos))
      );
      _screenProj.copy(hitPointWorld).project(camera);
      const sx = THREE.MathUtils.clamp(((_screenProj.x + 1) / 2) * 100, 12, 88);
      const sy = THREE.MathUtils.clamp(((-_screenProj.y + 1) / 2) * 100, 15, 82);

      // Shield hit: breaks enemy shield durability AND deals piercing chip damage
      if (hitboxZone === 'shield' && !bypassShield && enemy.shieldBrokenTimer <= 0) {
        const shieldDrain = Math.max(18, Math.round(cfg.baseDamage * tensionScale * damageScale));
        enemy.shieldHp -= shieldDrain;
        const pierceRatio = arrowType === 'standard' ? 0.3 : 0.5;
        const chipDamage = Math.max(
          10,
          Math.round(cfg.baseDamage * tensionScale * pierceRatio * damageScale)
        );
        enemy.hp = Math.max(0, enemy.hp - chipDamage);
        updateEnemyHpVisual(enemy);

        let badge = `SHIELD PIERCE (${chipDamage})`;
        let coinsEarned = 3;
        if (enemy.shieldHp <= 0) {
          enemy.shieldBrokenTimer = 3.2;
          enemy.shieldHp = enemy.maxShieldHp * 0.65;
          enemy.staggerTimer = 0.8;
          enemy.aiState = 'stagger';
          enemy.windupTimer = 0;
          badge = 'SHIELD BROKEN!';
          coinsEarned = 8;
        }

        if (enemy.hp <= 0) {
          enemy.aiState = 'defeated';
          enemy.defeatedAge = 0;
          enemy.hitboxMeshes.forEach((m) => {
            m.userData.enemyId = -1;
          });
          coinsEarned += enemy.archetype === 'centurion' ? 25 : 14;
          const aliveLeft = enemies.filter((e) => e.aiState !== 'defeated').length;
          stateRef.current.onEnemyDefeated(enemy.id, aliveLeft, false);
        }

        const chipPoints = Math.round(chipDamage * cfg.scoreMultiplier);
        stateRef.current.onScoreHit(
          chipPoints,
          badge,
          enemy.shieldBrokenTimer > 0,
          chipDamage,
          distanceMeters,
          'metal',
          coinsEarned,
          {
            x: sx,
            y: sy,
            points: chipPoints,
            ringLabel: badge,
            arrowType,
            detailText: `${chipDamage} DMG · Aim Head/Shoulders`,
          }
        );
        return { isCritical: false, blocked: true };
      }

      const multiplier =
        hitboxZone === 'shield' ? 0.85 : HITBOX_MULTIPLIERS[hitboxZone];

      // Nearest-enemy / close-range full-force kinetic bonus (up to 1.45x within 3m–11m)
      const closeForceT = THREE.MathUtils.clamp((11.5 - distanceMeters) / 8.5, 0, 1);
      const fullDrawWeight = THREE.MathUtils.clamp((drawTension - 0.3) / 0.7, 0.35, 1.0);
      const closeForceBonus = 1.0 + closeForceT * fullDrawWeight * 0.45;

      const rawDamage = Math.max(
        15,
        Math.round(cfg.baseDamage * tensionScale * multiplier * closeForceBonus * damageScale)
      );
      const isCritical = hitboxZone === 'head';
      enemy.hp = Math.max(0, enemy.hp - rawDamage);
      updateEnemyHpVisual(enemy);

      // Limb slow or Head/Heavy Stagger reaction
      if (hitboxZone === 'limb') {
        enemy.freezeTimer = Math.max(enemy.freezeTimer, 0.85);
        enemy.timeScale = Math.min(enemy.timeScale, 0.45);
      } else if (isCritical || rawDamage >= 65) {
        enemy.staggerTimer = 0.45;
        enemy.aiState = 'stagger';
        enemy.windupTimer = 0;
      }

      const points = Math.round(rawDamage * cfg.scoreMultiplier);
      let coinsEarned = isCritical ? 12 : 5;
      const closeTag = closeForceBonus >= 1.2 ? ' · FULL FORCE' : '';
      const zoneLabel =
        customBadge ||
        (hitboxZone === 'head'
          ? `HEADSHOT 2.5x${closeTag}`
          : hitboxZone === 'torso'
          ? `ARMOR HIT 1.0x${closeTag}`
          : hitboxZone === 'shield'
          ? `GUARD BREAK HIT${closeTag}`
          : `LIMB HIT 0.65x${closeTag}`);

      if (enemy.hp <= 0) {
        enemy.aiState = 'defeated';
        enemy.defeatedAge = 0;
        enemy.hitboxMeshes.forEach((m) => {
          m.userData.enemyId = -1;
        });
        coinsEarned += enemy.archetype === 'centurion' ? 25 : 14;
        const aliveLeft = enemies.filter((e) => e.aiState !== 'defeated').length;
        stateRef.current.onEnemyDefeated(enemy.id, aliveLeft, isCritical);
      }

      stateRef.current.onScoreHit(
        points,
        zoneLabel,
        isCritical,
        rawDamage,
        distanceMeters,
        'metal',
        coinsEarned,
        {
          x: sx,
          y: sy,
          points,
          ringLabel: zoneLabel,
          arrowType,
          detailText: `${rawDamage} DMG · +${coinsEarned} Coins`,
        }
      );

      return { isCritical, blocked: false };
    };

    // Main 60fps Loop
    let frameId = 0;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();
      const currentState = stateRef.current;
      const activeCfg = ARROW_TYPES[currentState.selectedArrowType];

      const aliveCount = enemies.filter((e) => e.aiState !== 'defeated').length;
      const totalEnemies = Math.max(1, enemies.length);
      const isAtFinishGate = playerPos.z <= finishLineZ + 0.5;
      updateEnvironment(
        elapsed,
        dt,
        currentState.windSpeedX,
        isAtFinishGate || playerPos.z <= finishLineZ + 6.5
      );

      if (hitstopTimer > 0) {
        hitstopTimer -= dt;
      }
      const simDt = hitstopTimer > 0 ? dt * 0.15 : dt;

      // Damage Vignette Decay
      if (damageFlashAlpha > 0 && damageFlashRef.current) {
        damageFlashAlpha = Math.max(0, damageFlashAlpha - dt * 2.1);
        damageFlashRef.current.style.opacity = damageFlashAlpha.toFixed(3);
      }

      // A. Camera, 3D Locomotion (Desktop WASD + WebXR VR Controllers) & Diegetic VR Rig
      let isMoving = false;
      let isSprinting = false;
      const vrFrame = vrRig.pollVRInput(currentState.calibration.dominantEye);

      if (vrFrame.presenting) {
        // WebXR Headset + Dual Controller Mode
        bowHandle.group.visible = currentState.gameState === 'playing';

        if (vrFrame.cycleArrowJustPressed) {
          const curIdx = ARROW_TYPE_LIST.findIndex((a) => a.id === currentState.selectedArrowType);
          const nextArrow = ARROW_TYPE_LIST[(curIdx + 1) % ARROW_TYPE_LIST.length].id;
          stateRef.current.onSelectArrowFromVr?.(nextArrow);
          vrRig.pulseHaptic('bow', 0.25, 35);
        }

        if (vrFrame.anyTriggerJustPressed && currentState.gameState !== 'playing') {
          stateRef.current.onVrOutcomeAction?.();
        }

        if (currentState.gameState === 'playing') {
          if (vrFrame.crouchToggleJustPressed) {
            isCrouched = !isCrouched;
          }
          const physicalDuck = camera.position.y > 0.2 && camera.position.y < 1.24;
          const vrCrouched = isCrouched || physicalDuck;

          if (Math.abs(vrFrame.turnX) > 0.01) {
            vrRig.playerRig.rotation.y -= vrFrame.turnX * 2.05 * dt;
          }

          const hasMoveInput =
            Math.abs(vrFrame.moveRight) > 0.01 || Math.abs(vrFrame.moveForward) > 0.01;
          isSprinting = hasMoveInput && !vrCrouched && vrFrame.sprint;

          let targetSpeed = vrCrouched ? 2.55 : isSprinting ? 7.6 : 4.2;
          if (isDrawing) targetSpeed *= 0.65;

          let desiredVx = 0;
          let desiredVz = 0;
          if (hasMoveInput) {
            camera.getWorldQuaternion(_camWorldQuat);
            _camFwd.set(0, 0, -1).applyQuaternion(_camWorldQuat);
            _camFwd.y = 0;
            if (_camFwd.lengthSq() < 0.0001) _camFwd.set(0, 0, -1);
            _camFwd.normalize();

            const rightX = -_camFwd.z;
            const rightZ = _camFwd.x;

            desiredVx = (_camFwd.x * vrFrame.moveForward + rightX * vrFrame.moveRight) * targetSpeed;
            desiredVz = (_camFwd.z * vrFrame.moveForward + rightZ * vrFrame.moveRight) * targetSpeed;
          }

          playerVelX = THREE.MathUtils.damp(playerVelX, desiredVx, 14, dt);
          playerVelZ = THREE.MathUtils.damp(playerVelZ, desiredVz, 14, dt);

          if (vrFrame.triggerJustPressed) {
            startBowDraw();
          }
          if (vrFrame.triggerJustReleased && isDrawing) {
            releaseBowString();
          }
        } else {
          playerVelX = THREE.MathUtils.damp(playerVelX, 0, 14, dt);
          playerVelZ = THREE.MathUtils.damp(playerVelZ, 0, 14, dt);
        }

        let nextPx = THREE.MathUtils.clamp(playerPos.x + playerVelX * dt, -8.8, 8.8);
        let nextPz = THREE.MathUtils.clamp(
          playerPos.z + playerVelZ * dt,
          finishLineZ - 3.2,
          startLineZ + 2.4
        );
        for (let c = 0; c < coverObstacles.length; c++) {
          const res = resolveCircleRectPushout(nextPx, nextPz, 0.44, coverObstacles[c]);
          nextPx = res.x;
          nextPz = res.z;
        }
        playerPos.x = THREE.MathUtils.clamp(nextPx, -8.8, 8.8);
        playerPos.z = THREE.MathUtils.clamp(nextPz, finishLineZ - 3.2, startLineZ + 2.4);

        isMoving = Math.hypot(playerVelX, playerVelZ) > 0.35;
        const floorY = groundHeightAt(playerPos.x, playerPos.z);
        const crouchOffsetY = isCrouched && camera.position.y >= 1.24 ? -0.58 : 0;
        vrRig.playerRig.position.set(playerPos.x, floorY + crouchOffsetY, playerPos.z);

        // Position & aim VR Bow on Bow Hand (two-handed arrow vector when drawing!)
        vrRig.bowMountGroup.position.copy(vrFrame.bowWorldPos);
        if (isDrawing && vrFrame.hasTwoHandedDraw) {
          _vrAimDir.subVectors(vrFrame.bowWorldPos, vrFrame.drawWorldPos).normalize();
          _vrBowUp.set(0, 1, 0).applyQuaternion(vrFrame.bowWorldQuat).normalize();
          _vrAimTarget.copy(vrFrame.bowWorldPos).add(_vrAimDir);
          _vrMat4.lookAt(vrFrame.bowWorldPos, _vrAimTarget, _vrBowUp);
          vrRig.bowMountGroup.quaternion.setFromRotationMatrix(_vrMat4);
        } else {
          vrRig.bowMountGroup.quaternion.copy(vrFrame.bowWorldQuat);
        }

        const cal = currentState.calibration;
        bowHandle.group.position.set(
          cal.stringHandOffsetCm.x * 0.005,
          cal.stringHandOffsetCm.y * 0.005,
          cal.stringHandOffsetCm.z * 0.005
        );
      } else if (currentState.gameState === 'title') {
        const panAngle = Math.sin(elapsed * 0.25) * 0.22;
        vrRig.playerRig.position.set(0, 0, 0);
        vrRig.playerRig.rotation.y = 0;
        camera.position.set(Math.sin(elapsed * 0.2) * 1.4, 2.1, 1.8);
        _euler.set(-0.04, panAngle, 0, 'YXZ');
        camera.quaternion.setFromEuler(_euler);
        bowHandle.group.visible = false;
        trajLine.visible = false;
      } else {
        bowHandle.group.visible = true;
        vrRig.playerRig.rotation.y = 0;

        currentYaw = THREE.MathUtils.damp(currentYaw, targetYaw, 14, dt);
        currentPitch = THREE.MathUtils.damp(currentPitch, targetPitch, 14, dt);

        if (currentState.gameState === 'playing') {
          const moveRightInput =
            (keysDown.has('KeyD') || keysDown.has('ArrowRight') ? 1 : 0) -
            (keysDown.has('KeyA') || keysDown.has('ArrowLeft') ? 1 : 0);
          const moveFwdInput =
            (keysDown.has('KeyW') || keysDown.has('ArrowUp') ? 1 : 0) -
            (keysDown.has('KeyS') || keysDown.has('ArrowDown') ? 1 : 0);

          const hasMoveInput = moveRightInput !== 0 || moveFwdInput !== 0;
          isSprinting =
            hasMoveInput &&
            !isCrouched &&
            (keysDown.has('ShiftLeft') || keysDown.has('ShiftRight'));

          // Walk 4.3 m/s, Run/Sprint 7.9 m/s, Crouched 2.55 m/s
          let targetSpeed = isCrouched ? 2.55 : isSprinting ? 7.9 : 4.3;
          if (isDrawing) targetSpeed *= 0.65;

          let desiredVx = 0;
          let desiredVz = 0;
          if (hasMoveInput) {
            const len = Math.hypot(moveRightInput, moveFwdInput);
            const normR = moveRightInput / len;
            const normF = moveFwdInput / len;

            const fwdX = -Math.sin(currentYaw);
            const fwdZ = -Math.cos(currentYaw);
            const rightX = Math.cos(currentYaw);
            const rightZ = -Math.sin(currentYaw);

            desiredVx = (fwdX * normF + rightX * normR) * targetSpeed;
            desiredVz = (fwdZ * normF + rightZ * normR) * targetSpeed;
          }

          playerVelX = THREE.MathUtils.damp(playerVelX, desiredVx, 14, dt);
          playerVelZ = THREE.MathUtils.damp(playerVelZ, desiredVz, 14, dt);
        } else {
          playerVelX = THREE.MathUtils.damp(playerVelX, 0, 14, dt);
          playerVelZ = THREE.MathUtils.damp(playerVelZ, 0, 14, dt);
        }

        let nextPx = THREE.MathUtils.clamp(playerPos.x + playerVelX * dt, -8.8, 8.8);
        let nextPz = THREE.MathUtils.clamp(
          playerPos.z + playerVelZ * dt,
          finishLineZ - 3.2,
          startLineZ + 2.4
        );

        // Smooth AABB collision pushout against stone bastions & timber cover wall
        for (let c = 0; c < coverObstacles.length; c++) {
          const res = resolveCircleRectPushout(nextPx, nextPz, 0.44, coverObstacles[c]);
          nextPx = res.x;
          nextPz = res.z;
        }
        playerPos.x = THREE.MathUtils.clamp(nextPx, -8.8, 8.8);
        playerPos.z = THREE.MathUtils.clamp(nextPz, finishLineZ - 3.2, startLineZ + 2.4);

        const horizSpeed = Math.hypot(playerVelX, playerVelZ);
        isMoving = horizSpeed > 0.35;
        if (isMoving) {
          walkBobPhase += dt * (isSprinting ? 14.5 : isCrouched ? 7.2 : 9.8);
        }

        const targetEyeH = isCrouched ? 0.94 : 1.68;
        currentEyeHeight = THREE.MathUtils.damp(currentEyeHeight, targetEyeH, 14, dt);
        const bobOffset = isMoving
          ? Math.sin(walkBobPhase) * (isSprinting ? 0.055 : isCrouched ? 0.015 : 0.026)
          : 0;

        const floorY = groundHeightAt(playerPos.x, playerPos.z);
        vrRig.playerRig.position.set(playerPos.x, floorY, playerPos.z);
        camera.position.set(0, currentEyeHeight + bobOffset, 0);

        const cal = currentState.calibration;
        const ipdMeters = cal.virtualIpdMm * 0.001;
        const domSign = cal.dominantEye === 'right' ? 1 : -1;
        const eyeSightOffsetX = domSign * (ipdMeters * 0.5) * 0.65;
        const targetBowX =
          (cal.dominantEye === 'right' ? 0.22 : -0.22) +
          eyeSightOffsetX +
          cal.stringHandOffsetCm.x * 0.01;
        const targetBowY = -0.15 + cal.stringHandOffsetCm.y * 0.01;
        const targetBowZ = -0.48 + cal.stringHandOffsetCm.z * 0.01;

        bowHandle.group.position.x = THREE.MathUtils.damp(
          bowHandle.group.position.x,
          targetBowX,
          14,
          dt
        );
        bowHandle.group.position.y = THREE.MathUtils.damp(
          bowHandle.group.position.y,
          targetBowY,
          14,
          dt
        );
        bowHandle.group.position.z = THREE.MathUtils.damp(
          bowHandle.group.position.z,
          targetBowZ,
          14,
          dt
        );
        bowHandle.group.rotation.z = THREE.MathUtils.damp(
          bowHandle.group.rotation.z,
          cal.dominantEye === 'right' ? -0.08 : 0.08,
          14,
          dt
        );

        let shakeX = 0;
        let shakeY = 0;
        if (cameraShakeIntensity > 0.0001) {
          shakeX = (Math.random() - 0.5) * cameraShakeIntensity;
          shakeY = (Math.random() - 0.5) * cameraShakeIntensity;
          cameraShakeIntensity = THREE.MathUtils.damp(cameraShakeIntensity, 0, 12, dt);
        }

        _euler.set(currentPitch + shakeY, currentYaw + shakeX, 0, 'YXZ');
        camera.quaternion.setFromEuler(_euler);

        const drawRatio = THREE.MathUtils.clamp(drawDistance / MAX_DRAW_DISTANCE, 0, 1);
        const baseFov = 62 + (cal.virtualIpdMm - 63) * 0.25 + (isSprinting ? 3.5 : 0);
        const targetFov = baseFov - drawRatio * 10;
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 10, dt);
          camera.updateProjectionMatrix();
        }
      }

      // Sync World Camera Transform + 3D AudioListener
      vrRig.playerRig.updateMatrixWorld(true);
      camera.getWorldPosition(_camWorldPos);
      camera.getWorldQuaternion(_camWorldQuat);
      _camFwd.set(0, 0, -1).applyQuaternion(_camWorldQuat).normalize();
      _camUp.set(0, 1, 0).applyQuaternion(_camWorldQuat).normalize();
      soundEngine.updateListener(_camWorldPos, _camFwd, _camUp);

      // B. Update Bow Draw, Diegetic 3D HUD & Trajectory Arc
      if (isDrawing && currentState.gameState === 'playing') {
        if (vrFrame.presenting && vrFrame.hasTwoHandedDraw) {
          const physDraw =
            THREE.MathUtils.clamp((vrFrame.handSeparationMeters - 0.14) / 0.5, 0.14, 1.0) *
            MAX_DRAW_DISTANCE;
          drawDistance = THREE.MathUtils.damp(drawDistance, physDraw, 22, dt);
        } else {
          drawDistance = Math.min(MAX_DRAW_DISTANCE, drawDistance + dt * 0.62);
        }
        if (drawDistance - lastDrawTickSoundDist >= 0.09) {
          lastDrawTickSoundDist = drawDistance;
          bowHandle.group.getWorldPosition(_bowWorldPos);
          soundEngine.playDrawTick(drawDistance / MAX_DRAW_DISTANCE, _bowWorldPos);
          if (vrFrame.presenting) {
            vrRig.pulseHaptic('draw', 0.18, 22);
          }
        }
      } else {
        drawDistance = THREE.MathUtils.damp(drawDistance, 0, 24, dt);
      }

      const drawRatio = THREE.MathUtils.clamp(drawDistance / MAX_DRAW_DISTANCE, 0, 1);
      if (nockedArrowMesh) {
        nockedArrowMesh.visible = currentState.gameState === 'playing';
      }
      bowHandle.updateBowDraw(drawDistance, MAX_DRAW_DISTANCE, activeCfg.primaryHex);

      bowHandle.updateDiegeticHud(
        currentState.playerHp / Math.max(1, currentState.maxPlayerHp),
        aliveCount / totalEnemies,
        currentState.equippedArmorPrimaryHex,
        currentState.equippedArmorTrimHex
      );

      // Update 60fps Draw Strength Gauge
      if (
        gaugeFillRef.current &&
        gaugePercentRef.current &&
        gaugeVelocityRef.current &&
        gaugeTierRef.current
      ) {
        const pct = Math.round(drawRatio * 100);
        const hueDeg =
          drawRatio < 0.55
            ? THREE.MathUtils.lerp(142, 48, drawRatio / 0.55)
            : THREE.MathUtils.lerp(48, 0, (drawRatio - 0.55) / 0.45);
        const gaugeColor = `hsl(${Math.round(hueDeg)}, 88%, 52%)`;
        const estVelocity = Math.round(activeCfg.muzzleVelocity * (0.24 + 0.76 * drawRatio));

        gaugeFillRef.current.style.height = `${pct}%`;
        gaugeFillRef.current.style.backgroundColor = gaugeColor;
        gaugePercentRef.current.textContent = `${pct}%`;
        gaugePercentRef.current.style.color = drawRatio > 0.05 ? gaugeColor : '#94A3B8';
        gaugeVelocityRef.current.textContent = `${drawRatio > 0.05 ? estVelocity : 0} m/s`;
        gaugeTierRef.current.textContent =
          drawRatio < 0.14
            ? 'Ready'
            : drawRatio < 0.45
            ? 'Low'
            : drawRatio < 0.78
            ? 'Mid'
            : drawRatio < 0.96
            ? 'High'
            : 'Max Power';
        gaugeTierRef.current.style.color = drawRatio > 0.14 ? gaugeColor : '#64748B';
      }

      if (currentState.showTrajectoryArc && drawRatio > 0.14 && currentState.gameState === 'playing') {
        trajLine.visible = true;
        trajMat.color.set(activeCfg.primaryHex);

        const simPos = new THREE.Vector3();
        const simQuat = new THREE.Quaternion();
        getAimWorldTransform(simPos, simQuat);

        const simDir = _forward.clone().applyQuaternion(simQuat).normalize();
        if (!vrFrame.presenting) {
          simDir.y += 0.02;
          simDir.normalize();
        }

        const speed = activeCfg.muzzleVelocity * (0.24 + 0.76 * drawRatio);
        const simVel = simDir.multiplyScalar(speed);

        const posAttr = trajGeo.getAttribute('position') as THREE.BufferAttribute;
        const stepDt = 0.035;
        for (let i = 0; i < TRAJ_STEPS; i++) {
          posAttr.setXYZ(i, simPos.x, simPos.y, simPos.z);
          simVel.y -= 9.81 * activeCfg.gravityMultiplier * stepDt;
          simVel.x += currentState.windSpeedX * 0.35 * stepDt;
          simVel.multiplyScalar(1 - activeCfg.dragCoefficient * simVel.length() * stepDt);
          simPos.addScaledVector(simVel, stepDt);
        }
        posAttr.needsUpdate = true;
      } else {
        trajLine.visible = false;
      }

      // C. Bounded Reinforcements (Strictly capped by concurrent + total level enemy limits)
      const activeSim = currentState.gameState === 'playing';
      const playerReachedFinish = playerPos.z <= finishLineZ + 0.5;
      if (activeSim && !playerReachedFinish) {
        const lvlCfg = currentState.levelConfig;
        const maxTotalEnemies = getLevelEnemyLimit(lvlCfg.level);
        const maxConcurrentAlive = getLevelConcurrentLimit(lvlCfg.level);

        if (totalSpawnedInLevel < maxTotalEnemies && aliveCount < maxConcurrentAlive) {
          reinforcementTimer -= simDt * (aliveCount === 0 ? 1.8 : 1.0);
          if (reinforcementTimer <= 0) {
            spawnReinforcementEnemy(lvlCfg, playerPos.z);
            const seasonPace = Math.max(2.4, 4.2 - lvlCfg.seasonId * 0.35);
            reinforcementTimer = seasonPace + Math.random() * 1.1;
          }
        } else {
          reinforcementTimer = Math.max(reinforcementTimer, 1.8);
        }
      }

      for (let idx = enemies.length - 1; idx >= 0; idx--) {
        const fallen = enemies[idx];
        if (fallen.aiState === 'defeated' && fallen.defeatedAge > 2.2) {
          enemiesContainer.remove(fallen.rootGroup);
          for (let h = enemyHitboxMeshes.length - 1; h >= 0; h--) {
            if (fallen.hitboxMeshes.includes(enemyHitboxMeshes[h])) {
              enemyHitboxMeshes.splice(h, 1);
            }
          }
          enemies.splice(idx, 1);
        }
      }

      let visibleEnemiesCount = 0;
      let aliveEnemiesCheckCount = 0;

      enemies.forEach((enemy) => {
        if (enemy.aiState === 'defeated') {
          enemy.defeatedAge += simDt;
          const collapse = Math.min(1, enemy.defeatedAge * 2.5);
          enemy.bodyPivot.rotation.x = -collapse * (Math.PI / 2);
          enemy.bodyPivot.position.y = -collapse * 0.35;
          if (enemy.defeatedAge > 1.8) {
            enemy.rootGroup.visible = false;
          }
          return;
        }

        aliveEnemiesCheckCount++;

        // Handle Cryo Freeze timer
        if (enemy.freezeTimer > 0) {
          enemy.freezeTimer -= simDt;
          if (enemy.freezeTimer <= 0) {
            enemy.timeScale = 1.0;
            enemy.frostCageGroup.visible = false;
          }
        }

        if (!activeSim) return;
        const eDt = simDt * enemy.timeScale;

        const pos = enemy.rootGroup.position;
        const dxToPlayer = playerPos.x - pos.x;
        const dzToPlayer = playerPos.z - pos.z;
        const distToPlayer = Math.hypot(dxToPlayer, dzToPlayer);

        // Raycast enemy-to-player Line of Sight against 3D Cover Fortifications
        _enemyEyePos.set(pos.x, pos.y + 1.52, pos.z);
        _losDir.subVectors(_camWorldPos, _enemyEyePos);
        const losLen = _losDir.length();
        let occludedByCover = false;
        if (losLen > 0.8 && coverColliders.length > 0) {
          _losDir.normalize();
          raycaster.set(_enemyEyePos, _losDir);
          raycaster.far = losLen - 0.15;
          occludedByCover = raycaster.intersectObjects(coverColliders, false).length > 0;
        }
        if (!occludedByCover) {
          visibleEnemiesCount++;
        }

        const playerInsideSafetyWall = playerPos.z > -3.45 && Math.abs(playerPos.x) < 5.8;
        if (occludedByCover) {
          enemy.occludedTimer = Math.min(8, enemy.occludedTimer + eDt);
        } else if (playerInsideSafetyWall) {
          enemy.occludedTimer = Math.min(8, enemy.occludedTimer + eDt * 0.45);
        } else {
          enemy.occludedTimer = Math.max(0, enemy.occludedTimer - eDt * 0.6);
        }

        if (enemy.shieldBrokenTimer > 0) {
          enemy.shieldBrokenTimer = Math.max(0, enemy.shieldBrokenTimer - simDt);
        }

        // Stagger & Shield-Broken knockback recovery
        if (enemy.aiState === 'stagger') {
          enemy.staggerTimer -= simDt;
          enemy.bodyPivot.rotation.x = THREE.MathUtils.damp(enemy.bodyPivot.rotation.x, -0.28, 12, dt);
          enemy.leftArmPivot.rotation.y = THREE.MathUtils.damp(enemy.leftArmPivot.rotation.y, 1.15, 10, dt);
          if (enemy.staggerTimer <= 0) {
            enemy.aiState = 'advance';
          }
          return;
        }

        enemy.bodyPivot.rotation.x = THREE.MathUtils.damp(enemy.bodyPivot.rotation.x, 0, 10, dt);

        // Face player's dynamic 3D XZ position
        if (distToPlayer > 0.1) {
          enemy.rootGroup.rotation.y = Math.atan2(dxToPlayer, dzToPlayer);
        }

        // Helper: steer around any cover wall / safety wall blocking the path so enemies come inside!
        const blockingWall = findBlockingObstacle(
          pos.x,
          pos.z,
          playerPos.x,
          playerPos.z,
          0.32,
          coverObstacles
        );

        const computeNavStepDir = (): { dirX: number; dirZ: number } => {
          if (blockingWall) {
            const offsetFromCenter = pos.x - blockingWall.x;
            const side =
              Math.abs(offsetFromCenter) > 0.45
                ? Math.sign(offsetFromCenter)
                : enemy.strafeSign;
            const waypointX = THREE.MathUtils.clamp(
              blockingWall.x + side * (blockingWall.halfWidth + 0.66),
              -7.9,
              7.9
            );
            const pastSign = playerPos.z >= blockingWall.z ? 1 : -1;
            const waypointZ = blockingWall.z + pastSign * (blockingWall.halfDepth + 0.62);
            const wx = waypointX - pos.x;
            const wz = waypointZ - pos.z;
            const wLen = Math.hypot(wx, wz);
            if (wLen > 0.12) {
              return { dirX: wx / wLen, dirZ: wz / wLen };
            }
          }
          const len = Math.max(0.4, distToPlayer);
          return { dirX: dxToPlayer / len, dirZ: dzToPlayer / len };
        };

        const resolveCoverAndSquad = () => {
          pos.x = THREE.MathUtils.clamp(pos.x, -8.2, 8.2);
          pos.z = THREE.MathUtils.clamp(pos.z, finishLineZ - 3.5, startLineZ + 2.2);
          for (let c = 0; c < coverObstacles.length; c++) {
            const res = resolveCircleRectPushout(pos.x, pos.z, 0.42, coverObstacles[c]);
            if (res.collided) {
              const sideSign =
                Math.abs(pos.x - coverObstacles[c].x) > 0.25
                  ? Math.sign(pos.x - coverObstacles[c].x)
                  : enemy.strafeSign;
              pos.x = res.x + sideSign * enemy.moveSpeed * 0.35 * eDt;
              pos.z = res.z;
            }
          }
          // Soft squad separation so multiple warriors entering the safety wall fan out cleanly
          for (let j = 0; j < enemies.length; j++) {
            const other = enemies[j];
            if (other.id === enemy.id || other.aiState === 'defeated') continue;
            const sx = pos.x - other.rootGroup.position.x;
            const sz = pos.z - other.rootGroup.position.z;
            const sDistSq = sx * sx + sz * sz;
            if (sDistSq > 0.0001 && sDistSq < 0.72) {
              const sDist = Math.sqrt(sDistSq);
              const push = (0.85 - sDist) * 1.8 * eDt;
              pos.x += (sx / sDist) * push;
              pos.z += (sz / sDist) * push;
            }
          }
          pos.x = THREE.MathUtils.clamp(pos.x, -8.2, 8.2);
          pos.z = THREE.MathUtils.clamp(pos.z, finishLineZ - 3.5, startLineZ + 2.2);
          pos.y = groundHeightAt(pos.x, pos.z);
        };

        if (enemy.archetype === 'javelineer') {
          const baseStopDist = 15 + (enemy.id % 3) * 3;
          // If player hides behind cover or camps inside the safety wall, Javelineers breach inward!
          const flushRatio = THREE.MathUtils.clamp((enemy.occludedTimer - 1.8) / 3.2, 0, 1);
          const breachStopDist = 2.8 + (enemy.id % 3) * 0.85;
          const effectiveStopDist = THREE.MathUtils.lerp(baseStopDist, breachStopDist, flushRatio);

          if (distToPlayer > effectiveStopDist || (occludedByCover && enemy.occludedTimer >= 1.8)) {
            enemy.aiState = 'advance';
            enemy.windupTimer = 0;
            enemy.rightArmPivot.rotation.x = THREE.MathUtils.damp(enemy.rightArmPivot.rotation.x, 0, 8, dt);
            if (enemy.javelinTipGlowMat) enemy.javelinTipGlowMat.emissiveIntensity = 0.25;

            const nav = computeNavStepDir();
            const speedBoost = enemy.occludedTimer >= 1.8 ? 1.18 : 1.0;
            enemy.walkPhase += eDt * enemy.moveSpeed * speedBoost * 3.4;
            const moveStep = enemy.moveSpeed * speedBoost * eDt;
            pos.x += nav.dirX * moveStep;
            pos.z += nav.dirZ * moveStep;
            pos.x += Math.sin(enemy.walkPhase * 0.35) * enemy.strafeSign * 0.45 * eDt;
            resolveCoverAndSquad();

            enemy.leftLegPivot.rotation.x = Math.sin(enemy.walkPhase) * 0.45;
            enemy.rightLegPivot.rotation.x = -Math.sin(enemy.walkPhase) * 0.45;
          } else {
            enemy.leftLegPivot.rotation.x = THREE.MathUtils.damp(enemy.leftLegPivot.rotation.x, 0, 10, dt);
            enemy.rightLegPivot.rotation.x = THREE.MathUtils.damp(enemy.rightLegPivot.rotation.x, 0, 10, dt);

            // Briefly strafe laterally seeking angle before flushing inward around the safety wall
            if (occludedByCover) {
              enemy.aiState = 'advance';
              enemy.windupTimer = 0;
              enemy.rightArmPivot.rotation.x = THREE.MathUtils.damp(enemy.rightArmPivot.rotation.x, 0, 8, dt);
              if (enemy.javelinTipGlowMat) enemy.javelinTipGlowMat.emissiveIntensity = 0.25;
              pos.x += enemy.strafeSign * 1.45 * eDt;
              resolveCoverAndSquad();
              enemy.walkPhase += eDt * 4.5;
              enemy.leftLegPivot.rotation.x = Math.sin(enemy.walkPhase) * 0.35;
              enemy.rightLegPivot.rotation.x = -Math.sin(enemy.walkPhase) * 0.35;
              return;
            }

            enemy.attackTimer -= eDt;
            if (enemy.attackTimer <= 0 && enemy.aiState !== 'windup_ranged') {
              enemy.aiState = 'windup_ranged';
              enemy.windupTimer = 0.85;
            }

            if (enemy.aiState === 'windup_ranged') {
              enemy.windupTimer -= eDt;
              enemy.rightArmPivot.rotation.x = THREE.MathUtils.damp(
                enemy.rightArmPivot.rotation.x,
                -1.35,
                10,
                dt
              );
              if (enemy.javelinTipGlowMat) {
                enemy.javelinTipGlowMat.emissiveIntensity = 2.4;
              }

              if (enemy.windupTimer <= 0) {
                enemy.aiState = 'advance';
                enemy.attackTimer = enemy.attackCooldown;
                enemy.rightArmPivot.rotation.x = 0.35;
                if (enemy.javelinTipGlowMat) {
                  enemy.javelinTipGlowMat.emissiveIntensity = 0.4;
                }

                // Throw incoming Javelin toward player's current 3D position
                const javMesh = createEnemyJavelinModel();
                const startPos = new THREE.Vector3(pos.x + 0.3, pos.y + 1.55, pos.z + 0.4);
                javMesh.position.copy(startPos);

                const colMesh = new THREE.Mesh(
                  javelinColliderGeo,
                  new THREE.MeshBasicMaterial({ visible: false })
                );
                javMesh.add(colMesh);
                scene.add(javMesh);

                const targetPos = new THREE.Vector3(
                  playerPos.x + (Math.random() - 0.5) * 0.32,
                  _camWorldPos.y - 0.08,
                  playerPos.z + 0.1
                );
                const flightTimeApprox = Math.max(0.15, startPos.distanceTo(targetPos) / 24);
                const javVel = targetPos.sub(startPos).divideScalar(flightTimeApprox);
                javVel.y += 0.5 * 9.81 * 0.45 * flightTimeApprox;

                const dir = javVel.clone().normalize();
                javMesh.quaternion.setFromUnitVectors(_forward, dir);

                colMesh.userData.javelinIndex = incomingJavelins.length;
                incomingJavelins.push({
                  mesh: javMesh,
                  colliderMesh: colMesh,
                  velocity: javVel,
                  damage: enemy.attackDamage,
                  active: true,
                });
                soundEngine.playArrowRelease(0.75, 'standard', startPos);
              }
            } else {
              enemy.rightArmPivot.rotation.x = THREE.MathUtils.damp(enemy.rightArmPivot.rotation.x, 0, 8, dt);
            }
          }
        } else {
          // Melee Charger (Shield Hoplite & Centurion): flanks around bastions and breaches INSIDE the safety wall!
          const reachDist = 1.55;
          if (distToPlayer > reachDist || blockingWall !== null) {
            const stealthSlow = occludedByCover && distToPlayer > 7.0 ? 0.78 : 1.0;
            const chargingBoost = distToPlayer < 13 ? 1.32 : 1.0;
            enemy.aiState = chargingBoost > 1.1 ? 'charge_melee' : 'advance';
            enemy.walkPhase += eDt * enemy.moveSpeed * chargingBoost * stealthSlow * 3.8;

            const nav = computeNavStepDir();
            const step = enemy.moveSpeed * chargingBoost * stealthSlow * eDt;
            pos.x += nav.dirX * step;
            pos.z += nav.dirZ * step;
            pos.x += Math.sin(enemy.walkPhase * 0.25) * enemy.strafeSign * 0.28 * eDt;
            resolveCoverAndSquad();

            enemy.leftLegPivot.rotation.x = Math.sin(enemy.walkPhase) * 0.55;
            enemy.rightLegPivot.rotation.x = -Math.sin(enemy.walkPhase) * 0.55;
            const targetGuardYaw = enemy.shieldBrokenTimer > 0 ? 1.15 : 0.08;
            enemy.leftArmPivot.rotation.y = THREE.MathUtils.damp(
              enemy.leftArmPivot.rotation.y,
              targetGuardYaw,
              8,
              dt
            );
            enemy.rightArmPivot.rotation.x = Math.cos(enemy.walkPhase) * 0.28;
          } else {
            enemy.aiState = 'attack_melee';
            enemy.leftLegPivot.rotation.x = THREE.MathUtils.damp(enemy.leftLegPivot.rotation.x, 0, 10, dt);
            enemy.rightLegPivot.rotation.x = THREE.MathUtils.damp(enemy.rightLegPivot.rotation.x, 0, 10, dt);

            enemy.attackTimer -= eDt;
            const shieldOpen = enemy.attackTimer < 0.55 ? 0.5 : 0.1;
            enemy.leftArmPivot.rotation.y = THREE.MathUtils.damp(
              enemy.leftArmPivot.rotation.y,
              shieldOpen,
              8,
              dt
            );

            if (enemy.attackTimer <= 0.45 && enemy.attackTimer > 0) {
              enemy.rightArmPivot.rotation.x = THREE.MathUtils.damp(
                enemy.rightArmPivot.rotation.x,
                -1.2,
                12,
                dt
              );
            } else if (enemy.attackTimer <= 0) {
              enemy.attackTimer = enemy.attackCooldown;
              enemy.rightArmPivot.rotation.x = 0.65;
              damageFlashAlpha = 0.65;
              cameraShakeIntensity = 0.022;
              soundEngine.playMaterialImpact('wood', pos, 'standard', false, 50);
              if (vrFrame.presenting) {
                vrRig.pulseHaptic('both', 0.85, 160);
              }
              currentState.onPlayerDamaged(
                enemy.attackDamage,
                enemy.archetype === 'centurion' ? 'Centurion Strike' : 'Hoplite Slash'
              );
            } else {
              enemy.rightArmPivot.rotation.x = THREE.MathUtils.damp(enemy.rightArmPivot.rotation.x, 0, 8, dt);
            }
          }
        }
      });

      // Update Ref-Based Movement & Stealth Stance Badge (Zero React Re-renders)
      const isHiddenInCover = activeSim && aliveEnemiesCheckCount > 0 && visibleEnemiesCount === 0;
      const nextStanceKey = isHiddenInCover
        ? 'hidden'
        : isCrouched
        ? 'crouched'
        : isSprinting
        ? 'sprint'
        : isMoving
        ? 'walk'
        : 'stand';

      if (
        nextStanceKey !== lastStanceKey &&
        stanceBadgeRef.current &&
        stanceDotRef.current &&
        stanceLabelRef.current &&
        stanceSubRef.current
      ) {
        lastStanceKey = nextStanceKey;
        if (nextStanceKey === 'hidden') {
          stanceBadgeRef.current.style.borderColor = 'rgba(16, 185, 129, 0.55)';
          stanceDotRef.current.style.backgroundColor = '#10B981';
          stanceLabelRef.current.style.color = '#34D399';
          stanceLabelRef.current.textContent = 'HIDDEN IN COVER';
          stanceSubRef.current.textContent = 'Enemy LOS blocked · Peek [A/D] or Stand [X]';
        } else if (nextStanceKey === 'crouched') {
          stanceBadgeRef.current.style.borderColor = 'rgba(245, 158, 11, 0.5)';
          stanceDotRef.current.style.backgroundColor = '#F59E0B';
          stanceLabelRef.current.style.color = '#FBBF24';
          stanceLabelRef.current.textContent = 'CROUCHED (EXPOSED)';
          stanceSubRef.current.textContent = 'Move behind wall/pillar [WASD] to break sight';
        } else if (nextStanceKey === 'sprint') {
          stanceBadgeRef.current.style.borderColor = 'rgba(56, 189, 248, 0.55)';
          stanceDotRef.current.style.backgroundColor = '#38BDF8';
          stanceLabelRef.current.style.color = '#38BDF8';
          stanceLabelRef.current.textContent = 'SPRINTING';
          stanceSubRef.current.textContent = 'Press [X/Q] to drop behind cover';
        } else if (nextStanceKey === 'walk') {
          stanceBadgeRef.current.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          stanceDotRef.current.style.backgroundColor = '#CBD5E1';
          stanceLabelRef.current.style.color = '#F1F5F9';
          stanceLabelRef.current.textContent = 'WALKING';
          stanceSubRef.current.textContent = 'Hold [Shift] Run · [X/Q] Hide in cover';
        } else {
          stanceBadgeRef.current.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          stanceDotRef.current.style.backgroundColor = '#94A3B8';
          stanceLabelRef.current.style.color = '#E2E8F0';
          stanceLabelRef.current.textContent = 'STANDING READY';
          stanceSubRef.current.textContent = 'WASD Move · Shift Run · X/Q Crouch & Hide';
        }
      }

      // D. Update Incoming Enemy Javelins (with Cover Blocking + Mid-Air Interception + 3D Dodge!)
      const activeJavelinColliders: THREE.Mesh[] = [];
      for (let j = incomingJavelins.length - 1; j >= 0; j--) {
        const jav = incomingJavelins[j];
        if (!jav.active) {
          scene.remove(jav.mesh);
          incomingJavelins.splice(j, 1);
          continue;
        }
        _prevJavPos.copy(jav.mesh.position);
        jav.velocity.y -= 9.81 * 0.45 * simDt;
        jav.mesh.position.addScaledVector(jav.velocity, simDt);
        _rayDir.copy(jav.velocity).normalize();
        jav.mesh.quaternion.setFromUnitVectors(_forward, _rayDir);
        jav.colliderMesh.userData.javelinRef = jav;
        activeJavelinColliders.push(jav.colliderMesh);

        // 1. Check if incoming Javelin is blocked by Stone Bastion / Timber Cover Wall!
        if (coverColliders.length > 0) {
          _stepVec.subVectors(jav.mesh.position, _prevJavPos);
          const javStepLen = _stepVec.length();
          if (javStepLen > 0.001) {
            raycaster.set(_prevJavPos, _stepVec.normalize());
            raycaster.far = javStepLen + 0.15;
            const coverHits = raycaster.intersectObjects(coverColliders, false);
            if (coverHits.length > 0) {
              const hitMat = (coverHits[0].object.userData.materialType || 'stone') as ImpactMaterial;
              soundEngine.playMaterialImpact(hitMat, coverHits[0].point, 'standard', false, 44);
              spawnParticleBurst(
                coverHits[0].point,
                hitMat === 'wood' ? '#D97706' : '#94A3B8',
                12,
                0.85
              );
              jav.active = false;
              scene.remove(jav.mesh);
              incomingJavelins.splice(j, 1);
              continue;
            }
          }
        }

        // 2. Check 3D Hit against moving Player Camera (strafing or ducking behind cover physically dodges!)
        if (jav.mesh.position.distanceTo(_camWorldPos) < 0.56) {
          jav.active = false;
          scene.remove(jav.mesh);
          incomingJavelins.splice(j, 1);

          damageFlashAlpha = 0.72;
          cameraShakeIntensity = 0.024;
          soundEngine.playMaterialImpact('metal', _camWorldPos, 'standard', false, 48);
          if (vrFrame.presenting) {
            vrRig.pulseHaptic('both', 0.85, 160);
          }
          currentState.onPlayerDamaged(jav.damage, 'Javelin Impact');
        } else if (
          jav.mesh.position.y < groundHeightAt(jav.mesh.position.x, jav.mesh.position.z) ||
          jav.mesh.position.z > 8
        ) {
          jav.active = false;
          scene.remove(jav.mesh);
          incomingJavelins.splice(j, 1);
        }
      }

      // E. Update Flying Player Arrows (Continuous Swept Hitbox Raycast, Shield Break, Abilities)
      enemiesContainer.updateMatrixWorld(true);
      for (let i = flyingArrows.length - 1; i >= 0; i--) {
        const arrow = flyingArrows[i];
        if (!arrow.active) continue;

        const cfg = ARROW_TYPES[arrow.type];
        arrow.flightTime += simDt;

        if (arrow.type === 'split' && !arrow.hasSplit && arrow.flightTime >= cfg.splitDelay) {
          arrow.hasSplit = true;
          soundEngine.playSplitBifurcation(arrow.mesh.position);
          spawnParticleBurst(arrow.mesh.position, cfg.primaryHex, 14, 0.7);

          const spreadAngles = [
            THREE.MathUtils.degToRad(-cfg.splitSpreadDeg),
            THREE.MathUtils.degToRad(cfg.splitSpreadDeg),
          ];

          spreadAngles.forEach((ang) => {
            const cloneMesh = createArrowModel('split');
            cloneMesh.position.copy(arrow.mesh.position);
            const branchVel = arrow.velocity.clone().applyAxisAngle(_up, ang);
            const lookDir = branchVel.clone().normalize();
            cloneMesh.quaternion.setFromUnitVectors(_forward, lookDir);
            scene.add(cloneMesh);

            const cloneAudioId = nextArrowAudioId++;
            flyingArrows.push({
              audioId: cloneAudioId,
              mesh: cloneMesh,
              type: 'split',
              velocity: branchVel,
              prevTipPos: arrow.mesh.position.clone(),
              drawTension: arrow.drawTension,
              flightTime: arrow.flightTime,
              hasSplit: true,
              active: true,
            });
            soundEngine.startArrowFlightWhistle(
              cloneAudioId,
              'split',
              arrow.mesh.position,
              branchVel.length()
            );
          });
        }

        const SUBSTEPS = 3;
        const subDt = simDt / SUBSTEPS;

        for (let s = 0; s < SUBSTEPS; s++) {
          if (!arrow.active) break;

          _prevTip.copy(arrow.prevTipPos);

          arrow.velocity.y -= 9.81 * cfg.gravityMultiplier * subDt;
          // Wind force scales smoothly with arrow flightTime (close shots hold straight; far shots drift more)
          const windTimeScale = THREE.MathUtils.clamp(0.2 + arrow.flightTime * 0.9, 0.2, 2.25);
          arrow.velocity.x += currentState.windSpeedX * 0.35 * windTimeScale * subDt;
          const speed = arrow.velocity.length();
          arrow.velocity.multiplyScalar(Math.max(0, 1 - cfg.dragCoefficient * speed * subDt));

          arrow.mesh.position.addScaledVector(arrow.velocity, subDt);

          if (arrow.velocity.lengthSq() > 0.25) {
            _rayDir.copy(arrow.velocity).normalize();
            _quat.setFromUnitVectors(_forward, _rayDir);
            arrow.mesh.quaternion.slerp(_quat, 0.35);
          }

          _rayDir.copy(_forward).applyQuaternion(arrow.mesh.quaternion).normalize();
          _currTip.copy(arrow.mesh.position).addScaledVector(_rayDir, ARROW_TIP_OFFSET);

          _stepVec.subVectors(_currTip, _prevTip);
          const stepLen = _stepVec.length();
          arrow.prevTipPos.copy(_currTip);

          if (stepLen > 0.0001) {
            raycaster.set(_prevTip, _stepVec.clone().normalize());
            raycaster.far = stepLen + 0.22;

            // 1. Check Mid-Air Javelin Interception
            if (activeJavelinColliders.length > 0) {
              const javHits = raycaster.intersectObjects(activeJavelinColliders, false);
              if (javHits.length > 0) {
                const jRef = javHits[0].object.userData.javelinRef as IncomingJavelin | undefined;
                if (jRef && jRef.active) {
                  jRef.active = false;
                  arrow.active = false;
                  soundEngine.stopArrowFlightWhistle(arrow.audioId);
                  soundEngine.playMaterialImpact('metal', javHits[0].point, arrow.type, true, 55);
                  spawnParticleBurst(javHits[0].point, '#FDE047', 16, 1.1);
                  scene.remove(arrow.mesh);

                  _screenProj.copy(javHits[0].point).project(camera);
                  currentState.onScoreHit(
                    75,
                    'JAVELIN DEFLECTED',
                    true,
                    0,
                    Math.round(Math.abs(javHits[0].point.z)),
                    'metal',
                    15,
                    {
                      x: THREE.MathUtils.clamp(((_screenProj.x + 1) / 2) * 100, 12, 88),
                      y: THREE.MathUtils.clamp(((-_screenProj.y + 1) / 2) * 100, 15, 82),
                      points: 75,
                      ringLabel: 'DEFLECT +15 Coins',
                      arrowType: arrow.type,
                    }
                  );
                  break;
                }
              }
            }

            // 1B. Check Outgoing Arrow collision against Stone Bastions / Timber Cover Wall
            if (coverColliders.length > 0) {
              const covHits = raycaster.intersectObjects(coverColliders, false);
              if (covHits.length > 0) {
                const covMat = (covHits[0].object.userData.materialType || 'stone') as ImpactMaterial;
                arrow.active = false;
                soundEngine.stopArrowFlightWhistle(arrow.audioId);
                arrow.mesh.position
                  .copy(covHits[0].point)
                  .addScaledVector(_rayDir, -(ARROW_TIP_OFFSET - 0.06));
                covHits[0].object.attach(arrow.mesh);
                stuckArrows.push(arrow.mesh);
                soundEngine.playMaterialImpact(
                  covMat,
                  covHits[0].point,
                  arrow.type,
                  false,
                  arrow.velocity.length()
                );
                spawnParticleBurst(
                  covHits[0].point,
                  covMat === 'wood' ? '#F59E0B' : '#94A3B8',
                  10,
                  0.8
                );
                break;
              }
            }

            // 2. Check Enemy Hitboxes (Shield -> Head -> Torso -> Limb)
            const hits = raycaster.intersectObjects(enemyHitboxMeshes, false);
            if (hits.length > 0) {
              const validHit = hits.find((h) => (h.object.userData.enemyId ?? -1) > 0);
              if (validHit) {
                const enemyId = validHit.object.userData.enemyId as number;
                const hitboxZone = (validHit.object.userData.hitboxZone || 'torso') as HitboxZone;
                const matType = (validHit.object.userData.materialType || 'metal') as ImpactMaterial;
                const hitEnemy = enemies.find((e) => e.id === enemyId && e.aiState !== 'defeated');

                if (hitEnemy) {
                  arrow.active = false;
                  soundEngine.stopArrowFlightWhistle(arrow.audioId);

                  const result = applyDamageToEnemy(
                    hitEnemy,
                    validHit.point,
                    hitboxZone,
                    arrow.type,
                    arrow.drawTension,
                    1.0
                  );

                  soundEngine.playMaterialImpact(
                    matType,
                    validHit.point,
                    arrow.type,
                    result.isCritical,
                    arrow.velocity.length()
                  );

                  if (result.blocked) {
                    // Ricochet sparks off shield & drop arrow
                    spawnParticleBurst(validHit.point, '#FDE047', 16, 1.15);
                    scene.remove(arrow.mesh);
                    cameraShakeIntensity = 0.006;
                  } else {
                    arrow.mesh.position
                      .copy(validHit.point)
                      .addScaledVector(_rayDir, -(ARROW_TIP_OFFSET - 0.07));
                    hitEnemy.bodyPivot.attach(arrow.mesh);
                    stuckArrows.push(arrow.mesh);

                    spawnParticleBurst(
                      validHit.point,
                      result.isCritical ? '#FACC15' : cfg.primaryHex,
                      result.isCritical ? 22 : 12,
                      1.0
                    );
                    if (result.isCritical) {
                      hitstopTimer = 0.04;
                      cameraShakeIntensity = 0.012;
                    }
                  }

                  // Execute Special Arrow Abilities (Thermite bypasses shields!)
                  if (arrow.type === 'explosive') {
                    spawnShockwaveSphere(validHit.point, cfg.blastRadius, '#F97316');
                    spawnParticleBurst(validHit.point, '#EF4444', 30, 1.5);
                    cameraShakeIntensity = 0.022;
                    hitstopTimer = 0.045;

                    enemies.forEach((other) => {
                      if (other.aiState === 'defeated') return;
                      if (other.id === hitEnemy.id && !result.blocked) return;
                      const otherPos = _tmpVec.set(
                        other.rootGroup.position.x,
                        other.rootGroup.position.y + 1.2,
                        other.rootGroup.position.z
                      );
                      const dist = validHit.point.distanceTo(otherPos);
                      if (dist <= cfg.blastRadius) {
                        const falloff = THREE.MathUtils.clamp(1 - dist / cfg.blastRadius, 0.4, 0.95);
                        applyDamageToEnemy(
                          other,
                          otherPos,
                          'torso',
                          'explosive',
                          arrow.drawTension,
                          falloff,
                          'THERMITE BREACH',
                          true
                        );
                      }
                    });
                  } else if (arrow.type === 'ice' && !result.blocked) {
                    hitEnemy.freezeTimer = cfg.freezeDuration;
                    hitEnemy.timeScale = 0.12;
                    hitEnemy.frostCageGroup.visible = true;
                    spawnShockwaveSphere(validHit.point, cfg.blastRadius, '#22D3EE');
                  } else if (arrow.type === 'shock') {
                    const candidates = enemies
                      .filter((e) => e.id !== hitEnemy.id && e.aiState !== 'defeated')
                      .map((e) => {
                        const wp = new THREE.Vector3(
                          e.rootGroup.position.x,
                          e.rootGroup.position.y + 1.35,
                          e.rootGroup.position.z
                        );
                        return { enemy: e, worldPos: wp, dist: validHit.point.distanceTo(wp) };
                      })
                      .filter((item) => item.dist <= cfg.chainRange)
                      .sort((a, b) => a.dist - b.dist)
                      .slice(0, cfg.maxChainTargets);

                    let prevOrigin = validHit.point.clone();
                    candidates.forEach((cand, idx) => {
                      spawnLightningArc(prevOrigin, cand.worldPos);
                      spawnParticleBurst(cand.worldPos, '#A855F7', 12, 0.9);
                      applyDamageToEnemy(
                        cand.enemy,
                        cand.worldPos,
                        'torso',
                        'shock',
                        arrow.drawTension,
                        Math.pow(0.8, idx + 1),
                        `VOLT ARC #${idx + 1}`,
                        true
                      );
                      prevOrigin = cand.worldPos;
                    });
                  }
                  break;
                }
              }
            }
          }

          // 3. Terrain Ground Collision
          const groundY = groundHeightAt(_currTip.x, _currTip.z);
          if (_currTip.y <= groundY) {
            arrow.active = false;
            soundEngine.stopArrowFlightWhistle(arrow.audioId);
            arrow.mesh.position.y += groundY - _currTip.y + 0.04;
            stuckArrows.push(arrow.mesh);

            const groundMat: ImpactMaterial = groundY > 0.75 ? 'stone' : 'wood';
            soundEngine.playMaterialImpact(
              groundMat,
              _currTip,
              arrow.type,
              false,
              arrow.velocity.length()
            );
            spawnParticleBurst(
              _currTip,
              groundMat === 'stone' ? '#94A3B8' : cfg.primaryHex,
              10,
              0.6
            );

            if (arrow.type === 'explosive') {
              spawnShockwaveSphere(_currTip, cfg.blastRadius, '#F97316');
              cameraShakeIntensity = 0.015;
              enemies.forEach((other) => {
                if (other.aiState === 'defeated') return;
                const otherPos = _tmpVec.set(
                  other.rootGroup.position.x,
                  other.rootGroup.position.y + 1.0,
                  other.rootGroup.position.z
                );
                const dist = _currTip.distanceTo(otherPos);
                if (dist <= cfg.blastRadius) {
                  const falloff = THREE.MathUtils.clamp(1 - dist / cfg.blastRadius, 0.35, 0.9);
                  applyDamageToEnemy(
                    other,
                    otherPos,
                    'torso',
                    'explosive',
                    arrow.drawTension,
                    falloff,
                    'BLAST BREACH',
                    true
                  );
                }
              });
            }
            break;
          }
        }

        if (arrow.active) {
          soundEngine.updateArrowFlightWhistle(
            arrow.audioId,
            arrow.mesh.position,
            arrow.velocity.length()
          );
        }

        if (!arrow.active || arrow.flightTime > 10 || arrow.mesh.position.z < -120) {
          if (arrow.active) {
            soundEngine.stopArrowFlightWhistle(arrow.audioId);
            scene.remove(arrow.mesh);
          }
          flyingArrows.splice(i, 1);
        }
      }

      // F. Update VFX Pools
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.age += dt;
        const p = Math.min(1, sw.age / sw.duration);
        const easeOut = 1 - Math.pow(1 - p, 3);
        sw.mesh.scale.setScalar(0.1 + easeOut * sw.maxRadius);
        sw.mat.opacity = 0.55 * (1 - p);
        if (sw.age >= sw.duration) {
          scene.remove(sw.mesh);
          sw.mesh.geometry.dispose();
          sw.mat.dispose();
          shockwaves.splice(i, 1);
        }
      }

      for (let i = lightningBolts.length - 1; i >= 0; i--) {
        const lb = lightningBolts[i];
        lb.age += dt;
        lb.mat.opacity = 1 - lb.age / lb.duration;
        if (lb.age >= lb.duration) {
          scene.remove(lb.line);
          lb.line.geometry.dispose();
          lb.mat.dispose();
          lightningBolts.splice(i, 1);
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.age += dt;
        pt.velocity.y -= 9.81 * dt;
        pt.mesh.position.addScaledVector(pt.velocity, dt);
        const scale = Math.max(0.01, 1 - pt.age / pt.maxAge);
        pt.mesh.scale.setScalar(scale);
        if (pt.age >= pt.maxAge) {
          scene.remove(pt.mesh);
          particles.splice(i, 1);
        }
      }

      const distanceToFinishMeters = Math.max(0, Number((playerPos.z - finishLineZ).toFixed(1)));
      const totalRouteSpan = Math.max(1, startLineZ - finishLineZ);
      const routeProgressPct = Math.round(
        THREE.MathUtils.clamp(((startLineZ - playerPos.z) / totalRouteSpan) * 100, 0, 100)
      );
      const crossedFinishLine = playerPos.z <= finishLineZ + 0.5;

      // G. Telemetry ~15Hz
      if (elapsed - lastTelemetryPush > 0.065) {
        lastTelemetryPush = elapsed;
        const launchSpeed = activeCfg.muzzleVelocity * (0.24 + 0.76 * drawRatio);
        currentState.onUpdateTelemetry({
          drawPercent: Math.round(drawRatio * 100),
          drawLengthMeters: Number(drawDistance.toFixed(2)),
          launchSpeedMs: Math.round(drawRatio > 0.05 ? launchSpeed : activeCfg.muzzleVelocity),
          lastImpactDistance: 0,
          lastHitRing: '',
          lastDamageDealt: 0,
          activeArrowsInFlight: flyingArrows.length,
          distanceToFinishMeters,
          routeProgressPct,
          crossedFinishLine,
        });
      }

      vrRig.updateVrVisuals(
        {
          level: currentState.levelConfig.level,
          seasonName: currentState.seasonConfig.name,
          hp: currentState.playerHp,
          maxHp: currentState.maxPlayerHp,
          enemiesRemaining: aliveCount,
          totalEnemies,
          arrowName: activeCfg.name,
          arrowHex: activeCfg.primaryHex,
          drawPercent: Math.round(drawRatio * 100),
          stealthHidden: isHiddenInCover,
          isCrouched,
          gameState: currentState.gameState,
          earnedStars: currentState.earnedStars,
          coins: currentState.coins,
          distanceToFinishMeters,
          crossedFinishLine,
        },
        vrFrame.bowWorldPos,
        isDrawing,
        elapsed
      );

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      }
    }

    if (isSoftwareGl) {
      frameId = requestAnimationFrame(tick);
    } else {
      renderer.setAnimationLoop(tick);
    }

    const onResize = () => {
      if (!container || renderer.xr.isPresenting) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      renderer.setAnimationLoop(null);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      soundEngine.stopAllWhistles();
      domElem.removeEventListener('pointermove', onPointerMove);
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('resize', onResize);
      vrRig.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden">
      {/* Isolated WebGL Mount Container */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-crosshair"
        aria-label="3D VR Archery Survival Viewport"
      />

      {/* Peripheral Red Damage Vignette Overlay */}
      <div
        ref={damageFlashRef}
        className="fixed inset-0 pointer-events-none z-10 border-[18px] border-rose-600/80 shadow-[inset_0_0_90px_rgba(225,29,72,0.75)]"
        style={{ opacity: 0 }}
      />

      {/* Stance & Cover Stealth Indicator (Ref-Driven, Zero Re-renders) */}
      {gameState === 'playing' && (
        <div
          ref={stanceBadgeRef}
          className="fixed right-5 top-1/2 -translate-y-1/2 z-10 pointer-events-none bg-[#0B101B]/90 border border-white/15 rounded-xl px-3.5 py-2.5 shadow-lg max-w-[230px]"
          aria-label="Player Movement and Stealth Stance"
        >
          <div className="flex items-center gap-2 mb-0.5">
            <span
              ref={stanceDotRef}
              className="w-2.5 h-2.5 rounded-full shrink-0 bg-slate-400"
            />
            <span
              ref={stanceLabelRef}
              className="text-xs font-mono font-bold tracking-wide text-slate-200"
            >
              STANDING READY
            </span>
          </div>
          <span
            ref={stanceSubRef}
            className="block text-[10px] font-mono text-slate-400 leading-snug"
          >
            WASD Move · Shift Run · X/Q Crouch & Hide
          </span>
        </div>
      )}

      {/* In-Canvas Visual Draw Strength Gauge (Green -> Red Tension Gradient) */}
      {gameState === 'playing' && (
        <div
          className="fixed left-5 top-1/2 -translate-y-1/2 z-10 pointer-events-none flex flex-col items-center gap-2 bg-[#0B101B]/90 border border-white/15 rounded-xl px-3 py-3.5 shadow-lg"
          aria-label="Draw Strength Gauge"
        >
          <span className="text-[10px] font-mono font-semibold text-slate-300 tracking-wide text-center">
            Draw Strength
          </span>

          <span
            ref={gaugePercentRef}
            className="text-sm font-mono font-bold text-slate-400 tabular-nums"
          >
            0%
          </span>

          <div className="relative w-4 h-44 rounded-full bg-[#070B12] border border-white/15 overflow-hidden flex flex-col justify-end">
            <div className="absolute inset-x-0 bottom-1/4 h-px bg-white/15 z-10" />
            <div className="absolute inset-x-0 bottom-1/2 h-px bg-white/25 z-10" />
            <div className="absolute inset-x-0 bottom-3/4 h-px bg-white/15 z-10" />

            <div
              ref={gaugeFillRef}
              className="w-full rounded-b-full"
              style={{ height: '0%', backgroundColor: 'hsl(142, 88%, 52%)' }}
            />
          </div>

          <div className="flex flex-col items-center gap-0.5 font-mono tabular-nums text-center">
            <span ref={gaugeVelocityRef} className="text-xs font-bold text-white">
              0 m/s
            </span>
            <span ref={gaugeTierRef} className="text-[10px] font-semibold text-slate-500">
              Ready
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
