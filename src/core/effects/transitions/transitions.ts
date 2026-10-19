// V9 transitions between two clips, made with FFmpeg's xfade. The duration is set per cut.
// Ids of earlier versions stay (saved projects use them); new ones are added in their group.
import type { TransitionDef, TransitionGroup } from '../types.ts';

export const TRANSITION_GROUPS: readonly TransitionGroup[] = [
  'Fades',
  'Wipes',
  'Slides',
  'Shapes',
  'Fun',
];

const t = (
  id: string,
  group: TransitionGroup,
  label: string,
  xfade: string,
  why: string,
): TransitionDef => ({
  id: `transition.${id}`,
  label,
  group,
  syllabus: '11.1 transitions',
  why,
  params: {},
  xfade,
});

const WIPE =
  'A wipe pushes a hard edge across the screen to reveal the next clip. It is clear and lively, good for moving to a new topic.';
const PUSH =
  'The next clip pushes the old one off the screen, like turning a page in a book. It keeps the story moving in one direction.';
const COVER =
  'The next clip slides in over the old one, which stays still. Slides feel energetic and are often used in adverts and presentations.';
const REVEAL =
  'The old clip slides away like a curtain and shows the next one waiting underneath. It feels like uncovering something new.';
const SOFT =
  'A soft wipe moves a blurred edge across the screen, so the change is gentler than a hard wipe but still shows a direction.';

export const TRANSITION_LIST: TransitionDef[] = [
  // ---- Fades ----
  t(
    'dissolve',
    'Fades',
    'Dissolve',
    'fade',
    'A dissolve slowly blends one clip into the next. It is gentle and smooth, and suggests that the two scenes belong together.',
  ),
  t(
    'fadeblack',
    'Fades',
    'Fade through black',
    'fadeblack',
    'Fading through black closes one scene before the next begins. It shows that time has passed or that the place has changed.',
  ),
  t(
    'fadewhite',
    'Fades',
    'Fade through white',
    'fadewhite',
    'Fading through white feels bright and dreamy. It is often used for a flashback or a happy memory.',
  ),
  t(
    'fadegrey',
    'Fades',
    'Fade through grey',
    'fadegrays',
    'The colour drains out of the old clip and comes back with the next one. It feels calm and thoughtful, like an old photograph.',
  ),
  t(
    'pixeldissolve',
    'Fades',
    'Pixel dissolve',
    'dissolve',
    'The next clip appears dot by dot, like grains of sand. It is softer than a cut but has more texture than a plain dissolve.',
  ),
  t(
    'blur',
    'Fades',
    'Blur',
    'hblur',
    'The old clip blurs sideways and the next one comes into focus. It can show a dream, a memory or a sudden thought.',
  ),
  // ---- Wipes ----
  t('wipeleft', 'Wipes', 'Wipe left', 'wipeleft', WIPE),
  t('wiperight', 'Wipes', 'Wipe right', 'wiperight', WIPE),
  t('wipeup', 'Wipes', 'Wipe up', 'wipeup', WIPE),
  t('wipedown', 'Wipes', 'Wipe down', 'wipedown', WIPE),
  t('push', 'Wipes', 'Soft wipe left', 'smoothleft', SOFT),
  t('softright', 'Wipes', 'Soft wipe right', 'smoothright', SOFT),
  t(
    'clock',
    'Wipes',
    'Clock wipe',
    'radial',
    'A line sweeps round like the hand of a clock to show the next clip. It is a clear way to show that time is passing.',
  ),
  t(
    'corner',
    'Wipes',
    'Corner wipe',
    'wipetl',
    'The next clip grows from one corner of the screen. It is a lively wipe that leads the eye across the picture.',
  ),
  // ---- Slides ----
  t('slide', 'Slides', 'Push left', 'slideleft', PUSH),
  t('pushright', 'Slides', 'Push right', 'slideright', PUSH),
  t('pushup', 'Slides', 'Push up', 'slideup', PUSH),
  t('pushdown', 'Slides', 'Push down', 'slidedown', PUSH),
  t('coverleft', 'Slides', 'Slide in from the right', 'coverleft', COVER),
  t('coverright', 'Slides', 'Slide in from the left', 'coverright', COVER),
  t('revealleft', 'Slides', 'Slide away to the left', 'revealleft', REVEAL),
  t('revealright', 'Slides', 'Slide away to the right', 'revealright', REVEAL),
  // ---- Shapes ----
  t(
    'circle',
    'Shapes',
    'Circle open',
    'circleopen',
    'A circle opens from the centre to show the next clip. It draws the eye to the middle of the screen; used for fun or old-film effects.',
  ),
  t(
    'circleclose',
    'Shapes',
    'Circle close',
    'circleclose',
    'The old clip shrinks into a circle in the middle and is gone. It feels like the end of a chapter, as in old cartoons.',
  ),
  t(
    'iris',
    'Shapes',
    'Iris',
    'circlecrop',
    'The picture closes to a black circle and opens again on the next clip, like the iris of a camera. It is a classic film ending.',
  ),
  t(
    'box',
    'Shapes',
    'Box',
    'rectcrop',
    'The picture closes to a box in the middle and opens again on the next clip. It frames the change neatly, good for presentations.',
  ),
  t(
    'doors',
    'Shapes',
    'Doors open',
    'vertopen',
    'The next clip opens from the middle like two doors. It feels like walking into a new place or starting something new.',
  ),
  t(
    'letterbox',
    'Shapes',
    'Letterbox open',
    'horzopen',
    'The next clip opens from a line across the middle, like a letterbox or an eye opening. It makes a calm, wide reveal.',
  ),
  // ---- Fun ----
  t(
    'zoom',
    'Fun',
    'Zoom',
    'zoomin',
    'The picture zooms into the next clip. It is dramatic and fast, so it is best used rarely so it does not distract the audience.',
  ),
  t(
    'pixelate',
    'Fun',
    'Pixelate',
    'pixelize',
    'The picture breaks into big squares and builds up again as the next clip, like a video game. Good for fun or technology topics.',
  ),
  t(
    'squeeze',
    'Fun',
    'Squeeze',
    'squeezeh',
    'The old clip is squeezed flat and the next one takes its place. It is playful and quick, best for light-hearted videos.',
  ),
  t(
    'slices',
    'Fun',
    'Slices',
    'hlslice',
    'The next clip arrives in strips from one side, like blinds. It is busy and eye-catching, so use it only once or twice.',
  ),
  t(
    'wind',
    'Fun',
    'Wind',
    'hlwind',
    'The old clip is blown away in streaks, as if by the wind. It suits outdoor, weather or action scenes.',
  ),
];

