// The Dialogs port as test fakes: every dialog answers "cancelled" (or Yes to a question) until a
// test says otherwise with mockResolvedValueOnce. One place, so a new dialog is added once.
import { vi } from 'vitest';
import type { Dialogs } from '../../src/core/ports.ts';

export function fakeDialogs() {
  return {
    openMedia: vi.fn<Dialogs['openMedia']>(async () => []),
    openProject: vi.fn<Dialogs['openProject']>(async () => null),
    saveProject: vi.fn<Dialogs['saveProject']>(async () => null),
    exportVideo: vi.fn<Dialogs['exportVideo']>(async () => null),
    exportAudio: vi.fn<Dialogs['exportAudio']>(async () => null),
    confirm: vi.fn<Dialogs['confirm']>(async () => true),
    chooseFolder: vi.fn<Dialogs['chooseFolder']>(async () => null),
    unsavedChanges: vi.fn<Dialogs['unsavedChanges']>(async () => 'cancel'),
    openTaskCheck: vi.fn<Dialogs['openTaskCheck']>(async () => null),
    saveTaskCheck: vi.fn<Dialogs['saveTaskCheck']>(async () => null),
    openAnimation: vi.fn<Dialogs['openAnimation']>(async () => null),
    openPicture: vi.fn<Dialogs['openPicture']>(async () => null),
    openFrames: vi.fn<Dialogs['openFrames']>(async () => []),
    openExport: vi.fn<Dialogs['openExport']>(async () => []),
    saveAnimation: vi.fn<Dialogs['saveAnimation']>(async () => null),
    exportAnimation: vi.fn<Dialogs['exportAnimation']>(async () => null),
  } satisfies Dialogs;
}

export type FakeDialogs = ReturnType<typeof fakeDialogs>;
