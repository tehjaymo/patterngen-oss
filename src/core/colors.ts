import type { ColorPair } from '../types';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
}

function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Generate bg/fg color pairs from a single primary color.
 * Produces 3 pairs: the color as bg with a contrasting fg,
 * a darkened version as bg, and an inverted pairing.
 */
export function getPairsForColor(primary: string): ColorPair[] {
  const [r, g, b] = hexToRgb(primary);
  const lum = luminance(r, g, b);

  const darkR = mix(r, 0, 0.45);
  const darkG = mix(g, 0, 0.45);
  const darkB = mix(b, 0, 0.45);
  const dark = rgbToHex(darkR, darkG, darkB);

  const lightR = mix(r, 255, 0.35);
  const lightG = mix(g, 255, 0.35);
  const lightB = mix(b, 255, 0.35);
  const light = rgbToHex(lightR, lightG, lightB);

  if (lum > 0.5) {
    return [
      { bg: primary, fg: '#000000' },
      { bg: dark, fg: primary },
      { bg: primary, fg: dark },
    ];
  }
  return [
    { bg: primary, fg: '#FFFFFF' },
    { bg: light, fg: primary },
    { bg: primary, fg: light },
  ];
}

export function generatePalette(enabledColors: string[]): ColorPair[] {
  const pairs: ColorPair[] = [];
  for (const c of enabledColors) {
    pairs.push(...getPairsForColor(c));
  }
  return pairs;
}

export function generateSquareColor(enabledColors: string[], rand: () => number = Math.random): string {
  if (enabledColors.length === 0) return '#4a4a48';
  const pairs = generatePalette(enabledColors);
  if (pairs.length === 0) return '#4a4a48';
  return pairs[Math.floor(rand() * pairs.length)].bg;
}

export function generateDotColor(enabledColors: string[], rand: () => number = Math.random): string {
  if (enabledColors.length === 0) return '#555555';
  const pairs = generatePalette(enabledColors);
  if (pairs.length === 0) return '#555555';
  const pair = pairs[Math.floor(rand() * pairs.length)];
  return pair.fg === '#000000' ? pair.bg : pair.fg;
}

export function generateLetterColor(enabledColors: string[], rand: () => number = Math.random): string {
  return generateDotColor(enabledColors, rand);
}
