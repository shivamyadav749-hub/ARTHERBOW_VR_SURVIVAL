import * as THREE from 'three';

export interface PbrTextureSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

function makeSeededRandom(seedInit: number): () => number {
  let s = seedInit >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function configureRepeatingTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  isColor: boolean,
  anisotropy: number = 16
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Converts a grayscale heightfield canvas into a crisp tangent-space RGB Normal Map
 * using 3x3 Sobel convolution so directional sunlight catches every stone chisel & grain.
 */
function buildNormalCanvasFromHeight(
  heightCanvas: HTMLCanvasElement,
  strength: number = 2.6
): HTMLCanvasElement {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = w;
  normalCanvas.height = h;
  const nCtx = normalCanvas.getContext('2d')!;
  const outImg = nCtx.createImageData(w, h);
  const out = outImg.data;

  const sampleH = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return srcData[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      let nx = -dX;
      let ny = -dY;
      let nz = 1.0;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * w + x) * 4;
      out[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      out[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }

  nCtx.putImageData(outImg, 0, 0);
  return normalCanvas;
}

/**
 * 1024px 8K-density carved limestone & granite ashlar masonry (albedo + normal + roughness + bump).
 */
export function createStoneMasonryTextures(
  repeatX: number = 2,
  repeatY: number = 2,
  anisotropy: number = 16
): PbrTextureSet {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = roughCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = roughCanvas.height = size;

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;
  const rand = makeSeededRandom(1013);

  // Recessed mortar joints
  cCtx.fillStyle = '#252a32';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#181818';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#efefef';
  rCtx.fillRect(0, 0, size, size);

  const rows = 8;
  const rowH = size / rows;
  const cols = 4;
  const colW = size / cols;

  for (let r = 0; r < rows; r++) {
    const rowOffset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const bx = c * colW + rowOffset + 5;
      const by = r * rowH + 5;
      const bw = colW - 10;
      const bh = rowH - 10;

      const tone = 88 + Math.floor(rand() * 34);
      const warm = Math.floor((rand() - 0.5) * 18);
      cCtx.fillStyle = `rgb(${tone + warm}, ${tone + 4}, ${tone - 3})`;
      cCtx.fillRect(bx, by, bw, bh);

      const bTone = 178 + Math.floor(rand() * 44);
      bCtx.fillStyle = `rgb(${bTone}, ${bTone}, ${bTone})`;
      bCtx.fillRect(bx, by, bw, bh);

      const rTone = 185 + Math.floor(rand() * 45);
      rCtx.fillStyle = `rgb(${rTone}, ${rTone}, ${rTone})`;
      rCtx.fillRect(bx, by, bw, bh);

      // Chiseled edge bevels for sharp lighting catch
      cCtx.fillStyle = 'rgba(255,255,255,0.1)';
      cCtx.fillRect(bx, by, bw, 5);
      cCtx.fillStyle = 'rgba(0,0,0,0.22)';
      cCtx.fillRect(bx, by + bh - 5, bw, 5);

      bCtx.fillStyle = 'rgb(235,235,235)';
      bCtx.fillRect(bx + 2, by + 2, bw - 4, 4);
      bCtx.fillStyle = 'rgb(100,100,100)';
      bCtx.fillRect(bx + 2, by + bh - 6, bw - 4, 4);

      // Micro-pitting, mineral quartz flecks & weathered cracks
      for (let p = 0; p < 130; p++) {
        const px = bx + rand() * bw;
        const py = by + rand() * bh;
        const pr = 1.2 + rand() * 7.5;
        const dark = rand() > 0.42;
        cCtx.fillStyle = dark ? 'rgba(16, 20, 26, 0.2)' : 'rgba(225, 230, 238, 0.14)';
        cCtx.beginPath();
        cCtx.arc(px, py, pr, 0, Math.PI * 2);
        cCtx.fill();

        bCtx.fillStyle = dark ? 'rgba(35,35,35,0.32)' : 'rgba(245,245,245,0.22)';
        bCtx.beginPath();
        bCtx.arc(px, py, pr, 0, Math.PI * 2);
        bCtx.fill();
      }

      // Fine hairline cracks
      if (rand() > 0.5) {
        cCtx.strokeStyle = 'rgba(15, 18, 24, 0.35)';
        cCtx.lineWidth = 1.5;
        bCtx.strokeStyle = 'rgb(60, 60, 60)';
        bCtx.lineWidth = 2;
        const sx = bx + rand() * bw * 0.7;
        const sy = by + rand() * bh * 0.6;
        cCtx.beginPath();
        bCtx.beginPath();
        cCtx.moveTo(sx, sy);
        bCtx.moveTo(sx, sy);
        for (let seg = 0; seg < 4; seg++) {
          const nx = sx + (rand() - 0.5) * 45 + seg * 14;
          const ny = sy + (rand() - 0.3) * 32 + seg * 10;
          cCtx.lineTo(nx, ny);
          bCtx.lineTo(nx, ny);
        }
        cCtx.stroke();
        bCtx.stroke();
      }

      // Moss & lichen creep along bottom seams
      if (rand() > 0.52) {
        cCtx.fillStyle = 'rgba(54, 86, 46, 0.28)';
        cCtx.beginPath();
        cCtx.arc(bx + rand() * bw, by + bh - 3, 12 + rand() * 20, 0, Math.PI * 2);
        cCtx.fill();
      }
    }
  }

  const normalCanvas = buildNormalCanvasFromHeight(bumpCanvas, 3.2);
  return {
    map: configureRepeatingTexture(colorCanvas, repeatX, repeatY, true, anisotropy),
    normalMap: configureRepeatingTexture(normalCanvas, repeatX, repeatY, false, anisotropy),
    roughnessMap: configureRepeatingTexture(roughCanvas, repeatX, repeatY, false, anisotropy),
    bumpMap: configureRepeatingTexture(bumpCanvas, repeatX, repeatY, false, anisotropy),
  };
}

/**
 * 1024px Ancient Flagstone Cobble Road (for the Starting Line -> Ending Line combat gauntlet).
 */
export function createCobblePathTextures(
  repeatX: number = 2,
  repeatY: number = 14,
  anisotropy: number = 16
): PbrTextureSet {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = roughCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = roughCanvas.height = size;

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;
  const rand = makeSeededRandom(3089);

  // Packed soil/moss between flagstones
  cCtx.fillStyle = '#332f28';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#202020';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#f5f5f5';
  rCtx.fillRect(0, 0, size, size);

  const grid = 8;
  const cell = size / grid;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const cx = (gx + 0.5 + (rand() - 0.5) * 0.28) * cell;
      const cy = (gy + 0.5 + (rand() - 0.5) * 0.28) * cell;
      const rx = cell * (0.42 + rand() * 0.08);
      const ry = cell * (0.38 + rand() * 0.09);

      const base = 92 + Math.floor(rand() * 38);
      const warm = Math.floor((rand() - 0.3) * 20);
      cCtx.fillStyle = `rgb(${base + warm}, ${base + 4}, ${base - 6})`;
      bCtx.fillStyle = `rgb(${180 + Math.floor(rand() * 50)}, 195, 195)`;
      // Center stones polished smoother by footsteps (lower roughness = realistic sheen)
      const smoothFactor = Math.abs(gx - 3.5) < 2 ? 135 : 195;
      rCtx.fillStyle = `rgb(${smoothFactor}, ${smoothFactor}, ${smoothFactor})`;

      const drawStone = (ctx: CanvasRenderingContext2D) => {
        ctx.beginPath();
        const pts = 7;
        for (let p = 0; p < pts; p++) {
          const ang = (p / pts) * Math.PI * 2;
          const jitter = 0.84 + rand() * 0.24;
          const px = cx + Math.cos(ang) * rx * jitter;
          const py = cy + Math.sin(ang) * ry * jitter;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      };

      drawStone(cCtx);
      drawStone(bCtx);
      drawStone(rCtx);

      // Stone surface speckles
      for (let s = 0; s < 25; s++) {
        const px = cx + (rand() - 0.5) * rx * 1.4;
        const py = cy + (rand() - 0.5) * ry * 1.4;
        cCtx.fillStyle = rand() > 0.5 ? 'rgba(20,20,24,0.16)' : 'rgba(235,235,240,0.12)';
        cCtx.fillRect(px, py, 2 + rand() * 4, 2 + rand() * 4);
      }
    }
  }

  // Subtle moss tufts in crevices
  for (let m = 0; m < 120; m++) {
    cCtx.fillStyle = 'rgba(65, 102, 52, 0.22)';
    cCtx.beginPath();
    cCtx.arc(rand() * size, rand() * size, 4 + rand() * 10, 0, Math.PI * 2);
    cCtx.fill();
  }

  const normalCanvas = buildNormalCanvasFromHeight(bumpCanvas, 3.0);
  return {
    map: configureRepeatingTexture(colorCanvas, repeatX, repeatY, true, anisotropy),
    normalMap: configureRepeatingTexture(normalCanvas, repeatX, repeatY, false, anisotropy),
    roughnessMap: configureRepeatingTexture(roughCanvas, repeatX, repeatY, false, anisotropy),
    bumpMap: configureRepeatingTexture(bumpCanvas, repeatX, repeatY, false, anisotropy),
  };
}

