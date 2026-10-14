// Real file dialogs and project-file I/O for the main process.
import { dialog, type BrowserWindow } from 'electron';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import type { MainServices } from './ipc.ts';

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

export function electronDialogs(window: () => BrowserWindow | undefined): MainServices['dialogs'] {
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
    async exportVideo(name) {
      const r = await dialog.showSaveDialog(win(), {
        title: 'Export video',
        defaultPath: `${name}.mp4`,
        filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
      });
      return r.canceled ? null : (r.filePath ?? null);
    },
  };
}

/** Project files are written to a temporary file and renamed, so a crash never leaves half a file (ARCHITECTURE §9). */
export const projectFiles: MainServices['files'] = {
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
};
