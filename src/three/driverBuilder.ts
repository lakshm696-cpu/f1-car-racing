import * as THREE from 'three';

export type DriverAnimMode = 'idle' | 'select' | 'podium_1' | 'podium_2' | 'podium_3';

export interface DriverCharacterModel {
  root: THREE.Group;
  trophyMount: THREE.Group;
  applyStyle: (
    suitPrimaryHex: string,
    suitSecondaryHex: string,
    helmetHex: string,
    visorHex: string,
    skinToneHex?: string
  ) => void;
  updateAnimation: (elapsedSec: number, mode: DriverAnimMode, selectTimer?: number) => void;
  dispose: () => void;
}

export function buildDriverCharacter(
  carbonMap: THREE.Texture,
  suitPrimaryHex = '#D91E2A',
  suitSecondaryHex = '#14161B',
  helmetHex = '#F8FAFC',
  visorHex = '#F59E0B',
  skinToneHex = '#E8B89A'
): DriverCharacterModel {
  const root = new THREE.Group();

  const suitMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(suitPrimaryHex),
    roughness: 0.72,
    metalness: 0.08,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(suitSecondaryHex),
    roughness: 0.62,
    metalness: 0.14,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x0f1218,
    roughness: 0.42,
    metalness: 0.25,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(suitSecondaryHex),
    roughness: 0.55,
    metalness: 0.12,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    map: carbonMap,
    color: 0x1d222b,
    roughness: 0.34,
    metalness: 0.65,
  });
  const helmetMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(helmetHex),
    metalness: 0.42,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(visorHex),
    emissive: new THREE.Color(visorHex),
    emissiveIntensity: 0.1,
    metalness: 0.78,
    roughness: 0.06,
    clearcoat: 1.0,
    iridescence: 0.88,
    iridescenceIOR: 1.45,
    transparent: true,
    opacity: 0.64,
  });
  const faceSkinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(skinToneHex),
    roughness: 0.52,
    metalness: 0.04,
  });
  const balaclavaMat = new THREE.MeshStandardMaterial({
    color: 0x0e1117,
    roughness: 0.85,
  });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const eyeIrisMat = new THREE.MeshBasicMaterial({ color: 0x181512 });

  // Pelvis / Hips Pivot (Standing height ~1.78m)
  const hipsGroup = new THREE.Group();
  hipsGroup.position.set(0, 0.94, 0);
  root.add(hipsGroup);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.22), suitMat);
  pelvis.castShadow = true;
  hipsGroup.add(pelvis);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.05, 0.23), trimMat);
  belt.position.y = 0.06;
  hipsGroup.add(belt);

  // Legs (Left & Right)
  const buildLeg = (side: -1 | 1) => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * 0.1, -0.06, 0);
    hipsGroup.add(hipPivot);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.28, 6, 12), suitMat);
    thigh.position.y = -0.2;
    thigh.castShadow = true;
    hipPivot.add(thigh);

    const kneeStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.082, 0.08, 12), trimMat);
    kneeStripe.position.y = -0.41;
    hipPivot.add(kneeStripe);

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.44, 0);
    hipPivot.add(kneePivot);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.066, 0.28, 6, 12), suitMat);
    shin.position.y = -0.18;
    shin.castShadow = true;
    kneePivot.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.24), bootMat);
    boot.position.set(0, -0.4, 0.05);
    boot.castShadow = true;
    kneePivot.add(boot);

    return { hipPivot, kneePivot };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Torso Pivot
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.1, 0);
  hipsGroup.add(torsoGroup);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.44, 0.23), suitMat);
  chest.position.y = 0.22;
  chest.castShadow = true;
  torsoGroup.add(chest);

  // Racing Suit Racing Stripes, Sponsor Chest Patches & Harness
  for (const s of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.43, 0.242), trimMat);
    stripe.position.set(s * 0.11, 0.22, 0);
    torsoGroup.add(stripe);

    const sponsorPatch = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.032, 0.008), eyeWhiteMat);
    sponsorPatch.position.set(s * 0.1, 0.31, 0.122);
    torsoGroup.add(sponsorPatch);

    const shoulderPad = new THREE.Mesh(new THREE.SphereGeometry(0.086, 12, 10), trimMat);
    shoulderPad.position.set(s * 0.22, 0.41, 0);
    shoulderPad.castShadow = true;
    torsoGroup.add(shoulderPad);
  }

  // HANS Collar
  const hansCollar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 10, 18, Math.PI * 1.45), carbonMat);
  hansCollar.rotation.x = Math.PI / 2 - 0.18;
  hansCollar.rotation.z = -Math.PI * 0.22;
  hansCollar.position.set(0, 0.45, -0.01);
  torsoGroup.add(hansCollar);

  // Arms
  const buildArm = (side: -1 | 1) => {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.23, 0.39, 0);
    torsoGroup.add(shoulderPivot);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.054, 0.2, 6, 10), suitMat);
    upperArm.position.y = -0.14;
    upperArm.castShadow = true;
    shoulderPivot.add(upperArm);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.28, 0);
    shoulderPivot.add(elbowPivot);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.18, 6, 10), suitMat);
    forearm.position.y = -0.12;
    forearm.castShadow = true;
    elbowPivot.add(forearm);

    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.095, 0.085), gloveMat);
    glove.position.set(0, -0.25, 0.01);
    glove.castShadow = true;
    elbowPivot.add(glove);

    return { shoulderPivot, elbowPivot, glove };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Trophy Mount attached between hands / above head for P1 Winner
  const trophyMount = new THREE.Group();
  trophyMount.position.set(0, 0.88, 0.18);
  torsoGroup.add(trophyMount);

  // Head & Formula Helmet + Focused Driver Face Inside Visor
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.56, 0.01);
  torsoGroup.add(headGroup);

  const helmetShell = new THREE.Mesh(new THREE.SphereGeometry(0.145, 22, 18), helmetMat);
  helmetShell.scale.set(0.95, 1.02, 1.12);
  helmetShell.castShadow = true;
  headGroup.add(helmetShell);

  const chinGuard = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.09, 0.14), helmetMat);
  chinGuard.position.set(0, -0.055, 0.08);
  headGroup.add(chinGuard);

  const aeroSpoiler = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.045, 0.09), trimMat);
  aeroSpoiler.position.set(0, 0.085, -0.13);
  aeroSpoiler.rotation.x = -0.25;
  headGroup.add(aeroSpoiler);

  // Inner Fireproof Balaclava & Sculpted Driver Face Band
  const balaclavaHead = new THREE.Mesh(new THREE.SphereGeometry(0.122, 16, 14), balaclavaMat);
  balaclavaHead.position.set(0, 0.008, 0.02);
  headGroup.add(balaclavaHead);

  const faceSkinBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.126, 0.126, 0.052, 18, 1, true, -0.72, 1.44),
    faceSkinMat
  );
  faceSkinBand.position.set(0, 0.012, 0.024);
  headGroup.add(faceSkinBand);

  for (const side of [-1, 1]) {
    const sclera = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.013, 0.01), eyeWhiteMat);
    sclera.position.set(side * 0.036, 0.014, 0.146);
    sclera.rotation.y = side * 0.18;
    headGroup.add(sclera);

    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.012, 0.012), eyeIrisMat);
    pupil.position.set(side * 0.035, 0.014, 0.148);
    pupil.rotation.y = side * 0.18;
    headGroup.add(pupil);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.006, 0.012), balaclavaMat);
    brow.position.set(side * 0.036, 0.024, 0.147);
    brow.rotation.z = side * -0.14;
    brow.rotation.y = side * 0.18;
    headGroup.add(brow);
  }

  const visorSponsorStrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.147, 0.147, 0.016, 22, 1, true, -0.92, 1.84),
    trimMat
  );
  visorSponsorStrip.position.set(0, 0.044, 0.025);
  headGroup.add(visorSponsorStrip);

  const visor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.146, 0.146, 0.08, 22, 1, true, -0.92, 1.84),
    visorMat
  );
  visor.position.set(0, 0.012, 0.025);
  headGroup.add(visor);

  return {
    root,
    trophyMount,
    applyStyle: (suitPrimary, suitSecondary, helmetCol, visorCol, skinToneCol) => {
      suitMat.color.set(suitPrimary);
      trimMat.color.set(suitSecondary);
      gloveMat.color.set(suitSecondary);
      helmetMat.color.set(helmetCol);
      visorMat.color.set(visorCol);
      visorMat.emissive.set(visorCol);
      if (skinToneCol) faceSkinMat.color.set(skinToneCol);
    },
    updateAnimation: (elapsedSec, mode, selectTimer = 0) => {
      const breathe = Math.sin(elapsedSec * 2.1);
      torsoGroup.position.y = 0.1 + breathe * 0.008;
      hipsGroup.position.y = 0.94;
      leftLeg.hipPivot.rotation.set(0, 0, 0.04);
      rightLeg.hipPivot.rotation.set(0, 0, -0.04);
      leftLeg.kneePivot.rotation.set(0, 0, 0);
      rightLeg.kneePivot.rotation.set(0, 0, 0);

      if (mode === 'select') {
        const pulse = Math.sin(Math.min(1, selectTimer * 1.4) * Math.PI);
        rightArm.shoulderPivot.rotation.set(-2.2 * pulse - 0.15, 0, -0.35 * pulse - 0.08);
        rightArm.elbowPivot.rotation.set(-0.6 * pulse - 0.25, 0, 0);
        leftArm.shoulderPivot.rotation.set(-0.2, 0, 0.14);
        leftArm.elbowPivot.rotation.set(-0.35, 0, 0);
        headGroup.rotation.set(-0.08 * pulse, Math.sin(elapsedSec * 1.5) * 0.12, 0);
        torsoGroup.rotation.set(0.05 * pulse, 0, 0);
      } else if (mode === 'podium_1') {
        // First Place: Raising Championship Trophy overhead with rhythmic celebration
        const lift = 0.5 + 0.5 * Math.sin(elapsedSec * 2.6);
        leftArm.shoulderPivot.rotation.set(-2.55 - lift * 0.22, 0, -0.22);
        leftArm.elbowPivot.rotation.set(-0.35, 0, 0.24);
        rightArm.shoulderPivot.rotation.set(-2.55 - lift * 0.22, 0, 0.22);
        rightArm.elbowPivot.rotation.set(-0.35, 0, -0.24);
        trophyMount.position.set(0, 0.72 + lift * 0.18, 0.14);
        headGroup.rotation.set(-0.18, Math.sin(elapsedSec * 1.4) * 0.25, 0);
        torsoGroup.rotation.set(-0.08, Math.sin(elapsedSec * 1.2) * 0.08, 0);
      } else if (mode === 'podium_2') {
        // Second Place: Applauding & celebrating
        const clap = Math.sin(elapsedSec * 8.5);
        leftArm.shoulderPivot.rotation.set(-1.15, 0.35, 0.15);
        leftArm.elbowPivot.rotation.set(-1.1, 0, -0.35 + clap * 0.2);
        rightArm.shoulderPivot.rotation.set(-1.15, -0.35, -0.15);
        rightArm.elbowPivot.rotation.set(-1.1, 0, 0.35 - clap * 0.2);
        headGroup.rotation.set(-0.06, -0.25 + Math.sin(elapsedSec * 1.6) * 0.12, 0);
        torsoGroup.rotation.set(0, -0.15, 0);
      } else if (mode === 'podium_3') {
        // Third Place: Waving to spectator crowd
        const wave = Math.sin(elapsedSec * 5.2);
        rightArm.shoulderPivot.rotation.set(-2.35, 0, -0.32 + wave * 0.25);
        rightArm.elbowPivot.rotation.set(-0.45 + wave * 0.22, 0, 0);
        leftArm.shoulderPivot.rotation.set(-0.22, 0, 0.18);
        leftArm.elbowPivot.rotation.set(-0.4, 0, 0);
        headGroup.rotation.set(-0.05, Math.sin(elapsedSec * 1.8) * 0.35, 0);
        torsoGroup.rotation.set(0, 0.12, 0);
      } else {
        // Idle: Confident racing stance with periodic helmet visor check
        const cycle = elapsedSec % 7.5;
        const visorCheck = cycle > 4.2 && cycle < 6.0 ? Math.sin(((cycle - 4.2) / 1.8) * Math.PI) : 0;

        leftArm.shoulderPivot.rotation.set(-0.12 + breathe * 0.03, 0, 0.11);
        leftArm.elbowPivot.rotation.set(-0.32, 0, 0);

        rightArm.shoulderPivot.rotation.set(-0.12 - visorCheck * 1.55, -visorCheck * 0.25, -0.11 - visorCheck * 0.1);
        rightArm.elbowPivot.rotation.set(-0.32 - visorCheck * 1.25, 0, 0);

        headGroup.rotation.set(
          breathe * 0.025 + visorCheck * 0.08,
          Math.sin(elapsedSec * 0.75) * 0.18,
          Math.cos(elapsedSec * 0.5) * 0.04
        );
        torsoGroup.rotation.set(0, Math.sin(elapsedSec * 0.45) * 0.05, 0);
      }
    },
    dispose: () => {
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
    },
  };
}
