import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Camera,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Eye,
  Flag,
  Gamepad2,
  Layers,
  Moon,
  Pause,
  SlidersHorizontal,
  Snowflake,
  Sun,
  Sunset,
  Thermometer,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  CameraMode,
  DEFAULT_HUD_WIDGETS,
  ErsDeploymentMode,
  GameScreen,
  HudColorScheme,
  HudScaleMode,
  HudTelemetry,
  HudWidgetKey,
  HudWidgetVisibility,
  MobileButtonLayout,
  MobileButtonScale,
  MobileButtonSpacing,
  MobileControlStyle,
  SpeedUnitMode,
  TransmissionMode,
  TyreCompound,
  WeatherMode,
} from '../types/racing';
import { MiniMap } from './MiniMap';
import { GForceRadarWidget } from './GForceRadarWidget';
import { DrsProgressWidget } from './DrsProgressWidget';
import { MarshalingFlagOverlay } from './MarshalingFlagOverlay';
import { PitBoard } from './PitBoard';
import { TrackLog } from './TrackLog';
import {
  TyreTemperatureOverlay,
  getTyreCompoundTempWindow,
  getTyreTempColorMeta,
} from './TyreTemperatureOverlay';
import { VehicleDamageVisualizer } from './VehicleDamageVisualizer';

interface RacingHUDProps {
  hud: HudTelemetry;
  trackName: string;
  transmission: TransmissionMode;
  touchControls: boolean;
  mobileControlStyle?: MobileControlStyle;
  mobileButtonLayout?: MobileButtonLayout;
  mobileButtonScale?: MobileButtonScale;
  mobileButtonSpacing?: MobileButtonSpacing;
  mobileButtonOpacity?: number;
  mobileSwipeGestures?: boolean;
  mobileSwipeSensitivity?: number;
  mobileGyroSensitivity?: number;
  mobileSwapPedals?: boolean;
  mobileFloatingJoystick?: boolean;
  mobileShowErsButton?: boolean;
  mobileShowGearStrip?: boolean;
  muted: boolean;
  active?: boolean;
  gameScreen?: GameScreen;
  virtualMirror?: boolean;
  haloCenterHud?: boolean;
  driverTags3d?: boolean;
  speedUnits?: SpeedUnitMode;
  raceObjectives?: boolean;
  launchClutchAssist?: boolean;
  hudColorScheme?: HudColorScheme;
  hudScaleMode?: HudScaleMode;
  hudWidgets?: HudWidgetVisibility;
  onSelectHudColorScheme?: (scheme: HudColorScheme) => void;
  onSelectHudScaleMode?: (mode: HudScaleMode) => void;
  onToggleHudWidget?: (widget: HudWidgetKey) => void;
  onApplyHudWidgetPreset?: (preset: 'all' | 'minimal') => void;
  onToggleTouchControls: () => void;
  onSelectMobileControlStyle?: (style: MobileControlStyle) => void;
  onSelectMobileButtonLayout?: (layout: MobileButtonLayout) => void;
  onSelectMobileButtonScale?: (scale: MobileButtonScale) => void;
  onSelectMobileButtonSpacing?: (spacing: MobileButtonSpacing) => void;
  onChangeMobileButtonOpacity?: (opacity: number) => void;
  onToggleMobileSwipeGestures?: () => void;
  onChangeMobileSwipeSensitivity?: (sens: number) => void;
  onChangeMobileGyroSensitivity?: (sens: number) => void;
  onToggleMobileSwapPedals?: () => void;
  onToggleMobileFloatingJoystick?: () => void;
  onToggleMobileShowErsButton?: () => void;
  onToggleMobileShowGearStrip?: () => void;
  onApplyMobilePreset?: (preset: 'f1_classic' | 'thumb_pro' | 'lefty' | 'gyro_clean') => void;
  onToggleMute: () => void;
  onCycleCamera: () => void;
  onPause: () => void;
  onTouchInput: (control: 'left' | 'right' | 'throttle' | 'brake' | 'drs', pressed: boolean) => void;
  onTouchSteerAxis?: (axis: number) => void;
  onTouchPedalAxis?: (throttle: number, brake: number) => void;
  onSetMobileAeroMode?: (mode: 'auto' | 'x_mode' | 'z_mode') => void;
  onTriggerMobileHaptic?: (
    event: 'shift_up' | 'shift_down' | 'aero_x' | 'aero_z' | 'collision' | 'kerb' | 'brake' | 'accel',
    intensity?: number
  ) => void;
  onManualShift: (dir: 1 | -1) => void;
  onRequestTyreSwitch: (compound: TyreCompound) => void;
  onSetErsMode?: (mode: ErsDeploymentMode) => void;
  onAdjustBrakeBias?: (deltaPct: number) => void;
}

export function formatLapTime(ms: number | null): string {
  if (ms === null || ms < 0) return '--:--.---';
  const totalMs = Math.floor(ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

const CAMERA_LABELS: Record<CameraMode, string> = {
  chase: 'CHASE',
  tcam: 'T-CAM',
  cockpit: 'COCKPIT',
  low_track: 'LOW TRACK',
  wing_tyre: 'WING',
  tv_wide: 'BROADCAST',
  heli: 'HELI TV',
  trackside: 'TRACKSIDE',
  bumper: 'BUMPER',
  side: 'SIDE POD',
  rear: 'CHASE REAR',
};

const WEATHER_LABELS: Record<WeatherMode, string> = {
  day: 'CLEAR',
  partly_cloudy: 'PT CLOUDY',
  sunset: 'SUNSET',
  cloudy: 'OVERCAST',
  rain: 'RAIN',
  heavy_rain: 'STORM',
  fog: 'FOGGY',
  snow: 'SNOW',
  blizzard: 'BLIZZARD',
  night: 'NIGHT',
};

const COMPOUND_OPTIONS: { id: TyreCompound; short: string; color: string }[] = [
  { id: 'soft', short: 'S', color: '#EF4444' },
  { id: 'medium', short: 'M', color: '#FACC15' },
  { id: 'hard', short: 'H', color: '#F8FAFC' },
  { id: 'wet', short: 'W', color: '#38BDF8' },
];

const WeatherIcon: React.FC<{ mode: WeatherMode; className?: string }> = ({ mode, className }) => {
  if (mode === 'heavy_rain') return <CloudLightning className={className} />;
  if (mode === 'rain') return <CloudRain className={className} />;
  if (mode === 'snow' || mode === 'blizzard') return <Snowflake className={className} />;
  if (mode === 'fog') return <CloudFog className={className} />;
  if (mode === 'partly_cloudy') return <CloudSun className={className} />;
  if (mode === 'cloudy') return <Cloud className={className} />;
  if (mode === 'sunset') return <Sunset className={className} />;
  if (mode === 'night') return <Moon className={className} />;
  return <Sun className={className} />;
};

const DEFAULT_LEADERBOARD_FALLBACK: {
  position: number;
  code: string;
  surname: string;
  name: string;
  teamColor: string;
  gapSeconds: number;
  isPlayer: boolean;
  tyreCompound?: TyreCompound;
  pitStops?: number;
  isPitting?: boolean;
}[] = [
  { position: 1, code: 'NOR', surname: 'NORRIS', name: 'Lando Norris', teamColor: '#FF8000', gapSeconds: 0, isPlayer: false, tyreCompound: 'medium', pitStops: 0, isPitting: false },
  { position: 2, code: 'JAC', surname: 'JACKSON', name: 'Aiden Jackson', teamColor: '#FACC15', gapSeconds: 0.417, isPlayer: true, tyreCompound: 'medium', pitStops: 0, isPitting: false },
  { position: 3, code: 'VER', surname: 'VERSTAPPEN', name: 'Max Verstappen', teamColor: '#1E41FF', gapSeconds: 1.952, isPlayer: false, tyreCompound: 'medium', pitStops: 0, isPitting: false },
  { position: 4, code: 'RUS', surname: 'RUSSELL', name: 'George Russell', teamColor: '#00D2BE', gapSeconds: 4.371, isPlayer: false, tyreCompound: 'hard', pitStops: 0, isPitting: false },
  { position: 5, code: 'LEC', surname: 'LECLERC', name: 'Charles Leclerc', teamColor: '#DC0000', gapSeconds: 6.306, isPlayer: false, tyreCompound: 'soft', pitStops: 0, isPitting: false },
  { position: 6, code: 'PIA', surname: 'PIASTRI', name: 'Oscar Piastri', teamColor: '#FF8000', gapSeconds: 7.424, isPlayer: false, tyreCompound: 'medium', pitStops: 0, isPitting: false },
  { position: 7, code: 'SAI', surname: 'SAINZ', name: 'Carlos Sainz', teamColor: '#005AFF', gapSeconds: 8.542, isPlayer: false, tyreCompound: 'medium', pitStops: 0, isPitting: false },
  { position: 8, code: 'TSU', surname: 'TSUNODA', name: 'Yuki Tsunoda', teamColor: '#121F45', gapSeconds: 9.188, isPlayer: false, tyreCompound: 'hard', pitStops: 0, isPitting: false },
];

function getDriverCode(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] || name;
  return last.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'DRV';
}

function getDriverSurname(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] || name;
  return last.toUpperCase();
}

