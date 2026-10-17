// Electron main process (ARCHITECTURE §2).
import { app, BrowserWindow, ipcMain, Menu, protocol, systemPreferences } from 'electron';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fromMediaUrl } from '../core/media-url.ts';
import type { Events } from '../preload/api.ts';
import { detectHardwareEncoder, encoderTester, videoEncoder } from './ffmpeg/hardware.ts';
import { binaryPaths, platformKey } from './ffmpeg/paths.ts';
import { sendToWindow } from './send.ts';
import { registerIpc } from './ipc.ts';
import { menuTemplate } from './menu.ts';
import { microphoneAccess } from './microphone.ts';
import { createNodeMediaEngine } from './media/engine.ts';
import { recordPerformance } from './perf.ts';
import { createAllowList } from './protocol/allowlist.ts';
import { serveMediaFile } from './protocol/serve.ts';
import { electronDialogs, projectFiles } from './services.ts';

const APP_ROOT = join(__dirname, '..');
const RESOURCES = app.isPackaged ? process.resourcesPath : join(APP_ROOT, 'resources');

// Tests run with their own empty user-data folder (no real proxies or recovery file).
if (process.env.EASYMEDIA_USER_DATA) app.setPath('userData', process.env.EASYMEDIA_USER_DATA);

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow: BrowserWindow | undefined;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'EasyMedia',
    backgroundColor: '#101216',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  // The app never opens other windows or leaves its own page.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.once('ready-to-show', () => win.show());
  void win.loadFile(join(APP_ROOT, 'dist', 'index.html'));
  return win;
}

void app.whenReady().then(async () => {
  const binaries = binaryPaths(RESOURCES, platformKey(process.platform, process.arch));
  const proxies = join(app.getPath('userData'), 'proxies');
  await mkdir(proxies, { recursive: true });
  const allow = createAllowList();
  const hardware = await detectHardwareEncoder(process.platform, encoderTester(binaries.ffmpeg));

  protocol.handle('media', (request) => {
    const path = fromMediaUrl(request.url);
    return path
      ? serveMediaFile(path, request.headers.get('range'), allow)
      : new Response(null, { status: 400 });
  });

  const engine = createNodeMediaEngine(binaries, { videoEncoder: videoEncoder(hardware) });
  // Quitting stops every FFmpeg job: no preview or export keeps running after EasyMedia closes.
  app.on('before-quit', () => engine.cancelAll());

  registerIpc({
    ipc: ipcMain,
    send: <E extends keyof Events>(event: E, payload: Events[E]) =>
      sendToWindow(mainWindow, event, payload),
    engine,
    allow,
    paths: {
      proxies,
      recovery: join(app.getPath('userData'), 'recovery.mve'),
      snapshots: join(app.getPath('userData'), 'snapshots'),
    },
    dialogs: electronDialogs(() => mainWindow),
    files: projectFiles(join(app.getPath('userData'), 'text')),
    microphoneAccess: microphoneAccess(
      process.platform,
      systemPreferences,
      app.commandLine.hasSwitch('use-fake-device-for-media-stream'),
    ),
  });

  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      menuTemplate(
        process.platform,
        (action) => sendToWindow(mainWindow, 'menu:action', action),
        !app.isPackaged,
      ),
    ),
  );

  mainWindow = createWindow();
  if (process.env.EASYMEDIA_PERF_REPORT)
    recordPerformance(process.env.EASYMEDIA_PERF_REPORT, mainWindow);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
