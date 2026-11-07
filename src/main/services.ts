// Real file dialogs and project-file I/O for the main process.
import { dialog, type BrowserWindow } from 'electron';
import type {
  AnimationExportFormat,
  Dialogs,
  GraphicExportFormat,
  ProjectFiles,
} from '../core/ports.ts';
import { CONTAINERS } from '../core/render/formats.ts';
import { AUDIO_FORMATS } from '../core/render/audio-formats.ts';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PICTURE_EXTENSIONS, picturesIn } from './media/pictures.ts';
import { SOUND_EXTENSIONS } from '../core/animation/sound.ts';

const MEDIA_EXTENSIONS = [
  'mp4',
  'mov',
  'avi',
  'wmv',
  'mkv',
  'mpg',
  'm4v',
  'jpg',
  'jpeg',
  'png',
  'bmp',
  'tif',
  'tiff',
  'gif',
  'mp3',
  'wav',
  'm4a',
  'aac',
  'flac',
  'ogg',
  'wma',
];

/** AN15: the file types of the animation exports. */
/** G11 (M18): what each image export is saved as. */
const GRAPHIC_EXPORTS: Record<GraphicExportFormat, { label: string; extension: string }> = {
  png: { label: 'PNG picture', extension: 'png' },
  jpg: { label: 'JPG picture', extension: 'jpg' },
  svg: { label: 'SVG vector picture', extension: 'svg' },
};

const ANIMATION_EXPORTS: Record<AnimationExportFormat, { label: string; extension: string }> = {
  png: { label: 'PNG picture', extension: 'png' },
  mp4: { label: 'MP4 video', extension: 'mp4' },
  avi: { label: 'AVI video', extension: 'avi' },
  mov: { label: 'MOV video', extension: 'mov' },
  gif: { label: 'Animated GIF', extension: 'gif' },
  // The frames are saved beside the chosen name: Task1_0001.png, Task1_0002.png…
  'png-sequence': { label: 'PNG sequence (one picture per frame)', extension: 'png' },
  html: { label: 'HTML web animation', extension: 'html' },
  svg: { label: 'SVG picture', extension: 'svg' },
};

