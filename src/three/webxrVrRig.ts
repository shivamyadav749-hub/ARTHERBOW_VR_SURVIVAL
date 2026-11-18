import * as THREE from 'three';

export interface WebXRSupportInfo {
  supported: boolean;
  reason?: string;
}

export interface VRTeleportBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  getGroundY: (x: number, z: number) => number;
}

export interface VRInputFrame {
  presenting: boolean;
  handTrackingActive: boolean;
  bowHandTracking: boolean;
  drawHandTracking: boolean;
  moveRight: number;
  moveForward: number;
  turnX: number;
  snapTurnDegrees: number;
  sprint: boolean;
  crouchToggleJustPressed: boolean;
  cycleArrowJustPressed: boolean;
  wristMenuPauseJustPressed: boolean;
  triggerHeld: boolean;
  triggerJustPressed: boolean;
  triggerJustReleased: boolean;
  anyTriggerJustPressed: boolean;
  teleportJustCommitted: boolean;
  teleportTarget: THREE.Vector3 | null;
  hasTwoHandedDraw: boolean;
  handSeparationMeters: number;
  bowWorldPos: THREE.Vector3;
  bowWorldQuat: THREE.Quaternion;
  drawWorldPos: THREE.Vector3;
}

export interface VRHudSnapshot {
  level: number;
  seasonName: string;
  hp: number;
  maxHp: number;
  enemiesRemaining: number;
  totalEnemies: number;
  arrowName: string;
  arrowHex: string;
  drawPercent: number;
  stealthHidden: boolean;
  isCrouched: boolean;
  gameState: string;
  earnedStars: number;
  coins: number;
  distanceToFinishMeters: number;
  crossedFinishLine: boolean;
}

// Structural types for WebXR Hand Tracking API so TS compiles cleanly across DOM lib versions
interface XRJointSpaceLike {
  jointName?: string;
}

interface XRHandLike extends Iterable<[string, XRJointSpaceLike]> {
  get(jointName: string): XRJointSpaceLike | undefined;
  size: number;
}

interface XRJointPoseLike {
  transform: {
    position: { x: number; y: number; z: number };
    orientation: { x: number; y: number; z: number; w: number };
  };
  radius?: number;
}

interface XRFrameWithHands {
  getJointPose?: (joint: XRJointSpaceLike, baseSpace: unknown) => XRJointPoseLike | null;
}

interface XRInputSourceWithHand {
  readonly handedness: XRHandedness;
  readonly gamepad?: Gamepad | null;
  readonly hand?: XRHandLike;
}

const HAND_JOINT_NAMES: readonly string[] = [
  'wrist',
  'thumb-metacarpal',
  'thumb-phalanx-proximal',
  'thumb-phalanx-distal',
  'thumb-tip',
  'index-finger-metacarpal',
  'index-finger-proximal',
  'index-finger-intermediate',
  'index-finger-distal',
  'index-finger-tip',
  'middle-finger-metacarpal',
  'middle-finger-proximal',
  'middle-finger-intermediate',
  'middle-finger-distal',
  'middle-finger-tip',
  'ring-finger-metacarpal',
  'ring-finger-proximal',
  'ring-finger-intermediate',
  'ring-finger-distal',
  'ring-finger-tip',
  'pinky-finger-metacarpal',
  'pinky-finger-proximal',
  'pinky-finger-intermediate',
  'pinky-finger-distal',
  'pinky-finger-tip',
];

const HAND_BONE_PAIRS: readonly [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8], [8, 9],
  // Middle
  [0, 10], [10, 11], [11, 12], [12, 13], [13, 14],
  // Ring
  [0, 15], [15, 16], [16, 17], [17, 18], [18, 19],
  // Pinky
  [0, 20], [20, 21], [21, 22], [22, 23], [23, 24],
  // Palm knuckles arch
  [5, 10], [10, 15], [15, 20],
];

const JOINT_IDX_WRIST = 0;
const JOINT_IDX_THUMB_TIP = 4;
const JOINT_IDX_INDEX_META = 5;
const JOINT_IDX_INDEX_TIP = 9;
const JOINT_IDX_MIDDLE_META = 10;
const JOINT_IDX_MIDDLE_TIP = 14;
const JOINT_IDX_RING_TIP = 19;
const JOINT_IDX_PINKY_META = 20;

const PINCH_ENTER_DIST = 0.032;
const PINCH_EXIT_DIST = 0.046;
const TELEPORT_ARC_STEPS = 22;

export async function checkWebXRSupport(): Promise<WebXRSupportInfo> {
  if (typeof navigator === 'undefined' || !('xr' in navigator) || !navigator.xr) {
    return {
      supported: false,
      reason: 'Browser does not expose navigator.xr (use Meta Quest Browser, Chrome/Edge with WebXR, or HTTPS).',
    };
  }
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-vr');
    return ok
      ? { supported: true }
      : {
          supported: false,
          reason: 'No VR headset runtime detected on this browser/device.',
        };
  } catch (err) {
    return {
      supported: false,
      reason: err instanceof Error ? err.message : 'WebXR check failed.',
    };
  }
}

function buildArcherGauntletMesh(accentHex: number): THREE.Group {
  const group = new THREE.Group();

  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x3b2314,
    roughness: 0.85,
    metalness: 0.08,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xb48a46,
    roughness: 0.32,
    metalness: 0.82,
  });
  const gemMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.3,
  });

  const bracerGeo = new THREE.CylinderGeometry(0.036, 0.044, 0.14, 14);
  bracerGeo.rotateX(Math.PI / 2);
  const bracer = new THREE.Mesh(bracerGeo, leatherMat);
  bracer.position.set(0, -0.01, 0.055);
  group.add(bracer);

  const cuffGeo = new THREE.TorusGeometry(0.041, 0.006, 8, 18);
  const cuff = new THREE.Mesh(cuffGeo, metalMat);
  cuff.position.set(0, -0.01, 0.01);
  group.add(cuff);

  const guardGeo = new THREE.BoxGeometry(0.068, 0.028, 0.055);
  const guard = new THREE.Mesh(guardGeo, leatherMat);
  guard.position.set(0, 0.002, -0.02);
  group.add(guard);

  const runeGeo = new THREE.OctahedronGeometry(0.011, 0);
  const rune = new THREE.Mesh(runeGeo, gemMat);
  rune.position.set(0, 0.02, -0.015);
  group.add(rune);

  return group;
}

