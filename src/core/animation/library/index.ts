// AN19: the built-in library — every item, its categories, search, and placing an item on a
// stage: a picture in the middle (smaller if it would not fit), a background over the whole stage.
import { setSize } from '../geometry.ts';
import type { AnimObject, Stage } from '../types.ts';
import { BACKGROUNDS } from './backgrounds.ts';
import { buildItem, type Category, type LibraryItem } from './build.ts';
import { CARTOONS } from './cartoons.ts';
import { ICONS } from './icons.ts';

export { buildItem, type Category, type LibraryItem } from './build.ts';

export const LIBRARY_CATEGORIES: readonly { id: Category; label: string }[] = [
  { id: 'cartoons', label: 'Cartoons' },
  { id: 'icons', label: 'Icons & symbols' },
  { id: 'backgrounds', label: 'Backgrounds' },
];

export const LIBRARY: readonly LibraryItem[] = [...CARTOONS, ...ICONS, ...BACKGROUNDS];

export const itemById = (id: string): LibraryItem | undefined => LIBRARY.find((i) => i.id === id);

/** Items whose name or keywords contain the words (capitals ignored), in a category if given. */
export function searchLibrary(query: string, category?: Category): LibraryItem[] {
  const q = query.trim().toLowerCase();
  return LIBRARY.filter(
    (i) =>
      (!category || i.category === category) &&
      (!q || i.name.toLowerCase().includes(q) || i.keywords.some((k) => k.includes(q))),
  );
}

/** A picture takes at most this share of the stage's width or height when placed. */
const MOST = 0.8;

/** The item built and placed on a stage of that size. */
export function placeItem(item: LibraryItem, stage: Pick<Stage, 'width' | 'height'>): AnimObject {
  const built = buildItem(item);
  if (item.category === 'backgrounds')
    return { ...setSize(built, stage.width, stage.height), x: 0, y: 0 };
  const scale = Math.min(
    1,
    (MOST * stage.width) / built.width,
    (MOST * stage.height) / built.height,
  );
  const sized = setSize(built, built.width * scale, built.height * scale);
  return { ...sized, x: (stage.width - sized.width) / 2, y: (stage.height - sized.height) / 2 };
}
