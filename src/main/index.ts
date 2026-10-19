// Electron main process (ARCHITECTURE §2).
import { app, BrowserWindow, ipcMain, Menu, protocol, shell, systemPreferences } from 'electron';
import { execFile } from 'node:child_process';
import { access, mkdir, readdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { fromMediaUrl } from '../core/media-url.ts';
import type { Events } from '../preload/api.ts';
import { detectHardwareEncoder, encoderTester, videoEncoder } from './ffmpeg/hardware.ts';
import { binaryPaths, platformKey } from './ffmpeg/paths.ts';
import { sendToWindow } from './send.ts';
import { registerIpc } from './ipc.ts';
import { createCloseGuard } from './close-guard.ts';
import { menuTemplate } from './menu.ts';
import { microphoneAccess } from './microphone.ts';
import { createNodeMediaEngine } from './media/engine.ts';
import { recordPerformance } from './perf.ts';
import { createAllowList } from './protocol/allowlist.ts';
import { serveMediaFile } from './protocol/serve.ts';
import { selfCheck } from './self-check.ts';
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
let closeGuard: ReturnType<typeof createCloseGuard> | undefined;

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
  // P7: unsaved work is not lost by closing the window or quitting; the page asks first.
  closeGuard = createCloseGuard(
    {
      on: (e, l) => win.on(e, l),
      close: () => win.close(),
      isCrashed: () => win.webContents.isCrashed(),
    },
    { ask: () => sendToWindow(win, 'app:closeRequested', null), quit: () => app.quit() },
  );
  void win.loadFile(join(APP_ROOT, 'dist', 'index.html'));
  return win;
}

/** M12: EASYMEDIA_SELF_CHECK=<file> — check the installed app, write the result there, quit. */
async function runSelfCheck(file: string): Promise<void> {
  const run = promisify(execFile);
  const result = await selfCheck({
    binaries: binaryPaths(RESOURCES, platformKey(process.platform, process.arch)),
    pagesDir: join(APP_ROOT, 'dist'),
    run: async (bin, args) => (await run(bin, args)).stdout,
    exists: (path) =>
      access(path).then(
        () => true,
        () => false,
      ),
    list: (dir) => readdir(dir),
  });
  // The pages also load in a (hidden) window.
  const win = new BrowserWindow({ show: false });
  const loaded = await Promise.race([
    win.loadFile(join(APP_ROOT, 'dist', 'index.html')).then(() => win.webContents.getTitle()),
    new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timed out')), 30_000)),
  ]).then(
    (title) => ({ name: 'window', ok: true, detail: title }),
    (error: Error) => ({ name: 'window', ok: false, detail: error.message }),
  );
  const checks = [...result.checks, loaded];
  const ok = checks.every((c) => c.ok);
  await writeFile(file, `${JSON.stringify({ ok, version: app.getVersion(), checks }, null, 2)}\n`);
  app.exit(ok ? 0 : 1);
}

void app.whenReady().then(async () => {
  if (process.env.EASYMEDIA_SELF_CHECK) return runSelfCheck(process.env.EASYMEDIA_SELF_CHECK);
  const binaries = binaryPaths(RESOURCES, platformKey(process.platform, process.arch));
  const proxies = join(app.getPath('userData'), 'proxies');
  await mkdir(proxies, { recursive: true });
  const learn = join(app.getPath('userData'), 'learn');
  await mkdir(learn, { recursive: true });
  const allow = createAllowList();
  const hardware = await detectHardwareEncoder(process.platform, encoderTester(binaries.ffmpeg));

  protocol.handle('media', (request) => {
    const path = fromMediaUrl(request.url);
    return path
      ? serveMediaFile(path, request.headers.get('range'), allow)
      : new Response(null, { status: 400 });
  });

  const engine = createNodeMediaEngine(binaries, { videoEncoder: videoEncoder(hardware) });
  // Quit asks the page first (P7); once it really quits, every FFmpeg job stops, so no preview
  // or export keeps running after EasyMedia closes.
  app.on('before-quit', () => closeGuard?.quitting());
  app.on('will-quit', () => engine.cancelAll());

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
      learn,
      preferences: join(app.getPath('userData'), 'preferences.json'),
      // Installed: next to FFmpeg in the resources; in development: made by "npm run licences".
      licences: app.isPackaged
        ? join(RESOURCES, 'THIRD_PARTY_LICENSES.txt')
        : join(APP_ROOT, 'THIRD_PARTY_LICENSES.txt'),
    },
    dialogs: electronDialogs(() => mainWindow),
    files: projectFiles(join(app.getPath('userData'), 'text')),
    closeAnswer: (close) => closeGuard?.answer(close),
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
        // Installed: in the resources; in development: made by "npm run guides".
        (guide) =>
          void shell.openPath(
            join(
              app.isPackaged ? join(RESOURCES, 'guides') : join(APP_ROOT, 'build-info', 'guides'),
              `${guide}.html`,
            ),
          ),
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
