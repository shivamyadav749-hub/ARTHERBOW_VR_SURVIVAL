import * as THREE from 'three';
import {
  ARROW_TYPES,
  ArrowTypeId,
  EnemyArchetype,
  EnemySpawnSpec,
  HitboxZone,
  ImpactMaterial,
} from '../types/archery';
import {
  createAlpineEarthTextures,
  createBarkTextures,
  createCobblePathTextures,
  createMountainRockTextures,
  createParticleSoftSprite,
  createStoneMasonryTextures,
  createWaterNormalTexture,
  createWeatheredTimberTextures,
} from './proceduralTextures';

export const START_LINE_Z = 2.0;
export const FINISH_LINE_Z = -24.0;

// Deterministic terrain height function so every prop sits flush on the ground
export function groundHeightAt(x: number, z: number): number {
  // Keep central archery lane (-10..10 X, -75..8 Z) gently graded
  const laneDist = Math.max(0, Math.abs(x) - 9.5);
  const flankRise = Math.pow(laneDist * 0.085, 1.45);
  const rollingHills =
    Math.sin(x * 0.07) * Math.cos(z * 0.06) * 0.45 +
    Math.sin(z * 0.035) * 0.35;
  const centerBlend = THREE.MathUtils.clamp((Math.abs(x) - 5.0) / 10.0, 0, 1);
  return rollingHills * centerBlend + flankRise;
}

export interface BowModelHandle {
  group: THREE.Group;
  upperLimbPivot: THREE.Group;
  lowerLimbPivot: THREE.Group;
  upperTipLocal: THREE.Vector3;
  lowerTipLocal: THREE.Vector3;
  stringGeometry: THREE.BufferGeometry;
  sightPinMat: THREE.MeshStandardMaterial;
  nockSocketGroup: THREE.Group;
  updateBowDraw: (drawDistance: number, maxDraw: number, arrowColorHex: string) => void;
  updateDiegeticHud: (
    hpRatio: number,
    enemiesRatio: number,
    armorPrimaryHex: string,
    armorTrimHex: string
  ) => void;
}

export function createVRBowModel(): BowModelHandle {
  const group = new THREE.Group();

  // 1. Machined Anodized Riser (Primary Silhouette)
  const riserShape = new THREE.Shape();
  riserShape.moveTo(-0.018, -0.22);
  riserShape.lineTo(0.022, -0.22);
  riserShape.quadraticCurveTo(0.045, -0.1, 0.028, 0.0);
  riserShape.quadraticCurveTo(0.048, 0.12, 0.022, 0.22);
  riserShape.lineTo(-0.018, 0.22);
  riserShape.quadraticCurveTo(0.008, 0.0, -0.018, -0.22);

  const riserGeo = new THREE.ExtrudeGeometry(riserShape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 3,
  });
  riserGeo.center();
  riserGeo.rotateY(Math.PI / 2);

  const riserMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.22,
  });
  const riserMesh = new THREE.Mesh(riserGeo, riserMat);
  riserMesh.castShadow = true;
  group.add(riserMesh);

  // 2. Ergonomic Wrapped Leather Grip (Roughness contrast >= 0.25)
  const gripGeo = new THREE.CylinderGeometry(0.021, 0.024, 0.13, 16);
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    metalness: 0.05,
    roughness: 0.86,
  });
  const gripMesh = new THREE.Mesh(gripGeo, gripMat);
  gripMesh.position.set(0, -0.04, 0.005);
  group.add(gripMesh);

  // 3 & 4. Upper & Lower Carbon Recurve Limbs
  const limbMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.45,
    roughness: 0.38,
  });
  const tipMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.92,
    roughness: 0.18,
  });

  const upperLimbPivot = new THREE.Group();
  upperLimbPivot.position.set(0, 0.21, -0.01);
  const upperLimbGeo = new THREE.BoxGeometry(0.026, 0.34, 0.01);
  upperLimbGeo.translate(0, 0.17, 0.02);
  const upperLimbMesh = new THREE.Mesh(upperLimbGeo, limbMat);
  upperLimbPivot.add(upperLimbMesh);

  // 5. Upper Limb Tip Nock
  const tipGeo = new THREE.CylinderGeometry(0.006, 0.009, 0.045, 12);
  const upperTipMesh = new THREE.Mesh(tipGeo, tipMat);
  upperTipMesh.position.set(0, 0.34, 0.035);
  upperTipMesh.rotation.x = 0.35;
  upperLimbPivot.add(upperTipMesh);
  group.add(upperLimbPivot);

  const lowerLimbPivot = new THREE.Group();
  lowerLimbPivot.position.set(0, -0.21, -0.01);
  const lowerLimbGeo = new THREE.BoxGeometry(0.026, 0.34, 0.01);
  lowerLimbGeo.translate(0, -0.17, 0.02);
  const lowerLimbMesh = new THREE.Mesh(lowerLimbGeo, limbMat);
  lowerLimbPivot.add(lowerLimbMesh);

  // 6. Lower Limb Tip Nock
  const lowerTipMesh = new THREE.Mesh(tipGeo, tipMat);
  lowerTipMesh.position.set(0, -0.34, 0.035);
  lowerTipMesh.rotation.x = -0.35;
  lowerLimbPivot.add(lowerTipMesh);
  group.add(lowerLimbPivot);

  // 7. Holographic Optic Sight Housing + Glowing Pin
  const sightBracketGeo = new THREE.BoxGeometry(0.008, 0.012, 0.09);
  const sightBracket = new THREE.Mesh(sightBracketGeo, tipMat);
  sightBracket.position.set(-0.028, 0.075, -0.04);
  group.add(sightBracket);

  const sightRingGeo = new THREE.TorusGeometry(0.022, 0.003, 12, 24);
  const sightRing = new THREE.Mesh(sightRingGeo, riserMat);
  sightRing.position.set(-0.045, 0.075, -0.08);
  group.add(sightRing);

  const sightPinMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  const sightPin = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 12, 12), sightPinMat);
  sightPin.position.set(-0.045, 0.075, -0.08);
  group.add(sightPin);

  // 8. Carbon Stabilizer Rod + Damper Weight
  const stabRodGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.28, 12);
  stabRodGeo.rotateX(Math.PI / 2);
  const stabRod = new THREE.Mesh(stabRodGeo, limbMat);
  stabRod.position.set(0, -0.12, -0.15);
  group.add(stabRod);

  const damperWeight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.014, 0.045, 16).rotateX(Math.PI / 2),
    tipMat
  );
  damperWeight.position.set(0, -0.12, -0.29);
  group.add(damperWeight);

  // 9. Magnetic Arrow Rest
  const restMesh = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.005, 0.035), tipMat);
  restMesh.position.set(-0.014, 0.022, -0.01);
  group.add(restMesh);

  // 10. Diegetic Riser-Mounted Draw Strength LED Gauge (Green -> Yellow -> Red)
  const gaugeHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.128, 0.014),
    new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.7, roughness: 0.3 })
  );
  gaugeHousing.position.set(-0.024, 0.115, 0.014);
  group.add(gaugeHousing);

  const gaugeHeight = 0.116;
  const gaugeFillGeo = new THREE.BoxGeometry(0.006, gaugeHeight, 0.008);
  gaugeFillGeo.translate(0, gaugeHeight * 0.5, 0);
  const gaugeFillMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x22c55e,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });
  const gaugeFillMesh = new THREE.Mesh(gaugeFillGeo, gaugeFillMat);
  gaugeFillMesh.position.set(-0.027, 0.115 - gaugeHeight * 0.5, 0.017);
  group.add(gaugeFillMesh);

  // 10B. Diegetic Bow-Riser & Wrist Gauntlet VR UI (3D HP Bar + Wave Progress + Equipped Armor Trim)
  const diegeticMount = new THREE.Group();
  diegeticMount.position.set(0.032, -0.055, 0.025);
  diegeticMount.rotation.y = -0.32;
  group.add(diegeticMount);

  const bracerTrimMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    metalness: 0.72,
    roughness: 0.28,
  });
  const bracerAccentMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.25,
    metalness: 0.85,
    roughness: 0.22,
  });

  // Armored gauntlet plate below grip
  const gauntletPlate = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.075, 0.055), bracerTrimMat);
  gauntletPlate.position.set(-0.028, -0.045, 0.03);
  diegeticMount.add(gauntletPlate);

  const gauntletBand = new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.012, 0.058), bracerAccentMat);
  gauntletBand.position.set(-0.028, -0.015, 0.03);
  diegeticMount.add(gauntletBand);

  // Holo-Slate Backing on side of riser
  const holoFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.008, 0.095, 0.026),
    new THREE.MeshStandardMaterial({ color: 0x070b12, metalness: 0.65, roughness: 0.3 })
  );
  holoFrame.position.set(0, 0.025, 0);
  diegeticMount.add(holoFrame);

  // Diegetic 3D Player HP Bar (Vertical Bar 1)
  const barHeight = 0.078;
  const hpFillGeo = new THREE.BoxGeometry(0.005, barHeight, 0.007);
  hpFillGeo.translate(0, barHeight * 0.5, 0);
  const hpFillMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x22c55e,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });
  const hpFillMesh = new THREE.Mesh(hpFillGeo, hpFillMat);
  hpFillMesh.position.set(0.004, 0.025 - barHeight * 0.5, -0.005);
  diegeticMount.add(hpFillMesh);

  // Diegetic 3D Wave Enemies Remaining Bar (Vertical Bar 2)
  const waveFillGeo = new THREE.BoxGeometry(0.005, barHeight, 0.007);
  waveFillGeo.translate(0, barHeight * 0.5, 0);
  const waveFillMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const waveFillMesh = new THREE.Mesh(waveFillGeo, waveFillMat);
  waveFillMesh.position.set(0.004, 0.025 - barHeight * 0.5, 0.006);
  diegeticMount.add(waveFillMesh);

  // Nock Socket Group where the nocked arrow sits
  const nockSocketGroup = new THREE.Group();
  nockSocketGroup.position.set(-0.012, 0.032, 0.12);
  group.add(nockSocketGroup);

  // 11. Dynamic 2-Segment Bowstring
  const stringPositions = new Float32Array(9);
  const stringGeometry = new THREE.BufferGeometry();
  stringGeometry.setAttribute('position', new THREE.BufferAttribute(stringPositions, 3));
  const stringMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0 });
  const bowStringLine = new THREE.Line(stringGeometry, stringMat);
  bowStringLine.frustumCulled = false;
  group.add(bowStringLine);

  const upperTipLocal = new THREE.Vector3(0, 0.55, 0.12);
  const lowerTipLocal = new THREE.Vector3(0, -0.55, 0.12);
  const _color = new THREE.Color();
  const _gaugeColor = new THREE.Color();
  const _hpColor = new THREE.Color();

  const updateBowDraw = (drawDistance: number, maxDraw: number, arrowColorHex: string) => {
    const ratio = THREE.MathUtils.clamp(drawDistance / maxDraw, 0, 1);

    // Flex upper and lower limbs backward as string is drawn
    const flexAngle = ratio * 0.34;
    upperLimbPivot.rotation.x = -flexAngle;
    lowerLimbPivot.rotation.x = flexAngle;

    // Compute animated tip coordinates in bow space
    const tipZ = 0.035 + Math.sin(flexAngle) * 0.32;
    const tipY = 0.21 + Math.cos(flexAngle) * 0.34;

    const posAttr = stringGeometry.getAttribute('position') as THREE.BufferAttribute;
    // Upper tip
    posAttr.setXYZ(0, 0, tipY, tipZ);
    // Nock pull vertex
    const nockZ = 0.12 + drawDistance;
    posAttr.setXYZ(1, -0.012, 0.032, nockZ);
    // Lower tip
    posAttr.setXYZ(2, 0, -tipY, tipZ);
    posAttr.needsUpdate = true;

    // Position the nocked arrow along the pull axis
    nockSocketGroup.position.set(-0.012, 0.032, nockZ);

    // Update 3D Draw Strength LED Gauge (Green 142deg -> Amber 48deg -> Red 0deg)
    const hueDeg = ratio < 0.55
      ? THREE.MathUtils.lerp(142, 48, ratio / 0.55)
      : THREE.MathUtils.lerp(48, 0, (ratio - 0.55) / 0.45);
    _gaugeColor.setHSL(hueDeg / 360, 0.88, 0.52);
    gaugeFillMat.color.copy(_gaugeColor);
    gaugeFillMat.emissive.copy(_gaugeColor);
    gaugeFillMat.emissiveIntensity = 0.7 + ratio * 2.1;
    gaugeFillMesh.scale.y = Math.max(0.03, ratio);

    // Sync optic sight pin color with active arrow type
    _color.set(arrowColorHex);
    sightPinMat.color.copy(_color);
    sightPinMat.emissive.copy(_color);
  };

  const updateDiegeticHud = (
    hpRatio: number,
    enemiesRatio: number,
    armorPrimaryHex: string,
    armorTrimHex: string
  ) => {
    const clampedHp = THREE.MathUtils.clamp(hpRatio, 0, 1);
    const clampedEnemies = THREE.MathUtils.clamp(enemiesRatio, 0, 1);

    hpFillMesh.scale.y = Math.max(0.02, clampedHp);
    const hpHue = THREE.MathUtils.lerp(0, 138, clampedHp);
    _hpColor.setHSL(hpHue / 360, 0.85, 0.5);
    hpFillMat.color.copy(_hpColor);
    hpFillMat.emissive.copy(_hpColor);

    waveFillMesh.scale.y = Math.max(0.02, clampedEnemies);

    bracerTrimMat.color.set(armorPrimaryHex);
    bracerAccentMat.color.set(armorTrimHex);
    bracerAccentMat.emissive.set(armorTrimHex);
  };

  updateBowDraw(0, 0.65, '#38BDF8');
  updateDiegeticHud(1, 1, '#78350F', '#94A3B8');

  return {
    group,
    upperLimbPivot,
    lowerLimbPivot,
    upperTipLocal,
    lowerTipLocal,
    stringGeometry,
    sightPinMat,
    nockSocketGroup,
    updateBowDraw,
    updateDiegeticHud,
  };
}