/** How the preview shows one of the two clips: CSS for its layer. */
export interface LayerLook {
  opacity?: number;
  clipPath?: string;
  transform?: string;
  /** A CSS mask (soft edges, the clock and the circle that closes). */
  mask?: string;
  filter?: string;
}

/**
 * The preview's picture of a transition `p` of the way through (0 → 1): the old clip (`from`)
 * and the next (`to`), shown on top of it unless `above` says the old one is on top. `behind`
 * is the colour seen where neither is (fades through black or white). The export is exactly
 * FFmpeg's xfade; this only needs to look like it.
 */
export interface TransitionLook {
  from: LayerLook;
  to: LayerLook;
  above?: 'from';
  behind?: string;
}

const pct = (n: number) => `${Math.round(n * 10000) / 100}%`;
/** Half the frame's diagonal, as a percentage of its size: the circle that covers it. */
const COVER_RADIUS = Math.SQRT1_2 * 100;

export function transitionLook(xfade: string, p: number): TransitionLook {
  const q = 1 - p;
  const half = (a: number) => Math.min(1, Math.max(0, a));
  const soft = (direction: string) => ({
    mask: `linear-gradient(${direction}, transparent ${pct(q - 0.1)}, black ${pct(q + 0.1)})`,
  });
  switch (xfade) {
    case 'wipeleft':
      return { from: {}, to: { clipPath: `inset(0 0 0 ${pct(q)})` } };
    case 'wiperight':
      return { from: {}, to: { clipPath: `inset(0 ${pct(q)} 0 0)` } };
    case 'wipeup':
      return { from: {}, to: { clipPath: `inset(${pct(q)} 0 0 0)` } };
    case 'wipedown':
      return { from: {}, to: { clipPath: `inset(0 0 ${pct(q)} 0)` } };
    case 'wipetl':
      return { from: {}, to: { clipPath: `inset(${pct(q)} 0 0 ${pct(q)})` } };
    case 'smoothleft':
      return { from: {}, to: soft('to right') };
    case 'smoothright':
      return { from: {}, to: soft('to left') };
    case 'radial':
      return { from: {}, to: { mask: `conic-gradient(black ${p * 360}deg, transparent 0)` } };
    case 'slideleft':
      return {
        from: { transform: `translate(${pct(-p)}, 0)` },
        to: { transform: `translate(${pct(q)}, 0)` },
      };
    case 'slideright':
      return {
        from: { transform: `translate(${pct(p)}, 0)` },
        to: { transform: `translate(${pct(-q)}, 0)` },
      };
    case 'slideup':
      return {
        from: { transform: `translate(0, ${pct(-p)})` },
        to: { transform: `translate(0, ${pct(q)})` },
      };
    case 'slidedown':
      return {
        from: { transform: `translate(0, ${pct(p)})` },
        to: { transform: `translate(0, ${pct(-q)})` },
      };
    case 'coverleft':
      return { from: {}, to: { transform: `translate(${pct(q)}, 0)` } };
    case 'coverright':
      return { from: {}, to: { transform: `translate(${pct(-q)}, 0)` } };
    case 'revealleft':
      return { from: { transform: `translate(${pct(-p)}, 0)` }, to: {}, above: 'from' };
    case 'revealright':
      return { from: { transform: `translate(${pct(p)}, 0)` }, to: {}, above: 'from' };
    case 'circleopen':
      return { from: {}, to: { clipPath: `circle(${pct((p * COVER_RADIUS) / 100)} at 50% 50%)` } };
    case 'circleclose':
      return {
        from: { clipPath: `circle(${pct((q * COVER_RADIUS) / 100)} at 50% 50%)` },
        to: {},
        above: 'from',
      };
    case 'circlecrop':
      return p < 0.5
        ? {
            from: { clipPath: `circle(${pct(((1 - 2 * p) * COVER_RADIUS) / 100)} at 50% 50%)` },
            to: { opacity: 0 },
            behind: '#000000',
          }
        : {
            from: { opacity: 0 },
            to: { clipPath: `circle(${pct(((2 * p - 1) * COVER_RADIUS) / 100)} at 50% 50%)` },
            behind: '#000000',
          };
    case 'rectcrop':
      return p < 0.5
        ? { from: { clipPath: `inset(${pct(p)})` }, to: { opacity: 0 }, behind: '#000000' }
        : { from: { opacity: 0 }, to: { clipPath: `inset(${pct(q)})` }, behind: '#000000' };
    case 'vertopen':
      return { from: {}, to: { clipPath: `inset(0 ${pct(q / 2)})` } };
    case 'horzopen':
      return { from: {}, to: { clipPath: `inset(${pct(q / 2)} 0)` } };
    case 'fadeblack':
    case 'fadewhite':
      return {
        from: { opacity: half(1 - 2 * p) },
        to: { opacity: half(2 * p - 1) },
        behind: xfade === 'fadeblack' ? '#000000' : '#ffffff',
      };
    case 'fadegrays':
      return {
        from: { filter: `grayscale(${half(2 * p)})` },
        to: { opacity: p, filter: `grayscale(${half(2 * q)})` },
      };
    case 'hblur':
      return {
        from: { filter: `blur(${(Math.sin(Math.PI * p) * 8).toFixed(1)}px)` },
        to: { opacity: p, filter: `blur(${(Math.sin(Math.PI * p) * 8).toFixed(1)}px)` },
      };
    case 'zoomin':
      return { from: { transform: `scale(${1 + p})`, opacity: q }, to: { opacity: p } };
    case 'pixelize':
      return {
        from: { filter: `blur(${(Math.sin(Math.PI * p) * 6).toFixed(1)}px)` },
        to: { opacity: p, filter: `blur(${(Math.sin(Math.PI * p) * 6).toFixed(1)}px)` },
      };
    case 'squeezeh':
      return { from: { transform: `scale(1, ${q})` }, to: { opacity: p } };
    case 'hlslice':
    case 'hlwind':
      return { from: {}, to: soft('to right') };
    default:
      // fade, dissolve and anything else: the next clip blends in.
      return { from: {}, to: { opacity: p } };
  }
}