/**
 * 1024px Seasoned Oak Timber Planks (albedo + normal + roughness + bump).
 */
export function createWeatheredTimberTextures(
  repeatX: number = 2,
  repeatY: number = 1,
  anisotropy: number = 16
): PbrTextureSet {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = roughCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = roughCanvas.height = size;

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;
  const rand = makeSeededRandom(2027);

  cCtx.fillStyle = '#382213';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#888888';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#d4d4d4';
  rCtx.fillRect(0, 0, size, size);

  const planks = 8;
  const plankH = size / planks;

  for (let p = 0; p < planks; p++) {
    const py = p * plankH;
    const baseR = 92 + Math.floor(rand() * 26);
    const baseG = 58 + Math.floor(rand() * 18);
    const baseB = 31 + Math.floor(rand() * 12);

    cCtx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
    cCtx.fillRect(0, py + 4, size, plankH - 8);

    const bVal = 175 + Math.floor(rand() * 35);
    bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
    bCtx.fillRect(0, py + 4, size, plankH - 8);

    // Plank seam
    cCtx.fillStyle = '#180d06';
    cCtx.fillRect(0, py, size, 5);
    bCtx.fillStyle = '#151515';
    bCtx.fillRect(0, py, size, 5);

    // Fine wood grain fibers
    for (let g = 0; g < 65; g++) {
      const gy = py + 6 + rand() * (plankH - 12);
      const alpha = 0.08 + rand() * 0.16;
      cCtx.strokeStyle = rand() > 0.3 ? `rgba(22, 11, 4, ${alpha})` : `rgba(175, 125, 78, ${alpha})`;
      cCtx.lineWidth = 1 + rand() * 2.5;
      cCtx.beginPath();
      cCtx.moveTo(0, gy);
      cCtx.bezierCurveTo(
        size * 0.33,
        gy + (rand() - 0.5) * 14,
        size * 0.66,
        gy + (rand() - 0.5) * 14,
        size,
        gy + (rand() - 0.5) * 8
      );
      cCtx.stroke();

      bCtx.strokeStyle = rand() > 0.5 ? 'rgba(115,115,115,0.35)' : 'rgba(225,225,225,0.3)';
      bCtx.lineWidth = 1.5;
      bCtx.beginPath();
      bCtx.moveTo(0, gy);
      bCtx.lineTo(size, gy);
      bCtx.stroke();
    }

    // Iron bolt studs at plank ends
    [40, size - 40].forEach((bx) => {
      cCtx.fillStyle = '#1f2937';
      cCtx.beginPath();
      cCtx.arc(bx, py + plankH * 0.5, 6, 0, Math.PI * 2);
      cCtx.fill();
      bCtx.fillStyle = '#ffffff';
      bCtx.beginPath();
      bCtx.arc(bx, py + plankH * 0.5, 6, 0, Math.PI * 2);
      bCtx.fill();
      rCtx.fillStyle = '#555555';
      rCtx.beginPath();
      rCtx.arc(bx, py + plankH * 0.5, 7, 0, Math.PI * 2);
      rCtx.fill();
    });
  }

  const normalCanvas = buildNormalCanvasFromHeight(bumpCanvas, 2.4);
  return {
    map: configureRepeatingTexture(colorCanvas, repeatX, repeatY, true, anisotropy),
    normalMap: configureRepeatingTexture(normalCanvas, repeatX, repeatY, false, anisotropy),
    roughnessMap: configureRepeatingTexture(roughCanvas, repeatX, repeatY, false, anisotropy),
    bumpMap: configureRepeatingTexture(bumpCanvas, repeatX, repeatY, false, anisotropy),
  };
}

