// Editing commands (P4). Each returns a Command whose `apply` builds a new project from the
// old one without changing it; the timeline rules themselves live in core/model.
import { EditError } from '../core/model/errors.ts';
import { newId } from '../core/model/factory.ts';
import { validateSettings } from '../core/model/settings.ts';
import type { Seconds } from '../core/model/time.ts';
import {
  assertFitsInTrack,
  findMainItemAt,
  joinMainItems,
  setItemDuration,
  setVideoSpeed,
  splitMainItem,
  trimVideo,
} from '../core/model/timeline.ts';
import type {
  AudioItem,
  Id,
  MainItem,
  MediaAsset,
  Project,
  ProjectSettings,
  TextItem,
} from '../core/model/types.ts';
import type { Command } from './history.ts';

type AudioTrack = 0 | 1;

export function importMedia(asset: MediaAsset): Command {
  return {
    label: `Import ${asset.path.split('/').pop()}`,
    apply: (p) => {
      if (p.media.some((m) => m.id === asset.id || m.path === asset.path)) {
        throw new EditError(`${asset.path} is already imported.`);
      }
      return { ...p, media: [...p.media, asset] };
    },
  };
}

/** P6: points a moved or renamed media file to its new place. Clips keep their edits. */
export function relinkMedia(assetId: Id, replacement: MediaAsset): Command {
  return {
    label: 'Locate file',
    apply: (p) => {
      const old = requireAsset(p, assetId);
      if (replacement.kind !== old.kind)
        throw new EditError(`Choose ${old.kind === 'image' ? 'an image' : `a ${old.kind}`} file.`);
      const usedUpTo = Math.max(
        0,
        ...p.timeline.main.flatMap((m) =>
          m.type === 'video' && m.assetId === assetId ? [m.out] : [],
        ),
        ...p.timeline.audio.flat().flatMap((a) => (a.assetId === assetId ? [a.out] : [])),
      );
      if ((replacement.duration ?? Infinity) + 1e-9 < usedUpTo) {
        throw new EditError(
          'This file is shorter than the part used on the timeline. Choose the original file.',
        );
      }
      return {
        ...p,
        media: p.media.map((m) => (m.id === assetId ? { ...replacement, id: assetId } : m)),
      };
    },
  };
}

export function addMainItem(item: MainItem, index?: number): Command {
  return {
    label: item.type === 'title' ? 'Add title' : 'Add clip',
    apply: (p) => {
      const assetId = item.type === 'title' ? backgroundAsset(item) : item.assetId;
      if (assetId) requireAsset(p, assetId);
      const main = [...p.timeline.main];
      main.splice(index ?? main.length, 0, item);
      return withMain(p, main);
    },
  };
}

export function removeItem(id: Id): Command {
  return {
    label: 'Delete',
    apply: (p) => {
      const { main, text, audio } = p.timeline;
      const found =
        main.some((m) => m.id === id) ||
        text.some((t) => t.id === id) ||
        audio.flat().some((a) => a.id === id);
      if (!found)
        throw new EditError('This item could not be found. It may already have been deleted.');
      return {
        ...p,
        timeline: {
          main: main.filter((m) => m.id !== id),
          text: text.filter((t) => t.id !== id),
          audio: [audio[0].filter((a) => a.id !== id), audio[1].filter((a) => a.id !== id)],
        },
      };
    },
  };
}

export function trimClip(id: Id, range: { in: Seconds; out: Seconds }): Command {
  return {
    label: 'Trim',
    apply: (p) =>
      updateMain(p, id, (item) => {
        if (item.type !== 'video') {
          throw new EditError(
            'Only video clips can be trimmed. Change the duration of stills and titles instead.',
          );
        }
        return trimVideo(item, range, requireAsset(p, item.assetId));
      }),
  };
}

export function setClipSpeed(id: Id, speed: number): Command {
  return {
    label: 'Change speed',
    apply: (p) =>
      updateMain(p, id, (item) => {
        if (item.type !== 'video') throw new EditError('Only video clips have a speed.');
        return setVideoSpeed(item, speed);
      }),
  };
}

/** V13: removes (or restores) the sound of a video clip. */
export function setClipMuted(id: Id, muted: boolean): Command {
  return {
    label: muted ? 'Remove sound' : 'Restore sound',
    apply: (p) =>
      updateMain(p, id, (item) => {
        if (item.type !== 'video') throw new EditError('Only video clips have sound to remove.');
        return { ...item, muted };
      }),
  };
}

export function setDuration(id: Id, duration: Seconds): Command {
  return {
    label: 'Change duration',
    apply: (p) => {
      if (p.timeline.text.some((t) => t.id === id)) {
        return withText(
          p,
          p.timeline.text.map((t) => (t.id === id ? setItemDuration(t, duration) : t)),
        );
      }
      return updateMain(p, id, (item) => {
        if (item.type === 'video') {
          throw new EditError('Use trim to change the length of a video clip.');
        }
        return setItemDuration(item, duration);
      });
    },
  };
}

