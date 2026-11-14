import React, { useState } from 'react';
import { ArrowLeft, Award, Check, GraduationCap, Play, TrendingUp, Trophy, Users } from 'lucide-react';
import { DRIVER_ACADEMIES, FORMULA_DRIVERS, FORMULA_TEAMS } from '../data/racingData';
import { CareerProgress, DriverProfile } from '../types/racing';
import { DriverPortrait } from './DriverPortrait';

interface DriverSelectionOverlayProps {
  selectedDriver: DriverProfile;
  career: CareerProgress;
  onSelectDriver: (driver: DriverProfile) => void;
  onSelectAcademy?: (academyId: string) => void;
  onBack: () => void;
  onConfirmAndGarage: () => void;
  onStartRace: () => void;
}

type DriverPanelTab = 'profile' | 'academy' | 'recognition' | 'contract';

const RECOGNITION_PERK_TIERS = [
  { pct: 35, label: '1 Secret Upgrade & 2 Simultaneous Upgrades per Dept' },
  { pct: 40, label: '1 Secret Upgrade & 3 Simultaneous Upgrades per Dept' },
  { pct: 45, label: '2 Secret Upgrades & 3 Simultaneous Upgrades per Dept' },
  { pct: 50, label: '2 Secret Upgrades & 4 Simultaneous Upgrades per Dept' },
  { pct: 55, label: '3 Secret Upgrades & 4 Simultaneous Upgrades per Dept' },
  { pct: 60, label: '3 Secret Upgrades & 5 Simultaneous Upgrades per Dept' },
  { pct: 65, label: '4 Secret Upgrades & 5 Simultaneous Upgrades per Dept' },
];

const CONTRACT_RTG_ROUNDS = [
  { code: 'AUS', target: 76, current: 78, retain: 71 },
  { code: 'CHN', target: 77, current: 81, retain: 71 },
  { code: 'JPN', target: 78, current: 84, retain: 72 },
  { code: 'BHR', target: 79, current: 83, retain: 72 },
  { code: 'SAU', target: 80, current: 86, retain: 73 },
  { code: 'MIA', target: 81, current: 88, retain: 73 },
  { code: 'IMO', target: 82, current: 90, retain: 74 },
  { code: 'MCO', target: 83, current: 92, retain: 74 },
];