/**
 * 1024px Alpine Earth, Moss & Gravel PBR detail texture (tints cleanly with terrain vertexColors).
 */
export function createAlpineEarthTextures(
  repeatX: number = 28,
  repeatY: number = 28,
  anisotropy: number = 16
): PbrTextureSet {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = roughCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = roughCanvas.height = size;

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;
  const rand = makeSeededRandom(4409);

  cCtx.fillStyle = '#dcdcdc';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#e8e8e8';
  rCtx.fillRect(0, 0, size, size);

  // Soft soil patches
  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 10 + rand() * 34;
    const shade = 185 + Math.floor((rand() - 0.5) * 65);
    cCtx.fillStyle = `rgba(${shade}, ${shade + 4}, ${shade - 4}, 0.24)`;
    cCtx.beginPath();
    cCtx.arc(x, y, rad, 0, Math.PI * 2);
    cCtx.fill();

    const bShade = 110 + Math.floor((rand() - 0.5) * 85);
    bCtx.fillStyle = `rgba(${bShade}, ${bShade}, ${bShade}, 0.25)`;
    bCtx.beginPath();
    bCtx.arc(x, y, rad, 0, Math.PI * 2);
    bCtx.fill();
  }

  // Sharp micro pebbles & organic grass fiber grain
  for (let i = 0; i < 6500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 3.8;
    const dark = rand() > 0.48;
    cCtx.fillStyle = dark ? 'rgba(62, 58, 52, 0.34)' : 'rgba(255, 255, 250, 0.26)';
    cCtx.beginPath();
    cCtx.arc(x, y, r, 0, Math.PI * 2);
    cCtx.fill();

    bCtx.fillStyle = dark ? 'rgba(30, 30, 30, 0.38)' : 'rgba(240, 240, 240, 0.38)';
    bCtx.beginPath();
    bCtx.arc(x, y, r, 0, Math.PI * 2);
    bCtx.fill();
  }

  const normalCanvas = buildNormalCanvasFromHeight(bumpCanvas, 2.2);
  return {
    map: configureRepeatingTexture(colorCanvas, repeatX, repeatY, true, anisotropy),
    normalMap: configureRepeatingTexture(normalCanvas, repeatX, repeatY, false, anisotropy),
    roughnessMap: configureRepeatingTexture(roughCanvas, repeatX, repeatY, false, anisotropy),
    bumpMap: configureRepeatingTexture(bumpCanvas, repeatX, repeatY, false, anisotropy),
  };
}

