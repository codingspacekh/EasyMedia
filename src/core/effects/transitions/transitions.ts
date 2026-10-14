// V9 transitions between two clips, made with FFmpeg's xfade. The duration is set per cut.
import type { TransitionDef } from '../types.ts';

const t = (id: string, label: string, xfade: string, why: string): TransitionDef => ({
  id: `transition.${id}`,
  label,
  syllabus: '11.1 transitions',
  why,
  params: {},
  xfade,
});

export const TRANSITION_LIST: TransitionDef[] = [
  t(
    'dissolve',
    'Dissolve',
    'fade',
    'A dissolve slowly blends one clip into the next. It is gentle and smooth, and suggests that the two scenes belong together.',
  ),
  t(
    'fadeblack',
    'Fade through black',
    'fadeblack',
    'Fading through black closes one scene before the next begins. It shows that time has passed or that the place has changed.',
  ),
  t(
    'fadewhite',
    'Fade through white',
    'fadewhite',
    'Fading through white feels bright and dreamy. It is often used for a flashback or a happy memory.',
  ),
  t(
    'wipeleft',
    'Wipe left',
    'wipeleft',
    'A wipe pushes a hard edge across the screen to reveal the next clip. It is clear and lively, good for moving to a new topic.',
  ),
  t(
    'wipeup',
    'Wipe up',
    'wipeup',
    'A wipe pushes a hard edge across the screen to reveal the next clip. It is clear and lively, good for moving to a new topic.',
  ),
  t(
    'slide',
    'Slide',
    'slideleft',
    'The next clip slides in over the old one. Slides feel energetic and are often used in adverts and presentations.',
  ),
  t(
    'push',
    'Push',
    'smoothleft',
    'The next clip pushes the old one off the screen smoothly, like turning a page — it keeps the story moving.',
  ),
  t(
    'circle',
    'Circle',
    'circleopen',
    'A circle opens from the centre to show the next clip. It draws the eye to the middle of the screen; used for fun or old-film effects.',
  ),
  t(
    'zoom',
    'Zoom',
    'zoomin',
    'The picture zooms into the next clip. It is dramatic and fast, so it is best used rarely so it does not distract the audience.',
  ),
];
