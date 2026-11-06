// V20: editing commands for pictures and videos over the video (P4): each is one undo step. The
// rules live in core/model/overlay.ts. The overlay track is left out of the project while empty.
import { EditError } from '../core/model/errors.ts';
import {
  assertFitsOverlayTrack,
  trimOverlayVideo,
  validateOverlay,
} from '../core/model/overlay.ts';
import type { Seconds } from '../core/model/time.ts';
import { mainTrackDuration, MIN_DURATION } from '../core/model/timeline.ts';
import type { Id, OverlayItem, OverlayPlacement, Project } from '../core/model/types.ts';
import type { Command } from './history.ts';

export function addOverlayItem(item: OverlayItem): Command {
  return {
    label: 'Add over the video',
    apply: (p) => {
      const asset = p.media.find((m) => m.id === item.assetId);
      if (!asset) throw new EditError('Import the file into the media bin first.');
      if (asset.kind !== item.type) {
        throw new EditError('Only a picture or a video can go over the video.');
      }
      const track = p.timeline.overlay ?? [];
      assertFitsOverlayTrack(track, validateOverlay(item));
      return withOverlay(p, [...track, item]);
    },
  };
}

/** When it appears (typed to 0.01 s, or dragged along its track). */
export function moveOverlayItem(id: Id, start: Seconds): Command {
  return {
    label: 'Move',
    apply: (p) => {
      if (!(start >= 0)) throw new EditError('It cannot start before 0.00 s.');
      return updateOverlay(p, id, (item) => ({ ...item, start }));
    },
  };
}

/** How long a picture shows. */
export function setOverlayDuration(id: Id, duration: Seconds): Command {
  return {
    label: 'Change duration',
    apply: (p) =>
      updateOverlay(p, id, (item) => {
        if (item.type === 'video') {
          throw new EditError('Use trim to change the length of a video over the video.');
        }
        return { ...item, duration };
      }),
  };
}

/** Plays only part of a video over the video. */
export function trimOverlay(id: Id, range: { in: Seconds; out: Seconds }): Command {
  return {
    label: 'Trim',
    apply: (p) =>
      updateOverlay(p, id, (item) => {
        if (item.type !== 'video') {
          throw new EditError('A picture is not trimmed. Change its duration instead.');
        }
        const asset = p.media.find((m) => m.id === item.assetId);
        if (!asset) throw new EditError('Import the file into the media bin first.');
        return trimOverlayVideo(item, range, asset);
      }),
  };
}

/** Its width (% of the frame), one of the nine places and the margin. */
export function setOverlayPlacement(id: Id, change: Partial<OverlayPlacement>): Command {
  return {
    label: 'Change place and size',
    apply: (p) => updateOverlay(p, id, (item) => ({ ...item, ...change })),
  };
}

/** 1 = solid, 0.5 = half see-through. */
export function setOverlayOpacity(id: Id, opacity: number): Command {
  return {
    label: 'Change opacity',
    apply: (p) => updateOverlay(p, id, (item) => ({ ...item, opacity })),
  };
}

/** Fades in and out; 0 and 0 removes the fades. */
export function setOverlayFades(id: Id, fades: { in: Seconds; out: Seconds }): Command {
  return {
    label: 'Change fade',
    apply: (p) =>
      updateOverlay(p, id, (item) => {
        const next = { ...item };
        delete next.fadeIn;
        delete next.fadeOut;
        return {
          ...next,
          ...(fades.in !== 0 ? { fadeIn: fades.in } : {}),
          ...(fades.out !== 0 ? { fadeOut: fades.out } : {}),
        };
      }),
  };
}

/** A video over the video's own sound: on or off, and how loud (0–200 %). */
export function setOverlaySound(id: Id, change: { muted?: boolean; volume?: number }): Command {
  return {
    label:
      change.muted === false
        ? 'Turn sound on'
        : change.muted === true
          ? 'Remove sound'
          : 'Change volume',
    apply: (p) =>
      updateOverlay(p, id, (item) => {
        if (item.type !== 'video') throw new EditError('Only a video over the video has sound.');
        return { ...item, ...change };
      }),
  };
}

/** A picture (a logo) shown from the start to the end of the video. */
export function showOverlayForWholeVideo(id: Id): Command {
  return {
    label: 'Show for the whole video',
    apply: (p) => {
      const length = mainTrackDuration(p.timeline.main);
      if (length < MIN_DURATION) throw new EditError('Add a clip to the timeline first.');
      return updateOverlay(p, id, (item) => {
        if (item.type !== 'image') {
          throw new EditError('A video over the video plays for its own length. Trim it instead.');
        }
        return { ...item, start: 0, duration: length };
      });
    },
  };
}

// ---- helpers ----

function updateOverlay(p: Project, id: Id, change: (item: OverlayItem) => OverlayItem): Project {
  const track = p.timeline.overlay ?? [];
  const old = track.find((o) => o.id === id);
  if (!old) throw new EditError('This item could not be found. It may already have been deleted.');
  const changed = validateOverlay(change(old));
  assertFitsOverlayTrack(track, changed);
  return withOverlay(
    p,
    track.map((o) => (o.id === id ? changed : o)),
  );
}

/** The overlay track, left out of the project when it is empty (so older versions open it). */
export function withOverlay(p: Project, overlay: OverlayItem[]): Project {
  const timeline: Project['timeline'] = { ...p.timeline, overlay };
  if (!overlay.length) delete timeline.overlay;
  return { ...p, timeline };
}