export const DriverSelectionOverlay: React.FC<DriverSelectionOverlayProps> = ({
  selectedDriver,
  career,
  onSelectDriver,
  onSelectAcademy,
  onBack,
  onConfirmAndGarage,
  onStartRace,
}) => {
  const isSelectedRival = career.activeRivalId === selectedDriver.id;
  const rivalRecord = career.rivalryScores[selectedDriver.id];
  const [confirmedFlash, setConfirmedFlash] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<DriverPanelTab>('profile');
  const [localAcademyId, setLocalAcademyId] = useState<string>(
    career.selectedAcademyId ?? selectedDriver.academyId ?? 'sauber'
  );

  const team = FORMULA_TEAMS.find((t) => t.id === selectedDriver.teamId) ?? FORMULA_TEAMS[0];
  const teammate = FORMULA_DRIVERS.find(
    (d) => d.teamId === selectedDriver.teamId && d.id !== selectedDriver.id
  );
  const visibleDrivers =
    teamFilter === 'all'
      ? FORMULA_DRIVERS
      : FORMULA_DRIVERS.filter((d) => d.teamId === teamFilter);

  const activeAcademy =
    DRIVER_ACADEMIES.find((a) => a.id === localAcademyId) ?? DRIVER_ACADEMIES[7];
  const baseRecognition = selectedDriver.recognitionPct ?? 67;
  const academyBoost = activeAcademy.associatedTeams.includes(team.id)
    ? activeAcademy.recognitionBonus
    : Math.floor(activeAcademy.recognitionBonus / 2);
  const driverRecognitionPct = Math.min(92, Math.max(35, baseRecognition + (localAcademyId !== 'none' ? 0 : -4) + (academyBoost > 5 ? 0 : 0)));
  const teammateRecognitionPct = Math.max(8, 100 - driverRecognitionPct);

  const handleConfirm = (nextAction: () => void) => {
    setConfirmedFlash(true);
    setTimeout(() => {
      setConfirmedFlash(false);
      nextAction();
    }, 260);
  };

  const handleChooseAcademy = (id: string) => {
    setLocalAcademyId(id);
    if (onSelectAcademy) onSelectAcademy(id);
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
      {/* Subtle F1 25 Crimson Speed-Tunnel Top Glow */}
      <div
        className="fixed inset-x-0 top-0 h-44 pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(220, 38, 38, 0.36) 0%, rgba(153, 27, 27, 0.14) 52%, transparent 100%)',
        }}
      />

      {/* Top Bar — F1 25 Career & Driver Hub Navigation */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="pointer-events-auto rounded-xl border border-red-500/35 carbon-weave-bg px-4 py-2.5 flex flex-wrap items-center gap-3 shadow-xl">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-red-500" />
            <span>Menu</span>
          </button>
          <div className="w-px h-5 bg-white/15" />

          {/* Sub-Navigation Pills matching F1 25 Screenshots (Driver Profile, Choose Academy, Recognition 67%, Contract RTG) */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
            {(
              [
                { id: 'profile', label: 'DRIVER PROFILE', icon: Users },
                { id: 'academy', label: 'CHOOSE ACADEMY', icon: GraduationCap },
                { id: 'recognition', label: `RECOGNITION (${driverRecognitionPct}%)`, icon: Award },
                { id: 'contract', label: 'CONTRACT RTG GRAPH', icon: TrendingUp },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-display font-bold tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                    activeTab === t.id
                      ? 'bg-red-600 text-white shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => handleConfirm(onConfirmAndGarage)}
            className={`px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              confirmedFlash
                ? 'border-red-400 bg-red-600/25 text-white'
                : 'border-white/15 carbon-weave-bg text-white hover:border-red-500/60'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-red-500" />
              <span>Confirm &amp; Engineering</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleConfirm(onStartRace)}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-lg"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Race Now</span>
          </button>
        </div>
      </div>

      {/* Middle Area: Left Career Team Selector (SCUDERIA / KONNERSPORT / APXGP) + Right Dynamic F1 25 Panel */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 my-auto">
        {/* Left: F1 25 Career Configuration Quick Switcher (from Screenshot 4: SCUDERIA / KONNERSPORT / APXGP) */}
        <div
          className="pointer-events-auto rounded-2xl border border-red-500/35 p-4 flex flex-col gap-2.5 max-w-xs shadow-2xl"
          style={{
            background:
              'linear-gradient(145deg, rgba(24, 10, 14, 0.92) 0%, rgba(10, 12, 18, 0.94) 100%)',
          }}
        >
          <span className="self-start px-2.5 py-0.5 rounded bg-red-600 text-white font-display font-bold text-[10px] tracking-widest uppercase">
            CAREER CONFIGURATION
          </span>
          <div className="flex flex-col gap-1">
            {[
              {
                id: 'scuderia_grid',
                title: 'OFFICIAL F1® GRID',
                subtitle: '11 Official Constructors & 22 Drivers',
                teamFilterId: 'all',
              },
              {
                id: 'konnersport_f1',
                title: 'KONNERSPORT',
                subtitle: 'Butler Global · Aiden Jackson #89 & Callie Mayer #3',
                teamFilterId: 'konnersport_f1',
              },
              {
                id: 'apxgp_f1',
                title: 'APXGP',
                subtitle: 'Expensify F1® The Movie · Sonny Hayes #7 & Joshua Pearce #9',
                teamFilterId: 'apxgp_f1',
              },
            ].map((item) => {
              const isCurrent =
                (item.teamFilterId === 'all' &&
                  selectedDriver.teamId !== 'konnersport_f1' &&
                  selectedDriver.teamId !== 'apxgp_f1') ||
                selectedDriver.teamId === item.teamFilterId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTeamFilter(item.teamFilterId);
                    if (item.teamFilterId !== 'all') {
                      const firstDrv = FORMULA_DRIVERS.find((d) => d.teamId === item.teamFilterId);
                      if (firstDrv) onSelectDriver(firstDrv);
                    }
                  }}
                  className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                    isCurrent
                      ? 'border-white bg-white/12 text-white shadow-md'
                      : 'border-white/10 bg-black/35 text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="font-display font-black text-sm tracking-wide">{item.title}</div>
                  <div className="text-[10px] text-slate-300 mt-0.5">{item.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Tabbed Panel (Profile | Choose Academy | Recognition 67% | Contract RTG Graph) */}
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-red-500/35 carbon-weave-bg p-4 flex flex-col gap-3 shadow-2xl">
          {activeTab === 'profile' && (
            <>
              <div className="flex items-center gap-3.5 border-b border-white/10 pb-2.5">
                <DriverPortrait driver={selectedDriver} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="font-display font-bold text-lg text-white leading-tight truncate">
                        {selectedDriver.name}
                      </h2>
                      {isSelectedRival && (
                        <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-display font-bold text-[10px] tracking-wider shrink-0">
                          RIVAL
                        </span>
                      )}
                    </div>
                    <span className="font-mono-telemetry text-sm font-bold text-red-500 tabular-nums shrink-0">
                      #{selectedDriver.number}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0 border border-white/25"
                      style={{ backgroundColor: team.primaryColor }}
                    />
                    <span className="font-semibold text-white truncate">{team.name}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span>{selectedDriver.nationality}</span>
                  </div>
                  {teammate && (
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      Teammate: <span className="text-slate-200 font-medium">{teammate.name} (#{teammate.number})</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                {(
                  [
                    { label: 'Speed', val: selectedDriver.stats.speed, color: '#EF4444' },
                    { label: 'Cornering', val: selectedDriver.stats.cornering, color: '#F87171' },
                    { label: 'Braking', val: selectedDriver.stats.braking, color: '#38BDF8' },
                    { label: 'Overtaking', val: selectedDriver.stats.overtaking, color: '#F59E0B' },
                    { label: 'Consistency', val: selectedDriver.stats.consistency, color: '#10B981' },
                  ] as const
                ).map((st) => (
                  <div key={st.label} className="flex items-center gap-2.5 text-xs">
                    <span className="w-24 text-slate-300 font-medium">{st.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${st.val}%`, backgroundColor: st.color }}
                      />
                    </div>
                    <span className="font-mono-telemetry w-7 text-right font-bold text-white tabular-nums">
                      {st.val}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-white/10">
                <div className="rounded-lg bg-black/35 border border-white/8 px-2.5 py-1.5 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-red-500 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold">Titles</div>
                    <div className="font-display font-bold text-xs text-white tabular-nums">
                      {selectedDriver.championshipWins}x WDC
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-black/35 border border-white/8 px-2.5 py-1.5 flex items-center gap-2">
                  <Award className="w-4 h-4 text-red-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold">Victories</div>
                    <div className="font-display font-bold text-xs text-white tabular-nums">
                      {selectedDriver.careerVictories} Wins
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('recognition')}
                  className="rounded-lg bg-emerald-500/15 border border-emerald-400/40 px-2.5 py-1.5 text-left cursor-pointer hover:bg-emerald-500/25"
                >
                  <div className="text-[10px] text-emerald-300 font-semibold">Recognition</div>
                  <div className="font-mono-telemetry font-bold text-xs text-white">
                    {driverRecognitionPct}% · {activeAcademy.shortLabel}
                  </div>
                </button>
              </div>

              <div className="text-[11px] text-slate-300 leading-relaxed border-t border-white/10 pt-1.5">
                {selectedDriver.achievements.join(' · ')}
              </div>
              {isSelectedRival && rivalRecord && (
                <div className="rounded-lg bg-red-600/15 border border-red-500/40 px-3 py-1.5 flex items-center justify-between text-xs">
                  <span className="font-display font-bold text-red-300 tracking-wide">ACTIVE RIVALRY</span>
                  <span className="font-mono-telemetry text-white font-semibold tabular-nums">
                    You {rivalRecord.playerAheadCount} – {rivalRecord.rivalAheadCount} Rival
                  </span>
                </div>
              )}
            </>
          )}

          {/* TAB 2: CHOOSE ACADEMY (from Screenshot 3: Sauber / Mercedes / Ferrari / Red Bull / Alpine / McLaren / Williams) */}
          {activeTab === 'academy' && (
            <div className="flex flex-col gap-3">
              <div>
                <span className="px-2 py-0.5 rounded bg-red-600 text-white font-display font-bold text-[10px] tracking-widest uppercase">
                  CHOOSE ACADEMY
                </span>
                <h3 className="font-display font-black text-xl text-white mt-1.5 tracking-wide">
                  {activeAcademy.name}
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {activeAcademy.description}
                </p>
              </div>

              {/* 8 Academy Selector Boxes matching Screenshot 3 */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {DRIVER_ACADEMIES.map((acad) => {
                  const selected = acad.id === localAcademyId;
                  return (
                    <button
                      key={acad.id}
                      type="button"
                      onClick={() => handleChooseAcademy(acad.id)}
                      className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        selected
                          ? 'border-white bg-white/15 scale-[1.03] shadow-lg'
                          : 'border-white/12 bg-black/45 hover:border-white/35'
                      }`}
                    >
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center font-display font-black text-xs border border-white/25"
                        style={{
                          backgroundColor: acad.primaryColor,
                          color: acad.id === 'sauber' ? '#090B0F' : '#FFFFFF',
                        }}
                      >
                        {acad.badgeText}
                      </span>
                      <span className="text-[10px] font-semibold text-white truncate max-w-full px-1">
                        {acad.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-2.5 flex items-center justify-between text-xs">
                <span className="text-slate-200 font-medium">Academy Recognition Bonus</span>
                <span className="font-mono-telemetry font-bold text-emerald-300">
                  +{activeAcademy.recognitionBonus}% R&amp;D Say
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: RECOGNITION COMPARISON & 7-TIER R&D PERKS (from Screenshot 15: RECOGNITION 67%) */}
          {activeTab === 'recognition' && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div>
                  <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                    TEAM STANDING &amp; R&amp;D INFLUENCE
                  </div>
                  <h3 className="font-display font-black text-lg text-white">
                    RECOGNITION: <span className="text-emerald-400">{driverRecognitionPct}%</span>
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-mono-telemetry font-bold text-emerald-300">
                  +2% Trend
                </span>
              </div>

              {/* Driver vs Teammate Split Bar */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-emerald-300">
                    {selectedDriver.name} ({driverRecognitionPct}%)
                  </span>
                  <span className="text-purple-300">
                    {teammate ? `${teammate.name} (${teammateRecognitionPct}%)` : `Teammate (${teammateRecognitionPct}%)`}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-purple-900/60 overflow-hidden flex border border-white/15">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${driverRecognitionPct}%` }}
                  />
                </div>
              </div>

              {/* 7-Tier R&D Perks Checklist (35% to 65%) from Screenshot 15 */}
              <div className="flex flex-col gap-1 max-h-[190px] overflow-y-auto pr-1">
                {RECOGNITION_PERK_TIERS.map((tier) => {
                  const unlocked = driverRecognitionPct >= tier.pct;
                  return (
                    <div
                      key={tier.pct}
                      className={`rounded-lg border px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px] ${
                        unlocked
                          ? 'border-emerald-500/40 bg-emerald-500/12 text-white'
                          : 'border-white/10 bg-black/35 text-slate-400'
                      }`}
                    >
                      <span className="truncate">{tier.label}</span>
                      <span
                        className={`font-mono-telemetry font-bold shrink-0 ${
                          unlocked ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {tier.pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: CONTRACT PERFORMANCE RTG GRAPH (from Screenshot 19: Target / Current / Retain Seat across AUS..MCO) */}
          {activeTab === 'contract' && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div>
                  <div className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">
                    DRIVER DETAILS &amp; CONTRACTS
                  </div>
                  <h3 className="font-display font-black text-base text-white">
                    CONTRACT PERFORMANCE (RTG)
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="flex items-center gap-1 text-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> Current
                  </span>
                  <span className="flex items-center gap-1 text-purple-300">
                    <span className="w-2 h-2 rounded-full bg-purple-400" /> Target
                  </span>
                </div>
              </div>

              {/* SVG Line Graph plotting Target, Current, and Retain Seat across AUS..MCO */}
              <div className="rounded-xl border border-white/12 bg-black/45 p-2.5">
                <svg viewBox="0 0 320 120" className="w-full h-28 overflow-visible">
                  {/* Horizontal Reference Lines */}
                  <line x1="20" y1="20" x2="305" y2="20" stroke="rgba(255,255,255,0.08)" />
                  <line x1="20" y1="55" x2="305" y2="55" stroke="rgba(255,255,255,0.08)" />
                  <line x1="20" y1="88" x2="305" y2="88" stroke="rgba(239,68,68,0.45)" strokeDasharray="3 3" />

                  {/* Retain Seat Floor Polyline */}
                  <polyline
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                    points={CONTRACT_RTG_ROUNDS.map((r, i) => `${28 + i * 39},${105 - (r.retain - 65) * 2.5}`).join(' ')}
                  />
                  {/* Target Polyline */}
                  <polyline
                    fill="none"
                    stroke="#A855F7"
                    strokeWidth="2"
                    points={CONTRACT_RTG_ROUNDS.map((r, i) => `${28 + i * 39},${105 - (r.target - 65) * 2.5}`).join(' ')}
                  />
                  {/* Current Driver RTG Polyline */}
                  <polyline
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    points={CONTRACT_RTG_ROUNDS.map((r, i) => `${28 + i * 39},${105 - (r.current - 65) * 2.5}`).join(' ')}
                  />

                  {/* Round Labels */}
                  {CONTRACT_RTG_ROUNDS.map((r, i) => {
                    const x = 28 + i * 39;
                    const cy = 105 - (r.current - 65) * 2.5;
                    return (
                      <g key={r.code}>
                        <circle cx={x} cy={cy} r="3" fill="#10B981" />
                        <text
                          x={x}
                          y="116"
                          textAnchor="middle"
                          fill="#94A3B8"
                          fontSize="8"
                          fontFamily="monospace"
                        >
                          {r.code}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-lg bg-black/40 border border-white/10 p-1.5">
                  <div className="text-[9px] text-slate-400">CURRENT RTG</div>
                  <div className="font-mono-telemetry font-bold text-emerald-400">92 OVR</div>
                </div>
                <div className="rounded-lg bg-black/40 border border-white/10 p-1.5">
                  <div className="text-[9px] text-slate-400">TARGET RTG</div>
                  <div className="font-mono-telemetry font-bold text-purple-300">83 OVR</div>
                </div>
                <div className="rounded-lg bg-black/40 border border-white/10 p-1.5">
                  <div className="text-[9px] text-slate-400">SEAT STATUS</div>
                  <div className="font-display font-bold text-amber-300">#1 LEAD</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Constructor Filter + Complete Driver Grid Selector */}
      <div className="flex justify-center">
        <div className="pointer-events-auto w-full max-w-[1380px] rounded-2xl border border-red-500/25 carbon-weave-bg p-2.5 flex flex-col gap-2 shadow-2xl">
          {/* Constructor Filter Strip */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setTeamFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                teamFilter === 'all'
                  ? 'bg-red-600 text-white'
                  : 'bg-white/5 text-slate-300 hover:text-white'
              }`}
            >
              All Drivers ({FORMULA_DRIVERS.length})
            </button>
            {FORMULA_TEAMS.map((t) => {
              const active = teamFilter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTeamFilter(t.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 border transition-colors ${
                    active
                      ? 'border-red-400 bg-white/15 text-white'
                      : 'border-white/10 bg-black/35 text-slate-300 hover:text-white'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-xs shrink-0"
                    style={{ backgroundColor: t.primaryColor }}
                  />
                  <span>
                    {t.name
                      .replace(' Formula 1 Team', '')
                      .replace(' F1 Team', '')
                      .replace('Scuderia ', '')
                      .replace('Oracle ', '')
                      .replace('Atlassian ', '')
                      .replace('MoneyGram ', '')
                      .replace('Visa Cash App ', '')
                      .replace('Stake ', '')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Driver Grid */}
          <div
            className={`grid gap-1.5 max-h-[164px] overflow-y-auto pr-0.5 ${
              teamFilter === 'all'
                ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9'
                : 'grid-cols-2 sm:grid-cols-3 max-w-2xl'
            }`}
          >
            {visibleDrivers.map((drv) => {
              const active = drv.id === selectedDriver.id;
              const drvTeam = FORMULA_TEAMS.find((t) => t.id === drv.teamId);
              return (
                <button
                  key={drv.id}
                  type="button"
                  onClick={() => onSelectDriver(drv)}
                  className={`p-1.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'border-red-500 bg-red-600/25'
                      : 'border-white/10 bg-black/40 hover:border-red-500/40 hover:bg-white/[0.06]'
                  }`}
                >
                  <DriverPortrait driver={drv} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-white truncate">
                        {teamFilter === 'all' ? drv.name.split(' ').pop() : drv.name}
                      </span>
                      {career.activeRivalId === drv.id && (
                        <span className="px-1 py-0.5 rounded bg-red-600 text-[7px] font-display font-bold text-white leading-none shrink-0">
                          R
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400 truncate flex items-center gap-1">
                      <span
                        className="w-1.5 h-1.5 rounded-xs shrink-0"
                        style={{ backgroundColor: drvTeam?.primaryColor ?? '#fff' }}
                      />
                      <span className="truncate">
                        #{drv.number} · {drv.code}
                      </span>
                    </div>
                    <div className="text-[9px] font-mono-telemetry font-bold text-red-400 tabular-nums">
                      OVR {Math.round((drv.stats.speed + drv.stats.cornering + drv.stats.braking) / 3)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
