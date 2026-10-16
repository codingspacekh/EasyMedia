import { describe, expect, it } from 'vitest';
import {
  moveAudioToTrack,
  setAudioFades,
  setAudioVolume,
  setClipVolume,
  joinSoundWithNext,
  setDucking,
  setSoundSpeed,
  splitSound,
  trimAudio,
  unlinkClipSound,
} from '../../../src/app/commands.ts';
import { createHistory, execute, undo, type Command } from '../../../src/app/history.ts';
import {
  createAudioItem,
  createMediaAsset,
  createProject,
  createTitleSlide,
  createVideoClip,
} from '../../../src/core/model/factory.ts';
import { setItemDuration } from '../../../src/core/model/timeline.ts';
import type { Project } from '../../../src/core/model/types.ts';
import { EditError } from '../../../src/core/model/errors.ts';
import { deepFreeze } from '../../helpers/freeze.ts';

const lake = createMediaAsset({
  id: 'lake',
  kind: 'video',
  path: 'Lake.mp4',
  duration: 20,
  hasAudio: true,
});
const silent = createMediaAsset({
  id: 'silent',
  kind: 'video',
  path: 'silent.mp4',
  duration: 5,
  hasAudio: false,
});
const music = createMediaAsset({ id: 'music', kind: 'audio', path: 'music.mp3', duration: 30 });
const voice = createMediaAsset({ id: 'voice', kind: 'audio', path: 'voice.mp3', duration: 4 });

/** Title (0–8 s), Lake (8–28 s, with sound), a silent clip; music 5–8 s; a voiceover 10–14 s. */
function sample(): Project {
  const p = createProject({ name: 'Sample' });
  return {
    ...p,
    media: [lake, silent, music, voice],
    timeline: {
      main: [
        setItemDuration(createTitleSlide('Title', { id: 't' }), 8),
        createVideoClip(lake, { id: 'v' }),
        createVideoClip(silent, { id: 's' }),
      ],
      text: [],
      audio: [
        [{ ...createAudioItem(music, 5, { id: 'm' }), out: 3 }],
        [createAudioItem(voice, 10, { id: 'vo' })],
      ],
    },
  };
}
const run = (p: Project, c: Command) => execute(createHistory(p), c).present;
const audio = (p: Project, id: string) => p.timeline.audio.flat().find((a) => a.id === id)!;
const refuses = (c: Command, message: RegExp, p = sample()) => {
  expect(() => run(p, c)).toThrow(EditError);
  expect(() => run(p, c)).toThrow(message);
};