export function splitAtTime(time: Seconds, ids: [Id, Id] = [newId(), newId()]): Command {
  return {
    label: 'Split',
    apply: (p) => {
      const hit = findMainItemAt(p.timeline.main, time);
      if (!hit) throw new EditError('Move the playhead over a clip to split it.');
      const main = [...p.timeline.main];
      main.splice(hit.index, 1, ...splitMainItem(main[hit.index]!, hit.offset, ids));
      return withMain(p, main);
    },
  };
}

export function joinWithNext(id: Id): Command {
  return {
    label: 'Join',
    apply: (p) => {
      const index = mainIndex(p, id);
      const next = p.timeline.main[index + 1];
      if (!next) throw new EditError('There is no clip after this one to join.');
      const main = [...p.timeline.main];
      main.splice(index, 2, joinMainItems(main[index]!, next));
      return withMain(p, main);
    },
  };
}

export function moveMainItem(id: Id, toIndex: number): Command {
  return {
    label: 'Move',
    apply: (p) => {
      const main = [...p.timeline.main];
      if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= main.length) {
        throw new EditError('That position is not on the timeline.');
      }
      const [item] = main.splice(mainIndex(p, id), 1);
      main.splice(toIndex, 0, item!);
      return withMain(p, main);
    },
  };
}

/** Moves a caption, subtitle, credits or audio item to a new start time. */
export function moveTimedItem(id: Id, start: Seconds): Command {
  return {
    label: 'Move',
    apply: (p) => {
      assertStart(start);
      if (p.timeline.text.some((t) => t.id === id)) {
        return withText(
          p,
          p.timeline.text.map((t) => (t.id === id ? { ...t, start } : t)),
        );
      }
      const track = p.timeline.audio.findIndex((tr) => tr.some((a) => a.id === id));
      if (track < 0)
        throw new EditError('This item could not be found. It may already have been deleted.');
      const items = p.timeline.audio[track]!;
      const moved = { ...items.find((a) => a.id === id)!, start };
      assertFitsInTrack(items, moved);
      return withAudio(
        p,
        track as AudioTrack,
        items.map((a) => (a.id === id ? moved : a)),
      );
    },
  };
}

export function addTextItem(item: TextItem): Command {
  return {
    label: `Add ${item.kind}`,
    apply: (p) => {
      assertStart(item.start);
      return withText(p, [...p.timeline.text, item]);
    },
  };
}

export function addAudioItem(item: AudioItem, track: AudioTrack): Command {
  return {
    label: track === 0 ? 'Add music' : 'Add voiceover',
    apply: (p) => {
      requireAsset(p, item.assetId);
      assertStart(item.start);
      const items = p.timeline.audio[track];
      assertFitsInTrack(items, item);
      return withAudio(p, track, [...items, item]);
    },
  };
}

export function setProjectSettings(change: Partial<ProjectSettings>): Command {
  return {
    label: 'Project settings',
    apply: (p) => {
      const settings = { ...p.settings, ...change };
      validateSettings(settings);
      return { ...p, settings };
    },
  };
}

// ---- helpers ----

function requireAsset(p: Project, assetId: Id): MediaAsset {
  const asset = p.media.find((m) => m.id === assetId);
  if (!asset) throw new EditError('Import the file into the media bin first.');
  return asset;
}

function backgroundAsset(item: Extract<MainItem, { type: 'title' }>): Id | undefined {
  return item.background.kind === 'colour' ? undefined : item.background.assetId;
}

function assertStart(start: Seconds): void {
  if (!(start >= 0)) throw new EditError('Text and audio cannot start before 0.00 s.');
}

function mainIndex(p: Project, id: Id): number {
  const index = p.timeline.main.findIndex((m) => m.id === id);
  if (index < 0)
    throw new EditError('This item could not be found. It may already have been deleted.');
  return index;
}

function updateMain(p: Project, id: Id, change: (item: MainItem) => MainItem): Project {
  const index = mainIndex(p, id);
  const main = [...p.timeline.main];
  main[index] = change(main[index]!);
  return withMain(p, main);
}

function withMain(p: Project, main: MainItem[]): Project {
  return { ...p, timeline: { ...p.timeline, main } };
}

function withText(p: Project, text: TextItem[]): Project {
  return { ...p, timeline: { ...p.timeline, text } };
}

function withAudio(p: Project, track: AudioTrack, items: AudioItem[]): Project {
  const audio: Project['timeline']['audio'] = [...p.timeline.audio];
  audio[track] = items;
  return { ...p, timeline: { ...p.timeline, audio } };
}
