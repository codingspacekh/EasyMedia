// AN5: Trace bitmap turns a picture into many small shapes (1676 for the map of 9626/04 M/J/21).
// *Select same fill* (or outline) finds every object coloured as the selected one, so all the
// parts of one colour can be recoloured, grouped, moved or deleted together.
import { colourStops, radialCentre } from './gradient.ts';
import type { AnimObject, Paint } from './types.ts';

/** Which colour to match: the inside, or the outline's colour. */
export type ColourPart = 'fill' | 'outline';

const sameHex = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** The same paint: no fill, one colour, or the same gradient (colours in any case). */
export function samePaint(a: Paint, b: Paint): boolean {
  if (a.kind === 'none' || b.kind === 'none') return a.kind === b.kind;
  if (a.kind === 'solid' || b.kind === 'solid')
    return a.kind === 'solid' && b.kind === 'solid' && sameHex(a.colour, b.colour);
  if (a.kind !== b.kind || !sameHex(a.from, b.from) || !sameHex(a.to, b.to)) return false;
  // AN6: the colours between too, and a radial gradient's centre.
  const [p, q] = [colourStops(a), colourStops(b)];
  if (
    p.length !== q.length ||
    p.some((s, i) => s.offset !== q[i]!.offset || !sameHex(s.colour, q[i]!.colour))
  )
    return false;
  if (a.kind === 'radial' && b.kind === 'radial') {
    const [c, d] = [radialCentre(a), radialCentre(b)];
    return c.x === d.x && c.y === d.y;
  }
  return b.kind === 'linear' && a.kind === 'linear' && a.angle === b.angle;
}

/** A picture or a group has no colour of its own (its pixels or its parts have). */
const coloured = (o: AnimObject): boolean => o.kind !== 'picture' && o.kind !== 'group';

/** The outline's colour, or null when nothing is drawn round it. */
const outlineOf = (o: AnimObject): string | null =>
  o.stroke && o.stroke.width > 0 ? o.stroke.colour : null;

/**
 * The objects, in their order, coloured as `like`: the same fill, or the same outline colour (any
 * width or dash). Give them as they are at the playhead. Empty when `like` has no such colour.
 */
export function sameColour(
  objects: readonly AnimObject[],
  like: AnimObject,
  part: ColourPart,
): AnimObject[] {
  if (!coloured(like)) return [];
  if (part === 'fill') return objects.filter((o) => coloured(o) && samePaint(o.fill, like.fill));
  const colour = outlineOf(like);
  if (colour === null) return [];
  return objects.filter((o) => {
    const other = coloured(o) ? outlineOf(o) : null;
    return other !== null && sameHex(other, colour);
  });
}
