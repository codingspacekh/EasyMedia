// A18 + N4: undo steps can keep their samples on disk (as Audacity), not in memory.
import { describe, expect, it } from 'vitest';
import {
  createAudioHistory,
  editAudio,
  redoAudio,
  undoAudio,
  type AudioHistory,
} from '../../../../src/core/audio/history.ts';
import {
  changeRefs,
  hasLooseSamples,
  historyRefs,
  loadChange,
  replaceChange,
  stashChange,
} from '../../../../src/core/audio/stored.ts';
import { createTrack, silence, type Channels } from '../../../../src/core/audio/pcm.ts';

const ramp = (n: number) => Float32Array.from({ length: n }, (_, i) => i);
const samples = (c: Channels) => c.map((a) => [...a]);

/** An in-memory "disk". */
function disk() {
  const files = new Map<string, Float32Array[]>();
  let n = 0;
  return {
    files,
    save: async (c: Channels) => {
      const key = `k${++n}`;
      files.set(
        key,
        c.map((a) => a.slice()),
      );
      return key;
    },
    load: async (key: string) => files.get(key)!.map((a) => a.slice()),
  };
}

function edited(): AudioHistory {
  const doc = {
    rate: 10,
    tracks: [createTrack({ id: 'a', name: 'A', channels: [ramp(1000), ramp(1000)] })],
  };
  let h = createAudioHistory(doc);
  h = editAudio(h, 'Silence', (tx) => tx.splice('a.c', 0, 500, silence(500, 2))); // keeps 500 × 2
  h = editAudio(h, 'Tiny', (tx) => tx.splice('a.c', 0, 2, silence(2, 2))); // keeps 2 × 2
  h = editAudio(h, 'Mono', (tx) => {
    tx.setSource('a.c', [ramp(1000)]);
    tx.setMeta('a', { channelCount: 1 });
  }); // keeps the stereo
  h = editAudio(h, 'Remove', (tx) => tx.removeTrack('a')); // keeps the whole track
  return h;
}

describe('undo steps on disk', () => {
  it('moves large removed samples to disk and leaves small ones in memory', async () => {
    const h = edited();
    const d = disk();
    const [silenceStep, tiny, mono, removed] = await Promise.all(
      h.past.map((c) => stashChange(c, d.save, 100)),
    );
    expect(changeRefs(silenceStep!)).toHaveLength(1);
    expect(changeRefs(tiny!)).toEqual([]);
    expect(hasLooseSamples(tiny!, 100)).toBe(false);
    expect(changeRefs(mono!)).toHaveLength(1);
    expect(changeRefs(removed!)).toHaveLength(1);
    expect(d.files.size).toBe(3);
    expect(hasLooseSamples(h.past[0]!, 100)).toBe(true);
    expect(hasLooseSamples(silenceStep!, 100)).toBe(false);
  });

  it('a step on disk must be loaded before it can be undone; then undo is exact', async () => {
    const original = edited();
    const d = disk();
    let h = original;
    for (const c of h.past) h = replaceChange(h, c, await stashChange(c, d.save, 100));
    expect(() => undoAudio(h)).toThrow(/load/i);
    while (h.past.length) {
      h = replaceChange(h, h.past.at(-1)!, await loadChange(h.past.at(-1)!, d.load));
      h = undoAudio(h);
    }
    expect(samples(h.present.tracks[0]!.clips[0]!.source)).toEqual([
      samples([ramp(1000)])[0],
      samples([ramp(1000)])[0],
    ]);
    // …and redo works the same way
    for (const c of h.future) h = replaceChange(h, c, await stashChange(c, d.save, 100));
    while (h.future.length) {
      h = replaceChange(h, h.future[0]!, await loadChange(h.future[0]!, d.load));
      h = redoAudio(h);
    }
    expect(h.present.tracks).toEqual([]);
  });

  it('a removed track keeps the samples of each of its clips (on disk when large)', async () => {
    const track = createTrack({ id: 'a', name: 'A', channels: [ramp(1000)] });
    const doc = {
      rate: 10,
      tracks: [{ ...track, clips: [...track.clips, { ...track.clips[0]!, id: 'b', offset: 200 }] }],
    };
    const h = editAudio(createAudioHistory(doc), 'Remove', (tx) => tx.removeTrack('a'));
    const d = disk();
    const stored = await stashChange(h.past[0]!, d.save, 100);
    expect(changeRefs(stored)).toHaveLength(2);
    const back = undoAudio(replaceChange(h, h.past[0]!, await loadChange(stored, d.load)));
    expect(back.present.tracks[0]!.clips.map((c) => [c.id, c.offset, c.source[0]!.length])).toEqual(
      [
        ['a.c', 0, 1000],
        ['b', 200, 1000],
      ],
    );
  });

  it('lists every file the history still needs', async () => {
    const d = disk();
    let h = edited();
    for (const c of h.past) h = replaceChange(h, c, await stashChange(c, d.save, 100));
    expect(historyRefs(h).sort()).toEqual([...d.files.keys()].sort());
  });

  it('replacing a step that is no longer in the history changes nothing', async () => {
    const h = edited();
    const d = disk();
    const gone = await stashChange(h.past[0]!, d.save, 100);
    expect(replaceChange(h, gone, gone)).toBe(h);
  });

  it('a step with nothing to move is returned as it is', async () => {
    const h = edited();
    const d = disk();
    expect(await stashChange(h.past[1]!, d.save, 100)).toBe(h.past[1]);
    expect(await loadChange(h.past[1]!, d.load)).toBe(h.past[1]);
  });
});
