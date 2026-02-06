/**
 * Heatmap Color Utilities
 * Maps percentage change to a color gradient:
 * Deep red (-10% or worse) → Red → Orange → Gray (0%) → Light green → Green → Deep green (+10% or better)
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

// Color stops for the heatmap gradient
const COLOR_STOPS: { pct: number; color: RGB }[] = [
  { pct: -10, color: { r: 153, g: 27, b: 27 } },   // deep red
  { pct: -5, color: { r: 220, g: 38, b: 38 } },     // red
  { pct: -2, color: { r: 239, g: 68, b: 68 } },     // light red
  { pct: -0.5, color: { r: 180, g: 83, b: 60 } },   // dark orange
  { pct: 0, color: { r: 75, g: 85, b: 99 } },       // gray
  { pct: 0.5, color: { r: 60, g: 130, b: 80 } },    // dark green
  { pct: 2, color: { r: 34, g: 197, b: 94 } },      // light green
  { pct: 5, color: { r: 22, g: 163, b: 74 } },      // green
  { pct: 10, color: { r: 20, g: 120, b: 50 } },     // deep green
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateColor(c1: RGB, c2: RGB, t: number): RGB {
  return {
    r: Math.round(lerp(c1.r, c2.r, t)),
    g: Math.round(lerp(c1.g, c2.g, t)),
    b: Math.round(lerp(c1.b, c2.b, t)),
  };
}

/**
 * Get background color for a percentage change value
 */
export function getHeatmapColor(change: number): string {
  // Clamp to range
  const clamped = Math.max(-10, Math.min(10, change));

  // Find the two stops to interpolate between
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const low = COLOR_STOPS[i];
    const high = COLOR_STOPS[i + 1];

    if (clamped >= low.pct && clamped <= high.pct) {
      const t = (clamped - low.pct) / (high.pct - low.pct);
      const c = interpolateColor(low.color, high.color, t);
      return `rgb(${c.r}, ${c.g}, ${c.b})`;
    }
  }

  // Edge cases
  if (clamped <= COLOR_STOPS[0].pct) {
    const c = COLOR_STOPS[0].color;
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  }
  const c = COLOR_STOPS[COLOR_STOPS.length - 1].color;
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

/**
 * Get text color (white or black) for best contrast against background
 */
export function getHeatmapTextColor(change: number): string {
  const bg = getHeatmapColor(change);
  const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return '#ffffff';

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);

  // Relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#111827' : '#ffffff';
}

/**
 * Format percentage for display
 */
export function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

/**
 * Get the color legend stops for display
 */
export function getColorLegendStops(): { label: string; color: string }[] {
  return [
    { label: '-10%', color: getHeatmapColor(-10) },
    { label: '-5%', color: getHeatmapColor(-5) },
    { label: '0%', color: getHeatmapColor(0) },
    { label: '+5%', color: getHeatmapColor(5) },
    { label: '+10%', color: getHeatmapColor(10) },
  ];
}
