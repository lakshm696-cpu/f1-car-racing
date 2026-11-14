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
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const cx = 256;
  const cy = 256;

  // Base vulcanized sidewall rubber with subtle radial molding ribs
  ctx.fillStyle = '#12151B';
  ctx.fillRect(0, 0, 512, 512);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 155, Math.sin(a) * 155);
    ctx.lineTo(Math.cos(a) * 244, Math.sin(a) * 244);
    ctx.stroke();
  }

  const col = PIRELLI_COMPOUND_HEX[compound];

  // Signature twin Pirelli compound arcs
  ctx.strokeStyle = col;
  ctx.lineWidth = 15;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, 198, -Math.PI * 0.28, Math.PI * 0.28);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 198, Math.PI * 0.72, Math.PI * 1.28);
  ctx.stroke();

  // Inner fine technical bead line
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.26)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 170, 0, Math.PI * 2);
  ctx.stroke();

  // Curved "PIRELLI" top arc & "P ZERO" bottom arc lettering
  const drawArcText = (text: string, radius: number, startAngle: number, stepAngle: number, color: string) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = 'italic 900 28px "Chakra Petch", sans-serif';
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

  drawArcText('PIRELLI', 198, -0.45, 0.15, col);
  drawArcText('P ZERO', 198, Math.PI - 0.38, 0.15, '#F8FAFC');
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createNumberDecalTexture(numText: string, accentHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  ctx.fillStyle = accentHex;
  ctx.beginPath();
  ctx.roundRect(24, 44, 208, 168, 26);
  ctx.fill();

  ctx.fillStyle = '#090B0F';
  ctx.beginPath();
  ctx.roundRect(34, 54, 188, 148, 20);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 3;
  ctx.strokeRect(42, 62, 172, 132);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'italic bold 118px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numText, 128, 134);

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
  actx.fillStyle = '#1c2028';
  actx.fillRect(0, 0, 2048, 2048);

  const groove = actx.createLinearGradient(0, 0, 2048, 0);
  groove.addColorStop(0, 'rgba(28,30,36,0.0)');
  groove.addColorStop(0.24, 'rgba(8,10,14,0.26)');
  groove.addColorStop(0.5, 'rgba(16,18,24,0.10)');
  groove.addColorStop(0.76, 'rgba(8,10,14,0.26)');
  groove.addColorStop(1, 'rgba(28,30,36,0.0)');
  actx.fillStyle = groove;
  actx.fillRect(0, 0, 2048, 2048);

  // Ultra-fine mineral aggregate stone grain & bitumen variation
  for (let i = 0; i < 160000; i++) {
    const x = Math.random() * 2048;
    const y = Math.random() * 2048;
    const v = 22 + Math.floor(Math.random() * 54);
    actx.fillStyle = `rgb(${v},${v + 1},${v + 5})`;
    actx.fillRect(x, y, 2, 2);
  }

  // Longitudinal laser-screeded asphalt paving micro-striations
  actx.fillStyle = 'rgba(10, 12, 16, 0.14)';
  for (let s = 0; s < 140; s++) {
    const sx = 64 + Math.random() * 1920;
    actx.fillRect(sx, 0, 1 + Math.random() * 2, 2048);
  }

  // Realistic hairline asphalt cracks & tar overband repairs
  actx.strokeStyle = 'rgba(6, 8, 11, 0.72)';
  actx.lineWidth = 2.2;
  for (let c = 0; c < 32; c++) {
    let cx = 120 + Math.random() * 1808;
    let cy = Math.random() * 2048;
    actx.beginPath();
    actx.moveTo(cx, cy);
    for (let s = 0; s < 12; s++) {
      cx += (Math.random() - 0.5) * 56;
      cy += 22 + Math.random() * 44;
      actx.lineTo(cx, cy);
    }
    actx.stroke();
  }

  // Faint initial rubber skid marks along braking/acceleration zones
  for (let s = 0; s < 36; s++) {
    const sx = (s % 2 === 0 ? 500 : 1380) + (Math.random() - 0.5) * 240;
    const sy = Math.random() * 1800;
    actx.fillStyle = 'rgba(5, 6, 9, 0.22)';
    actx.fillRect(sx, sy, 5 + Math.random() * 6, 70 + Math.random() * 160);
  }

  // Rubber marbling off the racing line
  for (let m = 0; m < 2400; m++) {
    const side = Math.random() > 0.5 ? 96 + Math.random() * 176 : 1776 + Math.random() * 176;
    actx.fillStyle = 'rgba(6,7,10,0.62)';
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

  // 2. High-Definition Asphalt Micro-Grain Normal Map (1024x1024)
  const normCanvas = document.createElement('canvas');
  normCanvas.width = 1024;
  normCanvas.height = 1024;
  const nctx = normCanvas.getContext('2d')!;
  const nImg = nctx.createImageData(1024, 1024);
  for (let i = 0; i < 1024 * 1024; i++) {
    nImg.data[i * 4] = 128 + (Math.random() - 0.5) * 108;
    nImg.data[i * 4 + 1] = 128 + (Math.random() - 0.5) * 108;
    nImg.data[i * 4 + 2] = 226;
    nImg.data[i * 4 + 3] = 255;
  }
  nctx.putImageData(nImg, 0, 0);
  const asphaltNormalMap = new THREE.CanvasTexture(normCanvas);
  asphaltNormalMap.wrapS = THREE.RepeatWrapping;
  asphaltNormalMap.wrapT = THREE.RepeatWrapping;
  asphaltNormalMap.repeat.set(4, 150);
  asphaltNormalMap.anisotropy = maxAnisotropy;

  // 3. High-Precision Asphalt Roughness Map (512x512 — standing puddles in Rain, polished groove in Dry)
  const isRain = weather === 'rain' || weather === 'heavy_rain';
  const isSunset = weather === 'sunset';
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rctx = roughCanvas.getContext('2d')!;
  rctx.fillStyle = isRain
    ? weather === 'heavy_rain'
      ? 'rgb(42,42,42)'
      : 'rgb(64,64,64)'
    : isSunset
      ? 'rgb(148,148,148)'
      : 'rgb(190,190,190)';
  rctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 24000; i++) {
    const base = isRain ? (weather === 'heavy_rain' ? 14 : 22) : isSunset ? 108 : 142;
    const v = base + Math.floor(Math.random() * 76);
    rctx.fillStyle = `rgb(${v},${v},${v})`;
    rctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  if (isRain) {
    const puddleCount = weather === 'heavy_rain' ? 68 : 48;
    for (let p = 0; p < puddleCount; p++) {
      const px = Math.random() * 512;
      const py = Math.random() * 512;
      const pr = 20 + Math.random() * (weather === 'heavy_rain' ? 76 : 62);
      const pg = rctx.createRadialGradient(px, py, 3, px, py, pr);
      pg.addColorStop(0, 'rgba(4,4,4,0.99)');
      pg.addColorStop(0.65, 'rgba(18,18,18,0.78)');
      pg.addColorStop(1, 'rgba(64,64,64,0)');
      rctx.fillStyle = pg;
      rctx.beginPath();
      rctx.arc(px, py, pr, 0, Math.PI * 2);
      rctx.fill();
    }
  } else {
    const grooveRough = rctx.createLinearGradient(0, 0, 512, 0);
    grooveRough.addColorStop(0, 'rgba(200,200,200,0)');
    grooveRough.addColorStop(0.24, isSunset ? 'rgba(84,84,84,0.56)' : 'rgba(128,128,128,0.45)');
    grooveRough.addColorStop(0.76, isSunset ? 'rgba(84,84,84,0.56)' : 'rgba(128,128,128,0.45)');
    grooveRough.addColorStop(1, 'rgba(200,200,200,0)');
    rctx.fillStyle = grooveRough;
    rctx.fillRect(0, 0, 512, 512);
  }
  const asphaltRoughnessMap = new THREE.CanvasTexture(roughCanvas);
  asphaltRoughnessMap.wrapS = THREE.ClampToEdgeWrapping;
  asphaltRoughnessMap.wrapT = THREE.RepeatWrapping;
  asphaltRoughnessMap.repeat.set(1, 78);
  asphaltRoughnessMap.anisotropy = maxAnisotropy;

  // 4. FIA Serrated Kerb Map with beveled concrete seam lines (256x512)
  const kerbCanvas = document.createElement('canvas');
  kerbCanvas.width = 256;
  kerbCanvas.height = 512;
  const kctx = kerbCanvas.getContext('2d')!;
  kctx.fillStyle = kerbA;
  kctx.fillRect(0, 0, 256, 256);
  kctx.fillStyle = kerbB;
  kctx.fillRect(0, 256, 256, 256);
  // Serrated rumble-strip bevel shading
  for (let y = 0; y < 512; y += 32) {
    const rGrad = kctx.createLinearGradient(0, y, 0, y + 32);
    rGrad.addColorStop(0, 'rgba(255,255,255,0.16)');
    rGrad.addColorStop(0.7, 'rgba(0,0,0,0.0)');
    rGrad.addColorStop(1, 'rgba(0,0,0,0.28)');
    kctx.fillStyle = rGrad;
    kctx.fillRect(0, y, 256, 32);
  }
  kctx.fillStyle = 'rgba(0,0,0,0.38)';
  kctx.fillRect(0, 248, 256, 16);
  kctx.fillRect(0, 0, 256, 8);
  for (let i = 0; i < 1600; i++) {
    kctx.fillStyle = 'rgba(0,0,0,0.09)';
    kctx.fillRect(Math.random() * 256, Math.random() * 512, 4, 4);
  }

  const kerbMap = new THREE.CanvasTexture(kerbCanvas);
  kerbMap.colorSpace = THREE.SRGBColorSpace;
  kerbMap.wrapS = THREE.RepeatWrapping;
  kerbMap.wrapT = THREE.RepeatWrapping;
  kerbMap.repeat.set(1, 145);
  kerbMap.anisotropy = maxAnisotropy;

  // 5. Ultra-Detailed 2x2 Twill Carbon Fiber + High-Res Normal Map (512x512 for 4K Close-Ups)
  const carbonCanvas = document.createElement('canvas');
  carbonCanvas.width = 512;
  carbonCanvas.height = 512;
  const cctx = carbonCanvas.getContext('2d')!;
  cctx.fillStyle = '#0c0f15';
  cctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 8) {
    for (let x = 0; x < 512; x += 8) {
      const shift = ((y / 8) % 4) * 4;
      const gx = (x + shift) % 512;
      const g1 = cctx.createLinearGradient(gx, y, gx + 4, y + 4);
      g1.addColorStop(0, '#3e4658');
      g1.addColorStop(0.5, '#29303e');
      g1.addColorStop(1, '#12161e');
      cctx.fillStyle = g1;
      cctx.fillRect(gx, y, 4, 4);

      // Micro-filament specular thread highlight
      cctx.fillStyle = 'rgba(255,255,255,0.09)';
      cctx.fillRect(gx + 1, y, 1, 4);

      const gx2 = (gx + 4) % 512;
      const g2 = cctx.createLinearGradient(gx2, y + 4, gx2 + 4, y + 8);
      g2.addColorStop(0, '#242b38');
      g2.addColorStop(1, '#0f1219');
      cctx.fillStyle = g2;
      cctx.fillRect(gx2, y + 4, 4, 4);
    }
  }
  const carbonMap = new THREE.CanvasTexture(carbonCanvas);
  carbonMap.colorSpace = THREE.SRGBColorSpace;
  carbonMap.wrapS = THREE.RepeatWrapping;
  carbonMap.wrapT = THREE.RepeatWrapping;
  carbonMap.repeat.set(20, 20);
  carbonMap.anisotropy = maxAnisotropy;

  const cNormCanvas = document.createElement('canvas');
  cNormCanvas.width = 512;
  cNormCanvas.height = 512;
  const cnctx = cNormCanvas.getContext('2d')!;
  cnctx.fillStyle = 'rgb(128,128,255)';
  cnctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 8) {
    for (let x = 0; x < 512; x += 8) {
      const shift = ((y / 8) % 4) * 4;
      const gx = (x + shift) % 512;
      cnctx.fillStyle = 'rgb(188,124,228)';
      cnctx.fillRect(gx, y, 4, 4);
      cnctx.fillStyle = 'rgb(124,188,228)';
      cnctx.fillRect((gx + 4) % 512, y + 4, 4, 4);
    }
  }
  const carbonNormalMap = new THREE.CanvasTexture(cNormCanvas);
  carbonNormalMap.wrapS = THREE.RepeatWrapping;
  carbonNormalMap.wrapT = THREE.RepeatWrapping;
  carbonNormalMap.repeat.set(20, 20);
  carbonNormalMap.anisotropy = maxAnisotropy;

  // 5b. Metallic Paint Flake & Clearcoat Micro-Polish Normal Map (512x512)
  const flakeCanvas = document.createElement('canvas');
  flakeCanvas.width = 512;
  flakeCanvas.height = 512;
  const flCtx = flakeCanvas.getContext('2d')!;
  const flImg = flCtx.createImageData(512, 512);
  for (let i = 0; i < 512 * 512; i++) {
    flImg.data[i * 4] = 128 + (Math.random() - 0.5) * 22;
    flImg.data[i * 4 + 1] = 128 + (Math.random() - 0.5) * 22;
    flImg.data[i * 4 + 2] = 250;
    flImg.data[i * 4 + 3] = 255;
  }
  flCtx.putImageData(flImg, 0, 0);
  flCtx.strokeStyle = 'rgba(136, 122, 248, 0.25)';
  flCtx.lineWidth = 1;
  for (let s = 0; s < 56; s++) {
    const sx = Math.random() * 512;
    const sy = Math.random() * 512;
    flCtx.beginPath();
    flCtx.moveTo(sx, sy);
    flCtx.lineTo(sx + (Math.random() - 0.5) * 52, sy + (Math.random() - 0.5) * 18);
    flCtx.stroke();
  }
  const paintFlakeNormalMap = new THREE.CanvasTexture(flakeCanvas);
  paintFlakeNormalMap.wrapS = THREE.RepeatWrapping;
  paintFlakeNormalMap.wrapT = THREE.RepeatWrapping;
  paintFlakeNormalMap.repeat.set(20, 20);
  paintFlakeNormalMap.anisotropy = maxAnisotropy;

  // 5c. High-Res Tyre Tread, Drainage Grooves & Grained Racing Rubber Normal Map (512x512)
  const tyreNormCanvas = document.createElement('canvas');
  tyreNormCanvas.width = 512;
  tyreNormCanvas.height = 512;
  const tnCtx = tyreNormCanvas.getContext('2d')!;
  tnCtx.fillStyle = 'rgb(128,128,255)';
  tnCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16000; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    tnCtx.fillStyle = Math.random() > 0.5 ? 'rgb(146,128,242)' : 'rgb(110,128,242)';
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

  // 5d. High-Res Cross-Drilled Carbon-Ceramic Brake Disc Texture (512x512)
  const discCanvas = document.createElement('canvas');
  discCanvas.width = 512;
  discCanvas.height = 512;
  const dCtx = discCanvas.getContext('2d')!;
  dCtx.fillStyle = '#2d313a';
  dCtx.fillRect(0, 0, 512, 512);
  for (let r = 128; r <= 236; r += 16) {
    dCtx.strokeStyle = 'rgba(15,18,24,0.48)';
    dCtx.lineWidth = 2.5;
    dCtx.beginPath();
    dCtx.arc(256, 256, r, 0, Math.PI * 2);
    dCtx.stroke();
  }
  dCtx.fillStyle = '#0c0e13';
  for (let a = 0; a < 24; a++) {
    const baseAngle = (a / 24) * Math.PI * 2;
    for (let ring = 0; ring < 3; ring++) {
      const rad = 148 + ring * 32;
      const ang = baseAngle + ring * 0.14;
      dCtx.beginPath();
      dCtx.arc(256 + Math.cos(ang) * rad, 256 + Math.sin(ang) * rad, 6.2, 0, Math.PI * 2);
      dCtx.fill();
    }
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

  // 8. Ground Turf & Runoff Gravel
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 512;
  grassCanvas.height = 512;
  const gctx = grassCanvas.getContext('2d')!;
  gctx.fillStyle = '#253a26';
  gctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18000; i++) {
    gctx.fillStyle = Math.random() > 0.5 ? '#2f4930' : '#1d2f1e';
    gctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
  }
  const groundGrassMap = new THREE.CanvasTexture(grassCanvas);
  groundGrassMap.colorSpace = THREE.SRGBColorSpace;
  groundGrassMap.wrapS = THREE.RepeatWrapping;
  groundGrassMap.wrapT = THREE.RepeatWrapping;
  groundGrassMap.repeat.set(95, 95);
  groundGrassMap.anisotropy = maxAnisotropy;

  const gravelCanvas = document.createElement('canvas');
  gravelCanvas.width = 256;
  gravelCanvas.height = 256;
  const grctx = gravelCanvas.getContext('2d')!;
  grctx.fillStyle = '#5c554c';
  grctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9500; i++) {
    const shade = 68 + Math.floor(Math.random() * 55);
    grctx.fillStyle = `rgb(${shade + 8},${shade + 2},${shade - 6})`;
    grctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const gravelMap = new THREE.CanvasTexture(gravelCanvas);
  gravelMap.colorSpace = THREE.SRGBColorSpace;
  gravelMap.wrapS = THREE.RepeatWrapping;
  gravelMap.wrapT = THREE.RepeatWrapping;
  gravelMap.repeat.set(2, 120);
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
    },
  };
}
