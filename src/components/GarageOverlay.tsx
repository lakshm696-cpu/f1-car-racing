import React, { useState } from 'react';
import {
  ArrowLeft,
  BatteryCharging,
  Camera,
  ChevronDown,
  ChevronUp,
  Cpu,
  Feather,
  Info,
  Lightbulb,
  Play,
  Wind,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  FORMULA_DRIVERS,
  FORMULA_TEAMS,
  PAINT_SWATCHES,
  RACING_NUMBERS,
  UPGRADE_COSTS,
  WHEEL_FINISHES,
} from '../data/racingData';
import {
  CarUpgrades,
  FormulaTeam,
  GarageCameraPreset,
  TyreCompound,
  WheelFinish,
} from '../types/racing';

interface GarageOverlayProps {
  selectedTeam: FormulaTeam;
  customPrimaryHex: string;
  customNumber: string;
  selectedWheel: WheelFinish;
  selectedCompound: TyreCompound;
  upgrades: CarUpgrades;
  credits: number;
  onSelectTeam: (team: FormulaTeam) => void;
  onSelectPaint: (hex: string) => void;
  onSelectNumber: (num: string) => void;
  onSelectWheel: (wheel: WheelFinish) => void;
  onSelectCompound: (compound: TyreCompound) => void;
  onPurchaseUpgrade: (key: keyof CarUpgrades, level: number, cost: number) => void;
  onCameraPreset: (preset: GarageCameraPreset) => void;
  onZoom: (delta: number) => void;
  onToggleLights: () => boolean;
  onBack: () => void;
  onStartRace: () => void;
}

type DockTab = 'constructor' | 'livery' | 'upgrades' | 'engineering' | 'practice';
type PracticeSubTab = 'strategy' | 'qualifying' | 'tyre_mgmt';

const CAMERA_PRESETS: { id: GarageCameraPreset; label: string }[] = [
  { id: 'overview', label: '3/4' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'cockpit', label: 'Halo' },
  { id: 'rear', label: 'Rear' },
];

