// The typed surface the page can use (window.mve). Shared by main, preload and renderer.
// Only the request channels listed in CHANNELS exist (P2).
import type { Project } from '../core/model/types.ts';
import type {
  AnimationExportFormat,
  AppPaths,
  DecodedAudioFile,
  GraphicExportFormat,
  EncodeFramesOptions,
  JobEvent,
  ProbeInfo,
  RenderVideoOptions,
} from '../core/ports.ts';
import type { AudioExportSettings, AudioFormat } from '../core/render/audio-formats.ts';
import type { WireError } from '../core/wire.ts';
import type { CombinePlan } from '../core/image/combine.ts';
import type { ResizeCrop } from '../core/image/crop.ts';
import type { ColourKey } from '../core/image/colour-key.ts';
import type { Container } from '../core/render/formats.ts';
import type { UpdateState } from '../core/updates.ts';
import type { PlaybackSample } from '../core/animation/paint-meter.ts';

export interface Channels {
  'media:probe': { args: [path: string]; result: ProbeInfo };
  'media:proxy': {
    args: [jobKey: string, input: string, output: string, duration: number];
    result: null;
  };
  'media:thumbnails': {
    args: [
      jobKey: string,
      input: string,
      output: string,
      options: { count: number; height: number; duration: number },
    ];
    result: null;
  };
  'media:waveform': { args: [input: string, buckets: number]; result: number[] };
  'media:frame': { args: [input: string, time: number, output: string]; result: null };
  'media:resizeCrop': { args: [input: string, plan: ResizeCrop, name?: string]; result: string };
  'media:combine': {
    args: [base: string, top: string, plan: CombinePlan, name?: string];
    result: string;
  };
  'media:colourKey': { args: [input: string, key: ColourKey, name?: string]; result: string };
  'media:snapshot': {
    args: [project: Project, time: number, output: string, options: RenderVideoOptions];
    result: string;
  };
  'media:render': {
    args: [jobKey: string, project: Project, output: string, options: RenderVideoOptions];
    result: null;
  };
  'media:decodeAudio': { args: [path: string, sampleRate?: number]; result: DecodedAudioFile };
  'media:release': { args: [raw: string]; result: null };
  'media:encodeFrames': {
    args: [jobKey: string, folder: string, output: string, options: EncodeFramesOptions];
    result: null;
  };
  'media:encodeAudio': {
    args: [
      jobKey: string,
      audio: { sampleRate: number; channels: readonly Float32Array[] },
      output: string,
      settings: AudioExportSettings,
    ];
    result: null;
  };
  'job:cancel': { args: [jobKey: string]; result: null };
  /** X4: asks the system for the microphone (macOS); false when it is refused. */
  'media:microphoneAccess': { args: []; result: boolean };
  'app:paths': { args: []; result: AppPaths };
  'dialog:openMedia': { args: []; result: string[] };
  'dialog:openProject': { args: []; result: string | null };
  'dialog:saveProject': { args: [suggestedName: string]; result: string | null };
  'dialog:exportVideo': {
    args: [suggestedName: string, container: Container];
    result: string | null;
  };
  'dialog:exportAudio': {
    args: [suggestedName: string, format: AudioFormat];
    result: string | null;
  };
  'dialog:confirm': { args: [message: string]; result: boolean };
  'dialog:chooseFolder': { args: [title: string]; result: string | null };
  'dialog:unsavedChanges': { args: []; result: 'save' | 'discard' | 'cancel' };
  'dialog:openTaskCheck': { args: []; result: string | null };
  'dialog:saveTaskCheck': { args: [suggestedName: string]; result: string | null };
  'dialog:openAnimation': { args: []; result: string | null };
  'dialog:openPicture': { args: []; result: string | null };
  /** AN28: a sound for the animation. */
  'dialog:openSound': { args: []; result: string | null };
  'dialog:openFrames': { args: []; result: string[] };
  'dialog:openExport': { args: []; result: string[] };
  'dialog:saveAnimation': { args: [suggestedName: string]; result: string | null };
  'dialog:exportAnimation': {
    args: [suggestedName: string, format: AnimationExportFormat];
    result: string | null;
  };
  /** G1, G11 (M18): Graphics mode's files and exports. */
  'dialog:openGraphic': { args: []; result: string | null };
  'dialog:saveGraphic': { args: [suggestedName: string]; result: string | null };
  'dialog:exportGraphic': {
    args: [suggestedName: string, format: GraphicExportFormat];
    result: string | null;
  };
  /** P7: the page's answer to app:closeRequested. */
  'app:closeAnswer': { args: [close: boolean]; result: null };
  'project:read': { args: [path: string]; result: string };
  'project:write': { args: [path: string, text: string]; result: null };
  'project:remove': { args: [path: string]; result: null };
  'project:copy': { args: [from: string, to: string]; result: null };
  'project:saveImage': { args: [name: string, png: Uint8Array]; result: string };
  'project:saveSound': { args: [name: string, wav: Uint8Array]; result: string };
  'project:writeBytes': { args: [path: string, bytes: Uint8Array]; result: null };
  /** AN15: the HTML web animation's player script. */
  'page:player': { args: []; result: string };
  /** AN15: a picture the app opened, as a data: URL. */
  'page:picture': { args: [path: string]; result: string };
  /** AN28: a sound the app opened or made, as a data: URL. */
  'page:sound': { args: [path: string]; result: string };
  /** AN15: a bundled font file of the built pages (its file name in assets/), as a data: URL. */
  'page:font': { args: [assetName: string]; result: string };
  /** AN18: Test — shows a web page in a window of its own. */
  'page:test': {
    args: [html: string, title: string, width: number, height: number];
    result: null;
  };
  /** M17a U1–U5: updates; each answers with the state as it is then. */
  'updates:get': { args: []; result: UpdateState };
  'updates:check': { args: []; result: UpdateState };
  'updates:download': { args: []; result: UpdateState };
  'updates:install': { args: []; result: UpdateState };
  'updates:auto': { args: [on: boolean]; result: UpdateState };
  'updates:seen': { args: []; result: UpdateState };
  'updates:showDmg': { args: []; result: UpdateState };
  'updates:openDmg': { args: []; result: UpdateState };
  /** N1: is the performance report on (ONEEDITOR_PERF_REPORT)? Then the page measures the stage. */
  'perf:enabled': { args: []; result: boolean };
  /** N1: one play of the stage, for the performance report. */
  'perf:playback': { args: [sample: PlaybackSample]; result: null };
  /** Help ▸ Report a Problem…: an unexpected error in the page, for the problem log. */
  'log:page': { args: [text: string]; result: null };
  /** Help ▸ About OneEditor: opens the website (core/about.ts) in the browser. */
  'app:website': { args: []; result: null };
}

