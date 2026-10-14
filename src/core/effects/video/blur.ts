// V15 blur and sharpen (Book A 11.12: "Box Blur").
import type { EffectDef } from '../types.ts';

export const blur: EffectDef = {
  id: 'video.blur',
  label: 'Box blur',
  syllabus: '11.1 filters',
  why: 'Blur softens the picture. It hides details such as faces or number plates, puts the focus on text over the picture, or makes a dreamy look.',
  params: { radius: { label: 'Strength', unit: 'px', min: 1, max: 30, step: 1, default: 5 } },
  render: ({ radius = 5 }) => `boxblur=${radius}:1`,
  preview: ({ radius = 5 }) => `blur(${(radius * 0.4).toFixed(1)}px)`,
};

export const sharpen: EffectDef = {
  id: 'video.sharpen',
  label: 'Sharpen',
  syllabus: '11.1 filters',
  why: 'Sharpen makes edges crisper so a slightly soft clip looks clearer. Too much makes the picture look grainy.',
  params: { amount: { label: 'Amount', min: 0.5, max: 3, step: 0.1, default: 1.5 } },
  render: ({ amount = 1.5 }) => `unsharp=5:5:${amount}`,
  preview: ({ amount = 1.5 }) => `contrast(${(1 + amount / 15).toFixed(2)})`,
};

export const invert: EffectDef = {
  id: 'video.invert',
  label: 'Invert colours',
  syllabus: '11.1 filters',
  why: 'Inverting swaps every colour for its opposite, like a photo negative. It is a striking special effect, for example to show a shock or a dream.',
  params: {},
  render: () => 'negate',
  preview: () => 'invert(1)',
};
