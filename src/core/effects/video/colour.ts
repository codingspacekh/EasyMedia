// V15 colour correction: brightness, contrast and saturation in one effect.
import type { EffectDef } from '../types.ts';

const percent = (label: string) => ({ label, unit: '%', min: -100, max: 100, step: 1, default: 0 });

export const colour: EffectDef = {
  id: 'video.colour',
  label: 'Colour correction',
  syllabus: '11.1 colour correction',
  why: 'Colour correction fixes clips that are too dark, too flat or too colourful, and makes clips filmed at different times look as if they belong together.',
  params: {
    brightness: percent('Brightness'),
    contrast: percent('Contrast'),
    saturation: percent('Saturation'),
  },
  render: ({ brightness = 0, contrast = 0, saturation = 0 }) => {
    const parts = [
      brightness !== 0 && `brightness=${brightness / 100}`,
      contrast !== 0 && `contrast=${1 + contrast / 100}`,
      saturation !== 0 && `saturation=${1 + saturation / 100}`,
    ].filter(Boolean);
    return parts.length ? `eq=${parts.join(':')}` : '';
  },
  preview: ({ brightness = 0, contrast = 0, saturation = 0 }) =>
    `brightness(${1 + brightness / 100}) contrast(${1 + contrast / 100}) saturate(${1 + saturation / 100})`,
};
