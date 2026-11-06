// Pictures in an animation (AN5, AN14): a picture file placed at its own size, Trace bitmap (the
// picture becomes vector shapes) and Import frames (a folder of pictures as a stop motion).
import * as cmd from '../animation-commands.ts';
import { createPicture } from '../../core/animation/factory.ts';
import { findObject } from '../../core/animation/layers.ts';
import { sortByName, stopMotion, stopMotionTiming } from '../../core/animation/frames.ts';
import {
  traceBitmap,
  tracedGroup,
  type Pixels,
  type TraceOptions,
  type TracedRegion,
} from '../../core/animation/trace.ts';
import type { Point } from '../../core/animation/geometry.ts';
import { checkPictureEditable, croppedPicture } from '../../core/animation/picture-edit.ts';
import { colourKeyFilter, type ColourKey } from '../../core/image/colour-key.ts';
import { planFreeCrop, type CropRegion } from '../../core/image/crop.ts';
import { fileNameOf } from '../../core/project/relocate.ts';
import type { Id, Picture, PictureObject } from '../../core/animation/types.ts';
import { EditError } from '../../core/model/errors.ts';
import { newId } from '../../core/model/factory.ts';
import type { AnimationContext } from './context.ts';

/** AN5: pictures are traced at most this size (px on the longer side), to keep tracing quick. */
export const TRACE_MAX_SIDE = 1200;
/** AN5: the Trace bitmap dialog's preview traces a copy this small. */
export const TRACE_PREVIEW_SIDE = 240;

