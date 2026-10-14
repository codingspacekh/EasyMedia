// The typed surface the page can use (window.mve). Shared by main, preload and renderer.
// Only the request channels listed in CHANNELS exist (P2).
import type { Project } from '../core/model/types.ts';
import type { AppPaths, JobEvent, ProbeInfo } from '../core/ports.ts';
import type { Quality } from '../core/render/compile.ts';
import type { WireError } from '../core/wire.ts';

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
  'media:render': {
    args: [
      jobKey: string,
      project: Project,
      output: string,
      options: { projectDir: string; quality?: Quality },
    ];
    result: null;
  };
  'job:cancel': { args: [jobKey: string]; result: null };
  'app:paths': { args: []; result: AppPaths };
  'dialog:openMedia': { args: []; result: string[] };
  'dialog:openProject': { args: []; result: string | null };
  'dialog:saveProject': { args: [suggestedName: string]; result: string | null };
  'dialog:exportVideo': { args: [suggestedName: string]; result: string | null };
  'dialog:confirm': { args: [message: string]; result: boolean };
  'dialog:chooseFolder': { args: [title: string]; result: string | null };
  'project:read': { args: [path: string]; result: string };
  'project:write': { args: [path: string, text: string]; result: null };
  'project:remove': { args: [path: string]; result: null };
  'project:copy': { args: [from: string, to: string]; result: null };
}

export type Channel = keyof Channels;

export const CHANNELS: readonly Channel[] = [
  'media:probe',
  'media:proxy',
  'media:thumbnails',
  'media:waveform',
  'media:frame',
  'media:render',
  'job:cancel',
  'app:paths',
  'dialog:openMedia',
  'dialog:openProject',
  'dialog:saveProject',
  'dialog:exportVideo',
  'dialog:confirm',
  'dialog:chooseFolder',
  'project:read',
  'project:write',
  'project:remove',
  'project:copy',
];

/** Every reply is data: errors cross the boundary as WireError (see core/wire.ts). */
export type Reply<T> = { ok: true; value: T } | { ok: false; error: WireError };

export type MenuAction =
  'new' | 'open' | 'save' | 'saveAs' | 'import' | 'export' | 'package' | 'undo' | 'redo';

/** Job events with the renderer's job key as jobId; errors carry the full WireError. */
export type JobWireEvent =
  JobEvent | { type: 'failed'; jobId: string; label: string; error: WireError };

export interface Events {
  'job:event': JobWireEvent;
  'menu:action': MenuAction;
}

export interface MveApi {
  platform: string;
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