// Shared geometries for arrows to avoid GC churn
const _shaftGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.74, 10);
_shaftGeo.rotateX(Math.PI / 2);
_shaftGeo.translate(0, 0, -0.37); // z=0 is nock, z=-0.74 is front of shaft

const _collarGeo = new THREE.CylinderGeometry(0.006, 0.005, 0.03, 12);
_collarGeo.rotateX(Math.PI / 2);
_collarGeo.translate(0, 0, -0.73);

const _nockGeo = new THREE.CylinderGeometry(0.0055, 0.004, 0.024, 10);
_nockGeo.rotateX(Math.PI / 2);
_nockGeo.translate(0, 0, -0.01);

const _vaneGeo = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.085, 0.016);
  shape.lineTo(0.11, 0.004);
  shape.lineTo(0.11, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.0015, bevelEnabled: false });
  geo.rotateY(Math.PI / 2);
  return geo;
})();

export const ARROW_TIP_OFFSET = 0.79; // Distance from arrow origin (nock) to tip along -Z

export function createArrowModel(arrowType: ArrowTypeId): THREE.Group {
  const cfg = ARROW_TYPES[arrowType];
  const arrowGroup = new THREE.Group();

  // 1. Carbon Shaft
  const shaftMat = new THREE.MeshStandardMaterial({
    color: cfg.shaftHex,
    metalness: 0.4,
    roughness: 0.35,
  });
  const shaftMesh = new THREE.Mesh(_shaftGeo, shaftMat);
  shaftMesh.castShadow = true;
  arrowGroup.add(shaftMesh);

  // 2. Metallic Collar Ferrule
  const collarMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.9,
    roughness: 0.2,
  });
  const collarMesh = new THREE.Mesh(_collarGeo, collarMat);
  arrowGroup.add(collarMesh);

  // 3. Polymorphic Arrowhead Tip (Distinct silhouette per ArrowType)
  const tipMat = new THREE.MeshStandardMaterial({
    color: cfg.primaryHex,
    emissive: cfg.emissiveHex,
    emissiveIntensity: arrowType === 'standard' ? 0.35 : 1.15,
    metalness: arrowType === 'ice' ? 0.2 : 0.8,
    roughness: arrowType === 'ice' ? 0.12 : 0.25,
  });

  const tipGroup = new THREE.Group();
  tipGroup.position.set(0, 0, -0.755);

  if (arrowType === 'standard') {
    // Razor 3-blade broadhead
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.009, 0.055, 6).rotateX(-Math.PI / 2),
      tipMat
    );
    tipGroup.add(cone);
  } else if (arrowType === 'explosive') {
    // Heavy ribbed Thermite warhead canister + glowing core ring
    const canister = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.011, 0.048, 12).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.85, roughness: 0.3 })
    );
    const warheadCap = new THREE.Mesh(
      new THREE.ConeGeometry(0.013, 0.028, 12).rotateX(-Math.PI / 2),
      tipMat
    );
    warheadCap.position.z = -0.035;
    const coreRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.0135, 0.003, 8, 16),
      tipMat
    );
    tipGroup.add(canister, warheadCap, coreRing);
  } else if (arrowType === 'ice') {
    // Faceted octahedral cryo crystal shard
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.018, 0).scale(0.85, 0.85, 2.1),
      tipMat
    );
    shard.position.z = -0.015;
    tipGroup.add(shard);
  } else if (arrowType === 'shock') {
    // Plasma needle with dual inductive torus coils
    const needle = new THREE.Mesh(
      new THREE.ConeGeometry(0.007, 0.065, 8).rotateX(-Math.PI / 2),
      tipMat
    );
    needle.position.z = -0.01;
    const coil1 = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0022, 8, 16), tipMat);
    coil1.position.z = 0.008;
    const coil2 = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.002, 8, 16), tipMat);
    coil2.position.z = -0.012;
    tipGroup.add(needle, coil1, coil2);
  } else if (arrowType === 'split') {
    // Twin-pronged harmonic splitter head
    const centerPoint = new THREE.Mesh(
      new THREE.ConeGeometry(0.008, 0.05, 8).rotateX(-Math.PI / 2),
      tipMat
    );
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.003, 0.03), tipMat);
    leftWing.position.z = -0.005;
    tipGroup.add(centerPoint, leftWing);
  }

  arrowGroup.add(tipGroup);

  // 4. Illuminated Nock Clip
  const nockMesh = new THREE.Mesh(_nockGeo, tipMat);
  arrowGroup.add(nockMesh);

  // 5, 6, 7. Three Parabolic Fletching Vanes spaced at 120 deg
  const vaneMat = new THREE.MeshStandardMaterial({
    color: cfg.fletchingHex,
    roughness: 0.6,
    metalness: 0.1,
  });

  for (let i = 0; i < 3; i++) {
    const vanePivot = new THREE.Group();
    vanePivot.position.set(0, 0, -0.03);
    vanePivot.rotation.z = (i * Math.PI * 2) / 3;

    const vaneMesh = new THREE.Mesh(_vaneGeo, vaneMat);
    vaneMesh.position.set(0, 0.004, 0);
    vanePivot.add(vaneMesh);
    arrowGroup.add(vanePivot);
  }

  return arrowGroup;
}

export interface ArcheryTargetEntity {
  id: number;
  label: string;
  materialType: ImpactMaterial;
  distanceMeters: number;
  rootGroup: THREE.Group;
  discGroup: THREE.Group;
  hitColliderMesh: THREE.Mesh;
  frostCageGroup: THREE.Group;
  basePosition: THREE.Vector3;
  patrolAmplitude: number;
  patrolSpeed: number;
  patrolPhase: number;
  freezeTimer: number;
  timeScale: number;
  wobbleAngleX: number;
  wobbleVelocityX: number;
  radius: number;
}