export type Channel = keyof Channels;

export const CHANNELS: readonly Channel[] = [
  'media:probe',
  'media:proxy',
  'media:thumbnails',
  'media:waveform',
  'media:frame',
  'media:resizeCrop',
  'media:combine',
  'media:colourKey',
  'media:snapshot',
  'media:render',
  'media:decodeAudio',
  'media:release',
  'media:encodeAudio',
  'media:encodeFrames',
  'job:cancel',
  'media:microphoneAccess',
  'app:paths',
  'dialog:openMedia',
  'dialog:openProject',
  'dialog:saveProject',
  'dialog:exportVideo',
  'dialog:exportAudio',
  'dialog:confirm',
  'dialog:chooseFolder',
  'dialog:unsavedChanges',
  'dialog:openTaskCheck',
  'dialog:saveTaskCheck',
  'dialog:openAnimation',
  'dialog:openPicture',
  'dialog:openSound',
  'dialog:openFrames',
  'dialog:openExport',
  'dialog:saveAnimation',
  'dialog:exportAnimation',
  'dialog:openGraphic',
  'dialog:saveGraphic',
  'dialog:exportGraphic',
  'app:closeAnswer',
  'project:read',
  'project:write',
  'project:remove',
  'project:copy',
  'project:saveImage',
  'project:saveSound',
  'project:writeBytes',
  'page:player',
  'page:picture',
  'page:sound',
  'page:font',
  'page:test',
  'updates:get',
  'updates:check',
  'updates:download',
  'updates:install',
  'updates:auto',
  'updates:seen',
  'updates:showDmg',
  'updates:openDmg',
  'perf:enabled',
  'perf:playback',
  'log:page',
  'app:website',
];

/** Every reply is data: errors cross the boundary as WireError (see core/wire.ts). */
export type Reply<T> = { ok: true; value: T } | { ok: false; error: WireError };

export type MenuAction =
  | 'new'
  | 'open'
  | 'save'
  | 'saveAs'
  | 'import'
  | 'export'
  | 'exportAudio'
  | 'package'
  | 'undo'
  | 'redo'
  | 'selectAll'
  | 'welcome'
  | 'licences'
  | 'newAnimation'
  | 'openAnimation'
  | 'exportAnimation'
  | 'newImage'
  | 'openImage'
  | 'exportImage'
  | 'learnInspect'
  | 'learnFormats'
  | 'learnAnimation'
  | 'learnTask'
  | 'glossary'
  | 'toggleLeft'
  | 'toggleRight'
  | 'toggleBottom'
  | 'resetLayout'
  | 'updates'
  | 'candidate'
  | 'about';

/** Job events with the renderer's job key as jobId; errors carry the full WireError. */
export type JobWireEvent =
  JobEvent | { type: 'failed'; jobId: string; label: string; error: WireError };

export interface Events {
  'job:event': JobWireEvent;
  'menu:action': MenuAction;
  /** P7: the window is closing (or the app quitting): may it, with the work as it is? */
  'app:closeRequested': null;
  /** M17a: the updates' state changed (a version found, download progress…). */
  'updates:state': UpdateState;
}

export interface MveApi {
  platform: string;
  /** Where a file dropped on the page is on disk (Learn mode's inspector). */
  pathForFile(file: File): string;
  invoke<C extends Channel>(
    channel: C,
    ...args: Channels[C]['args']
  ): Promise<Reply<Channels[C]['result']>>;
  on<E extends keyof Events>(event: E, listener: (payload: Events[E]) => void): () => void;
}

declare global {
  interface Window {
    mve: MveApi;
  }
}
