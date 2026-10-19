import { describe, expect, it } from 'vitest';
import {
  alignEndToEnd,
  alignStartTo,
  applyToSelection,
  copyRange,
  deleteClips,
  deleteRange,
  docDuration,
  insertSilence,
  joinClip,
  moveClip,
  splitAt,
  trimClip,
  mixAndRender,
  mixTracks,
  moveTrackBy,
  paste,
  stereoToMonoTracks,
  trimToSelection,
  type Selection,
} from '../../../../src/core/audio/edit.ts';
import {
  createAudioHistory,
  editAudio,
  undoAudio,
  type AudioEdit,
} from '../../../../src/core/audio/history.ts';
import {
  clipChannels,
  createTrack,
  trackSound,
  trackStart,
  type AudioDoc,
  type AudioTrack,
} from '../../../../src/core/audio/pcm.ts';
import { EditError } from '../../../../src/core/model/errors.ts';

const RATE = 10;
const ramp = (n: number, from = 1) => Float32Array.from({ length: n }, (_, i) => from + i);
/** The track's sound, clips and gaps together. */
const ch = (track: AudioTrack, c = 0) => [...trackSound(track, RATE).channels[c]!];
const offsetOf = (track: AudioTrack) => trackStart(track);

function doc(...tracks: { channels: Float32Array[]; offset?: number }[]): AudioDoc {
  return {
    rate: RATE,
    tracks: tracks.map((t, i) => createTrack({ id: `t${i}`, name: `T${i}`, ...t })),
  };
}
const sel = (start: number, end: number, ...tracks: string[]): Selection => ({
  start,
  end,
  tracks,
});
/** Ids for new clips: n1, n2… */
function ids() {
  let n = 0;
  return () => `n${++n}`;
}
const clipsOf = (track: AudioTrack) =>
  [...track.clips]
    .sort((a, b) => a.offset - b.offset)
    .map((c) => ({ id: c.id, offset: c.offset, sound: [...clipChannels(c)[0]!] }));
function run(d: AudioDoc, edit: (tx: AudioEdit) => void): AudioDoc {
  return editAudio(createAudioHistory(d), 'edit', edit).present;
}

