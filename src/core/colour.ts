// Colours as people type them (#F4C8EE, f4c8ee, #abc) and as the colour picker moves them: hue
// (0–360°), saturation and brightness (0–1).

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

/** The colour as `#rrggbb` in small letters, or null when it is not a hex colour. */
export function normaliseHex(text: string): string | null {
  const raw = text.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(raw)) return `#${[...raw].map((c) => c + c).join('')}`;
  return /^[0-9a-f]{6}$/.test(raw) ? `#${raw}` : null;
}

export function hexToHsv(hex: string): Hsv {
  const n = parseInt((normaliseHex(hex) ?? '#000000').slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${[f(5), f(3), f(1)]
    .map((c) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

// ---- G7, G9 (M18): the same colour in RGB, HSL and CMYK (syllabus 19.1 colour systems) ----

export interface Rgb {
  /** 0–255 each. */
  r: number;
  g: number;
  b: number;
}

/** Hue 0–360°, saturation and lightness 0–100 %. */
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** Cyan, magenta, yellow and black (key), 0–100 % of each ink. */
export interface Cmyk {
  c: number;
  m: number;
  y: number;
  k: number;
}

const byte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const percent = (n: number) => Math.max(0, Math.min(100, n));

export function hexToRgb(hex: string): Rgb {
  const n = parseInt((normaliseHex(hex) ?? '#000000').slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((c) => byte(c).toString(16).padStart(2, '0')).join('')}`;
}

/** HSL as the coursebook gives it (Figure 18.23: hue 100, 50 % saturation, 50 % lightness). */
export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return {
    h: Math.round(hexToHsv(hex).h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const ss = percent(s) / 100;
  const ll = percent(l) / 100;
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r, g, b] =
    hh < 1
      ? [c, x, 0]
      : hh < 2
        ? [x, c, 0]
        : hh < 3
          ? [0, c, x]
          : hh < 4
            ? [0, x, c]
            : hh < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = ll - c / 2;
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

/**
 * CMYK as a printer mixes inks for the colour (the simple conversion, with no printer's colour
 * profile: real presses differ a little, which is what colour management is for).
 */
export function hexToCmyk(hex: string): Cmyk {
  const { r, g, b } = hexToRgb(hex);
  const k = 1 - Math.max(r, g, b) / 255;
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  const ink = (v: number) => Math.round(((1 - v / 255 - k) / (1 - k)) * 100);
  return { c: ink(r), m: ink(g), y: ink(b), k: Math.round(k * 100) };
}

export function cmykToHex({ c, m, y, k }: Cmyk): string {
  const kk = 1 - percent(k) / 100;
  const v = (ink: number) => 255 * (1 - percent(ink) / 100) * kk;
  return rgbToHex({ r: v(c), g: v(m), b: v(y) });
}
