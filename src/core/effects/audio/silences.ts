// A24 Remove silences (as Audacity's Truncate Silence): every quiet part in the selection that
// lasts long enough is shortened to the length typed, so the whole sound gets shorter.
import { removeSilences, silenceSaving, type SilenceSettings } from '../../audio/dsp/silence.ts';
import { EditError } from '../../model/errors.ts';
import type { AudioEffectDef, Params } from '../types.ts';

const settings = ({ threshold, minimum, keep }: Params): SilenceSettings => ({
  thresholdDb: threshold!,
  minimum: minimum!,
  keep: keep!,
});

export const silences: AudioEffectDef = {
  id: 'audio.silences',
  label: 'Remove silences…',
  group: 'Repair & channels',
  syllabus: '11.2 trimming an audio clip',
  why: 'A recorded voiceover often has long pauses: while the speaker breathes, reads the next line or starts again. Remove silences finds every quiet part that lasts longer than the time you choose and shortens it, so the voiceover is tighter and fits the video, without cutting each pause by hand. A short pause is kept, so the speech still sounds natural.',
  params: {
    threshold: { label: 'Quieter than', unit: 'dB', min: -80, max: -10, step: 1, default: -40 },
    minimum: { label: 'Lasting at least', unit: 's', min: 0.05, max: 30, step: 0.01, default: 0.5 },
    keep: { label: 'Shorten each to', unit: 's', min: 0, max: 30, step: 0.01, default: 0.5 },
  },
  check(_channels, { minimum, keep }) {
    if (keep! > minimum! + 1e-9)
      throw new EditError(
        'Shorten each to must not be longer than Lasting at least: a quiet part cannot get longer.',
      );
  },
  note(channels, rate, params) {
    if (params.keep! > params.minimum! + 1e-9)
      return 'Shorten each to must not be longer than Lasting at least.';
    const { parts, seconds } = silenceSaving(channels, rate, settings(params));
    if (parts === 0)
      return 'No quiet part found that lasts that long. Try a higher level (such as −30 dB) or a shorter time.';
    const before = channels[0]!.length / rate;
    return `${parts} quiet part${parts === 1 ? '' : 's'} found: the selection gets ${seconds.toFixed(2)} s shorter (${before.toFixed(2)} s → ${(before - seconds).toFixed(2)} s).`;
  },
  process: (channels, rate, params) => removeSilences(channels, rate, settings(params)),
};
