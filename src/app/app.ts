// App use cases (ARCHITECTURE §3, P3): what every button and menu item does. The UI only
// calls these and shows the store. Errors never escape: they become a message for the student.
import {
  addMainItem,
  importMedia as importMediaCommand,
  relinkMedia,
  removeItem,
} from './commands.ts';
import { createHistory, execute, redo, undo, type Command, type History } from './history.ts';
import { proxyPathFor } from './proxy-path.ts';
import { createStore, type Store } from './store.ts';
import {
  EditError,
  JobCancelledError,
  MediaError,
  ProjectFileError,
} from '../core/model/errors.ts';
import {
  assetFromProbe,
  createImageClip,
  createProject,
  createVideoClip,
} from '../core/model/factory.ts';
import type { Seconds } from '../core/model/time.ts';
import type { Id, MediaAsset, Project } from '../core/model/types.ts';
import type { AppPaths, Dialogs, MediaEngine, ProbeInfo, ProjectFiles } from '../core/ports.ts';
import { dirOf, fileNameOf, projectFromDisk, projectToDisk } from '../core/project/relocate.ts';
import { deserializeProject, serializeProject } from '../core/project/serialize.ts';

export interface AssetStatus {
  state: 'preparing' | 'ready' | 'failed';
  progress: number;
  /** Small preview copy of a video, once made. */
  proxyPath?: string;
  message?: string;
}

export type ExportState =
  | { state: 'idle' }
  | { state: 'running'; progress: number; output: string }
  | { state: 'done'; output: string }
  | { state: 'failed'; message: string };

export interface AppState {
  history: History;
  /** The .mve file, or null for a project that was never saved. */
  projectPath: string | null;
  /** The project as last saved or opened: anything else is unsaved work. */
  saved: Project;
  assets: Record<Id, AssetStatus>;
  playhead: Seconds;
  selection: Id | null;
  exporting: ExportState;
  message: { kind: 'error' | 'info'; text: string } | null;
}

export interface AppDeps {
  engine: MediaEngine;
  dialogs: Dialogs;
  files: ProjectFiles;
  paths: AppPaths;
  autosaveMs?: number;
}

export const isDirty = (s: AppState): boolean => s.history.present !== s.saved;

export const projectTitle = (s: AppState): string =>
  `${s.projectPath ? fileNameOf(s.projectPath) : 'Untitled'}${isDirty(s) ? ' •' : ''} — EasyMedia`;

const DISCARD = 'You have unsaved changes. Discard them and';
const UNEXPECTED = 'Something went wrong. Please try again.';