/**
 * Furrowed Conifer Pine Bark texture set.
 */
export function createBarkTextures(anisotropy: number = 16): PbrTextureSet {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = roughCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = roughCanvas.height = size;

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;
  const rand = makeSeededRandom(881);

  cCtx.fillStyle = '#3a2417';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#606060';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#ececec';
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 360; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 4 + rand() * 14;
    const h = 36 + rand() * 96;
    const dark = rand() > 0.5;
    cCtx.fillStyle = dark ? 'rgba(20, 12, 7, 0.52)' : 'rgba(98, 66, 44, 0.42)';
    cCtx.fillRect(x, y, w, h);

    bCtx.fillStyle = dark ? 'rgba(22, 22, 22, 0.55)' : 'rgba(218, 218, 218, 0.5)';
    bCtx.fillRect(x, y, w, h);
  }

  const normalCanvas = buildNormalCanvasFromHeight(bumpCanvas, 2.8);
  return {
    map: configureRepeatingTexture(colorCanvas, 2, 4, true, anisotropy),
    normalMap: configureRepeatingTexture(normalCanvas, 2, 4, false, anisotropy),
    roughnessMap: configureRepeatingTexture(roughCanvas, 2, 4, false, anisotropy),
    bumpMap: configureRepeatingTexture(bumpCanvas, 2, 4, false, anisotropy),
  };
}

