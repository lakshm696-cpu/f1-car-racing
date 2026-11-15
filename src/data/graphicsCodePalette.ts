import { GraphicsColorCodeMode } from '../types/racing';

export interface GraphicsCodeEntry {
  id: string;
  index: number;
  name: string;
  hex: string;
  alpha: number;
  role: string;
  cssVar: string;
  rgb01: [number, number, number];
}

export function hexToRgb01(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '').trim();
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return [1, 1, 1];
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

export function hexWithAlphaToRgba(hex: string, alpha = 1): string {
  const [r, g, b] = hexToRgb01(hex);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

const RAW_GRAPHICS_CODE_ROWS: Array<{
  id: string;
  name: string;
  hex: string;
  alpha: number;
  role: string;
}> = [
  { id: 'gfx_code_01', name: 'Titanium Mist', hex: '#d8d9db', alpha: 1, role: 'Highlight Key' },
  { id: 'gfx_code_02', name: 'Asphalt Slate', hex: '#666563', alpha: 1, role: 'Track Midtone' },
  { id: 'gfx_code_03', name: 'Carbon Gunmetal', hex: '#2a2d36', alpha: 1, role: 'Chassis Core' },
  { id: 'gfx_code_04', name: 'Moss Olive', hex: '#5b602a', alpha: 1, role: 'Circuit Foliage' },
  { id: 'gfx_code_05', name: 'Brushed Alloy', hex: '#a6a5aa', alpha: 1, role: 'Metallic Specular' },
  { id: 'gfx_code_06', name: 'Pit Carbon', hex: '#101113', alpha: 1, role: 'Deep Shadow' },
  { id: 'gfx_code_07', name: 'Twilight Plum', hex: '#2d1934', alpha: 1, role: 'Dusk Shadow' },
  { id: 'gfx_code_08', name: 'Desert Brass', hex: '#b2b05d', alpha: 1, role: 'Warm Sun Accent' },
  { id: 'gfx_code_09', name: 'Kerb Crimson', hex: '#bb5649', alpha: 1, role: 'Heat & Kerb Red' },
  { id: 'gfx_code_10', name: 'Neon Violet', hex: '#a661ee', alpha: 1, role: 'ERS / DRS Glow' },
  { id: 'gfx_code_11', name: 'Telemetry Cyan', hex: '#2596be', alpha: 1, role: 'Aero Cool Rim' },
  { id: 'gfx_code_12', name: 'Aero Cyan Dual', hex: '#2596be', alpha: 1, role: 'HUD Telemetry' },
];

export const GRAPHICS_CODE_ENTRIES: GraphicsCodeEntry[] = RAW_GRAPHICS_CODE_ROWS.map((row, idx) => ({
  id: row.id,
  index: idx + 1,
  name: row.name,
  hex: row.hex,
  alpha: row.alpha,
  role: row.role,
  cssVar: `--gfx-code-${String(idx + 1).padStart(2, '0')}`,
  rgb01: hexToRgb01(row.hex),
}));

export const GRAPHICS_CODE_CSV = [
  'name,hex,alpha',
  ...GRAPHICS_CODE_ENTRIES.map((e) => `,${e.hex},${e.alpha}`),
].join('\n');

export const GRAPHICS_CODE_NAMED_CSV = [
  'name,hex,alpha',
  ...GRAPHICS_CODE_ENTRIES.map((e) => `${e.name},${e.hex},${e.alpha}`),
].join('\n');

export interface GraphicsColorGradingProfile {
  id: GraphicsColorCodeMode;
  label: string;
  description: string;
  shadowTint: [number, number, number];
  midtoneTint: [number, number, number];
  highlightTint: [number, number, number];
  accentWarm: [number, number, number];
  accentCool: [number, number, number];
  defaultMix: number;
}

export const GRAPHICS_COLOR_CODE_PROFILES: Record<GraphicsColorCodeMode, GraphicsColorGradingProfile> = {
  standard: {
    id: 'standard',
    label: 'Standard ACES',
    description: 'Neutral ACES Filmic tone mapping without palette tinting',
    shadowTint: [1, 1, 1],
    midtoneTint: [1, 1, 1],
    highlightTint: [1, 1, 1],
    accentWarm: [1, 1, 1],
    accentCool: [1, 1, 1],
    defaultMix: 0,
  },
  palette_lut: {
    id: 'palette_lut',
    label: 'Code LUT (12-Hex)',
    description: 'Full 12-color Graphics Code LUT (#d8d9db · #2a2d36 · #2d1934 · #b2b05d · #bb5649 · #a661ee · #2596be)',
    shadowTint: hexToRgb01('#2d1934'),
    midtoneTint: hexToRgb01('#666563'),
    highlightTint: hexToRgb01('#d8d9db'),
    accentWarm: hexToRgb01('#b2b05d'),
    accentCool: hexToRgb01('#2596be'),
    defaultMix: 0.42,
  },
  twilight_neon: {
    id: 'twilight_neon',
    label: 'Twilight & Neon',
    description: 'Emphasizes Dusk Plum (#2d1934), Neon Violet (#a661ee), Kerb Crimson (#bb5649) & Telemetry Cyan (#2596be)',
    shadowTint: hexToRgb01('#2d1934'),
    midtoneTint: hexToRgb01('#2a2d36'),
    highlightTint: hexToRgb01('#a6a5aa'),
    accentWarm: hexToRgb01('#bb5649'),
    accentCool: hexToRgb01('#a661ee'),
    defaultMix: 0.58,
  },
  carbon_cinema: {
    id: 'carbon_cinema',
    label: 'Carbon Cinema',
    description: 'Deep Pit Carbon (#101113), Gunmetal (#2a2d36), Olive (#5b602a) & Titanium Mist (#d8d9db)',
    shadowTint: hexToRgb01('#101113'),
    midtoneTint: hexToRgb01('#5b602a'),
    highlightTint: hexToRgb01('#d8d9db'),
    accentWarm: hexToRgb01('#b2b05d'),
    accentCool: hexToRgb01('#2596be'),
    defaultMix: 0.5,
  },
};
