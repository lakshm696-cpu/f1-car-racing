import React from 'react';
import { DriverProfile } from '../types/racing';

interface DriverPortraitProps {
  driver: DriverProfile;
  size?: 'sm' | 'lg';
}

export const DriverPortrait: React.FC<DriverPortraitProps> = ({ driver, size = 'lg' }) => {
  const dims = size === 'sm' ? 'w-11 h-11 rounded-lg' : 'w-16 h-16 rounded-xl';
  const gradId = `drv-grad-${driver.id}-${size}`;
  const visorId = `drv-visor-${driver.id}-${size}`;

  const skinColor = driver.skinTone ?? '#E8B89A';

  return (
    <div
      className={`${dims} relative overflow-hidden border border-red-500/40 bg-[#10131A] shrink-0 flex items-center justify-center`}
      aria-label={`${driver.name} portrait`}
    >
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#141821" />
            <stop offset="100%" stopColor="#090B10" />
          </linearGradient>
          <linearGradient id={visorId} x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0%" stopColor={driver.visorColor} />
            <stop offset="55%" stopColor="#0F172A" />
            <stop offset="100%" stopColor={driver.visorColor} />
          </linearGradient>
        </defs>

        {/* Carbon Portrait Backdrop + Team Rim Accent */}
        <rect width="64" height="64" fill={`url(#${gradId})`} />
        <path d="M0,0 L64,0 L64,3.5 L0,3.5 Z" fill={driver.suitPrimary} opacity="0.92" />
        <circle cx="32" cy="28" r="24" fill={driver.suitPrimary} opacity="0.18" />

        {/* Racing Suit Shoulders, Collar & Sponsor Epaulettes */}
        <path
          d="M 7,64 C 9,48 18,44 32,44 C 46,44 55,48 57,64 Z"
          fill={driver.suitPrimary}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
        />
        <path d="M 14,50 L 21,47" stroke={driver.suitSecondary} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M 50,50 L 43,47" stroke={driver.suitSecondary} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M 21,45 L 32,58 L 43,45" fill="none" stroke={driver.suitSecondary} strokeWidth="2.4" />
        {/* Chest Sponsor Badges */}
        <rect x="15" y="54" width="8" height="3.2" rx="0.8" fill="#F8FAFC" opacity="0.85" />
        <rect x="41" y="54" width="8" height="3.2" rx="0.8" fill={driver.suitSecondary} opacity="0.9" />
        <rect x="24" y="41.5" width="16" height="5" rx="2" fill="#0F172A" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />

        {/* Driver Helmet Shell */}
        <path
          d="M 17.5,30 C 17.5,15.5 23.5,10.5 32,10.5 C 40.5,10.5 46.5,15.5 46.5,29.5 C 46.5,37.5 41,42.5 32,42.5 C 23,42.5 17.5,37.5 17.5,30 Z"
          fill={driver.helmetColor}
          stroke="rgba(255,255,255,0.38)"
          strokeWidth="1.1"
        />
        {/* Helmet Crown Racing Stripe */}
        <path
          d="M 28.5,11 L 35.5,11 L 34.2,20.5 L 29.8,20.5 Z"
          fill={driver.suitPrimary}
        />

        {/* Fireproof Nomex Balaclava & Focused Driver Face Inside Visor Port */}
        <path
          d="M 20.5,24.5 C 24,22.2 40,22.2 43.5,24.5 L 42.5,31.5 C 37,33 27,33 21.5,31.5 Z"
          fill="#0B0E14"
        />
        {/* Driver Skin Visible in Balaclava Eye-Port Opening */}
        <rect x="22.8" y="24.2" width="18.4" height="6.4" rx="2.8" fill={skinColor} />
        {/* Subtle Nose Bridge Shadow */}
        <path d="M 31.2,24.5 L 32,29.8 L 32.8,24.5" fill="none" stroke="rgba(0,0,0,0.24)" strokeWidth="1.0" />
        {/* Focused Determined Eyebrows */}
        <path d="M 24.5,25.6 L 29.8,26.3" stroke="#1E1B18" strokeWidth="1.35" strokeLinecap="round" />
        <path d="M 39.5,25.6 L 34.2,26.3" stroke="#1E1B18" strokeWidth="1.35" strokeLinecap="round" />
        {/* Eyes (Sclera + Dark Focused Iris + Catchlight) */}
        <ellipse cx="27.2" cy="27.6" rx="2.1" ry="1.15" fill="#F8FAFC" />
        <ellipse cx="36.8" cy="27.6" rx="2.1" ry="1.15" fill="#F8FAFC" />
        <circle cx="27.3" cy="27.6" r="1.05" fill="#1C1917" />
        <circle cx="36.7" cy="27.6" r="1.05" fill="#1C1917" />
        <circle cx="26.9" cy="27.2" r="0.38" fill="#FFFFFF" />
        <circle cx="36.3" cy="27.2" r="0.38" fill="#FFFFFF" />

        {/* Visor Top Sponsor Banner Strip */}
        <path
          d="M 21,23.8 C 25,22 39,22 43,23.8 L 43.3,25.1 C 39,23.5 25,23.5 20.7,25.1 Z"
          fill={driver.suitSecondary}
          opacity="0.92"
        />

        {/* Semi-Transparent Tinted Iridescent Visor Overlay */}
        <path
          d="M 20.5,24.5 C 24,22 40,22 43.5,24.5 L 42.5,31.5 C 37,33 27,33 21.5,31.5 Z"
          fill={`url(#${visorId})`}
          fillOpacity="0.54"
          stroke="#090B0F"
          strokeWidth="1.15"
        />
        {/* Visor Specular Glint */}
        <path d="M 22.8,25.2 L 28.5,24.3 L 26.8,29.2 L 22.2,29.6 Z" fill="#FFFFFF" opacity="0.32" />

        {/* Chin Guard Aero Vent & Mic Port */}
        <rect x="27.5" y="35.2" width="9" height="2.6" rx="1.1" fill="#0F172A" />
        <line x1="29.5" y1="36.5" x2="34.5" y2="36.5" stroke={driver.suitSecondary} strokeWidth="0.9" />
      </svg>

      {/* Corner Driver Number + Code */}
      <span className="absolute bottom-0.5 right-1 font-mono-telemetry text-[9px] font-bold text-white/95 leading-none drop-shadow">
        #{driver.number}
      </span>
    </div>
  );
};
