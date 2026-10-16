// Editing commands (P4). Each returns a Command whose `apply` builds a new project from the
// old one without changing it; the timeline rules themselves live in core/model.
import { EditError } from '../core/model/errors.ts';
import { newId } from '../core/model/factory.ts';
import { validateSettings } from '../core/model/settings.ts';
import { validateTextStyle } from '../core/text/fonts.ts';
import {
  defaultParams,
  effectById,
  transitionById,
  validateParams,
} from '../core/effects/registry.ts';
import type { Seconds } from '../core/model/time.ts';
import {
  assertFitsInTrack,
  findMainItemAt,
  itemDuration,
  layoutMain,
  MIN_DURATION,
  joinMainItems,
  setItemDuration,
  setVideoSpeed,
  splitMainItem,
  trimVideo,
} from '../core/model/timeline.ts';
import type {
  AudioItem,
  ClipFade,
  ClipLook,
  PanZoom,
  PanZoomFrame,
  Transition,
  Id,
  MainItem,
  MediaAsset,
  Project,
  ProjectSettings,
  TextEffects,
  TextItem,
  TextStyle,
  TitleBackground,
  TitleSlide,
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

/** V13: how loud a video clip's own sound is, 0–200 %. */
export function setClipVolume(id: Id, volume: number): Command {
  return {
    label: 'Change volume',
    apply: (p) => {
      assertVolume(volume);
      return updateMain(p, id, (item) => {
        if (item.type !== 'video') throw new EditError('Only video clips have sound.');
        return { ...item, volume };
      });
    },
  };
}

/**
 * V13 unlink: the clip's sound moves onto an audio track (the voiceover track, or the music track
 * if that is busy) at the same time, keeping its trim, volume and fades; the clip becomes silent.
 */
export function unlinkClipSound(id: Id, audioId: Id = newId()): Command {
  return {
    label: 'Separate sound',
    apply: (p) => {
      const laid = layoutMain(p.timeline.main).find((l) => l.item.id === id);
      if (!laid)
        throw new EditError('This item could not be found. It may already have been deleted.');
      const clip = laid.item;
      if (clip.type !== 'video') throw new EditError('Only video clips have sound to separate.');
      if (clip.muted || requireAsset(p, clip.assetId).hasAudio !== true) {
        throw new EditError('This clip has no sound to separate.');
      }
      if (clip.speed !== 1) {
        throw new EditError('Set the speed back to 1× before separating the sound.');
      }
      const sound: AudioItem = {
        id: audioId,
        assetId: clip.assetId,
        start: laid.start,
        in: clip.in,
        out: clip.out,
        volume: clip.volume,
        fadeIn: clip.fade?.in ?? 0,
        fadeOut: clip.fade?.out ?? 0,
      };
      const track = ([1, 0] as const).find((t) => fits(p.timeline.audio[t], sound));
      if (track === undefined) {
        throw new EditError(
          'There is no free space on the music or voiceover track at this time. Move or delete a sound first.',
        );
      }
      const silent = updateMain(p, id, (item) => ({ ...item, muted: true }));
      return withAudio(silent, track, [...p.timeline.audio[track], sound]);
    },
  };
}

/** V13: plays only part of a music or voiceover file. */
export function trimAudio(id: Id, range: { in: Seconds; out: Seconds }): Command {
  return {
    label: 'Trim',
    apply: (p) =>
      updateAudio(p, id, (item) => {
        const length = requireAsset(p, item.assetId).duration ?? 0;
        if (range.in < 0) throw new EditError('The start point cannot be before 0.00 s.');
        if (range.out <= range.in)
          throw new EditError('The end point must be after the start point.');
        if (range.out > length + 1e-9) {
          throw new EditError(
            `The end point cannot be after the end of the sound (${length.toFixed(2)} s).`,
          );
        }
        if (range.out - range.in < MIN_DURATION - 1e-9) {
          throw new EditError(`A sound must last at least ${MIN_DURATION.toFixed(2)} s.`);
        }
        return { ...item, in: range.in, out: range.out };
      }),
  };
}

export function setAudioVolume(id: Id, volume: number): Command {
  return {
    label: 'Change volume',
    apply: (p) => {
      assertVolume(volume);
      return updateAudio(p, id, (item) => ({ ...item, volume }));
    },
  };
}

export function setAudioFades(id: Id, fades: { in: Seconds; out: Seconds }): Command {
  return {
    label: 'Change fade',
    apply: (p) =>
      updateAudio(p, id, (item) => {
        if (!(fades.in >= 0 && fades.out >= 0)) throw new EditError('Fades cannot be negative.');
        if (fades.in + fades.out > item.out - item.in + 1e-9) {
          throw new EditError('The fades are longer than the sound. Make them shorter.');
        }
        return { ...item, fadeIn: fades.in, fadeOut: fades.out };
      }),
  };
}

/** V13: the music is 6 dB quieter while the voiceover plays. */
export function setDucking(id: Id, duck: boolean): Command {
  return {
    label: duck ? 'Lower under voiceover' : 'Do not lower under voiceover',
    apply: (p) => {
      if (!p.timeline.audio[0].some((a) => a.id === id)) {
        throw new EditError('Only sound on the music track can be lowered under the voiceover.');
      }
      return updateAudio(p, id, (item) => {
        if (duck) return { ...item, duck };
        const copy = { ...item };
        delete copy.duck;
        return copy;
      });
    },
  };
}

/** Moves a sound between the music (0) and voiceover (1) tracks, at the same time. */
export function moveAudioToTrack(id: Id, track: AudioTrack): Command {
  return {
    label: track === 0 ? 'Move to music track' : 'Move to voiceover track',
    apply: (p) => {
      const from = audioTrackOf(p, id);
      if (from === track) return p;
      const item = p.timeline.audio[from].find((a) => a.id === id)!;
      assertFitsInTrack(p.timeline.audio[track], item);
      const moved: AudioItem = { ...item };
      if (track === 1) delete moved.duck;
      const removed = withAudio(
        p,
        from,
        p.timeline.audio[from].filter((a) => a.id !== id),
      );
      return withAudio(removed, track, [...p.timeline.audio[track], moved]);
    },
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

/** V4: the words of a title slide, caption, subtitle or credits. */
export function setText(id: Id, text: string): Command {
  return { label: 'Change text', apply: (p) => updateText(p, id, (item) => ({ ...item, text })) };
}

/** V4, V6: font, size, colour, alignment, position and readability. */
export function setTextStyle(id: Id, change: Partial<TextStyle>): Command {
  return {
    label: 'Change text style',
    apply: (p) =>
      updateText(p, id, (item) => {
        const style = { ...item.style, ...change };
        validateTextStyle(style);
        return { ...item, style };
      }),
  };
}

/** Fades and entrance for text; scrolling for credits (V5, V7). */
export function setTextEffects(id: Id, change: TextEffects & { scroll?: boolean }): Command {
  return {
    label: 'Change text effects',
    apply: (p) =>
      updateText(p, id, (item) => {
        const next = { ...item, ...change };
        const fadeIn = next.fadeIn ?? 0;
        const fadeOut = next.fadeOut ?? 0;
        if (fadeIn < 0 || fadeOut < 0) throw new EditError('Fades cannot be negative.');
        if (fadeIn + fadeOut > next.duration + 1e-9) {
          throw new EditError('The fades are longer than the text is shown. Make them shorter.');
        }
        return next;
      }),
  };
}

/** V4, V12: a title slide's background — a colour, an imported picture or a video. */
export function setTitleBackground(id: Id, background: TitleBackground): Command {
  return {
    label: 'Change title background',
    apply: (p) =>
      updateMain(p, id, (item) => {
        if (item.type !== 'title') throw new EditError('Only title slides have a background.');
        if (background.kind === 'colour') {
          if (!/^#[0-9a-f]{6}$/i.test(background.colour))
            throw new EditError('Choose a background colour.');
        } else {
          const kind = requireAsset(p, background.assetId).kind;
          if (kind !== background.kind) {
            throw new EditError(
              background.kind === 'image'
                ? 'Choose a picture for the background.'
                : 'Choose a video for the background.',
            );
          }
        }
        return { ...item, background };
      }),
  };
}

/** V7: fade the whole picture in from / out to black or white. 0 and 0 removes the fade. */
export function setFade(id: Id, fade: ClipFade): Command {
  return {
    label: 'Change fade',
    apply: (p) =>
      updateMain(p, id, (item) => {
        if (!(fade.in >= 0 && fade.out >= 0)) throw new EditError('Fades cannot be negative.');
        if (fade.in + fade.out > itemDuration(item) + 1e-9) {
          throw new EditError('The fades are longer than the clip. Make them shorter.');
        }
        return fade.in === 0 && fade.out === 0 ? without(item, 'fade') : { ...item, fade };
      }),
  };
}

/** V15: add a filter from the effect registry, with its default settings. */
export function addEffect(id: Id, effectId: string): Command {
  return {
    label: 'Add effect',
    apply: (p) => {
      const def = effectById(effectId);
      if (!def) throw new EditError('This effect is not available in this version of EasyMedia.');
      return updateMain(p, id, (item) => ({
        ...item,
        effects: [...(item.effects ?? []), { effectId, params: defaultParams(def) }],
      }));
    },
  };
}

export function setEffectParams(id: Id, index: number, params: Record<string, number>): Command {
  return {
    label: 'Change effect',
    apply: (p) =>
      updateMain(p, id, (item) => {
        const effects = [...(item.effects ?? [])];
        const effect = effects[index];
        const def = effect && effectById(effect.effectId);
        if (!effect || !def) throw new EditError('This effect could not be found.');
        validateParams(def, params);
        effects[index] = { ...effect, params };
        return { ...item, effects };
      }),
  };
}

export function removeEffect(id: Id, index: number): Command {
  return {
    label: 'Remove effect',
    apply: (p) =>
      updateMain(p, id, (item) => {
        const effects = (item.effects ?? []).filter((_, i) => i !== index);
        return effects.length ? { ...item, effects } : without(item, 'effects');
      }),
  };
}

/** V9: the transition from the previous item into this one; null removes it. */
export function setTransition(id: Id, transition: Transition | null): Command {
  return {
    label: transition ? 'Add transition' : 'Remove transition',
    apply: (p) => {
      const index = mainIndex(p, id);
      if (transition) {
        if (index === 0) {
          throw new EditError(
            'The first clip has nothing before it. Add the transition to the next clip.',
          );
        }
        if (!transitionById(transition.effectId)) {
          throw new EditError('This transition is not available in this version of EasyMedia.');
        }
        const shortest = Math.min(
          itemDuration(p.timeline.main[index - 1]!),
          itemDuration(p.timeline.main[index]!),
        );
        if (!(transition.duration >= MIN_DURATION)) {
          throw new EditError(`A transition must last at least ${MIN_DURATION} s.`);
        }
        if (transition.duration >= shortest) {
          throw new EditError(
            `The transition must be shorter than both clips (under ${shortest.toFixed(2)} s here).`,
          );
        }
      }
      return updateMain(p, id, (item) => {
        return transition ? { ...item, transitionIn: transition } : without(item, 'transitionIn');
      });
    },
  };
}

/** V8: pan & zoom from one frame to another; null removes it. */
export function setPanZoom(id: Id, panZoom: PanZoom | null): Command {
  return {
    label: panZoom ? 'Change pan and zoom' : 'Remove pan and zoom',
    apply: (p) =>
      updateMain(p, id, (item) => {
        if (!panZoom) return without(item, 'panZoom');
        for (const frame of [panZoom.from, panZoom.to]) assertFrame(frame);
        const length = itemDuration(item);
        const start = panZoom.start ?? 0;
        const end = panZoom.end ?? length;
        if (!(start >= 0 && start < length && end <= length + 1e-9)) {
          throw new EditError('The pan and zoom must start and end inside the clip.');
        }
        if (!(end - start >= MIN_DURATION)) {
          throw new EditError('The pan and zoom must end after it starts.');
        }
        return { ...item, panZoom };
      }),
  };
}

/** The item without one of its look settings. */
function without(item: MainItem, key: keyof ClipLook): MainItem {
  const copy = { ...item };
  delete copy[key];
  return copy;
}

function assertFrame(frame: PanZoomFrame): void {
  if (!(frame.zoom >= 1 && frame.zoom <= 4)) {
    throw new EditError('Zoom must be between 100 % and 400 %.');
  }
  if (!(frame.x >= 0 && frame.x <= 1 && frame.y >= 0 && frame.y <= 1)) {
    throw new EditError('The centre of the view must be inside the picture.');
  }
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

function assertVolume(volume: number): void {
  if (!(volume >= 0 && volume <= 2)) throw new EditError('Volume must be between 0 % and 200 %.');
}

function fits(track: readonly AudioItem[], item: AudioItem): boolean {
  try {
    assertFitsInTrack(track, item);
    return true;
  } catch {
    return false;
  }
}

function audioTrackOf(p: Project, id: Id): AudioTrack {
  const track = p.timeline.audio.findIndex((tr) => tr.some((a) => a.id === id));
  if (track < 0)
    throw new EditError('This item could not be found. It may already have been deleted.');
  return track as AudioTrack;
}

function updateAudio(p: Project, id: Id, change: (item: AudioItem) => AudioItem): Project {
  const track = audioTrackOf(p, id);
  const items = p.timeline.audio[track];
  const changed = change(items.find((a) => a.id === id)!);
  assertFitsInTrack(items, changed);
  return withAudio(
    p,
    track,
    items.map((a) => (a.id === id ? changed : a)),
  );
}

function backgroundAsset(item: Extract<MainItem, { type: 'title' }>): Id | undefined {
  return item.background.kind === 'colour' ? undefined : item.background.assetId;
}

function assertStart(start: Seconds): void {
  if (!(start >= 0)) throw new EditError('Text and audio cannot start before 0.00 s.');
}

/** Changes a title slide (main track) or a caption / subtitle / credits item (text track). */
function updateText(
  p: Project,
  id: Id,
  change: <T extends TitleSlide | TextItem>(item: T) => T,
): Project {
  if (p.timeline.text.some((t) => t.id === id)) {
    return withText(
      p,
      p.timeline.text.map((t) => (t.id === id ? change(t) : t)),
    );
  }
  return updateMain(p, id, (item) => {
    if (item.type !== 'title')
      throw new EditError('Only titles and text have words and text styles.');
    return change(item);
  });
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