export const RacingHUD: React.FC<RacingHUDProps> = ({
  hud,
  trackName,
  transmission,
  touchControls,
  mobileControlStyle = 'virtual_joystick',
  mobileButtonLayout = 'standard',
  mobileButtonScale = 'normal',
  mobileButtonSpacing = 'normal',
  mobileButtonOpacity = 0.92,
  mobileSwipeGestures = true,
  mobileSwipeSensitivity = 1.0,
  mobileGyroSensitivity = 1.0,
  mobileSwapPedals = false,
  mobileFloatingJoystick = true,
  mobileShowErsButton = true,
  mobileShowGearStrip = true,
  muted,
  active = true,
  gameScreen = 'playing',
  virtualMirror = true,
  haloCenterHud = true,
  driverTags3d = true,
  speedUnits = 'kmh',
  raceObjectives = true,
  launchClutchAssist = true,
  hudColorScheme = 'motorsport_dark',
  hudScaleMode = 'auto',
  hudWidgets = DEFAULT_HUD_WIDGETS,
  onSelectHudColorScheme,
  onSelectHudScaleMode,
  onToggleHudWidget,
  onApplyHudWidgetPreset,
  onToggleTouchControls,
  onSelectMobileControlStyle,
  onSelectMobileButtonLayout,
  onSelectMobileButtonScale,
  onSelectMobileButtonSpacing,
  onChangeMobileButtonOpacity,
  onToggleMobileSwipeGestures,
  onChangeMobileSwipeSensitivity,
  onChangeMobileGyroSensitivity,
  onToggleMobileSwapPedals,
  onToggleMobileFloatingJoystick,
  onToggleMobileShowErsButton,
  onToggleMobileShowGearStrip,
  onApplyMobilePreset,
  onToggleMute,
  onCycleCamera,
  onPause,
  onTouchInput,
  onTouchSteerAxis,
  onTouchPedalAxis,
  onSetMobileAeroMode,
  onTriggerMobileHaptic,
  onManualShift,
  onRequestTyreSwitch,
  onSetErsMode,
  onAdjustBrakeBias,
}) => {
  const [shouldRender, setShouldRender] = useState(active);
  const [isExiting, setIsExiting] = useState(false);
  const [animEpoch, setAnimEpoch] = useState(0);
  const [showMirrorLocal, setShowMirrorLocal] = useState(false);
  const [showTrackLog, setShowTrackLog] = useState(false);
  const [showHudOverlayPanel, setShowHudOverlayPanel] = useState(false);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>(() =>
    typeof window !== 'undefined' ? { w: window.innerWidth, h: window.innerHeight } : { w: 1280, h: 720 }
  );
  const [sliderSteer, setSliderSteer] = useState(0);
  const [sliderDragging, setSliderDragging] = useState(false);
  const [joystickVec, setJoystickVec] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [joystickDragging, setJoystickDragging] = useState(false);
  const [mobileAeroLock, setMobileAeroLock] = useState<'auto' | 'x_mode' | 'z_mode'>('auto');
  const [showMobileCustomizer, setShowMobileCustomizer] = useState(false);
  const [swipeFeedback, setSwipeFeedback] = useState<string | null>(null);
  const [activeSwipeSteer, setActiveSwipeSteer] = useState<number | null>(null);
  const [gearSwipeDeltaY, setGearSwipeDeltaY] = useState(0);
  const swipeGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    mode: 'pending' | 'steer' | 'done';
    side: 'left' | 'right';
  } | null>(null);
  const swipeCenterSignRef = useRef<number>(0);
  const padSwipeStartYRef = useRef<{ pointerId: number; y: number; acted: boolean } | null>(null);
  const haloAeroSwipeYRef = useRef<{ pointerId: number; y: number; acted: boolean } | null>(null);
  const joystickCenterSignRef = useRef<number>(0);
  const joystickOriginRef = useRef<{ x: number; y: number; maxR: number } | null>(null);
  const joystickMaxLockHapticRef = useRef<boolean>(false);
  const gearSwipeRef = useRef<{
    pointerId: number;
    startY: number;
    lastTriggerY: number;
    totalShifts: number;
  } | null>(null);
  const gyroZeroOffsetRef = useRef<number>(0);
  const gyroSmoothedRef = useRef<number>(0);
  const rawGyroAngleRef = useRef<number>(0);
  const speedKmhRef = useRef<number>(hud.speedKmh);
  speedKmhRef.current = hud.speedKmh;
  const prevDamageRef = useRef<number>(hud.damagePct);
  const [impactFlash, setImpactFlash] = useState(false);
  const [gyroAxis, setGyroAxis] = useState(0);
  const [gyroPermissionNeeded, setGyroPermissionNeeded] = useState(false);
  const [pitWindowTransition, setPitWindowTransition] = useState<'idle' | 'opening' | 'closing'>('idle');
  const prevScreenRef = useRef<GameScreen>(gameScreen);
  const pitWindowOpen = Boolean(hud.pitStrategy?.isWindowOpen);
  const prevPitWindowRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (hud.damagePct > prevDamageRef.current + 0.5) {
      setImpactFlash(true);
      const t = window.setTimeout(() => setImpactFlash(false), 260);
      prevDamageRef.current = hud.damagePct;
      return () => window.clearTimeout(t);
    }
    prevDamageRef.current = hud.damagePct;
  }, [hud.damagePct]);

  const shapeStickSteer = (rawX: number) => {
    const abs = Math.abs(rawX);
    const deadzone = 0.04;
    if (abs <= deadzone) return 0;
    const norm = (abs - deadzone) / (1 - deadzone);
    return -Math.sign(rawX) * Math.pow(Math.min(1, norm), 1.28);
  };

  const showSwipeToast = (msg: string) => {
    setSwipeFeedback(msg);
    window.setTimeout(() => {
      setSwipeFeedback((cur) => (cur === msg ? null : cur));
    }, 750);
  };

  const applyAeroModeToggle = (next: 'auto' | 'x_mode' | 'z_mode') => {
    setMobileAeroLock(next);
    onSetMobileAeroMode?.(next);
    showSwipeToast(
      next === 'x_mode' ? 'X-MODE · LOW DRAG' : next === 'z_mode' ? 'Z-MODE · HIGH DOWNFORCE' : 'AERO · AUTO'
    );
  };

  const cycleAeroMode = () => {
    const order: ('auto' | 'x_mode' | 'z_mode')[] = ['auto', 'x_mode', 'z_mode'];
    const next = order[(order.indexOf(mobileAeroLock) + 1) % order.length];
    applyAeroModeToggle(next);
  };

  const baseMobileScale =
    mobileButtonScale === 'compact' ? 0.9 : mobileButtonScale === 'large' ? 1.1 : 1.0;
  const mobileScaleFactor =
    baseMobileScale * (viewportSize.w < 400 ? Math.max(0.82, viewportSize.w / 400) : 1.0);
  const mobileSpacingGapClass =
    mobileButtonSpacing === 'compact'
      ? 'gap-1'
      : mobileButtonSpacing === 'wide'
        ? 'gap-3 sm:gap-3.5 pb-2.5'
        : 'gap-1.5 sm:gap-2 pb-1';

  useEffect(() => {
    const onResize = () => {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!active || gameScreen !== 'playing') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        setShowHudOverlayPanel((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, gameScreen]);

  const adaptiveHudScale = React.useMemo(() => {
    if (hudScaleMode === 'compact') return 0.85;
    if (hudScaleMode === 'standard') return 1.0;
    if (hudScaleMode === 'large') return 1.1;
    const { w, h } = viewportSize;
    if (w < 380) return 0.76;
    if (w < 440) return 0.82;
    if (h < 400) return 0.78;
    if (h < 500 || w < 768) return 0.88;
    if (w < 1024) return 0.94;
    if (w < 1360) return 0.98;
    if (w < 1680) return 1.0;
    if (w >= 1920 && h >= 1050) return 1.12;
    if (w >= 1680 && h >= 900) return 1.08;
    return 1.0;
  }, [hudScaleMode, viewportSize]);

  const hudThemeMeta = React.useMemo(() => {
    if (hudColorScheme === 'sunlight_contrast') {
      return {
        label: 'DAYLIGHT',
        filter: 'contrast(1.12) saturate(1.1)',
        accentBorder: 'border-white/50',
        panelBg: 'rgba(3, 5, 10, 0.98)',
      };
    }
    if (hudColorScheme === 'night_amber') {
      return {
        label: 'NIGHT AMBER',
        filter: 'sepia(0.14) saturate(1.05)',
        accentBorder: 'border-amber-400/45',
        panelBg: 'rgba(16, 11, 6, 0.94)',
      };
    }
    if (hudColorScheme === 'telemetry_cyan') {
      return {
        label: 'CYAN VIS',
        filter: 'contrast(1.06) saturate(1.12)',
        accentBorder: 'border-cyan-400/50',
        panelBg: 'rgba(6, 15, 24, 0.94)',
      };
    }
    return {
      label: 'CARBON',
      filter: 'none',
      accentBorder: 'border-white/15',
      panelBg: 'rgba(11, 15, 23, 0.92)',
    };
  }, [hudColorScheme]);

  useEffect(() => {
    if (!touchControls || mobileControlStyle !== 'tilt_gyro' || gameScreen !== 'playing') {
      setGyroAxis(0);
      if (mobileControlStyle !== 'thumb_slider') {
        onTouchSteerAxis?.(0);
      }
      return;
    }

    const DevOrient = window.DeviceOrientationEvent as (typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    }) | undefined;
    if (DevOrient && typeof DevOrient.requestPermission === 'function') {
      setGyroPermissionNeeded(true);
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 0;
      const orientAngle = window.screen?.orientation?.angle ?? 0;
      const isLandscape = window.innerWidth > window.innerHeight;
      let rawTilt = gamma;
      if (isLandscape) {
        rawTilt = orientAngle === 270 ? -beta : beta;
      }
      rawGyroAngleRef.current = rawTilt;
      const taredTilt = rawTilt - gyroZeroOffsetRef.current;
      const deadzone = 2.6;
      const maxTilt = 30 / Math.max(0.55, Math.min(1.65, mobileGyroSensitivity));
      const mag = Math.max(0, Math.abs(taredTilt) - deadzone) / Math.max(4, maxTilt - deadzone);
      const speedExp = 1.34 + Math.min(0.28, (speedKmhRef.current / 340) * 0.28);
      const shaped = -Math.sign(taredTilt) * Math.pow(Math.min(1, mag), speedExp);
      const smoothed = gyroSmoothedRef.current * 0.64 + shaped * 0.36;
      gyroSmoothedRef.current = Math.abs(smoothed) < 0.01 ? 0 : smoothed;
      const axis = Math.max(-1, Math.min(1, gyroSmoothedRef.current));
      setGyroAxis(axis);
      onTouchSteerAxis?.(axis);
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      gyroSmoothedRef.current = 0;
      onTouchSteerAxis?.(0);
    };
  }, [touchControls, mobileControlStyle, gameScreen, mobileGyroSensitivity, onTouchSteerAxis]);

  const calibrateGyroCenter = () => {
    gyroZeroOffsetRef.current = rawGyroAngleRef.current;
    gyroSmoothedRef.current = 0;
    setGyroAxis(0);
    onTouchSteerAxis?.(0);
    onTriggerMobileHaptic?.('shift_up', 0.45);
    showSwipeToast('GYRO ZERO CALIBRATED');
  };

  const requestIosGyro = async () => {
    const DevOrient = window.DeviceOrientationEvent as (typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    }) | undefined;
    if (DevOrient && typeof DevOrient.requestPermission === 'function') {
      try {
        const res = await DevOrient.requestPermission();
        if (res === 'granted') {
          setGyroPermissionNeeded(false);
        }
      } catch {
        // ignore permission failure
      }
    } else {
      setGyroPermissionNeeded(false);
    }
  };

  useEffect(() => {
    if (prevPitWindowRef.current === null) {
      prevPitWindowRef.current = pitWindowOpen;
      return;
    }
    if (prevPitWindowRef.current !== pitWindowOpen) {
      prevPitWindowRef.current = pitWindowOpen;
      setPitWindowTransition(pitWindowOpen ? 'opening' : 'closing');
      const timer = window.setTimeout(() => setPitWindowTransition('idle'), 850);
      return () => window.clearTimeout(timer);
    }
  }, [pitWindowOpen]);

  useEffect(() => {
    if (active) {
      setShouldRender(true);
      setIsExiting(false);
    } else if (shouldRender) {
      setIsExiting(true);
      const timer = window.setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
      }, 380);
      return () => window.clearTimeout(timer);
    }
  }, [active, shouldRender]);

  useEffect(() => {
    const prev = prevScreenRef.current;
    if (prev !== gameScreen) {
      if ((prev === 'title' && gameScreen === 'playing') || (prev === 'playing' && gameScreen === 'title')) {
        setAnimEpoch((n) => n + 1);
      }
      prevScreenRef.current = gameScreen;
    }
  }, [gameScreen]);

  const [showTyreThermalOverlay, setShowTyreThermalOverlay] = useState(false);

  const rpmRatio = Math.min(1, Math.max(0, hud.rpm / hud.maxRpm));
  const gearLabel = hud.gear === -1 ? 'R' : hud.gear === 0 ? 'N' : String(hud.gear);
  const displayedSpeed =
    speedUnits === 'mph' ? Math.round(hud.speedKmh * 0.621371) : Math.round(hud.speedKmh);
  const speedUnitLabel = speedUnits === 'mph' ? 'MPH' : 'KPH';

  // SVG RPM & Battery arcs
  const arcRadius = 38;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const sweepLength = arcCircumference * (240 / 360);
  const filledRpmLength = sweepLength * rpmRatio;
  const filledBattLength = sweepLength * Math.min(1, Math.max(0, hud.ersCharge / 100));

  const activeLights =
    hud.countdownState === 'lights_1'
      ? 1
      : hud.countdownState === 'lights_2'
        ? 2
        : hud.countdownState === 'lights_3'
          ? 3
          : hud.countdownState === 'lights_4'
            ? 4
            : hud.countdownState === 'lights_5'
              ? 5
              : 0;

  // Build visible leaderboard rows (top 6 + player context, matching F1 25 tower)
  const leaderboardRows = React.useMemo(() => {
    if (!hud.standings || hud.standings.length === 0) {
      return DEFAULT_LEADERBOARD_FALLBACK.slice(0, 6);
    }
    const topRows = hud.standings.slice(0, 6).map((s) => ({
      position: s.position,
      code: getDriverCode(s.name),
      surname: getDriverSurname(s.name),
      name: s.name,
      teamColor: s.color,
      gapSeconds: s.gapSeconds,
      isPlayer: s.isPlayer,
      tyreCompound: s.tyreCompound,
      pitStops: s.pitStops ?? 0,
      isPitting: s.isPitting ?? false,
    }));
    const hasPlayer = topRows.some((r) => r.isPlayer);
    if (!hasPlayer) {
      const playerEntry = hud.standings.find((s) => s.isPlayer);
      if (playerEntry && topRows.length >= 6) {
        topRows[5] = {
          position: playerEntry.position,
          code: getDriverCode(playerEntry.name),
          surname: getDriverSurname(playerEntry.name),
          name: playerEntry.name,
          teamColor: playerEntry.color,
          gapSeconds: playerEntry.gapSeconds,
          isPlayer: true,
          tyreCompound: playerEntry.tyreCompound,
          pitStops: playerEntry.pitStops ?? 0,
          isPitting: playerEntry.isPitting ?? false,
        };
      }
    }
    return topRows;
  }, [hud.standings]);

  // Identify rival immediately ahead and cars behind for F1 25 Objective Card, 3D Driver Tag, and Virtual Rear Mirror
  const { carAhead, carsBehind } = React.useMemo(() => {
    if (!hud.standings || hud.standings.length === 0) {
      return {
        carAhead: { position: 1, surname: 'NORRIS', code: 'NOR', color: '#FF8000', gap: 0.417 },
        carsBehind: [
          { position: 3, code: 'VER', color: '#1E41FF', gap: 1.15 },
          { position: 4, code: 'RUS', color: '#00D2BE', gap: 2.45 },
        ],
      };
    }
    const playerIdx = hud.standings.findIndex((s) => s.isPlayer);
    const aheadEntry = playerIdx > 0 ? hud.standings[playerIdx - 1] : null;
    const behindEntries =
      playerIdx >= 0
        ? hud.standings.slice(playerIdx + 1, playerIdx + 3).map((b) => ({
            position: b.position,
            code: getDriverCode(b.name),
            color: b.color,
            gap: Math.max(0.18, Math.abs(b.gapSeconds - (hud.standings[playerIdx]?.gapSeconds ?? 0))),
          }))
        : [];

    return {
      carAhead: aheadEntry
        ? {
            position: aheadEntry.position,
            surname: getDriverSurname(aheadEntry.name),
            code: getDriverCode(aheadEntry.name),
            color: aheadEntry.color,
            gap: hud.gapAheadSeconds ?? Math.max(0.15, Math.abs((hud.standings[playerIdx]?.gapSeconds ?? 0) - aheadEntry.gapSeconds)),
          }
        : null,
      carsBehind: behindEntries,
    };
  }, [hud.standings, hud.gapAheadSeconds]);

  // 4-wheel differential tire wear values (FL, FR, RL, RR) from 2026 physics
  const baseWear = Math.max(0, Math.min(100, hud.tyreWearPct));
  const flWear = Math.max(0, Math.min(100, Math.round(hud.wheelWearPct?.[0] ?? baseWear - 1)));
  const frWear = Math.max(0, Math.min(100, Math.round(hud.wheelWearPct?.[1] ?? baseWear - 2)));
  const rlWear = Math.max(0, Math.min(100, Math.round(hud.wheelWearPct?.[2] ?? baseWear)));
  const rrWear = Math.max(0, Math.min(100, Math.round(hud.wheelWearPct?.[3] ?? baseWear - 1)));

  const baseTempC =
    hud.liveWeather === 'rain' || hud.liveWeather === 'heavy_rain'
      ? 68 + Math.round((hud.speedKmh / 330) * 18)
      : 92 + Math.round((hud.speedKmh / 330) * 22);

  const tyreColorForWear = (wear: number) => {
    if (wear > 65) return '#10B981';
    if (wear > 35) return '#F59E0B';
    return '#EF4444';
  };

  const activeCompoundMeta =
    COMPOUND_OPTIONS.find((c) => c.id === hud.tyreCompound) ?? COMPOUND_OPTIONS[1];

  const displayedLapMs = hud.currentLapMs > 0 ? hud.currentLapMs : 69442;
  const displayedBestMs = hud.bestLapMs !== null ? hud.bestLapMs : 68948;

  if (!shouldRender) return null;

  const isPausedState = gameScreen === 'paused';
  const isWet = hud.liveWeather === 'rain' || hud.liveWeather === 'heavy_rain';
  const lapsRemaining = Math.max(1, hud.totalLaps - hud.lap + 1);
  const targetLap = Math.min(hud.totalLaps, hud.lap + 2);

  const gLat = hud.gForceLat ?? 0;
  const gLong = hud.gForceLong ?? 0;
  const gTotal = hud.gForceTotal ?? 0;

  const gForceTilt = gLat * -0.65;
  const gForceTranslateX = gLat * 1.1;
  const gForceTranslateY = gLong * -1.4;
  const gForceScale = 1.0 + Math.min(0.018, Math.abs(gLong) * 0.0035 + (gTotal > 3.5 ? 0.005 : 0));

  return (
    <div
      key={animEpoch}
      data-hud-theme={hudColorScheme}
      className={`fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 transition-transform duration-75 ease-out ${
        isPausedState ? 'opacity-45 scale-[0.985] blur-[1.5px]' : 'opacity-100 blur-0'
      }`}
      style={{
        transform: `perspective(1200px) rotate(${gForceTilt}deg) translate(${gForceTranslateX}px, ${gForceTranslateY}px) scale(${gForceScale})`,
        filter: hudThemeMeta.filter,
        boxShadow: impactFlash
          ? 'inset 0 0 110px rgba(239, 68, 68, 0.72)'
          : gTotal > 3.2
            ? 'inset 0 0 60px rgba(239, 68, 68, 0.22)'
            : 'none',
      }}
    >
      <PitBoard
        visible={hud.pitBoardActive}
        position={hud.position}
        totalRacers={hud.totalRacers}
        gapAheadSeconds={hud.gapAheadSeconds}
        lap={hud.lap}
        totalLaps={hud.totalLaps}
      />

      {/* Circuit DRS Zone Entry / Exit Notification & Live Activation Telemetry */}
      {hud.countdownState === 'racing' && (hud.drsState?.notification || hud.drsState?.inZone || hud.drsState?.approachingMeters !== null) && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1.5">
          {/* Entry / Exit Transition Notification Banner */}
          {hud.drsState?.notification && (
            <div
              key={`drs-notif-${hud.drsState.notificationSeq}`}
              role="status"
              aria-live="polite"
              className={`rounded-xl border px-3.5 py-1 flex items-center gap-2 shadow-xl ${
                hud.drsState.notification === 'entered'
                  ? 'drs-zone-enter-anim border-emerald-400/90 bg-emerald-950/95 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.55)]'
                  : 'drs-zone-exit-anim border-amber-400/75 bg-slate-950/92 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.35)]'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  hud.drsState.notification === 'entered'
                    ? 'bg-emerald-400 shadow-[0_0_10px_#34D399]'
                    : 'bg-amber-400 shadow-[0_0_8px_#FBBF24]'
                }`}
              />
              <span className="font-display font-black text-[11px] tracking-wider uppercase">
                {hud.drsState.notification === 'entered'
                  ? `X-MODE ZONE ${hud.drsState.notificationZoneNumber ?? ''} ENTERED`
                  : `X-MODE ZONE ${hud.drsState.notificationZoneNumber ?? ''} EXITED · Z-MODE`}
              </span>
              {hud.drsState.notificationZoneName && (
                <span className="font-mono-telemetry text-[10px] text-white/80 uppercase hidden sm:inline">
                  · {hud.drsState.notificationZoneName}
                </span>
              )}
            </div>
          )}

          {/* Active 2026 X-Mode Zone & MOM Override Live Status */}
          {hud.drsState?.inZone ? (
            <div
              className={`rounded-xl border-2 px-4 py-1.5 flex flex-col items-center gap-1 min-w-[238px] transition-colors ${
                hud.drsState.disabledByWeather
                  ? 'border-sky-400/75 bg-slate-950/92 shadow-[0_0_18px_rgba(56,189,248,0.35)]'
                  : hud.drsActive || hud.manualOverrideActive
                    ? 'border-emerald-400 bg-emerald-950/95 shadow-[0_0_26px_rgba(16,185,129,0.85)]'
                    : !hud.drsState.gapQualified
                      ? 'border-sky-400/75 bg-slate-950/92'
                      : 'border-emerald-400/80 bg-emerald-950/90 shadow-[0_0_18px_rgba(16,185,129,0.45)]'
              }`}
            >
              <div className="flex items-center gap-2.5 w-full justify-center">
                <div
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    hud.drsState.disabledByWeather
                      ? 'bg-sky-400'
                      : hud.manualOverrideActive
                        ? 'bg-fuchsia-400 shadow-[0_0_12px_#E879F9]'
                        : hud.drsActive
                          ? 'bg-emerald-300 shadow-[0_0_12px_#34D399]'
                          : 'bg-sky-400'
                  }`}
                />
                <div className="flex flex-col items-center leading-tight">
                  <span
                    className={`font-display font-black text-xs tracking-wider ${
                      hud.drsState.disabledByWeather
                        ? 'text-sky-300'
                        : hud.manualOverrideActive
                          ? 'text-fuchsia-300'
                          : hud.drsActive
                            ? 'text-emerald-300'
                            : 'text-sky-200'
                    }`}
                  >
                    {hud.drsState.disabledByWeather
                      ? `X-MODE Z${hud.drsState.zoneNumber} LOCKED • WET TRACK`
                      : hud.manualOverrideActive
                        ? `X-MODE + 350KW MOM OVERRIDE`
                        : hud.drsActive
                          ? `ACTIVE AERO X-MODE • Z${hud.drsState.zoneNumber}/${hud.drsState.totalZones}`
                          : hud.drsState.gapQualified
                            ? `X-MODE & MOM READY • Z${hud.drsState.zoneNumber}/${hud.drsState.totalZones}`
                            : `X-MODE READY • Z${hud.drsState.zoneNumber}/${hud.drsState.totalZones}`}
                  </span>
                  <span className="font-mono-telemetry text-[10px] text-emerald-100/90 tabular-nums">
                    {hud.drsState.zoneName} · {hud.drsState.remainingMeters ?? 0}m REMAINING
                  </span>
                </div>
              </div>
              {hud.drsState.zoneLengthMeters && hud.drsState.remainingMeters !== null && (
                <div className="w-full h-1 rounded-full bg-black/50 overflow-hidden border border-white/10">
                  <div
                    className={`h-full transition-all duration-100 ${
                      hud.drsState.disabledByWeather
                        ? 'bg-sky-400'
                        : hud.manualOverrideActive
                          ? 'bg-fuchsia-400'
                          : hud.drsActive
                            ? 'bg-emerald-300'
                            : 'bg-sky-400'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, (hud.drsState.remainingMeters / hud.drsState.zoneLengthMeters) * 100)
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            hud.drsState?.approachingMeters !== null &&
            !hud.drsState.notification && (
              <div className="rounded-lg border border-emerald-400/50 bg-slate-950/90 px-3 py-1 flex items-center gap-2 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400/80" />
                <span className="font-mono-telemetry text-[10px] font-bold text-emerald-300 tabular-nums tracking-wide">
                  X-MODE Z{hud.drsState.approachingZoneNumber} ({hud.drsState.approachingZoneName}) IN{' '}
                  {hud.drsState.approachingMeters}m
                </span>
              </div>
            )
          )}
        </div>
      )}

      {/* Floating 3D-Style On-Track Driver Tag Ahead (F1 25 Broadcast Style) */}
      {driverTags3d && carAhead && carAhead.gap < 4.5 && hud.countdownState === 'racing' && (
        <div className="fixed left-1/2 top-[31%] -translate-x-1/2 z-10 pointer-events-none flex flex-col items-center animate-hud-enter-tc">
          {/* Purple Objective Diamond Icon */}
          <div className="w-5 h-5 rounded-full bg-purple-950/90 border border-fuchsia-400/80 flex items-center justify-center mb-1 shadow-lg">
            <div className="w-2 h-2 rotate-45 bg-fuchsia-400" />
          </div>
          {/* Driver Tag Pill */}
          <div
            className="rounded border border-white/25 px-2.5 py-0.5 flex items-center gap-1.5 shadow-xl"
            style={{ backgroundColor: 'rgba(11, 15, 25, 0.92)' }}
          >
            <span className="font-mono-telemetry text-[11px] font-bold text-white tabular-nums">
              {carAhead.position}
            </span>
            <span
              className="w-1 h-3 rounded-full"
              style={{ backgroundColor: carAhead.color }}
            />
            <span className="font-display font-bold text-[11px] tracking-wider text-white">
              {carAhead.surname}
            </span>
            <span className="font-mono-telemetry text-[10px] text-fuchsia-300 tabular-nums ml-0.5">
              -{carAhead.gap.toFixed(3)}s
            </span>
          </div>
        </div>
      )}

      {/* Windshield Swipe Gesture Zone: Speed-Adaptive Precision Drag Steer · Left Swipe Up/Down X-Mode/Z-Mode · Right Swipe Up/Down Gear Shift */}
      {touchControls && mobileSwipeGestures && gameScreen === 'playing' && (
        <div
          aria-label="Touchscreen Swipe Gesture Zone"
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const side = e.clientX < window.innerWidth * 0.5 ? 'left' : 'right';
            swipeCenterSignRef.current = 0;
            swipeGestureRef.current = {
              pointerId: e.pointerId,
              startX: e.clientX,
              startY: e.clientY,
              mode: 'pending',
              side,
            };
          }}
          onPointerMove={(e) => {
            const g = swipeGestureRef.current;
            if (!g || g.pointerId !== e.pointerId || g.mode === 'done') return;
            const dx = e.clientX - g.startX;
            const dy = e.clientY - g.startY;
            if (g.mode === 'pending') {
              if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.1) {
                g.mode = 'steer';
              } else if (Math.abs(dy) > 28 && Math.abs(dy) > Math.abs(dx) * 1.15) {
                g.mode = 'done';
                setActiveSwipeSteer(null);
                if (g.side === 'right') {
                  if (dy < 0) {
                    onManualShift(1);
                    showSwipeToast('SWIPE ↑ UPSHIFT');
                  } else {
                    onManualShift(-1);
                    showSwipeToast('SWIPE ↓ DOWNSHIFT');
                  }
                } else {
                  if (dy < 0) {
                    applyAeroModeToggle('x_mode');
                  } else {
                    applyAeroModeToggle('z_mode');
                  }
                }
                return;
              }
            }
            if (g.mode === 'steer') {
              const absDx = Math.abs(dx);
              const deadPx = 5;
              const fullThrowPx = 128 / Math.max(0.55, Math.min(1.65, mobileSwipeSensitivity));
              const norm = Math.min(1, Math.max(0, absDx - deadPx) / Math.max(24, fullThrowPx - deadPx));
              const speedAtten = 1 - Math.min(0.28, (hud.speedKmh / 340) * 0.28);
              const axis = Math.max(-1, Math.min(1, -Math.sign(dx) * Math.pow(norm, 1.32) * speedAtten));
              const curSign = Math.abs(axis) < 0.04 ? 0 : Math.sign(axis);
              if (swipeCenterSignRef.current !== 0 && curSign !== 0 && curSign !== swipeCenterSignRef.current) {
                onTriggerMobileHaptic?.('shift_up', 0.35);
              }
              swipeCenterSignRef.current = curSign;
              setActiveSwipeSteer(axis);
              onTouchSteerAxis?.(axis);
            }
          }}
          onPointerUp={(e) => {
            const g = swipeGestureRef.current;
            if (g && g.pointerId === e.pointerId) {
              if (g.mode === 'steer') {
                onTouchSteerAxis?.(0);
                setActiveSwipeSteer(null);
              }
              swipeCenterSignRef.current = 0;
              swipeGestureRef.current = null;
            }
          }}
          onPointerCancel={() => {
            onTouchSteerAxis?.(0);
            setActiveSwipeSteer(null);
            swipeCenterSignRef.current = 0;
            swipeGestureRef.current = null;
          }}
          className="fixed inset-x-10 sm:inset-x-28 top-28 bottom-40 z-[5] pointer-events-auto touch-none select-none"
        />
      )}

      {/* Live Windshield Swipe Steering Arc Indicator */}
      {touchControls && activeSwipeSteer !== null && (
        <div className="fixed bottom-40 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-3 py-1 rounded-xl border border-amber-400/60 bg-slate-950/90 flex items-center gap-2 shadow-xl tabular-nums">
          <span className="text-[9px] font-mono-telemetry text-amber-300 font-bold">SWIPE STEER</span>
          <div className="relative w-16 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div
              className="absolute top-0 bottom-0 w-2.5 -translate-x-1/2 rounded-full bg-amber-400"
              style={{ left: `${50 - activeSwipeSteer * 45}%` }}
            />
          </div>
          <span className="text-[10px] font-display font-bold text-white w-7 text-right">
            {Math.round(-activeSwipeSteer * 24)}°
          </span>
        </div>
      )}

      {/* Live Swipe Gesture Confirmation Pill */}
      {swipeFeedback && touchControls && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-3 py-1 rounded-lg border border-cyan-400/60 bg-slate-950/90 text-[10px] font-display font-bold tracking-wider text-cyan-200 shadow-xl whitespace-nowrap">
          {swipeFeedback}
        </div>
      )}

      {/* In-HUD Mobile Layout & Control Customizer Popover */}
      {touchControls && showMobileCustomizer && (
        <div
          className={`fixed bottom-28 ${mobileButtonLayout === 'left_handed' ? 'right-4 sm:right-6' : 'left-4 sm:left-6'} z-40 pointer-events-auto w-76 sm:w-84 max-h-[76vh] overflow-y-auto rounded-2xl border border-red-500/35 p-3 shadow-2xl flex flex-col gap-2.5 text-white backdrop-blur-md`}
          style={{ backgroundColor: 'rgba(9, 12, 18, 0.96)' }}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-3.5 rounded-full bg-red-500" />
              <span className="font-display font-bold text-xs tracking-wider text-white uppercase">
                F1® Mobile Controls Deck
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowMobileCustomizer(false)}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
              aria-label="Close layout customizer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Quick 1-Tap Pro Grip Presets */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono-telemetry text-slate-400 uppercase">Quick Grip Styles</span>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  ['f1_classic', 'Classic'],
                  ['thumb_pro', 'Pro'],
                  ['lefty', 'Lefty'],
                  ['gyro_clean', 'Gyro'],
                ] as const
              ).map(([presetId, label]) => (
                <button
                  key={presetId}
                  type="button"
                  onClick={() => {
                    onApplyMobilePreset?.(presetId);
                    onTriggerMobileHaptic?.('shift_up', 0.5);
                  }}
                  className="py-1.5 px-1 rounded-lg bg-white/8 hover:bg-red-500/25 border border-white/15 hover:border-red-400/60 text-[9.5px] font-display font-bold text-white cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono-telemetry text-slate-400 uppercase">Button Layout</span>
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  ['standard', 'Standard L/R'],
                  ['left_handed', 'Left-Handed'],
                  ['compact_thumb', 'Compact Thumb'],
                  ['split_pro', 'Pro Gestures'],
                ] as [MobileButtonLayout, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectMobileButtonLayout?.(id)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-display font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                    mobileButtonLayout === id
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-[9px] font-mono-telemetry text-slate-400 uppercase">Scale</span>
              <div className="flex items-center gap-1">
                {(['compact', 'normal', 'large'] as MobileButtonScale[]).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => onSelectMobileButtonScale?.(sc)}
                    className={`flex-1 py-1 rounded text-[9px] font-display font-bold uppercase cursor-pointer whitespace-nowrap shrink-0 ${
                      mobileButtonScale === sc
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {sc.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-mono-telemetry text-slate-400 uppercase">Swipes</span>
              <button
                type="button"
                onClick={() => onToggleMobileSwipeGestures?.()}
                className={`px-2.5 py-1 rounded text-[9px] font-display font-bold uppercase cursor-pointer border whitespace-nowrap shrink-0 ${
                  mobileSwipeGestures
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-white/5 border-white/15 text-slate-400'
                }`}
              >
                {mobileSwipeGestures ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono-telemetry text-slate-400 uppercase">Button Spacing</span>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  ['compact', 'Tight'],
                  ['normal', 'Normal'],
                  ['wide', 'Wide'],
                ] as [MobileButtonSpacing, string][]
              ).map(([sp, label]) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => onSelectMobileButtonSpacing?.(sp)}
                  className={`py-1 rounded text-[9px] font-display font-bold uppercase cursor-pointer whitespace-nowrap shrink-0 ${
                    mobileButtonSpacing === sp
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Customizable Individual Modules & Ergonomics */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono-telemetry text-slate-400 uppercase">Ergonomics & Modules</span>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => onToggleMobileFloatingJoystick?.()}
                className={`px-2 py-1 rounded text-[9px] font-display font-bold uppercase cursor-pointer border whitespace-nowrap shrink-0 ${
                  mobileFloatingJoystick
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-white/5 border-white/15 text-slate-400'
                }`}
              >
                Float Stick: {mobileFloatingJoystick ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => onToggleMobileSwapPedals?.()}
                className={`px-2 py-1 rounded text-[9px] font-display font-bold uppercase cursor-pointer border whitespace-nowrap shrink-0 ${
                  mobileSwapPedals
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-white/5 border-white/15 text-slate-400'
                }`}
              >
                {mobileSwapPedals ? 'Pedals: GAS|BRK' : 'Pedals: BRK|GAS'}
              </button>
              <button
                type="button"
                onClick={() => onToggleMobileShowGearStrip?.()}
                className={`px-2 py-1 rounded text-[9px] font-display font-bold uppercase cursor-pointer border whitespace-nowrap shrink-0 ${
                  mobileShowGearStrip
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-white/5 border-white/15 text-slate-400'
                }`}
              >
                Gear Swipe: {mobileShowGearStrip ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => onToggleMobileShowErsButton?.()}
                className={`px-2 py-1 rounded text-[9px] font-display font-bold uppercase cursor-pointer border whitespace-nowrap shrink-0 ${
                  mobileShowErsButton
                    ? 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-200'
                    : 'bg-white/5 border-white/15 text-slate-400'
                }`}
              >
                OVT Boost: {mobileShowErsButton ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 border-t border-white/10 pt-1.5 text-[9px] font-mono-telemetry tabular-nums">
            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-400 uppercase whitespace-nowrap">Btn Opacity</span>
              <input
                type="range"
                min={0.55}
                max={1.0}
                step={0.05}
                value={mobileButtonOpacity}
                onChange={(e) => onChangeMobileButtonOpacity?.(Number(e.target.value))}
                className="w-24 accent-sky-400 cursor-pointer"
              />
              <span className="text-white w-8 text-right">{Math.round(mobileButtonOpacity * 100)}%</span>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-400 uppercase whitespace-nowrap">Swipe Prec.</span>
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.05}
                value={mobileSwipeSensitivity}
                onChange={(e) => onChangeMobileSwipeSensitivity?.(Number(e.target.value))}
                className="w-24 accent-cyan-400 cursor-pointer"
              />
              <span className="text-white w-8 text-right">{mobileSwipeSensitivity.toFixed(1)}x</span>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-slate-400 uppercase whitespace-nowrap">Gyro Sens</span>
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.05}
                value={mobileGyroSensitivity}
                onChange={(e) => onChangeMobileGyroSensitivity?.(Number(e.target.value))}
                className="w-24 accent-amber-400 cursor-pointer"
              />
              <span className="text-white w-8 text-right">{mobileGyroSensitivity.toFixed(1)}x</span>
            </label>
            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => onTriggerMobileHaptic?.('kerb', 0.78)}
                className="flex-1 px-2 py-1 rounded bg-white/8 border border-white/15 text-slate-200 font-display font-bold text-[9px] uppercase cursor-pointer whitespace-nowrap shrink-0 hover:bg-white/15"
              >
                TEST HAPTICS
              </button>
              <button
                type="button"
                onClick={calibrateGyroCenter}
                className="flex-1 px-2 py-1 rounded bg-sky-500/20 border border-sky-400/50 text-sky-200 font-display font-bold text-[9px] uppercase cursor-pointer whitespace-nowrap shrink-0 hover:bg-sky-500/30"
              >
                ZERO GYRO
              </button>
            </div>
          </div>
          <div className="text-[9px] font-mono-telemetry text-slate-400 leading-snug border-t border-white/10 pt-1.5">
            Swipes: Drag ◀▶ Steer · Left ↑/↓ X/Z Aero · Right ↑/↓ Shift Gear
          </div>
        </div>
      )}

      {/* Streamlined Live Overlay Widget Switcher & Theme Bar (Toggles without pausing) */}
      {showHudOverlayPanel && (
        <div
          className={`fixed top-14 right-14 sm:right-16 z-40 pointer-events-auto w-72 sm:w-80 max-h-[75vh] overflow-y-auto rounded-2xl border ${hudThemeMeta.accentBorder} p-3 shadow-2xl flex flex-col gap-2.5 text-white hud-themed-card`}
          style={{ backgroundColor: hudThemeMeta.panelBg }}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Layers className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span className="font-display font-bold text-xs tracking-wider text-white uppercase whitespace-nowrap">
                HUD Overlays & Theme
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onApplyHudWidgetPreset?.('minimal')}
                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] font-display font-bold text-amber-300 cursor-pointer whitespace-nowrap"
              >
                MINIMAL
              </button>
              <button
                type="button"
                onClick={() => onApplyHudWidgetPreset?.('all')}
                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] font-display font-bold text-emerald-300 cursor-pointer whitespace-nowrap"
              >
                ALL ON
              </button>
              <button
                type="button"
                onClick={() => setShowHudOverlayPanel(false)}
                className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
                aria-label="Close overlay panel"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Lighting Color Scheme Selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono-telemetry text-slate-400 uppercase">
              Lighting Visibility Scheme
            </span>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  ['motorsport_dark', 'Dark'],
                  ['sunlight_contrast', 'Sun'],
                  ['night_amber', 'Night'],
                  ['telemetry_cyan', 'Cyan'],
                ] as [HudColorScheme, string][]
              ).map(([scheme, label]) => (
                <button
                  key={scheme}
                  type="button"
                  onClick={() => onSelectHudColorScheme?.(scheme)}
                  className={`py-1.5 px-1 rounded-lg text-[10px] font-display font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                    hudColorScheme === scheme
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Adaptive Viewport Scaling Selector */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[9px] font-mono-telemetry text-slate-400 uppercase">
              <span>Adaptive HUD Scale</span>
              <span className="text-amber-300 font-bold tabular-nums">{Math.round(adaptiveHudScale * 100)}%</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  ['auto', 'Auto'],
                  ['compact', 'Compact'],
                  ['standard', 'Std'],
                  ['large', 'Large'],
                ] as [HudScaleMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSelectHudScaleMode?.(mode)}
                  className={`py-1.5 px-1 rounded-lg text-[10px] font-display font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                    hudScaleMode === mode
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Individual Data Widget Toggles */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono-telemetry text-slate-400 uppercase">
              Live Data Widgets
            </span>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  ['leaderboard', 'Standings'],
                  ['timingTower', 'Timing'],
                  ['pitStrategy', 'Strategy'],
                  ['miniMap', 'Mini-Map'],
                  ['weatherOverlay', 'Weather'],
                  ['tyrePanel', 'Tyres'],
                  ['haloCluster', 'Halo Dial'],
                  ['gForceRadar', 'G-Force'],
                  ['damageDiagram', 'Damage'],
                ] as [HudWidgetKey, string][]
              ).map(([key, label]) => {
                const enabled = hudWidgets[key] !== false;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onToggleHudWidget?.(key)}
                    className={`min-h-[34px] px-1.5 py-1 rounded-lg border text-[10px] font-display font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                      enabled
                        ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                        : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TOP BAR: Top-Left (F1 RACE Tower + Objective Callout) · Top-Center (Virtual Mirror + Lights + Flags + Dynamic Weather Telemetry) · Top-Right (S1/S2/S3 & Lap Timer Box) */}
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        {/* TOP-LEFT: Authentic EA Sports F1 25 'F1 RACE' Broadcast Tower + Dynamic Race Objective Callout */}
        <div
          className={`flex flex-col gap-2 origin-top-left ${
            hudWidgets.leaderboard !== false ? 'min-w-[144px] sm:min-w-[232px] md:min-w-[258px]' : ''
          } ${isExiting ? 'animate-hud-exit-tl' : 'animate-hud-enter-tl'}`}
          style={{ transform: `scale(${adaptiveHudScale})` }}
        >
          {hudWidgets.leaderboard !== false && (
          <div
            className={`hud-themed-card rounded-lg overflow-hidden border ${hudThemeMeta.accentBorder} shadow-2xl`}
            style={{ backgroundColor: hudThemeMeta.panelBg }}
          >
            {/* F1 RACE Header */}
            <div
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between border-b border-white/10"
              style={{
                background: 'linear-gradient(180deg, rgba(22, 28, 40, 0.98) 0%, rgba(12, 16, 24, 0.98) 100%)',
              }}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <svg width="28" height="12" viewBox="0 0 44 18" fill="none" aria-hidden="true" className="sm:w-[34px] sm:h-[14px]">
                  <path d="M2 15L12 3H38L33 8H16L9 15H2Z" fill="#FFFFFF" />
                  <path d="M12 16L19 9H36L32 14H18L15 16H12Z" fill="#EF4444" />
                </svg>
                <span className="font-display font-black text-xs sm:text-base tracking-widest text-white italic">
                  RACE
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <WeatherIcon
                  mode={hud.liveWeather}
                  className={`w-3.5 h-3.5 ${isWet ? 'text-cyan-400' : 'text-amber-400'}`}
                />
                <span className="hidden sm:inline text-[9px] font-mono-telemetry font-bold text-slate-300">
                  {WEATHER_LABELS[hud.liveWeather]}
                  {hud.liveTimeOfDay ? ` · ${hud.liveTimeOfDay.replace('_', ' ').toUpperCase()}` : ''}
                </span>
              </div>
            </div>

            {/* LAP X / Y Sub-Bar */}
            <div className="bg-black/45 px-2.5 sm:px-3 py-1 flex items-center justify-between border-b border-white/10 text-[10px] sm:text-[11px] font-mono-telemetry">
              <span className="text-slate-300 font-bold tracking-wider">
                LAP <span className="text-white text-xs">{hud.lap}</span> / {hud.totalLaps}
              </span>
              <span className="hidden sm:inline text-[10px] text-fuchsia-300 font-semibold">F1® 26 OSD</span>
            </div>

            {/* Standings Rows with Signature Electric Magenta Player Highlight Bar & Live Compound/Pit Telemetry */}
            <div className="flex flex-col divide-y divide-white/[0.06]">
              {leaderboardRows.map((row, idx) => {
                const gapLabel =
                  row.isPitting
                    ? 'IN PIT'
                    : row.isPlayer
                      ? '---.---'
                      : idx === 0 || row.position === 1
                        ? `-${(carAhead?.gap ?? 0.417).toFixed(3)}`
                        : `+${Math.max(0.112, row.gapSeconds).toFixed(3)}`;

                const cmpId = row.tyreCompound ?? (row.isPlayer ? hud.tyreCompound : isWet ? 'wet' : row.position === 5 ? 'soft' : 'medium');
                const rowCompound =
                  cmpId === 'wet'
                    ? { short: 'W', color: '#38BDF8' }
                    : cmpId === 'soft'
                      ? { short: 'S', color: '#EF4444' }
                      : cmpId === 'hard'
                        ? { short: 'H', color: '#F8FAFC' }
                        : { short: 'M', color: '#FACC15' };

                return (
                  <div
                    key={`${row.code}-${row.position}`}
                    className={`${
                      idx >= 3 && !row.isPlayer ? 'hidden sm:flex' : 'flex'
                    } items-center justify-between gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] transition-colors ${
                      row.isPlayer ? 'text-white font-bold shadow-md' : 'text-slate-200'
                    }`}
                    style={
                      row.isPlayer
                        ? {
                            background:
                              'linear-gradient(90deg, rgba(217, 70, 239, 0.96) 0%, rgba(168, 85, 247, 0.95) 85%, rgba(236, 72, 153, 0.95) 100%)',
                          }
                        : { backgroundColor: 'rgba(13, 18, 28, 0.86)' }
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-4 text-right font-mono-telemetry text-[11px] font-bold tabular-nums text-white">
                        {row.position}
                      </span>
                      <span
                        className="w-1 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: row.isPlayer ? '#FFFFFF' : row.teamColor }}
                      />
                      <span className="font-display font-bold tracking-wider text-[11px] text-white truncate">
                        {row.surname}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!row.isPitting && (row.pitStops ?? 0) > 0 && (
                        <span className="px-1 rounded bg-white/10 text-[8px] font-mono-telemetry font-bold text-amber-300 tabular-nums">
                          P{row.pitStops}
                        </span>
                      )}
                      {/* Tyre Compound Circle */}
                      <span
                        className="w-4 h-4 rounded-full border text-[9px] font-display font-bold flex items-center justify-center shrink-0"
                        style={{
                          borderColor: rowCompound.color,
                          color: rowCompound.color,
                          backgroundColor: 'rgba(8, 10, 15, 0.78)',
                        }}
                      >
                        {rowCompound.short}
                      </span>
                      <span
                        className={`font-mono-telemetry text-[11px] tabular-nums w-14 text-right ${
                          row.isPitting ? 'text-amber-300 font-bold' : 'text-white'
                        }`}
                      >
                        {gapLabel}
                      </span>
                      {/* Purple Objective / Fastest Lap Icon on Top 2 rows */}
                      {row.isPlayer ? (
                        <span className="w-4 h-4 rounded bg-fuchsia-700/80 border border-white/40 flex items-center justify-center text-[9px]">
                          ⏱
                        </span>
                      ) : idx === 0 && carAhead ? (
                        <span className="w-4 h-4 rounded bg-purple-900/90 border border-fuchsia-400/60 flex items-center justify-center">
                          <span className="w-1.5 h-1.5 rotate-45 bg-fuchsia-300" />
                        </span>
                      ) : (
                        <span className="w-4" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* F1 25 Dynamic Race Objective / Scenario Callout Card */}
          {raceObjectives && hudWidgets.leaderboard !== false && (
            <div className={`${touchControls ? 'hidden sm:block' : 'block'} hud-themed-card rounded-lg overflow-hidden border border-fuchsia-500/45 shadow-xl max-w-[248px]`}>
              <div
                className="px-2.5 py-1.5 flex items-center gap-2 text-white text-[11px] font-display font-bold tracking-wide"
                style={{
                  background: 'linear-gradient(90deg, rgba(147, 51, 234, 0.95) 0%, rgba(88, 28, 135, 0.92) 100%)',
                }}
              >
                <span className="w-3.5 h-3.5 rounded-full border border-fuchsia-200 flex items-center justify-center shrink-0">
                  <span className="w-1.5 h-1.5 rotate-45 bg-white" />
                </span>
                <span className="truncate">
                  {carAhead
                    ? `Overtake ${carAhead.surname.charAt(0) + carAhead.surname.slice(1).toLowerCase()} before lap ${targetLap}`
                    : `Hold P1 Lead for ${lapsRemaining} Laps`}
                </span>
              </div>
              <div
                className="px-3 py-1.5 flex flex-col gap-0.5 text-[11px] font-mono-telemetry text-slate-200"
                style={{ backgroundColor: hudThemeMeta.panelBg }}
              >
                <div>
                  <span className="font-bold text-white">
                    {carAhead ? `-${carAhead.gap.toFixed(3)}` : '+1.240'}
                  </span>{' '}
                  <span className="text-slate-300">
                    Gap to {carAhead ? carAhead.surname : 'PURSUER'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-white">{lapsRemaining}</span>{' '}
                  <span className="text-slate-300">
                    {lapsRemaining === 1 ? 'Lap remaining' : 'Laps remaining'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TOP-CENTER: F1 25 Virtual Rear-View Mirror + 5-Pod Start Gantry Lights + Flags */}
        <div
          className={`flex flex-col items-center gap-2 origin-top ${
            isExiting ? 'animate-hud-exit-tc' : 'animate-hud-enter-tc [animation-delay:45ms]'
          }`}
          style={{ transform: `scale(${adaptiveHudScale})` }}
        >
          {/* F1 25 Top-Center Virtual Rear-View Mirror (from Screenshot 8) */}
          {virtualMirror && showMirrorLocal && (
            <div
              className="relative w-64 sm:w-80 h-14 sm:h-16 rounded-b-xl rounded-t-md border-2 border-slate-700/90 overflow-hidden shadow-2xl"
              style={{
                background: isWet
                  ? 'linear-gradient(180deg, #475569 0%, #64748B 44%, #1E293B 46%, #0F172A 100%)'
                  : hud.liveWeather === 'night'
                    ? 'linear-gradient(180deg, #090D16 0%, #111827 44%, #1E293B 46%, #0F172A 100%)'
                    : 'linear-gradient(180deg, #38BDF8 0%, #93C5FD 44%, #334155 46%, #1E293B 100%)',
              }}
            >
              {/* Rear Track Perspective Lines & Kerbs */}
              <svg viewBox="0 0 320 64" className="w-full h-full">
                {/* Distant Tree/Grandstand Treeline */}
                <path
                  d="M0 28 L45 20 L95 25 L160 22 L225 25 L275 19 L320 28 L320 30 L0 30 Z"
                  fill={hud.liveWeather === 'night' ? '#0F172A' : '#1E293B'}
                  opacity="0.85"
                />
                {/* Rear Asphalt Road Trapezoid */}
                <polygon points="110,29 210,29 310,64 10,64" fill="#1E2430" />
                {/* Left & Right Red/White Kerbs */}
                <polygon points="104,29 112,29 24,64 4,64" fill="#EF4444" />
                <polygon points="208,29 216,29 316,64 296,64" fill="#EF4444" />
                <line x1="160" y1="29" x2="160" y2="64" stroke="rgba(255,255,255,0.22)" strokeDasharray="4 4" />

                {/* Dynamic Rival Cars Pursuing Behind */}
                {carsBehind.map((car, idx) => {
                  const scale = Math.max(0.45, Math.min(1.15, 1.25 - car.gap * 0.25));
                  const cx = idx === 0 ? 142 + Math.sin(hud.currentLapMs * 0.002) * 14 : 186 - Math.cos(hud.currentLapMs * 0.002) * 12;
                  const cy = idx === 0 ? 47 : 41;
                  return (
                    <g key={car.code} transform={`translate(${cx}, ${cy}) scale(${scale})`}>
                      {/* Rear Wing & Tyres */}
                      <rect x="-14" y="-6" width="28" height="3" rx="1" fill="#090B0F" />
                      <rect x="-16" y="-2" width="6" height="8" rx="1.5" fill="#090B0F" />
                      <rect x="10" y="-2" width="6" height="8" rx="1.5" fill="#090B0F" />
                      {/* Car Nose & Halo */}
                      <polygon points="-9,5 9,5 5,-4 -5,-4" fill={car.color} />
                      {/* Glowing Red Rain / ERS Light */}
                      <circle cx="0" cy="2" r="2" fill="#EF4444" />
                    </g>
                  );
                })}
              </svg>

              {/* Carbon Mirror Bezel Label & Gap Behind */}
              <div className="absolute inset-x-0 top-0 px-2 py-0.5 flex items-center justify-between text-[8px] font-mono-telemetry text-white/80 bg-black/35">
                <span>REAR VIEW MIRROR</span>
                {carsBehind[0] && (
                  <span className="text-amber-300 font-bold">
                    {carsBehind[0].code} +{carsBehind[0].gap.toFixed(2)}s
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 5-Pod Red Start Lights Gantry (from Screenshot 8) */}
          {hud.countdownState !== 'racing' && hud.countdownState !== 'go' && (
            <div
              className="rounded-xl border border-white/20 px-4 py-2 flex items-center gap-3 shadow-2xl animate-hud-banner-pop"
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.95)' }}
            >
              {[1, 2, 3, 4, 5].map((idx) => {
                const lit = idx <= activeLights;
                return (
                  <div key={idx} className="flex flex-col items-center gap-1 bg-black/60 px-1.5 py-1 rounded border border-white/10">
                    <div className="w-3 h-3 rounded-full bg-neutral-900 border border-white/10" />
                    <div
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-white/15 transition-all"
                      style={{
                        backgroundColor: lit ? '#EF4444' : '#261214',
                        boxShadow: lit ? '0 0 18px rgba(239, 68, 68, 0.95)' : 'none',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* F1 25/26 Launch Clutch & Optimal RPM Prompt during Countdown */}
          {launchClutchAssist && hud.countdownState !== 'racing' && hud.countdownState !== 'go' && (() => {
            const minRpm = 3000;
            const maxRpm = 13000;
            const rpmPct = Math.max(0, Math.min(100, ((hud.rpm - minRpm) / (maxRpm - minRpm)) * 100));
            const optLowPct = ((8200 - minRpm) / (maxRpm - minRpm)) * 100;
            const optHighPct = ((11550 - minRpm) / (maxRpm - minRpm)) * 100;
            const inWindow = hud.rpm >= 8200 && hud.rpm <= 11550;
            const tooHigh = hud.rpm > 11550;
            return (
              <div
                className={`rounded-lg border px-3.5 py-2 flex flex-col gap-1.5 shadow-xl animate-hud-banner-pop min-w-[270px] sm:min-w-[310px] ${
                  inWindow
                    ? 'border-emerald-400/70'
                    : tooHigh
                      ? 'border-red-400/70'
                      : 'border-fuchsia-500/50'
                }`}
                style={{ backgroundColor: 'rgba(13, 16, 24, 0.94)' }}
              >
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-fuchsia-600 text-white font-display font-bold text-[9px] whitespace-nowrap">
                      SPACE / W
                    </span>
                    <span className="font-display font-bold text-white tracking-wide uppercase">
                      Launch Clutch
                    </span>
                  </div>
                  <span
                    className={`font-mono-telemetry font-bold tabular-nums ${
                      inWindow ? 'text-emerald-300' : tooHigh ? 'text-red-400' : 'text-amber-300'
                    }`}
                  >
                    {hud.rpm} RPM · {inWindow ? 'OPTIMAL' : tooHigh ? 'WHEELSPIN' : 'BUILD RPM'}
                  </span>
                </div>
                <div className="relative w-full h-2 rounded-full bg-black/80 border border-white/15 overflow-hidden">
                  {/* Optimal 8,200 - 11,550 RPM Sweet Spot Zone */}
                  <div
                    className="absolute top-0 bottom-0 bg-emerald-500/35 border-x border-emerald-400/80"
                    style={{ left: `${optLowPct}%`, width: `${optHighPct - optLowPct}%` }}
                  />
                  {/* Live RPM Needle Bar */}
                  <div
                    className={`h-full transition-all duration-75 ${
                      inWindow ? 'bg-emerald-400' : tooHigh ? 'bg-red-500' : 'bg-fuchsia-400'
                    }`}
                    style={{ width: `${rpmPct}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-300">
                  Hold clutch + throttle in the green band, release on lights out
                </span>
              </div>
            );
          })()}

          {hud.launchFeedback && !hud.wrongWay && (
            <div
              key={hud.launchFeedback}
              className={`rounded-lg border px-3.5 py-1 text-[11px] font-display font-bold tracking-wider uppercase animate-hud-banner-pop ${
                hud.launchFeedback.startsWith('PERFECT')
                  ? 'border-emerald-400/75 text-emerald-300'
                  : hud.launchFeedback.includes('WHEELSPIN')
                    ? 'border-amber-400/75 text-amber-300'
                    : 'border-cyan-400/60 text-cyan-200'
              }`}
              style={{ backgroundColor: 'rgba(9, 13, 20, 0.92)' }}
            >
              {hud.launchFeedback}
            </div>
          )}

          {hud.wrongWay && (
            <div
              className="rounded-lg border border-red-500/70 px-4 py-1.5 text-xs font-display font-bold tracking-widest text-red-400 animate-hud-banner-pop"
              style={{ backgroundColor: 'rgba(40, 10, 14, 0.9)' }}
            >
              WRONG WAY — TURN AROUND
            </div>
          )}

          <MarshalingFlagOverlay
            trackFlag={hud.trackFlag}
            currentSector={hud.currentSector}
            lap={hud.lap}
            totalLaps={hud.totalLaps}
            wrongWay={hud.wrongWay}
          />

          {hud.bannerMessage && !hud.wrongWay && (
            <div
              key={hud.bannerMessage}
              className="rounded-lg border border-amber-400/40 px-4 py-1 text-xs font-display font-semibold tracking-wider text-amber-300 animate-hud-banner-pop"
              style={{ backgroundColor: 'rgba(9, 11, 15, 0.88)' }}
            >
              {hud.bannerMessage}
            </div>
          )}

          <DrsProgressWidget
            drsState={hud.drsState}
            drsAvailable={hud.drsAvailable}
            drsActive={hud.drsActive}
            speedKmh={hud.speedKmh}
            activeAeroMode={hud.activeAeroMode}
            manualOverrideAvailable={hud.manualOverrideAvailable}
            manualOverrideActive={hud.manualOverrideActive}
            mgukPowerKw={hud.mgukPowerKw}
          />

          {/* Live Dynamic Weather Impact Telemetry Overlay */}
          {hudWidgets.weatherOverlay !== false && hud.weatherTyreImpact && hud.countdownState === 'racing' && (
            <div
              className={`hud-themed-card rounded-xl border px-2.5 py-1 flex items-center gap-2 sm:gap-2.5 shadow-xl text-[9px] font-mono-telemetry tabular-nums ${
                hud.weatherTyreImpact.crossoverUrgent
                  ? 'border-amber-400/75 bg-amber-950/90 text-amber-100'
                  : isWet || hud.weatherTyreImpact.trackTemperatureC >= 40 || hud.weatherTyreImpact.trackTemperatureC <= 18
                    ? 'border-cyan-400/45 bg-slate-950/88 text-slate-200'
                    : 'border-white/15 bg-slate-950/82 text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1 whitespace-nowrap">
                <WeatherIcon mode={hud.liveWeather} className={`w-3 h-3 ${isWet ? 'text-cyan-300' : 'text-amber-300'}`} />
                <strong className="text-white">{hud.weatherTyreImpact.trackTemperatureC.toFixed(0)}°C</strong>
                <span className="text-[8px] text-slate-400">
                  {hud.weatherTyreImpact.trackTempTrend === 'heating'
                    ? '↑'
                    : hud.weatherTyreImpact.trackTempTrend === 'cooling'
                      ? '↓'
                      : '·'}
                </span>
              </span>
              <span className="text-white/20">|</span>
              <span className="whitespace-nowrap">
                WET <strong className={hud.trackWetnessPct > 25 ? 'text-cyan-300' : 'text-slate-200'}>{Math.round(hud.trackWetnessPct)}%</strong>
              </span>
              <span className="hidden sm:inline text-white/20">|</span>
              <span className="hidden sm:inline whitespace-nowrap">
                GRIP{' '}
                <strong
                  className={
                    hud.weatherTyreImpact.gripMultiplier < 0.85
                      ? 'text-red-400'
                      : hud.weatherTyreImpact.gripMultiplier < 0.96
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                  }
                >
                  {Math.round(hud.weatherTyreImpact.gripMultiplier * 100)}%
                </strong>
              </span>
              <span className="hidden md:inline whitespace-nowrap">
                WEAR <strong className="text-sky-300">{hud.weatherTyreImpact.wearMultiplier.toFixed(2)}x</strong>
              </span>
              {hud.weatherTyreImpact.crossoverUrgent && (
                <button
                  type="button"
                  onClick={() => onRequestTyreSwitch(hud.weatherTyreImpact!.optimalCompound)}
                  className="pointer-events-auto px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-display font-black text-[8px] tracking-wider uppercase cursor-pointer whitespace-nowrap shrink-0"
                >
                  BOX {hud.weatherTyreImpact.optimalCompound.toUpperCase()}
                </button>
              )}
            </div>
          )}
        </div>

         {/* TOP-RIGHT: Authentic F1 25 S1/S2/S3 Sector Bar + Position + Current/Best Lap Box + Track Log + Utility Buttons */}
        <div
          className={`flex items-start gap-2 sm:gap-2.5 origin-top-right ${
            isExiting ? 'animate-hud-exit-tr' : 'animate-hud-enter-tr [animation-delay:60ms]'
          }`}
          style={{ transform: `scale(${adaptiveHudScale})` }}
        >
          <div className="flex flex-col items-end gap-2">
            {/* F1 25 Top-Right Timing & Sector Box */}
            {hudWidgets.timingTower !== false && (
            <div
              className={`rounded-xl overflow-hidden border ${hudThemeMeta.accentBorder} min-w-[136px] sm:min-w-[220px] md:min-w-[246px] shadow-2xl f1-osd-panel`}
            >
              {/* Top S1 | S2 | S3 Bar */}
              <div className="grid grid-cols-3 border-b border-white/20 bg-black/70 text-[9px] sm:text-[10px] font-mono-telemetry font-extrabold tracking-wider">
                {[1, 2, 3].map((secNum) => {
                  const sGrip = hud.sectorGripPct[secNum - 1] ?? 100;
                  const isCompleted = hud.currentSector > secNum;
                  const isActive = hud.currentSector === secNum;
                  return (
                    <div
                      key={secNum}
                      className={`px-1.5 sm:px-2 py-0.5 sm:py-1 flex items-center justify-between border-r last:border-r-0 border-white/15 transition-all ${
                        isCompleted
                          ? 'bg-emerald-500 text-slate-950 font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]'
                          : isActive
                            ? 'bg-emerald-500/35 text-emerald-300 font-black border-l-2 border-l-emerald-400'
                            : 'text-slate-400 bg-black/40'
                      }`}
                    >
                      <span className="tracking-widest">S{secNum}</span>
                      <span className="text-[8px] sm:text-[9px] tabular-nums">{sGrip}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Middle Row: POS / TOTAL + Current Lap Time with F1 Red Accent */}
              <div
                className="px-2 sm:px-3.5 py-1 sm:py-2 flex items-baseline justify-between gap-2 sm:gap-4 border-b border-red-500/50"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(16, 22, 36, 0.98) 0%, rgba(30, 18, 22, 0.95) 100%)',
                }}
              >
                <div className="flex items-center gap-1 sm:gap-1.5 font-display font-black text-sm sm:text-lg text-white tabular-nums tracking-wide">
                  <span className="text-red-500 text-[10px] sm:text-xs italic font-black">POS</span>
                  <span>{hud.position}</span>
                  <span className="text-[10px] sm:text-xs text-slate-400 font-medium">/{hud.totalRacers}</span>
                </div>
                <div className="font-mono-telemetry font-black text-sm sm:text-xl text-white tabular-nums tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.25)]">
                  {formatLapTime(displayedLapMs)}
                </div>
              </div>

              {/* Bottom Row: BEST Lap + Delta Badge */}
              <div className="px-2 sm:px-3.5 py-1 sm:py-1.5 flex items-center justify-between text-[10px] sm:text-xs font-mono-telemetry bg-black/80 border-b border-white/15">
                <span className="font-display font-black text-[9px] sm:text-[11px] text-slate-300 tracking-wider">
                  <span className="sm:hidden">BEST</span>
                  <span className="hidden sm:inline">BEST LAP</span>
                </span>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono-telemetry font-black tabular-nums shadow-sm ${
                      (hud.deltaMs ?? -214) <= 0
                        ? 'bg-emerald-500/25 border border-emerald-400/70 text-emerald-300'
                        : 'bg-rose-500/25 border border-rose-400/70 text-rose-300'
                    }`}
                  >
                    {hud.deltaMs !== null
                      ? `${hud.deltaMs <= 0 ? '' : '+'}${(hud.deltaMs / 1000).toFixed(3)}s`
                      : '-0.214s'}
                  </span>
                  <span className="text-white font-extrabold tabular-nums">
                    {formatLapTime(displayedBestMs)}
                  </span>
                </div>
              </div>

              {/* Asphalt Track Temp & Active Sector Grip Telemetry Strip */}
              <div className="px-3.5 py-1 flex items-center justify-between text-[9px] font-mono-telemetry tabular-nums bg-black/90 text-slate-300 border-t border-white/10">
                <span>
                  TRK TEMP:{' '}
                  <strong className="text-amber-400 font-bold">{hud.trackTemperature ?? 34}°C</strong>
                </span>
                <span>
                  S{hud.currentSector} GRIP:{' '}
                  <strong className="text-emerald-400 font-bold">
                    {hud.sectorGripPct[hud.currentSector - 1] ?? hud.surfaceGripPct}%
                  </strong>
                </span>
              </div>

              {/* FIA Race Control Track Limits, Penalty & Live Overtake Counter */}
              <div className="px-3.5 py-1 flex items-center justify-between text-[9px] font-mono-telemetry tabular-nums bg-black/95 text-slate-300 border-t border-white/10">
                <span className="flex items-center gap-1.5">
                  <span className="text-slate-400">LIMITS:</span>
                  <strong
                    className={`font-bold ${
                      (hud.trackLimitWarnings ?? 0) >= 3
                        ? 'text-red-400'
                        : (hud.trackLimitWarnings ?? 0) === 2
                          ? 'text-amber-300'
                          : 'text-slate-200'
                    }`}
                  >
                    {hud.trackLimitWarnings ?? 0}/3
                  </strong>
                  {(hud.timePenaltySec ?? 0) > 0 && (
                    <span className="px-1 rounded bg-red-600/85 text-white text-[8px] font-black">
                      +{hud.timePenaltySec}s PEN
                    </span>
                  )}
                </span>
                <span>
                  OVERTAKES:{' '}
                  <strong className="text-cyan-300 font-bold">{hud.overtakesCount ?? 0}</strong>
                </span>
              </div>
            </div>
            )}

            {/* Real-Time Track Log: Dynamic Grip Fluctuations & Weather Changes Line Chart */}
            {showTrackLog && (
              <TrackLog
                surfaceGripPct={hud.surfaceGripPct}
                trackWetnessPct={hud.trackWetnessPct}
                sectorGripPct={hud.sectorGripPct}
                liveWeather={hud.liveWeather}
                nextWeather={hud.nextWeather}
                activeSurfaceHazard={hud.activeSurfaceHazard}
                lap={hud.lap}
                totalLaps={hud.totalLaps}
              />
            )}
          </div>

          {/* F1 25 Cockpit Switchgear Utility Buttons (Compact 2x3 grid on <md, vertical stack on md+) */}
          <div className="pointer-events-auto grid grid-cols-2 md:flex md:flex-col gap-1 md:gap-1.5">
            <button
              type="button"
              onClick={onPause}
              title="Pause / Settings (Esc)"
              className="w-10 h-9 rounded-xl border border-white/20 f1-cockpit-switch flex flex-col items-center justify-center text-slate-200 hover:text-white hover:border-red-500 hover:shadow-[0_0_14px_rgba(239,68,68,0.55)] cursor-pointer group"
            >
              <Pause className="w-3.5 h-3.5 text-red-400 group-hover:scale-110 transition-transform" />
              <span className="text-[6px] font-mono-telemetry font-bold text-slate-400 tracking-tighter">ESC</span>
            </button>
            <button
              type="button"
              onClick={onCycleCamera}
              title={`Cycle Camera (C) — ${CAMERA_LABELS[hud.cameraMode]}`}
              className="w-10 h-9 rounded-xl border border-white/20 f1-cockpit-switch flex flex-col items-center justify-center text-slate-200 hover:text-white hover:border-cyan-400 hover:shadow-[0_0_14px_rgba(6,182,212,0.55)] cursor-pointer group"
            >
              <Camera className="w-3 h-3 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="text-[6px] font-mono-telemetry font-bold text-cyan-300 tracking-tighter">
                {CAMERA_LABELS[hud.cameraMode].slice(0, 3)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowTrackLog((v) => !v)}
              title="Toggle Track Log Grip & Weather Chart"
              className={`w-10 h-9 rounded-xl border f1-cockpit-switch flex flex-col items-center justify-center cursor-pointer transition-all group ${
                showTrackLog
                  ? 'border-emerald-400 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.6)]'
                  : 'border-white/20 text-slate-300 hover:text-white hover:border-emerald-400/70 hover:shadow-[0_0_12px_rgba(16,185,129,0.4)]'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="text-[6px] font-mono-telemetry font-bold text-emerald-300 tracking-tighter">LOG</span>
            </button>
            <button
              type="button"
              onClick={() => setShowMirrorLocal((m) => !m)}
              title="Toggle Virtual Rear-View Mirror"
              className={`w-10 h-9 rounded-xl border f1-cockpit-switch flex flex-col items-center justify-center cursor-pointer transition-all group ${
                virtualMirror && showMirrorLocal
                  ? 'border-fuchsia-400 text-fuchsia-300 shadow-[0_0_16px_rgba(217,70,239,0.6)]'
                  : 'border-white/20 text-slate-300 hover:text-white hover:border-fuchsia-400/70 hover:shadow-[0_0_12px_rgba(217,70,239,0.4)]'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-fuchsia-400 group-hover:scale-110 transition-transform" />
              <span className="text-[6px] font-mono-telemetry font-bold text-fuchsia-300 tracking-tighter">MIR</span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              title={muted ? 'Unmute Audio' : 'Mute Audio'}
              className="w-10 h-9 rounded-xl border border-white/20 f1-cockpit-switch flex flex-col items-center justify-center text-slate-200 hover:text-white hover:border-amber-400 hover:shadow-[0_0_14px_rgba(245,158,11,0.55)] cursor-pointer group"
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 text-red-400 group-hover:scale-110 transition-transform" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              )}
              <span className="text-[6px] font-mono-telemetry font-bold text-amber-300 tracking-tighter">VOL</span>
            </button>
            <button
              type="button"
              onClick={onToggleTouchControls}
              title="Toggle Touch Controls"
              className={`w-10 h-9 rounded-xl border f1-cockpit-switch flex flex-col items-center justify-center cursor-pointer transition-all group ${
                touchControls
                  ? 'border-orange-400 text-orange-300 shadow-[0_0_16px_rgba(249,115,22,0.6)]'
                  : 'border-white/20 text-slate-300 hover:text-white hover:border-orange-400/70 hover:shadow-[0_0_12px_rgba(249,115,22,0.4)]'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5 text-orange-400 group-hover:scale-110 transition-transform" />
              <span className="text-[6px] font-mono-telemetry font-bold text-orange-300 tracking-tighter">CTRL</span>
            </button>
            <button
              type="button"
              onClick={() => setShowHudOverlayPanel((v) => !v)}
              title="HUD Overlays, Scaling & Color Theme (H)"
              className={`w-10 h-9 rounded-xl border f1-cockpit-switch flex flex-col items-center justify-center cursor-pointer transition-all group ${
                showHudOverlayPanel
                  ? 'border-cyan-400 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.6)]'
                  : 'border-white/20 text-slate-300 hover:text-white hover:border-cyan-400/70 hover:shadow-[0_0_12px_rgba(34,211,238,0.4)]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-300 group-hover:scale-110 transition-transform" />
              <span className="text-[6px] font-mono-telemetry font-bold text-cyan-200 tracking-tighter">HUD</span>
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR: Left Mini-Map & Controls · Center F1 25 Halo Dual-Dial Telemetry Cluster · Right 4-Wheel Tire Status & Pit Controls */}
      <div
        className={`flex items-end justify-between gap-2 sm:gap-3 ${
          touchControls && mobileButtonLayout === 'left_handed' ? 'flex-row-reverse' : ''
        }`}
      >
        {/* BOTTOM-LEFT: Mini-Track Map + Touch Steering */}
        <div
          className={`flex items-end gap-2.5 origin-bottom-left ${
            isExiting ? 'animate-hud-exit-bl' : 'animate-hud-enter-bl [animation-delay:90ms]'
          }`}
          style={{ transform: `scale(${adaptiveHudScale})` }}
        >
          <div className="hidden sm:flex flex-col gap-2">
            {/* Hardcore Pro Race Strategy, Stint Plan & Fuel Calculus Card */}
            {hudWidgets.pitStrategy !== false && (
            <div
              className={`hud-themed-card pit-card-transition flex flex-col gap-1.5 p-2.5 rounded-xl border shadow-2xl min-w-[232px] max-w-[264px] text-white ${
                pitWindowOpen
                  ? 'border-emerald-400/60 bg-slate-950/94 shadow-[0_0_22px_rgba(16,185,129,0.22)]'
                  : pitWindowTransition === 'closing'
                    ? 'border-amber-400/50 bg-slate-950/92'
                    : 'border-white/15 bg-slate-950/92'
              } ${
                pitWindowTransition === 'opening'
                  ? 'pit-window-open-anim'
                  : pitWindowTransition === 'closing'
                    ? 'pit-window-close-anim'
                    : ''
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-1">
                <div className="flex items-center gap-1.5">
                  {/* Live Pit Strategy Glowing Status Beacon */}
                  <span className="relative flex h-2 w-2 items-center justify-center" aria-hidden="true">
                    {pitWindowOpen && (
                      <span className="pit-beacon-halo absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    )}
                    <span
                      className={`relative inline-flex h-2 w-2 rounded-full transition-colors duration-500 ${
                        pitWindowOpen
                          ? 'bg-emerald-400 shadow-[0_0_10px_#34D399]'
                          : pitWindowTransition === 'closing'
                            ? 'bg-amber-400 shadow-[0_0_8px_#FBBF24]'
                            : 'bg-slate-500'
                      }`}
                    />
                  </span>
                  <span
                    className={`text-[10px] font-display font-black tracking-wider transition-colors duration-300 ${
                      pitWindowOpen ? 'text-emerald-300' : 'text-amber-400'
                    }`}
                  >
                    PIT STRATEGY
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border font-display font-bold text-[8px] transition-all duration-400 ${
                      pitWindowOpen
                        ? 'pit-window-glow-pulse bg-emerald-500/20 border-emerald-400/60 text-emerald-200 opacity-100 scale-100'
                        : pitWindowTransition === 'closing'
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 opacity-100 scale-95'
                          : 'bg-white/5 border-white/10 text-slate-400 opacity-85 scale-95'
                    }`}
                  >
                    {pitWindowOpen
                      ? 'WINDOW OPEN'
                      : pitWindowTransition === 'closing'
                        ? 'WINDOW CLOSED'
                        : 'STANDBY'}
                  </span>
                </div>
                <span className="text-[9px] font-mono-telemetry text-slate-400 tabular-nums">
                  L{hud.lap}/{hud.totalLaps} · W:L{hud.pitStrategy?.pitWindowStartLap ?? 1}-L{hud.pitStrategy?.pitWindowEndLap ?? 2}
                </span>
              </div>

              {/* Live Stint & Pit Stop Plan Timeline */}
              {(() => {
                const totalL = Math.max(1, hud.totalLaps);
                const stops = [...(hud.pitStrategy?.plannedStops ?? [])].sort(
                  (a, b) => a.pitLap - b.pitLap
                );
                const startCmp = hud.pitStrategy?.startingCompound ?? hud.tyreCompound;
                const stints: Array<{
                  key: string;
                  startLap: number;
                  endLap: number;
                  compound: typeof hud.tyreCompound;
                  completed: boolean;
                }> = [];
                let curStart = 1;
                let curCmp = startCmp;
                for (const st of stops) {
                  stints.push({
                    key: `st_${st.id}`,
                    startLap: curStart,
                    endLap: st.pitLap,
                    compound: curCmp,
                    completed: st.completed,
                  });
                  curStart = st.pitLap + 1;
                  curCmp = st.compound;
                }
                if (curStart <= totalL) {
                  stints.push({
                    key: 'st_final',
                    startLap: curStart,
                    endLap: totalL,
                    compound: curCmp,
                    completed: false,
                  });
                }
                const cmpColor = (c: typeof hud.tyreCompound) =>
                  c === 'soft'
                    ? '#EF4444'
                    : c === 'medium'
                      ? '#FACC15'
                      : c === 'hard'
                        ? '#F8FAFC'
                        : '#38BDF8';
                const lapMarkerPct = Math.min(100, Math.max(2, ((hud.lap - 0.5) / totalL) * 100));

                return (
                  <div className="flex flex-col gap-1">
                    <div className="relative flex items-center gap-0.5 h-3.5 rounded bg-black/50 p-0.5 border border-white/10">
                      {stints.map((s) => {
                        const span = Math.max(1, s.endLap - s.startLap + 1);
                        const wPct = (span / totalL) * 100;
                        const darkText = s.compound === 'hard' || s.compound === 'medium';
                        return (
                          <div
                            key={s.key}
                            style={{
                              width: `${wPct}%`,
                              backgroundColor: cmpColor(s.compound),
                              color: darkText ? '#090B0F' : '#FFFFFF',
                              opacity: s.completed ? 0.5 : 0.92,
                            }}
                            className="h-full rounded-[2px] flex items-center justify-center text-[7px] font-display font-black leading-none overflow-hidden"
                          >
                            {s.compound.slice(0, 1).toUpperCase()}
                            {span > 1 ? ` L${s.startLap}-${s.endLap}` : ''}
                          </div>
                        );
                      })}
                      {/* Live Current Lap Progress Pin */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_#ffffff]"
                        style={{ left: `${lapMarkerPct}%` }}
                        title={`Current Lap ${hud.lap}`}
                      />
                    </div>

                    {/* Next Scheduled Stop Row */}
                    {hud.pitStrategy?.nextPlannedStop ? (
                      <div
                        className={`px-1.5 py-0.5 rounded border flex items-center justify-between text-[8px] font-mono-telemetry ${
                          hud.lap >= hud.pitStrategy.nextPlannedStop.pitLap
                            ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 font-bold'
                            : 'bg-white/[0.04] border-white/10 text-slate-200'
                        }`}
                      >
                        <span>
                          {hud.lap >= hud.pitStrategy.nextPlannedStop.pitLap
                            ? 'BOX NOW'
                            : `NEXT PIT: L${hud.pitStrategy.nextPlannedStop.pitLap}`}
                        </span>
                        <span>
                          {hud.pitStrategy.nextPlannedStop.compound.toUpperCase()} ·{' '}
                          {hud.pitStrategy.nextPlannedStop.fuelLoadPct}% FUEL
                        </span>
                      </div>
                    ) : stops.length > 0 ? (
                      <div className="flex items-center justify-between text-[8px] font-mono-telemetry text-emerald-300">
                        <span>ALL PLANNED STOPS DONE</span>
                        <span>TO FINISH</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[8px] font-mono-telemetry text-slate-300">
                        <span>PLAN: 0-STOP SPRINT</span>
                        <span>START {startCmp.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Live Fuel Load & Range Bar */}
              <div className="flex flex-col gap-0.5 pt-0.5">
                <div className="flex items-center justify-between text-[8px] font-mono-telemetry tabular-nums">
                  <span className="text-slate-400">FUEL LOAD</span>
                  <span
                    className={`font-bold ${
                      hud.fuelPct < 20
                        ? 'text-red-400'
                        : hud.fuelPct < 40
                          ? 'text-amber-300'
                          : 'text-cyan-300'
                    }`}
                  >
                    {hud.fuelPct}% · ~{hud.pitStrategy?.estimatedFuelLapsRemaining ?? Math.max(0.5, Number((hud.fuelPct / 16).toFixed(1)))} LAPS
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      hud.fuelPct < 20 ? 'bg-red-500' : hud.fuelPct < 40 ? 'bg-amber-400' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, hud.fuelPct))}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] pt-0.5">
                <span className="text-slate-400 font-sans">TARGET TYRE:</span>
                <span className="font-display font-bold text-white flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{
                      backgroundColor:
                        hud.pitStrategy?.recommendedCompound === 'soft'
                          ? '#EF4444'
                          : hud.pitStrategy?.recommendedCompound === 'medium'
                            ? '#FACC15'
                            : hud.pitStrategy?.recommendedCompound === 'hard'
                              ? '#FFFFFF'
                              : '#38BDF8',
                    }}
                  />
                  {hud.pitStrategy?.recommendedCompound?.toUpperCase() ?? 'MEDIUM'}
                </span>
              </div>

              {hud.pitStrategy?.undercutViable && (
                <div className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-between text-[8px] text-emerald-300 font-mono-telemetry font-bold">
                  <span>UNDERCUT VIABLE:</span>
                  <span>-{hud.pitStrategy.undercutDeltaSec}s GAIN</span>
                </div>
              )}

              <div className="flex items-center justify-between text-[8px] font-mono-telemetry text-slate-300 pt-0.5">
                <span>PIT LOSS: ~{hud.pitStrategy?.estimatedPitLossSec ?? 20.5}s</span>
                <span>EXIT: P{hud.pitStrategy?.predictedExitPosition ?? 4}</span>
              </div>

              <div className="flex items-center justify-between text-[8px] font-mono-telemetry border-t border-white/10 pt-1">
                <span className="text-slate-400">TYRE STAGE:</span>
                <span
                  className={`font-bold uppercase ${
                    hud.pitStrategy?.tyreDegradationStage === 'cliff'
                      ? 'text-red-400'
                      : hud.pitStrategy?.tyreDegradationStage === 'degrading'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                  }`}
                >
                  {hud.pitStrategy?.tyreDegradationStage ?? 'OPTIMAL'}
                </span>
              </div>

              {hud.weatherTyreImpact && (
                <div className="flex flex-col gap-1 border-t border-white/10 pt-1 text-[8px] font-mono-telemetry tabular-nums">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">
                      WX IMPACT ({hud.weatherTyreImpact.trackTemperatureC.toFixed(0)}°C
                      {hud.weatherTyreImpact.trackTempTrend === 'heating'
                        ? '↑'
                        : hud.weatherTyreImpact.trackTempTrend === 'cooling'
                          ? '↓'
                          : ''}
                      )
                    </span>
                    <span className="flex items-center gap-1.5 font-bold">
                      <span
                        className={
                          hud.weatherTyreImpact.gripMultiplier < 0.85
                            ? 'text-red-400'
                            : hud.weatherTyreImpact.gripMultiplier < 0.96
                              ? 'text-amber-300'
                              : 'text-emerald-300'
                        }
                      >
                        GRIP {Math.round(hud.weatherTyreImpact.gripMultiplier * 100)}%
                      </span>
                      <span className="text-slate-500">·</span>
                      <span
                        className={
                          hud.weatherTyreImpact.wearMultiplier > 1.25
                            ? 'text-red-400'
                            : hud.weatherTyreImpact.wearMultiplier > 1.08
                              ? 'text-amber-300'
                              : 'text-cyan-300'
                        }
                      >
                        DEG {hud.weatherTyreImpact.wearMultiplier.toFixed(2)}x
                      </span>
                    </span>
                  </div>
                  {hud.weatherTyreImpact.strategyRecommendation && (
                    <div
                      className={`px-1.5 py-0.5 rounded border text-[7.5px] font-sans font-semibold leading-tight ${
                        hud.weatherTyreImpact.crossoverUrgent
                          ? 'bg-amber-500/20 border-amber-400/55 text-amber-200'
                          : 'bg-sky-500/12 border-sky-400/35 text-sky-200'
                      }`}
                    >
                      {hud.weatherTyreImpact.strategyRecommendation}
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Pit Box Call [B] & Live Pit Crew Service Progress */}
              {hud.pitStopRemainingSec > 0 ? (
                <div className="flex flex-col gap-1 border-t border-white/10 pt-1 text-[8px] font-mono-telemetry tabular-nums">
                  <div className="flex items-center justify-between text-amber-300 font-bold">
                    <span>PIT CREW SERVICE</span>
                    <span>{hud.pitStopRemainingSec.toFixed(1)}s</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-75"
                      style={{
                        width: `${Math.min(100, Math.max(8, ((2.4 - hud.pitStopRemainingSec) / 2.4) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onRequestTyreSwitch(
                      hud.weatherTyreImpact?.optimalCompound ??
                        hud.pitStrategy?.recommendedCompound ??
                        hud.tyreCompound
                    )
                  }
                  className={`pointer-events-auto w-full mt-0.5 px-2 py-1 rounded border text-[8.5px] font-display font-bold tracking-wider uppercase flex items-center justify-between transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    hud.queuedCompound
                      ? 'bg-amber-500/20 border-amber-400/65 text-amber-200 hover:bg-amber-500/30'
                      : hud.inPitWindow
                        ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-200 hover:bg-emerald-500/30'
                        : 'bg-white/[0.06] border-white/20 text-slate-100 hover:bg-white/15 hover:border-white/35'
                  }`}
                >
                  <span>
                    {hud.queuedCompound
                      ? `BOX QUEUED · ${hud.queuedCompound.toUpperCase()}`
                      : hud.inPitWindow
                        ? `BOX WINDOW · ${(
                            hud.weatherTyreImpact?.optimalCompound ??
                            hud.pitStrategy?.recommendedCompound ??
                            hud.tyreCompound
                          ).toUpperCase()}`
                        : `BOX THIS LAP (${(
                            hud.weatherTyreImpact?.optimalCompound ??
                            hud.pitStrategy?.recommendedCompound ??
                            hud.tyreCompound
                          ).toUpperCase()})`}
                  </span>
                  <span className="px-1 py-0.2 rounded bg-black/60 border border-white/15 font-mono-telemetry text-[7.5px]">
                    B
                  </span>
                </button>
              )}
            </div>
            )}

            <div className="flex flex-col gap-2.5">
              {hudWidgets.miniMap !== false && (
                <MiniMap
                  trackName={trackName}
                  miniMapPath={hud.miniMapPath}
                  miniMapStart={hud.miniMapStart}
                  blips={hud.miniMapBlips}
                  hazards={hud.miniMapHazards}
                  drsZones={hud.miniMapDrsZones}
                  trackFlag={hud.trackFlag}
                  currentSector={hud.currentSector}
                  sectorGripPct={hud.sectorGripPct}
                  miniMapSectorPaths={hud.miniMapSectorPaths}
                  miniMapRacingLinePaths={hud.miniMapRacingLinePaths}
                />
              )}
              {hudWidgets.gForceRadar !== false && (
                <GForceRadarWidget
                  gForceLat={hud.gForceLat}
                  gForceLong={hud.gForceLong}
                  gForceTotal={hud.gForceTotal}
                />
              )}
            </div>
          </div>

          {touchControls && (
            <div
              className={`pointer-events-auto flex flex-col ${mobileSpacingGapClass} touch-none select-none ${
                mobileButtonLayout === 'left_handed' ? 'origin-bottom-right items-end' : 'origin-bottom-left'
              }`}
              style={{ transform: `scale(${mobileScaleFactor})`, opacity: mobileButtonOpacity }}
            >
              {/* Quick 1-Tap Mobile Play Style & Layout Switcher */}
              <div className="flex items-center gap-1 rounded-lg bg-black/85 border border-white/15 p-0.5 self-start">
                {(
                  [
                    ['virtual_joystick', 'STICK'],
                    ['thumb_slider', 'SLIDER'],
                    ['dual_pedals', 'TAP'],
                    ['tilt_gyro', 'TILT'],
                  ] as [MobileControlStyle, string][]
                ).map(([styleId, label]) => {
                  const isActive = mobileControlStyle === styleId;
                  return (
                    <button
                      key={styleId}
                      type="button"
                      onClick={() => onSelectMobileControlStyle?.(styleId)}
                      className={`px-1.5 sm:px-2 py-1 rounded text-[9px] font-display font-bold tracking-wider uppercase cursor-pointer whitespace-nowrap shrink-0 ${
                        isActive ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowMobileCustomizer((v) => !v)}
                  title="Customize Mobile Button Layout"
                  className={`px-1.5 py-1 rounded text-[9px] font-display font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                    showMobileCustomizer ? 'bg-sky-400 text-slate-950' : 'text-sky-300 hover:bg-white/10'
                  }`}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span className="hidden sm:inline">LAYOUT</span>
                </button>
              </div>

              {mobileControlStyle === 'virtual_joystick' && (
                <div
                  role="application"
                  aria-label="Responsive Virtual Racing Joystick"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setJoystickDragging(true);
                    joystickMaxLockHapticRef.current = false;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const geomCx = rect.left + rect.width * 0.5;
                    const geomCy = rect.top + rect.height * 0.5;
                    const maxR = rect.width * 0.42;
                    let cx = geomCx;
                    let cy = geomCy;
                    if (mobileFloatingJoystick) {
                      const pocketLimit = rect.width * 0.16;
                      const ox = Math.max(-pocketLimit, Math.min(pocketLimit, e.clientX - geomCx));
                      const oy = Math.max(-pocketLimit, Math.min(pocketLimit, e.clientY - geomCy));
                      cx = geomCx + ox;
                      cy = geomCy + oy;
                    }
                    joystickOriginRef.current = { x: cx, y: cy, maxR };
                    const rawX = (e.clientX - cx) / Math.max(1, maxR);
                    const rawY = (e.clientY - cy) / Math.max(1, maxR);
                    const mag = Math.hypot(rawX, rawY);
                    const nx = mag > 1 ? rawX / mag : rawX;
                    const ny = mag > 1 ? rawY / mag : rawY;
                    setJoystickVec({ x: nx, y: ny });
                    onTouchSteerAxis?.(shapeStickSteer(nx));
                    onTouchPedalAxis?.(
                      ny < -0.25 ? Math.min(1, (-ny - 0.25) / 0.75) : 0,
                      ny > 0.28 ? Math.min(1, (ny - 0.28) / 0.72) : 0
                    );
                    joystickCenterSignRef.current = Math.abs(nx) < 0.1 ? 0 : Math.sign(nx);
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons === 0 && e.pressure === 0 && !e.currentTarget.hasPointerCapture(e.pointerId)) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const origin = joystickOriginRef.current ?? {
                      x: rect.left + rect.width * 0.5,
                      y: rect.top + rect.height * 0.5,
                      maxR: rect.width * 0.42,
                    };
                    const rawX = (e.clientX - origin.x) / Math.max(1, origin.maxR);
                    const rawY = (e.clientY - origin.y) / Math.max(1, origin.maxR);
                    const mag = Math.hypot(rawX, rawY);
                    const nx = mag > 1 ? rawX / mag : rawX;
                    const ny = mag > 1 ? rawY / mag : rawY;
                    const sign = Math.abs(nx) < 0.08 ? 0 : Math.sign(nx);
                    if (joystickCenterSignRef.current !== 0 && sign !== 0 && sign !== joystickCenterSignRef.current) {
                      onTriggerMobileHaptic?.('shift_up', 0.45);
                    }
                    const atLock = Math.abs(nx) > 0.93;
                    if (atLock && !joystickMaxLockHapticRef.current) {
                      onTriggerMobileHaptic?.('accel', 0.35);
                    }
                    joystickMaxLockHapticRef.current = atLock;
                    joystickCenterSignRef.current = sign;
                    setJoystickVec({ x: nx, y: ny });
                    onTouchSteerAxis?.(shapeStickSteer(nx));
                    onTouchPedalAxis?.(
                      ny < -0.25 ? Math.min(1, (-ny - 0.25) / 0.75) : 0,
                      ny > 0.28 ? Math.min(1, (ny - 0.28) / 0.72) : 0
                    );
                  }}
                  onPointerUp={() => {
                    setJoystickDragging(false);
                    joystickOriginRef.current = null;
                    joystickMaxLockHapticRef.current = false;
                    setJoystickVec({ x: 0, y: 0 });
                    onTouchSteerAxis?.(0);
                    onTouchPedalAxis?.(0, 0);
                    joystickCenterSignRef.current = 0;
                  }}
                  onPointerCancel={() => {
                    setJoystickDragging(false);
                    joystickOriginRef.current = null;
                    joystickMaxLockHapticRef.current = false;
                    setJoystickVec({ x: 0, y: 0 });
                    onTouchSteerAxis?.(0);
                    onTouchPedalAxis?.(0, 0);
                    joystickCenterSignRef.current = 0;
                  }}
                  className={`relative w-30 h-30 sm:w-34 sm:h-34 rounded-full border-2 flex items-center justify-center cursor-pointer touch-none select-none shadow-2xl ${
                    joystickDragging
                      ? 'border-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.28)]'
                      : 'border-white/25'
                  }`}
                  style={{
                    background:
                      'radial-gradient(circle at 50% 50%, rgba(20, 26, 38, 0.94) 0%, rgba(8, 10, 16, 0.96) 100%)',
                  }}
                >
                  {/* Dynamic SVG Directional Grip Vector & F1 Steering Rim */}
                  <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full pointer-events-none">
                    <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
                    <path
                      d="M 32 18 A 48 48 0 0 1 88 18"
                      fill="none"
                      stroke={joystickVec.y < -0.25 ? '#10B981' : 'rgba(16,185,129,0.28)'}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 32 102 A 48 48 0 0 0 88 102"
                      fill="none"
                      stroke={joystickVec.y > 0.28 ? '#EF4444' : 'rgba(239,68,68,0.25)'}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    {(Math.abs(joystickVec.x) > 0.04 || Math.abs(joystickVec.y) > 0.04) && (
                      <line
                        x1="60"
                        y1="60"
                        x2={60 + joystickVec.x * 36}
                        y2={60 + joystickVec.y * 36}
                        stroke="rgba(251, 191, 36, 0.72)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    )}
                    <circle cx="60" cy="60" r="3" fill="rgba(255,255,255,0.35)" />
                  </svg>
                  <div className="absolute inset-x-4 top-1/2 h-px bg-white/10 pointer-events-none" />
                  <div className="absolute inset-y-4 left-1/2 w-px bg-white/10 pointer-events-none" />
                  <span className="absolute top-1.5 text-[7px] font-mono-telemetry text-emerald-400/90 font-bold pointer-events-none">
                    GAS
                  </span>
                  <span className="absolute bottom-1.5 text-[7px] font-mono-telemetry text-amber-300/90 font-bold pointer-events-none tabular-nums">
                    {Math.abs(joystickVec.x) > 0.05 ? `${Math.round(shapeStickSteer(joystickVec.x) * -22)}°` : 'BRK'}
                  </span>
                  <span className="absolute left-2 text-[8px] font-display text-slate-400 pointer-events-none">
                    ◀
                  </span>
                  <span className="absolute right-2 text-[8px] font-display text-slate-400 pointer-events-none">
                    ▶
                  </span>
                  {/* Zero-Lag Responsive Thumb Puck with Spring Release */}
                  <div
                    className={`w-11 h-11 rounded-full border-2 flex items-center justify-center pointer-events-none ${
                      joystickDragging
                        ? 'transition-none scale-105 border-amber-300 bg-amber-400/35 shadow-[0_0_20px_rgba(251,191,36,0.65)]'
                        : 'transition-transform duration-150 ease-out border-amber-400 bg-amber-400/25 shadow-[0_0_14px_rgba(251,191,36,0.4)]'
                    }`}
                    style={{
                      transform: `translate(${joystickVec.x * 36}px, ${joystickVec.y * 36}px)`,
                    }}
                  >
                    <div className="w-4 h-4 rounded-full bg-amber-300 shadow-inner" />
                  </div>
                </div>
              )}

              {mobileControlStyle === 'thumb_slider' && (
                <div
                  role="slider"
                  aria-label="Analog Touch Steering Slider"
                  aria-valuemin={-100}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(-sliderSteer * 100)}
                  tabIndex={0}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setSliderDragging(true);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const rel = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
                    const axis = Math.max(-1, Math.min(1, -rel));
                    setSliderSteer(axis);
                    onTouchSteerAxis?.(axis);
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons === 0 && e.pressure === 0 && !e.currentTarget.hasPointerCapture(e.pointerId)) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const rel = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
                    const axis = Math.max(-1, Math.min(1, -rel));
                    setSliderSteer(axis);
                    onTouchSteerAxis?.(axis);
                  }}
                  onPointerUp={() => {
                    setSliderDragging(false);
                    setSliderSteer(0);
                    onTouchSteerAxis?.(0);
                  }}
                  onPointerCancel={() => {
                    setSliderDragging(false);
                    setSliderSteer(0);
                    onTouchSteerAxis?.(0);
                  }}
                  className="relative w-36 sm:w-44 md:w-48 h-16 min-h-[64px] rounded-2xl border border-white/25 flex items-center justify-between px-3 cursor-pointer touch-none select-none overflow-hidden shadow-2xl"
                  style={{ backgroundColor: 'rgba(9, 12, 18, 0.90)' }}
                >
                  <span className="text-xs font-display font-bold text-slate-400">◀</span>
                  <div className="w-px h-6 bg-white/25" />
                  <span className="text-xs font-display font-bold text-slate-400">▶</span>
                  {/* Center Track & Sliding Steering Puck */}
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 rounded-xl border-2 border-amber-400 bg-amber-400/25 shadow-[0_0_14px_rgba(251,191,36,0.45)] flex items-center justify-center pointer-events-none ${
                      sliderDragging ? 'transition-none' : 'transition-all duration-150 ease-out'
                    }`}
                    style={{ left: `${50 - sliderSteer * 38}%` }}
                  >
                    <div className="w-1.5 h-5 rounded-full bg-amber-300" />
                  </div>
                </div>
              )}

              {mobileControlStyle === 'dual_pedals' && (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onPointerDown={() => {
                      onTouchInput('left', true);
                      onTriggerMobileHaptic?.('shift_up', 0.3);
                    }}
                    onPointerUp={() => onTouchInput('left', false)}
                    onPointerLeave={() => onTouchInput('left', false)}
                    onPointerCancel={() => onTouchInput('left', false)}
                    className="w-16 h-16 min-w-[56px] min-h-[56px] rounded-2xl border border-white/25 flex items-center justify-center font-display font-bold text-xl text-white active:bg-amber-500/35 active:border-amber-400 active:scale-95 transition-transform cursor-pointer touch-none select-none shadow-xl"
                    style={{ backgroundColor: 'rgba(9, 11, 15, 0.90)' }}
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => {
                      onTouchInput('right', true);
                      onTriggerMobileHaptic?.('shift_up', 0.3);
                    }}
                    onPointerUp={() => onTouchInput('right', false)}
                    onPointerLeave={() => onTouchInput('right', false)}
                    onPointerCancel={() => onTouchInput('right', false)}
                    className="w-16 h-16 min-w-[56px] min-h-[56px] rounded-2xl border border-white/25 flex items-center justify-center font-display font-bold text-xl text-white active:bg-amber-500/35 active:border-amber-400 active:scale-95 transition-transform cursor-pointer touch-none select-none shadow-xl"
                    style={{ backgroundColor: 'rgba(9, 11, 15, 0.90)' }}
                  >
                    ▶
                  </button>
                </div>
              )}

              {mobileControlStyle === 'tilt_gyro' && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-40 h-14 min-h-[56px] rounded-2xl border border-sky-400/45 px-3 py-1.5 flex flex-col justify-between shadow-xl"
                    style={{ backgroundColor: 'rgba(9, 13, 20, 0.90)' }}
                  >
                    <div className="flex items-center justify-between text-[9px] font-mono-telemetry text-sky-300 font-bold gap-1">
                      <span>GYRO STEER</span>
                      <div className="flex items-center gap-1.5">
                        <span className="tabular-nums">{Math.round(-gyroAxis * 100)}%</span>
                        <button
                          type="button"
                          onClick={calibrateGyroCenter}
                          className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/50 text-[8px] font-display font-bold text-sky-200 cursor-pointer hover:bg-sky-500/35 whitespace-nowrap shrink-0"
                          title="Recenter current tilt angle as 0°"
                        >
                          ZERO
                        </button>
                      </div>
                    </div>
                    <div className="relative w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="absolute top-0 bottom-0 w-4 -translate-x-1/2 rounded-full bg-sky-400 transition-all duration-75"
                        style={{ left: `${50 - gyroAxis * 45}%` }}
                      />
                    </div>
                    {gyroPermissionNeeded && (
                      <button
                        type="button"
                        onClick={requestIosGyro}
                        className="text-[9px] font-display font-bold text-amber-300 underline text-left cursor-pointer"
                      >
                        Tap to enable iOS Gyro
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM-CENTER: Authentic F1 25 Halo / Steering-Wheel Dual-Dial Telemetry Cluster + F1 Mobile Capsule */}
        {haloCenterHud && hudWidgets.haloCluster !== false && (
          <>
            {touchControls && (
              <div
                className={`sm:hidden hud-themed-card pointer-events-auto absolute bottom-24 left-1/2 -translate-x-1/2 rounded-2xl border ${hudThemeMeta.accentBorder} px-2.5 py-1.5 flex flex-col items-center gap-1 shadow-2xl tabular-nums max-w-[92vw] backdrop-blur-md`}
                style={{ backgroundColor: hudThemeMeta.panelBg }}
              >
                {/* 12-LED F1 Mobile Shift Light Array */}
                <div className="flex items-center gap-0.5 w-full justify-center">
                  {Array.from({ length: 12 }).map((_, ledIdx) => {
                    const thresh = (ledIdx + 1) / 12;
                    const rpmRatio = Math.min(1, Math.max(0, (hud.rpm - 4500) / 8500));
                    const activeLed = rpmRatio >= thresh;
                    const color =
                      ledIdx < 4
                        ? '#10B981'
                        : ledIdx < 8
                          ? '#F59E0B'
                          : ledIdx < 10
                            ? '#EF4444'
                            : '#E879F9';
                    return (
                      <span
                        key={ledIdx}
                        className="h-1 flex-1 rounded-full transition-colors"
                        style={{
                          backgroundColor: activeLed ? color : 'rgba(255,255,255,0.12)',
                          boxShadow: activeLed ? `0 0 6px ${color}` : 'none',
                        }}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display font-black italic text-lg text-white leading-none">
                      {gearLabel}
                    </span>
                    <span className="text-[7px] font-mono-telemetry text-slate-400">GR</span>
                  </div>
                  <div className="w-px h-3.5 bg-white/15" />
                  <div className="flex items-baseline gap-1">
                    <span className="font-display font-black text-base text-white leading-none">
                      {displayedSpeed}
                    </span>
                    <span className="text-[7px] font-mono-telemetry text-slate-400">{speedUnitLabel}</span>
                  </div>
                  <div className="w-px h-3.5 bg-white/15" />
                  <button
                    type="button"
                    onClick={cycleAeroMode}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-mono-telemetry font-bold leading-none cursor-pointer border ${
                      hud.activeAeroMode === 'x_mode' || hud.drsActive
                        ? 'bg-lime-400/25 text-lime-300 border-lime-400/60'
                        : 'bg-sky-400/20 text-sky-300 border-sky-400/50'
                    }`}
                    title="Tap to toggle Active Aero X/Z Mode"
                  >
                    {hud.activeAeroMode === 'x_mode' || hud.drsActive ? 'X-AERO' : 'Z-AERO'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const order: ErsDeploymentMode[] = ['balanced', 'overtake', 'harvest'];
                      const cur = (hud.ersMode ?? 'balanced') as ErsDeploymentMode;
                      const next = order[(order.indexOf(cur) + 1) % order.length];
                      onSetErsMode?.(next);
                      onTriggerMobileHaptic?.('aero_z', 0.45);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono-telemetry font-bold leading-none cursor-pointer border ${
                      hud.ersMode === 'overtake' || hud.manualOverrideActive
                        ? 'bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-200'
                        : hud.ersMode === 'harvest'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                          : 'bg-lime-500/15 border-lime-400/40 text-lime-300'
                    }`}
                    title="Tap to cycle ERS Boost Mode"
                  >
                    {Math.round(hud.ersCharge)}%
                  </button>
                  <div className="w-px h-3.5 bg-white/15" />
                  {/* Compact 4-Corner Mini Tyre Status Dots */}
                  <div className="grid grid-cols-2 gap-0.5" title="4-Corner Tyre Wear">
                    {[flWear, frWear, rlWear, rrWear].map((w, idx) => (
                      <span
                        key={idx}
                        className="w-1.5 h-1.5 rounded-[1px]"
                        style={{ backgroundColor: tyreColorForWear(w) }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div
              className={`${touchControls ? 'hidden sm:flex' : 'flex'} flex-col items-center origin-bottom ${
                isExiting ? 'animate-hud-exit-br' : 'animate-hud-enter-br [animation-delay:100ms]'
              }`}
              style={{ transform: `scale(${adaptiveHudScale})` }}
            >
              <div
                className={`hud-themed-card rounded-3xl border ${hudThemeMeta.accentBorder} px-3 sm:px-3.5 py-2 flex items-center gap-2.5 sm:gap-3 shadow-2xl`}
                style={{
                  background:
                    'radial-gradient(circle at 50% 0%, rgba(28, 34, 48, 0.95) 0%, rgba(8, 10, 15, 0.96) 100%)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
                }}
              >
                {/* LEFT DIAL: BATT % with Glowing Yellow/Lime Ring */}
                <div className={`relative w-20 h-20 sm:w-22 sm:h-22 items-center justify-center ${touchControls ? 'hidden md:flex' : 'flex'}`}>
                <svg viewBox="0 0 96 96" className="w-full h-full">
                  <circle
                    cx="48"
                    cy="48"
                    r={arcRadius}
                    fill="rgba(10, 14, 20, 0.9)"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r={arcRadius}
                    fill="none"
                    stroke={hud.ersCharge < 20 ? '#FACC15' : '#84CC16'}
                    strokeWidth="6"
                    strokeDasharray={`${filledBattLength} ${arcCircumference}`}
                    strokeLinecap="round"
                    transform="rotate(150 48 48)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span className="text-[9px] font-mono-telemetry font-bold text-slate-300 tracking-wider">
                    BATT
                  </span>
                  <span className="font-display font-black text-lg sm:text-xl text-white tabular-nums mt-0.5">
                    {Math.round(hud.ersCharge)}%
                  </span>
                </div>
              </div>

              {/* CENTER MODULE: 15-LED RPM Array + Giant Gear Number + HARVESTING / OVERTAKE ERS MODE + [SPACE] OVERTAKE */}
              <div className="flex flex-col items-center justify-between min-w-[118px] sm:min-w-[136px]">
                {/* 15-LED F1 Shift Light Strip with 3-Bank Recessed Bezel & Optical Bloom */}
                <div className="flex items-center gap-1 mb-1 p-1 rounded-md bg-black/80 border border-white/15 shadow-inner">
                  {/* Bank 1: 5 Green LEDs */}
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const threshold = (i + 1) / 15;
                      const lit = rpmRatio >= threshold * 0.95;
                      const color = '#22C55E';
                      return (
                        <span
                          key={`g-${i}`}
                          className="w-2 sm:w-2.5 h-3.5 rounded-[2px] border border-black/60 transition-all duration-75"
                          style={{
                            backgroundColor: lit ? color : 'rgba(255,255,255,0.08)',
                            boxShadow: lit ? `0 0 10px ${color}, inset 0 1px 1px #fff` : 'inset 0 1px 2px rgba(0,0,0,0.8)',
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Partition Notch */}
                  <div className="w-px h-3 bg-white/20" />

                  {/* Bank 2: 5 Red LEDs */}
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const threshold = (i + 6) / 15;
                      const lit = rpmRatio >= threshold * 0.95;
                      const color = '#EF4444';
                      return (
                        <span
                          key={`r-${i}`}
                          className="w-2 sm:w-2.5 h-3.5 rounded-[2px] border border-black/60 transition-all duration-75"
                          style={{
                            backgroundColor: lit ? color : 'rgba(255,255,255,0.08)',
                            boxShadow: lit ? `0 0 10px ${color}, inset 0 1px 1px #fff` : 'inset 0 1px 2px rgba(0,0,0,0.8)',
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Partition Notch */}
                  <div className="w-px h-3 bg-white/20" />

                  {/* Bank 3: 5 Electric Violet LEDs */}
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const threshold = (i + 11) / 15;
                      const lit = rpmRatio >= threshold * 0.95;
                      const color = '#A855F7';
                      return (
                        <span
                          key={`v-${i}`}
                          className="w-2 sm:w-2.5 h-3.5 rounded-[2px] border border-black/60 transition-all duration-75"
                          style={{
                            backgroundColor: lit ? color : 'rgba(255,255,255,0.08)',
                            boxShadow: lit ? `0 0 10px ${color}, inset 0 1px 1px #fff` : 'inset 0 1px 2px rgba(0,0,0,0.8)',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Central Gear Readout - Authentic F1 Digital Phosphor Display */}
                <div
                  className={`font-display font-black italic text-5xl sm:text-6xl leading-none tabular-nums tracking-tight transition-colors duration-100 ${
                    gearLabel === 'N'
                      ? 'text-amber-400 drop-shadow-[0_0_16px_rgba(251,191,36,0.85)]'
                      : gearLabel === 'R'
                        ? 'text-rose-500 drop-shadow-[0_0_16px_rgba(244,63,94,0.85)]'
                        : rpmRatio >= 0.92
                          ? 'text-fuchsia-300 drop-shadow-[0_0_18px_rgba(217,70,239,0.95)]'
                          : 'text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.65)]'
                  }`}
                >
                  {gearLabel}
                </div>

                {/* 2026 ACTIVE AERO (X/Z-MODE) Dual-Flap Schematic + MGU-K Status */}
                {(() => {
                  const isXMode = hud.activeAeroMode === 'x_mode' || hud.drsActive;
                  const wingColor = hud.manualOverrideActive
                    ? '#E879F9'
                    : isXMode
                      ? '#84CC16'
                      : '#38BDF8';
                  return (
                    <div className="mt-1 flex flex-col items-center gap-0.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <svg
                          width="56"
                          height="20"
                          viewBox="0 0 56 20"
                          className="shrink-0"
                          aria-label={isXMode ? 'X-Mode Dual-Flap Low Drag' : 'Z-Mode Dual-Flap High Downforce'}
                        >
                          {/* Subtle F1 Chassis Spine */}
                          <line x1="12" y1="14" x2="42" y2="14" stroke="rgba(255,255,255,0.22)" strokeWidth="1.8" strokeLinecap="round" />
                          {/* Front Dual-Flap Assembly */}
                          <line x1="3" y1="14" x2="14" y2="14" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" />
                          <line
                            x1="4"
                            y1="11.5"
                            x2="15"
                            y2={isXMode ? '11.5' : '6.5'}
                            stroke={wingColor}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          />
                          {/* Rear Dual-Flap Assembly */}
                          <line x1="40" y1="13.5" x2="52" y2="13.5" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" />
                          <line
                            x1="40"
                            y1="10.5"
                            x2="53"
                            y2={isXMode ? '10.5' : '4'}
                            stroke={wingColor}
                            strokeWidth="2.4"
                            strokeLinecap="round"
                          />
                          {/* Flow Streamline (X-Mode) vs Downforce Load Arrows (Z-Mode) */}
                          {isXMode ? (
                            <>
                              <line x1="17" y1="7" x2="36" y2="7" stroke="#84CC16" strokeWidth="1.1" strokeDasharray="3 2" />
                              <line x1="19" y1="10.5" x2="38" y2="10.5" stroke="#84CC16" strokeWidth="1.1" strokeDasharray="3 2" />
                            </>
                          ) : (
                            <>
                              <path d="M9 2 L9 5 M7.5 3.8 L9 5.2 L10.5 3.8" stroke="#38BDF8" strokeWidth="1.1" fill="none" strokeLinecap="round" />
                              <path d="M47 1 L47 4.5 M45.5 3 L47 4.6 L48.5 3" stroke="#38BDF8" strokeWidth="1.1" fill="none" strokeLinecap="round" />
                            </>
                          )}
                        </svg>
                        <div className="flex flex-col leading-none">
                          <span
                            className={`text-[8.5px] font-mono-telemetry font-bold tracking-wider uppercase whitespace-nowrap ${
                              hud.manualOverrideActive
                                ? 'text-fuchsia-300'
                                : isXMode
                                  ? 'text-lime-400'
                                  : 'text-sky-300'
                            }`}
                          >
                            {isXMode ? 'X-MODE · DRAG -26%' : 'Z-MODE · DF +4%'}
                          </span>
                          <span
                            className={`text-[8px] font-mono-telemetry font-semibold tracking-wider uppercase whitespace-nowrap mt-0.5 ${
                              hud.manualOverrideActive
                                ? 'text-fuchsia-200'
                                : (hud.slipstreamPct ?? 0) >= 12
                                  ? 'text-cyan-300'
                                  : (hud.dirtyAirPct ?? 0) >= 18
                                    ? 'text-amber-300'
                                    : 'text-slate-300'
                            }`}
                          >
                            {hud.manualOverrideActive
                              ? `MOM OVERRIDE · ${hud.mgukPowerKw ?? 350}KW`
                              : (hud.slipstreamPct ?? 0) >= 12
                                ? `SLIPSTREAM +${hud.slipstreamPct}% · ${hud.mgukPowerKw ?? 0}KW`
                                : (hud.dirtyAirPct ?? 0) >= 18
                                  ? `WAKE ${hud.dirtyAirPct}% · ${hud.mgukPowerKw ?? 0}KW`
                                  : `MGU-K · ${hud.mgukPowerKw ?? 0}KW`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* [L1 / SPACE] 2026 ACTIVE AERO X-MODE & MOM OVERRIDE Swipe/Tap Pill */}
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    haloAeroSwipeYRef.current = { pointerId: e.pointerId, y: e.clientY, acted: false };
                  }}
                  onPointerMove={(e) => {
                    const st = haloAeroSwipeYRef.current;
                    if (!st || st.pointerId !== e.pointerId || st.acted) return;
                    const dy = e.clientY - st.y;
                    if (dy < -20) {
                      st.acted = true;
                      applyAeroModeToggle('x_mode');
                    } else if (dy > 20) {
                      st.acted = true;
                      applyAeroModeToggle('z_mode');
                    }
                  }}
                  onPointerUp={() => {
                    const st = haloAeroSwipeYRef.current;
                    if (st && !st.acted && touchControls) {
                      cycleAeroMode();
                    }
                    haloAeroSwipeYRef.current = null;
                  }}
                  onPointerCancel={() => {
                    haloAeroSwipeYRef.current = null;
                  }}
                  className={`pointer-events-auto mt-1 px-2 py-0.5 rounded border flex items-center gap-1.5 transition-colors cursor-pointer touch-none select-none ${
                    hud.manualOverrideActive
                      ? 'bg-fuchsia-950/90 border-fuchsia-400/80'
                      : hud.drsActive
                        ? 'bg-emerald-950/90 border-emerald-400/80'
                        : hud.manualOverrideAvailable || hud.drsAvailable
                          ? 'bg-emerald-950/60 border-emerald-400/50'
                          : (hud.slipstreamPct ?? 0) >= 12
                            ? 'bg-cyan-950/75 border-cyan-400/60'
                            : 'bg-black/80 border-white/25'
                  }`}
                  title="L1/Space or Swipe ↑ X-Mode / ↓ Z-Mode"
                >
                  <span
                    className={`px-1 py-0.2 rounded font-display font-black text-[8px] ${
                      hud.manualOverrideActive
                        ? 'bg-fuchsia-400 text-slate-950'
                        : hud.drsActive
                          ? 'bg-emerald-400 text-slate-950'
                          : (hud.slipstreamPct ?? 0) >= 12
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-white text-slate-950'
                    }`}
                  >
                    {touchControls ? '↑X · ↓Z' : 'L1 / SPACE'}
                  </span>
                  <span
                    className={`font-display font-bold text-[9px] tracking-wider ${
                      hud.manualOverrideActive
                        ? 'text-fuchsia-200'
                        : hud.drsActive
                          ? 'text-emerald-300'
                          : hud.manualOverrideAvailable || hud.drsAvailable
                            ? 'text-emerald-200'
                            : (hud.slipstreamPct ?? 0) >= 12
                              ? 'text-cyan-200'
                              : 'text-white'
                    }`}
                  >
                    {hud.manualOverrideActive
                      ? 'MOM + X-MODE'
                      : hud.drsActive
                        ? 'X-MODE OPEN'
                        : hud.manualOverrideAvailable
                          ? 'MOM READY'
                          : hud.drsAvailable
                            ? 'X-MODE READY'
                            : (hud.slipstreamPct ?? 0) >= 12
                              ? 'AERO DRAFTING'
                              : 'Z-MODE ACTIVE'}
                  </span>
                </button>
              </div>

              {/* RIGHT DIAL: Speed (KPH/MPH) + RPM Readout */}
              <div className={`relative w-20 h-20 sm:w-22 sm:h-22 items-center justify-center ${touchControls ? 'hidden md:flex' : 'flex'}`}>
                <svg viewBox="0 0 96 96" className="w-full h-full">
                  <circle
                    cx="48"
                    cy="48"
                    r={arcRadius}
                    fill="rgba(10, 14, 20, 0.9)"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r={arcRadius}
                    fill="none"
                    stroke={rpmRatio > 0.88 ? '#EF4444' : '#22C55E'}
                    strokeWidth="6"
                    strokeDasharray={`${filledRpmLength} ${arcCircumference}`}
                    strokeLinecap="round"
                    transform="rotate(150 48 48)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span className="text-[8px] font-mono-telemetry font-bold text-slate-400">
                    {speedUnitLabel}
                  </span>
                  <span className="font-display font-black text-xl sm:text-2xl text-white tabular-nums">
                    {displayedSpeed}
                  </span>
                  <span className="text-[7px] font-mono-telemetry text-slate-400 mt-0.5">RPM</span>
                  <span className="text-[9px] font-mono-telemetry font-bold text-slate-200 tabular-nums">
                    {hud.rpm}
                  </span>
                </div>
              </div>
            </div>

            {/* PS5 DualSense Trigger Telemetry + Interactive MFD (ERS Mode & Brake Bias) */}
            <div
              className={`pointer-events-auto mt-1.5 rounded-xl border border-white/15 px-2.5 py-1.5 flex-wrap items-center justify-center gap-2.5 shadow-xl text-[9px] font-mono-telemetry tabular-nums ${touchControls ? 'hidden md:flex' : 'flex'}`}
              style={{ backgroundColor: 'rgba(9, 11, 16, 0.92)' }}
            >
              {/* L2 Brake & R2 Throttle Real-Time Input Bars */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-bold text-[8px]">L2/R2</span>
                <div className="w-10 h-1.5 rounded-full bg-white/10 overflow-hidden" title="Brake Input (S / L2)">
                  <div
                    className="h-full bg-red-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, hud.brakeInputPct ?? 0)}%` }}
                  />
                </div>
                <div className="w-10 h-1.5 rounded-full bg-white/10 overflow-hidden" title="Throttle Input (W / R2)">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-75"
                    style={{ width: `${Math.min(100, hud.throttleInputPct ?? 0)}%` }}
                  />
                </div>
              </div>

              <span className="text-white/15">|</span>

              {/* ERS Deployment Mode Selector [R / D-Pad L-R] */}
              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-bold text-[8px]">ERS [R]</span>
                {(['harvest', 'balanced', 'overtake'] as ErsDeploymentMode[]).map((m) => {
                  const activeMode = (hud.ersMode ?? 'balanced') === m;
                  const shortLabel = m === 'harvest' ? 'HARV' : m === 'balanced' ? 'BAL' : 'OVT';
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onSetErsMode?.(m)}
                      className={`px-1.5 py-0.5 rounded text-[8px] font-display font-bold uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        activeMode
                          ? m === 'overtake'
                            ? 'bg-fuchsia-500 text-slate-950'
                            : m === 'harvest'
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-lime-400 text-slate-950'
                          : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                      }`}
                    >
                      {shortLabel}
                    </button>
                  );
                })}
              </div>

              <span className="text-white/15">|</span>

              {/* Front Brake Bias Selector [[ / ] / D-Pad U-D] */}
              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-bold text-[8px]">BIAS</span>
                <button
                  type="button"
                  onClick={() => onAdjustBrakeBias?.(-1)}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/15 text-slate-200 font-bold cursor-pointer whitespace-nowrap shrink-0"
                  title="Shift Brake Bias Rearward ([)"
                >
                  -
                </button>
                <span className="text-amber-300 font-bold min-w-[26px] text-center">
                  {hud.brakeBiasPct ?? 57}%
                </span>
                <button
                  type="button"
                  onClick={() => onAdjustBrakeBias?.(1)}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/15 text-slate-200 font-bold cursor-pointer whitespace-nowrap shrink-0"
                  title="Shift Brake Bias Forward (])"
                >
                  +
                </button>
              </div>

              {hud.dualsenseConnected && (
                <>
                  <span className="text-white/15">|</span>
                  <span className="text-sky-300 font-bold flex items-center gap-1 text-[8px] whitespace-nowrap">
                    <Gamepad2 className="w-3 h-3 text-sky-400" />
                    <span>DualSense™</span>
                  </span>
                </>
              )}
            </div>
          </div>
          </>
        )}

        {/* BOTTOM-RIGHT: 4-Wheel Tire Status, Pit Compound Selector, Damage & Touch Pedals */}
        <div
          className={`flex items-end gap-2.5 origin-bottom-right ${
            isExiting ? 'animate-hud-exit-br' : 'animate-hud-enter-br [animation-delay:110ms]'
          }`}
          style={{ transform: `scale(${adaptiveHudScale})` }}
        >
          {touchControls && (
            <div
              className={`pointer-events-auto flex items-end ${mobileSpacingGapClass} touch-none select-none ${
                mobileButtonLayout === 'left_handed' ? 'origin-bottom-left flex-row-reverse' : 'origin-bottom-right'
              } ${mobileButtonLayout === 'compact_thumb' ? 'flex-col-reverse items-end' : ''}`}
              style={{ transform: `scale(${mobileScaleFactor})`, opacity: mobileButtonOpacity }}
            >
              <div className="flex flex-col gap-1.5 items-end">
                {/* Sequential Smooth Swipe Gear Shifter Strip (Drag ↑ Upshift · Drag ↓ Downshift · Or Tap Top/Bottom) */}
                {(mobileShowGearStrip || transmission === 'manual' || mobileButtonLayout === 'split_pro') && (
                  <div className="flex items-center gap-1">
                    {mobileShowErsButton && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextMode: ErsDeploymentMode =
                            hud.ersMode === 'overtake' ? 'balanced' : 'overtake';
                          onSetErsMode?.(nextMode);
                          onTriggerMobileHaptic?.('aero_z', 0.6);
                        }}
                        className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border text-[8.5px] font-display font-bold cursor-pointer leading-tight whitespace-nowrap shrink-0 transition-colors ${
                          hud.ersMode === 'overtake' || hud.manualOverrideActive
                            ? 'border-fuchsia-400 bg-fuchsia-500/30 text-fuchsia-200 shadow-[0_0_12px_rgba(217,70,239,0.45)]'
                            : 'border-white/20 text-slate-200 active:bg-fuchsia-500/20'
                        }`}
                        style={{ backgroundColor: 'rgba(9, 11, 15, 0.92)' }}
                        title="Toggle ERS Overtake Boost"
                      >
                        OVT
                        <br />
                        <span className="text-[7px] font-mono-telemetry text-lime-300 tabular-nums">
                          {Math.round(hud.ersCharge)}%
                        </span>
                      </button>
                    )}

                    <div
                      role="application"
                      aria-label="Smooth Swipe Sequential Gear Shifter"
                      onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                        gearSwipeRef.current = {
                          pointerId: e.pointerId,
                          startY: e.clientY,
                          lastTriggerY: e.clientY,
                          totalShifts: 0,
                        };
                        setGearSwipeDeltaY(0);
                      }}
                      onPointerMove={(e) => {
                        const gs = gearSwipeRef.current;
                        if (!gs || gs.pointerId !== e.pointerId) return;
                        const visualDy = Math.max(-16, Math.min(16, e.clientY - gs.startY));
                        setGearSwipeDeltaY(visualDy);
                        const dyStep = e.clientY - gs.lastTriggerY;
                        if (dyStep < -22) {
                          gs.lastTriggerY = e.clientY;
                          gs.totalShifts += 1;
                          onManualShift(1);
                          showSwipeToast('GEAR ↑');
                        } else if (dyStep > 22) {
                          gs.lastTriggerY = e.clientY;
                          gs.totalShifts += 1;
                          onManualShift(-1);
                          showSwipeToast('GEAR ↓');
                        }
                      }}
                      onPointerUp={(e) => {
                        const gs = gearSwipeRef.current;
                        if (gs && gs.pointerId === e.pointerId && gs.totalShifts === 0) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const isTopHalf = e.clientY < rect.top + rect.height * 0.5;
                          onManualShift(isTopHalf ? 1 : -1);
                        }
                        gearSwipeRef.current = null;
                        setGearSwipeDeltaY(0);
                      }}
                      onPointerCancel={() => {
                        gearSwipeRef.current = null;
                        setGearSwipeDeltaY(0);
                      }}
                      className="relative w-14 h-16 min-w-[54px] min-h-[60px] rounded-xl border border-amber-400/45 flex flex-col items-center justify-between py-1 cursor-pointer touch-none select-none overflow-hidden shadow-xl"
                      style={{ backgroundColor: 'rgba(11, 14, 21, 0.94)' }}
                      title="Swipe ↑/↓ or Tap Top/Bottom to Shift"
                    >
                      <span className="text-[7px] font-display font-bold text-emerald-300 leading-none">
                        ▲ +G
                      </span>
                      <div
                        className={`px-2 py-0.5 rounded-md bg-white/10 border border-white/20 font-display font-black text-xs text-white leading-none ${
                          gearSwipeDeltaY !== 0 ? 'transition-none bg-amber-400/30 border-amber-300' : 'transition-transform duration-100'
                        }`}
                        style={{ transform: `translateY(${gearSwipeDeltaY * 0.45}px)` }}
                      >
                        {gearLabel}
                      </div>
                      <span className="text-[7px] font-display font-bold text-rose-300 leading-none">
                        ▼ -G
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onRequestTyreSwitch(
                        hud.weatherTyreImpact?.optimalCompound ??
                          hud.pitStrategy?.recommendedCompound ??
                          hud.tyreCompound
                      );
                      onTriggerMobileHaptic?.('aero_z', 0.4);
                    }}
                    className={`w-11 sm:w-12 h-11 min-w-[44px] min-h-[44px] rounded-xl border text-[9px] font-display font-bold cursor-pointer leading-tight whitespace-nowrap shrink-0 ${
                      hud.queuedCompound
                        ? 'border-amber-400 bg-amber-500/25 text-amber-200'
                        : 'border-white/20 text-slate-200 active:bg-white/15'
                    }`}
                    style={{ backgroundColor: 'rgba(9, 11, 15, 0.90)' }}
                  >
                    BOX
                  </button>

                  {/* Swipeable X-Mode / Z-Mode Aero Button (Tap to cycle, Swipe ↑ X-Mode, Swipe ↓ Z-Mode, Hold MOM) */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      padSwipeStartYRef.current = { pointerId: e.pointerId, y: e.clientY, acted: false };
                      onTouchInput('drs', true);
                    }}
                    onPointerMove={(e) => {
                      const st = padSwipeStartYRef.current;
                      if (!st || st.pointerId !== e.pointerId || st.acted) return;
                      const dy = e.clientY - st.y;
                      if (dy < -24) {
                        st.acted = true;
                        applyAeroModeToggle('x_mode');
                      } else if (dy > 24) {
                        st.acted = true;
                        applyAeroModeToggle('z_mode');
                      }
                    }}
                    onPointerUp={() => {
                      const st = padSwipeStartYRef.current;
                      onTouchInput('drs', false);
                      if (st && !st.acted) {
                        cycleAeroMode();
                      }
                      padSwipeStartYRef.current = null;
                    }}
                    onPointerLeave={() => {
                      onTouchInput('drs', false);
                    }}
                    onPointerCancel={() => {
                      onTouchInput('drs', false);
                      padSwipeStartYRef.current = null;
                    }}
                    className={`w-13 sm:w-14 h-11 min-w-[50px] min-h-[44px] rounded-xl border text-[8.5px] font-display font-bold cursor-pointer leading-tight touch-none select-none whitespace-nowrap shrink-0 ${
                      mobileAeroLock === 'x_mode' || hud.drsActive
                        ? 'border-lime-400 bg-lime-500/25 text-lime-200'
                        : mobileAeroLock === 'z_mode'
                          ? 'border-sky-400 bg-sky-500/25 text-sky-200'
                          : hud.manualOverrideActive
                            ? 'border-fuchsia-400 bg-fuchsia-500/30 text-fuchsia-200'
                            : 'border-white/25 text-slate-200 active:bg-cyan-500/20'
                    }`}
                    style={{ backgroundColor: 'rgba(9, 11, 15, 0.90)' }}
                    title="Tap or Swipe ↑/↓ for X-Mode / Z-Mode Aero"
                  >
                    {mobileAeroLock === 'x_mode' ? 'X-MODE' : mobileAeroLock === 'z_mode' ? 'Z-MODE' : 'X/Z'}
                    <br />
                    {mobileAeroLock === 'auto' ? 'AERO' : 'LOCK'}
                  </button>
                </div>
              </div>

              <div
                className={`flex items-end ${mobileSpacingGapClass} ${
                  mobileSwapPedals ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <button
                  type="button"
                  onPointerDown={() => {
                    onTouchInput('brake', true);
                    onTriggerMobileHaptic?.('brake', 0.68);
                  }}
                  onPointerUp={() => onTouchInput('brake', false)}
                  onPointerLeave={() => onTouchInput('brake', false)}
                  onPointerCancel={() => onTouchInput('brake', false)}
                  className={`${
                    mobileButtonLayout === 'split_pro' ? 'w-14 sm:w-16 h-16 sm:h-18' : 'w-13 sm:w-15 h-15 sm:h-16'
                  } relative overflow-hidden min-w-[52px] min-h-[56px] rounded-2xl border flex flex-col items-center justify-center gap-0.5 text-[10px] font-display font-bold text-red-200 active:bg-red-500/35 active:scale-95 transition-transform cursor-pointer touch-none select-none shadow-xl whitespace-nowrap shrink-0 ${
                    (hud.brakeInputPct ?? 0) > 65
                      ? 'border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.55)]'
                      : 'border-red-500/60'
                  }`}
                  style={{ backgroundColor: 'rgba(34, 12, 18, 0.92)' }}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 bg-red-500/25 pointer-events-none transition-all duration-75"
                    style={{ height: `${Math.min(100, hud.brakeInputPct ?? 0)}%` }}
                  />
                  <span className="relative z-10">BRAKE</span>
                  {(hud.brakeInputPct ?? 0) > 65 && (
                    <span className="relative z-10 text-[7px] font-mono-telemetry text-amber-300 leading-none tracking-wider">
                      ABS PULSE
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onPointerDown={() => {
                    onTouchInput('throttle', true);
                    onTriggerMobileHaptic?.('accel', 0.52);
                  }}
                  onPointerUp={() => onTouchInput('throttle', false)}
                  onPointerLeave={() => onTouchInput('throttle', false)}
                  onPointerCancel={() => onTouchInput('throttle', false)}
                  className={`${
                    mobileButtonLayout === 'split_pro' ? 'w-16 sm:w-18 h-20 sm:h-22' : 'w-14 sm:w-16 h-18 sm:h-20'
                  } relative overflow-hidden min-w-[56px] min-h-[68px] rounded-2xl border border-emerald-500/60 flex items-center justify-center text-[11px] font-display font-bold text-emerald-200 active:bg-emerald-500/35 active:scale-95 transition-transform cursor-pointer touch-none select-none shadow-xl whitespace-nowrap shrink-0`}
                  style={{ backgroundColor: 'rgba(10, 30, 22, 0.92)' }}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 bg-emerald-500/25 pointer-events-none transition-all duration-75"
                    style={{ height: `${Math.min(100, hud.throttleInputPct ?? 0)}%` }}
                  />
                  <span className="relative z-10">GAS</span>
                </button>
              </div>
            </div>
          )}

          {/* Compact Tire Status + Pit Compound + MFD Panel */}
          {(hudWidgets.tyrePanel !== false || hudWidgets.gForceRadar !== false || hudWidgets.damageDiagram !== false) && (
          <div
            className={`${touchControls ? 'hidden md:flex' : 'flex'} hud-themed-card pit-card-transition rounded-2xl border px-3 py-2.5 items-center gap-3 shadow-2xl ${
              pitWindowOpen
                ? 'border-emerald-400/55 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : hud.queuedCompound
                  ? 'border-amber-400/55 shadow-[0_0_16px_rgba(245,158,11,0.18)]'
                  : hudThemeMeta.accentBorder
            } ${
              pitWindowTransition === 'opening'
                ? 'pit-window-open-anim'
                : pitWindowTransition === 'closing'
                  ? 'pit-window-close-anim'
                  : ''
            }`}
            style={{
              background:
                'linear-gradient(180deg, rgba(14, 18, 25, 0.92) 0%, rgba(8, 10, 14, 0.95) 100%)',
            }}
          >
            {/* 4-Wheel Tire Core & Surface Temperature + Wear Visualization (FL / FR / RL / RR) */}
            {hudWidgets.tyrePanel !== false && (
            <div className="flex flex-col gap-1.5 relative">
            {(() => {
              const compoundWin = getTyreCompoundTempWindow(hud.tyreCompound);
              const cpSurf = hud.tyreContactPatch?.wheelSurfaceTempC;
              const cpCore = hud.tyreContactPatch?.wheelCoreTempC;
              const wheels = [
                {
                  label: 'FL',
                  wear: flWear,
                  surfTemp: cpSurf?.[0] ?? baseTempC + 1,
                  coreTemp: cpCore?.[0] ?? baseTempC + 4,
                  slip: hud.tyreContactPatch?.wheelMicroSlipPct?.[0] ?? 6,
                },
                {
                  label: 'FR',
                  wear: frWear,
                  surfTemp: cpSurf?.[1] ?? baseTempC + 2,
                  coreTemp: cpCore?.[1] ?? baseTempC + 5,
                  slip: hud.tyreContactPatch?.wheelMicroSlipPct?.[1] ?? 6,
                },
                {
                  label: 'RL',
                  wear: rlWear,
                  surfTemp: cpSurf?.[2] ?? baseTempC + 4,
                  coreTemp: cpCore?.[2] ?? baseTempC + 7,
                  slip: hud.tyreContactPatch?.wheelMicroSlipPct?.[2] ?? 7,
                },
                {
                  label: 'RR',
                  wear: rrWear,
                  surfTemp: cpSurf?.[3] ?? baseTempC + 3,
                  coreTemp: cpCore?.[3] ?? baseTempC + 6,
                  slip: hud.tyreContactPatch?.wheelMicroSlipPct?.[3] ?? 7,
                },
              ];

              return (
                <>
                  {showTyreThermalOverlay && (
                    <div
                      className="pointer-events-auto absolute bottom-full right-0 mb-2.5 w-[380px] sm:w-[430px] rounded-2xl border border-sky-400/45 p-3 shadow-2xl z-30"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(10, 14, 22, 0.97) 0%, rgba(6, 9, 15, 0.98) 100%)',
                      }}
                    >
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                        <div className="flex items-center gap-1.5">
                          <Thermometer className="w-3.5 h-3.5 text-sky-400" />
                          <span className="font-display font-black text-[10px] tracking-wider uppercase text-white">
                            4-Corner Tyre Core & Surface Thermal Telemetry
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowTyreThermalOverlay(false)}
                          className="w-5 h-5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                          title="Close Thermal Telemetry"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <TyreTemperatureOverlay hud={hud} compound={hud.tyreCompound} />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-semibold tracking-wider text-slate-300">
                        TYRES ({activeCompoundMeta.short})
                      </span>
                      <span
                        className="text-[7px] font-mono-telemetry px-1 py-0.2 rounded border border-emerald-400/35 bg-emerald-500/12 text-emerald-300 tabular-nums"
                        title={`Optimal surface operating window: ${compoundWin.surfMin}–${compoundWin.surfMax}°C | Core: ${compoundWin.coreMin}–${compoundWin.coreMax}°C`}
                      >
                        OPT {compoundWin.surfMin}–{compoundWin.surfMax}°C
                      </span>
                    </div>
                    <div className="pointer-events-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowTyreThermalOverlay((v) => !v)}
                        title="Toggle 4-Corner Tyre Core & Surface Thermal Telemetry"
                        className={`h-4 px-1 rounded text-[7px] font-mono-telemetry font-bold border transition-colors cursor-pointer flex items-center gap-0.5 ${
                          showTyreThermalOverlay
                            ? 'border-sky-400 bg-sky-500/25 text-sky-200'
                            : 'border-white/20 bg-black/50 text-slate-300 hover:text-white hover:border-white/40'
                        }`}
                      >
                        <Thermometer className="w-2.5 h-2.5 text-sky-400" />
                        <span>TEMP</span>
                      </button>
                      {COMPOUND_OPTIONS.map((c) => {
                        const isActive = hud.tyreCompound === c.id;
                        const isQueued = hud.queuedCompound === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onRequestTyreSwitch(c.id)}
                            title={`Pit for ${c.id.toUpperCase()} tyres`}
                            className={`w-4 h-4 rounded-full text-[8px] font-display font-bold border transition-colors cursor-pointer flex items-center justify-center ${
                              isQueued
                                ? 'border-amber-400 bg-amber-500/30 text-amber-200'
                                : isActive
                                  ? 'border-white bg-white/20 text-white'
                                  : 'border-white/20 bg-black/40 text-slate-400 hover:text-white'
                            }`}
                            style={{ borderColor: isActive ? c.color : undefined }}
                          >
                            {c.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Refined 4-Wheel Chassis-Linked Core + Surface Thermal & Segmented Tread Wear Grid */}
                  <div className="relative grid grid-cols-2 gap-x-3 gap-y-2">
                    {/* Subtle 2D Top-Down F1 Suspension & Monocoque Spine Overlay */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="w-[2px] h-[74%] bg-white/15 rounded-full" />
                      <div className="absolute top-[26%] inset-x-[24%] h-px bg-white/15" />
                      <div className="absolute bottom-[26%] inset-x-[24%] h-px bg-white/15" />
                    </div>
                    {wheels.map((t) => {
                      const wearCol = tyreColorForWear(t.wear);
                      const surfMeta = getTyreTempColorMeta(t.surfTemp, hud.tyreCompound, 'surface');
                      const coreMeta = getTyreTempColorMeta(t.coreTemp, hud.tyreCompound, 'core');
                      const wearSegments = Math.max(0, Math.min(4, Math.ceil(t.wear / 25)));
                      return (
                        <div
                          key={t.label}
                          className="relative flex items-center gap-1.5 rounded-lg border px-1.5 py-1 transition-colors"
                          style={{
                            borderColor: t.wear <= 25 ? '#EF4444' : surfMeta.borderHex,
                            backgroundColor: 'rgba(9, 13, 20, 0.90)',
                          }}
                          title={`${t.label} Tyre — Wear: ${t.wear}% | Surface: ${t.surfTemp}°C (${surfMeta.label}) | Core: ${t.coreTemp}°C (${coreMeta.label}) | Micro-Slip: ${t.slip}%`}
                        >
                          {/* 4-Segment Tread Health Ladder */}
                          <div className="flex flex-col gap-[2px] w-1.5 h-7 justify-end shrink-0">
                            {[4, 3, 2, 1].map((segIdx) => {
                              const lit = wearSegments >= segIdx;
                              return (
                                <span
                                  key={segIdx}
                                  className="w-full flex-1 rounded-[1px] transition-colors"
                                  style={{
                                    backgroundColor: lit ? wearCol : 'rgba(255,255,255,0.10)',
                                  }}
                                />
                              );
                            })}
                          </div>

                          {/* Dual-Zone Tire Thermal Graphic: Outer Surface Shell + Inner Carcass Core */}
                          <div
                            className="w-4 h-7 rounded-[3px] p-[2px] flex items-center justify-center shrink-0 transition-colors"
                            style={{
                              backgroundColor: surfMeta.bgTint,
                              border: `1.5px solid ${surfMeta.hex}`,
                              boxShadow:
                                surfMeta.state === 'overheating'
                                  ? '0 0 8px rgba(239, 68, 68, 0.55)'
                                  : surfMeta.state === 'optimal'
                                    ? '0 0 6px rgba(16, 185, 129, 0.35)'
                                    : 'none',
                            }}
                          >
                            <div
                              className="w-full h-full rounded-[1.5px] flex items-center justify-center transition-colors"
                              style={{
                                backgroundColor: coreMeta.hex,
                                opacity: 0.9,
                              }}
                            >
                              <span className="text-[6px] font-display font-black text-slate-950 leading-none select-none">
                                {t.label}
                              </span>
                            </div>
                          </div>

                          {/* Real-Time Wear %, Surface (S) & Core (C) Temps + Micro-Slip Readout */}
                          <div className="flex flex-col leading-tight min-w-[56px]">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="text-[8px] font-mono-telemetry font-bold tabular-nums"
                                style={{ color: t.wear <= 35 ? wearCol : '#FFFFFF' }}
                              >
                                {t.wear}%
                              </span>
                              <span
                                className="text-[6.5px] font-mono-telemetry font-bold uppercase px-0.5 rounded"
                                style={{
                                  color: surfMeta.hex,
                                  backgroundColor: surfMeta.bgTint,
                                }}
                              >
                                {surfMeta.shortLabel}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[7.5px] font-mono-telemetry tabular-nums">
                              <span className="text-slate-400">S/C</span>
                              <span className={`font-bold ${surfMeta.textClass}`}>
                                {t.surfTemp}°/<span className={coreMeta.textClass}>{t.coreTemp}°</span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[7px] font-mono-telemetry tabular-nums">
                              <span className="text-slate-400">SLIP</span>
                              <span className={t.slip > 16 ? 'text-amber-300 font-bold' : 'text-slate-300'}>
                                {Math.round(t.slip)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 4-Corner Peak Load & Axle Wear Imbalance */}
                  {(() => {
                    const lowest = wheels.reduce((acc, w) => (w.wear < acc.wear ? w : acc), wheels[0]);
                    const frontAvg = Math.round((flWear + frWear) * 0.5);
                    const rearAvg = Math.round((rlWear + rrWear) * 0.5);
                    const axleDiff = frontAvg - rearAvg;
                    const axleTag =
                      Math.abs(axleDiff) < 3
                        ? 'BALANCED'
                        : axleDiff >= 3
                          ? `REAR LOAD -${axleDiff}%`
                          : `FRONT LOAD -${Math.abs(axleDiff)}%`;
                    return (
                      <div className="flex items-center justify-between px-1 pt-0.5 text-[7px] font-mono-telemetry uppercase tracking-wider tabular-nums">
                        <span className={lowest.wear < 45 ? 'text-amber-300 font-bold' : 'text-slate-300'}>
                          PEAK DEG: {lowest.label} {lowest.wear}%
                        </span>
                        <span className={Math.abs(axleDiff) >= 6 ? 'text-cyan-300 font-bold' : 'text-slate-400'}>
                          {axleTag}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Operating Window Color Legend Bar */}
                  <div className="flex items-center justify-between px-1 pt-0.5 text-[6.5px] font-mono-telemetry uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                      Cold
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      Opt
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                      Warm
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                      Hot
                    </span>
                  </div>
                </>
              );
            })()}

              {/* Microscopic Contact Patch: Real-Time Micro-Slip & Graining Probability */}
              {(() => {
                const cp = hud.tyreContactPatch;
                const microSlipPct = cp?.microSlipPct ?? 6;
                const grainProbPct = cp?.grainingProbabilityPct ?? 8;
                const patchState = cp?.patchState ?? 'stick';
                const stateBadge =
                  patchState === 'graining_risk'
                    ? { label: 'GRAINING', cls: 'text-amber-300 border-amber-400/50 bg-amber-500/15' }
                    : patchState === 'thermal_blister'
                      ? { label: 'BLISTER', cls: 'text-red-300 border-red-400/50 bg-red-500/15' }
                      : patchState === 'macro_slide'
                        ? { label: 'SLIDING', cls: 'text-red-300 border-red-400/60 bg-red-500/20' }
                        : patchState === 'micro_slip'
                          ? { label: 'MICRO-SLIP', cls: 'text-cyan-300 border-cyan-400/45 bg-cyan-500/15' }
                          : { label: 'ADHESION', cls: 'text-emerald-300 border-emerald-400/45 bg-emerald-500/15' };

                return (
                  <div className="flex flex-col gap-1 pt-1 border-t border-white/10 text-[8px] font-mono-telemetry tabular-nums">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-slate-400 font-bold">CONTACT PATCH</span>
                      <span className={`px-1 py-0.2 rounded border text-[7px] font-display font-bold ${stateBadge.cls}`}>
                        {stateBadge.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-slate-400">MICRO-SLIP</span>
                      <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full ${
                            microSlipPct > 55
                              ? 'bg-red-500'
                              : microSlipPct > 25
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, microSlipPct))}%` }}
                        />
                      </div>
                      <span className="text-white font-bold w-6 text-right">{microSlipPct}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-slate-400">GRAIN PROB</span>
                      <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full ${
                            grainProbPct > 55
                              ? 'bg-red-500'
                              : grainProbPct > 32
                                ? 'bg-amber-400'
                                : 'bg-sky-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, grainProbPct))}%` }}
                        />
                      </div>
                      <span
                        className={`font-bold w-6 text-right ${
                          grainProbPct > 50 ? 'text-amber-300' : 'text-sky-300'
                        }`}
                      >
                        {grainProbPct}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-slate-400">GRAIN SEV</span>
                      <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full ${
                            (cp?.grainingSeverityPct ?? 0) > 45
                              ? 'bg-red-500'
                              : (cp?.grainingSeverityPct ?? 0) > 20
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, cp?.grainingSeverityPct ?? 0))}%` }}
                        />
                      </div>
                      <span
                        className={`font-bold w-6 text-right ${
                          (cp?.grainingSeverityPct ?? 0) > 35 ? 'text-red-400' : 'text-emerald-300'
                        }`}
                      >
                        {cp?.grainingSeverityPct ?? 0}%
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-[8px] font-mono-telemetry tabular-nums">
                <span className="text-slate-400">FUEL</span>
                <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full ${hud.fuelPct < 20 ? 'bg-red-500' : 'bg-cyan-400'}`}
                    style={{ width: `${Math.min(100, Math.max(0, hud.fuelPct))}%` }}
                  />
                </div>
                <span className={hud.fuelPct < 20 ? 'text-red-400 font-bold' : 'text-cyan-300 font-bold'}>
                  {hud.fuelPct}%
                </span>
              </div>
            </div>
            )}

            {/* Authentic FIA F1 Live Circular G-Force Telemetry Meter */}
            {hudWidgets.gForceRadar !== false && (
            <div className={`hidden md:flex hud-themed-card flex-col items-center justify-center p-2 rounded-xl border ${hudThemeMeta.accentBorder} bg-black/85 shadow-lg min-w-[76px]`}>
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[8px] font-display font-bold text-slate-300 uppercase tracking-wider">
                  G-FORCE
                </span>
                <span className="text-[9px] font-mono-telemetry font-bold text-amber-400 tabular-nums">
                  {hud.gForceTotal.toFixed(1)}G
                </span>
              </div>
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg viewBox="-30 -30 60 60" className="w-full h-full">
                  <circle cx="0" cy="0" r="6" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="12" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="18" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="24" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="0.9" />
                  <line x1="-24" y1="0" x2="24" y2="0" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
                  <line x1="0" y1="-24" x2="0" y2="24" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
                  <line
                    x1="0"
                    y1="0"
                    x2={Math.max(-23, Math.min(23, hud.gForceLat * 4.8))}
                    y2={Math.max(-23, Math.min(23, -hud.gForceLong * 4.8))}
                    stroke={hud.gForceTotal > 3.5 ? '#EF4444' : '#F59E0B'}
                    strokeWidth="1.5"
                    strokeOpacity="0.75"
                  />
                  <circle
                    cx={Math.max(-23, Math.min(23, hud.gForceLat * 4.8))}
                    cy={Math.max(-23, Math.min(23, -hud.gForceLong * 4.8))}
                    r="2.8"
                    fill={hud.gForceTotal > 3.5 ? '#EF4444' : '#F59E0B'}
                  />
                </svg>
              </div>
              <div className="flex items-center justify-between w-full mt-1 text-[7px] font-mono-telemetry tabular-nums text-slate-400">
                <span>{(hud.gForceLat > 0 ? '+' : '') + hud.gForceLat.toFixed(1)}</span>
                <span>{hud.gForceLong < 0 ? 'B' : 'A'}:{Math.abs(hud.gForceLong).toFixed(1)}</span>
              </div>
            </div>
            )}

            {/* Vehicle Damage Mini-Diagram */}
            {hudWidgets.damageDiagram !== false && (
              <div className="hidden lg:block">
                <VehicleDamageVisualizer damagePct={hud.damagePct} />
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
