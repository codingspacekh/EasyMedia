// AN6: gradients with more than two colours and a radial gradient's centre (9626/04 M/J/20 the
// red–yellow–green meter scale, M/J/21 a dark–light–dark panel, M/J/18 the bloom). The first and
// last colours stay `from` and `to`, so a two-colour gradient is saved as it always was.
import { interpolate } from './tween.ts';
import type { GradientStop, Paint } from './types.ts';

type Gradient = Extract<Paint, { kind: 'linear' | 'radial' }>;

/** Every colour of a gradient along it (0–1): from, the colours between in order, to. */
export function colourStops(paint: Gradient): { offset: number; colour: string }[] {
  const between = [...(paint.stops ?? [])]
    .sort((a, b) => a.at - b.at)
    .map((s) => ({ offset: Math.max(0, Math.min(100, s.at)) / 100, colour: s.colour }));
  return [{ offset: 0, colour: paint.from }, ...between, { offset: 1, colour: paint.to }];
}

/** A radial gradient's centre, in % of the box: the middle unless it was moved. */
export const radialCentre = (paint: Extract<Paint, { kind: 'radial' }>) => ({
  x: paint.cx ?? 50,
  y: paint.cy ?? 50,
});

const withStops = <T extends Gradient>(paint: T, stops: GradientStop[]): T => {
  const rest = { ...paint };
  delete rest.stops;
  return stops.length ? { ...rest, stops } : rest;
};

/**
 * *Add a colour*: a new colour in the middle of the widest gap between two colours, mixed from
 * them (so the gradient looks the same until it is changed). The colours are kept in order.
 */
export function addStop<T extends Gradient>(paint: T): T {
  const all = colourStops(paint);
  let widest = 0;
  for (let i = 1; i < all.length - 1; i++)
    if (all[i + 1]!.offset - all[i]!.offset > all[widest + 1]!.offset - all[widest]!.offset)
      widest = i;
  const [a, b] = [all[widest]!, all[widest + 1]!];
  const at = Math.round(((a.offset + b.offset) / 2) * 1000) / 10;
  const colour = String(interpolate(a.colour, b.colour, 0.5));
  const stops = [...(paint.stops ?? []), { at, colour }].sort((p, q) => p.at - q.at);
  return withStops(paint, stops);
}

/** Takes the colour between at `index` off; with none left the gradient has its two colours. */
export const removeStop = <T extends Gradient>(paint: T, index: number): T =>
  withStops(
    paint,
    (paint.stops ?? []).filter((_, i) => i !== index),
  );

/** Changes the colour between at `index` (its colour or where it is). */
export const changeStop = <T extends Gradient>(
  paint: T,
  index: number,
  change: Partial<GradientStop>,
): T =>
  withStops(
    paint,
    (paint.stops ?? []).map((s, i) => (i === index ? { ...s, ...change } : s)),
  );