describe('A5 cut / delete a range', () => {
  it('removes the selected time and closes the gap', () => {
    const out = run(doc({ channels: [ramp(10)] }), (tx) => deleteRange(tx, sel(0.2, 0.5, 't0')));
    expect(ch(out.tracks[0]!)).toEqual([1, 2, 6, 7, 8, 9, 10]);
  });

  it('Book B 11.2.4: cutting from 19.1 s to after the end leaves exactly 19.1 s', () => {
    const d: AudioDoc = {
      rate: 100,
      tracks: [createTrack({ id: 'a', name: 'a', channels: [new Float32Array(4000)] })],
    };
    const out = run(d, (tx) => deleteRange(tx, sel(19.1, 48, 'a')));
    expect(trackSound(out.tracks[0]!, 100).channels[0]!.length / 100).toBe(19.1);
  });

  it('a selection that starts before a track’s sound moves what is left to the selection start', () => {
    const out = run(doc({ channels: [ramp(10)], offset: 1 }), (tx) =>
      deleteRange(tx, sel(0.5, 1.3, 't0')),
    );
    expect(ch(out.tracks[0]!)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(offsetOf(out.tracks[0]!)).toBe(0.5);
  });

  it('a selected track that starts after the selection moves earlier; other tracks stay', () => {
    const out = run(
      doc({ channels: [ramp(5)], offset: 2 }, { channels: [ramp(5)], offset: 2 }),
      (tx) => deleteRange(tx, sel(0, 1, 't0')),
    );
    expect(out.tracks.map(offsetOf)).toEqual([1, 2]);
  });

  it('needs a selected track and a selection with a length', () => {
    const d = doc({ channels: [ramp(10)] });
    expect(() => run(d, (tx) => deleteRange(tx, sel(0.2, 0.5)))).toThrow(/select a track/i);
    expect(() => run(d, (tx) => deleteRange(tx, sel(0.2, 0.2, 't0')))).toThrow(EditError);
  });
});

describe('A5 copy and paste (A6 splice between tracks)', () => {
  it('copies the selected part of the first selected track', () => {
    const clip = copyRange(doc({ channels: [ramp(10)] }), sel(0.3, 0.6, 't0'));
    expect(clip.channels.map((c) => [...c])).toEqual([[4, 5, 6]]);
  });

  it('refuses to copy where there is no sound', () => {
    expect(() => copyRange(doc({ channels: [ramp(10)] }), sel(2, 3, 't0'))).toThrow(
      /no sound in the selection/i,
    );
  });

  it('Book A 11.18: pasting at a point inserts the copy there and makes the track longer', () => {
    const d = doc({ channels: [ramp(5)] }, { channels: [ramp(5, 100)] });
    const clip = copyRange(d, sel(0.1, 0.3, 't1'));
    const out = run(d, (tx) => paste(tx, sel(0.2, 0.2, 't0'), clip, ids()));
    expect(ch(out.tracks[0]!)).toEqual([1, 2, 101, 102, 3, 4, 5]);
  });

  it('pasting over a selection replaces it', () => {
    const out = run(doc({ channels: [ramp(5)] }), (tx) =>
      paste(tx, sel(0.1, 0.4, 't0'), { channels: [new Float32Array([0])] }, ids()),
    );
    expect(ch(out.tracks[0]!)).toEqual([1, 0, 5]);
  });

  it('pasting after the end or before the start fills the gap with silence (later sound moves on)', () => {
    const clip = { channels: [new Float32Array([9])] };
    const after = run(doc({ channels: [ramp(2)] }), (tx) =>
      paste(tx, sel(0.4, 0.4, 't0'), clip, ids()),
    );
    expect(ch(after.tracks[0]!)).toEqual([1, 2, 0, 0, 9]);
    const before = run(doc({ channels: [ramp(2)], offset: 0.5 }), (tx) =>
      paste(tx, sel(0.2, 0.2, 't0'), clip, ids()),
    );
    expect(ch(before.tracks[0]!)).toEqual([9, 0, 0, 0, 1, 2]);
    expect(offsetOf(before.tracks[0]!)).toBe(0.2);
  });

  it('pasting into an empty track starts it at the cursor', () => {
    const out = run(doc({ channels: [new Float32Array(0)] }), (tx) =>
      paste(tx, sel(1.5, 1.5, 't0'), { channels: [new Float32Array([7, 8])] }, ids()),
    );
    expect([offsetOf(out.tracks[0]!), ...ch(out.tracks[0]!)]).toEqual([1.5, 7, 8]);
  });

  it('a stereo copy pasted into a mono track is mixed to mono', () => {
    const out = run(doc({ channels: [ramp(1)] }), (tx) =>
      paste(
        tx,
        sel(0, 0, 't0'),
        { channels: [new Float32Array([1]), new Float32Array([0])] },
        ids(),
      ),
    );
    expect(ch(out.tracks[0]!)).toEqual([0.5, 1]);
  });

  it('a mono copy pasted into a stereo track goes into both sides', () => {
    const out = run(doc({ channels: [ramp(2), ramp(2)] }), (tx) =>
      paste(tx, sel(0, 0, 't0'), { channels: [new Float32Array([5])] }, ids()),
    );
    expect([ch(out.tracks[0]!, 0), ch(out.tracks[0]!, 1)]).toEqual([
      [5, 1, 2],
      [5, 1, 2],
    ]);
  });
});

describe('A5 trim to selection and insert silence', () => {
  it('keeps only the selection, where it was', () => {
    const out = run(doc({ channels: [ramp(10)] }), (tx) =>
      trimToSelection(tx, sel(0.2, 0.5, 't0')),
    );
    expect(ch(out.tracks[0]!)).toEqual([3, 4, 5]);
    expect(offsetOf(out.tracks[0]!)).toBe(0.2);
  });

  it('empties a selected track that has no sound in the selection', () => {
    const out = run(doc({ channels: [ramp(10)] }, { channels: [ramp(3)], offset: 2 }), (tx) =>
      trimToSelection(tx, sel(0.2, 0.5, 't0', 't1')),
    );
    expect(out.tracks[1]!.clips).toEqual([]);
  });

  it('inserts silence at the cursor, pushing the rest later', () => {
    const out = run(doc({ channels: [ramp(4)] }), (tx) =>
      insertSilence(tx, sel(0.2, 0.2, 't0'), 0.3, ids()),
    );
    expect(ch(out.tracks[0]!)).toEqual([1, 2, 0, 0, 0, 3, 4]);
  });

  it('with a selection, replaces it with silence of the chosen length', () => {
    const out = run(doc({ channels: [ramp(6)] }), (tx) =>
      insertSilence(tx, sel(0.1, 0.4, 't0'), 0.1, ids()),
    );
    expect(ch(out.tracks[0]!)).toEqual([1, 0, 5, 6]);
  });

  it('refuses a length of 0 or less', () => {
    expect(() =>
      run(doc({ channels: [ramp(4)] }), (tx) => insertSilence(tx, sel(0, 0, 't0'), 0, ids())),
    ).toThrow(EditError);
  });
});

describe('effects on the selection', () => {
  it('apply only to the selected part of each selected track', () => {
    const out = run(doc({ channels: [ramp(6)] }, { channels: [ramp(6)] }), (tx) =>
      applyToSelection(tx, sel(0.2, 0.4, 't0'), (c) => c.map((x) => x.map(() => 0))),
    );
    expect(ch(out.tracks[0]!)).toEqual([1, 2, 0, 0, 5, 6]);
    expect(ch(out.tracks[1]!)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('may change the length (change speed): later sound moves up', () => {
    const out = run(doc({ channels: [ramp(6)] }), (tx) =>
      applyToSelection(tx, sel(0, 0.4, 't0'), (c) => c.map((x) => x.slice(0, 2))),
    );
    expect(ch(out.tracks[0]!)).toEqual([1, 2, 5, 6]);
  });

  it('refuse a selection with no sound in it', () => {
    expect(() =>
      run(doc({ channels: [ramp(6)] }), (tx) =>
        applyToSelection(tx, sel(3, 4, 't0'), (c) => [...c]),
      ),
    ).toThrow(/no sound in the selection/i);
  });

  it('A18 undo restores the exact original samples', () => {
    const before = doc({ channels: [ramp(6)] });
    let h = createAudioHistory(before);
    h = editAudio(h, 'Silence', (tx) =>
      applyToSelection(tx, sel(0, 0.6, 't0'), (c) => c.map((x) => x.map(() => 0))),
    );
    expect(ch(undoAudio(h).present.tracks[0]!)).toEqual(ch(before.tracks[0]!));
  });
});

describe('A2 / A6 / A15 Tracks menu', () => {
  it('A15 mixes a stereo track down to mono', () => {
    const out = run(doc({ channels: [new Float32Array([1, 1]), new Float32Array([0, 0])] }), (tx) =>
      stereoToMonoTracks(tx, ['t0']),
    );
    expect(out.tracks[0]!.channelCount).toBe(1);
    expect(clipChannels(out.tracks[0]!.clips[0]!).map((c) => [...c])).toEqual([[0.5, 0.5]]);
  });

  it('A15 refuses when no selected track is stereo', () => {
    expect(() => run(doc({ channels: [ramp(2)] }), (tx) => stereoToMonoTracks(tx, ['t0']))).toThrow(
      /already mono/i,
    );
  });

  it('A2 moves a track up and down (not past the ends)', () => {
    const d = doc({ channels: [ramp(1)] }, { channels: [ramp(1)] });
    expect(run(d, (tx) => moveTrackBy(tx, 't1', -1)).tracks.map((t) => t.id)).toEqual(['t1', 't0']);
    expect(run(d, (tx) => moveTrackBy(tx, 't1', 1)).tracks.map((t) => t.id)).toEqual(['t0', 't1']);
  });

  it('A2 Align end to end: each selected track starts where the one above ends', () => {
    const d = doc(
      { channels: [ramp(19)] },
      { channels: [ramp(30)], offset: 4 },
      { channels: [ramp(5)] },
    );
    const out = run(d, (tx) => alignEndToEnd(tx, ['t0', 't1', 't2']));
    expect(out.tracks.map(offsetOf)).toEqual([0, 1.9, 4.9]);
  });

  it('A2 Align start to the cursor, and to zero', () => {
    const d = doc({ channels: [ramp(3)] }, { channels: [ramp(3)], offset: 2 });
    expect(run(d, (tx) => alignStartTo(tx, ['t0', 't1'], 1.5)).tracks.map(offsetOf)).toEqual([
      1.5, 1.5,
    ]);
    expect(offsetOf(run(d, (tx) => alignStartTo(tx, ['t1'], 0)).tracks[1]!)).toBe(0);
  });

  it('A6 Mix and render: two aligned clips become one track, the sample-wise sum (clipped)', () => {
    const d = doc(
      { channels: [new Float32Array([0.5, 0.5, 0.5])] },
      { channels: [new Float32Array([0.25, 0.75, -0.5])], offset: 0.1 },
    );
    const out = run(d, (tx) => mixAndRender(tx, ['t0', 't1'], { id: 'mix', name: 'Mix' }));
    expect(out.tracks.map((t) => t.id)).toEqual(['mix']);
    expect(ch(out.tracks[0]!)).toEqual([0.5, 0.75, 1, -0.5]);
  });

  it('A6 Mix and render needs a selected track with sound', () => {
    const d = doc({ channels: [new Float32Array(0)] });
    expect(() => run(d, (tx) => mixAndRender(tx, [], { id: 'm', name: 'Mix' }))).toThrow(
      /select a track/i,
    );
    expect(() => run(d, (tx) => mixAndRender(tx, ['t0'], { id: 'm', name: 'Mix' }))).toThrow(
      /no sound/i,
    );
  });

  it('A2 Align end to end needs two tracks', () => {
    expect(() => run(doc({ channels: [ramp(2)] }), (tx) => alignEndToEnd(tx, ['t0']))).toThrow(
      /two or more tracks/i,
    );
  });

  it('A6 Mix and render to a new track keeps the originals', () => {
    const d = doc({ channels: [ramp(2)] }, { channels: [ramp(2)] });
    const out = run(d, (tx) =>
      mixAndRender(tx, ['t0', 't1'], { id: 'mix', name: 'Mix', newTrack: true }),
    );
    expect(out.tracks.map((t) => t.id)).toEqual(['t0', 't1', 'mix']);
  });

  it('A6 a mix is stereo if any track is stereo, and starts at the earliest track', () => {
    const d = doc(
      { channels: [new Float32Array([0.5])], offset: 1 },
      { channels: [new Float32Array([0.1]), new Float32Array([0.2])], offset: 1.1 },
    );
    const out = run(d, (tx) => mixAndRender(tx, ['t0', 't1'], { id: 'm', name: 'Mix' }));
    expect(offsetOf(out.tracks[0]!)).toBe(1);
    expect([ch(out.tracks[0]!, 0), ch(out.tracks[0]!, 1)]).toEqual(
      [
        [0.5, 0.1],
        [0.5, 0.2],
      ].map((c) => c.map((v) => Math.fround(v))),
    );
  });

  it('track gain and pan are used in the mix', () => {
    const d: AudioDoc = {
      rate: RATE,
      tracks: [
        createTrack({
          id: 'a',
          name: 'a',
          channels: [new Float32Array([0.5])],
          gain: -6.0206,
          pan: 0.5,
        }),
      ],
    };
    const [l, r] = mixTracks(d, d.tracks, { channels: 2 }).channels;
    expect(l![0]).toBeCloseTo(0.25 * 0.5, 4);
    expect(r![0]).toBeCloseTo(0.25, 4);
  });

  it('mixTracks for export starts at 0 s and lasts until the last track ends', () => {
    const d = doc({ channels: [ramp(2)], offset: 0.5 });
    const mix = mixTracks(d, d.tracks, { from: 0 });
    expect(mix.channels[0]!.length).toBe(7);
    expect(docDuration(d)).toBe(0.7);
  });
});

describe('clips, as on the video timeline', () => {
  it('Split cuts the clip under the playhead in two; the halves share their samples', () => {
    const d = doc({ channels: [ramp(10)] });
    const out = run(d, (tx) => splitAt(tx, ['t0'], 0.4, ids()));
    expect(clipsOf(out.tracks[0]!)).toEqual([
      { id: 't0.c', offset: 0, sound: [1, 2, 3, 4] },
      { id: 'n1', offset: 0.4, sound: [5, 6, 7, 8, 9, 10] },
    ]);
    expect(out.tracks[0]!.clips[1]!.source).toBe(d.tracks[0]!.clips[0]!.source);
    expect(ch(out.tracks[0]!)).toEqual(ch(d.tracks[0]!)); // it sounds the same
  });

  it('Split works on every given track with a clip under the playhead', () => {
    const d = doc({ channels: [ramp(10)] }, { channels: [ramp(10)] }, { channels: [ramp(2)] });
    const out = run(d, (tx) => splitAt(tx, ['t0', 't1', 't2'], 0.5, ids()));
    expect(out.tracks.map((t) => t.clips.length)).toEqual([2, 2, 1]);
  });

  it('Split needs the playhead over a clip (not on its edge)', () => {
    const d = doc({ channels: [ramp(10)] });
    expect(() => run(d, (tx) => splitAt(tx, ['t0'], 1, ids()))).toThrow(
      /move the playhead over a clip/i,
    );
    expect(() => run(d, (tx) => splitAt(tx, [], 0.5, ids()))).toThrow(/select a track/i);
  });

  it('a clip moves along its track; it may not overlap another clip', () => {
    const d = run(doc({ channels: [ramp(10)] }), (tx) => splitAt(tx, ['t0'], 0.4, ids()));
    const moved = run(d, (tx) => moveClip(tx, 'n1', 1.234));
    expect(clipsOf(moved.tracks[0]!)[1]!.offset).toBe(1.2); // to a whole sample
    expect(ch(moved.tracks[0]!)).toEqual([1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 5, 6, 7, 8, 9, 10]);
    expect(() => run(d, (tx) => moveClip(tx, 'n1', 0.2))).toThrow(/overlaps another clip/i);
    expect(clipsOf(run(d, (tx) => moveClip(tx, 't0.c', -5)).tracks[0]!)[0]!.offset).toBe(0);
  });

  it('dragging an edge trims the clip; dragging it back brings the sound back', () => {
    const d = doc({ channels: [ramp(10)] });
    const trimmed = run(d, (tx) => {
      trimClip(tx, 't0.c', 'start', 0.3);
      trimClip(tx, 't0.c', 'end', 0.8);
    });
    expect(clipsOf(trimmed.tracks[0]!)).toEqual([
      { id: 't0.c', offset: 0.3, sound: [4, 5, 6, 7, 8] },
    ]);
    const back = run(trimmed, (tx) => {
      trimClip(tx, 't0.c', 'start', 0);
      trimClip(tx, 't0.c', 'end', 5);
    });
    expect(clipsOf(back.tracks[0]!)).toEqual([
      { id: 't0.c', offset: 0, sound: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    ]);
  });

  it('a trimmed edge stops at the next clip and keeps at least one sample', () => {
    const d = run(doc({ channels: [ramp(10)] }), (tx) => {
      splitAt(tx, ['t0'], 0.4, ids());
      trimClip(tx, 't0.c', 'end', 0.2);
    });
    const out = run(d, (tx) => {
      trimClip(tx, 't0.c', 'end', 0.9); // stops at the clip that starts at 0.4 s
      trimClip(tx, 'n1', 'start', 3); // keeps one sample
    });
    expect(clipsOf(out.tracks[0]!)).toEqual([
      { id: 't0.c', offset: 0, sound: [1, 2, 3, 4] },
      { id: 'n1', offset: 0.9, sound: [10] },
    ]);
  });

  it('Delete removes clips and leaves the gap (later clips stay where they are)', () => {
    const d = run(doc({ channels: [ramp(10)] }), (tx) => splitAt(tx, ['t0'], 0.4, ids()));
    const out = run(d, (tx) => deleteClips(tx, ['t0.c']));
    expect(clipsOf(out.tracks[0]!)).toEqual([
      { id: 'n1', offset: 0.4, sound: [5, 6, 7, 8, 9, 10] },
    ]);
    expect(() => run(d, (tx) => deleteClips(tx, []))).toThrow(/click a clip/i);
  });

  it('Join puts a split clip back together (no samples copied)', () => {
    const d = run(doc({ channels: [ramp(10)] }), (tx) => splitAt(tx, ['t0'], 0.4, ids()));
    const out = run(d, (tx) => joinClip(tx, 't0.c'));
    expect(clipsOf(out.tracks[0]!)).toEqual([
      { id: 't0.c', offset: 0, sound: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    ]);
    expect(out.tracks[0]!.clips[0]!.source).toBe(d.tracks[0]!.clips[0]!.source);
  });

  it('Join joins any two clips that touch, one after the other', () => {
    const d = doc({ channels: [ramp(3)] });
    const two = run(d, (tx) =>
      paste(tx, sel(0.3, 0.3, 't0'), { channels: [new Float32Array([7, 8])] }, ids()),
    );
    const out = run(two, (tx) => joinClip(tx, 't0.c'));
    expect(clipsOf(out.tracks[0]!)).toEqual([{ id: 't0.c', offset: 0, sound: [1, 2, 3, 7, 8] }]);
  });

  it('Join needs a clip right after this one', () => {
    const d = run(doc({ channels: [ramp(10)] }), (tx) => {
      splitAt(tx, ['t0'], 0.4, ids());
      moveClip(tx, 'n1', 0.6);
    });
    expect(() => run(d, (tx) => joinClip(tx, 't0.c'))).toThrow(/no clip right after/i);
  });

  it('range edits work across clips and gaps', () => {
    const d = run(doc({ channels: [ramp(10)] }), (tx) => {
      splitAt(tx, ['t0'], 0.4, ids());
      moveClip(tx, 'n1', 0.6);
    });
    // 1 2 3 4 _ _ 5 6 7 8 9 10: delete 0.3 – 0.7 s
    const cut = run(d, (tx) => deleteRange(tx, sel(0.3, 0.7, 't0')));
    expect(ch(cut.tracks[0]!)).toEqual([1, 2, 3, 6, 7, 8, 9, 10]);
    expect(copyRange(d, sel(0.3, 0.7, 't0')).channels.map((c) => [...c])).toEqual([[4, 0, 0, 5]]);
    const silenced = run(d, (tx) =>
      applyToSelection(tx, sel(0.3, 0.7, 't0'), (c) => c.map((x) => x.map(() => 0))),
    );
    expect(ch(silenced.tracks[0]!)).toEqual([1, 2, 3, 0, 0, 0, 0, 6, 7, 8, 9, 10]);
    const trimmed = run(d, (tx) => trimToSelection(tx, sel(0.3, 0.7, 't0')));
    expect(clipsOf(trimmed.tracks[0]!)).toEqual([
      { id: 't0.c', offset: 0.3, sound: [4] },
      { id: 'n1', offset: 0.6, sound: [5] },
    ]);
  });

  it('an effect that changes the length moves the later clips with it', () => {
    const d = run(doc({ channels: [ramp(10)] }), (tx) => {
      splitAt(tx, ['t0'], 0.4, ids());
      moveClip(tx, 'n1', 0.6);
    });
    const out = run(d, (tx) =>
      applyToSelection(tx, sel(0, 0.4, 't0'), (c) => c.map((x) => x.slice(0, 2))),
    );
    expect(clipsOf(out.tracks[0]!).map((c) => c.offset)).toEqual([0, 0.4]);
  });
});
