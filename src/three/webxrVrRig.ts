import * as THREE from 'three';

export interface WebXRSupportInfo {
  supported: boolean;
  reason?: string;
}

export interface VRInputFrame {
  presenting: boolean;
  moveRight: number;
  moveForward: number;
  turnX: number;
  sprint: boolean;
  crouchToggleJustPressed: boolean;
  cycleArrowJustPressed: boolean;
  triggerHeld: boolean;
  triggerJustPressed: boolean;
  triggerJustReleased: boolean;
  anyTriggerJustPressed: boolean;
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

  // Forearm leather bracer
  const bracerGeo = new THREE.CylinderGeometry(0.036, 0.044, 0.14, 14);
  bracerGeo.rotateX(Math.PI / 2);
  const bracer = new THREE.Mesh(bracerGeo, leatherMat);
  bracer.position.set(0, -0.01, 0.055);
  group.add(bracer);

  // Brass wrist cuff
  const cuffGeo = new THREE.TorusGeometry(0.041, 0.006, 8, 18);
  const cuff = new THREE.Mesh(cuffGeo, metalMat);
  cuff.position.set(0, -0.01, 0.01);
  group.add(cuff);

  // Knuckle guard
  const guardGeo = new THREE.BoxGeometry(0.068, 0.028, 0.055);
  const guard = new THREE.Mesh(guardGeo, leatherMat);
  guard.position.set(0, 0.002, -0.02);
  group.add(guard);

  // Small directional rune crest
  const runeGeo = new THREE.OctahedronGeometry(0.011, 0);
  const rune = new THREE.Mesh(runeGeo, gemMat);
  rune.position.set(0, 0.02, -0.015);
  group.add(rune);

  return group;
}

export interface WebXRRigHandle {
  playerRig: THREE.Group;
  bowMountGroup: THREE.Group;
  vrSlateMesh: THREE.Mesh;
  vrBannerMesh: THREE.Mesh;
  isPresenting: () => boolean;
  enterVR: () => Promise<void>;
  exitVR: () => Promise<void>;
  pollVRInput: (dominantEye: 'left' | 'right') => VRInputFrame;
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

  // Draw hand string-pinch orb (visual aid while grabbing/pulling string in VR)
  const orbGeo = new THREE.SphereGeometry(0.024, 14, 12);
  const orbMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.72,
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

  // Bow world-space mount group updated cleanly in VR so two-handed aiming works smoothly
  const bowMountGroup = new THREE.Group();
  bowMountGroup.name = 'VRBowMount';
  scene.add(bowMountGroup);