export function createArcheryTargetStand(
  id: number,
  label: string,
  x: number,
  z: number,
  radius: number = 1.15,
  patrolAmplitude: number = 0,
  patrolSpeed: number = 0,
  materialType: ImpactMaterial = 'wood'
): ArcheryTargetEntity {
  const groundY = groundHeightAt(x, z);
  const rootGroup = new THREE.Group();
  rootGroup.position.set(x, groundY, z);

  const standMat =
    materialType === 'metal'
      ? new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.24, metalness: 0.88 })
      : materialType === 'stone'
      ? new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9, metalness: 0.08 })
      : new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.88, metalness: 0.04 });

  const bossMat =
    materialType === 'metal'
      ? new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.28, metalness: 0.86 })
      : materialType === 'stone'
      ? new THREE.MeshStandardMaterial({ color: 0x3f4a5a, roughness: 0.92, metalness: 0.06 })
      : new THREE.MeshStandardMaterial({ color: 0xb48a4e, roughness: 0.94, metalness: 0.02 });

  // 1-3. Timber / Stone / Steel Tripod Legs (Grounded at bottom-center)
  const legHeight = 2.6;
  const legGeo = new THREE.CylinderGeometry(
    materialType === 'stone' ? 0.075 : 0.045,
    materialType === 'stone' ? 0.095 : 0.055,
    legHeight,
    materialType === 'stone' ? 6 : 10
  );

  const leftLeg = new THREE.Mesh(legGeo, standMat);
  leftLeg.position.set(-0.55, legHeight * 0.48, 0.1);
  leftLeg.rotation.z = -0.14;
  leftLeg.rotation.x = 0.08;
  leftLeg.castShadow = true;
  rootGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, standMat);
  rightLeg.position.set(0.55, legHeight * 0.48, 0.1);
  rightLeg.rotation.z = 0.14;
  rightLeg.rotation.x = 0.08;
  rightLeg.castShadow = true;
  rootGroup.add(rightLeg);

  const backLeg = new THREE.Mesh(legGeo, standMat);
  backLeg.position.set(0, legHeight * 0.46, -0.65);
  backLeg.rotation.x = -0.34;
  backLeg.castShadow = true;
  rootGroup.add(backLeg);

  // 4. Horizontal Support Beam
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.09, 0.12), standMat);
  crossbar.position.set(0, 1.05, 0.14);
  rootGroup.add(crossbar);

  // Soft Contact Shadow Grounding Plane beneath tripod
  const shadowPlane = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
  );
  shadowPlane.position.y = 0.02;
  rootGroup.add(shadowPlane);

  // Disc Group (pivots when hit by arrows for spring wobble)
  const discGroup = new THREE.Group();
  discGroup.position.set(0, 1.65, 0.18);
  rootGroup.add(discGroup);

  // 5. Woven Straw / Granite Slab / Steel Plate Boss Cylinder
  const bossDepth = 0.18;
  const bossGeo = new THREE.CylinderGeometry(radius * 1.06, radius * 1.06, bossDepth, 32);
  bossGeo.rotateX(Math.PI / 2);
  const bossMesh = new THREE.Mesh(bossGeo, bossMat);
  bossMesh.castShadow = true;
  bossMesh.receiveShadow = true;
  discGroup.add(bossMesh);

  if (materialType === 'metal' || materialType === 'stone') {
    const rimMesh = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.04, 0.045, 10, 32),
      standMat
    );
    rimMesh.position.z = 0.09;
    discGroup.add(rimMesh);
  }

  // 6. Five Concentric Scoring Rings (White, Black, Blue, Red, Gold Bullseye)
  const ringSpecs = [
    { frac: 1.0, color: 0xf8fafc, zOffset: 0.092 },
    { frac: 0.8, color: 0x1e293b, zOffset: 0.094 },
    { frac: 0.6, color: 0x0284c7, zOffset: 0.096 },
    { frac: 0.4, color: 0xdc2626, zOffset: 0.098 },
    { frac: 0.2, color: 0xfacc15, zOffset: 0.101 },
  ];

  ringSpecs.forEach((r) => {
    const rGeo = new THREE.CircleGeometry(radius * r.frac, 32);
    const rMat = new THREE.MeshStandardMaterial({
      color: r.color,
      roughness: 0.55,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const rMesh = new THREE.Mesh(rGeo, rMat);
    rMesh.position.z = r.zOffset;
    rMesh.receiveShadow = true;
    discGroup.add(rMesh);
  });

  // Dedicated Raycast Proxy Collider on Layer 0
  const hitColliderGeo = new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, 0.24, 24);
  hitColliderGeo.rotateX(Math.PI / 2);
  const hitColliderMesh = new THREE.Mesh(
    hitColliderGeo,
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitColliderMesh.userData.targetId = id;
  discGroup.add(hitColliderMesh);

  // 7. Cryo-Frost Crystal Cage (Visible when frozen by Cryo-Frost Shard)
  const frostCageGroup = new THREE.Group();
  frostCageGroup.visible = false;
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x0891b2,
    emissiveIntensity: 0.55,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.72,
  });

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0).scale(0.65, 1.8, 0.65),
      iceMat
    );
    shard.position.set(
      Math.cos(angle) * (radius * 0.85),
      Math.sin(angle) * (radius * 0.85),
      0.08
    );
    shard.rotation.z = angle + 0.4;
    frostCageGroup.add(shard);
  }
  discGroup.add(frostCageGroup);

  return {
    id,
    label,
    materialType,
    distanceMeters: Math.abs(z),
    rootGroup,
    discGroup,
    hitColliderMesh,
    frostCageGroup,
    basePosition: new THREE.Vector3(x, groundY, z),
    patrolAmplitude,
    patrolSpeed,
    patrolPhase: id * 1.3,
    freezeTimer: 0,
    timeScale: 1.0,
    wobbleAngleX: 0,
    wobbleVelocityX: 0,
    radius,
  };
}

export interface CoverObstacle {
  id: string;
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
  height: number;
  materialType: ImpactMaterial;
  mesh: THREE.Mesh;
}

export interface EnvironmentHandle {
  startLineZ: number;
  finishLineZ: number;
  coverObstacles: CoverObstacle[];
  coverColliders: THREE.Mesh[];
  applySeasonAtmosphere: (seasonId: number) => void;
  updateEnvironment: (
    elapsed: number,
    dt: number,
    windSpeedX: number,
    finishUnlocked?: boolean
  ) => void;
}