export function electronDialogs(window: () => BrowserWindow | undefined): Dialogs {
  const win = () => window() as BrowserWindow;
  return {
    async openMedia() {
      const r = await dialog.showOpenDialog(win(), {
        title: 'Import media',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Video, audio and images', extensions: MEDIA_EXTENSIONS }],
      });
      return r.canceled ? [] : r.filePaths;
    },
    async openProject() {
      const r = await dialog.showOpenDialog(win(), {
        title: 'Open project',
        properties: ['openFile'],
        filters: [{ name: 'OneEditor project', extensions: ['mve'] }],
      });
      return r.canceled ? null : (r.filePaths[0] ?? null);
    },
    async saveProject(name) {
      const r = await dialog.showSaveDialog(win(), {
        title: 'Save project',
        defaultPath: `${name}.mve`,
        filters: [{ name: 'OneEditor project', extensions: ['mve'] }],
      });
      return r.canceled ? null : (r.filePath ?? null);
    },
    async exportVideo(name, container) {
      const { label, extension } = CONTAINERS[container] ?? CONTAINERS.mp4;
      const r = await dialog.showSaveDialog(win(), {
        title: 'Export video',
        defaultPath: `${name}.${extension}`,
        filters: [{ name: `${label} video`, extensions: [extension] }],
      });
      return r.canceled ? null : (r.filePath ?? null);
    },
    async exportAudio(name, format) {
      const { label, extension } = AUDIO_FORMATS[format] ?? AUDIO_FORMATS.mp3;
      const r = await dialog.showSaveDialog(win(), {
        title: 'Export audio',
        defaultPath: `${name}.${extension}`,
        filters: [{ name: `${label} audio`, extensions: [extension] }],
      });
      return r.canceled ? null : (r.filePath ?? null);
    },
    async confirm(message) {
      const r = await dialog.showMessageBox(win(), {
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 1,
        cancelId: 1,
        message,
      });
      return r.response === 0;
    },
    async unsavedChanges() {
      const r = await dialog.showMessageBox(win(), {
        type: 'warning',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        message: 'Do you want to save the changes to your project?',
        detail: 'Video and Audio mode work that is not saved will be lost.',
      });
      return (['save', 'discard', 'cancel'] as const)[r.response] ?? 'cancel';
    },
    async openTaskCheck() {
      const r = await dialog.showOpenDialog(win(), {
        title: 'Open task check',
        properties: ['openFile'],
        filters: [{ name: 'OneEditor task check', extensions: ['mvetask'] }],
      });
      return r.canceled ? null : (r.filePaths[0] ?? null);
    },
    async saveTaskCheck(name) {
      const r = await dialog.showSaveDialog(win(), {
        title: 'Save task check',
        defaultPath: `${name}.mvetask`,
        filters: [{ name: 'OneEditor task check', extensions: ['mvetask'] }],
      });
      return r.canceled ? null : (r.filePath ?? null);
    },
    async openAnimation() {
      const r = await dialog.showOpenDialog(win(), {
        title: 'Open animation',
        properties: ['openFile'],
        filters: [{ name: 'OneEditor animation', extensions: ['mvea'] }],
      });
      return r.canceled ? null : (r.filePaths[0] ?? null);
    },
    async openPicture() {
      const r = await dialog.showOpenDialog(win(), {
        title: 'Add a picture',
        properties: ['openFile'],
        filters: [{ name: 'Pictures', extensions: PICTURE_EXTENSIONS }],
      });
      return r.canceled ? null : (r.filePaths[0] ?? null);
    },
    async openSound() {
      const r = await dialog.showOpenDialog(win(), {
        title: 'Add a sound',
        properties: ['openFile'],
        filters: [{ name: 'Sounds', extensions: [...SOUND_EXTENSIONS] }],
      });
      return r.canceled ? null : (r.filePaths[0] ?? null);
    },
    async openExport() {
      const r = await dialog.showOpenDialog(win(), {
        title: 'Check a file: choose your export (all the pictures of a PNG sequence)',
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'Exported video, sound, GIF, web page or PNG sequence',
            extensions: [...MEDIA_EXTENSIONS, 'html', 'htm'],
          },
        ],
      });
      return r.canceled ? [] : r.filePaths;
    },
    async openFrames() {
      const r = await dialog.showOpenDialog(win(), {
        title: 'Import frames: choose the folder of pictures',
        properties: ['openDirectory'],
      });
      const folder = r.canceled ? undefined : r.filePaths[0];
      return folder ? picturesIn(folder) : [];
    },
    async saveAnimation(name) {
      const r = await dialog.showSaveDialog(win(), {
        title: 'Save animation',
        defaultPath: `${name}.mvea`,
        filters: [{ name: 'OneEditor animation', extensions: ['mvea'] }],
      });
      return r.canceled ? null : (r.filePath ?? null);
    },
    async exportAnimation(name, format) {
      const { label, extension } = ANIMATION_EXPORTS[format];
      const r = await dialog.showSaveDialog(win(), {
        title: 'Export animation',
        defaultPath: `${name}.${extension}`,
        filters: [{ name: label, extensions: [extension] }],
      });
      return r.canceled ? null : (r.filePath ?? null);
    },
    async openGraphic() {
      const r = await dialog.showOpenDialog(win(), {
        title: 'Open image',
        properties: ['openFile'],
        filters: [{ name: 'OneEditor image', extensions: ['mveg'] }],
      });
      return r.canceled ? null : (r.filePaths[0] ?? null);
    },
    async saveGraphic(name) {
      const r = await dialog.showSaveDialog(win(), {
        title: 'Save image',
        defaultPath: `${name}.mveg`,
        filters: [{ name: 'OneEditor image', extensions: ['mveg'] }],
      });
      return r.canceled ? null : (r.filePath ?? null);
    },
    async exportGraphic(name, format) {
      const { label, extension } = GRAPHIC_EXPORTS[format];
      const r = await dialog.showSaveDialog(win(), {
        title: 'Export image',
        defaultPath: `${name}.${extension}`,
        filters: [{ name: label, extensions: extension === 'jpg' ? ['jpg', 'jpeg'] : [extension] }],
      });
      return r.canceled ? null : (r.filePath ?? null);
    },
    async chooseFolder(title) {
      const r = await dialog.showOpenDialog(win(), {
        title,
        properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
      });
      return r.canceled ? null : (r.filePaths[0] ?? null);
    },
  };
}

/**
 * Project files are written to a temporary file and renamed, so a crash never leaves half a file
 * (ARCHITECTURE §9). Text pictures go into `textFolder`, the app's own folder.
 */
export const projectFiles = (
  textFolder: string,
  soundFolder = join(dirname(textFolder), 'sounds'),
): ProjectFiles => ({
  read: (path) => readFile(path, 'utf8'),
  async write(path, text) {
    const temp = `${path}.saving`;
    try {
      await writeFile(temp, text, 'utf8');
      await rename(temp, path);
    } finally {
      await rm(temp, { force: true });
    }
  },
  remove: (path) => rm(path, { force: true }),
  async copy(from, to) {
    await mkdir(dirname(to), { recursive: true });
    await copyFile(from, to);
  },
  async saveImage(name, png) {
    await mkdir(textFolder, { recursive: true });
    const path = join(textFolder, `${name}.png`);
    await writeFile(path, png);
    return path;
  },
  async saveSound(name, wav) {
    await mkdir(soundFolder, { recursive: true });
    const path = join(soundFolder, `${name}.wav`);
    await writeFile(path, wav);
    return path;
  },
  async writeBytes(path, bytes) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  },
});