  // 1. Diegetic 3D VR Slate (attached to Bow Riser side inside VR)
  const slateCanvas = document.createElement('canvas');
  slateCanvas.width = 512;
  slateCanvas.height = 176;
  const slateCtx = slateCanvas.getContext('2d')!;
  const slateTex = new THREE.CanvasTexture(slateCanvas);
  slateTex.colorSpace = THREE.SRGBColorSpace;
  const slateMat = new THREE.MeshBasicMaterial({
    map: slateTex,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
  });
  const vrSlateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.082), slateMat);
  vrSlateMesh.position.set(-0.14, 0.14, -0.02);
  vrSlateMesh.rotation.y = 0.28;
  vrSlateMesh.visible = false;
  bowMountGroup.add(vrSlateMesh);

  // 2. Diegetic 3D VR World Outcome Banner (Victory / Defeat / Paused inside VR)
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
  const inputSourcesByHand: { left: XRInputSource | null; right: XRInputSource | null } = {
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
  let lastHudRedraw = 0;
  let lastBannerKey = '';

  const _bowPos = new THREE.Vector3();
  const _bowQuat = new THREE.Quaternion();
  const _drawPos = new THREE.Vector3();
  const _camPos = new THREE.Vector3();
  const _camQuat = new THREE.Quaternion();
  const _fwd = new THREE.Vector3();

  const onSessionEnded = () => {
    activeSession = null;
    grip0.visible = false;
    grip1.visible = false;
    drawOrb.visible = false;
    aimRay.visible = false;
    vrSlateMesh.visible = false;
    vrBannerMesh.visible = false;
    prevTriggerHeld = false;
    prevAnyTriggerHeld = false;
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

  const pollVRInput = (dominantEye: 'left' | 'right'): VRInputFrame => {
    const presenting = renderer.xr.isPresenting;
    if (!presenting) {
      return {
        presenting: false,
        moveRight: 0,
        moveForward: 0,
        turnX: 0,
        sprint: false,
        crouchToggleJustPressed: false,
        cycleArrowJustPressed: false,
        triggerHeld: false,
        triggerJustPressed: false,
        triggerJustReleased: false,
        anyTriggerJustPressed: false,
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

    bowCtrl.getWorldPosition(_bowPos);
    bowCtrl.getWorldQuaternion(_bowQuat);
    drawCtrl.getWorldPosition(_drawPos);

    // Refresh live input sources by handedness
    inputSourcesByHand.left = null;
    inputSourcesByHand.right = null;
    const session = renderer.xr.getSession();
    if (session) {
      for (const src of session.inputSources) {
        if (src.handedness === 'left') inputSourcesByHand.left = src;
        else if (src.handedness === 'right') inputSourcesByHand.right = src;
      }
    }

    const leftPad = inputSourcesByHand.left?.gamepad;
    const rightPad = inputSourcesByHand.right?.gamepad;
    const bowPad = bowHand === 'left' ? leftPad : rightPad;
    const drawPad = drawHand === 'left' ? leftPad : rightPad;

    // Standard WebXR xr-standard thumbstick axes are [2], [3] (fallback [0], [1])
    const readStick = (pad?: Gamepad): [number, number] => {
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

    // Left stick always moves player (natural FPS/VR convention); Right stick turns player
    const moveRight = lx;
    const moveForward = -ly;
    const turnX = rx;

    const sprint = Boolean(
      leftPad?.buttons?.[3]?.pressed || leftPad?.buttons?.[1]?.pressed
    );

    // Crouch toggle via Right controller B/Y (button 5), stick click (button 3), or sharp stick down
    const crouchBtn = Boolean(
      rightPad?.buttons?.[5]?.pressed ||
        rightPad?.buttons?.[3]?.pressed ||
        ry > 0.78
    );
    const crouchToggleJustPressed = crouchBtn && !prevCrouchBtn;
    prevCrouchBtn = crouchBtn;

    // Arrow cycle via Bow controller A/X (button 4) or Draw controller A/X (button 4)
    const arrowBtn = Boolean(
      bowPad?.buttons?.[4]?.pressed ||
        bowPad?.buttons?.[5]?.pressed ||
        drawPad?.buttons?.[4]?.pressed
    );
    const cycleArrowJustPressed = arrowBtn && !prevArrowBtn;
    prevArrowBtn = arrowBtn;

    // Trigger detection (either WebXR select event OR gamepad button 0 on draw hand)
    const drawTriggerBtn = Boolean(drawPad?.buttons?.[0]?.pressed || selectActiveSlot[drawSlot]);
    const bowTriggerBtn = Boolean(bowPad?.buttons?.[0]?.pressed || selectActiveSlot[bowSlot]);
    const anyTrigger = drawTriggerBtn || bowTriggerBtn;

    const triggerJustPressed = drawTriggerBtn && !prevTriggerHeld;
    const triggerJustReleased = !drawTriggerBtn && prevTriggerHeld;
    const anyTriggerJustPressed = anyTrigger && !prevAnyTriggerHeld;

    prevTriggerHeld = drawTriggerBtn;
    prevAnyTriggerHeld = anyTrigger;

    const bothTracked = connectedSlots.size >= 2 || (Boolean(leftPad) && Boolean(rightPad));
    const handSeparationMeters = bothTracked ? _bowPos.distanceTo(_drawPos) : 0;

    return {
      presenting: true,
      moveRight,
      moveForward,
      turnX,
      sprint,
      crouchToggleJustPressed,
      cycleArrowJustPressed,
      triggerHeld: drawTriggerBtn,
      triggerJustPressed,
      triggerJustReleased,
      anyTriggerJustPressed,
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
    const tryPulse = (src: XRInputSource | null) => {
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
    grip0.visible = presenting;
    grip1.visible = presenting;
    vrSlateMesh.visible = presenting;

    if (!presenting) {
      drawOrb.visible = false;
      aimRay.visible = false;
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
      slateCtx.font = 'bold 26px monospace';
      slateCtx.fillText(`LVL ${snapshot.level}/50 · ${snapshot.seasonName}`, 22, 38);

      // HP Bar
      const hpRatio = THREE.MathUtils.clamp(snapshot.hp / Math.max(1, snapshot.maxHp), 0, 1);
      slateCtx.fillStyle = '#1E293B';
      slateCtx.fillRect(22, 54, 240, 18);
      slateCtx.fillStyle = hpRatio > 0.5 ? '#22C55E' : hpRatio > 0.28 ? '#F59E0B' : '#EF4444';
      slateCtx.fillRect(22, 54, Math.round(240 * hpRatio), 18);

      slateCtx.fillStyle = '#E2E8F0';
      slateCtx.font = 'bold 22px monospace';
      slateCtx.fillText(`HP ${snapshot.hp}/${snapshot.maxHp}`, 276, 70);
      slateCtx.fillStyle = '#FBBF24';
      slateCtx.fillText(`FOES ${snapshot.enemiesRemaining}/${snapshot.totalEnemies}`, 22, 108);

      slateCtx.fillStyle = snapshot.arrowHex;
      slateCtx.fillText(`${snapshot.arrowName.toUpperCase()} (${snapshot.drawPercent}%)`, 210, 108);

      slateCtx.fillStyle = snapshot.enemiesRemaining === 0 ? '#34D399' : '#38BDF8';
      slateCtx.font = '20px monospace';
      const finishLabel =
        snapshot.enemiesRemaining === 0
          ? snapshot.crossedFinishLine
            ? 'ENDING LINE REACHED!'
            : `RUN TO ENDING LINE: ${snapshot.distanceToFinishMeters.toFixed(1)}m`
          : `END GATE: ${snapshot.distanceToFinishMeters.toFixed(1)}m · ${
              snapshot.stealthHidden ? 'HIDDEN' : snapshot.isCrouched ? 'CROUCH' : 'STAND'
            }`;
      slateCtx.fillText(finishLabel, 22, 148);
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

      const bannerKey = `${snapshot.gameState}|${snapshot.level}|${snapshot.earnedStars}|${snapshot.coins}`;
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
        bannerCtx.font = 'bold 24px monospace';
        bannerCtx.fillText(
          isWin
            ? 'PULL TRIGGER TO START NEXT LEVEL'
            : isFail
            ? 'PULL TRIGGER TO RETRY LEVEL'
            : 'PULL TRIGGER TO RESUME',
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
    slateTex.dispose();
    slateMat.dispose();
    bannerTex.dispose();
    bannerMat.dispose();
    orbGeo.dispose();
    orbMat.dispose();
    rayGeo.dispose();
    rayMat.dispose();
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
