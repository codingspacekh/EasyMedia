import { describe, expect, it } from 'vitest';
import {
  canRedoAudio,
  canUndoAudio,
  createAudioHistory,
  editAudio,
  redoAudio,
  undoAudio,
} from '../../../../src/core/audio/history.ts';
import { createTrack, emptyDoc, trackDuration } from '../../../../src/core/audio/pcm.ts';
import { EditError } from '../../../../src/core/model/errors.ts';

const RATE = 10; // 10 samples per second keeps the numbers readable
const ramp = (n: number, from = 0) => Float32Array.from({ length: n }, (_, i) => from + i);
const samples = (a: Float32Array) => [...a];

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

  it('splice replaces samples and undo restores the exact original samples', () => {
    const before = docWith([ramp(10), ramp(10, 100)]);
    let h = createAudioHistory(before);
    h = editAudio(h, 'Cut', (tx) =>
      tx.splice('t0', 2, 3, [new Float32Array(0), new Float32Array(0)]),
    );
    expect(samples(h.present.tracks[0]!.channels[0]!)).toEqual([0, 1, 5, 6, 7, 8, 9]);
    expect(samples(h.present.tracks[0]!.channels[1]!)).toEqual([100, 101, 105, 106, 107, 108, 109]);
    h = undoAudio(h);
    expect(samples(h.present.tracks[0]!.channels[0]!)).toEqual(samples(ramp(10)));
    expect(samples(h.present.tracks[0]!.channels[1]!)).toEqual(samples(ramp(10, 100)));
  });

  it('never changes the sample arrays of an earlier state', () => {
    const before = docWith([ramp(10)]);
    const original = before.tracks[0]!.channels[0]!;
    const h = editAudio(createAudioHistory(before), 'Amplify', (tx) =>
      tx.splice('t0', 0, 10, [new Float32Array(10).fill(7)]),
    );
    expect(samples(original)).toEqual(samples(ramp(10)));
    expect(h.present.tracks[0]!.channels[0]).not.toBe(original);
  });

  it('undo keeps only the changed region, not a copy of the whole track', () => {
    const h = editAudio(createAudioHistory(docWith([ramp(1000)])), 'Fade', (tx) =>
      tx.splice('t0', 10, 5, [new Float32Array(5)]),
    );
    const kept = h.past[0]!.undo.flatMap((op) => (op.type === 'splice' ? op.insert : []));
    expect(kept.reduce((n, a) => n + a.length, 0)).toBe(5);
  });

  it('redo applies the edit again; a new edit clears what could be redone', () => {
    let h = createAudioHistory(docWith([ramp(10)]));
    h = editAudio(h, 'Delete', (tx) => tx.splice('t0', 0, 5, [new Float32Array(0)]));
    h = undoAudio(h);
    expect(canRedoAudio(h)).toBe(true);
    h = redoAudio(h);
    expect(samples(h.present.tracks[0]!.channels[0]!)).toEqual([5, 6, 7, 8, 9]);
    h = undoAudio(h);
    h = editAudio(h, 'Rename', (tx) => tx.setMeta('t0', { name: 'Piano' }));
    expect(canRedoAudio(h)).toBe(false);
  });

  it('several steps in one edit are undone together, in the right order', () => {
    let h = createAudioHistory(docWith([ramp(10)]));
    h = editAudio(h, 'Trim to selection', (tx) => {
      tx.splice('t0', 7, 3, [new Float32Array(0)]); // tail
      tx.splice('t0', 0, 2, [new Float32Array(0)]); // head
      tx.setMeta('t0', { offset: 0.2 });
    });
    expect(samples(h.present.tracks[0]!.channels[0]!)).toEqual([2, 3, 4, 5, 6]);
    expect(h.present.tracks[0]!.offset).toBe(0.2);
    h = undoAudio(h);
    expect(samples(h.present.tracks[0]!.channels[0]!)).toEqual(samples(ramp(10)));
    expect(h.present.tracks[0]!.offset).toBe(0);
    h = redoAudio(h);
    expect(samples(h.present.tracks[0]!.channels[0]!)).toEqual([2, 3, 4, 5, 6]);
    expect(h.past.map((c) => c.label)).toEqual(['Trim to selection']);
  });

  it('adds, removes, moves tracks and changes channels; undo puts everything back', () => {
    const start = docWith([ramp(4)], [ramp(4, 10), ramp(4, 20)]);
    let h = createAudioHistory(start);
    h = editAudio(h, 'Add track', (tx) =>
      tx.addTrack(createTrack({ id: 'new', name: 'New', channels: [ramp(2)] })),
    );
    h = editAudio(h, 'Move up', (tx) => tx.moveTrack('new', 0));
    h = editAudio(h, 'Mono', (tx) => tx.setChannels('t1', [ramp(4, 15)]));
    h = editAudio(h, 'Remove', (tx) => tx.removeTrack('t0'));
    expect(h.present.tracks.map((t) => t.id)).toEqual(['new', 't1']);
    expect(h.present.tracks[1]!.channels).toHaveLength(1);
    while (canUndoAudio(h)) h = undoAudio(h);
    expect(h.present.tracks.map((t) => t.id)).toEqual(['t0', 't1']);
    expect(h.present.tracks[1]!.channels.map(samples)).toEqual([
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
          tx.splice('t0', 0, 5, [new Float32Array(0)]);
          throw new EditError('Select some sound first.');
        });
      } catch {
        return h;
      }
    })();
    expect(after).toBe(h);
    expect(samples(h.present.tracks[0]!.channels[0]!)).toEqual(samples(ramp(10)));
  });

  it('an edit that changes nothing is not added to the history', () => {
    const h = createAudioHistory(docWith([ramp(10)]));
    expect(editAudio(h, 'Nothing', () => {})).toBe(h);
  });

  it('refuses a splice outside the track or with the wrong number of channels', () => {
    const h = createAudioHistory(docWith([ramp(10)]));
    expect(() => editAudio(h, 'x', (tx) => tx.splice('t0', 8, 5, [new Float32Array(0)]))).toThrow(
      RangeError,
    );
    expect(() =>
      editAudio(h, 'x', (tx) => tx.splice('t0', 0, 1, [new Float32Array(1), new Float32Array(1)])),
    ).toThrow(RangeError);
    expect(() => editAudio(h, 'x', (tx) => tx.setMeta('missing', { name: 'a' }))).toThrow(
      RangeError,
    );
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
