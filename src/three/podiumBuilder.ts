import * as THREE from 'three';
import { RacerStanding } from '../types/racing';
import { buildDriverCharacter, DriverCharacterModel } from './driverBuilder';

export interface PodiumStageModel {
  root: THREE.Group;
  trophyGroup: THREE.Group;
  winnerPos: THREE.Vector3;
  activatePodium: (standings: RacerStanding[]) => void;
  updatePodium: (dt: number, elapsedSec: number) => void;
  dispose: () => void;
}

export function buildPodiumStage(carbonMap: THREE.Texture): PodiumStageModel {
  const root = new THREE.Group();

  const stageMat = new THREE.MeshStandardMaterial({
    color: 0x0e121b,
    metalness: 0.72,
    roughness: 0.2,
  });
  const plinthMat = new THREE.MeshStandardMaterial({
    map: carbonMap,
    color: 0x161c28,
    metalness: 0.58,
    roughness: 0.26,
  });
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xfacc15,
    metalness: 0.98,
    roughness: 0.11,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    emissive: 0x854d0e,
    emissiveIntensity: 0.28,
    envMapIntensity: 1.75,
  });

  // Main Stage Floor
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 10.2, 0.35, 48), stageMat);
  floor.position.y = -0.175;
  floor.receiveShadow = true;
  root.add(floor);

  const stageRing = new THREE.Mesh(
    new THREE.RingGeometry(8.8, 9.0, 48),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 1.3, side: THREE.DoubleSide })
  );
  stageRing.rotation.x = -Math.PI / 2;
  stageRing.position.y = 0.01;
  root.add(stageRing);

  // P1, P2, P3 Platforms
  const stepSpecs = [
    { pos: [0, 0.65, 0], h: 1.3, col: 0xfacc15 }, // 1st Place (Center Gold)
    { pos: [-2.1, 0.42, 0.35], h: 0.84, col: 0xcbd5e1 }, // 2nd Place (Silver)
    { pos: [2.1, 0.28, 0.45], h: 0.56, col: 0xd97706 }, // 3rd Place (Bronze)
  ];

  const trimMats: THREE.MeshStandardMaterial[] = [];
  stepSpecs.forEach((spec) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.75, spec.h, 1.6), plinthMat);
    box.position.set(spec.pos[0], spec.h * 0.5, spec.pos[2]);
    box.castShadow = true;
    box.receiveShadow = true;
    root.add(box);

    const trimMat = new THREE.MeshStandardMaterial({
      color: spec.col,
      emissive: spec.col,
      emissiveIntensity: 1.75,
    });
    trimMats.push(trimMat);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.09, 1.66), trimMat);
    trim.position.set(spec.pos[0], spec.h - 0.04, spec.pos[2]);
    root.add(trim);
  });

  // Backdrop Team Banner Wall
  const backdrop = new THREE.Mesh(
    new THREE.BoxGeometry(14, 4.6, 0.3),
    new THREE.MeshStandardMaterial({ map: carbonMap, color: 0x0b0f17, roughness: 0.42, metalness: 0.36 })
  );
  backdrop.position.set(0, 2.3, -2.4);
  root.add(backdrop);

  const bannerTrimMat = new THREE.MeshStandardMaterial({
    color: 0xd91e2a,
    emissive: 0xd91e2a,
    emissiveIntensity: 1.5,
  });
  const bannerBar = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.24, 0.36), bannerTrimMat);
  bannerBar.position.set(0, 4.2, -2.35);
  root.add(bannerBar);

  // Waving Racing Flags
  const flags: THREE.Mesh[] = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.2 });
  const flagColors = [0xef4444, 0xf8fafc, 0xf59e0b, 0x38bdf8];
  for (let i = 0; i < 4; i++) {
    const fx = i < 2 ? -5.2 + i * 1.1 : 4.1 + (i - 2) * 1.1;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 5.2, 8), poleMat);
    pole.position.set(fx, 2.6, -1.8);
    root.add(pole);

    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 0.72, 6, 2),
      new THREE.MeshStandardMaterial({ color: flagColors[i], side: THREE.DoubleSide, roughness: 0.55 })
    );
    flag.position.set(fx + 0.58, 4.75, -1.8);
    root.add(flag);
    flags.push(flag);
  }

  // Dramatic Stage Spotlights & Camera Flashes
  const stageBeams: THREE.Mesh[] = [];
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const bx of [-3.4, 0, 3.4]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 8.5, 16, 1, true), beamMat);
    cone.position.set(bx, 4.8, 0.2);
    cone.rotation.z = bx * -0.06;
    root.add(cone);
    stageBeams.push(cone);
  }

  const trophySpotlight = new THREE.PointLight(0xfef08a, 10, 7, 1.4);
  trophySpotlight.position.set(0.4, 3.3, 1.1);
  root.add(trophySpotlight);

  const flashMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
  );
  flashMesh.position.set(3.2, 1.8, 5.2);
  root.add(flashMesh);

  // 3 Animated Podium Drivers (P1, P2, P3)
  const driverP1: DriverCharacterModel = buildDriverCharacter(carbonMap);
  const driverP2: DriverCharacterModel = buildDriverCharacter(carbonMap);
  const driverP3: DriverCharacterModel = buildDriverCharacter(carbonMap);

  driverP1.root.position.set(0, 1.3, 0);
  driverP2.root.position.set(-2.1, 0.84, 0.35);
  driverP3.root.position.set(2.1, 0.56, 0.45);

  root.add(driverP1.root);
  root.add(driverP2.root);
  root.add(driverP3.root);

  // Showpiece Sculpted Championship Gold Trophy attached to P1 Winner's Hands
  const trophyGroup = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.14, 24), stageMat);
  trophyGroup.add(base);

  const baseCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.145, 0.04, 24), goldMat);
  baseCollar.position.y = 0.08;
  trophyGroup.add(baseCollar);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.085, 0.28, 18), goldMat);
  stem.position.y = 0.23;
  trophyGroup.add(stem);

  const stemNode = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 14), goldMat);
  stemNode.position.y = 0.25;
  trophyGroup.add(stemNode);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.085, 0.36, 26), goldMat);
  cup.position.y = 0.53;
  trophyGroup.add(cup);

  const crownRim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 10, 26), goldMat);
  crownRim.rotation.x = Math.PI / 2;
  crownRim.position.y = 0.71;
  trophyGroup.add(crownRim);

  for (const s of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 10, 18), goldMat);
    handle.position.set(s * 0.2, 0.54, 0);
    handle.rotation.z = s * 0.15;
    trophyGroup.add(handle);
  }
  driverP1.trophyMount.add(trophyGroup);

  // Tumbling 3D Metallic Foil Confetti Ribbons (InstancedMesh, 260 pieces)
  const confettiCount = 260;
  const confettiGeo = new THREE.PlaneGeometry(0.14, 0.075);
  const confettiMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.72,
    roughness: 0.22,
    emissive: 0x222222,
    side: THREE.DoubleSide,
  });
  const confettiMesh = new THREE.InstancedMesh(confettiGeo, confettiMat, confettiCount);
  confettiMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const palette = [
    new THREE.Color('#FACC15'), // Gold
    new THREE.Color('#EF4444'), // Racing Red
    new THREE.Color('#38BDF8'), // Telemetry Cyan
    new THREE.Color('#F8FAFC'), // Crisp White
    new THREE.Color('#10B981'), // Emerald
  ];

  interface ConfettiState {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    rx: number;
    ry: number;
    rz: number;
    vrx: number;
    vry: number;
    vrz: number;
    phase: number;
  }

  const confettiData: ConfettiState[] = [];
  const resetConfetti = (c: ConfettiState, randomHeight: boolean) => {
    c.x = (Math.random() - 0.5) * 10.5;
    c.y = randomHeight ? 0.6 + Math.random() * 6.5 : 6.4 + Math.random() * 2.4;
    c.z = (Math.random() - 0.5) * 6.5;
    c.vx = (Math.random() - 0.5) * 1.1;
    c.vy = -(1.25 + Math.random() * 1.45);
    c.vz = (Math.random() - 0.5) * 1.1;
    c.rx = Math.random() * Math.PI * 2;
    c.ry = Math.random() * Math.PI * 2;
    c.rz = Math.random() * Math.PI * 2;
    c.vrx = (Math.random() - 0.5) * 9;
    c.vry = (Math.random() - 0.5) * 9;
    c.vrz = (Math.random() - 0.5) * 7;
    c.phase = Math.random() * Math.PI * 2;
  };

  for (let i = 0; i < confettiCount; i++) {
    const c: ConfettiState = {
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      vrx: 0,
      vry: 0,
      vrz: 0,
      phase: 0,
    };
    resetConfetti(c, true);
    confettiData.push(c);
    confettiMesh.setColorAt(i, palette[i % palette.length]);
  }
  if (confettiMesh.instanceColor) confettiMesh.instanceColor.needsUpdate = true;
  root.add(confettiMesh);

  const dummyObj = new THREE.Object3D();
  let walkInTimer = 0;

  return {
    root,
    trophyGroup,
    winnerPos: new THREE.Vector3(0, 2.35, 0),
    activatePodium: (standings) => {
      walkInTimer = 0;
      const s1 = standings[0];
      const s2 = standings[1] ?? s1;
      const s3 = standings[2] ?? s1;

      if (s1) {
        driverP1.applyStyle(s1.color, s1.secondaryColor, s1.helmetColor, '#F59E0B');
        bannerTrimMat.color.set(s1.color);
        bannerTrimMat.emissive.set(s1.color);
      }
      if (s2) driverP2.applyStyle(s2.color, s2.secondaryColor, s2.helmetColor, '#38BDF8');
      if (s3) driverP3.applyStyle(s3.color, s3.secondaryColor, s3.helmetColor, '#10B981');
    },
    updatePodium: (dt, elapsedSec) => {
      walkInTimer += dt;
      const walkProgress = Math.min(1, walkInTimer / 1.4);
      const stepOffset = (1 - walkProgress) * -0.9;

      driverP1.root.position.set(0, 1.3, stepOffset);
      driverP2.root.position.set(-2.1, 0.84, 0.35 + stepOffset);
      driverP3.root.position.set(2.1, 0.56, 0.45 + stepOffset);

      driverP1.updateAnimation(elapsedSec, 'podium_1');
      driverP2.updateAnimation(elapsedSec, 'podium_2');
      driverP3.updateAnimation(elapsedSec, 'podium_3');

      flags.forEach((f, idx) => {
        f.rotation.y = Math.sin(elapsedSec * 3.8 + idx) * 0.22;
      });

      stageBeams.forEach((b, idx) => {
        b.rotation.x = Math.sin(elapsedSec * 1.2 + idx * 1.4) * 0.09;
      });

      const flashMat = flashMesh.material as THREE.MeshBasicMaterial;
      if (Math.random() < 0.09) {
        flashMesh.position.set((Math.random() - 0.5) * 9, 1.2 + Math.random() * 1.8, 3.8 + Math.random() * 2.5);
        flashMat.opacity = 0.95;
      } else {
        flashMat.opacity = Math.max(0, flashMat.opacity - dt * 6);
      }

      // Fluttering 3D confetti ribbons
      for (let i = 0; i < confettiCount; i++) {
        const c = confettiData[i];
        c.x += (c.vx + Math.sin(elapsedSec * 2.6 + c.phase) * 0.55) * dt;
        c.y += c.vy * dt;
        c.z += (c.vz + Math.cos(elapsedSec * 2.1 + c.phase) * 0.4) * dt;
        c.rx += c.vrx * dt;
        c.ry += c.vry * dt;
        c.rz += c.vrz * dt;
        if (c.y < 0.05) {
          resetConfetti(c, false);
        }
        dummyObj.position.set(c.x, c.y, c.z);
        dummyObj.rotation.set(c.rx, c.ry, c.rz);
        dummyObj.updateMatrix();
        confettiMesh.setMatrixAt(i, dummyObj.matrix);
      }
      confettiMesh.instanceMatrix.needsUpdate = true;
    },
    dispose: () => {
      driverP1.dispose();
      driverP2.dispose();
      driverP3.dispose();
      confettiGeo.dispose();
      confettiMat.dispose();
      confettiMesh.dispose();
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