describe('V13 audio commands', () => {
  it.each<[string, Command]>([
    ['setClipVolume', setClipVolume('v', 0.5)],
    ['trimAudio', trimAudio('m', { in: 2, out: 12 })],
    ['setAudioVolume', setAudioVolume('m', 0.8)],
    ['setAudioFades', setAudioFades('m', { in: 1, out: 1.5 })],
    ['setDucking', setDucking('m', true)],
    ['moveAudioToTrack', moveAudioToTrack('m', 1)],
    ['unlinkClipSound', unlinkClipSound('v', 'u')],
  ])('%s leaves the original untouched and is undone exactly', (_name, command) => {
    const base = deepFreeze(sample());
    const pristine = structuredClone(base);
    const h = execute(createHistory(base), command);
    expect(h.present).not.toEqual(pristine);
    expect(undo(h).present).toBe(base);
  });

  describe('clip volume', () => {
    it('sets the volume of a video clip, 0–200 %', () => {
      const v = run(sample(), setClipVolume('v', 1.5)).timeline.main[1]!;
      expect(v.type === 'video' && v.volume).toBe(1.5);
      refuses(setClipVolume('v', 2.5), /0 % and 200 %/);
      refuses(setClipVolume('t', 1), /only video clips/i);
    });
  });

  describe('trim, volume and fades of music and voiceover', () => {
    it('trims to a part of the sound file (0.01 s precision)', () => {
      const m = audio(run(sample(), trimAudio('m', { in: 2.25, out: 12.5 })), 'm');
      expect([m.in, m.out]).toEqual([2.25, 12.5]);
    });

    it.each([
      [{ in: -1, out: 5 }, /before 0.00 s/],
      [{ in: 5, out: 5 }, /after the start point/],
      [{ in: 0, out: 31 }, /end of the sound \(30.00 s\)/],
      [{ in: 0, out: 0.05 }, /at least 0.10 s/],
    ])('refuses the trim %o', (range, message) => refuses(trimAudio('m', range), message));

    it('refuses a longer trim that would run into the next clip on the same track', () => {
      const p = run(sample(), moveAudioToTrack('m', 1)); // 5–8 s, before the voiceover at 10 s
      refuses(trimAudio('m', { in: 0, out: 10 }), /overlaps/i, p); // would play until 15 s
    });

    it('volume 0–200 %; fades fit inside the clip', () => {
      expect(audio(run(sample(), setAudioVolume('m', 0.8)), 'm').volume).toBe(0.8);
      refuses(setAudioVolume('m', -0.1), /0 % and 200 %/);
      const faded = audio(run(sample(), setAudioFades('m', { in: 1, out: 1.5 })), 'm');
      expect([faded.fadeIn, faded.fadeOut]).toEqual([1, 1.5]);
      refuses(setAudioFades('m', { in: 20, out: 20 }), /longer than the sound/i);
      refuses(setAudioFades('m', { in: -1, out: 0 }), /negative/i);
    });

    it('lower under voiceover is for the music track', () => {
      expect(audio(run(sample(), setDucking('m', true)), 'm').duck).toBe(true);
      expect(audio(run(sample(), setDucking('m', false)), 'm')).not.toHaveProperty('duck');
      refuses(setDucking('vo', true), /music track/i);
    });

    it('a clip can move to the other track if it fits there', () => {
      const p = run(sample(), moveAudioToTrack('vo', 0));
      expect(p.timeline.audio[1]).toEqual([]);
      refuses(
        moveAudioToTrack('vo', 0),
        /overlaps/i,
        run(sample(), trimAudio('m', { in: 0, out: 30 })),
      );
    });

    it('an audio item that does not exist is reported', () => {
      refuses(setAudioVolume('nope', 1), /could not be found/i);
    });
  });

  describe('unlink: the sound of a video clip moves onto an audio track', () => {
    it('Lake (8–28 s) becomes silent and its sound plays from 8 s on the voiceover track', () => {
      const base = run(sample(), removeVoiceover());
      const p = run(base, unlinkClipSound('v', 'u'));
      const v = p.timeline.main[1]!;
      expect(v.type === 'video' && v.muted).toBe(true);
      expect(p.timeline.audio[1]).toEqual([
        { ...createAudioItem(lake, 8, { id: 'u' }), in: 0, out: 20 },
      ]);
    });

    it('keeps the trim, volume and sound fades of the clip', () => {
      let p = run(sample(), removeVoiceover());
      p = {
        ...p,
        timeline: {
          ...p.timeline,
          main: p.timeline.main.map((m) =>
            m.id === 'v' && m.type === 'video'
              ? { ...m, in: 2, out: 6, volume: 0.5, fade: { in: 1, out: 0.5, colour: 'black' } }
              : m,
          ),
        },
      };
      const u = audio(run(p, unlinkClipSound('v', 'u')), 'u');
      expect(u).toMatchObject({ start: 8, in: 2, out: 6, volume: 0.5, fadeIn: 1, fadeOut: 0.5 });
    });

    it('uses the music track when the voiceover track is busy, and refuses when both are', () => {
      // Voiceover 10–14 s is in the way; the music (5–8 s) ends just as Lake starts.
      const p = run(sample(), unlinkClipSound('v', 'u'));
      expect(p.timeline.audio[0].map((a) => a.id)).toEqual(['m', 'u']);
      const busy = run(sample(), trimAudio('m', { in: 0, out: 30 })); // music 5–35 s
      refuses(unlinkClipSound('v', 'u'), /no free space/i, busy);
    });

    it('refuses clips with no sound, muted clips and titles', () => {
      refuses(unlinkClipSound('s', 'u'), /no sound/i);
      refuses(unlinkClipSound('t', 'u'), /only video clips/i);
      refuses(unlinkClipSound('v', 'u'), /no sound/i, muteLake());
    });

    it('a clip at another speed keeps that speed on its separated sound', () => {
      const p = run(sample(), removeVoiceover());
      const fast = {
        ...p,
        timeline: {
          ...p.timeline,
          main: p.timeline.main.map((m) => (m.id === 'v' ? { ...m, speed: 2 } : m)),
        },
      };
      const u = audio(run(fast, unlinkClipSound('v', 'u')), 'u');
      expect(u).toMatchObject({ start: 8, in: 0, out: 20, speed: 2 }); // plays 8–18 s, like the clip
    });
  });

  describe('speed, split and join of a sound (like a video clip)', () => {
    it('speed: the music (5–8 s) at 2× plays 5–6.5 s; slowing it into the next sound is refused', () => {
      const p = run(sample(), setSoundSpeed('m', 2));
      expect(audio(p, 'm').speed).toBe(2);
      const shared = run(sample(), moveAudioToTrack('m', 1)); // 5–8 s, voiceover at 10 s
      refuses(setSoundSpeed('m', 0.25), /overlaps/i, shared); // would play 5–17 s
      refuses(setSoundSpeed('m', 8), /0.25× and 4×/);
    });

    it('split at the playhead makes two parts; join puts them back', () => {
      const p = run(sample(), splitSound(6.5, 'm', ['m1', 'm2'])); // music 5–8 s
      expect(p.timeline.audio[0]).toMatchObject([
        { id: 'm1', start: 5, in: 0, out: 1.5 },
        { id: 'm2', start: 6.5, in: 1.5, out: 3 },
      ]);
      const joined = run(p, joinSoundWithNext('m1'));
      expect(joined.timeline.audio[0]).toEqual([{ ...audio(sample(), 'm'), id: 'm1' }]);
    });

    it('split needs the playhead over the sound; join needs a split part after it', () => {
      refuses(splitSound(9, 'm', ['m1', 'm2']), /playhead over the sound/i);
      refuses(joinSoundWithNext('m'), /no sound after this one/i);
    });

    it.each<[string, Command]>([
      ['setSoundSpeed', setSoundSpeed('m', 1.5)],
      ['splitSound', splitSound(6, 'm', ['m1', 'm2'])],
    ])('%s is undone exactly', (_name, command) => {
      const base = deepFreeze(sample());
      expect(undo(execute(createHistory(base), command)).present).toBe(base);
    });
  });
});

function muteLake(): Project {
  const p = sample();
  return {
    ...p,
    timeline: {
      ...p.timeline,
      main: p.timeline.main.map((m) => (m.id === 'v' ? { ...m, muted: true } : m)),
    },
  };
}

function removeVoiceover(): Command {
  return {
    label: 'test',
    apply: (p) => ({ ...p, timeline: { ...p.timeline, audio: [p.timeline.audio[0], []] } }),
  };
}