export const GarageOverlay: React.FC<GarageOverlayProps> = ({
  selectedTeam,
  customPrimaryHex,
  customNumber,
  selectedWheel,
  selectedCompound,
  upgrades,
  credits,
  onSelectTeam,
  onSelectPaint,
  onSelectNumber,
  onSelectWheel,
  onSelectCompound,
  onPurchaseUpgrade,
  onCameraPreset,
  onZoom,
  onToggleLights,
  onBack,
  onStartRace,
}) => {
  const [activeTab, setActiveTab] = useState<DockTab>('constructor');
  const [practiceTab, setPracticeTab] = useState<PracticeSubTab>('strategy');
  const [resourcePoints, setResourcePoints] = useState<number>(296);
  const [workforceCount, setWorkforceCount] = useState<number>(135);
  const [collapsed, setCollapsed] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
  const [lightsOn, setLightsOn] = useState(true);
  const [activePreset, setActivePreset] = useState<GarageCameraPreset>('overview');

  const topSpeed = Math.min(100, selectedTeam.baseTopSpeed + (upgrades.engineLevel - 1) * 3);
  const accel = Math.min(100, selectedTeam.baseAcceleration + (upgrades.engineLevel - 1) * 3);
  const downforce = Math.min(
    100,
    selectedTeam.baseDownforce + (upgrades.aeroLevel - 1) * 3 + (upgrades.suspensionLevel - 1) * 2
  );
  const grip = Math.min(100, 88 + (upgrades.tyreLevel - 1) * 4 + (upgrades.suspensionLevel - 1) * 2);
  const braking = Math.min(100, selectedTeam.baseBraking + (upgrades.brakeLevel - 1) * 3);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar + Camera Angle & Workshop Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="pointer-events-auto rounded-xl border border-white/15 bg-[#090B0F]/88 backdrop-blur-md px-4 py-2.5 flex items-center gap-4 shadow-xl">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Menu</span>
          </button>
          <div className="w-px h-5 bg-white/15" />
          <div>
            <div className="font-display font-bold text-sm text-white leading-tight">
              {selectedTeam.name} · {selectedTeam.chassis} (#{customNumber || selectedTeam.number})
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>
                Credits:{' '}
                <span className="text-amber-400 font-mono-telemetry font-semibold tabular-nums">
                  {credits.toLocaleString()} CR
                </span>
              </span>
              <span>·</span>
              <span>
                Resource Pts:{' '}
                <span className="text-cyan-300 font-mono-telemetry font-bold tabular-nums">
                  +{resourcePoints}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-2 shrink-0">
          {/* Camera Angle Presets */}
          <div className="rounded-xl border border-white/15 bg-[#090B0F]/88 backdrop-blur-md p-1 flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-slate-400 mx-1 shrink-0" />
            {CAMERA_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActivePreset(p.id);
                  onCameraPreset(p.id);
                }}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                  activePreset === p.id ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Zoom & Dramatic Studio Lights & Specs */}
          <div className="rounded-xl border border-white/15 bg-[#090B0F]/88 backdrop-blur-md p-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => onZoom(-0.8)}
              title="Zoom In"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onZoom(0.8)}
              title="Zoom Out"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLightsOn(onToggleLights())}
              title="Toggle Showroom & Car Lights"
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                lightsOn ? 'text-amber-300 bg-amber-400/15' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>{lightsOn ? 'Studio' : 'Spot'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSpecs((s) => !s)}
              title="Vehicle Information"
              className={`p-1.5 rounded-lg cursor-pointer ${
                showSpecs ? 'text-cyan-400 bg-cyan-400/15' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onStartRace}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-lg"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Race</span>
          </button>
        </div>
      </div>

      {/* Optional Vehicle Specification Sheet Drawer */}
      {showSpecs && (
        <div className="flex justify-end my-auto">
          <div
            className="pointer-events-auto w-72 rounded-2xl border border-white/15 p-4 text-xs flex flex-col gap-2"
            style={{ backgroundColor: 'rgba(9, 11, 15, 0.92)' }}
          >
            <div className="font-display font-bold text-sm text-white border-b border-white/10 pb-2">
              {selectedTeam.chassis} Technical Spec
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Monocoque</span>
              <span className="font-semibold text-white">Carbon-Honeycomb</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Powertrain</span>
              <span className="font-semibold text-white">1.6L V6 Hybrid + ERS</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Gearbox</span>
              <span className="font-semibold text-white">8-Speed Seamless</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Dry Weight</span>
              <span className="font-semibold text-white">798 kg (FIA Spec)</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Brake System</span>
              <span className="font-semibold text-white">Carbon-Ceramic 328mm</span>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Bottom Control Dock */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="pointer-events-auto mb-1.5 px-3 py-1 rounded-t-lg border border-b-0 border-white/15 text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
          style={{ backgroundColor: 'rgba(9, 11, 15, 0.92)' }}
        >
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{collapsed ? 'Show Engineering & Garage Controls' : 'Hide Controls'}</span>
        </button>

        {!collapsed && (
          <div
            className="pointer-events-auto w-full max-w-[1380px] rounded-2xl border border-white/15 p-3.5 sm:p-4 flex flex-col gap-3 shadow-2xl"
            style={{ backgroundColor: 'rgba(9, 11, 15, 0.93)' }}
          >
            {/* Dock Header: Tabs + Live Performance Bars */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-2.5">
              <div className="flex flex-wrap items-center gap-1 bg-white/5 p-1 rounded-lg">
                {(
                  [
                    { id: 'constructor', label: `Constructors (${FORMULA_TEAMS.length})` },
                    { id: 'livery', label: 'Livery, Wheels & #' },
                    { id: 'upgrades', label: '5-Part Upgrades' },
                    { id: 'engineering', label: 'F1® 25 Engineering Phase 2' },
                    { id: 'practice', label: 'Practice Programmes' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      activeTab === tab.id
                        ? 'bg-red-600 text-white shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                {[
                  { label: 'SPD', val: topSpeed, color: '#EF4444' },
                  { label: 'ACC', val: accel, color: '#F59E0B' },
                  { label: 'GRP', val: grip, color: '#A855F7' },
                  { label: 'AERO', val: downforce, color: '#38BDF8' },
                  { label: 'BRK', val: braking, color: '#10B981' },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-semibold">{stat.label}</span>
                    <div className="w-10 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${stat.val}%`, backgroundColor: stat.color }}
                      />
                    </div>
                    <span className="font-mono-telemetry text-slate-200 font-semibold">{stat.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {activeTab === 'constructor' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-7 gap-1.5">
                {FORMULA_TEAMS.map((team) => {
                  const active = team.id === selectedTeam.id;
                  const teamDrivers = FORMULA_DRIVERS.filter((d) => d.teamId === team.id);
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => onSelectTeam(team)}
                      className={`p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-amber-400 bg-white/12'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="w-3.5 h-3.5 rounded-sm border border-white/25"
                          style={{ backgroundColor: team.primaryColor }}
                        />
                        <span className="font-mono-telemetry text-[9px] text-amber-300 font-semibold truncate ml-1">
                          {teamDrivers.map((d) => d.code).join('·')}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-white truncate">
                        {team.name
                          .replace(' Formula 1 Team', '')
                          .replace(' F1 Team', '')
                          .replace('Scuderia ', '')
                          .replace('Oracle ', '')
                          .replace('Atlassian ', '')
                          .replace('MoneyGram ', '')
                          .replace('Visa Cash App ', '')
                          .replace('Stake ', '')}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">{team.chassis}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === 'livery' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold tracking-wider text-slate-400">
                      CHASSIS PAINT
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {PAINT_SWATCHES.map((swatch) => {
                        const active = customPrimaryHex === swatch.hex;
                        const bg = swatch.hex || selectedTeam.primaryColor;
                        return (
                          <button
                            key={swatch.id}
                            type="button"
                            onClick={() => onSelectPaint(swatch.hex)}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer ${
                              active
                                ? 'border-amber-400 bg-white/10 text-white'
                                : 'border-white/12 text-slate-300 hover:text-white'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/30"
                              style={{ backgroundColor: bg }}
                            />
                            <span>{swatch.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold tracking-wider text-slate-400">
                      WHEEL FINISH
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {WHEEL_FINISHES.map((wf) => {
                        const active = selectedWheel.id === wf.id;
                        return (
                          <button
                            key={wf.id}
                            type="button"
                            onClick={() => onSelectWheel(wf)}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer ${
                              active
                                ? 'border-amber-400 bg-white/10 text-white'
                                : 'border-white/12 text-slate-300 hover:text-white'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/30"
                              style={{ backgroundColor: wf.rimColor }}
                            />
                            <span>{wf.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold tracking-wider text-slate-400 mr-1">
                      RACING #
                    </span>
                    {RACING_NUMBERS.map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => onSelectNumber(num)}
                        className={`px-2 py-1 rounded text-[11px] font-mono-telemetry font-bold cursor-pointer ${
                          (customNumber || selectedTeam.number) === num
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/8 text-slate-300 hover:text-white'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold tracking-wider text-slate-400 mr-1">
                      TYRES
                    </span>
                    {(['soft', 'medium', 'hard', 'wet'] as TyreCompound[]).map((cmp) => (
                      <button
                        key={cmp}
                        type="button"
                        onClick={() => onSelectCompound(cmp)}
                        className={`px-2 py-1 rounded text-[11px] font-semibold uppercase cursor-pointer ${
                          selectedCompound === cmp
                            ? 'bg-white text-slate-950'
                            : 'bg-white/10 text-slate-300 hover:text-white'
                        }`}
                      >
                        {cmp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'upgrades' && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {(
                  [
                    { key: 'engineLevel', label: 'Engine', effect: '+5.5% Power' },
                    { key: 'tyreLevel', label: 'Tyres', effect: '+5% Peak Grip' },
                    { key: 'brakeLevel', label: 'Brakes', effect: '+7% Stop Force' },
                    { key: 'suspensionLevel', label: 'Suspension', effect: '+5% Cornering' },
                    { key: 'aeroLevel', label: 'Aero Wing', effect: '+6% Downforce' },
                  ] as const
                ).map((u) => {
                  const curLvl = upgrades[u.key];
                  const nextLvl = curLvl < 3 ? curLvl + 1 : null;
                  const cost = nextLvl ? UPGRADE_COSTS[nextLvl - 1] : 0;
                  const canAfford = nextLvl !== null && credits >= cost;
                  return (
                    <div
                      key={u.key}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 flex flex-col justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold text-white">
                          <span>{u.label}</span>
                          <span className="font-mono-telemetry text-amber-400">Mk {curLvl}/3</span>
                        </div>
                        <div className="text-[10px] text-emerald-400 mt-0.5">{u.effect} / Lv</div>
                      </div>
                      {nextLvl ? (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onPurchaseUpgrade(u.key, nextLvl, cost)}
                          className={`w-full py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                            canAfford
                              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                              : 'bg-white/10 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          Upgrade · {cost} CR
                        </button>
                      ) : (
                        <div className="w-full py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-center text-[11px] font-semibold text-emerald-300">
                          MAX SPEC
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 4: F1 25 ENGINEERING PHASE 2 HUB (from Screenshot 11) */}
            {activeTab === 'engineering' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                {/* Left Column: Engineering Phase 2 Badge + 5 Department Actions */}
                <div className="lg:col-span-4 rounded-xl border border-red-500/35 bg-black/50 p-3 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div>
                      <div className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">
                        ENGINEERING FACILITY
                      </div>
                      <div className="font-display font-black text-base text-white">
                        PHASE 2 · WORKFORCE {workforceCount}/347
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-red-600 text-white font-mono-telemetry font-bold text-[10px]">
                      ACTIVE
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {[
                      {
                        title: 'RESEARCH',
                        sub: 'Discover next-gen 2026 aerodynamic & hybrid concepts',
                        pts: 60,
                      },
                      {
                        title: 'DEVELOPMENT',
                        sub: 'Manufacture discovered parts in the wind tunnel',
                        pts: 85,
                      },
                      {
                        title: 'ASSIGN UPGRADES',
                        sub: 'Fit manufactured upgrades to Car #1 & Car #2',
                        pts: 40,
                      },
                      {
                        title: 'COMPONENT MANAGEMENT',
                        sub: 'Inspect ICE, MGU-K, Turbocharger & Gearbox wear',
                        pts: 0,
                      },
                      {
                        title: 'FACILITY IMPROVEMENTS',
                        sub: 'Expand Engineering Workforce towards Phase 3 (347 staff)',
                        pts: 100,
                      },
                    ].map((dept) => (
                      <button
                        key={dept.title}
                        type="button"
                        onClick={() => {
                          if (dept.pts > 0 && resourcePoints >= dept.pts) {
                            setResourcePoints((p) => p - dept.pts);
                            setWorkforceCount((w) => Math.min(347, w + 12));
                          } else {
                            setResourcePoints((p) => p + 90);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg border border-white/12 bg-white/[0.03] hover:border-red-500/60 hover:bg-red-600/15 text-left flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="font-display font-bold text-xs text-white tracking-wide">
                            {dept.title}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{dept.sub}</div>
                        </div>
                        <span className="font-mono-telemetry text-[10px] font-bold text-cyan-300 shrink-0 ml-2">
                          {dept.pts > 0 ? `${dept.pts} RP` : 'INSPECT'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Column: Cleanroom Facility Overview & R&D Department Progress */}
                <div className="lg:col-span-8 rounded-xl border border-white/12 bg-gradient-to-br from-slate-900/90 to-black/80 p-3.5 flex flex-col justify-between gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-display font-bold text-white uppercase tracking-wider">
                        {selectedTeam.name} R&amp;D Cleanroom &amp; Dyno Status
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Simultaneous upgrades unlocked via Driver Recognition · Wind Tunnel Calibration: Optimal
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-xs font-mono-telemetry font-bold text-cyan-300">
                      Available RP: {resourcePoints} / 862
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      {
                        dept: 'Aerodynamics',
                        lvl: upgrades.aeroLevel,
                        key: 'aeroLevel' as const,
                        stat: `${downforce} PTS`,
                        color: '#38BDF8',
                      },
                      {
                        dept: 'Powertrain',
                        lvl: upgrades.engineLevel,
                        key: 'engineLevel' as const,
                        stat: `${topSpeed} PTS`,
                        color: '#EF4444',
                      },
                      {
                        dept: 'Chassis & Weight',
                        lvl: upgrades.suspensionLevel,
                        key: 'suspensionLevel' as const,
                        stat: `${grip} PTS`,
                        color: '#A855F7',
                      },
                      {
                        dept: 'Durability & Brakes',
                        lvl: upgrades.brakeLevel,
                        key: 'brakeLevel' as const,
                        stat: `${braking} PTS`,
                        color: '#10B981',
                      },
                    ].map((d) => (
                      <div
                        key={d.dept}
                        className="rounded-xl border border-white/10 bg-black/45 p-2.5 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold text-white">
                          <span>{d.dept}</span>
                          <span className="font-mono-telemetry text-xs" style={{ color: d.color }}>
                            {d.stat}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${35 + d.lvl * 21}%`, backgroundColor: d.color }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                          <span>Stage {d.lvl}/3</span>
                          <span className="text-emerald-400 font-semibold">Secret Spec Ready</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                    <span>
                      Facility Perk: <strong className="text-white">-15% R&amp;D Failure Rate</strong> · Simultaneous Dept Upgrades: <strong className="text-emerald-400">5 Active</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('practice')}
                      className="text-cyan-300 hover:text-white font-semibold cursor-pointer"
                    >
                      Earn Resource Points in Practice Programmes →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: F1 25 PRACTICE PROGRAMMES & DEVELOPMENT CATALYSTS (from Screenshot 2: Albert Park Practice 1) */}
            {activeTab === 'practice' && (
              <div className="flex flex-col gap-3">
                {/* Top 3 Practice Programme Tabs (Race Strategy 0/5 · Qualifying Pace 0/5 · Tyre Management 0/5) */}
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'strategy', label: 'Race Strategy 0/5', laps: '5 LAPS', compound: 'M' },
                      { id: 'qualifying', label: 'Qualifying Pace 0/5', laps: '3 LAPS', compound: 'S' },
                      { id: 'tyre_mgmt', label: 'Tyre Management 0/5', laps: '4 LAPS', compound: 'H' },
                    ] as const
                  ).map((prog) => (
                    <button
                      key={prog.id}
                      type="button"
                      onClick={() => setPracticeTab(prog.id)}
                      className={`py-2 px-3 rounded-lg border font-display font-bold text-xs tracking-wide transition-colors cursor-pointer flex items-center justify-between ${
                        practiceTab === prog.id
                          ? 'border-white bg-white/15 text-white'
                          : 'border-white/12 bg-black/40 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>{prog.label}</span>
                      <span className="px-1.5 py-0.5 rounded-full border border-amber-400 text-[10px] text-amber-300">
                        {prog.compound}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Middle Split: Resource Rewards (+172 / +115) & Development Catalysts (Aero Drag / Battery / Weight Reduction) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  {/* Resource Rewards */}
                  <div className="lg:col-span-5 rounded-xl border border-red-500/35 bg-black/45 p-3 flex flex-col gap-2">
                    <div className="text-[11px] font-display font-bold uppercase tracking-wider text-slate-200 text-center border-b border-white/10 pb-1.5">
                      RESOURCE REWARDS (RICOMPENSE RISORSE)
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setResourcePoints((p) => Math.min(862, p + 172))}
                        className="rounded-xl border border-white/15 bg-white/[0.03] hover:border-emerald-400/60 p-3 flex flex-col items-center gap-1 cursor-pointer transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg border border-white/30 flex items-center justify-center font-mono-telemetry font-bold text-white">
                          +
                        </div>
                        <div className="font-display font-black text-xl text-white">172</div>
                        <div className="text-[10px] text-slate-300">Score at least 30 pts</div>
                        <div className="w-8 h-1 rounded-full bg-emerald-400 mt-1" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setResourcePoints((p) => Math.min(862, p + 115))}
                        className="rounded-xl border border-white/15 bg-white/[0.03] hover:border-fuchsia-400/60 p-3 flex flex-col items-center gap-1 cursor-pointer transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg border border-white/30 flex items-center justify-center font-mono-telemetry font-bold text-white">
                          +
                        </div>
                        <div className="font-display font-black text-xl text-white">115</div>
                        <div className="text-[10px] text-slate-300">Score at least 50 pts</div>
                        <div className="w-8 h-1 rounded-full bg-fuchsia-500 mt-1" />
                      </button>
                    </div>
                  </div>

                  {/* Development Catalysts (Aero Drag · Battery · Weight Reduction) */}
                  <div className="lg:col-span-7 rounded-xl border border-red-500/35 bg-black/45 p-3 flex flex-col gap-2">
                    <div className="text-[11px] font-display font-bold uppercase tracking-wider text-slate-200 text-center border-b border-white/10 pb-1.5">
                      DEVELOPMENT CATALYSTS (CATALIZZATORI DI SVILUPPO)
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-2.5 flex flex-col items-center text-center gap-1">
                        <Wind className="w-7 h-7 text-sky-400" />
                        <div className="font-display font-bold text-xs text-white uppercase">
                          AERO DRAG
                        </div>
                        <div className="text-[10px] text-slate-300 leading-tight">
                          Activate DRS in all zones during practice laps
                        </div>
                      </div>

                      <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-2.5 flex flex-col items-center text-center gap-1">
                        <BatteryCharging className="w-7 h-7 text-amber-400" />
                        <div className="font-display font-bold text-xs text-white uppercase">
                          BATTERY ERS
                        </div>
                        <div className="text-[10px] text-slate-300 leading-tight">
                          Complete a full sector without lockups or off-tracks
                        </div>
                      </div>

                      <div className="rounded-xl border border-lime-400/30 bg-lime-500/10 p-2.5 flex flex-col items-center text-center gap-1">
                        <Feather className="w-7 h-7 text-lime-400" />
                        <div className="font-display font-bold text-xs text-white uppercase">
                          WEIGHT REDUCTION
                        </div>
                        <div className="text-[10px] text-slate-300 leading-tight">
                          Stay within 2.0m of the optimal 3D racing line for 1 lap
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Session Weather & Telemetry Bar (from Screenshot 2: Track 32°C · Air 22°C · Resource Points 296/862) */}
                <div className="rounded-xl border border-white/12 bg-black/60 px-3.5 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-red-400" />
                    <div>
                      <div className="text-[9px] text-slate-400 uppercase">Free Practice 1</div>
                      <div className="font-display font-bold text-white">
                        ALBERT PARK / GRAND PRIX CIRCUIT
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono-telemetry">
                    <div>
                      <span className="text-slate-400">Track:</span>{' '}
                      <span className="text-amber-300 font-bold">32°C</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Air:</span>{' '}
                      <span className="text-white font-bold">22°C</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Resource Pts:</span>{' '}
                      <span className="text-cyan-300 font-bold">{resourcePoints}/862</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Track Status:</span>{' '}
                      <span className="text-emerald-400 font-bold">CLEAR 0/22</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
