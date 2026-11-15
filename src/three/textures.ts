import * as THREE from 'three';
import { TyreCompound, WeatherMode } from '../types/racing';

export interface ProceduralTextureSet {
  asphaltMap: THREE.CanvasTexture;
  asphaltNormalMap: THREE.CanvasTexture;
  asphaltRoughnessMap: THREE.CanvasTexture;
  bodyRoughnessMap: THREE.CanvasTexture;
  carAoMap: THREE.CanvasTexture;
  kerbMap: THREE.CanvasTexture;
  carbonMap: THREE.CanvasTexture;
  carbonNormalMap: THREE.CanvasTexture;
  paintFlakeNormalMap: THREE.CanvasTexture;
  tyreTreadNormalMap: THREE.CanvasTexture;
  brakeDiscMap: THREE.CanvasTexture;
  gridFinishMap: THREE.CanvasTexture;
  gridBoxMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  groundGrassMap: THREE.CanvasTexture;
  gravelMap: THREE.CanvasTexture;
  skyDomeMap: THREE.CanvasTexture;
  brakeBoardTextures: THREE.CanvasTexture[];
  sponsorBoardMap: THREE.CanvasTexture;
  bridgeBannerMap: THREE.CanvasTexture;
  crowdMap: THREE.CanvasTexture;
  pitGarageMap: THREE.CanvasTexture;
  timingTowerMap: THREE.CanvasTexture;
  fenceAlphaMap: THREE.CanvasTexture;
  marshalPanelMap: THREE.CanvasTexture;
  smokeSpriteMap: THREE.CanvasTexture;
  sparkSpriteMap: THREE.CanvasTexture;
  rainSpriteMap: THREE.CanvasTexture;
  oilSpillMap: THREE.CanvasTexture;
  desertSandMap: THREE.CanvasTexture;
  skyscraperGlassMap: THREE.CanvasTexture;
  skyscraperEmissiveMap: THREE.CanvasTexture;
  rivieraFacadeMap: THREE.CanvasTexture;
  jumbotronMap: THREE.CanvasTexture;
  flagBannerMap: THREE.CanvasTexture;
  drsBoardMap: THREE.CanvasTexture;
  drsDetBoardMap: THREE.CanvasTexture;
  dispose: () => void;
}

const PIRELLI_COMPOUND_HEX: Record<TyreCompound, string> = {
  soft: '#EF4444',
  medium: '#F59E0B',
  hard: '#F8FAFC',
  wet: '#38BDF8',
};