export function createApp({ engine, dialogs, files, paths, autosaveMs = 60_000 }: AppDeps) {
  const fresh = createProject({ name: 'Untitled' });
  const store: Store<AppState> = createStore<AppState>({
    history: createHistory(fresh),
    projectPath: null,
    saved: fresh,
    assets: {},
    playhead: 0,
    selection: null,
    exporting: { state: 'idle' },
    message: null,
  });
  const patch = (change: Partial<AppState>) => store.update((s) => ({ ...s, ...change }));
  const present = () => store.get().history.present;
  const setAsset = (id: Id, status: AssetStatus) =>
    store.update((s) => ({ ...s, assets: { ...s.assets, [id]: status } }));

  function showError(error: unknown): void {
    const known =
      error instanceof EditError ||
      error instanceof MediaError ||
      error instanceof ProjectFileError;
    patch({ message: { kind: 'error', text: known ? (error as Error).message : UNEXPECTED } });
  }

  function run(command: Command): void {
    try {
      store.update((s) => ({ ...s, history: execute(s.history, command) }));
    } catch (error) {
      showError(error);
    }
  }

  // Progress of background jobs, routed to the asset or the export they belong to.
  const proxyJobs = new Map<string, Id>();
  let exportJob: { id: string; cancel(): void } | null = null;
  const stopListening = engine.onJobEvent((e) => {
    if (e.type !== 'progress') return;
    const assetId = proxyJobs.get(e.jobId);
    if (assetId) setAsset(assetId, { state: 'preparing', progress: e.ratio });
    const ex = store.get().exporting;
    if (exportJob?.id === e.jobId && ex.state === 'running')
      patch({ exporting: { ...ex, progress: e.ratio } });
  });

  /** Checks a media file and, for video, makes (or reuses) its preview proxy. */
  async function prepare(asset: MediaAsset, known?: ProbeInfo): Promise<void> {
    let info = known;
    if (!info) {
      try {
        info = await engine.probe(asset.path);
      } catch (error) {
        setAsset(asset.id, { state: 'failed', progress: 0, message: (error as Error).message });
        return;
      }
    }
    if (asset.kind !== 'video') {
      setAsset(asset.id, { state: 'ready', progress: 1 });
      return;
    }
    const proxyPath = proxyPathFor(paths.proxies, asset.path, info.sizeBytes);
    setAsset(asset.id, { state: 'preparing', progress: 0 });
    try {
      await engine.probe(proxyPath); // made earlier: reuse it
    } catch {
      const job = engine.makeProxy(asset.path, proxyPath, asset.duration ?? 0);
      proxyJobs.set(job.id, asset.id);
      try {
        await job.done;
      } catch (error) {
        setAsset(asset.id, { state: 'failed', progress: 0, message: (error as Error).message });
        return;
      } finally {
        proxyJobs.delete(job.id);
      }
    }
    setAsset(asset.id, { state: 'ready', progress: 1, proxyPath });
  }

  function load(project: Project, projectPath: string | null, saved: Project = project): void {
    patch({
      history: createHistory(project),
      projectPath,
      saved,
      assets: {},
      playhead: 0,
      selection: null,
      exporting: { state: 'idle' },
      message: null,
    });
    for (const asset of project.media) void prepare(asset);
  }

  async function writeProject(path: string): Promise<void> {
    const project = present();
    try {
      await files.write(path, serializeProject(projectToDisk(project, dirOf(path))));
      patch({ projectPath: path, saved: project });
      await files.remove(paths.recovery).catch(() => {});
    } catch (error) {
      showError(error);
    }
  }

  async function saveAs(): Promise<void> {
    const current = store.get().projectPath;
    const name = current ? fileNameOf(current).replace(/\.mve$/i, '') : present().name;
    const path = await dialogs.saveProject(name);
    if (path) await writeProject(path);
  }

  // P3: autosave every minute when there are changes.
  let lastRecovery: Project | null = null;
  const timer = setInterval(() => {
    const s = store.get();
    if (!isDirty(s)) return;
    if (s.projectPath) {
      void writeProject(s.projectPath);
    } else if (lastRecovery !== s.history.present) {
      lastRecovery = s.history.present;
      void files.write(paths.recovery, serializeProject(s.history.present)).catch(() => {});
    }
  }, autosaveMs);
  (timer as { unref?: () => void }).unref?.();

  return {
    store,

    /** On start-up: offers to restore work that was never saved (P3). */
    async start(): Promise<void> {
      let text: string;
      try {
        text = await files.read(paths.recovery);
      } catch {
        return; // nothing to recover
      }
      try {
        const lost = projectFromDisk(deserializeProject(text), dirOf(paths.recovery));
        if (await dialogs.confirm('EasyMedia closed before your work was saved. Restore it?')) {
          load(lost, null, createProject({ name: 'Untitled' }));
          return;
        }
      } catch {
        // a damaged recovery file is simply discarded
      }
      await files.remove(paths.recovery).catch(() => {});
    },

    async importMedia(): Promise<void> {
      const chosen = await dialogs.openMedia();
      for (const path of chosen) {
        let info: ProbeInfo;
        try {
          info = await engine.probe(path);
        } catch (error) {
          showError(error);
          continue;
        }
        const asset = assetFromProbe(path, info);
        const before = present();
        run(importMediaCommand(asset));
        if (present() !== before) void prepare(asset, info);
      }
    },

    /** P6: asks where a missing file is now and points the project to it. */
    async locate(assetId: Id): Promise<void> {
      const [path] = await dialogs.openMedia();
      if (!path) return;
      try {
        const info = await engine.probe(path);
        const replacement = assetFromProbe(path, info, { id: assetId });
        const before = present();
        run(relinkMedia(assetId, replacement));
        if (present() !== before) await prepare(replacement, info);
      } catch (error) {
        showError(error);
      }
    },

    addToTimeline(assetId: Id): void {
      const asset = present().media.find((m) => m.id === assetId);
      if (!asset) return;
      if (asset.kind === 'audio') {
        patch({
          message: {
            kind: 'info',
            text: 'Sound files go on the music track, which arrives in a later version.',
          },
        });
        return;
      }
      run(addMainItem(asset.kind === 'video' ? createVideoClip(asset) : createImageClip(asset)));
    },

    /** For inspector fields: applies the edit, or returns why it is not allowed (shown by the field). */
    edit(command: Command): string | null {
      try {
        store.update((s) => ({ ...s, history: execute(s.history, command) }));
        return null;
      } catch (error) {
        return error instanceof EditError ? error.message : UNEXPECTED;
      }
    },

    select: (id: Id | null) => patch({ selection: id }),

    removeSelected(): void {
      const { selection } = store.get();
      if (!selection) return;
      run(removeItem(selection));
      patch({ selection: null });
    },

    undo: () => patch({ history: undo(store.get().history) }),
    redo: () => patch({ history: redo(store.get().history) }),
    setPlayhead: (time: Seconds) => patch({ playhead: Math.max(0, time) }),
    dismissMessage: () => patch({ message: null }),

    /** P2: copies the project and all its media into one folder, for handing in or moving. */
    async packageProject(): Promise<void> {
      const s = store.get();
      const project = present();
      if (project.media.some((m) => s.assets[m.id]?.state === 'failed')) {
        patch({
          message: {
            kind: 'error',
            text: 'Locate the missing files before packaging the project.',
          },
        });
        return;
      }
      const dir = await dialogs.chooseFolder('Choose an empty folder for the packaged project');
      if (!dir) return;
      const name = s.projectPath ? fileNameOf(s.projectPath).replace(/\.mve$/i, '') : project.name;
      try {
        const used = new Set<string>();
        const media: MediaAsset[] = [];
        for (const asset of project.media) {
          const file = uniqueName(fileNameOf(asset.path), used);
          await files.copy(asset.path, `${dir}/media/${file}`);
          media.push({ ...asset, path: `media/${file}` });
        }
        await files.write(`${dir}/${name}.mve`, serializeProject({ ...project, media }));
        patch({
          message: {
            kind: 'info',
            text: `Packaged into ${dir}. Open ${name}.mve there on any computer.`,
          },
        });
      } catch (error) {
        showError(error);
      }
    },

    async exportVideo(): Promise<void> {
      const project = present();
      if (project.timeline.main.length === 0) {
        patch({ message: { kind: 'error', text: 'Add a clip to the timeline before exporting.' } });
        return;
      }
      const { projectPath } = store.get();
      const output = await dialogs.exportVideo(
        projectPath ? fileNameOf(projectPath).replace(/\.mve$/i, '') : project.name,
      );
      if (!output) return;
      const job = engine.renderVideo(project, output, {
        projectDir: projectPath ? dirOf(projectPath) : '/',
      });
      exportJob = job;
      patch({ exporting: { state: 'running', progress: 0, output } });
      try {
        await job.done;
        patch({ exporting: { state: 'done', output } });
      } catch (error) {
        if (error instanceof JobCancelledError) {
          patch({ exporting: { state: 'idle' } });
        } else {
          showError(error);
          patch({
            exporting: { state: 'failed', message: store.get().message?.text ?? UNEXPECTED },
          });
        }
      } finally {
        exportJob = null;
      }
    },

    cancelExport: () => exportJob?.cancel(),

    async save(): Promise<void> {
      const { projectPath } = store.get();
      if (projectPath) await writeProject(projectPath);
      else await saveAs();
    },

    saveAs,

    async open(): Promise<void> {
      if (isDirty(store.get()) && !(await dialogs.confirm(`${DISCARD} open another project?`)))
        return;
      const path = await dialogs.openProject();
      if (!path) return;
      try {
        load(projectFromDisk(deserializeProject(await files.read(path)), dirOf(path)), path);
      } catch (error) {
        showError(error);
      }
    },

    async newProject(): Promise<void> {
      if (isDirty(store.get()) && !(await dialogs.confirm(`${DISCARD} start a new project?`)))
        return;
      load(createProject({ name: 'Untitled' }), null);
    },

    dispose(): void {
      clearInterval(timer);
      stopListening();
    },
  };
}

export type App = ReturnType<typeof createApp>;

/** "clip.mp4", then "clip-2.mp4", "clip-3.mp4"… for files with the same name. */
function uniqueName(file: string, used: Set<string>): string {
  const dot = file.lastIndexOf('.');
  const [base, ext] = dot > 0 ? [file.slice(0, dot), file.slice(dot)] : [file, ''];
  let name = file;
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}-${n}${ext}`;
  used.add(name.toLowerCase());
  return name;
}
