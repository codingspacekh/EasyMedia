// Real file dialogs and project-file I/O for the main process.
import { dialog, type BrowserWindow } from 'electron';
import type { Dialogs, ProjectFiles } from '../core/ports.ts';
import { CONTAINERS } from '../core/render/formats.ts';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

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
        filters: [{ name: 'EasyMedia project', extensions: ['mve'] }],
      });
      return r.canceled ? null : (r.filePaths[0] ?? null);
    },
    async saveProject(name) {
      const r = await dialog.showSaveDialog(win(), {
        title: 'Save project',
        defaultPath: `${name}.mve`,
        filters: [{ name: 'EasyMedia project', extensions: ['mve'] }],
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
export const projectFiles = (textFolder: string): ProjectFiles => ({
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
});
