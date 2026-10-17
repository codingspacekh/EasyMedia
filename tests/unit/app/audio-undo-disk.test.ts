// A18 + N4: with an undo store (IndexedDB in the app), undo steps keep their samples on disk.
import { describe, expect, it, vi } from 'vitest';
import { createAudioApp, SILENT_OUTPUT } from '../../../src/app/audio.ts';
import { createMockMediaEngine } from '../../../src/adapters/mock/media-engine.ts';
import { changeRefs } from '../../../src/core/audio/stored.ts';
import type { Dialogs, UndoStore } from '../../../src/core/ports.ts';

function memoryStore() {
  const files = new Map<string, Float32Array[]>();
  let n = 0;
  const store: UndoStore & { files: typeof files } = {
    files,
    save: vi.fn(async (channels: readonly Float32Array[]) => {
      const key = `step-${++n}`;
      files.set(
        key,
        channels.map((c) => c.slice()),
      );
      return key;
    }),
    load: vi.fn(async (key: string) => {
      const c = files.get(key);
      if (!c) throw new Error('missing');
      return c.map((x) => x.slice());
    }),
    keepOnly: vi.fn(async (keep: readonly string[]) => {
      for (const key of [...files.keys()]) if (!keep.includes(key)) files.delete(key);
    }),
  };
  return store;
}

async function setup(store = memoryStore()) {
  const engine = createMockMediaEngine({
    '/m/song.mp3': {
      kind: 'audio',
      container: 'mp3',
      duration: 4,
      sizeBytes: 1,
      audio: { codec: 'mp3', sampleRate: 44100, channels: 2 },
    },
  });
  const dialogs = {
    openMedia: vi.fn<Dialogs['openMedia']>(async () => ['/m/song.mp3']),
    exportAudio: vi.fn<Dialogs['exportAudio']>(async () => null),
  };
  const audio = createAudioApp({ engine, dialogs, output: SILENT_OUTPUT, undoStore: store });
  await audio.importAudio();
  await audio.settled();
  return { audio, store, doc: () => audio.store.get().history.present };
}
const first = (doc: { tracks: readonly { channels: readonly Float32Array[] }[] }) => [
  ...doc.tracks[0]!.channels[0]!,
];

describe('undo steps on disk (as Audacity)', () => {
  it('clears what an earlier session left behind when it starts', async () => {
    const { store } = await setup();
    expect(store.keepOnly).toHaveBeenNthCalledWith(1, []);
  });

  it('after an edit, the removed sound moves to disk; undo brings it back exactly', async () => {
    const s = await setup();
    const before = first(s.doc());
    s.audio.selectAll();
    s.audio.cut();
    await s.audio.settled();
    const step = s.audio.store.get().history.past.at(-1)!;
    expect(changeRefs(step)).toHaveLength(1);
    expect(s.store.files.size).toBe(1);
    await s.audio.undo();
    expect(first(s.doc())).toEqual(before);
    await s.audio.settled();
    await s.audio.redo();
    expect(s.doc().tracks[0]!.channels[0]!.length).toBe(0);
  });

  it('steps that can no longer be redone are deleted from disk', async () => {
    const s = await setup();
    s.audio.select({ start: 0, end: 2 });
    s.audio.applyNow('audio.fadein');
    await s.audio.settled();
    await s.audio.undo();
    await s.audio.settled();
    expect(s.store.files.size).toBe(1); // the redo step keeps the faded sound
    s.audio.addTrack(1); // a new edit: nothing can be redone any more
    await s.audio.settled();
    expect(s.store.files.size).toBe(0);
  });

  it('several quick undos happen one after the other, in order', async () => {
    const s = await setup();
    const before = first(s.doc());
    for (let i = 0; i < 2; i++) {
      s.audio.select({ start: 0, end: 1 });
      s.audio.deleteSelection();
    }
    await s.audio.settled();
    await Promise.all([s.audio.undo(), s.audio.undo()]);
    expect(first(s.doc())).toEqual(before);
  });

  it('small steps (track settings) never touch the disk', async () => {
    const s = await setup();
    vi.mocked(s.store.save).mockClear();
    s.audio.setTrack(s.doc().tracks[0]!.id, { gain: -3 });
    await s.audio.settled();
    expect(s.store.save).not.toHaveBeenCalled();
  });

  it('if the disk cannot be written, the step simply stays in memory', async () => {
    const store = memoryStore();
    vi.mocked(store.save).mockRejectedValue(new Error('disk full'));
    const s = await setup(store);
    const before = first(s.doc());
    s.audio.selectAll();
    s.audio.cut();
    await s.audio.settled();
    await s.audio.undo();
    expect(first(s.doc())).toEqual(before);
    expect(s.audio.store.get().message).toBeNull();
  });

  it('if a step on disk has gone missing, undo explains it and changes nothing', async () => {
    const s = await setup();
    s.audio.selectAll();
    s.audio.cut();
    await s.audio.settled();
    s.store.files.clear();
    await s.audio.undo();
    expect(s.doc().tracks[0]!.channels[0]!.length).toBe(0);
    expect(s.audio.store.get().message?.text).toMatch(/could not be undone/i);
  });
});