/**
 * Stratified Granite & Glacier Cliff Strata for 360° Mountain Ring.
 */
export function createMountainRockTextures(
  repeatX: number = 14,
  repeatY: number = 2,
  anisotropy: number = 16
): PbrTextureSet {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = roughCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = roughCanvas.height = size;

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;
  const rand = makeSeededRandom(5501);

  cCtx.fillStyle = '#cfcfcf';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#dcdcdc';
  rCtx.fillRect(0, 0, size, size);

  // Diagonal geological rock strata
  for (let i = 0; i < 220; i++) {
    const x1 = rand() * size;
    const y1 = rand() * size;
    const len = 60 + rand() * 180;
    const ang = -0.35 + (rand() - 0.5) * 0.25;
    const dark = rand() > 0.45;
    cCtx.strokeStyle = dark ? 'rgba(30, 36, 46, 0.3)' : 'rgba(245, 248, 255, 0.25)';
    cCtx.lineWidth = 3 + rand() * 10;
    cCtx.beginPath();
    cCtx.moveTo(x1, y1);
    cCtx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
    cCtx.stroke();

    bCtx.strokeStyle = dark ? 'rgba(35,35,35,0.45)' : 'rgba(230,230,230,0.4)';
    bCtx.lineWidth = 4 + rand() * 10;
    bCtx.beginPath();
    bCtx.moveTo(x1, y1);
    bCtx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
    bCtx.stroke();
  }

  const normalCanvas = buildNormalCanvasFromHeight(bumpCanvas, 3.4);
  return {
    map: configureRepeatingTexture(colorCanvas, repeatX, repeatY, true, anisotropy),
    normalMap: configureRepeatingTexture(normalCanvas, repeatX, repeatY, false, anisotropy),
    roughnessMap: configureRepeatingTexture(roughCanvas, repeatX, repeatY, false, anisotropy),
    bumpMap: configureRepeatingTexture(bumpCanvas, repeatX, repeatY, false, anisotropy),
  };
}

/**
 * Animated Alpine Stream Normal Map.
 */
export function createWaterNormalTexture(
  repeatX: number = 3,
  repeatY: number = 18,
  anisotropy: number = 16
): THREE.CanvasTexture {
  const size = 512;
  const hCanvas = document.createElement('canvas');
  hCanvas.width = hCanvas.height = size;
  const hCtx = hCanvas.getContext('2d')!;
  const img = hCtx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const wave =
        Math.sin(u * 4 + v * 3) * 0.35 +
        Math.cos(u * 7 - v * 5) * 0.25 +
        Math.sin(u * 13 + v * 11) * 0.15;
      const val = Math.round((wave * 0.5 + 0.5) * 255);
      const idx = (y * size + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  hCtx.putImageData(img, 0, 0);
  const normalCanvas = buildNormalCanvasFromHeight(hCanvas, 2.2);
  return configureRepeatingTexture(normalCanvas, repeatX, repeatY, false, anisotropy);
}

/**
 * Soft radial glow sprite for floating seasonal dust, pollen, snow & ember particles.
 */
export function createParticleSoftSprite(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.72)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
