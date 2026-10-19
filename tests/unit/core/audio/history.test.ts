import { describe, expect, it } from 'vitest';
import {
  canRedoAudio,
  canUndoAudio,
  createAudioHistory,
  editAudio,
  redoAudio,
  undoAudio,
} from '../../../../src/core/audio/history.ts';
import {
  clipChannels,
  createClip,
  createTrack,
  emptyDoc,
  trackDuration,
  trackSound,
  type AudioDoc,
} from '../../../../src/core/audio/pcm.ts';
import { EditError } from '../../../../src/core/model/errors.ts';

const RATE = 10; // 10 samples per second keeps the numbers readable
const ramp = (n: number, from = 0) => Float32Array.from({ length: n }, (_, i) => from + i);
const samples = (a: Float32Array) => [...a];
/** The used samples of the first clip of track `i`, channel `c`. */
const used = (doc: AudioDoc, i = 0, c = 0) => samples(clipChannels(doc.tracks[i]!.clips[0]!)[c]!);

function docWith(...channelSets: Float32Array[][]) {
  const tracks = channelSets.map((channels, i) =>
    createTrack({ id: `t${i}`, name: `Track ${i}`, channels }),
  );
  return { ...emptyDoc(RATE), tracks };
}

describe('A18 / P5 audio history (Memento)', () => {
  it('a track knows its length in seconds', () => {
    const doc = docWith([ramp(25)]);
    expect(trackDuration(doc.tracks[0]!, RATE)).toBe(2.5);
  });

  it('a new track holds its sound as one clip, called after the track', () => {
    const doc = docWith([ramp(4)]);
    expect(doc.tracks[0]!.clips.map((c) => c.id)).toEqual(['t0.c']);
    expect(doc.tracks[0]!.channelCount).toBe(1);
    expect(docWith([new Float32Array(0), new Float32Array(0)]).tracks[0]!).toMatchObject({
      clips: [],
      channelCount: 2,
    });
  });

  it('splice replaces samples of a clip and undo restores the exact original samples', () => {
    const before = docWith([ramp(10), ramp(10, 100)]);
    let h = createAudioHistory(before);
    h = editAudio(h, 'Cut', (tx) =>
      tx.splice('t0.c', 2, 3, [new Float32Array(0), new Float32Array(0)]),
    );
    expect(used(h.present, 0, 0)).toEqual([0, 1, 5, 6, 7, 8, 9]);
    expect(used(h.present, 0, 1)).toEqual([100, 101, 105, 106, 107, 108, 109]);
    h = undoAudio(h);
    expect(used(h.present, 0, 0)).toEqual(samples(ramp(10)));
    expect(used(h.present, 0, 1)).toEqual(samples(ramp(10, 100)));
  });

  it('a splice works inside the used part of a trimmed clip and keeps the hidden ends', () => {
    let h = createAudioHistory(docWith([ramp(10)]));
    h = editAudio(h, 'Trim', (tx) => tx.setClip('t0.c', { in: 2, out: 8 }));
    expect(used(h.present)).toEqual([2, 3, 4, 5, 6, 7]);
    h = editAudio(h, 'Delete', (tx) => tx.splice('t0.c', 1, 2, [new Float32Array(0)]));
    expect(used(h.present)).toEqual([2, 5, 6, 7]);
    // Dragging the edges back out shows the hidden sound again.
    h = editAudio(h, 'Untrim', (tx) => tx.setClip('t0.c', { in: 0, out: 8 }));
    expect(used(h.present)).toEqual([0, 1, 2, 5, 6, 7, 8, 9]);
  });

  it('never changes the sample arrays of an earlier state', () => {
    const before = docWith([ramp(10)]);
    const original = before.tracks[0]!.clips[0]!.source[0]!;
    const h = editAudio(createAudioHistory(before), 'Amplify', (tx) =>
      tx.splice('t0.c', 0, 10, [new Float32Array(10).fill(7)]),
    );
    expect(samples(original)).toEqual(samples(ramp(10)));
    expect(h.present.tracks[0]!.clips[0]!.source[0]).not.toBe(original);
  });

  it('undo keeps only the changed region, not a copy of the whole clip', () => {
    const h = editAudio(createAudioHistory(docWith([ramp(1000)])), 'Fade', (tx) =>
      tx.splice('t0.c', 10, 5, [new Float32Array(5)]),
    );
    const kept = h.past[0]!.undo.flatMap((op) =>
      op.type === 'splice' ? (op.insert as Float32Array[]) : [],
    );
    expect(kept.reduce((n, a) => n + a.length, 0)).toBe(5);
  });

  it('moving and trimming a clip keeps no samples in the undo step', () => {
    const h = editAudio(createAudioHistory(docWith([ramp(1000)])), 'Move', (tx) =>
      tx.setClip('t0.c', { offset: 3, in: 10, out: 900 }),
    );
    expect(h.past[0]!.undo).toEqual([
      { type: 'clip', clip: 't0.c', set: { offset: 0, in: 0, out: 1000 } },
    ]);
  });

  it('refuses a clip whose used part is outside its samples or empty', () => {
    const h = createAudioHistory(docWith([ramp(10)]));
    for (const set of [{ in: -1 }, { out: 11 }, { in: 5, out: 5 }, { offset: -1 }])
      expect(() => editAudio(h, 'x', (tx) => tx.setClip('t0.c', set))).toThrow(RangeError);
  });

  it('adds and removes clips; split clips share their samples (no copy)', () => {
    let h = createAudioHistory(docWith([ramp(10)]));
    const source = h.present.tracks[0]!.clips[0]!.source;
    h = editAudio(h, 'Split', (tx) => {
      tx.setClip('t0.c', { out: 4 });
      tx.addClip('t0', { id: 'right', offset: 0.4, source, in: 4, out: 10 });
    });
    const [left, right] = h.present.tracks[0]!.clips;
    expect(right!.source).toBe(left!.source);
    expect(samples(clipChannels(right!)[0]!)).toEqual([4, 5, 6, 7, 8, 9]);
    h = editAudio(h, 'Delete clip', (tx) => tx.removeClip('t0.c'));
    expect(h.present.tracks[0]!.clips.map((c) => c.id)).toEqual(['right']);
    h = undoAudio(undoAudio(h));
    expect(h.present.tracks[0]!.clips.map((c) => [c.id, c.in, c.out])).toEqual([['t0.c', 0, 10]]);
    h = redoAudio(h);
    expect(h.present.tracks[0]!.clips.map((c) => c.id)).toEqual(['t0.c', 'right']);
  });

  it('a track’s sound: its clips in time, with silence in the gaps', () => {
    const track = createTrack({ id: 'a', name: 'A', channels: [ramp(2, 1)], offset: 0.5 });
    const two = {
      ...track,
      clips: [...track.clips, createClip({ id: 'b', channels: [ramp(1, 9)], offset: 1 })],
    };
    const sound = trackSound(two, RATE);
    expect(sound.offset).toBe(0.5);
    expect(sound.channels.map(samples)).toEqual([[1, 2, 0, 0, 0, 9]]);
    expect(trackSound({ ...track, clips: [] }, RATE)).toEqual({ offset: 0, channels: [ramp(0)] });
  });

  it('redo applies the edit again; a new edit clears what could be redone', () => {
    let h = createAudioHistory(docWith([ramp(10)]));
    h = editAudio(h, 'Delete', (tx) => tx.splice('t0.c', 0, 5, [new Float32Array(0)]));
    h = undoAudio(h);
    expect(canRedoAudio(h)).toBe(true);
    h = redoAudio(h);
    expect(used(h.present)).toEqual([5, 6, 7, 8, 9]);
    h = undoAudio(h);
    h = editAudio(h, 'Rename', (tx) => tx.setMeta('t0', { name: 'Piano' }));
    expect(canRedoAudio(h)).toBe(false);
  });

  it('several steps in one edit are undone together, in the right order', () => {
    let h = createAudioHistory(docWith([ramp(10)]));
    h = editAudio(h, 'Trim to selection', (tx) => {
      tx.splice('t0.c', 7, 3, [new Float32Array(0)]); // tail
      tx.splice('t0.c', 0, 2, [new Float32Array(0)]); // head
      tx.setClip('t0.c', { offset: 0.2 });
    });
    expect(used(h.present)).toEqual([2, 3, 4, 5, 6]);
    expect(h.present.tracks[0]!.clips[0]!.offset).toBe(0.2);
    h = undoAudio(h);
    expect(used(h.present)).toEqual(samples(ramp(10)));
    expect(h.present.tracks[0]!.clips[0]!.offset).toBe(0);
    h = redoAudio(h);
    expect(used(h.present)).toEqual([2, 3, 4, 5, 6]);
    expect(h.past.map((c) => c.label)).toEqual(['Trim to selection']);
  });

  it('adds, removes, moves tracks and changes channels; undo puts everything back', () => {
    const start = docWith([ramp(4)], [ramp(4, 10), ramp(4, 20)]);
    let h = createAudioHistory(start);
    h = editAudio(h, 'Add track', (tx) =>
      tx.addTrack(createTrack({ id: 'new', name: 'New', channels: [ramp(2)] })),
    );
    h = editAudio(h, 'Move up', (tx) => tx.moveTrack('new', 0));
    h = editAudio(h, 'Mono', (tx) => {
      tx.setSource('t1.c', [ramp(4, 15)]);
      tx.setMeta('t1', { channelCount: 1 });
    });
    h = editAudio(h, 'Remove', (tx) => tx.removeTrack('t0'));
    expect(h.present.tracks.map((t) => t.id)).toEqual(['new', 't1']);
    expect(h.present.tracks[1]!.channelCount).toBe(1);
    expect(clipChannels(h.present.tracks[1]!.clips[0]!)).toHaveLength(1);
    while (canUndoAudio(h)) h = undoAudio(h);
    expect(h.present.tracks.map((t) => t.id)).toEqual(['t0', 't1']);
    expect(h.present.tracks[1]!.clips[0]!.source.map(samples)).toEqual([
      samples(ramp(4, 10)),
      samples(ramp(4, 20)),
    ]);
    while (canRedoAudio(h)) h = redoAudio(h);
    expect(h.present.tracks.map((t) => t.id)).toEqual(['new', 't1']);
  });

  it('an edit that throws leaves the history unchanged', () => {
    const h = createAudioHistory(docWith([ramp(10)]));
    const after = (() => {
      try {
        return editAudio(h, 'Bad', (tx) => {
          tx.splice('t0.c', 0, 5, [new Float32Array(0)]);
          throw new EditError('Select some sound first.');
        });
      } catch {
        return h;
      }
    })();
    expect(after).toBe(h);
    expect(used(h.present)).toEqual(samples(ramp(10)));
  });

  it('an edit that changes nothing is not added to the history', () => {
    const h = createAudioHistory(docWith([ramp(10)]));
    expect(editAudio(h, 'Nothing', () => {})).toBe(h);
  });

  it('refuses a splice outside the clip or with the wrong number of channels', () => {
    const h = createAudioHistory(docWith([ramp(10)]));
    expect(() => editAudio(h, 'x', (tx) => tx.splice('t0.c', 8, 5, [new Float32Array(0)]))).toThrow(
      RangeError,
    );
    expect(() =>
      editAudio(h, 'x', (tx) =>
        tx.splice('t0.c', 0, 1, [new Float32Array(1), new Float32Array(1)]),
      ),
    ).toThrow(RangeError);
    expect(() => editAudio(h, 'x', (tx) => tx.setMeta('missing', { name: 'a' }))).toThrow(
      RangeError,
    );
    expect(() => editAudio(h, 'x', (tx) => tx.removeClip('missing'))).toThrow(RangeError);
  });

  it('remembers the sample rate; setting it is undoable', () => {
    let h = createAudioHistory(emptyDoc(44100));
    h = editAudio(h, 'Import', (tx) => tx.setRate(48000));
    expect(h.present.rate).toBe(48000);
    expect(undoAudio(h).present.rate).toBe(44100);
  });

  it('undo and redo with nothing to undo or redo change nothing', () => {
    const h = createAudioHistory(docWith([ramp(3)]));
    expect(undoAudio(h)).toBe(h);
    expect(redoAudio(h)).toBe(h);
  });
});
