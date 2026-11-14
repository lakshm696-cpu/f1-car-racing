export interface SpatialCarAudioInput {
  relX: number; // positive = right of camera
  relY: number; // positive = above camera
  relZ: number; // positive = ahead of camera (mapped to -Z in Web Audio camera space)
  radialVel: number; // positive = moving away from camera, negative = approaching
  rpm: number;
  maxRpm: number;
  speedMs: number;
  throttle: number;
}

export interface TelemetryAudioInput {
  rpm: number;
  maxRpm: number;
  throttle: number;
  brake: number;
  speedMs: number;
  slipAmount: number;
  drsOpen: boolean;
  onKerb: boolean;
  offTrack: boolean;
  active: boolean;
}

const SPEED_OF_SOUND = 343;

export class RacingAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private stadiumVerb: ConvolverNode | null = null;
  private verbSend: GainNode | null = null;
  private verbReturn: GainNode | null = null;

  // Player 1.6L V6 Hybrid Power Unit
  private engineBus: GainNode | null = null;
  private engineHaasDelay: DelayNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineBodyPeak: BiquadFilterNode | null = null;
  private engineFormant: BiquadFilterNode | null = null;
  private oscCrankSub: OscillatorNode | null = null;
  private oscFiringPrimary: OscillatorNode | null = null;
  private oscExhaustBark: OscillatorNode | null = null;
  private oscHarmonicTop: OscillatorNode | null = null;
  private oscCombustionFm: OscillatorNode | null = null;
  private combustionFmGain: GainNode | null = null;
  private oscTurboWhine: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;
  private oscMgukWhine: OscillatorNode | null = null;
  private mgukGain: GainNode | null = null;
  private engineLopeLfo: OscillatorNode | null = null;
  private engineLopeGain: GainNode | null = null;

  // Racing Foley: Tyre Screech, Road Contact, Cockpit Wind/Aero, Rain
  private tyreGain: GainNode | null = null;
  private tyreFilterLow: BiquadFilterNode | null = null;
  private tyreFilterHigh: BiquadFilterNode | null = null;
  private roadGain: GainNode | null = null;
  private roadFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;

  // Shared Noise Buffer
  private noiseBuffer: AudioBuffer | null = null;

  // 3D HRTF Spatial AI Cars Pool (360-deg surround + Doppler pitch shift)
  private spatialVoices: {
    oscA: OscillatorNode;
    oscB: OscillatorNode;
    oscC: OscillatorNode;
    filter: BiquadFilterNode;
    panner: PannerNode;
    gain: GainNode;
    wasNear: boolean;
  }[] = [];

  // Cinematic Surround Atmosphere: Stereo Crowd Bed + Trailer Score + Continuous String Pad
  private crowdGain: GainNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private trailerMusicGain: GainNode | null = null;
  private padGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private padOscs: OscillatorNode[] = [];

  private scoreTimerAccum = 0;
  private scoreBeatIndex = 0;
  private lastTrailerScene = -1;
  private lastWhooshTime = 0;
  private lastKerbTime = 0;
  private lastOverrunTime = 0;
  private lastRadioTime = -10;
  private lastTensionPulse = -1;
  private prevThrottle = 0;

  private muted = false;
  private initialized = false;

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.62, this.ctx.currentTime, 0.05);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isReady(): boolean {
    return this.initialized && this.ctx?.state === 'running';
  }

  private createStadiumImpulse(ctx: AudioContext): AudioBuffer {
    const duration = 1.85;
    const len = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    let lpL = 0;
    let lpR = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // Sharp early grandstand slapbacks + smooth exponential stadium tail
      const earlyBoost =
        (i > ctx.sampleRate * 0.025 && i < ctx.sampleRate * 0.032) ||
        (i > ctx.sampleRate * 0.068 && i < ctx.sampleRate * 0.076) ||
        (i > ctx.sampleRate * 0.115 && i < ctx.sampleRate * 0.124)
          ? 1.75
          : 1.0;
      const env = Math.pow(1 - t, 2.65) * earlyBoost;
      const wL = (Math.random() * 2 - 1) * env;
      const wR = (Math.random() * 2 - 1) * env;
      lpL = lpL * 0.62 + wL * 0.38;
      lpR = lpR * 0.62 + wR * 0.38;
      left[i] = lpL * 0.42;
      right[i] = lpR * 0.42;
    }
    return impulse;
  }

  public unlock() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume().then(() => {
          window.dispatchEvent(new CustomEvent('ufr-audio-unlocked'));
        });
      }
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      // Configure 3D AudioListener at camera origin (right-handed camera space)
      const listener = ctx.listener;
      if (listener.positionX) {
        listener.positionX.value = 0;
        listener.positionY.value = 0;
        listener.positionZ.value = 0;
        listener.forwardX.value = 0;
        listener.forwardY.value = 0;
        listener.forwardZ.value = -1;
        listener.upX.value = 0;
        listener.upY.value = 1;
        listener.upZ.value = 0;
      }

      // HDR Broadcast Mastering Compressor -> Master Gain
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -13;
      compressor.knee.value = 12;
      compressor.ratio.value = 3.5;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.62;
      compressor.connect(master);
      master.connect(ctx.destination);

      this.compressor = compressor;
      this.masterGain = master;

      // True Convolution Stadium / Concert Hall Surround Reverb
      const stadiumVerb = ctx.createConvolver();
      stadiumVerb.buffer = this.createStadiumImpulse(ctx);
      const verbSend = ctx.createGain();
      verbSend.gain.value = 0.36;
      const verbReturn = ctx.createGain();
      verbReturn.gain.value = 0.72;
      verbSend.connect(stadiumVerb);
      stadiumVerb.connect(verbReturn);
      verbReturn.connect(compressor);

      this.stadiumVerb = stadiumVerb;
      this.verbSend = verbSend;
      this.verbReturn = verbReturn;

      // Shared 2-second Pink-Weighted Noise Buffer
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        output[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.1848) * 0.24));
      }
      this.noiseBuffer = noiseBuffer;

      // ── 1. Formula 1 1.6L V6 Hybrid Power Unit (FM Combustion + Resonant Exhaust) ──
      const engineBodyPeak = ctx.createBiquadFilter();
      engineBodyPeak.type = 'peaking';
      engineBodyPeak.frequency.value = 240;
      engineBodyPeak.Q.value = 1.6;
      engineBodyPeak.gain.value = 5.5;

      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 1100;
      engineFilter.Q.value = 1.6;

      const engineFormant = ctx.createBiquadFilter();
      engineFormant.type = 'peaking';
      engineFormant.frequency.value = 1480;
      engineFormant.Q.value = 2.8;
      engineFormant.gain.value = 7.5;

      // Asymmetric exhaust manifold saturation
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(512);
      for (let i = 0; i < 512; i++) {
        const x = (i * 2) / 512 - 1;
        curve[i] = Math.tanh(x * 2.7 + x * x * 0.35);
      }
      shaper.curve = curve;

      const engineBus = ctx.createGain();
      engineBus.gain.value = 0;

      const oscCrankSub = ctx.createOscillator();
      oscCrankSub.type = 'triangle';
      oscCrankSub.frequency.value = 55;

      const oscFiringPrimary = ctx.createOscillator();
      oscFiringPrimary.type = 'sawtooth';
      oscFiringPrimary.frequency.value = 110;

      const oscExhaustBark = ctx.createOscillator();
      oscExhaustBark.type = 'sawtooth';
      oscExhaustBark.frequency.value = 220;

      const oscHarmonicTop = ctx.createOscillator();
      oscHarmonicTop.type = 'triangle';
      oscHarmonicTop.frequency.value = 330;

      // Combustion roughness FM modulator (eliminates sterile synth tone)
      const oscCombustionFm = ctx.createOscillator();
      oscCombustionFm.type = 'sawtooth';
      oscCombustionFm.frequency.value = 55;
      const combustionFmGain = ctx.createGain();
      combustionFmGain.gain.value = 18;
      oscCombustionFm.connect(combustionFmGain);
      combustionFmGain.connect(oscFiringPrimary.frequency);
      combustionFmGain.connect(oscExhaustBark.frequency);

      const subGain = ctx.createGain();
      subGain.gain.value = 0.52;
      const primaryGain = ctx.createGain();
      primaryGain.gain.value = 0.58;
      const barkGain = ctx.createGain();
      barkGain.gain.value = 0.38;
      const topGain = ctx.createGain();
      topGain.gain.value = 0.24;

      // Idle combustion lope
      const engineLopeLfo = ctx.createOscillator();
      engineLopeLfo.type = 'sine';
      engineLopeLfo.frequency.value = 13.5;
      const engineLopeGain = ctx.createGain();
      engineLopeGain.gain.value = 8;
      engineLopeLfo.connect(engineLopeGain);
      engineLopeGain.connect(oscFiringPrimary.frequency);

      oscCrankSub.connect(subGain);
      oscFiringPrimary.connect(primaryGain);
      oscExhaustBark.connect(barkGain);
      oscHarmonicTop.connect(topGain);

      subGain.connect(shaper);
      primaryGain.connect(shaper);
      barkGain.connect(shaper);
      topGain.connect(shaper);

      shaper.connect(engineBodyPeak);
      engineBodyPeak.connect(engineFilter);
      engineFilter.connect(engineFormant);
      engineFormant.connect(engineBus);

      // Turbocharger compressor whine + MGU-K hybrid whine
      const oscTurboWhine = ctx.createOscillator();
      oscTurboWhine.type = 'sine';
      oscTurboWhine.frequency.value = 2200;
      const turboGain = ctx.createGain();
      turboGain.gain.value = 0;
      oscTurboWhine.connect(turboGain);
      turboGain.connect(engineBus);

      const oscMgukWhine = ctx.createOscillator();
      oscMgukWhine.type = 'triangle';
      oscMgukWhine.frequency.value = 680;
      const mgukGain = ctx.createGain();
      mgukGain.gain.value = 0;
      oscMgukWhine.connect(mgukGain);
      mgukGain.connect(engineBus);

      // Surround Haas Stereo Widener on player exhaust + stadium reflections
      const enginePanL = ctx.createStereoPanner();
      enginePanL.pan.value = -0.18;
      const enginePanR = ctx.createStereoPanner();
      enginePanR.pan.value = 0.22;
      const engineHaasDelay = ctx.createDelay(0.05);
      engineHaasDelay.delayTime.value = 0.0075;
      const haasWet = ctx.createGain();
      haasWet.gain.value = 0.42;

      engineBus.connect(enginePanL);
      enginePanL.connect(compressor);
      engineBus.connect(engineHaasDelay);
      engineHaasDelay.connect(haasWet);
      haasWet.connect(enginePanR);
      enginePanR.connect(compressor);
      engineBus.connect(verbSend);

      oscCrankSub.start();
      oscFiringPrimary.start();
      oscExhaustBark.start();
      oscHarmonicTop.start();
      oscCombustionFm.start();
      oscTurboWhine.start();
      oscMgukWhine.start();
      engineLopeLfo.start();

      this.engineBus = engineBus;
      this.engineHaasDelay = engineHaasDelay;
      this.engineBodyPeak = engineBodyPeak;
      this.engineFilter = engineFilter;
      this.engineFormant = engineFormant;
      this.oscCrankSub = oscCrankSub;
      this.oscFiringPrimary = oscFiringPrimary;
      this.oscExhaustBark = oscExhaustBark;
      this.oscHarmonicTop = oscHarmonicTop;
      this.oscCombustionFm = oscCombustionFm;
      this.combustionFmGain = combustionFmGain;
      this.oscTurboWhine = oscTurboWhine;
      this.turboGain = turboGain;
      this.oscMgukWhine = oscMgukWhine;
      this.mgukGain = mgukGain;
      this.engineLopeLfo = engineLopeLfo;
      this.engineLopeGain = engineLopeGain;

      // ── 2. Dual-Band Tyre Squeal, Road Contact & Cockpit Aero Wind ───────
      const tyreSrc = ctx.createBufferSource();
      tyreSrc.buffer = noiseBuffer;
      tyreSrc.loop = true;

      const tyreFilterLow = ctx.createBiquadFilter();
      tyreFilterLow.type = 'bandpass';
      tyreFilterLow.frequency.value = 920;
      tyreFilterLow.Q.value = 5.2;

      const tyreFilterHigh = ctx.createBiquadFilter();
      tyreFilterHigh.type = 'bandpass';
      tyreFilterHigh.frequency.value = 1640;
      tyreFilterHigh.Q.value = 6.0;

      const tyreGain = ctx.createGain();
      tyreGain.gain.value = 0;
      tyreSrc.connect(tyreFilterLow);
      tyreSrc.connect(tyreFilterHigh);
      tyreFilterLow.connect(tyreGain);
      tyreFilterHigh.connect(tyreGain);
      tyreGain.connect(compressor);
      tyreGain.connect(verbSend);
      tyreSrc.start();

      const roadSrc = ctx.createBufferSource();
      roadSrc.buffer = noiseBuffer;
      roadSrc.loop = true;
      const roadFilter = ctx.createBiquadFilter();
      roadFilter.type = 'lowpass';
      roadFilter.frequency.value = 180;
      roadFilter.Q.value = 1.2;
      const roadGain = ctx.createGain();
      roadGain.gain.value = 0;
      roadSrc.connect(roadFilter);
      roadFilter.connect(roadGain);
      roadGain.connect(compressor);
      roadSrc.start();

      const windSrc = ctx.createBufferSource();
      windSrc.buffer = noiseBuffer;
      windSrc.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 650;
      windFilter.Q.value = 0.85;
      const windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(compressor);
      windSrc.start();

      const rainSrc = ctx.createBufferSource();
      rainSrc.buffer = noiseBuffer;
      rainSrc.loop = true;
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.value = 2600;
      rainFilter.Q.value = 0.7;
      const rainGain = ctx.createGain();
      rainGain.gain.value = 0;
      rainSrc.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(compressor);
      rainSrc.start();

      this.tyreFilterLow = tyreFilterLow;
      this.tyreFilterHigh = tyreFilterHigh;
      this.tyreGain = tyreGain;
      this.roadFilter = roadFilter;
      this.roadGain = roadGain;
      this.windFilter = windFilter;
      this.windGain = windGain;
      this.rainGain = rainGain;

      // ── 3. 3D HRTF Spatial AI Car Pool (Full 360-degree Surround + Doppler) ──
      for (let i = 0; i < 3; i++) {
        const oscA = ctx.createOscillator();
        oscA.type = 'sawtooth';
        oscA.frequency.value = 140;
        const oscB = ctx.createOscillator();
        oscB.type = 'sawtooth';
        oscB.frequency.value = 280;
        const oscC = ctx.createOscillator();
        oscC.type = 'triangle';
        oscC.frequency.value = 70;
        const bGain = ctx.createGain();
        bGain.gain.value = 0.45;
        const cGain = ctx.createGain();
        cGain.gain.value = 0.48;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1600;
        filter.Q.value = 2.0;

        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 8;
        panner.maxDistance = 150;
        panner.rolloffFactor = 1.15;

        const gain = ctx.createGain();
        gain.gain.value = 0;

        oscA.connect(filter);
        oscB.connect(bGain);
        bGain.connect(filter);
        oscC.connect(cGain);
        cGain.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(compressor);
        gain.connect(verbSend);

        oscA.start();
        oscB.start();
        oscC.start();

        this.spatialVoices.push({ oscA, oscB, oscC, filter, panner, gain, wasNear: false });
      }

      // ── 4. Wide Stadium Crowd Ambience & Symphonic Cinematic Score ────────
      const crowdSrc = ctx.createBufferSource();
      crowdSrc.buffer = noiseBuffer;
      crowdSrc.loop = true;
      const crowdFilter = ctx.createBiquadFilter();
      crowdFilter.type = 'bandpass';
      crowdFilter.frequency.value = 820;
      crowdFilter.Q.value = 0.6;
      const crowdGain = ctx.createGain();
      crowdGain.gain.value = 0;
      crowdSrc.connect(crowdFilter);
      crowdFilter.connect(crowdGain);
      crowdGain.connect(compressor);
      crowdGain.connect(verbSend);
      crowdSrc.start();

      const trailerMusicGain = ctx.createGain();
      trailerMusicGain.gain.value = 0.9;
      trailerMusicGain.connect(compressor);

      // Continuous Wide Orchestral String/Brass Pad (D2, A2, D3, F3 detuned surround ensemble)
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 620;
      padFilter.Q.value = 0.9;
      const padGain = ctx.createGain();
      padGain.gain.value = 0;
      padFilter.connect(padGain);
      padGain.connect(trailerMusicGain);
      padGain.connect(verbSend);

      const padSpecs: [number, number][] = [
        [73.42, -0.45],
        [73.71, 0.45],
        [110.0, -0.22],
        [146.83, 0.22],
        [174.61, 0.0],
      ];
      for (const [hz, panVal] of padSpecs) {
        const po = ctx.createOscillator();
        po.type = 'sawtooth';
        po.frequency.value = hz;
        const pPan = ctx.createStereoPanner();
        pPan.pan.value = panVal;
        const pVol = ctx.createGain();
        pVol.gain.value = 0.16;
        po.connect(pVol);
        pVol.connect(pPan);
        pPan.connect(padFilter);
        po.start();
        this.padOscs.push(po);
      }

      this.crowdFilter = crowdFilter;
      this.crowdGain = crowdGain;
      this.trailerMusicGain = trailerMusicGain;
      this.padFilter = padFilter;
      this.padGain = padGain;
      this.initialized = true;
      window.dispatchEvent(new CustomEvent('ufr-audio-unlocked'));
    } catch {
      // AudioContext blocked or unavailable
    }
  }

  public setRainLevel(level: number) {
    if (!this.initialized || !this.ctx || !this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(Math.max(0, Math.min(0.18, level)), this.ctx.currentTime, 0.2);
  }

  public updateEngine(rpm: number, maxRpm: number, throttle: number, slipAmount: number, active: boolean) {
    this.updateTelemetry({
      rpm,
      maxRpm,
      throttle,
      brake: 0,
      speedMs: active ? (rpm / Math.max(1, maxRpm)) * 75 : 0,
      slipAmount,
      drsOpen: false,
      onKerb: false,
      offTrack: false,
      active,
    });
  }

  public updateTelemetry(input: TelemetryAudioInput) {
    if (
      !this.initialized ||
      !this.ctx ||
      !this.engineBus ||
      !this.engineBodyPeak ||
      !this.engineFilter ||
      !this.engineFormant ||
      !this.oscCrankSub ||
      !this.oscFiringPrimary ||
      !this.oscExhaustBark ||
      !this.oscHarmonicTop ||
      !this.oscCombustionFm ||
      !this.combustionFmGain ||
      !this.oscTurboWhine ||
      !this.turboGain ||
      !this.oscMgukWhine ||
      !this.mgukGain ||
      !this.engineLopeGain ||
      !this.tyreGain ||
      !this.tyreFilterLow ||
      !this.tyreFilterHigh ||
      !this.roadGain ||
      !this.roadFilter ||
      !this.windGain ||
      !this.windFilter
    ) {
      return;
    }

    const now = this.ctx.currentTime;
    if (!input.active) {
      this.engineBus.gain.setTargetAtTime(0, now, 0.08);
      this.tyreGain.gain.setTargetAtTime(0, now, 0.06);
      this.roadGain.gain.setTargetAtTime(0, now, 0.06);
      this.windGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    const rpmNorm = Math.max(0.12, Math.min(1.06, input.rpm / Math.max(1, input.maxRpm)));
    const speedNorm = Math.max(0, Math.min(1.15, Math.abs(input.speedMs) / 88));

    // V6 firing harmonics (crank sub + 3x V6 primary firing + 2nd/3rd exhaust order)
    const primaryHz = 74 + rpmNorm * 326;
    this.oscCrankSub.frequency.setTargetAtTime(primaryHz * 0.5, now, 0.02);
    this.oscFiringPrimary.frequency.setTargetAtTime(primaryHz, now, 0.018);
    this.oscExhaustBark.frequency.setTargetAtTime(primaryHz * 1.997, now, 0.018);
    this.oscHarmonicTop.frequency.setTargetAtTime(primaryHz * 3.012, now, 0.02);

    // Subtle mechanical combustion FM grit
    this.oscCombustionFm.frequency.setTargetAtTime(primaryHz * 0.333, now, 0.025);
    this.combustionFmGain.gain.setTargetAtTime(10 + rpmNorm * 22 + input.throttle * 12, now, 0.03);

    // Idle rumble lope fades out smoothly above idle
    const idleAmount = Math.max(0, 1 - (rpmNorm - 0.24) * 3.2);
    this.engineLopeGain.gain.setTargetAtTime(idleAmount * 10.5, now, 0.05);

    this.engineFilter.frequency.setTargetAtTime(
      460 + rpmNorm * 3100 + input.throttle * 780,
      now,
      0.03
    );
    this.engineBodyPeak.frequency.setTargetAtTime(210 + rpmNorm * 140, now, 0.04);
    this.engineFormant.frequency.setTargetAtTime(980 + rpmNorm * 1750, now, 0.04);

    // Turbocharger spool & MGU-K hybrid regeneration whine
    this.oscTurboWhine.frequency.setTargetAtTime(1900 + rpmNorm * 4500 + input.throttle * 820, now, 0.05);
    const turboVol = Math.max(0, (rpmNorm - 0.32) * 0.046 * (0.4 + input.throttle * 0.6));
    this.turboGain.gain.setTargetAtTime(turboVol, now, 0.05);

    const regenHarvest = input.brake > 0.1 && speedNorm > 0.2 ? input.brake : 0;
    const deployWhine = input.drsOpen || input.throttle > 0.7 ? 0.6 : 0.16;
    this.oscMgukWhine.frequency.setTargetAtTime(
      560 + speedNorm * 720 - regenHarvest * 180,
      now,
      0.04
    );
    this.mgukGain.gain.setTargetAtTime(
      regenHarvest * 0.06 + deployWhine * speedNorm * 0.026,
      now,
      0.05
    );

    // Subtle redline ignition-cut stutter above 96% RPM
    const limiterGate =
      rpmNorm > 0.96 && input.throttle > 0.65 ? (Math.sin(now * 145) > 0.15 ? 1.0 : 0.58) : 1.0;

    const engineVol = (0.13 + input.throttle * 0.15 + rpmNorm * 0.095) * limiterGate;
    this.engineBus.gain.setTargetAtTime(engineVol, now, 0.03);

    // Throttle-lift exhaust overrun crackle when lifting from high RPM
    if (this.prevThrottle > 0.55 && input.throttle < 0.15 && rpmNorm > 0.55 && now - this.lastOverrunTime > 0.28) {
      this.lastOverrunTime = now;
      this.playOverrunCrackle();
    }
    this.prevThrottle = input.throttle;

    // Dual-band tyre rubber squeal
    const screech = Math.max(0, Math.min(1, (input.slipAmount - 0.19) * 1.48));
    this.tyreGain.gain.setTargetAtTime(screech * (0.13 + speedNorm * 0.095), now, 0.035);
    this.tyreFilterLow.frequency.setTargetAtTime(840 + screech * 420, now, 0.04);
    this.tyreFilterHigh.frequency.setTargetAtTime(1480 + screech * 680, now, 0.04);

    // Road contact rumble & off-track / kerb vibration
    const roadLevel = speedNorm * (0.048 + (input.onKerb ? 0.095 : 0) + (input.offTrack ? 0.115 : 0));
    this.roadGain.gain.setTargetAtTime(roadLevel, now, 0.04);
    this.roadFilter.frequency.setTargetAtTime(
      135 + speedNorm * 145 + (input.onKerb ? 185 : 0) + (input.offTrack ? 120 : 0),
      now,
      0.04
    );

    // Kerb suspension thuds
    if (input.onKerb && speedNorm > 0.25 && now - this.lastKerbTime > 0.088) {
      this.lastKerbTime = now;
      this.playSuspensionBump(0.3 + speedNorm * 0.36);
    }

    // Cockpit aerodynamic wind & DRS slit airflow
    const windLevel = Math.pow(speedNorm, 1.75) * (input.drsOpen ? 0.23 : 0.16);
    this.windGain.gain.setTargetAtTime(windLevel, now, 0.05);
    this.windFilter.frequency.setTargetAtTime(380 + speedNorm * 1300 + (input.drsOpen ? 480 : 0), now, 0.06);
  }

  public updateSpatialTraffic(cars: SpatialCarAudioInput[], active: boolean) {
    if (!this.initialized || !this.ctx || this.spatialVoices.length === 0) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < this.spatialVoices.length; i++) {
      const voice = this.spatialVoices[i];
      const car = active ? cars[i] : undefined;
      if (!car) {
        voice.gain.gain.setTargetAtTime(0, now, 0.08);
        voice.wasNear = false;
        continue;
      }

      const dist = Math.hypot(car.relX, car.relY, car.relZ);
      if (dist > 145) {
        voice.gain.gain.setTargetAtTime(0, now, 0.08);
        voice.wasNear = false;
        continue;
      }

      // 3D HRTF Surround Positioning (camera-forward +relZ -> Web Audio -Z)
      const px = car.relX;
      const py = car.relY;
      const pz = -car.relZ;
      if (voice.panner.positionX) {
        voice.panner.positionX.setTargetAtTime(px, now, 0.025);
        voice.panner.positionY.setTargetAtTime(py, now, 0.025);
        voice.panner.positionZ.setTargetAtTime(pz, now, 0.025);
      }

      // True acoustic Doppler shift
      const clampedRadial = Math.max(-135, Math.min(135, car.radialVel));
      const dopplerRatio = SPEED_OF_SOUND / (SPEED_OF_SOUND + clampedRadial);
      const rpmNorm = Math.max(0.18, Math.min(1.05, car.rpm / Math.max(1, car.maxRpm)));
      const emitHz = (78 + rpmNorm * 305) * dopplerRatio;

      voice.oscA.frequency.setTargetAtTime(emitHz, now, 0.022);
      voice.oscB.frequency.setTargetAtTime(emitHz * 2.0, now, 0.022);
      voice.oscC.frequency.setTargetAtTime(emitHz * 0.5, now, 0.022);

      // Distance air-absorption lowpass filter
      const airCutoff = Math.max(460, 4800 * Math.exp(-dist * 0.018));
      voice.filter.frequency.setTargetAtTime(airCutoff, now, 0.04);

      const throttleBoost = 0.24 + car.throttle * 0.14;
      voice.gain.gain.setTargetAtTime(throttleBoost, now, 0.035);

      // High-speed aerodynamic pass-by whoosh on close flyby
      const pan = Math.max(-0.95, Math.min(0.95, car.relX / Math.max(4, dist * 0.65)));
      const isNear = dist < 13.5 && car.speedMs > 28;
      if (isNear && !voice.wasNear && now - this.lastWhooshTime > 0.26) {
        this.lastWhooshTime = now;
        this.playPassByWhoosh(pan, Math.min(1, car.speedMs / 80));
      }
      voice.wasNear = isNear;
    }
  }

  public updateCrowdAmbience(level: number) {
    if (!this.initialized || !this.ctx || !this.crowdGain || !this.crowdFilter) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(0.24, level));
    this.crowdGain.gain.setTargetAtTime(clamped, now, 0.25);
    this.crowdFilter.frequency.setTargetAtTime(740 + clamped * 2300, now, 0.25);
  }

  public updateGridTension(countdownProgress: number, active: boolean) {
    if (!this.initialized || !this.ctx || !this.trailerMusicGain || this.muted) return;
    if (!active) {
      this.lastTensionPulse = -1;
      return;
    }
    const pulseStep = Math.floor(countdownProgress * 2.35);
    if (pulseStep !== this.lastTensionPulse) {
      this.lastTensionPulse = pulseStep;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(68 + pulseStep * 5, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.24);
      g.gain.setValueAtTime(0.19, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(g);
      g.connect(this.trailerMusicGain);
      if (this.verbSend) g.connect(this.verbSend);
      osc.start(now);
      osc.stop(now + 0.28);
    }
  }

  public updateCinematicTrailer(dt: number, phaseTime: number, sceneIndex: 1 | 2 | 3 | 4 | 5, active: boolean) {
    if (!this.initialized || !this.ctx || !this.trailerMusicGain || !this.padGain || !this.padFilter) return;
    const now = this.ctx.currentTime;

    if (!active) {
      this.lastTrailerScene = -1;
      this.scoreTimerAccum = 0;
      this.scoreBeatIndex = 0;
      this.padGain.gain.setTargetAtTime(0, now, 0.25);
      return;
    }

    // Continuous wide surround orchestral pad breathing under the trailer
    const targetPad = this.muted ? 0 : sceneIndex === 5 ? 0.26 : sceneIndex === 1 ? 0.16 : 0.21;
    this.padGain.gain.setTargetAtTime(targetPad, now, 0.3);
    this.padFilter.frequency.setTargetAtTime(
      sceneIndex === 5 ? 1650 : sceneIndex === 2 || sceneIndex === 3 ? 1150 : 680,
      now,
      0.35
    );

    // Scene transition cinematic impacts, brass braams & pit-radio cues
    if (sceneIndex !== this.lastTrailerScene) {
      this.lastTrailerScene = sceneIndex;
      if (sceneIndex === 1) {
        this.playTrailerBassImpact(0.6);
        this.playTrailerBraam(73.42, 0.48);
        this.playPitRadioChatter(0.26);
      } else if (sceneIndex === 2) {
        this.playTrailerBassImpact(0.8);
      } else if (sceneIndex === 3) {
        this.playTrailerBraam(58.27, 0.52);
        this.playPitRadioChatter(0.32);
      } else if (sceneIndex === 5) {
        this.playTrailerBassImpact(1.0);
        this.playOrchestralFinaleChord();
      }
    }

    // Periodic pit-crew radio communication during Scenes 1-4
    if (sceneIndex < 5 && now - this.lastRadioTime > 7.8) {
      this.lastRadioTime = now;
      this.playPitRadioChatter(0.24);
    }

    // Crowd cheering swells across scenes, erupting in Scene 5
    const crowdLevel =
      sceneIndex === 5 ? 0.2 : sceneIndex === 2 ? 0.095 : sceneIndex === 1 ? 0.07 : 0.055;
    this.updateCrowdAmbience(crowdLevel);

    // Driving D-Minor Symphonic Trailer Score (Ostinato + Heroic Theme + Taiko)
    if (this.muted) return;
    const stepDuration = sceneIndex === 2 || sceneIndex === 3 ? 0.22 : sceneIndex === 4 ? 0.24 : 0.3;
    this.scoreTimerAccum += dt;
    if (this.scoreTimerAccum >= stepDuration) {
      this.scoreTimerAccum -= stepDuration;
      const beat = this.scoreBeatIndex % 16;
      this.scoreBeatIndex++;

      const bassRoots = [73.42, 73.42, 58.27, 65.41];
      const bar = Math.floor((this.scoreBeatIndex - 1) / 16) % bassRoots.length;
      const rootHz = bassRoots[bar];

      const intensity = sceneIndex === 5 ? 0.98 : sceneIndex === 2 ? 0.88 : sceneIndex === 1 ? 0.58 : 0.78;
      this.playScorePulse(rootHz, intensity, beat % 4 === 0, sceneIndex);

      // Heroic motorsport brass/string theme across Scenes 2-5
      if (sceneIndex >= 2 && beat % 4 === 0) {
        const themeNotes = [293.66, 349.23, 392.0, 440.0, 466.16, 440.0, 392.0, 587.33];
        const noteHz = themeNotes[(bar * 2 + beat / 4) % themeNotes.length];
        this.playOrchestralStringNote(noteHz, intensity * 0.52, 0.75);
      }

      // Dramatic final orchestral hit at climax of Clip 4 (30.2s - 31.4s of 32s trailer)
      if (sceneIndex === 5 && phaseTime > 30.2 && phaseTime < 30.7 && beat % 4 === 0) {
        this.playTrailerBassImpact(1.0);
        this.playOrchestralFinaleChord();
      }
    }
  }

  private playTrailerBraam(freq: number, intensity: number) {
    if (!this.ctx || !this.trailerMusicGain || this.muted) return;
    const now = this.ctx.currentTime;
    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    oscA.type = 'sawtooth';
    oscA.frequency.setValueAtTime(freq, now);
    oscB.type = 'sawtooth';
    oscB.frequency.setValueAtTime(freq * 1.007, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, now);
    filter.frequency.exponentialRampToValueAtTime(980, now + 0.35);
    filter.frequency.exponentialRampToValueAtTime(210, now + 1.45);

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22 * intensity, now + 0.14);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.55);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(g);
    g.connect(this.trailerMusicGain);
    if (this.verbSend) g.connect(this.verbSend);
    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + 1.6);
    oscB.stop(now + 1.6);
  }

  private playScorePulse(freq: number, intensity: number, accented: boolean, sceneIndex: number) {
    if (!this.ctx || !this.trailerMusicGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 1.5, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(accented ? 840 + intensity * 560 : 440, now);
    filter.frequency.exponentialRampToValueAtTime(190, now + 0.22);

    const vol = (accented ? 0.12 : 0.07) * intensity;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (accented ? 0.34 : 0.2));

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.trailerMusicGain);
    if (this.verbSend) gain.connect(this.verbSend);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.36);
    osc2.stop(now + 0.36);

    if (accented && sceneIndex >= 2) {
      const drum = this.ctx.createOscillator();
      const dGain = this.ctx.createGain();
      drum.type = 'sine';
      drum.frequency.setValueAtTime(102, now);
      drum.frequency.exponentialRampToValueAtTime(34, now + 0.18);
      dGain.gain.setValueAtTime(0.17 * intensity, now);
      dGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      drum.connect(dGain);
      dGain.connect(this.trailerMusicGain);
      if (this.verbSend) dGain.connect(this.verbSend);
      drum.start(now);
      drum.stop(now + 0.21);
    }
  }

  private playOrchestralStringNote(freq: number, level: number, dur: number) {
    if (!this.ctx || !this.trailerMusicGain || this.muted) return;
    const now = this.ctx.currentTime;
    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const pan = this.ctx.createStereoPanner();
    const gain = this.ctx.createGain();

    oscA.type = 'sawtooth';
    oscA.frequency.setValueAtTime(freq, now);
    oscB.type = 'sawtooth';
    oscB.frequency.setValueAtTime(freq * 1.0055, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1750, now);
    pan.pan.value = (Math.random() - 0.5) * 0.55;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.072 * level, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(pan);
    pan.connect(gain);
    gain.connect(this.trailerMusicGain);
    if (this.verbSend) gain.connect(this.verbSend);

    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + dur + 0.05);
    oscB.stop(now + dur + 0.05);
  }

  public playOrchestralFinaleChord() {
    if (!this.initialized || !this.ctx || !this.trailerMusicGain || this.muted) return;
    // Heroic Picardy D-Major/Minor championship brass & strings swell
    const freqs = [146.83, 220.0, 293.66, 369.99, 440.0, 587.33];
    freqs.forEach((f) => this.playOrchestralStringNote(f, 0.92, 2.3));
  }

  public playTrailerBassImpact(intensity = 0.85) {
    if (!this.initialized || !this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(118, now);
    sub.frequency.exponentialRampToValueAtTime(27, now + 0.68);
    subGain.gain.setValueAtTime(0.48 * intensity, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    sub.connect(subGain);
    subGain.connect(this.compressor);
    if (this.verbSend) subGain.connect(this.verbSend);
    sub.start(now);
    sub.stop(now + 0.95);

    if (this.noiseBuffer) {
      const burst = this.ctx.createBufferSource();
      burst.buffer = this.noiseBuffer;
      const bf = this.ctx.createBiquadFilter();
      bf.type = 'lowpass';
      bf.frequency.setValueAtTime(920, now);
      bf.frequency.exponentialRampToValueAtTime(120, now + 0.45);
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(0.3 * intensity, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
      burst.connect(bf);
      bf.connect(bg);
      bg.connect(this.compressor);
      if (this.verbSend) bg.connect(this.verbSend);
      burst.start(now);
      burst.stop(now + 0.55);
    }
  }

  public playFireworkBurst(pan = 0) {
    if (!this.initialized || !this.ctx || !this.compressor || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    if (panner.positionX) {
      panner.positionX.value = Math.max(-0.9, Math.min(0.9, pan)) * 18;
      panner.positionY.value = 14;
      panner.positionZ.value = -22;
    }

    const boom = this.ctx.createOscillator();
    const bGain = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(135, now);
    boom.frequency.exponentialRampToValueAtTime(36, now + 0.3);
    bGain.gain.setValueAtTime(0.24, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    boom.connect(bGain);
    bGain.connect(panner);
    panner.connect(this.compressor);
    if (this.verbSend) bGain.connect(this.verbSend);
    boom.start(now);
    boom.stop(now + 0.36);

    const crackle = this.ctx.createBufferSource();
    crackle.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3100;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.16, now + 0.03);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    crackle.connect(hp);
    hp.connect(cg);
    cg.connect(panner);
    if (this.verbSend) cg.connect(this.verbSend);
    crackle.start(now, Math.random() * 0.5, 0.58);
  }

  public playPassByWhoosh(pan: number, intensity: number) {
    if (!this.initialized || !this.ctx || !this.compressor || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.6;
    filter.frequency.setValueAtTime(240, now);
    filter.frequency.exponentialRampToValueAtTime(1650, now + 0.09);
    filter.frequency.exponentialRampToValueAtTime(210, now + 0.24);

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-0.95, Math.min(0.95, pan)), now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.26 * intensity, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    src.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.compressor);
    if (this.verbSend) gain.connect(this.verbSend);
    src.start(now, Math.random() * 0.6, 0.28);
  }

  private playOverrunCrackle() {
    if (!this.ctx || !this.compressor || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    [0, 0.065, 0.14].forEach((offset, idx) => {
      const pop = this.ctx!.createBufferSource();
      pop.buffer = this.noiseBuffer;
      const pf = this.ctx!.createBiquadFilter();
      pf.type = 'bandpass';
      pf.frequency.value = 310 + idx * 65;
      pf.Q.value = 2.1;
      const pg = this.ctx!.createGain();
      pg.gain.setValueAtTime(0.14 - idx * 0.03, now + offset);
      pg.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);
      pop.connect(pf);
      pf.connect(pg);
      pg.connect(this.compressor!);
      if (this.verbSend) pg.connect(this.verbSend);
      pop.start(now + offset, Math.random() * 0.4, 0.065);
    });
  }

  public playSuspensionBump(intensity: number) {
    if (!this.initialized || !this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.075);
    g.gain.setValueAtTime(0.12 * Math.min(1, intensity), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(g);
    g.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playPitRadioChatter(volume = 0.28) {
    if (!this.initialized || !this.ctx || !this.compressor || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    this.playPitRadioBeep();

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1450;
    bp.Q.value = 2.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now + 0.18);
    g.gain.linearRampToValueAtTime(0.065 * volume, now + 0.22);
    g.gain.setValueAtTime(0.03 * volume, now + 0.45);
    g.gain.linearRampToValueAtTime(0.07 * volume, now + 0.56);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.92);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.compressor);
    src.start(now + 0.18, 0.1, 0.78);

    const chirp = this.ctx.createOscillator();
    const cg = this.ctx.createGain();
    chirp.type = 'sine';
    chirp.frequency.setValueAtTime(1580, now + 0.95);
    cg.gain.setValueAtTime(0.055, now + 0.95);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 1.01);
    chirp.connect(cg);
    cg.connect(this.compressor);
    chirp.start(now + 0.95);
    chirp.stop(now + 1.02);
  }

  public playGearShift(upshift: boolean) {
    if (!this.initialized || !this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(upshift ? 260 : 195, now);
    osc.frequency.exponentialRampToValueAtTime(upshift ? 95 : 310, now + 0.065);
    gain.gain.setValueAtTime(0.19, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.08);

    if (upshift) {
      const turbo = this.ctx.createOscillator();
      const tGain = this.ctx.createGain();
      turbo.type = 'sine';
      turbo.frequency.setValueAtTime(2800, now);
      turbo.frequency.exponentialRampToValueAtTime(1050, now + 0.09);
      tGain.gain.setValueAtTime(0.045, now);
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      turbo.connect(tGain);
      tGain.connect(this.compressor);
      turbo.start(now);
      turbo.stop(now + 0.1);
    } else if (this.noiseBuffer) {
      const pop = this.ctx.createBufferSource();
      pop.buffer = this.noiseBuffer;
      const pf = this.ctx.createBiquadFilter();
      pf.type = 'bandpass';
      pf.frequency.value = 340;
      pf.Q.value = 1.8;
      const pg = this.ctx.createGain();
      pg.gain.setValueAtTime(0.24, now + 0.01);
      pg.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      pop.connect(pf);
      pf.connect(pg);
      pg.connect(this.compressor);
      if (this.verbSend) pg.connect(this.verbSend);
      pop.start(now + 0.01, Math.random() * 0.4, 0.1);
    }
  }

  public playPitRadioBeep() {
    if (!this.initialized || !this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;
    [1320, 1760].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.085;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.085, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      osc.connect(gain);
      gain.connect(this.compressor!);
      osc.start(t);
      osc.stop(t + 0.07);
    });
  }

  public playVictoryFanfare() {
    if (!this.initialized || !this.ctx || !this.compressor || this.muted) return;
    this.playTrailerBassImpact(0.95);
    this.playOrchestralFinaleChord();
    this.updateCrowdAmbience(0.22);

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain);
      gain.connect(this.compressor!);
      if (this.verbSend) gain.connect(this.verbSend);
      osc.start(t);
      osc.stop(t + 0.58);
    });
  }

  public playUiConfirm() {
    if (!this.initialized || !this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(990, now + 0.08);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playCollision(intensity: number) {
    if (!this.initialized || !this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0.2, Math.min(1, intensity));

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
    gain.gain.setValueAtTime(0.36 * clamped, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.compressor);
    if (this.verbSend) gain.connect(this.verbSend);
    osc.start(now);
    osc.stop(now + 0.23);

    if (this.noiseBuffer) {
      const crunch = this.ctx.createBufferSource();
      crunch.buffer = this.noiseBuffer;
      const cf = this.ctx.createBiquadFilter();
      cf.type = 'bandpass';
      cf.frequency.value = 1100;
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.22 * clamped, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      crunch.connect(cf);
      cf.connect(cg);
      cg.connect(this.compressor);
      crunch.start(now, Math.random() * 0.4, 0.15);
    }
  }

  public playStartLightBeep(isGo: boolean) {
    if (!this.initialized || !this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
    gain.gain.setValueAtTime(isGo ? 0.24 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.36 : 0.15));
    osc.connect(gain);
    gain.connect(this.compressor);
    if (this.verbSend) gain.connect(this.verbSend);
    osc.start(now);
    osc.stop(now + (isGo ? 0.38 : 0.16));

    if (isGo) {
      this.playTrailerBassImpact(0.75);
      this.updateCrowdAmbience(0.18);
    }
  }

  public playRadioBeep() {
    if (!this.initialized || !this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const startTime = now + i * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1450, startTime);
      gain.gain.setValueAtTime(0.14, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);
      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(startTime);
      osc.stop(startTime + 0.09);
    }
    if (this.noiseBuffer) {
      const squelch = this.ctx.createBufferSource();
      squelch.buffer = this.noiseBuffer;
      const bf = this.ctx.createBiquadFilter();
      bf.type = 'bandpass';
      bf.frequency.value = 1800;
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(0.18, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      squelch.connect(bf);
      bf.connect(bg);
      bg.connect(this.compressor);
      squelch.start(now, Math.random() * 0.5, 0.35);
    }
  }

  public dispose() {
    try {
      this.oscCrankSub?.stop();
      this.oscFiringPrimary?.stop();
      this.oscExhaustBark?.stop();
      this.oscHarmonicTop?.stop();
      this.oscCombustionFm?.stop();
      this.oscTurboWhine?.stop();
      this.oscMgukWhine?.stop();
      this.engineLopeLfo?.stop();
      for (const po of this.padOscs) po.stop();
      for (const v of this.spatialVoices) {
        v.oscA.stop();
        v.oscB.stop();
        v.oscC.stop();
      }
      this.engineHaasDelay?.disconnect();
      this.stadiumVerb?.disconnect();
      this.verbReturn?.disconnect();
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.padOscs = [];
    this.spatialVoices = [];
    this.initialized = false;
  }
}
