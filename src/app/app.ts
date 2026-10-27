// App use cases (ARCHITECTURE §3, P3): what every button and menu item does. The UI only
// calls these and shows the store. Errors never escape: they become a message for the student.
import {
  addAudioItem,
  addMainItem,
  addTextItem,
  importMedia as importMediaCommand,
  relinkMedia,
  removeItem,
} from './commands.ts';
import { createAudioApp, SILENT_OUTPUT, type AudioOutput } from './audio.ts';
import { createLearnApp } from './learn.ts';
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
  createAudioItem,
  createImageClip,
  createProject,
  createTextItem,
  createTitleSlide,
  createVideoClip,
} from '../core/model/factory.ts';
import type { Seconds } from '../core/model/time.ts';
import { findMainItemAt, mainTrackDuration, setItemDuration } from '../core/model/timeline.ts';
import type { AudioModeSession, Id, MediaAsset, Project, TextItem } from '../core/model/types.ts';
import type {
  AppPaths,
  Dialogs,
  MediaEngine,
  ProbeInfo,
  ProjectFiles,
  TextRenderer,
  Recorder,
  UndoStore,
} from '../core/ports.ts';
import { projectHasSound, type TextImage } from '../core/render/compile.ts';
import { defaultExport, estimateSize, type ExportSettings } from '../core/render/formats.ts';
import { dirOf, fileNameOf, projectFromDisk, projectToDisk } from '../core/project/relocate.ts';
import { planResizeCrop, type Anchor, type CropRegion } from '../core/image/crop.ts';
import { deserializeProject, serializeProject } from '../core/project/serialize.ts';

export interface AssetStatus {
  state: 'preparing' | 'ready' | 'failed';
  progress: number;
  /** Small preview copy of a video, once made. */
  proxyPath?: string;
  /** Pixel size of a picture or video, from the probe (V11 and the media bin use it). */
  size?: { width: number; height: number };
  /** Frames per second of a video. */
  fps?: number;
  /** One small frame of a video, for the media bin and the timeline. */
  thumbPath?: string;
  /** Loudness peaks (0–1) of a sound file, 10 per second, for drawing its waveform (V13). */
  peaks?: number[];
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
  /** Audio mode has edits that are not saved yet (it is saved with the project, P1). */
  audioDirty: boolean;
  assets: Record<Id, AssetStatus>;
  playhead: Seconds;
  selection: Id | null;
  exporting: ExportState;
  message: { kind: 'error' | 'info'; text: string } | null;
  /** X7: the Welcome is showing (on the first launch, or from Help ▸ Welcome). */
  welcome: boolean;
  /** Help ▸ Licences: the text of THIRD_PARTY_LICENSES while it is showing. */
  licences: string | null;
}

export interface AppDeps {
  engine: MediaEngine;
  dialogs: Dialogs;
  files: ProjectFiles;
  text: TextRenderer;
  paths: AppPaths;
  /** Speakers for Audio mode (Web Audio in the app). */
  audioOutput?: AudioOutput;
  /** Where Audio mode keeps its undo steps (on disk in the app; in memory without it). */
  audioUndoStore?: UndoStore;
  /** A14: the microphone for recording in Audio mode (MediaStream in the app). */
  audioRecorder?: Recorder;
  autosaveMs?: number;
}

export const isDirty = (s: AppState): boolean => s.history.present !== s.saved || s.audioDirty;

export const projectTitle = (s: AppState): string =>
  `${s.projectPath ? fileNameOf(s.projectPath) : 'Untitled'}${isDirty(s) ? ' •' : ''} — EasyMedia`;

const PEAKS_PER_SECOND = 10;
const DISCARD = 'You have unsaved changes. Discard them and';
const UNEXPECTED = 'Something went wrong. Please try again.';
const NEW_TEXT: Record<TextItem['kind'], string> = {
  caption: 'Caption',
  subtitle: 'Subtitle',
  credits: 'Made by\nYour name',
};

