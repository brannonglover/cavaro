const DEFAULT_PALETTE = {
  dark: '#1A120C',
  mid: '#3D2A1A',
  light: '#6B4A2E',
  accent: '#8F7440',
};

const WRAPPER_PALETTES = [
  {
    match: /connecticut|shade|claro|ecuador.*connecticut/i,
    palette: { dark: '#1C1810', mid: '#4A3D28', light: '#C4A574', accent: '#D4BC8A' },
  },
  {
    match: /maduro|oscuro|broadleaf/i,
    palette: { dark: '#0F0A08', mid: '#2A1810', light: '#4A2C1A', accent: '#6B3D22' },
  },
  {
    match: /habano|corojo|rosado|rosado/i,
    palette: { dark: '#1A0E0A', mid: '#4A2418', light: '#8B4A32', accent: '#A85C3C' },
  },
  {
    match: /cameroon/i,
    palette: { dark: '#18120C', mid: '#3D2E1C', light: '#7A5A38', accent: '#9A7048' },
  },
  {
    match: /sumatra|indonesia/i,
    palette: { dark: '#14100C', mid: '#352818', light: '#6B5030', accent: '#8A6840' },
  },
  {
    match: /mexican|san andr[eé]s/i,
    palette: { dark: '#120C08', mid: '#3A2218', light: '#5C3828', accent: '#7A4A35' },
  },
  {
    match: /nicaragua/i,
    palette: { dark: '#141008', mid: '#3A2818', light: '#6A4830', accent: '#8A6040' },
  },
  {
    match: /ecuador/i,
    palette: { dark: '#1A1610', mid: '#3D3424', light: '#B8A078', accent: '#C8B088' },
  },
  {
    match: /candela|double claro/i,
    palette: { dark: '#141810', mid: '#2A3820', light: '#5A7048', accent: '#7A9060' },
  },
];

/**
 * Returns a warm gradient palette derived from wrapper leaf type.
 */
export function getWrapperPalette(wrapper) {
  const value = wrapper?.trim();
  if (!value) return DEFAULT_PALETTE;

  for (const entry of WRAPPER_PALETTES) {
    if (entry.match.test(value)) {
      return entry.palette;
    }
  }

  return DEFAULT_PALETTE;
}
