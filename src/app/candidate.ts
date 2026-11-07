// File ▸ Candidate Details…: the centre and candidate number (and the student's name) set once and
// kept in the preferences. Every Save and Export dialog then suggests the papers' file name,
// <name>_<centre>_<candidate> (core/exam-name.ts): the app's dialogs are wrapped once, so Video,
// Audio and Animation mode all get it.
import { checkCandidate, examName, type Candidate } from '../core/exam-name.ts';
import type { Dialogs } from '../core/ports.ts';
import type { PreferencesStore } from './preferences.ts';
import { createStore, type Store } from './store.ts';

export interface CandidateView {
  candidate: Candidate | null;
  /** File ▸ Candidate Details… is open. */
  dialog: boolean;
}

/** What the preferences hold, if it is still a valid set of details. */
function fromPreferences(saved: unknown): Candidate | null {
  if (typeof saved !== 'object' || saved === null) return null;
  const { centre, number, name } = saved as Record<string, unknown>;
  if (typeof centre !== 'string' || typeof number !== 'string') return null;
  const checked = checkCandidate({ centre, number, name: typeof name === 'string' ? name : '' });
  return 'candidate' in checked ? checked.candidate : null;
}

export function createCandidateApp(preferences: PreferencesStore) {
  const store: Store<CandidateView> = createStore<CandidateView>({
    candidate: null,
    dialog: false,
  });
  const nameFor = (base: string) => examName(base, store.get().candidate);
  return {
    store,
    async load(): Promise<void> {
      const candidate = fromPreferences((await preferences.read()).candidate);
      store.update((v) => ({ ...v, candidate }));
    },
    /** Saves the details, or says which field is wrong and why (nothing is saved). */
    async set(input: {
      centre: string;
      number: string;
      name: string;
    }): Promise<{ field: keyof Candidate; error: string } | null> {
      const checked = checkCandidate(input);
      if (!('candidate' in checked)) return checked;
      store.update((v) => ({ ...v, candidate: checked.candidate }));
      await preferences.update({ candidate: checked.candidate });
      return null;
    },
    async clear(): Promise<void> {
      store.update((v) => ({ ...v, candidate: null }));
      await preferences.update({ candidate: undefined });
    },
    nameFor,
    /** The dialogs, with every suggested file name in the papers' form. */
    dialogsFor: (dialogs: Dialogs): Dialogs => ({
      ...dialogs,
      saveProject: (name) => dialogs.saveProject(nameFor(name)),
      exportVideo: (name, container) => dialogs.exportVideo(nameFor(name), container),
      exportAudio: (name, format) => dialogs.exportAudio(nameFor(name), format),
      saveAnimation: (name) => dialogs.saveAnimation(nameFor(name)),
      exportAnimation: (name, format) => dialogs.exportAnimation(nameFor(name), format),
      saveGraphic: (name) => dialogs.saveGraphic(nameFor(name)),
      exportGraphic: (name, format) => dialogs.exportGraphic(nameFor(name), format),
    }),
    openDialog: () => store.update((v) => ({ ...v, dialog: true })),
    closeDialog: () => store.update((v) => ({ ...v, dialog: false })),
  };
}

export type CandidateApp = ReturnType<typeof createCandidateApp>;
