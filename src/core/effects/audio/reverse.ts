// A22 Reverse: the selected sound played backwards (as Audacity's Reverse). No settings, so the
// Effect menu applies it at once; Undo takes it back.
import { reverse as backwards } from '../../audio/dsp/channels.ts';
import type { AudioEffectDef } from '../types.ts';

export const reverse: AudioEffectDef = {
  id: 'audio.reverse',
  label: 'Reverse',
  group: 'Time & pitch',
  syllabus: '11.2 altering clip speed',
  why: 'Reversing plays the selected sound backwards, from its end to its start. It makes an unusual sound effect: a cymbal or a piano note swells up instead of dying away, and reversed speech hides the words. Reversing the same part again puts it back as it was.',
  params: {},
  process: (channels) => backwards(channels),
};