export function createApp({
  engine,
  dialogs,
  files,
  text,
  paths,
  audioOutput = SILENT_OUTPUT,
  audioUndoStore,
  audioRecorder,
  autosaveMs = 60_000,
}: AppDeps) {
  const fresh = createProject({ name: 'Untitled' });
  const store: Store<AppState> = createStore<AppState>({
    history: createHistory(fresh),
    projectPath: null,
    saved: fresh,
    audioDirty: false,
    assets: {},
    playhead: 0,
    selection: null,
    exporting: { state: 'idle' },
    message: null,
    welcome: false,
    licences: null,
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
    const size = info.video && { width: info.video.width, height: info.video.height };
    const facts = {
      ...(size ? { size } : {}),
      ...(info.video?.fps ? { fps: info.video.fps } : {}),
    };
    if (asset.kind !== 'video') {
      setAsset(asset.id, { state: 'ready', progress: 1, ...facts });
      if (asset.kind === 'audio') {
        try {
          const buckets = Math.max(1, Math.round((asset.duration ?? 0) * PEAKS_PER_SECOND));
          const peaks = await engine.waveformPeaks(asset.path, buckets);
          store.update((s) => {
            const current = s.assets[asset.id];
            return current
              ? { ...s, assets: { ...s.assets, [asset.id]: { ...current, peaks } } }
              : s;
          });
        } catch {
          // no waveform is not a problem: the clip is drawn plain
        }
      }
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
    setAsset(asset.id, { state: 'ready', progress: 1, proxyPath, ...facts });
    // A thumbnail from the small preview copy (fast); made once and reused.
    const thumbPath = proxyPath.replace(/\.mp4$/, '-thumb.jpg');
    try {
      await engine.probe(thumbPath);
    } catch {
      try {
        await engine.makeThumbnails(proxyPath, thumbPath, {
          count: 1,
          height: 180,
          duration: asset.duration ?? 0,
        }).done;
      } catch {
        return; // no thumbnail is not a problem: the bin shows the name
      }
    }
    store.update((s) => {
      const current = s.assets[asset.id];
      return current ? { ...s, assets: { ...s.assets, [asset.id]: { ...current, thumbPath } } } : s;
    });
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

  /** Audio mode's sound goes in a folder next to the project file: "Task_11p audio". */
  const audioFolderFor = (path: string) =>
    `${dirOf(path)}/${fileNameOf(path).replace(/\.mve$/i, '')} audio`;

  /** The project file's text, with Audio mode's work (its WAV files written first). */
  async function projectText(path: string, copy: boolean): Promise<string> {
    const project = present();
    const audioMode = await audio.saveSession(audioFolderFor(path), { copy });
    const whole = audioMode ? { ...project, audioMode } : project;
    return serializeProject(projectToDisk(whole, dirOf(path)));
  }

  const syncAudioDirty = () => patch({ audioDirty: audio.isDirty() });

  async function writeProject(path: string): Promise<void> {
    const project = present();
    try {
      await files.write(path, await projectText(path, false));
      patch({ projectPath: path, saved: project });
      syncAudioDirty();
      await files.remove(paths.recovery).catch(() => {});
    } catch (error) {
      showError(error);
    }
  }

  /** Splits a project read from disk into the video project and Audio mode's work. */
  function readProject(
    text: string,
    path: string,
  ): { project: Project; audioMode: AudioModeSession | null } {
    const { audioMode, ...project } = projectFromDisk(deserializeProject(text), dirOf(path));
    return { project, audioMode: audioMode ?? null };
  }

  async function save(): Promise<void> {
    const { projectPath } = store.get();
    if (projectPath) await writeProject(projectPath);
    else await saveAs();
  }

  async function saveAs(): Promise<void> {
    const current = store.get().projectPath;
    const name = current ? fileNameOf(current).replace(/\.mve$/i, '') : present().name;
    const path = await dialogs.saveProject(name);
    if (path) await writeProject(path);
  }

  // P3: autosave every minute when there are changes (in either mode).
  let lastRecovery: { video: Project; audio: unknown } | null = null;
  const timer = setInterval(() => {
    const s = store.get();
    if (!isDirty(s)) return;
    if (s.projectPath) {
      void writeProject(s.projectPath);
      return;
    }
    const now = { video: s.history.present, audio: audio.store.get().history.present };
    if (lastRecovery?.video === now.video && lastRecovery.audio === now.audio) return;
    lastRecovery = now;
    void projectText(paths.recovery, true)
      .then((text) => files.write(paths.recovery, text))
      .catch(() => {});
  }, autosaveMs);
  (timer as { unref?: () => void }).unref?.();

  /** V13: a sound at the playhead on the music track, or the voiceover track if music is there. */
  function placeSound(asset: MediaAsset): void {
    const item = createAudioItem(asset, store.get().playhead);
    for (const track of [0, 1] as const) {
      try {
        store.update((s) => ({ ...s, history: execute(s.history, addAudioItem(item, track)) }));
        patch({ selection: item.id });
        return;
      } catch {
        // busy here: try the other track
      }
    }
    patch({
      message: {
        kind: 'error',
        text: 'There is no free space on the music or voiceover track at the playhead. Move the playhead or delete a sound first.',
      },
    });
  }

  /** One picture per title slide with words and per caption, subtitle or credits item. */
  async function drawTextImages(project: Project): Promise<Record<Id, TextImage>> {
    const frame = { width: project.settings.width, height: project.settings.height };
    const wanted = [
      ...project.timeline.main.flatMap((item) =>
        item.type === 'title' && item.text.trim() !== ''
          ? [{ ...item, mode: 'frame' as const }]
          : [],
      ),
      ...project.timeline.text.map((item) => ({
        ...item,
        mode:
          item.kind === 'credits' && item.scroll !== false
            ? ('block' as const)
            : ('frame' as const),
      })),
    ];
    const images: Record<Id, TextImage> = {};
    for (const item of wanted) {
      const { png, width, height, anchor } = await text.draw(
        item.text,
        item.style,
        frame,
        item.mode,
      );
      images[item.id] = {
        path: await files.saveImage(`text-${item.id}`, png),
        width,
        height,
        ...(anchor ? { anchor } : {}),
      };
    }
    return images;
  }

  /** Audio mode (A1–A18): its own tracks, selection and undo history. */
  const audio = createAudioApp({
    engine,
    dialogs,
    output: audioOutput,
    ...(audioUndoStore ? { undoStore: audioUndoStore } : {}),
    ...(audioRecorder ? { recorder: audioRecorder } : {}),
  });
  /** Learn mode (T1, T3, T6): never changes the project. */
  const learn = createLearnApp({ engine, dialogs, files, paths });

  // Every Audio mode edit (or undo back to the saved state) updates "unsaved changes".
  audio.store.subscribe(() => {
    if (audio.isDirty() !== store.get().audioDirty) syncAudioDirty();
  });

  return {
    store,

    audio,
    learn,

    /** On start-up: offers to restore work that was never saved (P3). */
    async start(): Promise<void> {
      // X7: the Welcome, on the first launch only.
      if (paths.preferences) {
        const seen = await files
          .read(paths.preferences)
          .then((t) => JSON.parse(t).welcomeSeen === true)
          .catch(() => false);
        if (!seen) patch({ welcome: true });
      }
      let text: string;
      try {
        text = await files.read(paths.recovery);
      } catch {
        return; // nothing to recover
      }
      try {
        const lost = readProject(text, paths.recovery);
        if (await dialogs.confirm('EasyMedia closed before your work was saved. Restore it?')) {
          load(lost.project, null, createProject({ name: 'Untitled' }));
          await audio.openSession(lost.audioMode, { unsaved: true });
          syncAudioDirty();
          return;
        }
      } catch {
        // a damaged recovery file is simply discarded
      }
      await files.remove(paths.recovery).catch(() => {});
    },

    showWelcome: () => patch({ welcome: true }),

    /** Closes the Welcome; it does not show by itself again. */
    async closeWelcome(): Promise<void> {
      patch({ welcome: false });
      if (paths.preferences)
        await files
          .write(paths.preferences, `${JSON.stringify({ welcomeSeen: true })}\n`)
          .catch(() => {});
    },

    /** Help ▸ Licences: the third-party licences shipped with the app (README §17). */
    async showLicences(): Promise<void> {
      try {
        if (!paths.licences) throw new Error('no licences file');
        patch({ licences: await files.read(paths.licences) });
      } catch {
        patch({
          message: {
            kind: 'error',
            text: 'The licences could not be found. They are in THIRD_PARTY_LICENSES.txt in the EasyMedia installer.',
          },
        });
      }
    },

    closeLicences: () => patch({ licences: null }),

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

    /**
     * V11: resizes a picture to cover the project frame, crops it at `keep` (one of 9 places, or
     * where the student dragged it) and saves it as a
     * new file beside the original (Fish_Eagle.jpg → Fish_Eagle1.jpg), which is imported.
     */
    async resizeCropImage(assetId: Id, keep: Anchor | CropRegion): Promise<Id | null> {
      const asset = present().media.find((m) => m.id === assetId);
      const size = store.get().assets[assetId]?.size;
      if (!asset || asset.kind !== 'image' || !size) {
        patch({
          message: { kind: 'error', text: 'Wait until the picture is ready, then try again.' },
        });
        return null;
      }
      const { width, height } = present().settings;
      try {
        const plan = planResizeCrop(size, { width, height }, keep);
        const path = await engine.resizeCropImage(asset.path, plan);
        const info = await engine.probe(path);
        const made = assetFromProbe(path, info);
        run(importMediaCommand(made));
        void prepare(made, info);
        patch({
          message: { kind: 'info', text: `Saved ${fileNameOf(path)} (${width} × ${height}).` },
        });
        return made.id;
      } catch (error) {
        showError(error);
        return null;
      }
    },

    /**
     * V10: saves the frame at `time` as it will be exported (with its looks) as a picture,
     * imports it and, if asked, puts it on the timeline after the clip at that time.
     * Hiding text leaves out captions, subtitles, credits and the words of title slides.
     */
    async snapshot(options: {
      time: Seconds;
      hideText: boolean;
      addToTimeline: boolean;
      duration: Seconds;
      format?: 'png' | 'jpg' | 'bmp' | 'tiff';
      /** The picture's file name without its extension (Book B: "Bali1"); default by time. */
      name?: string;
    }): Promise<Id | null> {
      const { time, hideText, addToTimeline, duration, format = 'png' } = options;
      // Characters no file name may have (on Windows or macOS) become "-".
      const named = options.name?.trim().replace(/[\\/:*?"<>|]/g, '-');
      const { projectPath } = store.get();
      // Saved straight away: next to a saved project (so it travels with it), else in the app's folder.
      const folder = projectPath ? `${dirOf(projectPath)}/Snapshots` : paths.snapshots;
      const wanted = `${folder}/${named || `Snapshot_${time.toFixed(2)}s`}.${format}`;
      const current = present();
      const project: Project = hideText
        ? {
            ...current,
            timeline: {
              ...current.timeline,
              text: [],
              main: current.timeline.main.map((m) => (m.type === 'title' ? { ...m, text: '' } : m)),
            },
          }
        : current;
      try {
        const output = await engine.renderFrame(project, time, wanted, {
          projectDir: projectPath ? dirOf(projectPath) : '/',
          textImages: await drawTextImages(project),
        });
        const info = await engine.probe(output);
        const made = assetFromProbe(output, info);
        run(importMediaCommand(made));
        void prepare(made, info);
        if (addToTimeline) {
          const at = findMainItemAt(present().timeline.main, time);
          const clip = setItemDuration(createImageClip(made), duration);
          run(addMainItem(clip, at ? at.index + 1 : undefined));
        }
        patch({ message: { kind: 'info', text: `Added ${fileNameOf(output)} to the media.` } });
        return made.id;
      } catch (error) {
        showError(error);
        return null;
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
        placeSound(asset);
        return;
      }
      run(addMainItem(asset.kind === 'video' ? createVideoClip(asset) : createImageClip(asset)));
    },

    /** V13 "Add music at the current point": choose a sound file; it starts at the playhead. */
    async addMusic(): Promise<void> {
      const [path] = await dialogs.openMedia();
      if (!path) return;
      try {
        let asset = present().media.find((m) => m.path === path);
        if (!asset) {
          const info = await engine.probe(path);
          if (info.kind !== 'audio') {
            patch({ message: { kind: 'error', text: 'Choose a sound file, such as an MP3.' } });
            return;
          }
          asset = assetFromProbe(path, info);
          run(importMediaCommand(asset));
          void prepare(asset, info);
        }
        placeSound(asset);
      } catch (error) {
        showError(error);
      }
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

    /** V4: a new title slide after the selected clip (or at the end), ready to edit. */
    addTitle(): void {
      const main = present().timeline.main;
      const selected = main.findIndex((m) => m.id === store.get().selection);
      const title = createTitleSlide('Your title');
      run(addMainItem(title, selected >= 0 ? selected + 1 : main.length));
      patch({ selection: title.id });
    },

    /** V4, V5: a caption, subtitle or credits at the playhead, ready to edit. */
    addText(kind: TextItem['kind']): void {
      const item = createTextItem(kind, NEW_TEXT[kind], store.get().playhead);
      run(addTextItem(item));
      patch({ selection: item.id });
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
        const audioMode = await audio.saveSession(`${dir}/${name} audio`, { copy: true });
        await files.write(
          `${dir}/${name}.mve`,
          serializeProject(
            audioMode
              ? {
                  ...project,
                  media,
                  audioMode: projectToDisk({ ...project, audioMode }, dir).audioMode!,
                }
              : { ...project, media },
          ),
        );
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

    /**
     * V16, V17: exports in the chosen format (default: the project as MP4) to a file the student
     * names; optionally saves the project too, so it can be edited later.
     */
    async exportVideo(
      options: { format?: ExportSettings; alsoSaveProject?: boolean } = {},
    ): Promise<void> {
      const project = present();
      if (project.timeline.main.length === 0) {
        patch({ message: { kind: 'error', text: 'Add a clip to the timeline before exporting.' } });
        return;
      }
      const format = options.format ?? defaultExport(project.settings);
      const { projectPath } = store.get();
      const output = await dialogs.exportVideo(
        projectPath ? fileNameOf(projectPath).replace(/\.mve$/i, '') : project.name,
        format.container,
      );
      if (!output) return;
      if (options.alsoSaveProject) await save();
      patch({ exporting: { state: 'running', progress: 0, output } });
      try {
        const dir = store.get().projectPath;
        const job = engine.renderVideo(project, output, {
          projectDir: dir ? dirOf(dir) : '/',
          textImages: await drawTextImages(project),
          format,
        });
        exportJob = job;
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

    /** V17: what the export dialog shows before exporting. */
    exportSummary(format: ExportSettings) {
      const project = present();
      const duration = mainTrackDuration(project.timeline.main);
      const hasAudio = projectHasSound(project);
      return { duration, hasAudio, ...estimateSize(format, duration, hasAudio) };
    },

    cancelExport: () => exportJob?.cancel(),

    save,

    saveAs,

    async open(): Promise<void> {
      if (isDirty(store.get()) && !(await dialogs.confirm(`${DISCARD} open another project?`)))
        return;
      const path = await dialogs.openProject();
      if (!path) return;
      try {
        const { project, audioMode } = readProject(await files.read(path), path);
        load(project, path);
        await audio.openSession(audioMode);
        syncAudioDirty();
      } catch (error) {
        showError(error);
      }
    },

    async newProject(): Promise<void> {
      if (isDirty(store.get()) && !(await dialogs.confirm(`${DISCARD} start a new project?`)))
        return;
      load(createProject({ name: 'Untitled' }), null);
      audio.reset();
      syncAudioDirty();
    },

    /**
     * P7: closing the window or quitting. With unsaved work, asks Save / Don't save / Cancel;
     * true when it may close.
     */
    async confirmClose(): Promise<boolean> {
      if (!isDirty(store.get())) return true;
      const answer = await dialogs.unsavedChanges();
      if (answer === 'cancel') return false;
      if (answer === 'discard') return true;
      await save();
      return !isDirty(store.get());
    },

    dispose(): void {
      clearInterval(timer);
      stopListening();
      audio.dispose();
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
