// What makes Animation mode's app an animation editor or Graphics mode's image editor (M18, D2):
// the same document, commands, drawing and exports, with its own file type, file dialogs,
// recovery file, new document and words. Graphics mode is the animation app with one frame.
import { createAnimation } from '../../core/animation/factory.ts';
import type { AnimationDoc } from '../../core/animation/types.ts';
import { defaultGraphic } from '../../core/graphics/document.ts';
import type { AppPaths, Dialogs } from '../../core/ports.ts';

export interface EditorKind {
  kind: 'animation' | 'graphic';
  /** The file's extension, without the dot. */
  extension: string;
  /** What the student makes, in messages: "animation", "image". */
  noun: string;
  /** The window title before it is saved. */
  untitled: string;
  /** A new, empty document. */
  fresh(): AnimationDoc;
  /** Where unsaved work is kept (P3). */
  recovery(paths: AppPaths): string;
  open(dialogs: Dialogs): Promise<string | null>;
  save(dialogs: Dialogs, suggestedName: string): Promise<string | null>;
}

export const ANIMATION_KIND: EditorKind = {
  kind: 'animation',
  extension: 'mvea',
  noun: 'animation',
  untitled: 'Untitled animation',
  fresh: () => createAnimation({ name: 'Untitled' }),
  recovery: (paths) => paths.animationRecovery ?? paths.recovery.replace(/\.mve$/i, '') + '.mvea',
  open: (dialogs) => dialogs.openAnimation(),
  save: (dialogs, name) => dialogs.saveAnimation(name),
};

/** Graphics mode (M18, syllabus 19): a still image in a `.mveg`. */
export const GRAPHIC_KIND: EditorKind = {
  kind: 'graphic',
  extension: 'mveg',
  noun: 'image',
  untitled: 'Untitled image',
  fresh: defaultGraphic,
  recovery: (paths) => paths.graphicRecovery ?? paths.recovery.replace(/\.mve$/i, '') + '.mveg',
  open: (dialogs) => dialogs.openGraphic(),
  save: (dialogs, name) => dialogs.saveGraphic(name),
};

/** "Logo.mveg" → "Logo" (any case of the extension). */
export const withoutExtension = (name: string, kind: EditorKind): string =>
  name.replace(new RegExp(`\\.${kind.extension}$`, 'i'), '');
