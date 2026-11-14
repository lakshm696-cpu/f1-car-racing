import * as THREE from 'three';

export interface GarageWorkshopModel {
  root: THREE.Group;
  updateWorkshop: (
    dt: number,
    elapsedSec: number,
    teamAccentHex: string,
    doorsOpen: boolean,
    lightsOn?: boolean
  ) => void;
  dispose: () => void;
}

export function buildGarageWorkshop(carbonMap: THREE.Texture): GarageWorkshopModel {
  const root = new THREE.Group();

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0b0e14,
    metalness: 0.62,
    roughness: 0.16,
    envMapIntensity: 1.35,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x11151f,
    metalness: 0.38,
    roughness: 0.64,
  });
  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x222836,
    metalness: 0.8,
    roughness: 0.32,
  });
  const accentStripMat = new THREE.MeshStandardMaterial({
    color: 0xd91e2a,
    emissive: 0xd91e2a,
    emissiveIntensity: 1.85,
    roughness: 0.2,
  });
  const cabinetRedMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    metalness: 0.56,
    roughness: 0.32,
  });
  const tyreRubberMat = new THREE.MeshStandardMaterial({
    color: 0x121418,
    roughness: 0.78,
    metalness: 0.08,
  });
  const mechanicSuitMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.7,
  });
  const mechanicHelmetMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.3,
  });

  // 1. Polished Dark Showroom Floor + Turntable Plinth + Glowing Rim Ring
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.16;
  floor.receiveShadow = true;
  root.add(floor);

  const gridHelper = new THREE.GridHelper(28, 28, 0x2a3447, 0x151b26);
  gridHelper.position.y = -0.154;
  root.add(gridHelper);

  const turntableDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(3.45, 3.65, 0.12, 48),
    new THREE.MeshStandardMaterial({
      map: carbonMap,
      color: 0x181c24,
      metalness: 0.72,
      roughness: 0.2,
    })
  );
  turntableDeck.position.y = -0.1;
  turntableDeck.receiveShadow = true;
  root.add(turntableDeck);

  const turntableGlowRing = new THREE.Mesh(
    new THREE.RingGeometry(3.42, 3.54, 48),
    accentStripMat
  );
  turntableGlowRing.rotation.x = -Math.PI / 2;
  turntableGlowRing.position.y = -0.036;
  root.add(turntableGlowRing);

  // 2. Architectural Workshop Walls & Team Graphics Panels
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(28, 8.5, 0.5), wallMat);
  backWall.position.set(0, 4.0, -9.5);
  backWall.receiveShadow = true;
  root.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8.5, 22), wallMat);
  leftWall.position.set(-13.5, 4.0, 1.0);
  root.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8.5, 22), wallMat);
  rightWall.position.set(13.5, 4.0, 1.0);
  root.add(rightWall);

  // Glowing Team Wall Accent Strips
  for (const yPos of [1.6, 5.4]) {
    const backStrip = new THREE.Mesh(new THREE.BoxGeometry(24, 0.12, 0.12), accentStripMat);
    backStrip.position.set(0, yPos, -9.2);
    root.add(backStrip);
  }
  for (const xSide of [-13.2, 13.2]) {
    const sideStrip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 18), accentStripMat);
    sideStrip.position.set(xSide, 3.5, 1.0);
    root.add(sideStrip);
  }

  // Team Pit-Wall Telemetry & Strategy Screens on Back Wall
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 512;
  screenCanvas.height = 256;
  const sCtx = screenCanvas.getContext('2d');
  if (sCtx) {
    sCtx.fillStyle = '#070D19';
    sCtx.fillRect(0, 0, 512, 256);
    // Subtle telemetry grid
    sCtx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    sCtx.lineWidth = 1;
    for (let gx = 0; gx < 512; gx += 32) {
      sCtx.beginPath();
      sCtx.moveTo(gx, 0);
      sCtx.lineTo(gx, 256);
      sCtx.stroke();
    }
    for (let gy = 0; gy < 256; gy += 32) {
      sCtx.beginPath();
      sCtx.moveTo(0, gy);
      sCtx.lineTo(512, gy);
      sCtx.stroke();
    }
    // Header bar
    sCtx.fillStyle = '#0F172A';
    sCtx.fillRect(0, 0, 512, 34);
    sCtx.fillStyle = '#EF4444';
    sCtx.fillRect(0, 0, 120, 34);
    sCtx.fillStyle = '#FFFFFF';
    sCtx.font = 'bold 15px monospace';
    sCtx.fillText('FIA LIVE TELEMETRY // PIT WALL', 134, 22);
    // RPM / Speed / ERS trace curves
    const traces = [
      { col: '#38BDF8', yBase: 110, amp: 32, freq: 0.032 },
      { col: '#22C55E', yBase: 162, amp: 24, freq: 0.048 },
      { col: '#F59E0B', yBase: 208, amp: 18, freq: 0.025 },
    ];
    for (const tr of traces) {
      sCtx.strokeStyle = tr.col;
      sCtx.lineWidth = 3;
      sCtx.beginPath();
      for (let x = 16; x < 340; x += 6) {
        const y = tr.yBase + Math.sin(x * tr.freq) * tr.amp + Math.cos(x * 0.09) * 8;
        if (x === 16) sCtx.moveTo(x, y);
        else sCtx.lineTo(x, y);
      }
      sCtx.stroke();
    }
    // Right-hand Tyre Stint & Sector Delta Box
    sCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    sCtx.fillRect(356, 48, 142, 192);
    sCtx.strokeStyle = '#38BDF8';
    sCtx.strokeRect(356, 48, 142, 192);
    sCtx.fillStyle = '#94A3B8';
    sCtx.font = 'bold 12px monospace';
    sCtx.fillText('STINT WINDOW', 368, 70);
    sCtx.fillStyle = '#EF4444';
    sCtx.fillText('SOFT   L01-L18', 368, 96);
    sCtx.fillStyle = '#F59E0B';
    sCtx.fillText('MEDIUM L18-L42', 368, 118);
    sCtx.fillStyle = '#F8FAFC';
    sCtx.fillText('HARD   L42-L58', 368, 140);
    sCtx.fillStyle = '#22C55E';
    sCtx.fillText('ERS SOC   98%', 368, 178);
    sCtx.fillStyle = '#38BDF8';
    sCtx.fillText('DRS DELTA -0.34s', 368, 204);
  }
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;

  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTex,
    emissiveMap: screenTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.85,
    roughness: 0.18,
  });
  for (const sx of [-5.2, 0, 5.2]) {
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.9, 0.14), screenMat);
    monitor.position.set(sx, 3.6, -9.2);
    root.add(monitor);
  }

  // 3. Animated Rolling Garage Doors
  const doorLeft = new THREE.Mesh(new THREE.BoxGeometry(4.8, 5.2, 0.24), trussMat);
  doorLeft.position.set(-2.45, 2.45, 10.5);
  root.add(doorLeft);
  const doorRight = new THREE.Mesh(new THREE.BoxGeometry(4.8, 5.2, 0.24), trussMat);
  doorRight.position.set(2.45, 2.45, 10.5);
  root.add(doorRight);

  // 4. Overhead Steel Lighting Trusses + Light Strips + Dramatic Spotlights
  const lightBarMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xf1f5f9,
    emissiveIntensity: 2.6,
  });
  for (const zPos of [-4.5, 0, 4.5]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(26, 0.32, 0.36), trussMat);
    beam.position.set(0, 6.8, zPos);
    root.add(beam);

    const tube = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.1, 0.18), lightBarMat);
    tube.position.set(0, 6.58, zPos);
    root.add(tube);
  }

  // Dramatic Volumetric Showroom Spot Cones + Three.js SpotLights
  const spotConeMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.065,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const spotCones: THREE.Mesh[] = [];
  const showroomSpots: THREE.SpotLight[] = [];
  const spotTargets: THREE.Object3D[] = [];

  const spotSpecs: [number, number, number, number][] = [
    [0, 6.4, 2.6, 48], // Hero Front Key Spot
    [-3.2, 6.1, -1.8, 36], // Side Rim Spot
    [3.2, 6.1, -1.8, 36], // Opposite Rim Spot
  ];

  spotSpecs.forEach(([sx, sy, sz, intensity], idx) => {
    const targetObj = new THREE.Object3D();
    targetObj.position.set(0, 0.45, idx === 0 ? 0.8 : -0.6);
    root.add(targetObj);
    spotTargets.push(targetObj);

    const spot = new THREE.SpotLight(idx === 0 ? 0xfff8eb : 0xdbeafe, intensity, 18, Math.PI / 4.8, 0.65, 1.4);
    spot.position.set(sx, sy, sz);
    spot.target = targetObj;
    root.add(spot);
    showroomSpots.push(spot);

    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.35, 6.4, 20, 1, true), spotConeMat);
    cone.position.set(sx * 0.55, 3.25, sz * 0.55);
    cone.rotation.z = sx * 0.08;
    cone.rotation.x = -sz * 0.06;
    root.add(cone);
    spotCones.push(cone);
  });

  // Dramatic Team-Colored Underglow & Rear Rim Point Light
  const teamRimPoint = new THREE.PointLight(0xd91e2a, 14, 14, 1.5);
  teamRimPoint.position.set(0, 1.6, -4.4);
  root.add(teamRimPoint);

  // 5. Tool Cabinets & Workbenches
  for (const side of [-1, 1]) {
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.15, 0.85), cabinetRedMat);
    cabinet.position.set(side * 7.8, 0.42, -5.8);
    cabinet.castShadow = true;
    root.add(cabinet);

    const benchTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 0.08, 0.92),
      new THREE.MeshStandardMaterial({ map: carbonMap, color: 0x334155, metalness: 0.7, roughness: 0.3 })
    );
    benchTop.position.set(side * 7.8, 1.02, -5.8);
    root.add(benchTop);
  }

  // 6. Stacked Tyre Racks
  const tyreGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.34, 22);
  tyreGeo.rotateZ(Math.PI / 2);
  for (const zRack of [-3.2, -1.6, 0.0, 1.6]) {
    for (let tier = 0; tier < 2; tier++) {
      const spareTyre = new THREE.Mesh(tyreGeo, tyreRubberMat);
      spareTyre.position.set(-10.2, 0.65 + tier * 0.85, zRack);
      spareTyre.castShadow = true;
      root.add(spareTyre);
    }
  }
  const rackFrame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 6.2), trussMat);
  rackFrame.position.set(-10.6, 0.9, -0.8);
  root.add(rackFrame);

  // 7. Animated 3D Pit Crew Mechanics
  const buildMechanic = (x: number, z: number, rotY: number) => {
    const mech = new THREE.Group();
    mech.position.set(x, 0, z);
    mech.rotation.y = rotY;

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, 0.2), mechanicSuitMat);
    legs.position.y = 0.42;
    mech.add(legs);

    const torso = new THREE.Group();
    torso.position.y = 0.88;
    mech.add(torso);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.48, 0.22), mechanicSuitMat);
    body.position.y = 0.24;
    body.castShadow = true;
    torso.add(body);

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.23), accentStripMat);
    vest.position.y = 0.3;
    torso.add(vest);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), mechanicHelmetMat);
    head.position.y = 0.62;
    torso.add(head);

    const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.34, 4, 8), mechanicSuitMat);
    rightArm.position.set(0.24, 0.26, 0.14);
    rightArm.rotation.x = -0.9;
    torso.add(rightArm);

    const tablet = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.03, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x38bdf8, emissiveIntensity: 0.7 })
    );
    tablet.position.set(0.18, 0.2, 0.36);
    torso.add(tablet);

    root.add(mech);
    return { mech, torso, rightArm };
  };

  const mechInspector = buildMechanic(-3.9, 2.2, 0.95);
  const mechEngineer = buildMechanic(4.3, -1.8, -0.75);

  let doorProgress = 0;

  return {
    root,
    updateWorkshop: (dt, elapsedSec, teamAccentHex, doorsOpen, lightsOn = true) => {
      accentStripMat.color.set(teamAccentHex);
      accentStripMat.emissive.set(teamAccentHex);
      teamRimPoint.color.set(teamAccentHex);

      // Dramatic showroom lighting toggle: full overhead studio vs dramatic low-key spotlight mode
      lightBarMat.emissiveIntensity = lightsOn ? 2.6 : 0.35;
      spotConeMat.opacity = lightsOn ? 0.065 : 0.025;
      showroomSpots.forEach((spot, idx) => {
        const base = idx === 0 ? 48 : 36;
        spot.intensity = lightsOn ? base : base * 0.28;
      });
      teamRimPoint.intensity = lightsOn ? 14 : 20;

      const targetDoor = doorsOpen ? 1 : 0;
      doorProgress = THREE.MathUtils.damp(doorProgress, targetDoor, 3.2, dt);
      doorLeft.position.x = -2.45 - doorProgress * 4.4;
      doorRight.position.x = 2.45 + doorProgress * 4.4;

      mechInspector.torso.rotation.x = 0.22 + Math.sin(elapsedSec * 1.4) * 0.08;
      mechInspector.torso.rotation.y = Math.sin(elapsedSec * 0.9) * 0.16;

      mechEngineer.torso.rotation.y = Math.sin(elapsedSec * 1.1 + 1.2) * 0.22;
      mechEngineer.rightArm.rotation.x = -0.9 + Math.sin(elapsedSec * 2.2) * 0.12;
    },
    dispose: () => {
      screenTex.dispose();
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