export function createAlpineEnvironment(
  scene: THREE.Scene,
  maxAnisotropy: number = 16
): EnvironmentHandle {
  // Deterministic PRNG for repeatable, organic placement
  let seed = 4219;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Generate 1024px / 8K-density Procedural PBR Texture Sets (Albedo + Normal + Roughness + Bump)
  const earthTex = createAlpineEarthTextures(28, 28, maxAnisotropy);
  const cobbleTex = createCobblePathTextures(2, 15, maxAnisotropy);
  const stoneTex = createStoneMasonryTextures(2, 2, maxAnisotropy);
  const stoneFineTex = createStoneMasonryTextures(1.2, 2.2, maxAnisotropy);
  const timberTex = createWeatheredTimberTextures(2.5, 1.5, maxAnisotropy);
  const deckTex = createWeatheredTimberTextures(4.5, 2.5, maxAnisotropy);
  const barkTex = createBarkTextures(maxAnisotropy);
  const mountainTex = createMountainRockTextures(14, 2, maxAnisotropy);
  const waterNormalTex = createWaterNormalTexture(3, 18, maxAnisotropy);
  const particleSprite = createParticleSoftSprite();

  // 0. Physical Atmospheric Sky Dome Shader (Sun Halo, Horizon Scattering & Volumetric Cloud Wisps)
  const skyUniforms = {
    uZenithColor: { value: new THREE.Color(0x0b2a4a) },
    uHorizonColor: { value: new THREE.Color(0x7cb9d8) },
    uSunColor: { value: new THREE.Color(0xffe6b3) },
    uSunDir: { value: new THREE.Vector3(0.45, 0.36, -0.82).normalize() },
    uTime: { value: 0 },
    uCloudTint: { value: new THREE.Color(0xf8fafc) },
    uCloudOpacity: { value: 0.42 },
  };

  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform vec3 uCloudTint;
      uniform float uCloudOpacity;
      varying vec3 vWorldPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2D(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 4; i++) {
          v += amp * noise2D(p);
          p *= 2.05;
          amp *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = clamp(dir.y, 0.0, 1.0);
        float horizonBlend = pow(1.0 - h, 2.35);
        vec3 col = mix(uZenithColor, uHorizonColor, horizonBlend);

        // Soft Mie Sun / Moon Scatter + Crisp Solar Disc
        float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
        col += uSunColor * pow(sunAmt, 12.0) * 0.42;
        col += uSunColor * pow(sunAmt, 180.0) * 1.15;
        float disc = smoothstep(0.9986, 0.9994, sunAmt);
        col = mix(col, uSunColor * 1.35, disc);

        // Drifting High-Altitude Cloud Layers
        if (dir.y > 0.03) {
          vec2 cloudUv = dir.xz / (dir.y + 0.18) * 1.35 + vec2(uTime * 0.012, uTime * 0.004);
          float n = fbm(cloudUv);
          float cloudMask = smoothstep(0.46, 0.78, n) * smoothstep(0.03, 0.24, dir.y);
          vec3 cloudCol = mix(uCloudTint, uSunColor, pow(sunAmt, 6.0) * 0.45);
          col = mix(col, cloudCol, cloudMask * uCloudOpacity);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(205, 36, 22), skyMat);
  scene.add(skyDome);

  // 1. 360-Degree Distant Snow-Capped Alpine Mountain Amphitheater
  const mountainGeo = new THREE.CylinderGeometry(128, 152, 46, 96, 8, true);
  const mPos = mountainGeo.getAttribute('position') as THREE.BufferAttribute;
  const mColors = new Float32Array(mPos.count * 3);
  const _mc = new THREE.Color();

  for (let i = 0; i < mPos.count; i++) {
    const mx = mPos.getX(i);
    const my = mPos.getY(i); // -23..+23
    const mz = mPos.getZ(i);
    const angle = Math.atan2(mz, mx);
    const normH = (my + 23) / 46; // 0 at base, 1 at ridge

    // Jagged multi-frequency mountain silhouette
    const peakWave =
      Math.sin(angle * 7.0 + 0.4) * 0.42 +
      Math.cos(angle * 13.0 - 1.1) * 0.28 +
      Math.sin(angle * 23.0 + 2.2) * 0.14;
    const ridgeY = -4 + normH * (30 + peakWave * 18);
    const radialExpand = 1.0 - normH * 0.16 + Math.sin(angle * 11) * 0.04;

    mPos.setXYZ(i, mx * radialExpand, ridgeY, mz * radialExpand);

    // Rock dark slate base -> sunlit granite -> glacier snow cap above 62%
    if (normH > 0.68 + peakWave * 0.12) {
      _mc.setHex(0xe2e8f0);
    } else if (normH > 0.42) {
      _mc.setHex(0x64748b);
    } else {
      _mc.setHex(0x334155);
    }
    mColors[i * 3] = _mc.r;
    mColors[i * 3 + 1] = _mc.g;
    mColors[i * 3 + 2] = _mc.b;
  }
  mountainGeo.setAttribute('color', new THREE.BufferAttribute(mColors, 3));
  mountainGeo.computeVertexNormals();

  const mountainMesh = new THREE.Mesh(
    mountainGeo,
    new THREE.MeshStandardMaterial({
      map: mountainTex.map,
      normalMap: mountainTex.normalMap,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: mountainTex.roughnessMap,
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.04,
      side: THREE.DoubleSide,
    })
  );
  scene.add(mountainMesh);

  // 2. High-Resolution Normal-Mapped Alpine Meadow, Stone Causeway & Cliff Terrain
  const terrainGeo = new THREE.PlaneGeometry(235, 235, 128, 128);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const _c = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = groundHeightAt(vx, vz);
    posAttr.setY(i, vy);

    const microNoise =
      Math.sin(vx * 0.37 + vz * 0.29) * 0.5 + Math.cos(vx * 0.19 - vz * 0.43) * 0.5;
    const isCombatPath = Math.abs(vx) < 3.8 && vz < 5 && vz > -66;
    const isPathCurb = Math.abs(vx) >= 3.8 && Math.abs(vx) < 4.9 && vz < 5 && vz > -66;

    if (isCombatPath) {
      // Packed warm earth & worn gravel shoulder beneath flagstones
      _c.setRGB(0.36 + microNoise * 0.04, 0.31 + microNoise * 0.03, 0.25 + microNoise * 0.02);
    } else if (isPathCurb) {
      // Moss-edged stone shoulder
      _c.setRGB(0.34, 0.37, 0.38);
    } else if (vy > 3.6) {
      // High rocky limestone ridge + frost
      const frostBlend = THREE.MathUtils.clamp((vy - 3.6) / 3.5, 0, 1);
      _c.setHex(0x475569).lerp(new THREE.Color(0xcbd5e1), frostBlend * 0.65);
    } else if (vy > 1.7) {
      // Transition cliff rock & dry alpine moss
      _c.setHex(0x3a4a3e).lerp(
        new THREE.Color(0x525c68),
        THREE.MathUtils.clamp((vy - 1.7) / 1.9, 0, 1)
      );
    } else {
      // Rich verdant alpine meadow
      _c.setRGB(
        0.16 + microNoise * 0.04,
        0.31 + microNoise * 0.05,
        0.17 + microNoise * 0.03
      );
    }
    colors[i * 3] = _c.r;
    colors[i * 3 + 1] = _c.g;
    colors[i * 3 + 2] = _c.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: earthTex.map,
    normalMap: earthTex.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: earthTex.roughnessMap,
    bumpMap: earthTex.bumpMap,
    bumpScale: 0.14,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.04,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // 2B. Polygonal Flagstone Cobble Combat Road (Starting Line -> Ending Line Gauntlet)
  const cobbleRoadGeo = new THREE.PlaneGeometry(7.6, 58, 12, 56);
  cobbleRoadGeo.rotateX(-Math.PI / 2);
  const cRoadPos = cobbleRoadGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < cRoadPos.count; i++) {
    const rx = cRoadPos.getX(i);
    const rz = cRoadPos.getZ(i) - 22;
    cRoadPos.setY(i, groundHeightAt(rx, rz) + 0.025);
  }
  cobbleRoadGeo.computeVertexNormals();
  const cobbleRoadMat = new THREE.MeshStandardMaterial({
    map: cobbleTex.map,
    normalMap: cobbleTex.normalMap,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughnessMap: cobbleTex.roughnessMap,
    roughness: 0.78,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const cobbleRoadMesh = new THREE.Mesh(cobbleRoadGeo, cobbleRoadMat);
  cobbleRoadMesh.position.set(0, 0, -22);
  cobbleRoadMesh.receiveShadow = true;
  scene.add(cobbleRoadMesh);

  // 2C. Animated Shimmering Alpine Stream along Right Valley Flank
  const streamGeo = new THREE.PlaneGeometry(3.8, 86, 4, 24);
  streamGeo.rotateX(-Math.PI / 2);
  const streamMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f4c5c,
    normalMap: waterNormalTex,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.12,
    metalness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.84,
  });
  const streamMesh = new THREE.Mesh(streamGeo, streamMat);
  streamMesh.position.set(11.4, 0.14, -26);
  streamMesh.receiveShadow = true;
  scene.add(streamMesh);

  // 3. 3,400 Instanced Wind-Swaying Alpine Grass Tufts + 420 Forest Ferns
  const grassCount = 3400;
  const bladeGeo = new THREE.ConeGeometry(0.055, 0.42, 4);
  bladeGeo.translate(0, 0.21, 0);
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.02,
  });
  const grassInst = new THREE.InstancedMesh(bladeGeo, grassMat, grassCount);
  grassInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let grassPlaced = 0;

  while (grassPlaced < grassCount) {
    const gx = (rand() - 0.5) * 76;
    const gz = 6 - rand() * 82;
    if (Math.abs(gx) < 4.5 && gz > -60 && gz < 5) continue;
    const gy = groundHeightAt(gx, gz);
    if (gy > 2.8) continue;

    dummy.position.set(gx, gy - 0.02, gz);
    dummy.rotation.set((rand() - 0.5) * 0.32, rand() * Math.PI * 2, (rand() - 0.5) * 0.32);
    const s = 0.7 + rand() * 0.95;
    dummy.scale.set(s, s * (0.85 + rand() * 0.55), s);
    dummy.updateMatrix();
    grassInst.setMatrixAt(grassPlaced, dummy.matrix);

    tint.setHSL(0.26 + (rand() - 0.5) * 0.07, 0.44 + rand() * 0.16, 0.22 + rand() * 0.14);
    grassInst.setColorAt(grassPlaced, tint);
    grassPlaced++;
  }
  grassInst.instanceMatrix.needsUpdate = true;
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  grassInst.computeBoundingSphere();
  scene.add(grassInst);

  // 420 Instanced Forest Ferns / Bushes
  const fernCount = 420;
  const fernGeo = new THREE.DodecahedronGeometry(0.32, 0);
  fernGeo.scale(1.25, 0.65, 1.25);
  fernGeo.translate(0, 0.16, 0);
  const fernMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.02,
  });
  const fernInst = new THREE.InstancedMesh(fernGeo, fernMat, fernCount);
  fernInst.castShadow = true;
  fernInst.receiveShadow = true;
  let fernsPlaced = 0;
  while (fernsPlaced < fernCount) {
    const fx = (rand() - 0.5) * 86;
    const fz = 5 - rand() * 78;
    if (Math.abs(fx) < 6.4 && fz > -55) continue;
    const fy = groundHeightAt(fx, fz);
    if (fy > 3.2) continue;

    dummy.position.set(fx, fy - 0.03, fz);
    dummy.rotation.set((rand() - 0.5) * 0.2, rand() * Math.PI * 2, (rand() - 0.5) * 0.2);
    dummy.scale.setScalar(0.75 + rand() * 1.1);
    dummy.updateMatrix();
    fernInst.setMatrixAt(fernsPlaced, dummy.matrix);
    tint.setHSL(0.28 + (rand() - 0.5) * 0.06, 0.48, 0.18 + rand() * 0.1);
    fernInst.setColorAt(fernsPlaced, tint);
    fernsPlaced++;
  }
  fernInst.instanceMatrix.needsUpdate = true;
  if (fernInst.instanceColor) fernInst.instanceColor.needsUpdate = true;
  fernInst.computeBoundingSphere();
  scene.add(fernInst);

  // 4. 95 Sculpted Normal-Mapped Granite Boulders & Mossy Cliff Outcrops
  const boulderGeo = new THREE.DodecahedronGeometry(0.85, 1);
  const bPos = boulderGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < bPos.count; i++) {
    const bx = bPos.getX(i);
    const by = bPos.getY(i);
    const bz = bPos.getZ(i);
    const warp = 0.84 + Math.abs(Math.sin(bx * 3.1 + by * 2.7 + bz * 4.3)) * 0.32;
    bPos.setXYZ(i, bx * warp, by * warp * 0.72, bz * warp);
  }
  boulderGeo.computeVertexNormals();

  const boulderMat = new THREE.MeshStandardMaterial({
    map: stoneTex.map,
    normalMap: stoneTex.normalMap,
    normalScale: new THREE.Vector2(1.35, 1.35),
    roughnessMap: stoneTex.roughnessMap,
    bumpMap: stoneTex.bumpMap,
    bumpScale: 0.06,
    roughness: 0.88,
    metalness: 0.06,
  });
  const boulderCount = 95;
  const boulderInst = new THREE.InstancedMesh(boulderGeo, boulderMat, boulderCount);
  boulderInst.castShadow = true;
  boulderInst.receiveShadow = true;

  let bouldersPlaced = 0;
  while (bouldersPlaced < boulderCount) {
    const rx = (rand() - 0.5) * 96;
    const rz = 4 - rand() * 88;
    if (Math.abs(rx) < 9.2 && rz > -55) continue;

    const ry = groundHeightAt(rx, rz);
    dummy.position.set(rx, ry + 0.12, rz);
    dummy.rotation.set(rand() * 0.5, rand() * Math.PI * 2, rand() * 0.5);
    const s = 0.65 + rand() * 1.65;
    dummy.scale.set(s * (0.85 + rand() * 0.4), s * (0.7 + rand() * 0.45), s);
    dummy.updateMatrix();
    boulderInst.setMatrixAt(bouldersPlaced, dummy.matrix);

    tint.setHSL(0.58, 0.06, 0.62 + rand() * 0.25);
    boulderInst.setColorAt(bouldersPlaced, tint);
    bouldersPlaced++;
  }
  boulderInst.instanceMatrix.needsUpdate = true;
  if (boulderInst.instanceColor) boulderInst.instanceColor.needsUpdate = true;
  boulderInst.computeBoundingSphere();
  scene.add(boulderInst);

  // 5. Dense Multi-Tier Conifer Pine Forest (140 Trees with Normal-Mapped Bark & 4 Branch Whorls)
  const treeCount = 140;
  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.25, 2.3, 8);
  trunkGeo.translate(0, 1.15, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    map: barkTex.map,
    normalMap: barkTex.normalMap,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: barkTex.roughnessMap,
    bumpMap: barkTex.bumpMap,
    bumpScale: 0.06,
    roughness: 0.92,
  });

  const foliageTier1Geo = new THREE.ConeGeometry(1.55, 2.3, 9);
  foliageTier1Geo.translate(0, 2.25, 0);
  const foliageTier2Geo = new THREE.ConeGeometry(1.25, 2.1, 9);
  foliageTier2Geo.translate(0, 3.35, 0);
  const foliageTier3Geo = new THREE.ConeGeometry(0.92, 1.9, 9);
  foliageTier3Geo.translate(0, 4.4, 0);
  const foliageTier4Geo = new THREE.ConeGeometry(0.55, 1.5, 8);
  foliageTier4Geo.translate(0, 5.3, 0);

  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.02,
  });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const tier1Inst = new THREE.InstancedMesh(foliageTier1Geo, foliageMat, treeCount);
  const tier2Inst = new THREE.InstancedMesh(foliageTier2Geo, foliageMat, treeCount);
  const tier3Inst = new THREE.InstancedMesh(foliageTier3Geo, foliageMat, treeCount);
  const tier4Inst = new THREE.InstancedMesh(foliageTier4Geo, foliageMat, treeCount);

  trunkInst.castShadow = true;
  tier1Inst.castShadow = true;
  tier2Inst.castShadow = true;
  tier3Inst.castShadow = true;
  tier1Inst.receiveShadow = true;
  tier2Inst.receiveShadow = true;

  let placed = 0;
  while (placed < treeCount) {
    const tx = (rand() - 0.5) * 155;
    const tz = -6 - rand() * 92;
    if (Math.abs(tx) < 12.2 && tz > -68) continue;

    const ty = groundHeightAt(tx, tz);
    const scale = 0.85 + rand() * 0.7;

    dummy.position.set(tx, ty - 0.08, tz);
    dummy.rotation.set((rand() - 0.5) * 0.06, rand() * Math.PI * 2, (rand() - 0.5) * 0.06);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();

    trunkInst.setMatrixAt(placed, dummy.matrix);
    tier1Inst.setMatrixAt(placed, dummy.matrix);
    tier2Inst.setMatrixAt(placed, dummy.matrix);
    tier3Inst.setMatrixAt(placed, dummy.matrix);
    tier4Inst.setMatrixAt(placed, dummy.matrix);

    tint.setHSL(0.38 + (rand() - 0.5) * 0.06, 0.42 + rand() * 0.12, 0.16 + rand() * 0.09);
    tier1Inst.setColorAt(placed, tint);
    tier2Inst.setColorAt(placed, tint.clone().offsetHSL(0, 0, 0.025));
    tier3Inst.setColorAt(placed, tint.clone().offsetHSL(0, 0, 0.045));
    tier4Inst.setColorAt(placed, tint.clone().offsetHSL(0, 0, 0.065));

    placed++;
  }

  [trunkInst, tier1Inst, tier2Inst, tier3Inst, tier4Inst].forEach((inst) => {
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    scene.add(inst);
  });

  // 6. Normal-Mapped Oak & Cobblestone Combat Deck + Starting Line & Ending Line Gate
  const deckGroup = new THREE.Group();
  const deckPlankMat = new THREE.MeshStandardMaterial({
    map: deckTex.map,
    normalMap: deckTex.normalMap,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: deckTex.roughnessMap,
    bumpMap: deckTex.bumpMap,
    bumpScale: 0.04,
    color: 0xb89c7d,
    roughness: 0.8,
    metalness: 0.08,
  });
  const wallTimberMat = new THREE.MeshStandardMaterial({
    map: timberTex.map,
    normalMap: timberTex.normalMap,
    normalScale: new THREE.Vector2(1.3, 1.3),
    roughnessMap: timberTex.roughnessMap,
    bumpMap: timberTex.bumpMap,
    bumpScale: 0.045,
    color: 0xc2a382,
    roughness: 0.82,
    metalness: 0.08,
  });
  const ironBandMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.34,
    metalness: 0.88,
  });
  const stoneCoverMat = new THREE.MeshStandardMaterial({
    map: stoneTex.map,
    normalMap: stoneTex.normalMap,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughnessMap: stoneTex.roughnessMap,
    bumpMap: stoneTex.bumpMap,
    bumpScale: 0.05,
    color: 0xcbd5e1,
    roughness: 0.84,
    metalness: 0.07,
  });
  const stoneTrimMat = new THREE.MeshStandardMaterial({
    map: stoneFineTex.map,
    normalMap: stoneFineTex.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughnessMap: stoneFineTex.roughnessMap,
    bumpMap: stoneFineTex.bumpMap,
    bumpScale: 0.035,
    color: 0xe2e8f0,
    roughness: 0.74,
    metalness: 0.12,
  });

  const deckBase = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.12, 5.2), deckPlankMat);
  deckBase.position.set(0, 0.04, 1.6);
  deckBase.receiveShadow = true;
  deckGroup.add(deckBase);

  const deckCurb = new THREE.Mesh(new THREE.BoxGeometry(11.1, 0.1, 5.5), stoneTrimMat);
  deckCurb.position.set(0, 0.01, 1.6);
  deckCurb.receiveShadow = true;
  deckGroup.add(deckCurb);
  scene.add(deckGroup);

  // 6B. 3D STARTING LINE THRESHOLD (z = START_LINE_Z = +2.0)
  const startMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.1,
    roughness: 0.3,
    metalness: 0.5,
  });
  const startLineStrip = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.04, 0.32), startMat);
  startLineStrip.position.set(0, groundHeightAt(0, START_LINE_Z) + 0.11, START_LINE_Z);
  scene.add(startLineStrip);
  [-4.1, 4.1].forEach((sx) => {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.4, 8), stoneTrimMat);
    bollard.position.set(sx, groundHeightAt(sx, START_LINE_Z) + 0.7, START_LINE_Z);
    bollard.castShadow = true;
    const capGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), startMat);
    capGem.position.y = 0.85;
    bollard.add(capGem);
    scene.add(bollard);
  });

  // 6C. 3D ENDING / FINISH LINE TRIUMPHAL EXTRACTION GATE (z = FINISH_LINE_Z = -24.0)
  const finishBeamMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 1.5,
    roughness: 0.25,
    metalness: 0.4,
  });
  const finishLightRayMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const finishGroundY = groundHeightAt(0, FINISH_LINE_Z);
  const finishStrip = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.05, 0.48), finishBeamMat);
  finishStrip.position.set(0, finishGroundY + 0.06, FINISH_LINE_Z);
  scene.add(finishStrip);

  // Twin Triumphal Gate Pillars + Overhead Arch + Vertical Sky Beacon Pillars
  const finishCrystals: THREE.Mesh[] = [];
  [-4.35, 4.35].forEach((fx) => {
    const gy = groundHeightAt(fx, FINISH_LINE_Z);
    const gateTower = new THREE.Group();
    gateTower.position.set(fx, gy, FINISH_LINE_Z);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 1.3), stoneTrimMat);
    plinth.position.y = 0.25;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    gateTower.add(plinth);

    const col = new THREE.Mesh(new THREE.BoxGeometry(0.92, 4.4, 0.92), stoneCoverMat);
    col.position.y = 2.6;
    col.castShadow = true;
    col.receiveShadow = true;
    gateTower.add(col);

    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), finishBeamMat);
    crystal.position.y = 5.2;
    gateTower.add(crystal);
    finishCrystals.push(crystal);

    const lightShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.55, 18, 12, 1, true),
      finishLightRayMat
    );
    lightShaft.position.y = 14.0;
    gateTower.add(lightShaft);

    scene.add(gateTower);
  });

  const archLintel = new THREE.Mesh(new THREE.BoxGeometry(9.9, 0.68, 1.05), stoneTrimMat);
  archLintel.position.set(0, finishGroundY + 4.95, FINISH_LINE_Z);
  archLintel.castShadow = true;
  scene.add(archLintel);

  const archSignCanvas = document.createElement('canvas');
  archSignCanvas.width = 768;
  archSignCanvas.height = 128;
  const archCtx = archSignCanvas.getContext('2d')!;
  archCtx.fillStyle = '#070b12';
  archCtx.fillRect(0, 0, 768, 128);
  archCtx.strokeStyle = '#38bdf8';
  archCtx.lineWidth = 6;
  archCtx.strokeRect(6, 6, 756, 116);
  archCtx.fillStyle = '#f8fafc';
  archCtx.font = 'bold 46px monospace';
  archCtx.textAlign = 'center';
  archCtx.textBaseline = 'middle';
  archCtx.fillText('ENDING LINE  ·  EXTRACTION GATE', 384, 66);
  const archSignTex = new THREE.CanvasTexture(archSignCanvas);
  archSignTex.colorSpace = THREE.SRGBColorSpace;
  const archSignMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 0.88),
    new THREE.MeshBasicMaterial({ map: archSignTex })
  );
  archSignMesh.position.set(0, finishGroundY + 4.95, FINISH_LINE_Z + 0.55);
  scene.add(archSignMesh);

  // Volumetric Sun God-Ray Shafts filtering across the canyon
  const godRayMat = new THREE.MeshBasicMaterial({
    color: 0xffe4b5,
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  [
    { x: -12, y: 14, z: -12 },
    { x: 6, y: 15, z: -22 },
    { x: -4, y: 16, z: -34 },
  ].forEach((gr) => {
    const rayCone = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 5.2, 34, 14, 1, true), godRayMat);
    rayCone.position.set(gr.x, gr.y, gr.z);
    rayCone.rotation.set(0.28, 0, -0.34);
    scene.add(rayCone);
  });

  // Fluted Classical Ruin Columns framing the outer valley (non-blocking scenery)
  const ruinPlacements = [
    { x: -10.8, z: -16, h: 4.2, broken: false },
    { x: 10.8, z: -16, h: 2.9, broken: true },
    { x: -11.4, z: -32, h: 3.6, broken: true },
    { x: 11.4, z: -32, h: 4.4, broken: false },
  ];
  ruinPlacements.forEach((rp) => {
    const gy = groundHeightAt(rp.x, rp.z);
    const ruinGroup = new THREE.Group();
    ruinGroup.position.set(rp.x, gy, rp.z);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 1.4), stoneTrimMat);
    plinth.position.y = 0.22;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    ruinGroup.add(plinth);

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, rp.h, 14),
      stoneCoverMat
    );
    shaft.position.y = 0.45 + rp.h * 0.5;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    if (rp.broken) {
      shaft.rotation.z = (rp.x > 0 ? 1 : -1) * 0.04;
    }
    ruinGroup.add(shaft);

    if (!rp.broken) {
      const capital = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.3, 1.25), stoneTrimMat);
      capital.position.y = 0.45 + rp.h + 0.15;
      capital.castShadow = true;
      ruinGroup.add(capital);
    }
    scene.add(ruinGroup);
  });

  // Fluttering War Banners along Arena Flanks
  const bannerClothMeshes: THREE.Mesh[] = [];
  const bannerMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    roughness: 0.78,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const bannerTrimMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.32,
    metalness: 0.8,
  });
  [
    { x: -6.8, z: -4.2 },
    { x: 6.8, z: -4.2 },
    { x: -8.6, z: -20 },
    { x: 8.6, z: -20 },
  ].forEach((bp, idx) => {
    const gy = groundHeightAt(bp.x, bp.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 4.1, 8), wallTimberMat);
    pole.position.set(bp.x, gy + 2.05, bp.z);
    pole.castShadow = true;
    scene.add(pole);

    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 8), bannerTrimMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(bp.x, gy + 3.85, bp.z);
    scene.add(crossbar);

    const clothGeo = new THREE.PlaneGeometry(0.82, 2.0, 4, 10);
    clothGeo.translate(0, -1.0, 0);
    const cloth = new THREE.Mesh(clothGeo, bannerMat);
    cloth.position.set(bp.x, gy + 3.83, bp.z + 0.03);
    cloth.castShadow = true;
    cloth.userData.phase = idx * 1.4;
    scene.add(cloth);
    bannerClothMeshes.push(cloth);
  });

  // 7. Tactical 3D Cover Fortifications (PBR Timber Shield-Wall + Ancient Ashlar Stone Bastions)
  const coverObstacles: CoverObstacle[] = [];

  // A) Center Low Timber Shield-Wall (height 1.18m: shoot over while standing at 1.68m, HIDE completely when crouched at 0.94m)
  const centerWallW = 4.4;
  const centerWallH = 1.18;
  const centerWallD = 0.44;
  const centerWallZ = -3.6;
  const centerWallMesh = new THREE.Mesh(
    new THREE.BoxGeometry(centerWallW, centerWallH, centerWallD),
    wallTimberMat
  );
  centerWallMesh.position.set(0, groundHeightAt(0, centerWallZ) + centerWallH * 0.5, centerWallZ);
  centerWallMesh.castShadow = true;
  centerWallMesh.receiveShadow = true;
  centerWallMesh.userData.materialType = 'wood';

  const wallTopRail = new THREE.Mesh(
    new THREE.BoxGeometry(centerWallW + 0.14, 0.14, centerWallD + 0.12),
    deckPlankMat
  );
  wallTopRail.position.set(0, centerWallH * 0.5 - 0.04, 0);
  wallTopRail.castShadow = true;
  centerWallMesh.add(wallTopRail);

  [-1.6, 0, 1.6].forEach((bx) => {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, centerWallH + 0.04, centerWallD + 0.08),
      ironBandMat
    );
    band.position.set(bx, 0, 0);
    centerWallMesh.add(band);

    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.075, 1.05, 8), wallTimberMat);
    stake.position.set(bx + 0.58, 0.08, -centerWallD * 0.68);
    stake.rotation.x = -0.42;
    stake.castShadow = true;
    centerWallMesh.add(stake);
  });
  scene.add(centerWallMesh);
  coverObstacles.push({
    id: 'center-timber-wall',
    x: 0,
    z: centerWallZ,
    halfWidth: centerWallW * 0.5,
    halfDepth: centerWallD * 0.5,
    height: centerWallH,
    materialType: 'wood',
    mesh: centerWallMesh,
  });

  // B) Left & Right Ancient Ashlar Stone Bastions & Forward Cover Pillars along Start -> Finish Route
  const flankConfigs = [
    { id: 'bastion-left', x: -3.9, z: -3.2, w: 1.9, h: 2.15, d: 0.95 },
    { id: 'bastion-right', x: 3.9, z: -3.2, w: 1.9, h: 2.15, d: 0.95 },
    { id: 'pillar-mid-left', x: -4.8, z: -10.5, w: 1.65, h: 2.35, d: 1.1 },
    { id: 'pillar-mid-right', x: 4.8, z: -10.5, w: 1.65, h: 2.35, d: 1.1 },
    { id: 'barricade-advance', x: -1.4, z: -16.8, w: 2.5, h: 1.2, d: 0.6 },
    { id: 'pillar-north-right', x: 3.2, z: -19.2, w: 1.6, h: 2.25, d: 1.0 },
  ];

  flankConfigs.forEach((fc) => {
    const gy = groundHeightAt(fc.x, fc.z);
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(fc.w, fc.h, fc.d), stoneCoverMat);
    pillar.position.set(fc.x, gy + fc.h * 0.5, fc.z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    pillar.userData.materialType = 'stone';

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(fc.w + 0.22, 0.2, fc.d + 0.22),
      stoneTrimMat
    );
    cap.position.set(0, fc.h * 0.5 - 0.08, 0);
    cap.castShadow = true;
    pillar.add(cap);

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(fc.w + 0.2, 0.24, fc.d + 0.2),
      stoneTrimMat
    );
    plinth.position.set(0, -fc.h * 0.5 + 0.12, 0);
    pillar.add(plinth);

    scene.add(pillar);
    coverObstacles.push({
      id: fc.id,
      x: fc.x,
      z: fc.z,
      halfWidth: fc.w * 0.5,
      halfDepth: fc.d * 0.5,
      height: fc.h,
      materialType: 'stone',
      mesh: pillar,
    });
  });

  // 8. Forged Iron Fire Braziers with Animated Flames & Warm Dynamic PointLights
  interface BrazierLightHandle {
    light: THREE.PointLight;
    flameGroup: THREE.Group;
    baseIntensity: number;
    phase: number;
  }
  const braziers: BrazierLightHandle[] = [];
  const emberBedMat = new THREE.MeshStandardMaterial({
    color: 0x7c2d12,
    emissive: 0xea580c,
    emissiveIntensity: 2.2,
    roughness: 0.9,
  });
  const flameOuterMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.85,
  });
  const flameCoreMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.92,
  });

  [
    { x: -5.4, z: -3.2, withLight: true },
    { x: 5.4, z: -3.2, withLight: true },
    { x: -6.7, z: -10.5, withLight: true },
    { x: 6.7, z: -10.5, withLight: true },
  ].forEach((bp, idx) => {
    const gy = groundHeightAt(bp.x, bp.z);
    const bGroup = new THREE.Group();
    bGroup.position.set(bp.x, gy, bp.z);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 1.15, 8), stoneTrimMat);
    pedestal.position.y = 0.57;
    pedestal.castShadow = true;
    bGroup.add(pedestal);

    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.2, 0.32, 12), ironBandMat);
    bowl.position.y = 1.26;
    bowl.castShadow = true;
    bGroup.add(bowl);

    const embers = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), emberBedMat);
    embers.scale.set(1, 0.35, 1);
    embers.position.y = 1.38;
    bGroup.add(embers);

    const flameGroup = new THREE.Group();
    flameGroup.position.y = 1.45;
    const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.62, 8), flameOuterMat);
    outerFlame.position.y = 0.28;
    const coreFlame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 7), flameCoreMat);
    coreFlame.position.y = 0.2;
    flameGroup.add(outerFlame, coreFlame);
    bGroup.add(flameGroup);

    const light = new THREE.PointLight(0xff8c32, bp.withLight ? 5.5 : 0, 15, 1.7);
    light.position.set(0, 1.85, 0);
    bGroup.add(light);

    scene.add(bGroup);
    braziers.push({ light, flameGroup, baseIntensity: 5.5, phase: idx * 1.9 });
  });

  // 9. Wind-Driven Atmospheric Particles (280 Dust Motes / Embers / Snowflakes)
  const atmosCount = 280;
  const atmosPositions = new Float32Array(atmosCount * 3);
  const atmosSpeeds = new Float32Array(atmosCount);
  for (let i = 0; i < atmosCount; i++) {
    atmosPositions[i * 3] = (rand() - 0.5) * 44;
    atmosPositions[i * 3 + 1] = 0.4 + rand() * 8.5;
    atmosPositions[i * 3 + 2] = 6 - rand() * 58;
    atmosSpeeds[i] = 0.45 + rand() * 0.9;
  }
  const atmosGeo = new THREE.BufferGeometry();
  atmosGeo.setAttribute('position', new THREE.BufferAttribute(atmosPositions, 3));
  const atmosMat = new THREE.PointsMaterial({
    map: particleSprite,
    color: 0xfde68a,
    size: 0.16,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const atmosPoints = new THREE.Points(atmosGeo, atmosMat);
  atmosPoints.frustumCulled = false;
  scene.add(atmosPoints);

  let currentSeasonMode = 1;

  const applySeasonAtmosphere = (seasonId: number) => {
    currentSeasonMode = seasonId;
    if (seasonId === 1) {
      // Season 1: Golden Alpine Dawn
      skyUniforms.uZenithColor.value.setHex(0x16426e);
      skyUniforms.uHorizonColor.value.setHex(0x9bc4d8);
      skyUniforms.uSunColor.value.setHex(0xffe1a8);
      skyUniforms.uSunDir.value.set(0.45, 0.28, -0.85).normalize();
      skyUniforms.uCloudTint.value.setHex(0xfff1d6);
      skyUniforms.uCloudOpacity.value = 0.46;
      atmosMat.color.setHex(0xfef3c7);
      atmosMat.size = 0.14;
      atmosMat.opacity = 0.52;
    } else if (seasonId === 2) {
      // Season 2: High Noon Emerald Valley
      skyUniforms.uZenithColor.value.setHex(0x0d3b66);
      skyUniforms.uHorizonColor.value.setHex(0x74b9be);
      skyUniforms.uSunColor.value.setHex(0xfffbeb);
      skyUniforms.uSunDir.value.set(0.25, 0.55, -0.79).normalize();
      skyUniforms.uCloudTint.value.setHex(0xf1f5f9);
      skyUniforms.uCloudOpacity.value = 0.5;
      atmosMat.color.setHex(0xd9f99d);
      atmosMat.size = 0.13;
      atmosMat.opacity = 0.48;
    } else if (seasonId === 3) {
      // Season 3: Crimson Sunset & Campfire Embers
      skyUniforms.uZenithColor.value.setHex(0x28132d);
      skyUniforms.uHorizonColor.value.setHex(0xc25b3a);
      skyUniforms.uSunColor.value.setHex(0xff9e54);
      skyUniforms.uSunDir.value.set(-0.35, 0.16, -0.92).normalize();
      skyUniforms.uCloudTint.value.setHex(0xfdba74);
      skyUniforms.uCloudOpacity.value = 0.48;
      atmosMat.color.setHex(0xfb923c);
      atmosMat.size = 0.17;
      atmosMat.opacity = 0.72;
    } else if (seasonId === 4) {
      // Season 4: Frostbound Glacier & Drifting Snowfall
      skyUniforms.uZenithColor.value.setHex(0x0b1f38);
      skyUniforms.uHorizonColor.value.setHex(0x527d99);
      skyUniforms.uSunColor.value.setHex(0xe0f2fe);
      skyUniforms.uSunDir.value.set(0.5, 0.32, -0.8).normalize();
      skyUniforms.uCloudTint.value.setHex(0xcbd5e1);
      skyUniforms.uCloudOpacity.value = 0.58;
      atmosMat.color.setHex(0xf0f9ff);
      atmosMat.size = 0.21;
      atmosMat.opacity = 0.78;
    } else {
      // Season 5: Imperial Lunar Eclipse
      skyUniforms.uZenithColor.value.setHex(0x050816);
      skyUniforms.uHorizonColor.value.setHex(0x251a42);
      skyUniforms.uSunColor.value.setHex(0xc4b5fd);
      skyUniforms.uSunDir.value.set(0.12, 0.34, -0.93).normalize();
      skyUniforms.uCloudTint.value.setHex(0x4c1d95);
      skyUniforms.uCloudOpacity.value = 0.34;
      atmosMat.color.setHex(0xd8b4fe);
      atmosMat.size = 0.16;
      atmosMat.opacity = 0.65;
    }
  };

  applySeasonAtmosphere(1);

  const updateEnvironment = (
    elapsed: number,
    dt: number,
    windSpeedX: number,
    finishUnlocked: boolean = false
  ) => {
    skyUniforms.uTime.value = elapsed;

    // 0. Animate Water Stream & Ending Line Extraction Beacon
    waterNormalTex.offset.y -= dt * 0.42;
    waterNormalTex.offset.x += Math.sin(elapsed * 0.6) * dt * 0.03;

    const gateHex = finishUnlocked ? 0x10b981 : 0xf59e0b;
    const gatePulse = finishUnlocked ? 1.7 + Math.sin(elapsed * 5.2) * 0.6 : 1.1 + Math.sin(elapsed * 2.5) * 0.3;
    finishBeamMat.color.setHex(gateHex);
    finishBeamMat.emissive.setHex(gateHex);
    finishBeamMat.emissiveIntensity = gatePulse;
    finishLightRayMat.color.setHex(gateHex);
    finishLightRayMat.opacity = finishUnlocked ? 0.34 : 0.18;
    for (let i = 0; i < finishCrystals.length; i++) {
      finishCrystals[i].rotation.y = elapsed * 1.6 + i;
      finishCrystals[i].position.y = 5.25 + Math.sin(elapsed * 2.8 + i) * 0.14;
    }

    // 1. Natural Fire Brazier Flicker
    for (let i = 0; i < braziers.length; i++) {
      const b = braziers[i];
      const f =
        Math.sin(elapsed * 9.5 + b.phase) * 0.5 +
        Math.sin(elapsed * 16.3 + b.phase * 1.7) * 0.32;
      b.light.intensity = b.baseIntensity + f * 1.4;
      const sx = 0.92 + f * 0.14;
      const sy = 0.96 + Math.cos(elapsed * 11.2 + b.phase) * 0.18;
      b.flameGroup.scale.set(sx, sy, sx);
      b.flameGroup.rotation.z = windSpeedX * 0.03 + f * 0.08;
    }

    // 2. Fluttering War Banners driven by Crosswind
    const windStrength = Math.abs(windSpeedX) * 0.14 + 0.18;
    for (let i = 0; i < bannerClothMeshes.length; i++) {
      const cloth = bannerClothMeshes[i];
      const ph = (cloth.userData.phase as number) || 0;
      cloth.rotation.x = Math.sin(elapsed * (3.2 + windStrength * 2) + ph) * 0.14 * windStrength + 0.08;
      cloth.rotation.z =
        windSpeedX * 0.045 + Math.cos(elapsed * 2.5 + ph) * 0.06;
    }

    // 3. Subtle Grass Meadow Breeze
    grassInst.rotation.z = Math.sin(elapsed * 1.7) * 0.012 + windSpeedX * 0.004;

    // 4. Wind-Driven Pollen / Embers / Snowfall Drift
    const posArr = atmosGeo.getAttribute('position') as THREE.BufferAttribute;
    const isSnow = currentSeasonMode === 4;
    const isEmber = currentSeasonMode === 3;
    const vertVel = isSnow ? -1.45 : isEmber ? 0.85 : -0.18;

    for (let i = 0; i < atmosCount; i++) {
      const sp = atmosSpeeds[i];
      let px = posArr.getX(i) + (windSpeedX * 0.85 + Math.sin(elapsed + i) * 0.25) * sp * dt;
      let py = posArr.getY(i) + vertVel * sp * dt;
      const pz = posArr.getZ(i);

      if (px > 22) px -= 44;
      if (px < -22) px += 44;
      if (py < 0.2) py = 8.6;
      if (py > 8.8) py = 0.3;

      posArr.setXY(i, px, py);
      if (Math.abs(pz) > 60) posArr.setZ(i, 6 - (i % 55));
    }
    posArr.needsUpdate = true;
  };

  return {
    startLineZ: START_LINE_Z,
    finishLineZ: FINISH_LINE_Z,
    coverObstacles,
    coverColliders: coverObstacles.map((c) => c.mesh),
    applySeasonAtmosphere,
    updateEnvironment,
  };
}

export type EnemyAIState =
  | 'advance'
  | 'windup_ranged'
  | 'charge_melee'
  | 'attack_melee'
  | 'stagger'
  | 'defeated';

export interface ArmoredEnemyEntity {
  id: number;
  archetype: EnemyArchetype;
  rootGroup: THREE.Group;
  bodyPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftArmPivot: THREE.Group; // Holds Shield
  rightArmPivot: THREE.Group; // Holds Weapon / Javelin
  shieldMesh: THREE.Mesh | null;
  javelinTipGlowMat: THREE.MeshStandardMaterial | null;
  frostCageGroup: THREE.Group;
  hpBarFillMesh: THREE.Mesh;
  hpBarFillMat: THREE.MeshBasicMaterial;
  hitboxMeshes: THREE.Mesh[];
  hp: number;
  maxHp: number;
  shieldHp: number;
  maxShieldHp: number;
  shieldBrokenTimer: number;
  moveSpeed: number;
  attackDamage: number;
  attackCooldown: number;
  attackTimer: number;
  windupTimer: number;
  staggerTimer: number;
  freezeTimer: number;
  timeScale: number;
  hasShield: boolean;
  aiState: EnemyAIState;
  walkPhase: number;
  strafeSign: number;
  defeatedAge: number;
}

export function createArmoredEnemyModel(spec: EnemySpawnSpec): ArmoredEnemyEntity {
  const rootGroup = new THREE.Group();
  const gy = groundHeightAt(spec.x, spec.z);
  rootGroup.position.set(spec.x, gy, spec.z);

  const scale = spec.archetype === 'centurion' ? 1.18 : spec.archetype === 'javelineer' ? 0.96 : 1.02;
  rootGroup.scale.setScalar(scale);

  const hitboxMeshes: THREE.Mesh[] = [];
  const registerHitbox = (
    mesh: THREE.Mesh,
    zone: HitboxZone,
    materialType: ImpactMaterial
  ) => {
    mesh.userData.enemyId = spec.id;
    mesh.userData.hitboxZone = zone;
    mesh.userData.materialType = materialType;
    hitboxMeshes.push(mesh);
  };

  const armorMat = new THREE.MeshStandardMaterial({
    color: spec.armorHex,
    metalness: 0.78,
    roughness: 0.3,
  });
  const tunicMat = new THREE.MeshStandardMaterial({
    color: spec.archetype === 'centurion' ? 0x7f1d1d : 0x1e293b,
    metalness: 0.08,
    roughness: 0.85,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xc69070,
    roughness: 0.7,
    metalness: 0.04,
  });
  const shieldMat = new THREE.MeshStandardMaterial({
    color: spec.shieldHex,
    metalness: 0.84,
    roughness: 0.25,
  });
  const crestMat = new THREE.MeshStandardMaterial({
    color: spec.archetype === 'centurion' ? 0xdc2626 : spec.archetype === 'javelineer' ? 0x38bdf8 : 0xf59e0b,
    roughness: 0.75,
    metalness: 0.1,
  });

  // Ground contact shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.65, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
  );
  shadow.position.y = 0.02;
  rootGroup.add(shadow);

  const bodyPivot = new THREE.Group();
  rootGroup.add(bodyPivot);

  // Articulated Legs with Bronze Greaves (Limb hitbox 0.65x)
  const legGeo = new THREE.CylinderGeometry(0.085, 0.075, 0.78, 10);
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.15, 0.78, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, armorMat);
  leftLegMesh.position.y = -0.39;
  leftLegMesh.castShadow = true;
  registerHitbox(leftLegMesh, 'limb', 'metal');
  leftLegPivot.add(leftLegMesh);
  bodyPivot.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.15, 0.78, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, armorMat);
  rightLegMesh.position.y = -0.39;
  rightLegMesh.castShadow = true;
  registerHitbox(rightLegMesh, 'limb', 'metal');
  rightLegPivot.add(rightLegMesh);
  bodyPivot.add(rightLegPivot);

  // Pteruges skirt + Molded Ancient Cuirass Torso (Torso hitbox 1.0x)
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.32, 12), tunicMat);
  skirt.position.y = 0.85;
  registerHitbox(skirt, 'torso', 'wood');
  bodyPivot.add(skirt);

  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.58, 0.3), armorMat);
  torsoMesh.position.y = 1.24;
  torsoMesh.castShadow = true;
  registerHitbox(torsoMesh, 'torso', 'metal');
  bodyPivot.add(torsoMesh);

  // Generous invisible Torso Hit Proxy so shoulder/ribs/neck shots always connect reliably
  const torsoHitProxy = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.78, 0.44),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  torsoHitProxy.position.y = 1.22;
  registerHitbox(torsoHitProxy, 'torso', 'metal');
  bodyPivot.add(torsoHitProxy);

  // Shoulder Pauldrons
  [-0.29, 0.29].forEach((px) => {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), armorMat);
    pauldron.scale.set(1.1, 0.75, 1.0);
    pauldron.position.set(px, 1.48, 0);
    registerHitbox(pauldron, 'torso', 'metal');
    bodyPivot.add(pauldron);
  });

  // Head & Crested Corinthian / Centurion Helmet (Headshot hitbox 2.5x)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.74, 0.02);
  bodyPivot.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 14), skinMat);
  registerHitbox(headMesh, 'head', 'metal');
  headGroup.add(headMesh);

  const helmDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.65),
    armorMat
  );
  helmDome.position.y = 0.02;
  helmDome.castShadow = true;
  registerHitbox(helmDome, 'head', 'metal');
  headGroup.add(helmDome);

  // Dedicated generous headshot proxy around helmet for clean hit detection
  const headHitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 12, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  registerHitbox(headHitProxy, 'head', 'metal');
  headGroup.add(headHitProxy);

  // Helmet Crest / Plume
  if (spec.archetype === 'centurion') {
    const transverseCrest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.09), crestMat);
    transverseCrest.position.set(0, 0.21, -0.02);
    registerHitbox(transverseCrest, 'head', 'metal');
    headGroup.add(transverseCrest);
  } else {
    const plume = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.28), crestMat);
    plume.position.set(0, 0.2, -0.03);
    registerHitbox(plume, 'head', 'metal');
    headGroup.add(plume);
  }

  // Left Arm + Shield (Compact realistic guard so Chest/Shoulders/Head stay targetable!)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.34, 1.42, 0.06);
  const lArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.48, 8), armorMat);
  lArmMesh.position.set(0, -0.18, 0.1);
  lArmMesh.rotation.x = Math.PI / 3;
  registerHitbox(lArmMesh, 'limb', 'metal');
  leftArmPivot.add(lArmMesh);

  let shieldMesh: THREE.Mesh | null = null;
  if (spec.hasShield) {
    if (spec.archetype === 'centurion') {
      shieldMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.68, 0.06), shieldMat);
      shieldMesh.position.set(0.08, -0.26, 0.34);
    } else {
      shieldMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.05, 20).rotateX(Math.PI / 2),
        shieldMat
      );
      shieldMesh.position.set(0.06, -0.24, 0.32);
    }
    shieldMesh.castShadow = true;
    const boss = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 })
    );
    boss.scale.z = 0.5;
    boss.position.z = 0.035;
    shieldMesh.add(boss);

    registerHitbox(shieldMesh, 'shield', 'metal');
    leftArmPivot.add(shieldMesh);
  }
  bodyPivot.add(leftArmPivot);

  // Right Arm + Spear / Javelin / Gladius
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.32, 1.44, 0.04);
  const rArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.48, 8), armorMat);
  rArmMesh.position.set(0, -0.18, 0.12);
  rArmMesh.rotation.x = Math.PI / 3;
  registerHitbox(rArmMesh, 'limb', 'metal');
  rightArmPivot.add(rArmMesh);

  let javelinTipGlowMat: THREE.MeshStandardMaterial | null = null;
  if (spec.archetype === 'javelineer') {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.35, 8).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.85 })
    );
    shaft.position.set(0, -0.12, 0.45);
    javelinTipGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf97316,
      emissiveIntensity: 0.4,
      metalness: 0.85,
      roughness: 0.2,
    });
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.16, 8).rotateX(Math.PI / 2),
      javelinTipGlowMat
    );
    tip.position.z = 0.72;
    shaft.add(tip);
    rightArmPivot.add(shaft);
  } else {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.02, 0.72),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.18 })
    );
    blade.position.set(0, -0.2, 0.46);
    rightArmPivot.add(blade);
  }
  bodyPivot.add(rightArmPivot);

  // World-space Diegetic Health Bar above Warrior's Helm
  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x070b12, transparent: true, opacity: 0.85 })
  );
  hpBg.position.set(0, 2.22, 0);
  rootGroup.add(hpBg);

  const hpBarFillGeo = new THREE.PlaneGeometry(0.8, 0.055);
  hpBarFillGeo.translate(0.4, 0, 0);
  const hpBarFillMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const hpBarFillMesh = new THREE.Mesh(hpBarFillGeo, hpBarFillMat);
  hpBarFillMesh.position.set(-0.4, 2.22, 0.01);
  rootGroup.add(hpBarFillMesh);

  // Cryo-Frost Stasis Cage
  const frostCageGroup = new THREE.Group();
  frostCageGroup.visible = false;
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x0891b2,
    emissiveIntensity: 0.65,
    roughness: 0.15,
    transparent: true,
    opacity: 0.68,
  });
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0).scale(0.6, 2.4, 0.6),
      iceMat
    );
    shard.position.set(Math.cos(ang) * 0.42, 0.95, Math.sin(ang) * 0.42);
    frostCageGroup.add(shard);
  }
  rootGroup.add(frostCageGroup);

  const maxShieldHp = spec.hasShield ? (spec.archetype === 'centurion' ? 140 : 80) : 0;

  return {
    id: spec.id,
    archetype: spec.archetype,
    rootGroup,
    bodyPivot,
    leftLegPivot,
    rightLegPivot,
    leftArmPivot,
    rightArmPivot,
    shieldMesh,
    javelinTipGlowMat,
    frostCageGroup,
    hpBarFillMesh,
    hpBarFillMat,
    hitboxMeshes,
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    shieldHp: maxShieldHp,
    maxShieldHp,
    shieldBrokenTimer: 0,
    moveSpeed: spec.moveSpeed,
    attackDamage: spec.attackDamage,
    attackCooldown: spec.attackCooldown,
    attackTimer: 0.8 + (spec.id % 3) * 0.65,
    windupTimer: 0,
    staggerTimer: 0,
    freezeTimer: 0,
    timeScale: 1.0,
    hasShield: spec.hasShield,
    aiState: 'advance',
    walkPhase: spec.id * 1.1,
    strafeSign: spec.id % 2 === 0 ? 1 : -1,
    defeatedAge: 0,
  };
}

export function createEnemyJavelinModel(): THREE.Group {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 1.15, 8).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
  );
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.042, 0.18, 8).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf97316,
      emissiveIntensity: 1.5,
      metalness: 0.85,
      roughness: 0.2,
    })
  );
  tip.position.z = -0.62;
  group.add(shaft, tip);
  return group;
}