export function createPirelliSidewallTexture(compound: TyreCompound): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext('2d')!;
  const cx = 512;
  const cy = 512;

  // Base vulcanized sidewall rubber with subtle radial molding ribs & micro-knurling
  ctx.fillStyle = '#101319';
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(255,255,255,0.055)';
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 310, Math.sin(a) * 310);
    ctx.lineTo(Math.cos(a) * 488, Math.sin(a) * 488);
    ctx.stroke();
  }

  // Concentric vulcanized mold rings
  for (const r of [328, 356, 442, 474]) {
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const col = PIRELLI_COMPOUND_HEX[compound];

  // Signature twin Pirelli compound arcs with subtle outer glow
  ctx.strokeStyle = col;
  ctx.lineWidth = 30;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, 396, -Math.PI * 0.28, Math.PI * 0.28);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 396, Math.PI * 0.72, Math.PI * 1.28);
  ctx.stroke();

  // Inner fine technical bead line
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.34)';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(0, 0, 340, 0, Math.PI * 2);
  ctx.stroke();

  // Curved "PIRELLI" top arc & "P ZERO" bottom arc lettering
  const drawArcText = (text: string, radius: number, startAngle: number, stepAngle: number, color: string) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = 'italic 900 56px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < text.length; i++) {
      const ang = startAngle + i * stepAngle;
      ctx.save();
      ctx.rotate(ang);
      ctx.translate(0, -radius);
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  };

  drawArcText('PIRELLI', 396, -0.45, 0.15, col);
  drawArcText('P ZERO', 396, Math.PI - 0.38, 0.15, '#F8FAFC');
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createNumberDecalTexture(numText: string, accentHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 512);

  ctx.fillStyle = accentHex;
  ctx.beginPath();
  ctx.roundRect(48, 88, 416, 336, 52);
  ctx.fill();

  ctx.fillStyle = '#090B0F';
  ctx.beginPath();
  ctx.roundRect(68, 108, 376, 296, 40);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.24)';
  ctx.lineWidth = 6;
  ctx.strokeRect(84, 124, 344, 264);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'italic bold 236px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numText, 256, 268);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createProceduralTextures(
  maxAnisotropy: number,
  kerbA = '#DC2626',
  kerbB = '#F8FAFC',
  weather: WeatherMode = 'day'
): ProceduralTextureSet {
  // 1. Ultra-Resolution 4K-Grade Asphalt Albedo (2048x2048) with micro-aggregate stones, tar seams, rubbered racing groove & crisp FIA lines
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 2048;
  asphaltCanvas.height = 2048;
  const actx = asphaltCanvas.getContext('2d')!;
  actx.fillStyle = '#1a1e26';
  actx.fillRect(0, 0, 2048, 2048);

  const groove = actx.createLinearGradient(0, 0, 2048, 0);
  groove.addColorStop(0, 'rgba(28,30,36,0.0)');
  groove.addColorStop(0.24, 'rgba(6,8,12,0.32)');
  groove.addColorStop(0.5, 'rgba(14,16,22,0.14)');
  groove.addColorStop(0.76, 'rgba(6,8,12,0.32)');
  groove.addColorStop(1, 'rgba(28,30,36,0.0)');
  actx.fillStyle = groove;
  actx.fillRect(0, 0, 2048, 2048);

  // Ultra-fine mineral aggregate stone grain & crystalline quartz granite specs
  for (let i = 0; i < 210000; i++) {
    const x = Math.random() * 2048;
    const y = Math.random() * 2048;
    const v = 20 + Math.floor(Math.random() * 62);
    actx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    actx.fillRect(x, y, 2, 2);
  }

  // Longitudinal laser-screeded asphalt paving micro-striations
  actx.fillStyle = 'rgba(8, 10, 14, 0.16)';
  for (let s = 0; s < 180; s++) {
    const sx = 64 + Math.random() * 1920;
    actx.fillRect(sx, 0, 1 + Math.random() * 2.2, 2048);
  }

  // Realistic hairline asphalt cracks & glossy tar overband repairs
  actx.strokeStyle = 'rgba(5, 7, 10, 0.78)';
  actx.lineWidth = 2.4;
  for (let c = 0; c < 42; c++) {
    let cx = 120 + Math.random() * 1808;
    let cy = Math.random() * 2048;
    actx.beginPath();
    actx.moveTo(cx, cy);
    for (let s = 0; s < 14; s++) {
      cx += (Math.random() - 0.5) * 56;
      cy += 22 + Math.random() * 44;
      actx.lineTo(cx, cy);
    }
    actx.stroke();
  }

  // Faint initial rubber skid marks along braking/acceleration zones
  for (let s = 0; s < 48; s++) {
    const sx = (s % 2 === 0 ? 500 : 1380) + (Math.random() - 0.5) * 240;
    const sy = Math.random() * 1800;
    actx.fillStyle = 'rgba(4, 5, 8, 0.26)';
    actx.fillRect(sx, sy, 5 + Math.random() * 6, 70 + Math.random() * 160);
  }

  // Rubber marbling off the racing line
  for (let m = 0; m < 3200; m++) {
    const side = Math.random() > 0.5 ? 96 + Math.random() * 176 : 1776 + Math.random() * 176;
    actx.fillStyle = 'rgba(5,6,9,0.68)';
    actx.fillRect(side, Math.random() * 2048, 5, 9);
  }

  // Crisp FIA white track boundary lines
  actx.fillStyle = '#F8FAFC';
  actx.fillRect(40, 0, 36, 2048);
  actx.fillRect(1972, 0, 36, 2048);

  const asphaltMap = new THREE.CanvasTexture(asphaltCanvas);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  asphaltMap.wrapS = THREE.ClampToEdgeWrapping;
  asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.repeat.set(1, 78);
  asphaltMap.anisotropy = maxAnisotropy;

  // 2. High-Definition Multi-Octave Asphalt Normal Map (1024x1024)
  // Synthesizes true multi-octave tangent normals for basalt aggregates, bitumen seams, and micro-quartz facets
  const normCanvas = document.createElement('canvas');
  normCanvas.width = 1024;
  normCanvas.height = 1024;
  const nctx = normCanvas.getContext('2d')!;
  const nImg = nctx.createImageData(1024, 1024);
  const nSize = 1024;
  const hMap = new Float32Array(nSize * nSize);

  // Multi-frequency heightfield synthesis (4 procedural octaves)
  for (let y = 0; y < nSize; y++) {
    const rowOffset = y * nSize;
    const normY = y / nSize;
    for (let x = 0; x < nSize; x++) {
      const normX = x / nSize;
      // Octave 0: Macro road undulations & bitumen seams
      const oct0 = Math.sin(normX * 24.0) * Math.cos(normY * 24.0) * 0.32 +
                   Math.sin((normX + normY) * 16.0) * 0.16;
      // Octave 1: Granite stone chip aggregate (medium frequency)
      const oct1 = Math.sin(normX * 120.0 + Math.cos(normY * 90.0) * 2.2) * Math.cos(normY * 120.0) * 0.24;
      // Octave 2: Crushed basalt chip facets (fine frequency)
      const oct2 = Math.sin(normX * 360.0) * Math.sin(normY * 360.0) * 0.16 +
                   Math.cos(normX * 480.0 - normY * 240.0) * 0.10;
      // Octave 3: High-frequency crystalline quartz micro-roughness
      const hash = ((x * 1597334677) ^ (y * 3812015801)) >>> 0;
      const microNoise = (hash / 4294967296.0 - 0.5) * 0.14;

      hMap[rowOffset + x] = oct0 + oct1 + oct2 + microNoise;
    }
  }

  // Central-difference Sobel filter: Tangent-Space Normal Vector [Nx, Ny, Nz]
  const nStrength = 2.8;
  for (let y = 0; y < nSize; y++) {
    const rowOffset = y * nSize;
    const yPrev = ((y - 1 + nSize) % nSize) * nSize;
    const yNext = ((y + 1) % nSize) * nSize;
    for (let x = 0; x < nSize; x++) {
      const xPrev = (x - 1 + nSize) % nSize;
      const xNext = (x + 1) % nSize;

      const dX = (hMap[rowOffset + xNext] - hMap[rowOffset + xPrev]) * nStrength;
      const dY = (hMap[yNext + x] - hMap[yPrev + x]) * nStrength;

      const len = Math.hypot(-dX, -dY, 1.0);
      const nx = -dX / len;
      const ny = -dY / len;
      const nz = 1.0 / len;

      const pixelIdx = (rowOffset + x) * 4;
      nImg.data[pixelIdx] = Math.round((nx * 0.5 + 0.5) * 255);
      nImg.data[pixelIdx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nImg.data[pixelIdx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nImg.data[pixelIdx + 3] = 255;
    }
  }
  nctx.putImageData(nImg, 0, 0);
  const asphaltNormalMap = new THREE.CanvasTexture(normCanvas);
  asphaltNormalMap.wrapS = THREE.RepeatWrapping;
  asphaltNormalMap.wrapT = THREE.RepeatWrapping;
  asphaltNormalMap.repeat.set(4, 150);
  asphaltNormalMap.anisotropy = maxAnisotropy;

  // 3. High-Precision 1024x1024 Asphalt Roughness Map (standing puddles in Rain, polished groove in Dry)
  const isRain = weather === 'rain' || weather === 'heavy_rain';
  const isSunset = weather === 'sunset';
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 1024;
  roughCanvas.height = 1024;
  const rctx = roughCanvas.getContext('2d')!;
  rctx.fillStyle = isRain
    ? weather === 'heavy_rain'
      ? 'rgb(36,36,36)'
      : 'rgb(56,56,56)'
    : isSunset
      ? 'rgb(142,142,142)'
      : 'rgb(184,184,184)';
  rctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 56000; i++) {
    const base = isRain ? (weather === 'heavy_rain' ? 12 : 20) : isSunset ? 102 : 136;
    const v = base + Math.floor(Math.random() * 76);
    rctx.fillStyle = `rgb(${v},${v},${v})`;
    rctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
  }
  if (isRain) {
    const puddleCount = weather === 'heavy_rain' ? 110 : 76;
    for (let p = 0; p < puddleCount; p++) {
      const px = Math.random() * 1024;
      const py = Math.random() * 1024;
      const pr = 36 + Math.random() * (weather === 'heavy_rain' ? 148 : 116);
      const pg = rctx.createRadialGradient(px, py, 6, px, py, pr);
      pg.addColorStop(0, 'rgba(2,2,2,0.99)');
      pg.addColorStop(0.65, 'rgba(14,14,14,0.82)');
      pg.addColorStop(1, 'rgba(56,56,56,0)');
      rctx.fillStyle = pg;
      rctx.beginPath();
      rctx.arc(px, py, pr, 0, Math.PI * 2);
      rctx.fill();
    }
  } else {
    const grooveRough = rctx.createLinearGradient(0, 0, 1024, 0);
    grooveRough.addColorStop(0, 'rgba(200,200,200,0)');
    grooveRough.addColorStop(0.24, isSunset ? 'rgba(72,72,72,0.62)' : 'rgba(116,116,116,0.52)');
    grooveRough.addColorStop(0.76, isSunset ? 'rgba(72,72,72,0.62)' : 'rgba(116,116,116,0.52)');
    grooveRough.addColorStop(1, 'rgba(200,200,200,0)');
    rctx.fillStyle = grooveRough;
    rctx.fillRect(0, 0, 1024, 1024);
  }
  const asphaltRoughnessMap = new THREE.CanvasTexture(roughCanvas);
  asphaltRoughnessMap.wrapS = THREE.ClampToEdgeWrapping;
  asphaltRoughnessMap.wrapT = THREE.RepeatWrapping;
  asphaltRoughnessMap.repeat.set(1, 78);
  asphaltRoughnessMap.anisotropy = maxAnisotropy;

  // 4. FIA Serrated Kerb Map with beveled concrete seam lines & rubber tire scuff marks (512x1024)
  const kerbCanvas = document.createElement('canvas');
  kerbCanvas.width = 512;
  kerbCanvas.height = 1024;
  const kctx = kerbCanvas.getContext('2d')!;
  kctx.fillStyle = kerbA;
  kctx.fillRect(0, 0, 512, 512);
  kctx.fillStyle = kerbB;
  kctx.fillRect(0, 512, 512, 512);
  // Serrated rumble-strip bevel shading
  for (let y = 0; y < 1024; y += 64) {
    const rGrad = kctx.createLinearGradient(0, y, 0, y + 64);
    rGrad.addColorStop(0, 'rgba(255,255,255,0.22)');
    rGrad.addColorStop(0.68, 'rgba(0,0,0,0.0)');
    rGrad.addColorStop(1, 'rgba(0,0,0,0.34)');
    kctx.fillStyle = rGrad;
    kctx.fillRect(0, y, 512, 64);
  }
  // Longitudinal vulcanized tire scuff streaks along the inside kerb edge
  const scuffGrad = kctx.createLinearGradient(0, 0, 512, 0);
  scuffGrad.addColorStop(0, 'rgba(10,12,16,0.42)');
  scuffGrad.addColorStop(0.35, 'rgba(10,12,16,0.16)');
  scuffGrad.addColorStop(1, 'rgba(10,12,16,0.0)');
  kctx.fillStyle = scuffGrad;
  kctx.fillRect(0, 0, 512, 1024);

  kctx.fillStyle = 'rgba(0,0,0,0.42)';
  kctx.fillRect(0, 496, 512, 28);
  kctx.fillRect(0, 0, 512, 14);
  for (let i = 0; i < 3600; i++) {
    kctx.fillStyle = 'rgba(0,0,0,0.10)';
    kctx.fillRect(Math.random() * 512, Math.random() * 1024, 4, 4);
  }

  const kerbMap = new THREE.CanvasTexture(kerbCanvas);
  kerbMap.colorSpace = THREE.SRGBColorSpace;
  kerbMap.wrapS = THREE.RepeatWrapping;
  kerbMap.wrapT = THREE.RepeatWrapping;
  kerbMap.repeat.set(1, 145);
  kerbMap.anisotropy = maxAnisotropy;

  // 5. Ultra-Detailed 2x2 Twill Carbon Fiber + High-Res Normal Map (1024x1024 for 8K Close-Ups)
  const carbonCanvas = document.createElement('canvas');
  carbonCanvas.width = 1024;
  carbonCanvas.height = 1024;
  const cctx = carbonCanvas.getContext('2d')!;
  cctx.fillStyle = '#0a0d13';
  cctx.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 16) {
    for (let x = 0; x < 1024; x += 16) {
      const shift = ((y / 16) % 4) * 8;
      const gx = (x + shift) % 1024;
      const g1 = cctx.createLinearGradient(gx, y, gx + 8, y + 8);
      g1.addColorStop(0, '#465066');
      g1.addColorStop(0.5, '#2b3342');
      g1.addColorStop(1, '#10141c');
      cctx.fillStyle = g1;
      cctx.fillRect(gx, y, 8, 8);

      // Micro-filament specular thread highlight
      cctx.fillStyle = 'rgba(255,255,255,0.13)';
      cctx.fillRect(gx + 2, y, 2, 8);

      const gx2 = (gx + 8) % 1024;
      const g2 = cctx.createLinearGradient(gx2, y + 8, gx2 + 8, y + 16);
      g2.addColorStop(0, '#283040');
      g2.addColorStop(1, '#0d1017');
      cctx.fillStyle = g2;
      cctx.fillRect(gx2, y + 8, 8, 8);
    }
  }
  const carbonMap = new THREE.CanvasTexture(carbonCanvas);
  carbonMap.colorSpace = THREE.SRGBColorSpace;
  carbonMap.wrapS = THREE.RepeatWrapping;
  carbonMap.wrapT = THREE.RepeatWrapping;
  carbonMap.repeat.set(24, 24);
  carbonMap.anisotropy = maxAnisotropy;

  const cNormCanvas = document.createElement('canvas');
  cNormCanvas.width = 1024;
  cNormCanvas.height = 1024;
  const cnctx = cNormCanvas.getContext('2d')!;
  cnctx.fillStyle = 'rgb(128,128,255)';
  cnctx.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 16) {
    for (let x = 0; x < 1024; x += 16) {
      const shift = ((y / 16) % 4) * 8;
      const gx = (x + shift) % 1024;
      cnctx.fillStyle = 'rgb(196,122,232)';
      cnctx.fillRect(gx, y, 8, 8);
      cnctx.fillStyle = 'rgb(122,196,232)';
      cnctx.fillRect((gx + 8) % 1024, y + 8, 8, 8);
    }
  }
  const carbonNormalMap = new THREE.CanvasTexture(cNormCanvas);
  carbonNormalMap.wrapS = THREE.RepeatWrapping;
  carbonNormalMap.wrapT = THREE.RepeatWrapping;
  carbonNormalMap.repeat.set(24, 24);
  carbonNormalMap.anisotropy = maxAnisotropy;

  // 5b. Metallic Paint Flake & Clearcoat Micro-Polish Normal Map (1024x1024)
  const flakeCanvas = document.createElement('canvas');
  flakeCanvas.width = 1024;
  flakeCanvas.height = 1024;
  const flCtx = flakeCanvas.getContext('2d')!;
  const flImg = flCtx.createImageData(1024, 1024);
  for (let i = 0; i < 1024 * 1024; i++) {
    flImg.data[i * 4] = 128 + (Math.random() - 0.5) * 28;
    flImg.data[i * 4 + 1] = 128 + (Math.random() - 0.5) * 28;
    flImg.data[i * 4 + 2] = 248;
    flImg.data[i * 4 + 3] = 255;
  }
  flCtx.putImageData(flImg, 0, 0);
  flCtx.strokeStyle = 'rgba(138, 124, 250, 0.28)';
  flCtx.lineWidth = 1.2;
  for (let s = 0; s < 110; s++) {
    const sx = Math.random() * 1024;
    const sy = Math.random() * 1024;
    flCtx.beginPath();
    flCtx.moveTo(sx, sy);
    flCtx.lineTo(sx + (Math.random() - 0.5) * 68, sy + (Math.random() - 0.5) * 24);
    flCtx.stroke();
  }
  const paintFlakeNormalMap = new THREE.CanvasTexture(flakeCanvas);
  paintFlakeNormalMap.wrapS = THREE.RepeatWrapping;
  paintFlakeNormalMap.wrapT = THREE.RepeatWrapping;
  paintFlakeNormalMap.repeat.set(24, 24);
  paintFlakeNormalMap.anisotropy = maxAnisotropy;

  // 5c. High-Res Tyre Tread, Drainage Grooves & Grained Racing Rubber Normal Map (512x512)
  const tyreNormCanvas = document.createElement('canvas');
  tyreNormCanvas.width = 512;
  tyreNormCanvas.height = 512;
  const tnCtx = tyreNormCanvas.getContext('2d')!;
  tnCtx.fillStyle = 'rgb(128,128,255)';
  tnCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18000; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    tnCtx.fillStyle = Math.random() > 0.5 ? 'rgb(148,128,242)' : 'rgb(108,128,242)';
    tnCtx.fillRect(rx, ry, 2, 2);
  }
  // Circumferential mold seam & deep water evacuation channels
  tnCtx.fillStyle = 'rgb(128,162,236)';
  tnCtx.fillRect(252, 0, 6, 512);
  for (const gx of [118, 204, 308, 394]) {
    tnCtx.fillStyle = isRain ? 'rgb(96,64,196)' : 'rgb(122,118,238)';
    tnCtx.fillRect(gx - 8, 0, 16, 512);
    tnCtx.fillStyle = 'rgb(168,148,242)';
    tnCtx.fillRect(gx + 8, 0, 3, 512);
  }
  if (isRain) {
    for (let y = 0; y < 512; y += 32) {
      tnCtx.strokeStyle = 'rgb(184,124,214)';
      tnCtx.lineWidth = 7;
      tnCtx.beginPath();
      tnCtx.moveTo(0, y);
      tnCtx.lineTo(114, y + 28);
      tnCtx.moveTo(512, y);
      tnCtx.lineTo(398, y + 28);
      tnCtx.stroke();
    }
  }
  const tyreTreadNormalMap = new THREE.CanvasTexture(tyreNormCanvas);
  tyreTreadNormalMap.wrapS = THREE.RepeatWrapping;
  tyreTreadNormalMap.wrapT = THREE.RepeatWrapping;
  tyreTreadNormalMap.repeat.set(1, 8);
  tyreTreadNormalMap.anisotropy = maxAnisotropy;

  // 5d. Ultra High-Res Slotted & Cross-Drilled Carbon-Ceramic Brake Rotor Texture (1024x1024)
  const discCanvas = document.createElement('canvas');
  discCanvas.width = 1024;
  discCanvas.height = 1024;
  const dCtx = discCanvas.getContext('2d')!;
  dCtx.fillStyle = '#242830';
  dCtx.fillRect(0, 0, 1024, 1024);

  // Micro-grooved concentric pad-friction wear tracks
  for (let r = 236; r <= 488; r += 8) {
    dCtx.strokeStyle = (r % 16 === 0) ? 'rgba(8,10,14,0.72)' : 'rgba(255,255,255,0.075)';
    dCtx.lineWidth = 2.4;
    dCtx.beginPath();
    dCtx.arc(512, 512, r, 0, Math.PI * 2);
    dCtx.stroke();
  }

  // Curved radial aerodynamic gas-ventilation channels (Brembo F1 Spec)
  dCtx.strokeStyle = 'rgba(8, 10, 14, 0.94)';
  dCtx.lineWidth = 5.5;
  for (let s = 0; s < 36; s++) {
    const sAng = (s / 36) * Math.PI * 2;
    dCtx.beginPath();
    const rStart = 264;
    const rEnd = 480;
    dCtx.moveTo(512 + Math.cos(sAng) * rStart, 512 + Math.sin(sAng) * rStart);
    dCtx.quadraticCurveTo(
      512 + Math.cos(sAng + 0.18) * 372,
      512 + Math.sin(sAng + 0.18) * 372,
      512 + Math.cos(sAng + 0.32) * rEnd,
      512 + Math.sin(sAng + 0.32) * rEnd
    );
    dCtx.stroke();
  }

  // Cross-drilled micro-ventilation cooling holes across rotor face
  dCtx.fillStyle = '#07090d';
  for (let a = 0; a < 32; a++) {
    const baseAngle = (a / 32) * Math.PI * 2;
    for (let ring = 0; ring < 5; ring++) {
      const rad = 272 + ring * 44;
      const ang = baseAngle + ring * 0.14;
      dCtx.beginPath();
      dCtx.arc(512 + Math.cos(ang) * rad, 512 + Math.sin(ang) * rad, 8.2, 0, Math.PI * 2);
      dCtx.fill();

      // Chamfered carbon hole ring highlight
      dCtx.strokeStyle = 'rgba(255,255,255,0.16)';
      dCtx.lineWidth = 1.8;
      dCtx.stroke();
    }
  }

  // Inner floating aluminum/titanium hat bobbins
  for (let b = 0; b < 12; b++) {
    const bAng = (b / 12) * Math.PI * 2;
    dCtx.fillStyle = '#64748b';
    dCtx.beginPath();
    dCtx.arc(512 + Math.cos(bAng) * 232, 512 + Math.sin(bAng) * 232, 14, 0, Math.PI * 2);
    dCtx.fill();
    dCtx.fillStyle = '#0f172a';
    dCtx.beginPath();
    dCtx.arc(512 + Math.cos(bAng) * 232, 512 + Math.sin(bAng) * 232, 6.2, 0, Math.PI * 2);
    dCtx.fill();
  }

  const brakeDiscMap = new THREE.CanvasTexture(discCanvas);
  brakeDiscMap.colorSpace = THREE.SRGBColorSpace;
  brakeDiscMap.anisotropy = maxAnisotropy;

  // 6. Chequered Start/Finish Line & Painted Starting Grid Box
  const finishCanvas = document.createElement('canvas');
  finishCanvas.width = 512;
  finishCanvas.height = 128;
  const fctx = finishCanvas.getContext('2d')!;
  const sq = 32;
  for (let y = 0; y < 128; y += sq) {
    for (let x = 0; x < 512; x += sq) {
      fctx.fillStyle = (x / sq + y / sq) % 2 === 0 ? '#F8FAFC' : '#111318';
      fctx.fillRect(x, y, sq, sq);
    }
  }
  const gridFinishMap = new THREE.CanvasTexture(finishCanvas);
  gridFinishMap.colorSpace = THREE.SRGBColorSpace;
  gridFinishMap.anisotropy = maxAnisotropy;

  const boxCanvas = document.createElement('canvas');
  boxCanvas.width = 128;
  boxCanvas.height = 256;
  const bCtx = boxCanvas.getContext('2d')!;
  bCtx.clearRect(0, 0, 128, 256);
  bCtx.fillStyle = '#F8FAFC';
  bCtx.fillRect(10, 12, 108, 14);
  bCtx.fillRect(10, 12, 12, 120);
  bCtx.fillRect(106, 12, 12, 120);
  const gridBoxMap = new THREE.CanvasTexture(boxCanvas);
  gridBoxMap.colorSpace = THREE.SRGBColorSpace;
  gridBoxMap.anisotropy = maxAnisotropy;

  // 7. Radial Contact Shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(128, 128, 18, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0,0,0,0.92)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.48)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 256, 256);
  const contactShadowMap = new THREE.CanvasTexture(shadowCanvas);

  // 8. Ground Turf & Runoff Gravel (16K-Scale Procedural Detail)
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 1024;
  grassCanvas.height = 1024;
  const gctx = grassCanvas.getContext('2d')!;
  gctx.fillStyle = '#213322';
  gctx.fillRect(0, 0, 1024, 1024);

  // Deep fertile soil and root moisture variation
  for (let i = 0; i < 48; i++) {
    const rx = Math.random() * 1024;
    const ry = Math.random() * 1024;
    const rad = 45 + Math.random() * 110;
    const sg = gctx.createRadialGradient(rx, ry, 5, rx, ry, rad);
    sg.addColorStop(0, 'rgba(24, 38, 22, 0.45)');
    sg.addColorStop(1, 'rgba(33, 51, 34, 0)');
    gctx.fillStyle = sg;
    gctx.beginPath();
    gctx.arc(rx, ry, rad, 0, Math.PI * 2);
    gctx.fill();
  }

  // Multi-tone lush turf blades and meadow clover micro-stippling
  const turfColors = ['#1d2e1e', '#253d26', '#2d4b2e', '#355936', '#3e6640', '#182719'];
  for (let i = 0; i < 85000; i++) {
    gctx.fillStyle = turfColors[i % turfColors.length];
    gctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 3);
  }
  const groundGrassMap = new THREE.CanvasTexture(grassCanvas);
  groundGrassMap.colorSpace = THREE.SRGBColorSpace;
  groundGrassMap.wrapS = THREE.RepeatWrapping;
  groundGrassMap.wrapT = THREE.RepeatWrapping;
  groundGrassMap.repeat.set(85, 85);
  groundGrassMap.anisotropy = maxAnisotropy;

  const gravelCanvas = document.createElement('canvas');
  gravelCanvas.width = 512;
  gravelCanvas.height = 512;
  const grctx = gravelCanvas.getContext('2d')!;
  grctx.fillStyle = '#554e44';
  grctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 38000; i++) {
    const shade = 64 + Math.floor(Math.random() * 68);
    grctx.fillStyle = `rgb(${shade + 10},${shade + 4},${shade - 6})`;
    grctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  const gravelMap = new THREE.CanvasTexture(gravelCanvas);
  gravelMap.colorSpace = THREE.SRGBColorSpace;
  gravelMap.wrapS = THREE.RepeatWrapping;
  gravelMap.wrapT = THREE.RepeatWrapping;
  gravelMap.repeat.set(3, 140);
  gravelMap.anisotropy = maxAnisotropy;

  // 9. Atmospheric Sky Dome Gradient (2048x1024) with Sun Halo / Volumetric Cloud Bands / Night Horizon
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 2048;
  skyCanvas.height = 1024;
  const skyCtx = skyCanvas.getContext('2d')!;
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 1024);
  if (weather === 'night') {
    skyGrad.addColorStop(0, '#02040a');
    skyGrad.addColorStop(0.5, '#081022');
    skyGrad.addColorStop(0.84, '#132038');
    skyGrad.addColorStop(1, '#090d16');
  } else if (weather === 'sunset') {
    skyGrad.addColorStop(0, '#0f172a');
    skyGrad.addColorStop(0.32, '#3b1d4a');
    skyGrad.addColorStop(0.62, '#9a3412');
    skyGrad.addColorStop(0.83, '#f59e0b');
    skyGrad.addColorStop(0.95, '#fde68a');
    skyGrad.addColorStop(1, '#7c2d12');
  } else if (weather === 'heavy_rain') {
    skyGrad.addColorStop(0, '#0f172a');
    skyGrad.addColorStop(0.45, '#1e293b');
    skyGrad.addColorStop(0.82, '#334155');
    skyGrad.addColorStop(1, '#263244');
  } else if (weather === 'rain') {
    skyGrad.addColorStop(0, '#182230');
    skyGrad.addColorStop(0.45, '#2b384a');
    skyGrad.addColorStop(0.82, '#475569');
    skyGrad.addColorStop(1, '#3b4859');
  } else if (weather === 'cloudy') {
    skyGrad.addColorStop(0, '#475569');
    skyGrad.addColorStop(0.45, '#64748b');
    skyGrad.addColorStop(0.82, '#94a3b8');
    skyGrad.addColorStop(1, '#cbd5e1');
  } else {
    skyGrad.addColorStop(0, '#1a3a8a');
    skyGrad.addColorStop(0.42, '#3b82f6');
    skyGrad.addColorStop(0.78, '#bae6fd');
    skyGrad.addColorStop(0.95, '#fef3c7');
    skyGrad.addColorStop(1, '#e0f2fe');
  }
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 2048, 1024);

  if (weather === 'night') {
    for (let i = 0; i < 840; i++) {
      skyCtx.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.75})`;
      const size = Math.random() > 0.9 ? 2.6 : 1.5;
      skyCtx.fillRect(Math.random() * 2048, Math.random() * 580, size, size);
    }
    for (let i = 0; i < 95; i++) {
      const gx = Math.random() * 2048;
      const gg = skyCtx.createRadialGradient(gx, 870, 4, gx, 870, 72);
      gg.addColorStop(0, 'rgba(56,189,248,0.18)');
      gg.addColorStop(1, 'rgba(56,189,248,0)');
      skyCtx.fillStyle = gg;
      skyCtx.fillRect(gx - 72, 800, 144, 140);
    }
  } else if (weather === 'sunset') {
    const sunHalo = skyCtx.createRadialGradient(1480, 770, 20, 1480, 770, 440);
    sunHalo.addColorStop(0, 'rgba(255,253,235,0.98)');
    sunHalo.addColorStop(0.18, 'rgba(253,224,71,0.74)');
    sunHalo.addColorStop(0.48, 'rgba(249,115,22,0.36)');
    sunHalo.addColorStop(1, 'rgba(249,115,22,0)');
    skyCtx.fillStyle = sunHalo;
    skyCtx.fillRect(1000, 320, 960, 704);

    for (let c = 0; c < 84; c++) {
      const cx = Math.random() * 2048;
      const cy = 360 + Math.random() * 380;
      const cg = skyCtx.createRadialGradient(cx, cy, 16, cx, cy, 190);
      cg.addColorStop(0, c % 2 === 0 ? 'rgba(251,146,60,0.30)' : 'rgba(124,45,18,0.28)');
      cg.addColorStop(1, 'rgba(251,146,60,0)');
      skyCtx.fillStyle = cg;
      skyCtx.fillRect(cx - 220, cy - 72, 440, 144);
    }
  } else if (weather === 'day') {
    const sunHalo = skyCtx.createRadialGradient(1380, 580, 16, 1380, 580, 350);
    sunHalo.addColorStop(0, 'rgba(255,252,232,0.96)');
    sunHalo.addColorStop(0.22, 'rgba(254,240,138,0.48)');
    sunHalo.addColorStop(1, 'rgba(254,240,138,0)');
    skyCtx.fillStyle = sunHalo;
    skyCtx.fillRect(1020, 220, 720, 720);

    for (let c = 0; c < 68; c++) {
      const cx = Math.random() * 2048;
      const cy = 380 + Math.random() * 290;
      const cg = skyCtx.createRadialGradient(cx, cy, 16, cx, cy, 165);
      cg.addColorStop(0, 'rgba(255,255,255,0.32)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      skyCtx.fillStyle = cg;
      skyCtx.fillRect(cx - 170, cy - 84, 340, 168);
    }
  } else if (weather === 'cloudy') {
    for (let c = 0; c < 92; c++) {
      const cx = Math.random() * 2048;
      const cy = 220 + Math.random() * 420;
      const cg = skyCtx.createRadialGradient(cx, cy, 22, cx, cy, 220);
      cg.addColorStop(0, 'rgba(241,245,249,0.45)');
      cg.addColorStop(1, 'rgba(241,245,249,0)');
      skyCtx.fillStyle = cg;
      skyCtx.fillRect(cx - 220, cy - 110, 440, 220);
    }
  } else {
    for (let c = 0; c < 96; c++) {
      const cx = Math.random() * 2048;
      const cy = 240 + Math.random() * 400;
      const cg = skyCtx.createRadialGradient(cx, cy, 20, cx, cy, 210);
      cg.addColorStop(0, weather === 'heavy_rain' ? 'rgba(15,23,42,0.58)' : 'rgba(30,41,59,0.46)');
      cg.addColorStop(0.55, 'rgba(71,85,105,0.22)');
      cg.addColorStop(1, 'rgba(30,41,59,0)');
      skyCtx.fillStyle = cg;
      skyCtx.fillRect(cx - 210, cy - 96, 420, 192);
    }
  }
  const skyDomeMap = new THREE.CanvasTexture(skyCanvas);
  skyDomeMap.colorSpace = THREE.SRGBColorSpace;
  skyDomeMap.anisotropy = maxAnisotropy;

  // 10. Braking Distance Marker Boards
  const brakeBoardTextures = ['150', '100', '50'].map((num) => {
    const bc = document.createElement('canvas');
    bc.width = 128;
    bc.height = 128;
    const bctx = bc.getContext('2d')!;
    bctx.fillStyle = '#f8fafc';
    bctx.fillRect(0, 0, 128, 128);
    bctx.strokeStyle = '#0f172a';
    bctx.lineWidth = 8;
    bctx.strokeRect(4, 4, 120, 120);
    bctx.fillStyle = '#dc2626';
    bctx.fillRect(8, 8, 112, 18);
    bctx.fillStyle = '#0f172a';
    bctx.font = 'bold 52px sans-serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText(num, 64, 74);
    const tex = new THREE.CanvasTexture(bc);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  });

  // 11. Trackside & Bridge Sponsor Banners
  const spCanvas = document.createElement('canvas');
  spCanvas.width = 512;
  spCanvas.height = 128;
  const spctx = spCanvas.getContext('2d')!;
  spctx.fillStyle = '#0f172a';
  spctx.fillRect(0, 0, 512, 128);
  spctx.fillStyle = '#dc2626';
  spctx.fillRect(0, 0, 140, 128);
  spctx.fillStyle = '#f8fafc';
  spctx.font = 'bold 42px sans-serif';
  spctx.textAlign = 'center';
  spctx.textBaseline = 'middle';
  spctx.fillText('APEX', 70, 64);
  spctx.fillStyle = '#f59e0b';
  spctx.font = 'bold 38px sans-serif';
  spctx.fillText('FORMULA 2026', 325, 64);
  const sponsorBoardMap = new THREE.CanvasTexture(spCanvas);
  sponsorBoardMap.colorSpace = THREE.SRGBColorSpace;
  sponsorBoardMap.anisotropy = maxAnisotropy;

  const brCanvas = document.createElement('canvas');
  brCanvas.width = 1024;
  brCanvas.height = 192;
  const brctx = brCanvas.getContext('2d')!;
  brctx.fillStyle = '#111827';
  brctx.fillRect(0, 0, 1024, 192);
  brctx.fillStyle = '#ef4444';
  brctx.fillRect(0, 0, 1024, 18);
  brctx.fillRect(0, 174, 1024, 18);
  brctx.fillStyle = '#f8fafc';
  brctx.font = 'bold 64px sans-serif';
  brctx.textAlign = 'center';
  brctx.textBaseline = 'middle';
  brctx.fillText('ULTIMATE FORMULA GP · 2026', 512, 98);
  const bridgeBannerMap = new THREE.CanvasTexture(brCanvas);
  bridgeBannerMap.colorSpace = THREE.SRGBColorSpace;
  bridgeBannerMap.anisotropy = maxAnisotropy;

  // 12. Grandstand Crowd Texture
  const crowdCanvas = document.createElement('canvas');
  crowdCanvas.width = 256;
  crowdCanvas.height = 128;
  const crCtx = crowdCanvas.getContext('2d')!;
  crCtx.fillStyle = '#334155';
  crCtx.fillRect(0, 0, 256, 128);
  const spectatorColors = ['#ef4444', '#3b82f6', '#f59e0b', '#f8fafc', '#10b981', '#e2e8f0', '#fb7185'];
  for (let row = 8; row < 124; row += 12) {
    for (let col = 4; col < 252; col += 8) {
      if (Math.random() > 0.14) {
        crCtx.fillStyle = spectatorColors[Math.floor(Math.random() * spectatorColors.length)];
        crCtx.fillRect(col, row, 5, 7);
        crCtx.fillStyle = '#e2c4a8';
        crCtx.fillRect(col + 1, row - 3, 3, 3);
      }
    }
  }
  const crowdMap = new THREE.CanvasTexture(crowdCanvas);
  crowdMap.colorSpace = THREE.SRGBColorSpace;
  crowdMap.wrapS = THREE.RepeatWrapping;
  crowdMap.wrapT = THREE.ClampToEdgeWrapping;
  crowdMap.repeat.set(6, 1);
  crowdMap.anisotropy = maxAnisotropy;

  // 13. Pit Garage Doors Texture
  const pitCanvas = document.createElement('canvas');
  pitCanvas.width = 512;
  pitCanvas.height = 128;
  const pCtx = pitCanvas.getContext('2d')!;
  pCtx.fillStyle = '#0f172a';
  pCtx.fillRect(0, 0, 512, 128);
  for (let b = 0; b < 6; b++) {
    const bx = 12 + b * 82;
    pCtx.fillStyle = '#1e293b';
    pCtx.fillRect(bx, 18, 70, 110);
    pCtx.fillStyle = weather === 'night' ? '#fef08a' : '#bae6fd';
    pCtx.fillRect(bx + 8, 26, 54, 14);
    pCtx.fillStyle = b % 2 === 0 ? '#dc2626' : '#f59e0b';
    pCtx.fillRect(bx, 8, 70, 6);
  }
  const pitGarageMap = new THREE.CanvasTexture(pitCanvas);
  pitGarageMap.colorSpace = THREE.SRGBColorSpace;
  pitGarageMap.anisotropy = maxAnisotropy;

  // 14. Trackside Catch-Fence Alpha Texture
  const fenceCanvas = document.createElement('canvas');
  fenceCanvas.width = 64;
  fenceCanvas.height = 64;
  const feCtx = fenceCanvas.getContext('2d')!;
  feCtx.clearRect(0, 0, 64, 64);
  feCtx.strokeStyle = '#cbd5e1';
  feCtx.lineWidth = 2;
  for (let i = -64; i <= 128; i += 16) {
    feCtx.beginPath();
    feCtx.moveTo(i, 0);
    feCtx.lineTo(i + 64, 64);
    feCtx.moveTo(i + 64, 0);
    feCtx.lineTo(i, 64);
    feCtx.stroke();
  }
  const fenceAlphaMap = new THREE.CanvasTexture(fenceCanvas);
  fenceAlphaMap.colorSpace = THREE.SRGBColorSpace;
  fenceAlphaMap.wrapS = THREE.RepeatWrapping;
  fenceAlphaMap.wrapT = THREE.RepeatWrapping;
  fenceAlphaMap.repeat.set(18, 2);

  // 15. LED FIA Marshal Board Texture
  const marshalCanvas = document.createElement('canvas');
  marshalCanvas.width = 128;
  marshalCanvas.height = 128;
  const maCtx = marshalCanvas.getContext('2d')!;
  maCtx.fillStyle = '#05070b';
  maCtx.fillRect(0, 0, 128, 128);
  maCtx.fillStyle = isRain ? '#f59e0b' : '#22c55e';
  for (let y = 20; y <= 108; y += 16) {
    for (let x = 20; x <= 108; x += 16) {
      maCtx.beginPath();
      maCtx.arc(x, y, 4.5, 0, Math.PI * 2);
      maCtx.fill();
    }
  }
  const marshalPanelMap = new THREE.CanvasTexture(marshalCanvas);
  marshalPanelMap.colorSpace = THREE.SRGBColorSpace;

  // 16. Soft Radial Particle Sprites (Smoke/Spray, Titanium Sparks, Rain Streaks)
  const smCanvas = document.createElement('canvas');
  smCanvas.width = 128;
  smCanvas.height = 128;
  const smCtx = smCanvas.getContext('2d')!;
  const smGrad = smCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  smGrad.addColorStop(0, 'rgba(255,255,255,0.92)');
  smGrad.addColorStop(0.38, 'rgba(241,245,249,0.52)');
  smGrad.addColorStop(0.75, 'rgba(226,232,240,0.18)');
  smGrad.addColorStop(1, 'rgba(255,255,255,0)');
  smCtx.fillStyle = smGrad;
  smCtx.fillRect(0, 0, 128, 128);
  const smokeSpriteMap = new THREE.CanvasTexture(smCanvas);
  smokeSpriteMap.colorSpace = THREE.SRGBColorSpace;

  const spkCanvas = document.createElement('canvas');
  spkCanvas.width = 64;
  spkCanvas.height = 64;
  const spkCtx = spkCanvas.getContext('2d')!;
  const spkGrad = spkCtx.createRadialGradient(32, 32, 1, 32, 32, 28);
  spkGrad.addColorStop(0, 'rgba(255,255,245,1)');
  spkGrad.addColorStop(0.28, 'rgba(255,190,70,0.9)');
  spkGrad.addColorStop(1, 'rgba(255,90,10,0)');
  spkCtx.fillStyle = spkGrad;
  spkCtx.fillRect(0, 0, 64, 64);
  const sparkSpriteMap = new THREE.CanvasTexture(spkCanvas);
  sparkSpriteMap.colorSpace = THREE.SRGBColorSpace;

  const rnCanvas = document.createElement('canvas');
  rnCanvas.width = 32;
  rnCanvas.height = 64;
  const rnCtx = rnCanvas.getContext('2d')!;
  const rnGrad = rnCtx.createLinearGradient(16, 0, 16, 64);
  rnGrad.addColorStop(0, 'rgba(226,232,240,0)');
  rnGrad.addColorStop(0.5, 'rgba(226,232,240,0.88)');
  rnGrad.addColorStop(1, 'rgba(226,232,240,0)');
  rnCtx.fillStyle = rnGrad;
  rnCtx.fillRect(14, 2, 4, 60);
  const rainSpriteMap = new THREE.CanvasTexture(rnCanvas);
  rainSpriteMap.colorSpace = THREE.SRGBColorSpace;

  // 17. Bodywork Road-Grime & Surface Wear Roughness Map (256x256 NoColorSpace)
  const bwCanvas = document.createElement('canvas');
  bwCanvas.width = 256;
  bwCanvas.height = 256;
  const bwCtx = bwCanvas.getContext('2d')!;
  bwCtx.fillStyle = '#383838';
  bwCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 420; i++) {
    const gx = Math.random() * 256;
    const gy = Math.random() * 256;
    const gw = 1 + Math.random() * 3;
    const gh = 6 + Math.random() * 26;
    const v = 50 + Math.floor(Math.random() * 68);
    bwCtx.fillStyle = `rgba(${v},${v},${v},0.22)`;
    bwCtx.fillRect(gx, gy, gw, gh);
  }
  for (let s = 0; s < 900; s++) {
    const sx = Math.random() * 256;
    const sy = Math.random() * 256;
    const sv = 75 + Math.floor(Math.random() * 95);
    bwCtx.fillStyle = `rgb(${sv},${sv},${sv})`;
    bwCtx.fillRect(sx, sy, 1.5, 1.5);
  }
  const bodyRoughnessMap = new THREE.CanvasTexture(bwCanvas);
  bodyRoughnessMap.colorSpace = THREE.NoColorSpace;
  bodyRoughnessMap.wrapS = THREE.RepeatWrapping;
  bodyRoughnessMap.wrapT = THREE.RepeatWrapping;
  bodyRoughnessMap.repeat.set(2, 2);

  // 17b. High-Quality Procedural Car Bodywork Ambient Occlusion Map (512x512 NoColorSpace)
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = 512;
  aoCanvas.height = 512;
  const aoCtx = aoCanvas.getContext('2d')!;
  aoCtx.fillStyle = '#FAFAFA';
  aoCtx.fillRect(0, 0, 512, 512);
  // Subtle panel seam & aerodynamic undercut cavity occlusion gradients
  const aoEdge = aoCtx.createRadialGradient(256, 256, 48, 256, 256, 256);
  aoEdge.addColorStop(0, 'rgba(255,255,255,0)');
  aoEdge.addColorStop(0.75, 'rgba(180,180,180,0.18)');
  aoEdge.addColorStop(1, 'rgba(95,95,95,0.45)');
  aoCtx.fillStyle = aoEdge;
  aoCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    const seam = aoCtx.createLinearGradient(0, y, 0, y + 12);
    seam.addColorStop(0, 'rgba(110,110,110,0.32)');
    seam.addColorStop(1, 'rgba(255,255,255,0)');
    aoCtx.fillStyle = seam;
    aoCtx.fillRect(0, y, 512, 12);
  }
  const carAoMap = new THREE.CanvasTexture(aoCanvas);
  carAoMap.colorSpace = THREE.NoColorSpace;
  carAoMap.wrapS = THREE.RepeatWrapping;
  carAoMap.wrapT = THREE.RepeatWrapping;

  // 18. FIA Live 2026 LED Timing Tower Texture (256x1024 SRGB)
  const ttCanvas = document.createElement('canvas');
  ttCanvas.width = 256;
  ttCanvas.height = 1024;
  const ttCtx = ttCanvas.getContext('2d')!;
  ttCtx.fillStyle = '#070A10';
  ttCtx.fillRect(0, 0, 256, 1024);

  ttCtx.fillStyle = '#DC2626';
  ttCtx.fillRect(10, 12, 236, 56);
  ttCtx.fillStyle = '#FFFFFF';
  ttCtx.font = 'italic 900 28px "Chakra Petch", sans-serif';
  ttCtx.textAlign = 'center';
  ttCtx.textBaseline = 'middle';
  ttCtx.fillText('F1 LIVE TIMING', 128, 40);

  const towerRows: Array<{ pos: string; code: string; col: string; gap: string }> = [
    { pos: '1', code: 'HAM', col: '#DC2626', gap: 'LEADER' },
    { pos: '2', code: 'VER', col: '#2563EB', gap: '+0.412' },
    { pos: '3', code: 'NOR', col: '#FF6B00', gap: '+0.885' },
    { pos: '4', code: 'LEC', col: '#DC2626', gap: '+1.204' },
    { pos: '5', code: 'RUS', col: '#14B8A6', gap: '+1.690' },
    { pos: '6', code: 'PIA', col: '#FF6B00', gap: '+2.145' },
    { pos: '7', code: 'ALO', col: '#10B981', gap: '+2.780' },
    { pos: '8', code: 'SAI', col: '#0284C7', gap: '+3.312' },
    { pos: '9', code: 'HUL', col: '#F43F5E', gap: '+3.890' },
    { pos: '10', code: 'GAS', col: '#EC4899', gap: '+4.415' },
    { pos: '11', code: 'PER', col: '#EAB308', gap: '+4.960' },
  ];

  towerRows.forEach((r, idx) => {
    const ry = 82 + idx * 84;
    ttCtx.fillStyle = '#0F1522';
    ttCtx.fillRect(12, ry, 232, 74);
    ttCtx.strokeStyle = 'rgba(255,255,255,0.12)';
    ttCtx.lineWidth = 1.5;
    ttCtx.strokeRect(12, ry, 232, 74);

    ttCtx.fillStyle = idx === 0 ? '#DC2626' : '#1E293B';
    ttCtx.fillRect(16, ry + 8, 44, 58);
    ttCtx.fillStyle = '#F8FAFC';
    ttCtx.font = 'bold 26px "Chakra Petch", sans-serif';
    ttCtx.textAlign = 'center';
    ttCtx.fillText(r.pos, 38, ry + 38);

    ttCtx.fillStyle = r.col;
    ttCtx.fillRect(66, ry + 8, 8, 58);

    ttCtx.fillStyle = '#FFFFFF';
    ttCtx.font = 'bold 28px "Chakra Petch", sans-serif';
    ttCtx.textAlign = 'left';
    ttCtx.fillText(r.code, 84, ry + 32);

    ttCtx.fillStyle = idx === 0 ? '#FBBF24' : '#38BDF8';
    ttCtx.font = 'bold 18px "JetBrains Mono", monospace';
    ttCtx.fillText(r.gap, 84, ry + 56);
  });

  const timingTowerMap = new THREE.CanvasTexture(ttCanvas);
  timingTowerMap.colorSpace = THREE.SRGBColorSpace;
  timingTowerMap.anisotropy = maxAnisotropy;

  // 19. Iridescent Asphalt Oil Spill Decal Texture (256x256 SRGB)
  const oilCanvas = document.createElement('canvas');
  oilCanvas.width = 256;
  oilCanvas.height = 256;
  const oilCtx = oilCanvas.getContext('2d')!;
  oilCtx.clearRect(0, 0, 256, 256);

  const oilCore = oilCtx.createRadialGradient(128, 128, 12, 128, 128, 118);
  oilCore.addColorStop(0, 'rgba(6, 8, 14, 0.94)');
  oilCore.addColorStop(0.38, 'rgba(14, 24, 38, 0.88)');
  oilCore.addColorStop(0.56, 'rgba(16, 185, 129, 0.42)');
  oilCore.addColorStop(0.72, 'rgba(168, 85, 247, 0.38)');
  oilCore.addColorStop(0.86, 'rgba(245, 158, 11, 0.28)');
  oilCore.addColorStop(1, 'rgba(6, 8, 14, 0)');
  oilCtx.fillStyle = oilCore;
  oilCtx.beginPath();
  oilCtx.ellipse(128, 128, 108, 118, 0.2, 0, Math.PI * 2);
  oilCtx.fill();

  for (let k = 0; k < 5; k++) {
    const ox = 92 + k * 18;
    const oy = 84 + ((k * 37) % 88);
    const subGrad = oilCtx.createRadialGradient(ox, oy, 4, ox, oy, 54);
    subGrad.addColorStop(0, 'rgba(5, 7, 12, 0.85)');
    subGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.28)');
    subGrad.addColorStop(1, 'rgba(5, 7, 12, 0)');
    oilCtx.fillStyle = subGrad;
    oilCtx.beginPath();
    oilCtx.arc(ox, oy, 54, 0, Math.PI * 2);
    oilCtx.fill();
  }
  const oilSpillMap = new THREE.CanvasTexture(oilCanvas);
  oilSpillMap.colorSpace = THREE.SRGBColorSpace;

  // 20. Wind-Rippled Desert Sand Map (512x512 SRGB — Abu Dhabi / Las Vegas)
  const sandCanvas = document.createElement('canvas');
  sandCanvas.width = 512;
  sandCanvas.height = 512;
  const sdCtx = sandCanvas.getContext('2d')!;
  sdCtx.fillStyle = '#c8a77b';
  sdCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 6) {
    const wave = Math.sin(y * 0.08) * 14;
    sdCtx.fillStyle = y % 12 === 0 ? 'rgba(245, 222, 184, 0.24)' : 'rgba(138, 102, 62, 0.20)';
    sdCtx.fillRect(0, (y + wave + 512) % 512, 512, 3);
  }
  for (let i = 0; i < 14000; i++) {
    const shade = 165 + Math.floor(Math.random() * 58);
    sdCtx.fillStyle = `rgb(${shade + 22},${shade + 2},${shade - 28})`;
    sdCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  const desertSandMap = new THREE.CanvasTexture(sandCanvas);
  desertSandMap.colorSpace = THREE.SRGBColorSpace;
  desertSandMap.wrapS = THREE.RepeatWrapping;
  desertSandMap.wrapT = THREE.RepeatWrapping;
  desertSandMap.repeat.set(90, 90);
  desertSandMap.anisotropy = maxAnisotropy;

  // 21. Modern Curtain-Wall Glass Skyscraper Albedo & Emissive Window Grid (512x512 SRGB)
  const skyBldCanvas = document.createElement('canvas');
  skyBldCanvas.width = 512;
  skyBldCanvas.height = 512;
  const sbCtx = skyBldCanvas.getContext('2d')!;
  sbCtx.fillStyle = '#0f172a';
  sbCtx.fillRect(0, 0, 512, 512);

  const skyEmCanvas = document.createElement('canvas');
  skyEmCanvas.width = 512;
  skyEmCanvas.height = 512;
  const seCtx = skyEmCanvas.getContext('2d')!;
  seCtx.fillStyle = '#000000';
  seCtx.fillRect(0, 0, 512, 512);

  const cols = 16;
  const rows = 32;
  const cw = 512 / cols;
  const rh = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const floorBandLit = Math.random() > 0.22;
    for (let c = 0; c < cols; c++) {
      const lit = floorBandLit && Math.random() > 0.42;
      const warm = Math.random() > 0.45;
      sbCtx.fillStyle = lit
        ? warm
          ? '#fde68a'
          : '#bae6fd'
        : Math.random() > 0.5
          ? '#1e293b'
          : '#334155';
      sbCtx.fillRect(c * cw + 3, r * rh + 3, cw - 6, rh - 5);

      if (lit) {
        seCtx.fillStyle = warm ? '#fbbf24' : '#38bdf8';
        seCtx.fillRect(c * cw + 3, r * rh + 3, cw - 6, rh - 5);
      }
    }
    // Structural spandrel horizontal mullions
    sbCtx.fillStyle = '#090d16';
    sbCtx.fillRect(0, r * rh, 512, 2);
  }
  const skyscraperGlassMap = new THREE.CanvasTexture(skyBldCanvas);
  skyscraperGlassMap.colorSpace = THREE.SRGBColorSpace;
  skyscraperGlassMap.wrapS = THREE.RepeatWrapping;
  skyscraperGlassMap.wrapT = THREE.RepeatWrapping;
  skyscraperGlassMap.anisotropy = maxAnisotropy;

  const skyscraperEmissiveMap = new THREE.CanvasTexture(skyEmCanvas);
  skyscraperEmissiveMap.colorSpace = THREE.SRGBColorSpace;
  skyscraperEmissiveMap.wrapS = THREE.RepeatWrapping;
  skyscraperEmissiveMap.wrapT = THREE.RepeatWrapping;
  skyscraperEmissiveMap.anisotropy = maxAnisotropy;

  // 22. Mediterranean Riviera Apartment Facade Texture (Monaco — 512x512 SRGB)
  const rivCanvas = document.createElement('canvas');
  rivCanvas.width = 512;
  rivCanvas.height = 512;
  const rvCtx = rivCanvas.getContext('2d')!;
  rvCtx.fillStyle = '#e7d5bc';
  rvCtx.fillRect(0, 0, 512, 512);
  for (let r = 0; r < 12; r++) {
    const ry = 14 + r * 42;
    // Balcony ledge
    rvCtx.fillStyle = '#cbb396';
    rvCtx.fillRect(0, ry + 26, 512, 6);
    rvCtx.fillStyle = '#475569';
    rvCtx.fillRect(0, ry + 20, 512, 3);
    for (let c = 0; c < 8; c++) {
      const rx = 18 + c * 62;
      const lit = Math.random() > 0.55;
      rvCtx.fillStyle = lit ? '#fef08a' : '#1e293b';
      rvCtx.fillRect(rx, ry, 28, 22);
      // Shutters
      rvCtx.fillStyle = '#4f6d5a';
      rvCtx.fillRect(rx - 7, ry, 6, 22);
      rvCtx.fillRect(rx + 29, ry, 6, 22);
    }
  }
  const rivieraFacadeMap = new THREE.CanvasTexture(rivCanvas);
  rivieraFacadeMap.colorSpace = THREE.SRGBColorSpace;
  rivieraFacadeMap.wrapS = THREE.RepeatWrapping;
  rivieraFacadeMap.wrapT = THREE.RepeatWrapping;
  rivieraFacadeMap.anisotropy = maxAnisotropy;

  // 23. Trackside Jumbotron Broadcast Screen Texture (1024x512 SRGB)
  const jumboCanvas = document.createElement('canvas');
  jumboCanvas.width = 1024;
  jumboCanvas.height = 512;
  const jCtx = jumboCanvas.getContext('2d')!;
  const jBg = jCtx.createLinearGradient(0, 0, 1024, 512);
  jBg.addColorStop(0, '#070b14');
  jBg.addColorStop(0.55, '#111827');
  jBg.addColorStop(1, '#1e1b4b');
  jCtx.fillStyle = jBg;
  jCtx.fillRect(0, 0, 1024, 512);

  // Top broadcast red header bar
  jCtx.fillStyle = '#dc2626';
  jCtx.fillRect(0, 0, 1024, 68);
  jCtx.fillStyle = '#ffffff';
  jCtx.font = 'italic 900 36px "Chakra Petch", sans-serif';
  jCtx.fillText('FORMULA WORLD GP // 2026 LIVE BROADCAST', 28, 46);

  // Speed trap & live sector split visual
  jCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  jCtx.fillRect(28, 96, 560, 384);
  jCtx.strokeStyle = '#38bdf8';
  jCtx.lineWidth = 3;
  jCtx.strokeRect(28, 96, 560, 384);

  // Stylized track radar + glowing racing line
  jCtx.strokeStyle = '#475569';
  jCtx.lineWidth = 14;
  jCtx.beginPath();
  jCtx.ellipse(308, 288, 195, 115, -0.18, 0, Math.PI * 2);
  jCtx.stroke();
  jCtx.strokeStyle = '#22c55e';
  jCtx.lineWidth = 6;
  jCtx.beginPath();
  jCtx.ellipse(308, 288, 195, 115, -0.18, 0, Math.PI * 1.1);
  jCtx.stroke();
  jCtx.strokeStyle = '#a855f7';
  jCtx.beginPath();
  jCtx.ellipse(308, 288, 195, 115, -0.18, Math.PI * 1.1, Math.PI * 1.75);
  jCtx.stroke();

  jCtx.fillStyle = '#f8fafc';
  jCtx.font = '700 28px "Chakra Petch", sans-serif';
  jCtx.fillText('SPEED TRAP  348 KM/H', 54, 146);
  jCtx.fillStyle = '#38bdf8';
  jCtx.font = '700 22px "Chakra Petch", sans-serif';
  jCtx.fillText('TRACK TEMP 34°C  ·  DRS ACTIVE', 54, 452);

  // Right-side leaderboard column
  const jRows = [
    ['1', 'VER', '1:18.412', '#38bdf8'],
    ['2', 'LEC', '+0.284', '#ef4444'],
    ['3', 'NOR', '+0.619', '#f97316'],
    ['4', 'HAM', '+0.945', '#dc2626'],
    ['5', 'RUS', '+1.402', '#2dd4bf'],
  ];
  jRows.forEach(([pos, code, gap, col], idx) => {
    const ry = 96 + idx * 78;
    jCtx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    jCtx.fillRect(612, ry, 384, 66);
    jCtx.fillStyle = col;
    jCtx.fillRect(612, ry, 10, 66);
    jCtx.fillStyle = '#f8fafc';
    jCtx.font = '800 30px "Chakra Petch", sans-serif';
    jCtx.fillText(`${pos}  ${code}`, 636, ry + 43);
    jCtx.fillStyle = idx === 0 ? '#a855f7' : '#cbd5e1';
    jCtx.font = '700 26px "Chakra Petch", sans-serif';
    jCtx.fillText(gap, 830, ry + 43);
  });

  const jumbotronMap = new THREE.CanvasTexture(jumboCanvas);
  jumbotronMap.colorSpace = THREE.SRGBColorSpace;
  jumbotronMap.anisotropy = maxAnisotropy;

  // 24. Circuit Flagpole Pennant Banner Texture (256x128 SRGB)
  const flagCanvas = document.createElement('canvas');
  flagCanvas.width = 256;
  flagCanvas.height = 128;
  const flagBannerCtx = flagCanvas.getContext('2d')!;
  flagBannerCtx.fillStyle = '#0f172a';
  flagBannerCtx.fillRect(0, 0, 256, 128);
  flagBannerCtx.fillStyle = '#ef4444';
  flagBannerCtx.fillRect(0, 0, 256, 34);
  flagBannerCtx.fillStyle = '#f8fafc';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0) {
        flagBannerCtx.fillRect(c * 32, 34 + r * 24, 32, 24);
      }
    }
  }
  const flagBannerMap = new THREE.CanvasTexture(flagCanvas);
  flagBannerMap.colorSpace = THREE.SRGBColorSpace;
  flagBannerMap.anisotropy = maxAnisotropy;

  // 25. FIA DRS Activation Zone Board Texture (256x128 SRGB)
  const drsCanvas = document.createElement('canvas');
  drsCanvas.width = 256;
  drsCanvas.height = 128;
  const drsBoardCtx = drsCanvas.getContext('2d')!;
  drsBoardCtx.fillStyle = '#061510';
  drsBoardCtx.fillRect(0, 0, 256, 128);
  drsBoardCtx.strokeStyle = '#10B981';
  drsBoardCtx.lineWidth = 8;
  drsBoardCtx.strokeRect(6, 6, 244, 116);
  drsBoardCtx.fillStyle = '#10B981';
  drsBoardCtx.fillRect(14, 14, 228, 22);
  drsBoardCtx.fillStyle = '#04120B';
  drsBoardCtx.font = '900 15px "Chakra Petch", sans-serif';
  drsBoardCtx.textAlign = 'center';
  drsBoardCtx.fillText('ACTIVATION ZONE', 128, 30);
  drsBoardCtx.fillStyle = '#34D399';
  drsBoardCtx.font = 'italic 900 62px "Chakra Petch", sans-serif';
  drsBoardCtx.fillText('DRS', 128, 100);
  const drsBoardMap = new THREE.CanvasTexture(drsCanvas);
  drsBoardMap.colorSpace = THREE.SRGBColorSpace;
  drsBoardMap.anisotropy = maxAnisotropy;

  // 26. FIA DRS Detection Point Board Texture (256x128 SRGB)
  const detCanvas = document.createElement('canvas');
  detCanvas.width = 256;
  detCanvas.height = 128;
  const detCtx = detCanvas.getContext('2d')!;
  detCtx.fillStyle = '#0F172A';
  detCtx.fillRect(0, 0, 256, 128);
  detCtx.strokeStyle = '#38BDF8';
  detCtx.lineWidth = 8;
  detCtx.strokeRect(6, 6, 244, 116);
  detCtx.fillStyle = '#38BDF8';
  detCtx.fillRect(14, 14, 228, 22);
  detCtx.fillStyle = '#090D16';
  detCtx.font = '900 15px "Chakra Petch", sans-serif';
  detCtx.textAlign = 'center';
  detCtx.fillText('DRS DETECTION', 128, 30);
  detCtx.fillStyle = '#F8FAFC';
  detCtx.font = 'italic 900 50px "Chakra Petch", sans-serif';
  detCtx.fillText('DET', 128, 96);
  const drsDetBoardMap = new THREE.CanvasTexture(detCanvas);
  drsDetBoardMap.colorSpace = THREE.SRGBColorSpace;
  drsDetBoardMap.anisotropy = maxAnisotropy;

  return {
    asphaltMap,
    asphaltNormalMap,
    asphaltRoughnessMap,
    bodyRoughnessMap,
    carAoMap,
    kerbMap,
    carbonMap,
    carbonNormalMap,
    paintFlakeNormalMap,
    tyreTreadNormalMap,
    brakeDiscMap,
    gridFinishMap,
    gridBoxMap,
    contactShadowMap,
    groundGrassMap,
    gravelMap,
    skyDomeMap,
    brakeBoardTextures,
    sponsorBoardMap,
    bridgeBannerMap,
    crowdMap,
    pitGarageMap,
    timingTowerMap,
    fenceAlphaMap,
    marshalPanelMap,
    smokeSpriteMap,
    sparkSpriteMap,
    rainSpriteMap,
    oilSpillMap,
    desertSandMap,
    skyscraperGlassMap,
    skyscraperEmissiveMap,
    rivieraFacadeMap,
    jumbotronMap,
    flagBannerMap,
    drsBoardMap,
    drsDetBoardMap,
    dispose: () => {
      asphaltMap.dispose();
      asphaltNormalMap.dispose();
      asphaltRoughnessMap.dispose();
      bodyRoughnessMap.dispose();
      carAoMap.dispose();
      kerbMap.dispose();
      carbonMap.dispose();
      carbonNormalMap.dispose();
      paintFlakeNormalMap.dispose();
      tyreTreadNormalMap.dispose();
      brakeDiscMap.dispose();
      gridFinishMap.dispose();
      gridBoxMap.dispose();
      contactShadowMap.dispose();
      groundGrassMap.dispose();
      gravelMap.dispose();
      skyDomeMap.dispose();
      brakeBoardTextures.forEach((t) => t.dispose());
      sponsorBoardMap.dispose();
      bridgeBannerMap.dispose();
      crowdMap.dispose();
      pitGarageMap.dispose();
      timingTowerMap.dispose();
      fenceAlphaMap.dispose();
      marshalPanelMap.dispose();
      smokeSpriteMap.dispose();
      sparkSpriteMap.dispose();
      rainSpriteMap.dispose();
      oilSpillMap.dispose();
      desertSandMap.dispose();
      skyscraperGlassMap.dispose();
      skyscraperEmissiveMap.dispose();
      rivieraFacadeMap.dispose();
      jumbotronMap.dispose();
      flagBannerMap.dispose();
      drsBoardMap.dispose();
      drsDetBoardMap.dispose();
    },
  };
}