interface ArticulatedHandVisual {
  group: THREE.Group;
  jointMeshes: THREE.Mesh[];
  boneMeshes: THREE.Mesh[];
  jointPositions: THREE.Vector3[];
  jointValid: boolean[];
  pinchHalo: THREE.Mesh;
  pinchHaloMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

function createArticulatedHandVisual(accentHex: number): ArticulatedHandVisual {
  const group = new THREE.Group();
  group.visible = false;

  const jointGeo = new THREE.SphereGeometry(0.009, 10, 8);
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: accentHex,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.25,
  });
  const tipMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.7,
    roughness: 0.25,
    metalness: 0.35,
  });

  const boneGeo = new THREE.CylinderGeometry(0.0055, 0.0065, 1, 8);
  const boneMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.55,
    metalness: 0.45,
  });

  const jointMeshes: THREE.Mesh[] = [];
  const jointPositions: THREE.Vector3[] = [];
  const jointValid: boolean[] = [];

  const tipSet = new Set([4, 9, 14, 19, 24]);
  for (let i = 0; i < HAND_JOINT_NAMES.length; i++) {
    const m = new THREE.Mesh(jointGeo, tipSet.has(i) ? tipMat : jointMat);
    m.visible = false;
    group.add(m);
    jointMeshes.push(m);
    jointPositions.push(new THREE.Vector3());
    jointValid.push(false);
  }

  const boneMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < HAND_BONE_PAIRS.length; i++) {
    const b = new THREE.Mesh(boneGeo, boneMat);
    b.visible = false;
    group.add(b);
    boneMeshes.push(b);
  }

  const pinchHaloGeo = new THREE.RingGeometry(0.011, 0.018, 18);
  const pinchHaloMat = new THREE.MeshBasicMaterial({
    color: accentHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const pinchHalo = new THREE.Mesh(pinchHaloGeo, pinchHaloMat);
  pinchHalo.visible = false;
  group.add(pinchHalo);

  return {
    group,
    jointMeshes,
    boneMeshes,
    jointPositions,
    jointValid,
    pinchHalo,
    pinchHaloMat,
    dispose: () => {
      jointGeo.dispose();
      jointMat.dispose();
      tipMat.dispose();
      boneGeo.dispose();
      boneMat.dispose();
      pinchHaloGeo.dispose();
      pinchHaloMat.dispose();
    },
  };
}

interface TrackedHandSample {
  active: boolean;
  palmLocalPos: THREE.Vector3;
  palmWorldPos: THREE.Vector3;
  palmNormalWorld: THREE.Vector3;
  bowWorldQuat: THREE.Quaternion;
  thumbTipWorld: THREE.Vector3;
  indexTipWorld: THREE.Vector3;
  middleTipWorld: THREE.Vector3;
  ringTipWorld: THREE.Vector3;
  wristWorld: THREE.Vector3;
  indexPinchDist: number;
  middlePinchDist: number;
  ringPinchDist: number;
  indexPinching: boolean;
  middlePinching: boolean;
  ringPinching: boolean;
  aimDirWorld: THREE.Vector3;
}

function createEmptyHandSample(): TrackedHandSample {
  return {
    active: false,
    palmLocalPos: new THREE.Vector3(),
    palmWorldPos: new THREE.Vector3(),
    palmNormalWorld: new THREE.Vector3(0, 1, 0),
    bowWorldQuat: new THREE.Quaternion(),
    thumbTipWorld: new THREE.Vector3(),
    indexTipWorld: new THREE.Vector3(),
    middleTipWorld: new THREE.Vector3(),
    ringTipWorld: new THREE.Vector3(),
    wristWorld: new THREE.Vector3(),
    indexPinchDist: 1,
    middlePinchDist: 1,
    ringPinchDist: 1,
    indexPinching: false,
    middlePinching: false,
    ringPinching: false,
    aimDirWorld: new THREE.Vector3(0, 0, -1),
  };
}

export interface WebXRRigHandle {
  playerRig: THREE.Group;
  bowMountGroup: THREE.Group;
  vrSlateMesh: THREE.Mesh;
  vrBannerMesh: THREE.Mesh;
  isPresenting: () => boolean;
  enterVR: () => Promise<void>;
  exitVR: () => Promise<void>;
  pollVRInput: (dominantEye: 'left' | 'right', teleportBounds?: VRTeleportBounds) => VRInputFrame;
  pulseHaptic: (hand: 'bow' | 'draw' | 'both', intensity: number, durationMs: number) => void;
  updateVrVisuals: (
    snapshot: VRHudSnapshot,
    bowWorldPos: THREE.Vector3,
    isDrawing: boolean,
    elapsed: number
  ) => void;
  dispose: () => void;
}

export function createWebXRRig(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  onSessionStateChange?: (presenting: boolean) => void
): WebXRRigHandle {
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');

  const playerRig = new THREE.Group();
  playerRig.name = 'WebXRPlayerRig';
  scene.add(playerRig);
  playerRig.add(camera);

  const controller0 = renderer.xr.getController(0);
  const controller1 = renderer.xr.getController(1);
  const grip0 = renderer.xr.getControllerGrip(0);
  const grip1 = renderer.xr.getControllerGrip(1);

  playerRig.add(controller0);
  playerRig.add(controller1);
  playerRig.add(grip0);
  playerRig.add(grip1);

  const gauntlet0 = buildArcherGauntletMesh(0x38bdf8);
  const gauntlet1 = buildArcherGauntletMesh(0xf59e0b);
  grip0.add(gauntlet0);
  grip1.add(gauntlet1);
  grip0.visible = false;
  grip1.visible = false;

  // Articulated 3D Hands-First Skeleton Visuals (when controllerless XRHand is active)
  const handVisualLeft = createArticulatedHandVisual(0x38bdf8);
  const handVisualRight = createArticulatedHandVisual(0xf59e0b);
  playerRig.add(handVisualLeft.group);
  playerRig.add(handVisualRight.group);

  // Draw hand string-pinch orb (visual aid while pinching/pulling string in VR)
  const orbGeo = new THREE.SphereGeometry(0.022, 14, 12);
  const orbMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.78,
  });
  const drawOrb = new THREE.Mesh(orbGeo, orbMat);
  drawOrb.visible = false;
  scene.add(drawOrb);

  // Subtle aim ray on bow hand when idle in VR
  const rayGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -2.5),
  ]);
  const rayMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.3,
  });
  const aimRay = new THREE.Line(rayGeo, rayMat);
  aimRay.visible = false;
  scene.add(aimRay);

  // Hands-First Parabolic Teleport Arc + Ground Reticle
  const telePositions = new Float32Array(TELEPORT_ARC_STEPS * 3);
  const teleArcGeo = new THREE.BufferGeometry();
  teleArcGeo.setAttribute('position', new THREE.BufferAttribute(telePositions, 3));
  const teleArcMat = new THREE.LineBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.85,
  });
  const teleArcLine = new THREE.Line(teleArcGeo, teleArcMat);
  teleArcLine.visible = false;
  teleArcLine.frustumCulled = false;
  scene.add(teleArcLine);

  const teleRingGeo = new THREE.RingGeometry(0.24, 0.34, 28);
  teleRingGeo.rotateX(-Math.PI / 2);
  const teleRingMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const teleReticleMesh = new THREE.Mesh(teleRingGeo, teleRingMat);
  teleReticleMesh.visible = false;
  scene.add(teleReticleMesh);

  // Bow world-space mount group updated cleanly in VR so two-handed aiming works smoothly
  const bowMountGroup = new THREE.Group();
  bowMountGroup.name = 'VRBowMount';
  scene.add(bowMountGroup);

  // 1. Diegetic 3D VR Slate (attached to Bow Riser side inside VR)
  const slateCanvas = document.createElement('canvas');
  slateCanvas.width = 512;
  slateCanvas.height = 196;
  const slateCtx = slateCanvas.getContext('2d')!;
  const slateTex = new THREE.CanvasTexture(slateCanvas);
  slateTex.colorSpace = THREE.SRGBColorSpace;
  const slateMat = new THREE.MeshBasicMaterial({
    map: slateTex,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
  });
  const vrSlateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.092), slateMat);
  vrSlateMesh.position.set(-0.14, 0.14, -0.02);
  vrSlateMesh.rotation.y = 0.28;
  vrSlateMesh.visible = false;
  bowMountGroup.add(vrSlateMesh);

  // 2. Diegetic 3D Palm-Up Wrist Menu (Hands-First Touch/Poke Buttons: Arrow, Crouch, Pause)
  const wristMenuCanvas = document.createElement('canvas');
  wristMenuCanvas.width = 512;
  wristMenuCanvas.height = 192;
  const wristMenuCtx = wristMenuCanvas.getContext('2d')!;
  const wristMenuTex = new THREE.CanvasTexture(wristMenuCanvas);
  wristMenuTex.colorSpace = THREE.SRGBColorSpace;
  const wristMenuMat = new THREE.MeshBasicMaterial({
    map: wristMenuTex,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const wristMenuMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.09), wristMenuMat);
  wristMenuMesh.visible = false;
  scene.add(wristMenuMesh);

  // 3. Diegetic 3D VR World Outcome Banner (Victory / Defeat / Paused inside VR)
  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 640;
  bannerCanvas.height = 256;
  const bannerCtx = bannerCanvas.getContext('2d')!;
  const bannerTex = new THREE.CanvasTexture(bannerCanvas);
  bannerTex.colorSpace = THREE.SRGBColorSpace;
  const bannerMat = new THREE.MeshBasicMaterial({
    map: bannerTex,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
  });
  const vrBannerMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.6), bannerMat);
  vrBannerMesh.visible = false;
  scene.add(vrBannerMesh);

  // Handedness tracking per XR controller slot
  const slotHandedness: Record<number, 'left' | 'right' | 'none'> = { 0: 'none', 1: 'none' };
  const inputSourcesByHand: { left: XRInputSourceWithHand | null; right: XRInputSourceWithHand | null } = {
    left: null,
    right: null,
  };
  const selectActiveSlot: Record<number, boolean> = { 0: false, 1: false };
  const connectedSlots = new Set<number>();

  const onConn0 = (e: { data?: XRInputSource }) => {
    connectedSlots.add(0);
    slotHandedness[0] = e.data?.handedness === 'left' || e.data?.handedness === 'right' ? e.data.handedness : 'left';
  };
  const onDisconn0 = () => {
    connectedSlots.delete(0);
    slotHandedness[0] = 'none';
    selectActiveSlot[0] = false;
  };
  const onConn1 = (e: { data?: XRInputSource }) => {
    connectedSlots.add(1);
    slotHandedness[1] = e.data?.handedness === 'left' || e.data?.handedness === 'right' ? e.data.handedness : 'right';
  };
  const onDisconn1 = () => {
    connectedSlots.delete(1);
    slotHandedness[1] = 'none';
    selectActiveSlot[1] = false;
  };

  const onSelectStart0 = () => { selectActiveSlot[0] = true; };
  const onSelectEnd0 = () => { selectActiveSlot[0] = false; };
  const onSelectStart1 = () => { selectActiveSlot[1] = true; };
  const onSelectEnd1 = () => { selectActiveSlot[1] = false; };

  controller0.addEventListener('connected', onConn0 as never);
  controller0.addEventListener('disconnected', onDisconn0);
  controller1.addEventListener('connected', onConn1 as never);
  controller1.addEventListener('disconnected', onDisconn1);
  controller0.addEventListener('selectstart', onSelectStart0);
  controller0.addEventListener('selectend', onSelectEnd0);
  controller1.addEventListener('selectstart', onSelectStart1);
  controller1.addEventListener('selectend', onSelectEnd1);

  let activeSession: XRSession | null = null;
  let prevTriggerHeld = false;
  let prevAnyTriggerHeld = false;
  let prevCrouchBtn = false;
  let prevArrowBtn = false;
  let prevLeftRingPinch = false;
  let prevRightRingPinch = false;
  let prevTeleportPinch = false;
  let lastHandInputMode = false;
  let lastWristMenuStateKey = '';
  let wristMenuHoverIdx = -1;
  let wristMenuVisible = false;
  let wristMenuCooldownUntil = 0;
  let shoulderQuiverCooldownUntil = 0;
  let lastHudRedraw = 0;
  let lastBannerKey = '';

  const handSampleLeft = createEmptyHandSample();
  const handSampleRight = createEmptyHandSample();
  const _teleportCandidate = new THREE.Vector3();
  let hasValidTeleportCandidate = false;

  // Pre-allocated math helpers (Zero GC in render loop)
  const _bowPos = new THREE.Vector3();
  const _bowQuat = new THREE.Quaternion();
  const _drawPos = new THREE.Vector3();
  const _camPos = new THREE.Vector3();
  const _camQuat = new THREE.Quaternion();
  const _fwd = new THREE.Vector3();
  const _upY = new THREE.Vector3(0, 1, 0);
  const _boneDir = new THREE.Vector3();
  const _boneMid = new THREE.Vector3();
  const _boneQuat = new THREE.Quaternion();
  const _palmFwd = new THREE.Vector3();
  const _palmAcross = new THREE.Vector3();
  const _palmNormal = new THREE.Vector3();
  const _bowBasisMat = new THREE.Matrix4();
  const _bowRightAxis = new THREE.Vector3();
  const _bowUpAxis = new THREE.Vector3();
  const _bowBackAxis = new THREE.Vector3();
  const _headLocalDraw = new THREE.Vector3();
  const _invCamQuat = new THREE.Quaternion();
  const _wristLocalIdxTip = new THREE.Vector3();
  const _wristInvQuat = new THREE.Quaternion();
  const _telePos = new THREE.Vector3();
  const _teleVel = new THREE.Vector3();
  const _teleWorldTarget = new THREE.Vector3();
  const _matWorld = new THREE.Matrix4();

  const onSessionEnded = () => {
    activeSession = null;
    grip0.visible = false;
    grip1.visible = false;
    handVisualLeft.group.visible = false;
    handVisualRight.group.visible = false;
    drawOrb.visible = false;
    aimRay.visible = false;
    teleArcLine.visible = false;
    teleReticleMesh.visible = false;
    wristMenuMesh.visible = false;
    vrSlateMesh.visible = false;
    vrBannerMesh.visible = false;
    prevTriggerHeld = false;
    prevAnyTriggerHeld = false;
    prevLeftRingPinch = false;
    prevRightRingPinch = false;
    prevTeleportPinch = false;
    hasValidTeleportCandidate = false;
    wristMenuVisible = false;
    lastHandInputMode = false;
    playerRig.rotation.y = 0;
    onSessionStateChange?.(false);
  };

  const enterVR = async () => {
    if (activeSession) return;
    if (typeof navigator === 'undefined' || !navigator.xr) {
      throw new Error('WebXR is not supported by this browser.');
    }
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
    });
    activeSession = session;
    session.addEventListener('end', onSessionEnded);
    await renderer.xr.setSession(session);
    grip0.visible = true;
    grip1.visible = true;
    onSessionStateChange?.(true);
  };

  const exitVR = async () => {
    if (activeSession) {
      await activeSession.end();
    }
  };

  const getSlotForHand = (hand: 'left' | 'right'): 0 | 1 => {
    if (slotHandedness[0] === hand) return 0;
    if (slotHandedness[1] === hand) return 1;
    return hand === 'left' ? 0 : 1;
  };

  const sampleXRHand = (
    src: XRInputSourceWithHand | null,
    handedness: 'left' | 'right',
    frame: XRFrameWithHands | null,
    refSpace: unknown,
    visual: ArticulatedHandVisual,
    sample: TrackedHandSample
  ) => {
    if (!src?.hand || !frame?.getJointPose || !refSpace) {
      sample.active = false;
      visual.group.visible = false;
      visual.pinchHalo.visible = false;
      return;
    }

    let validCount = 0;
    for (let i = 0; i < HAND_JOINT_NAMES.length; i++) {
      const jointSpace = src.hand.get(HAND_JOINT_NAMES[i]);
      const pose = jointSpace ? frame.getJointPose(jointSpace, refSpace) : null;
      if (pose) {
        const p = pose.transform.position;
        visual.jointPositions[i].set(p.x, p.y, p.z);
        visual.jointMeshes[i].position.set(p.x, p.y, p.z);
        const rScale = pose.radius ? THREE.MathUtils.clamp(pose.radius / 0.009, 0.7, 1.55) : 1;
        visual.jointMeshes[i].scale.setScalar(rScale);
        visual.jointMeshes[i].visible = true;
        visual.jointValid[i] = true;
        validCount++;
      } else {
        visual.jointMeshes[i].visible = false;
        visual.jointValid[i] = false;
      }
    }

    if (validCount < 8 || !visual.jointValid[JOINT_IDX_WRIST]) {
      sample.active = false;
      visual.group.visible = false;
      visual.pinchHalo.visible = false;
      return;
    }

    sample.active = true;
    visual.group.visible = true;

    // Update phalanx & metacarpal bones
    for (let b = 0; b < HAND_BONE_PAIRS.length; b++) {
      const [aIdx, bIdx] = HAND_BONE_PAIRS[b];
      const mesh = visual.boneMeshes[b];
      if (!visual.jointValid[aIdx] || !visual.jointValid[bIdx]) {
        mesh.visible = false;
        continue;
      }
      const pA = visual.jointPositions[aIdx];
      const pB = visual.jointPositions[bIdx];
      _boneDir.subVectors(pB, pA);
      const len = _boneDir.length();
      if (len < 0.002) {
        mesh.visible = false;
        continue;
      }
      _boneMid.addVectors(pA, pB).multiplyScalar(0.5);
      _boneDir.normalize();
      _boneQuat.setFromUnitVectors(_upY, _boneDir);
      mesh.position.copy(_boneMid);
      mesh.quaternion.copy(_boneQuat);
      mesh.scale.set(1, len, 1);
      mesh.visible = true;
    }

    // Transform key joints into World Space (playerRig space -> world space)
    playerRig.updateMatrixWorld(true);
    _matWorld.copy(playerRig.matrixWorld);

    const wristLocal = visual.jointPositions[JOINT_IDX_WRIST];
    const midMetaLocal = visual.jointValid[JOINT_IDX_MIDDLE_META]
      ? visual.jointPositions[JOINT_IDX_MIDDLE_META]
      : wristLocal;
    const idxMetaLocal = visual.jointValid[JOINT_IDX_INDEX_META]
      ? visual.jointPositions[JOINT_IDX_INDEX_META]
      : midMetaLocal;
    const pinkyMetaLocal = visual.jointValid[JOINT_IDX_PINKY_META]
      ? visual.jointPositions[JOINT_IDX_PINKY_META]
      : midMetaLocal;

    sample.palmLocalPos.lerpVectors(wristLocal, midMetaLocal, 0.55);
    sample.palmWorldPos.copy(sample.palmLocalPos).applyMatrix4(_matWorld);
    sample.wristWorld.copy(wristLocal).applyMatrix4(_matWorld);

    if (visual.jointValid[JOINT_IDX_THUMB_TIP]) {
      sample.thumbTipWorld.copy(visual.jointPositions[JOINT_IDX_THUMB_TIP]).applyMatrix4(_matWorld);
    } else {
      sample.thumbTipWorld.copy(sample.palmWorldPos);
    }
    if (visual.jointValid[JOINT_IDX_INDEX_TIP]) {
      sample.indexTipWorld.copy(visual.jointPositions[JOINT_IDX_INDEX_TIP]).applyMatrix4(_matWorld);
    } else {
      sample.indexTipWorld.copy(sample.palmWorldPos);
    }
    if (visual.jointValid[JOINT_IDX_MIDDLE_TIP]) {
      sample.middleTipWorld.copy(visual.jointPositions[JOINT_IDX_MIDDLE_TIP]).applyMatrix4(_matWorld);
    } else {
      sample.middleTipWorld.copy(sample.palmWorldPos);
    }
    if (visual.jointValid[JOINT_IDX_RING_TIP]) {
      sample.ringTipWorld.copy(visual.jointPositions[JOINT_IDX_RING_TIP]).applyMatrix4(_matWorld);
    } else {
      sample.ringTipWorld.copy(sample.palmWorldPos);
    }

    // Pinch distances with hysteresis
    sample.indexPinchDist = sample.thumbTipWorld.distanceTo(sample.indexTipWorld);
    sample.middlePinchDist = sample.thumbTipWorld.distanceTo(sample.middleTipWorld);
    sample.ringPinchDist = sample.thumbTipWorld.distanceTo(sample.ringTipWorld);

    sample.indexPinching = sample.indexPinching
      ? sample.indexPinchDist < PINCH_EXIT_DIST
      : sample.indexPinchDist < PINCH_ENTER_DIST;
    sample.middlePinching = sample.middlePinching
      ? sample.middlePinchDist < PINCH_EXIT_DIST
      : sample.middlePinchDist < PINCH_ENTER_DIST;
    sample.ringPinching = sample.ringPinching
      ? sample.ringPinchDist < PINCH_EXIT_DIST
      : sample.ringPinchDist < PINCH_ENTER_DIST;

    // Show pinch halo between thumb & index fingertips on bare hands
    if (visual.jointValid[JOINT_IDX_THUMB_TIP] && visual.jointValid[JOINT_IDX_INDEX_TIP]) {
      _boneMid.addVectors(
        visual.jointPositions[JOINT_IDX_THUMB_TIP],
        visual.jointPositions[JOINT_IDX_INDEX_TIP]
      ).multiplyScalar(0.5);
      visual.pinchHalo.position.copy(_boneMid);
      visual.pinchHalo.lookAt(camera.position);
      const proximity = 1 - THREE.MathUtils.clamp((sample.indexPinchDist - 0.02) / 0.08, 0, 1);
      visual.pinchHalo.visible = proximity > 0.15 || sample.indexPinching;
      visual.pinchHalo.scale.setScalar(sample.indexPinching ? 0.8 : 1.35 - proximity * 0.45);
      visual.pinchHaloMat.color.setHex(sample.indexPinching ? 0x34d399 : 0x38bdf8);
      visual.pinchHaloMat.opacity = sample.indexPinching ? 0.95 : 0.35 + proximity * 0.45;
    } else {
      visual.pinchHalo.visible = false;
    }

    // Compute ergonomic palm normal & forward knuckle vector in World Space
    _palmFwd
      .copy(midMetaLocal)
      .sub(wristLocal)
      .transformDirection(_matWorld);
    if (_palmFwd.lengthSq() < 1e-5) _palmFwd.set(0, 0, -1);
    _palmFwd.normalize();

    _palmAcross
      .copy(idxMetaLocal)
      .sub(pinkyMetaLocal)
      .transformDirection(_matWorld);
    if (_palmAcross.lengthSq() < 1e-5) _palmAcross.set(1, 0, 0);
    _palmAcross.normalize();

    // Right-hand cross order vs Left-hand cross order so palmNormal always exits the open palm
    if (handedness === 'left') {
      _palmNormal.crossVectors(_palmAcross, _palmFwd).normalize();
    } else {
      _palmNormal.crossVectors(_palmFwd, _palmAcross).normalize();
    }
    sample.palmNormalWorld.copy(_palmNormal);

    // Aim direction along hand forward / knuckle vector
    sample.aimDirWorld.copy(_palmFwd);

    // Construct upright Bow Grip Quaternion from palm orientation:
    // -Z (bow forward shoot axis) points along finger-knuckle forward / slight inward cant
    // +Y (bow vertical limb axis) aligns along thumb-to-knuckle ridge (_palmAcross)
    _bowBackAxis.copy(_palmFwd).negate().normalize();
    _bowRightAxis.copy(_palmNormal).multiplyScalar(handedness === 'left' ? -1 : 1);
    _bowUpAxis.crossVectors(_bowBackAxis, _bowRightAxis).normalize();
    _bowRightAxis.crossVectors(_bowUpAxis, _bowBackAxis).normalize();
    _bowBasisMat.makeBasis(_bowRightAxis, _bowUpAxis, _bowBackAxis);
    sample.bowWorldQuat.setFromRotationMatrix(_bowBasisMat);
  };

  const redrawWristMenu = (arrowName: string, arrowHex: string, isCrouched: boolean, hoverIdx: number) => {
    const w = wristMenuCanvas.width;
    const h = wristMenuCanvas.height;
    wristMenuCtx.clearRect(0, 0, w, h);

    wristMenuCtx.fillStyle = 'rgba(8, 13, 24, 0.94)';
    wristMenuCtx.strokeStyle = '#38BDF8';
    wristMenuCtx.lineWidth = 4;
    wristMenuCtx.beginPath();
    wristMenuCtx.roundRect(4, 4, w - 8, h - 8, 22);
    wristMenuCtx.fill();
    wristMenuCtx.stroke();

    wristMenuCtx.fillStyle = '#94A3B8';
    wristMenuCtx.font = 'bold 18px monospace';
    wristMenuCtx.textAlign = 'center';
    wristMenuCtx.fillText('HANDS-FIRST WRIST MENU (POKE WITH INDEX)', w / 2, 32);

    const buttons = [
      { label: 'ARROW', sub: arrowName.split(' ')[0].toUpperCase(), accent: arrowHex },
      { label: isCrouched ? 'STAND UP' : 'CROUCH', sub: isCrouched ? 'HIDDEN' : 'STANCE', accent: '#34D399' },
      { label: 'PAUSE', sub: 'MENU', accent: '#F59E0B' },
    ];

    const pad = 16;
    const btnW = (w - pad * 4) / 3;
    const btnY = 48;
    const btnH = h - 64;

    buttons.forEach((btn, idx) => {
      const bx = pad + idx * (btnW + pad);
      const isHover = idx === hoverIdx;
      wristMenuCtx.fillStyle = isHover ? 'rgba(56, 189, 248, 0.35)' : 'rgba(15, 23, 42, 0.92)';
      wristMenuCtx.strokeStyle = isHover ? '#FFFFFF' : btn.accent;
      wristMenuCtx.lineWidth = isHover ? 4 : 3;
      wristMenuCtx.beginPath();
      wristMenuCtx.roundRect(bx, btnY, btnW, btnH, 16);
      wristMenuCtx.fill();
      wristMenuCtx.stroke();

      wristMenuCtx.fillStyle = '#F8FAFC';
      wristMenuCtx.font = 'bold 22px sans-serif';
      wristMenuCtx.fillText(btn.label, bx + btnW / 2, btnY + 52);

      wristMenuCtx.fillStyle = btn.accent;
      wristMenuCtx.font = 'bold 17px monospace';
      wristMenuCtx.fillText(btn.sub, bx + btnW / 2, btnY + 86);
    });

    wristMenuCtx.textAlign = 'left';
    wristMenuTex.needsUpdate = true;
  };

  const pollVRInput = (
    dominantEye: 'left' | 'right',
    teleportBounds?: VRTeleportBounds
  ): VRInputFrame => {
    const presenting = renderer.xr.isPresenting;
    if (!presenting) {
      teleArcLine.visible = false;
      teleReticleMesh.visible = false;
      wristMenuMesh.visible = false;
      return {
        presenting: false,
        handTrackingActive: false,
        bowHandTracking: false,
        drawHandTracking: false,
        moveRight: 0,
        moveForward: 0,
        turnX: 0,
        snapTurnDegrees: 0,
        sprint: false,
        crouchToggleJustPressed: false,
        cycleArrowJustPressed: false,
        wristMenuPauseJustPressed: false,
        triggerHeld: false,
        triggerJustPressed: false,
        triggerJustReleased: false,
        anyTriggerJustPressed: false,
        teleportJustCommitted: false,
        teleportTarget: null,
        hasTwoHandedDraw: false,
        handSeparationMeters: 0,
        bowWorldPos: _bowPos,
        bowWorldQuat: _bowQuat,
        drawWorldPos: _drawPos,
      };
    }

    const bowHand: 'left' | 'right' = dominantEye === 'right' ? 'left' : 'right';
    const drawHand: 'left' | 'right' = dominantEye === 'right' ? 'right' : 'left';

    const bowSlot = getSlotForHand(bowHand);
    const drawSlot = getSlotForHand(drawHand);
    const bowCtrl = bowSlot === 0 ? controller0 : controller1;
    const drawCtrl = drawSlot === 0 ? controller0 : controller1;

    // Refresh live XRInputSources (controllers AND bare hands)
    inputSourcesByHand.left = null;
    inputSourcesByHand.right = null;
    const session = renderer.xr.getSession();
    if (session) {
      for (const src of session.inputSources) {
        const s = src as XRInputSourceWithHand;
        if (s.handedness === 'left') inputSourcesByHand.left = s;
        else if (s.handedness === 'right') inputSourcesByHand.right = s;
      }
    }

    // Sample WebXR XRHand joint skeletons when available
    const xrFrame = (renderer.xr.getFrame?.() ?? null) as XRFrameWithHands | null;
    const refSpace = renderer.xr.getReferenceSpace?.() ?? null;
    sampleXRHand(inputSourcesByHand.left, 'left', xrFrame, refSpace, handVisualLeft, handSampleLeft);
    sampleXRHand(inputSourcesByHand.right, 'right', xrFrame, refSpace, handVisualRight, handSampleRight);

    const leftPad = inputSourcesByHand.left?.gamepad;
    const rightPad = inputSourcesByHand.right?.gamepad;
    const bowPad = bowHand === 'left' ? leftPad : rightPad;
    const drawPad = drawHand === 'left' ? leftPad : rightPad;

    const bowHandSample = bowHand === 'left' ? handSampleLeft : handSampleRight;
    const drawHandSample = drawHand === 'left' ? handSampleLeft : handSampleRight;

    const bowHandTracking = bowHandSample.active && !bowPad;
    const drawHandTracking = drawHandSample.active && !drawPad;
    const handTrackingActive = bowHandTracking || drawHandTracking;
    lastHandInputMode = handTrackingActive;

    // Toggle controller gauntlets vs articulated hand skeletons per hand
    const leftHandUsingSkeleton = handSampleLeft.active && !leftPad;
    const rightHandUsingSkeleton = handSampleRight.active && !rightPad;
    if (slotHandedness[0] === 'left') {
      grip0.visible = !leftHandUsingSkeleton;
      grip1.visible = !rightHandUsingSkeleton;
    } else if (slotHandedness[0] === 'right') {
      grip0.visible = !rightHandUsingSkeleton;
      grip1.visible = !leftHandUsingSkeleton;
    } else {
      grip0.visible = !leftHandUsingSkeleton;
      grip1.visible = !rightHandUsingSkeleton;
    }

    // World poses for Bow Hand & Draw Hand (seamlessly blends bare hand joints OR controller grip)
    if (bowHandTracking) {
      _bowPos.copy(bowHandSample.palmWorldPos);
      _bowQuat.copy(bowHandSample.bowWorldQuat);
    } else {
      bowCtrl.getWorldPosition(_bowPos);
      bowCtrl.getWorldQuaternion(_bowQuat);
    }

    if (drawHandTracking) {
      // Exact pinch midpoint between thumb-tip and index-finger-tip
      _drawPos.addVectors(drawHandSample.thumbTipWorld, drawHandSample.indexTipWorld).multiplyScalar(0.5);
    } else {
      drawCtrl.getWorldPosition(_drawPos);
    }

    // Controller thumbsticks (zero when using bare hands)
    const readStick = (pad?: Gamepad | null): [number, number] => {
      if (!pad || !pad.axes) return [0, 0];
      const ax = pad.axes.length >= 4 ? pad.axes[2] : (pad.axes[0] ?? 0);
      const ay = pad.axes.length >= 4 ? pad.axes[3] : (pad.axes[1] ?? 0);
      const dz = 0.16;
      return [
        Math.abs(ax) > dz ? ax : 0,
        Math.abs(ay) > dz ? ay : 0,
      ];
    };

    const [lx, ly] = readStick(leftPad);
    const [rx, ry] = readStick(rightPad);
    const moveRight = lx;
    const moveForward = -ly;
    const turnX = rx;

    const sprint = Boolean(
      leftPad?.buttons?.[3]?.pressed || leftPad?.buttons?.[1]?.pressed
    );

    // Controller Crouch + Arrow Cycle
    const ctrlCrouchBtn = Boolean(
      rightPad?.buttons?.[5]?.pressed ||
        rightPad?.buttons?.[3]?.pressed ||
        ry > 0.78
    );
    let crouchToggleJustPressed = ctrlCrouchBtn && !prevCrouchBtn;
    prevCrouchBtn = ctrlCrouchBtn;

    const ctrlArrowBtn = Boolean(
      bowPad?.buttons?.[4]?.pressed ||
        bowPad?.buttons?.[5]?.pressed ||
        drawPad?.buttons?.[4]?.pressed
    );
    let cycleArrowJustPressed = ctrlArrowBtn && !prevArrowBtn;
    prevArrowBtn = ctrlArrowBtn;

    // Bare-hand Thumb+Index pinch (or WebXR select / controller trigger)
    const drawPinchBtn = drawHandTracking
      ? drawHandSample.indexPinching || selectActiveSlot[drawSlot]
      : Boolean(drawPad?.buttons?.[0]?.pressed || selectActiveSlot[drawSlot]);

    const bowPinchBtn = bowHandTracking
      ? bowHandSample.indexPinching || selectActiveSlot[bowSlot]
      : Boolean(bowPad?.buttons?.[0]?.pressed || selectActiveSlot[bowSlot]);

    const anyTrigger = drawPinchBtn || bowPinchBtn;
    const triggerJustPressed = drawPinchBtn && !prevTriggerHeld;
    const triggerJustReleased = !drawPinchBtn && prevTriggerHeld;
    const anyTriggerJustPressed = anyTrigger && !prevAnyTriggerHeld;

    prevTriggerHeld = drawPinchBtn;
    prevAnyTriggerHeld = anyTrigger;

    // ------------------------------------------------------------------
    // HANDS-FIRST FEATURE 1: Over-Shoulder Quiver Reach (Switch Arrow)
    // ------------------------------------------------------------------
    const nowSec = performance.now() * 0.001;
    if (drawHandTracking && triggerJustPressed && nowSec > shoulderQuiverCooldownUntil) {
      camera.getWorldPosition(_camPos);
      camera.getWorldQuaternion(_camQuat);
      _invCamQuat.copy(_camQuat).invert();
      _headLocalDraw.copy(_drawPos).sub(_camPos).applyQuaternion(_invCamQuat);

      // Behind/beside shoulder/ear zone in head-local coordinates
      const inQuiverZone =
        _headLocalDraw.z > 0.04 &&
        _headLocalDraw.y < 0.14 &&
        _headLocalDraw.y > -0.45 &&
        Math.abs(_headLocalDraw.x) < 0.48;

      if (inQuiverZone) {
        cycleArrowJustPressed = true;
        shoulderQuiverCooldownUntil = nowSec + 0.55;
      }
    }

    // ------------------------------------------------------------------
    // HANDS-FIRST FEATURE 2: Ring-Pinch Snap Turning (±35°)
    // ------------------------------------------------------------------
    let snapTurnDegrees = 0;
    const leftRingPinch = handSampleLeft.active && !leftPad && handSampleLeft.ringPinching;
    const rightRingPinch = handSampleRight.active && !rightPad && handSampleRight.ringPinching;
    if (leftRingPinch && !prevLeftRingPinch) snapTurnDegrees -= 35;
    if (rightRingPinch && !prevRightRingPinch) snapTurnDegrees += 35;
    prevLeftRingPinch = leftRingPinch;
    prevRightRingPinch = rightRingPinch;

    // ------------------------------------------------------------------
    // HANDS-FIRST FEATURE 3: Middle-Finger Pinch Teleport Arc & Reticle
    // ------------------------------------------------------------------
    const teleportHand =
      bowHandTracking && bowHandSample.middlePinching
        ? bowHandSample
        : drawHandTracking && drawHandSample.middlePinching && !drawPinchBtn
        ? drawHandSample
        : null;
    const teleportPinchHeld = Boolean(teleportHand && teleportBounds);
    let teleportJustCommitted = false;

    if (teleportPinchHeld && teleportHand && teleportBounds) {
      _telePos.copy(teleportHand.palmWorldPos);
      _teleVel.copy(teleportHand.aimDirWorld).multiplyScalar(8.8);
      _teleVel.y = Math.max(-1.5, _teleVel.y + 1.8);

      const posAttr = teleArcGeo.getAttribute('position') as THREE.BufferAttribute;
      let landed = false;
      const stepDt = 0.055;
      for (let i = 0; i < TELEPORT_ARC_STEPS; i++) {
        posAttr.setXYZ(i, _telePos.x, _telePos.y, _telePos.z);
        if (!landed) {
          const clampedX = THREE.MathUtils.clamp(_telePos.x, teleportBounds.minX, teleportBounds.maxX);
          const clampedZ = THREE.MathUtils.clamp(_telePos.z, teleportBounds.minZ, teleportBounds.maxZ);
          const groundY = teleportBounds.getGroundY(clampedX, clampedZ);
          if (_telePos.y <= groundY + 0.03 && i > 1) {
            landed = true;
            _teleWorldTarget.set(clampedX, groundY + 0.03, clampedZ);
            for (let j = i; j < TELEPORT_ARC_STEPS; j++) {
              posAttr.setXYZ(j, _teleWorldTarget.x, _teleWorldTarget.y, _teleWorldTarget.z);
            }
            break;
          }
          _teleVel.y -= 9.81 * stepDt;
          _telePos.addScaledVector(_teleVel, stepDt);
        }
      }
      if (!landed) {
        const clampedX = THREE.MathUtils.clamp(_telePos.x, teleportBounds.minX, teleportBounds.maxX);
        const clampedZ = THREE.MathUtils.clamp(_telePos.z, teleportBounds.minZ, teleportBounds.maxZ);
        _teleWorldTarget.set(clampedX, teleportBounds.getGroundY(clampedX, clampedZ) + 0.03, clampedZ);
      }
      posAttr.needsUpdate = true;

      _teleportCandidate.copy(_teleWorldTarget);
      hasValidTeleportCandidate = true;
      teleArcLine.visible = true;
      teleReticleMesh.visible = true;
      teleReticleMesh.position.copy(_teleWorldTarget);
    } else {
      teleArcLine.visible = false;
      teleReticleMesh.visible = false;
      if (prevTeleportPinch && hasValidTeleportCandidate) {
        teleportJustCommitted = true;
      }
      if (!prevTeleportPinch) {
        hasValidTeleportCandidate = false;
      }
    }
    prevTeleportPinch = teleportPinchHeld;

    // ------------------------------------------------------------------
    // HANDS-FIRST FEATURE 4: Palm-Up Diegetic Wrist Menu (Direct Poke)
    // ------------------------------------------------------------------
    let wristMenuPauseJustPressed = false;
    wristMenuHoverIdx = -1;
    const canShowWristMenu =
      bowHandTracking &&
      bowHandSample.palmNormalWorld.y > 0.62 &&
      !drawPinchBtn &&
      !teleportPinchHeld;
    wristMenuVisible = canShowWristMenu;

    if (canShowWristMenu) {
      camera.getWorldPosition(_camPos);
      wristMenuMesh.visible = true;
      wristMenuMesh.position.copy(bowHandSample.palmWorldPos).addScaledVector(_upY, 0.12);
      wristMenuMesh.lookAt(_camPos);

      // Check opposite hand index fingertip poke distance against the 3 menu buttons
      if (drawHandTracking) {
        _wristInvQuat.copy(wristMenuMesh.quaternion).invert();
        _wristLocalIdxTip
          .copy(drawHandSample.indexTipWorld)
          .sub(wristMenuMesh.position)
          .applyQuaternion(_wristInvQuat);

        // Plane size is 0.24m x 0.09m -> x in [-0.12, 0.12], y in [-0.045, 0.045], z < 0.055
        if (
          Math.abs(_wristLocalIdxTip.z) < 0.055 &&
          Math.abs(_wristLocalIdxTip.y) < 0.055 &&
          Math.abs(_wristLocalIdxTip.x) < 0.125
        ) {
          const btnIdx = _wristLocalIdxTip.x < -0.04 ? 0 : _wristLocalIdxTip.x > 0.04 ? 2 : 1;
          wristMenuHoverIdx = btnIdx;

          if (Math.abs(_wristLocalIdxTip.z) < 0.028 && nowSec > wristMenuCooldownUntil) {
            wristMenuCooldownUntil = nowSec + 0.5;
            if (btnIdx === 0) cycleArrowJustPressed = true;
            else if (btnIdx === 1) crouchToggleJustPressed = true;
            else if (btnIdx === 2) wristMenuPauseJustPressed = true;
          }
        }
      }
    } else {
      wristMenuMesh.visible = false;
    }

    const bowTracked = bowHandTracking || Boolean(bowPad) || connectedSlots.has(bowSlot);
    const drawTracked = drawHandTracking || Boolean(drawPad) || connectedSlots.has(drawSlot);
    const bothTracked = bowTracked && drawTracked;
    const handSeparationMeters = bothTracked ? _bowPos.distanceTo(_drawPos) : 0;

    return {
      presenting: true,
      handTrackingActive,
      bowHandTracking,
      drawHandTracking,
      moveRight,
      moveForward,
      turnX,
      snapTurnDegrees,
      sprint,
      crouchToggleJustPressed,
      cycleArrowJustPressed,
      wristMenuPauseJustPressed,
      triggerHeld: drawPinchBtn,
      triggerJustPressed,
      triggerJustReleased,
      anyTriggerJustPressed,
      teleportJustCommitted,
      teleportTarget: teleportJustCommitted ? _teleportCandidate : null,
      hasTwoHandedDraw: bothTracked && handSeparationMeters > 0.14 && handSeparationMeters < 1.35,
      handSeparationMeters,
      bowWorldPos: _bowPos,
      bowWorldQuat: _bowQuat,
      drawWorldPos: _drawPos,
    };
  };

  const pulseHaptic = (
    hand: 'bow' | 'draw' | 'both',
    intensity: number,
    durationMs: number
  ) => {
    if (!renderer.xr.isPresenting) return;
    const tryPulse = (src: XRInputSourceWithHand | null) => {
      // Skip safely when bare hand tracking is active (no haptic actuators)
      if (!src || (src.hand && !src.gamepad)) return;
      const actuator = src?.gamepad?.hapticActuators?.[0] as
        | { pulse?: (value: number, duration: number) => Promise<boolean> }
        | undefined;
      if (actuator && typeof actuator.pulse === 'function') {
        actuator.pulse(THREE.MathUtils.clamp(intensity, 0, 1), durationMs).catch(() => {});
      }
    };
    if (hand === 'both' || hand === 'bow') tryPulse(inputSourcesByHand.left);
    if (hand === 'both' || hand === 'draw') tryPulse(inputSourcesByHand.right);
  };

  const updateVrVisuals = (
    snapshot: VRHudSnapshot,
    bowAnchorPos: THREE.Vector3,
    isDrawing: boolean,
    elapsed: number
  ) => {
    const presenting = renderer.xr.isPresenting;
    vrSlateMesh.visible = presenting;

    if (!presenting) {
      grip0.visible = false;
      grip1.visible = false;
      handVisualLeft.group.visible = false;
      handVisualRight.group.visible = false;
      drawOrb.visible = false;
      aimRay.visible = false;
      teleArcLine.visible = false;
      teleReticleMesh.visible = false;
      wristMenuMesh.visible = false;
      vrBannerMesh.visible = false;
      return;
    }

    // Update draw hand orb + subtle bow sight ray
    drawOrb.visible = isDrawing;
    if (isDrawing) {
      drawOrb.position.copy(_drawPos);
      orbMat.color.set(snapshot.arrowHex);
      const s = 0.8 + (snapshot.drawPercent / 100) * 0.7;
      drawOrb.scale.setScalar(s);
    }

    aimRay.visible = snapshot.gameState === 'playing' && !isDrawing;
    if (aimRay.visible) {
      aimRay.position.copy(bowAnchorPos);
      aimRay.quaternion.copy(bowMountGroup.quaternion);
      rayMat.color.set(snapshot.arrowHex);
    }

    // Update Palm-Up Wrist Menu canvas when visible & state changes
    if (wristMenuVisible) {
      const menuKey = `${snapshot.arrowName}|${snapshot.isCrouched}|${wristMenuHoverIdx}`;
      if (menuKey !== lastWristMenuStateKey) {
        lastWristMenuStateKey = menuKey;
        redrawWristMenu(snapshot.arrowName, snapshot.arrowHex, snapshot.isCrouched, wristMenuHoverIdx);
      }
    }

    // Throttled 3D Wrist Slate canvas update (~8 Hz)
    if (elapsed - lastHudRedraw > 0.12) {
      lastHudRedraw = elapsed;
      const w = slateCanvas.width;
      const h = slateCanvas.height;
      slateCtx.clearRect(0, 0, w, h);

      slateCtx.fillStyle = 'rgba(8, 13, 24, 0.9)';
      slateCtx.strokeStyle = snapshot.arrowHex;
      slateCtx.lineWidth = 4;
      slateCtx.beginPath();
      slateCtx.roundRect(4, 4, w - 8, h - 8, 18);
      slateCtx.fill();
      slateCtx.stroke();

      slateCtx.fillStyle = '#F8FAFC';
      slateCtx.font = 'bold 24px monospace';
      slateCtx.fillText(`LVL ${snapshot.level}/50 · ${snapshot.seasonName}`, 20, 36);

      // Hands-First vs Controllers Badge
      slateCtx.fillStyle = lastHandInputMode ? '#10B981' : '#38BDF8';
      slateCtx.font = 'bold 17px monospace';
      slateCtx.textAlign = 'right';
      slateCtx.fillText(lastHandInputMode ? '[HANDS-FIRST]' : '[CONTROLLERS]', w - 20, 36);
      slateCtx.textAlign = 'left';

      // HP Bar
      const hpRatio = THREE.MathUtils.clamp(snapshot.hp / Math.max(1, snapshot.maxHp), 0, 1);
      slateCtx.fillStyle = '#1E293B';
      slateCtx.fillRect(20, 52, 240, 18);
      slateCtx.fillStyle = hpRatio > 0.5 ? '#22C55E' : hpRatio > 0.28 ? '#F59E0B' : '#EF4444';
      slateCtx.fillRect(20, 52, Math.round(240 * hpRatio), 18);

      slateCtx.fillStyle = '#E2E8F0';
      slateCtx.font = 'bold 21px monospace';
      slateCtx.fillText(`HP ${snapshot.hp}/${snapshot.maxHp}`, 274, 68);
      slateCtx.fillStyle = '#FBBF24';
      slateCtx.fillText(`FOES ${snapshot.enemiesRemaining}/${snapshot.totalEnemies}`, 20, 104);

      slateCtx.fillStyle = snapshot.arrowHex;
      slateCtx.fillText(`${snapshot.arrowName.toUpperCase()} (${snapshot.drawPercent}%)`, 204, 104);

      slateCtx.fillStyle = snapshot.enemiesRemaining === 0 ? '#34D399' : '#38BDF8';
      slateCtx.font = '19px monospace';
      const finishLabel =
        snapshot.enemiesRemaining === 0
          ? snapshot.crossedFinishLine
            ? 'ENDING LINE REACHED!'
            : `TELEPORT/WALK TO FINISH: ${snapshot.distanceToFinishMeters.toFixed(1)}m`
          : `END GATE: ${snapshot.distanceToFinishMeters.toFixed(1)}m · ${
              snapshot.stealthHidden ? 'HIDDEN' : snapshot.isCrouched ? 'CROUCH' : 'STAND'
            }`;
      slateCtx.fillText(finishLabel, 20, 140);

      slateCtx.fillStyle = '#94A3B8';
      slateCtx.font = '15px monospace';
      slateCtx.fillText(
        lastHandInputMode
          ? 'PINCH:DRAW · MID-PINCH:TELEPORT · RING:TURN · PALM-UP:MENU'
          : 'STICK:MOVE/TURN · TRIGGER:DRAW · A/X:ARROW · B:CROUCH',
        20,
        172
      );
      slateTex.needsUpdate = true;
    }

    // World Outcome Banner inside VR when Level Complete / Failed / Paused
    const showBanner =
      snapshot.gameState === 'level_complete' ||
      snapshot.gameState === 'level_failed' ||
      snapshot.gameState === 'paused';
    vrBannerMesh.visible = showBanner;
    if (showBanner) {
      camera.getWorldPosition(_camPos);
      camera.getWorldQuaternion(_camQuat);
      _fwd.set(0, 0, -1).applyQuaternion(_camQuat);
      _fwd.y = 0;
      if (_fwd.lengthSq() < 0.001) _fwd.set(0, 0, -1);
      _fwd.normalize();

      vrBannerMesh.position.set(
        _camPos.x + _fwd.x * 2.2,
        _camPos.y + 0.05,
        _camPos.z + _fwd.z * 2.2
      );
      vrBannerMesh.lookAt(_camPos.x, _camPos.y + 0.05, _camPos.z);

      const bannerKey = `${snapshot.gameState}|${snapshot.level}|${snapshot.earnedStars}|${snapshot.coins}|${lastHandInputMode}`;
      if (bannerKey !== lastBannerKey) {
        lastBannerKey = bannerKey;
        const bw = bannerCanvas.width;
        const bh = bannerCanvas.height;
        bannerCtx.clearRect(0, 0, bw, bh);

        const isWin = snapshot.gameState === 'level_complete';
        const isFail = snapshot.gameState === 'level_failed';

        bannerCtx.fillStyle = 'rgba(7, 11, 18, 0.94)';
        bannerCtx.strokeStyle = isWin ? '#10B981' : isFail ? '#F43F5E' : '#38BDF8';
        bannerCtx.lineWidth = 6;
        bannerCtx.beginPath();
        bannerCtx.roundRect(6, 6, bw - 12, bh - 12, 24);
        bannerCtx.fill();
        bannerCtx.stroke();

        bannerCtx.textAlign = 'center';
        bannerCtx.fillStyle = isWin ? '#34D399' : isFail ? '#FB7185' : '#38BDF8';
        bannerCtx.font = 'bold 42px sans-serif';
        bannerCtx.fillText(
          isWin
            ? `LEVEL ${snapshot.level} CLEARED!`
            : isFail
            ? `SHIELDWALL BREACHED`
            : 'PAUSED IN VR',
          bw / 2,
          72
        );

        bannerCtx.fillStyle = '#F8FAFC';
        bannerCtx.font = 'bold 28px monospace';
        bannerCtx.fillText(
          isWin
            ? `${'★'.repeat(snapshot.earnedStars)}${'☆'.repeat(3 - snapshot.earnedStars)}  ·  Coins: ${snapshot.coins}`
            : isFail
            ? `Level ${snapshot.level} · HP Depleted`
            : `Level ${snapshot.level} · ${snapshot.seasonName}`,
          bw / 2,
          132
        );

        bannerCtx.fillStyle = '#BAE6FD';
        bannerCtx.font = 'bold 23px monospace';
        const promptVerb = lastHandInputMode ? 'PINCH' : 'PINCH OR PULL TRIGGER';
        bannerCtx.fillText(
          isWin
            ? `${promptVerb} TO START NEXT LEVEL`
            : isFail
            ? `${promptVerb} TO RETRY LEVEL`
            : `${promptVerb} TO RESUME`,
          bw / 2,
          202
        );
        bannerCtx.textAlign = 'left';
        bannerTex.needsUpdate = true;
      }
    }
  };

  const dispose = () => {
    controller0.removeEventListener('connected', onConn0 as never);
    controller0.removeEventListener('disconnected', onDisconn0);
    controller1.removeEventListener('connected', onConn1 as never);
    controller1.removeEventListener('disconnected', onDisconn1);
    controller0.removeEventListener('selectstart', onSelectStart0);
    controller0.removeEventListener('selectend', onSelectEnd0);
    controller1.removeEventListener('selectstart', onSelectStart1);
    controller1.removeEventListener('selectend', onSelectEnd1);
    if (activeSession) {
      activeSession.removeEventListener('end', onSessionEnded);
      activeSession.end().catch(() => {});
      activeSession = null;
    }
    handVisualLeft.dispose();
    handVisualRight.dispose();
    slateTex.dispose();
    slateMat.dispose();
    wristMenuTex.dispose();
    wristMenuMat.dispose();
    bannerTex.dispose();
    bannerMat.dispose();
    orbGeo.dispose();
    orbMat.dispose();
    rayGeo.dispose();
    rayMat.dispose();
    teleArcGeo.dispose();
    teleArcMat.dispose();
    teleRingGeo.dispose();
    teleRingMat.dispose();
  };

  return {
    playerRig,
    bowMountGroup,
    vrSlateMesh,
    vrBannerMesh,
    isPresenting: () => renderer.xr.isPresenting,
    enterVR,
    exitVR,
    pollVRInput,
    pulseHaptic,
    updateVrVisuals,
    dispose,
  };
}
