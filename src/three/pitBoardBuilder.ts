import * as THREE from 'three';

export interface PitBoardModel {
  root: THREE.Group;
  boardPivot: THREE.Group;
  updateBoard: (position: number, totalRacers: number, gapAheadSeconds: number | null, accentHex: string) => void;
  dispose: () => void;
}

export function buildPitBoard(maxAnisotropy: number): PitBoardModel {
  const root = new THREE.Group();
  const boardPivot = new THREE.Group();
  root.add(boardPivot);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  const aluminumMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.85,
    roughness: 0.24,
  });

  const carbonFrameMat = new THREE.MeshStandardMaterial({
    color: 0x0f1218,
    metalness: 0.35,
    roughness: 0.45,
  });

  const faceMat = new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: 0xffffff,
    emissiveIntensity: 0.42,
    roughness: 0.25,
    metalness: 0.08,
  });

  // Grounded vertical stanchion post + pit-wall arm
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.35, 10), aluminumMat);
  post.position.set(-1.35, 1.175, 0);
  post.castShadow = true;
  boardPivot.add(post);

  const upperArm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.08), aluminumMat);
  upperArm.position.set(-0.65, 2.22, 0);
  boardPivot.add(upperArm);

  const lowerArm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.08), aluminumMat);
  lowerArm.position.set(-0.65, 1.08, 0);
  boardPivot.add(lowerArm);

  // Outer slotted board backing frame
  const backing = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.82, 0.09), carbonFrameMat);
  backing.position.set(0.2, 1.65, 0);
  backing.castShadow = true;
  boardPivot.add(backing);

  // Front & back faces so readable from any angle
  const frontFace = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.66), faceMat);
  frontFace.position.set(0.2, 1.65, 0.05);
  boardPivot.add(frontFace);

  const backFace = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.66), faceMat);
  backFace.position.set(0.2, 1.65, -0.05);
  backFace.rotation.y = Math.PI;
  boardPivot.add(backFace);

  const updateBoard = (
    position: number,
    totalRacers: number,
    gapAheadSeconds: number | null,
    accentHex: string
  ) => {
    ctx.fillStyle = '#090b0f';
    ctx.fillRect(0, 0, 512, 384);

    // Top fluorescent header bar
    ctx.fillStyle = accentHex || '#f59e0b';
    ctx.fillRect(16, 16, 480, 68);
    ctx.fillStyle = '#090b0f';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FINAL LAP', 256, 52);

    // Horizontal slat dividers (authentic Formula pit board slots)
    ctx.fillStyle = '#141923';
    ctx.fillRect(16, 100, 480, 128);
    ctx.fillRect(16, 242, 480, 124);

    // Position row
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('POS', 36, 164);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 88px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`P${position}/${totalRacers}`, 474, 168);

    // Gap to car ahead row
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('GAP AHEAD', 36, 304);

    const gapLabel =
      totalRacers <= 1
        ? 'SOLO'
        : position === 1 || gapAheadSeconds === null || gapAheadSeconds <= 0.01
          ? 'LEADER'
          : `+${gapAheadSeconds.toFixed(2)}s`;

    ctx.fillStyle = position === 1 ? '#34d399' : '#f8fafc';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(gapLabel, 474, 306);

    texture.needsUpdate = true;
  };

  root.visible = false;

  return {
    root,
    boardPivot,
    updateBoard,
    dispose: () => {
      texture.dispose();
      aluminumMat.dispose();
      carbonFrameMat.dispose();
      faceMat.dispose();
      post.geometry.dispose();
      upperArm.geometry.dispose();
      backing.geometry.dispose();
      frontFace.geometry.dispose();
    },
  };
}