export function pictureActions(ctx: AnimationContext) {
  const { store, patch, present, showError, run, services } = ctx;
  const { dialogs, engine, renderer } = services;

  /** AN5: the one selected object if it is a picture, with its file. */
  function selectedPicture(): { object: PictureObject; path: string; file: Picture } | null {
    const ids = ctx.liveSelection();
    const found = ids.length === 1 ? findObject(present(), ids[0]!) : null;
    if (found?.object.kind !== 'picture') return null;
    const { pictureId } = found.object;
    const file = present().pictures.find((p) => p.id === pictureId);
    return file ? { object: found.object, path: file.path, file } : null;
  }

  /**
   * AN5 Crop… / Make a colour see-through…: `make` saves the new picture file beside the old one
   * and says how the object changes to show it; that is one undo step, and the student is told
   * where the file is. `how` words the messages.
   */
  async function remakePicture(
    how: { label: string; busy: string; done: string; none: string },
    make: (file: Picture) => Promise<{ to: Picture; change: (o: PictureObject) => PictureObject }>,
  ): Promise<void> {
    const picture = selectedPicture();
    if (!picture) {
      patch({ message: { kind: 'error', text: how.none } });
      return;
    }
    const { object, file } = picture;
    patch({ busy: how.busy });
    try {
      checkPictureEditable(object, file, how.done);
      const { to, change } = await make(file);
      if (run(cmd.changePicture(object.id, to, change, how.label)))
        patch({
          message: {
            kind: 'info',
            text: `Saved ${fileNameOf(to.path)} beside ${fileNameOf(file.path)}.`,
          },
        });
    } catch (error) {
      showError(error);
    } finally {
      patch({ busy: null });
    }
  }

  async function tracePicture(
    picture: { path: string },
    maxSide: number,
    options: TraceOptions,
  ): Promise<{ width: number; height: number; regions: TracedRegion[] }> {
    const pixels = await renderer.pixels(picture.path, maxSide);
    return { width: pixels.width, height: pixels.height, regions: traceBitmap(pixels, options) };
  }

  return {
    /** AN5: the selected picture's file (path and size), for Crop… and See-through…; or null. */
    selectedPictureFile: (): Picture | null => selectedPicture()?.file ?? null,

    /** AN5: the selected picture's pixels, at most `maxSide` px, for the see-through preview. */
    async picturePixels(maxSide: number): Promise<Pixels | null> {
      const picture = selectedPicture();
      return picture ? renderer.pixels(picture.path, maxSide) : null;
    },

    /**
     * AN5 *Crop…*: the part of the selected picture kept (in its own pixels) is saved as a new
     * picture beside it, at its own size (named `name` if typed, else photo1.jpg), and the object
     * shows only that part, where it was on the stage.
     */
    cropPicture: (region: CropRegion, name?: string): Promise<void> =>
      remakePicture(
        {
          label: 'Crop picture',
          busy: 'Cropping…',
          done: 'cropped',
          none: 'Select a picture to crop it.',
        },
        async (file) => {
          const plan = planFreeCrop(file, region);
          const path = await engine.resizeCropImage(file.path, plan, name);
          const to = { id: newId(), path, width: plan.crop.width, height: plan.crop.height };
          return { to, change: (o) => croppedPicture(o, file, plan.crop, to) };
        },
      ),

    /**
     * AN5 *Make a colour see-through…*: the picked colour (and the colours near it) made
     * see-through in a new PNG beside the picture (photo.jpg → photo1.png), which the object shows.
     */
    seeThroughPicture: (key: ColourKey, name?: string): Promise<void> =>
      remakePicture(
        {
          label: 'Make a colour see-through',
          busy: 'Making a colour see-through…',
          done: 'made see-through',
          none: 'Select a picture to make a colour in it see-through.',
        },
        async (file) => {
          colourKeyFilter(key); // a colour not picked is explained before anything is made
          const path = await engine.colourKeyImage(file.path, key, name);
          const to = { id: newId(), path, width: file.width, height: file.height };
          return { to, change: (o) => ({ ...o, pictureId: to.id }) };
        },
      ),

    /** AN5: a picture file chosen by the student, placed at its own size. */
    async addPicture(at: Point): Promise<void> {
      const path = await dialogs.openPicture();
      if (!path) return;
      try {
        const info = await engine.probe(path);
        // FFmpeg calls a GIF a video (it can have several pictures); its first picture is shown.
        if ((info.kind !== 'image' && info.container !== 'gif') || !info.video)
          throw new EditError('Choose a picture file, such as a PNG or JPG.');
        const known = present().pictures.find((p) => p.path === path);
        const picture: Picture = known ?? {
          id: newId(),
          path,
          width: info.video.width,
          height: info.video.height,
        };
        const object = createPicture(picture, at);
        if (run(cmd.addPicture(store.get().layerId, picture, object)))
          patch({ selection: [object.id], tool: 'select' });
      } catch (error) {
        showError(error);
      }
    },

    /**
     * AN14: *Import frames…* — the pictures in a folder, sorted by name, shown one after another
     * at `rate` pictures a second on a layer of their own (stop motion).
     */
    async importFrames(rate: number): Promise<void> {
      const { stage } = present();
      try {
        stopMotionTiming(1, rate, stage.fps);
      } catch (error) {
        showError(error);
        return;
      }
      const chosen = await dialogs.openFrames();
      if (chosen.length === 0) return;
      patch({ busy: 'Importing frames…' });
      try {
        const pictures: Picture[] = [];
        for (const path of sortByName(chosen)) {
          const info = await engine.probe(path).catch(() => null);
          if (!info?.video || (info.kind !== 'image' && info.container !== 'gif')) continue;
          const known = present().pictures.find((p) => p.path === path);
          pictures.push(
            known ?? { id: newId(), path, width: info.video.width, height: info.video.height },
          );
        }
        if (pictures.length === 0)
          throw new EditError('There are no pictures in that folder (PNG, JPG, GIF, BMP or SVG).');
        const object = stopMotion(pictures, rate, stage);
        const { length } = stopMotionTiming(pictures.length, rate, stage.fps);
        let layerId: Id | null = null;
        if (
          run(
            cmd.importFrames(store.get().layerId, pictures, object, length, (id) => (layerId = id)),
          ) &&
          layerId
        ) {
          const seconds = Math.round((length / stage.fps) * 10) / 10;
          patch({
            layerId,
            selection: [object.id],
            tool: 'select',
            message: {
              kind: 'info',
              text: `Imported ${pictures.length} pictures: ${seconds} s at ${rate} pictures a second.`,
            },
          });
        }
      } catch (error) {
        showError(error);
      } finally {
        patch({ busy: null });
      }
    },

    /** AN5: the selected picture becomes a group of filled shapes traced from it (one undo step). */
    async traceBitmap(options: TraceOptions): Promise<void> {
      const picture = selectedPicture();
      if (!picture) {
        patch({ message: { kind: 'error', text: 'Select a picture to trace it.' } });
        return;
      }
      patch({ busy: 'Tracing…' });
      try {
        const traced = await tracePicture(picture, TRACE_MAX_SIDE, options);
        if (traced.regions.length === 0)
          throw new EditError('There is nothing to trace: the picture is see-through.');
        const group = tracedGroup(picture.object, traced.regions, traced);
        if (run(cmd.replaceObject(picture.object.id, group, 'Trace bitmap')))
          patch({ selection: [group.id] });
      } catch (error) {
        showError(error);
      } finally {
        patch({ busy: null });
      }
    },

    /** AN5: what Trace bitmap would make, from a small copy, for the dialog; null if no picture. */
    async tracePreview(
      options: TraceOptions,
    ): Promise<{ width: number; height: number; regions: TracedRegion[] } | null> {
      const picture = selectedPicture();
      return picture ? tracePicture(picture, TRACE_PREVIEW_SIDE, options) : null;
    },
  };
}
