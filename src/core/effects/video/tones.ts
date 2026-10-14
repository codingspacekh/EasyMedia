// V15 colour tones: black & white, sepia and a cold cyan tone (Book B Task 11i).
import type { EffectDef } from '../types.ts';

export const blackWhite: EffectDef = {
  id: 'video.blackwhite',
  label: 'Black & white',
  syllabus: '11.1 filters',
  why: 'Black and white removes all colour. It can make a clip look old, serious or dramatic, or show that a scene happens in the past.',
  params: {},
  render: () => 'hue=s=0',
  preview: () => 'grayscale(1)',
};

export const sepia: EffectDef = {
  id: 'video.sepia',
  label: 'Sepia',
  syllabus: '11.1 filters',
  why: 'Sepia gives a warm brown tone like an old photograph, so the audience feels the clip is a memory or happened long ago.',
  params: {},
  render: () => 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
  preview: () => 'sepia(1)',
};

export const cyan: EffectDef = {
  id: 'video.cyan',
  label: 'Cyan tone',
  syllabus: '11.1 filters',
  why: 'A cyan (blue-green) tone makes a scene feel cold, calm or lonely — for example to make a sunny savannah look like a cold place.',
  params: {},
  render: () => 'hue=s=0,colorchannelmixer=rr=0.55:gg=0.9:bb=1',
  preview: () => 'grayscale(1) sepia(1) hue-rotate(150deg) saturate(1.6)',
};
