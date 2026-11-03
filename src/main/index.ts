// Electron main process (ARCHITECTURE §2).
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  net,
  protocol,
  screen,
  shell,
  systemPreferences,
} from 'electron';
import { execFile } from 'node:child_process';
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
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
import { moveOldSettings } from './old-settings.ts';
import { recordPerformance } from './perf.ts';
import { createAllowList } from './protocol/allowlist.ts';
import { serveMediaFile } from './protocol/serve.ts';
import { selfCheck } from './self-check.ts';
import { setUpUpdates } from './update-setup.ts';
import { electronDialogs, projectFiles } from './services.ts';

const APP_ROOT = join(__dirname, '..');
const RESOURCES = app.isPackaged ? process.resourcesPath : join(APP_ROOT, 'resources');
// The installed app has its icon built in; `npm run app` would otherwise show Electron's.
const DEV_ICON = app.isPackaged ? undefined : join(APP_ROOT, 'build-resources', 'icon.png');

// Tests run with their own empty user-data folder (no real proxies or recovery file).
if (process.env.ONEEDITOR_USER_DATA) app.setPath('userData', process.env.ONEEDITOR_USER_DATA);
// The settings from when the app was called EasyMedia come along (before anything opens them).
else moveOldSettings(app.getPath('appData'));

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

/**
 * AN18: Test — the animation's web page in a window of its own, the stage's size (smaller on a
 * small screen), with nothing of the app: no preload, sandboxed, no navigation or new windows. The
 * page is written into the app's own folder (a page this size is too long for a data: URL).
 */
async function showTestPage(html: string, title: string, width: number, height: number) {
  const dir = join(app.getPath('userData'), 'test');
  await mkdir(dir, { recursive: true });
  const file = join(dir, 'test-animation.html');
  await writeFile(file, html, 'utf8');
  const area = screen.getPrimaryDisplay().workAreaSize;
  const scale = Math.min(1, (area.width * 0.9) / width, (area.height * 0.9) / height);
  const win = new BrowserWindow({
    parent: mainWindow,
    title: `Test: ${title}`,
    width: Math.max(200, Math.round(width * scale)),
    height: Math.max(150, Math.round(height * scale)),
    useContentSize: true,
    autoHideMenuBar: true,
    backgroundColor: '#1d2026',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  win.on('page-title-updated', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  await win.loadFile(file);
}
let closeGuard: ReturnType<typeof createCloseGuard> | undefined;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'OneEditor',
    ...(DEV_ICON && { icon: DEV_ICON }),
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

/** M12: ONEEDITOR_SELF_CHECK=<file> — check the installed app, write the result there, quit. */
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
  if (process.env.ONEEDITOR_SELF_CHECK) return runSelfCheck(process.env.ONEEDITOR_SELF_CHECK);
  const binaries = binaryPaths(RESOURCES, platformKey(process.platform, process.arch));
  const proxies = join(app.getPath('userData'), 'proxies');
  await mkdir(proxies, { recursive: true });
  const learn = join(app.getPath('userData'), 'learn');
  await mkdir(learn, { recursive: true });
  // AN15: an animation export's frames wait here for FFmpeg, which removes them afterwards.
  const animationFrames = join(app.getPath('userData'), 'animation-frames');
  await mkdir(animationFrames, { recursive: true });
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
  // or export keeps running after OneEditor closes.
  app.on('before-quit', () => closeGuard?.quitting());
  app.on('will-quit', () => engine.cancelAll());

  // M17a U1–U5: updates, only in the installed app built with an update address.
  const updates = await setUpUpdates({
    packaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    configFile: join(RESOURCES, 'updates.json'),
    userData: app.getPath('userData'),
    downloads: app.getPath('downloads'),
    send: (state) => sendToWindow(mainWindow, 'updates:state', state),
    fetch: (url) => net.fetch(url),
    showItem: (path) => shell.showItemInFolder(path),
    openPath: (path) => shell.openPath(path),
    quit: () => app.quit(),
    loadUpdater: async () => (await import('electron-updater')).autoUpdater,
  });

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
      animationFrames,
      preferences: join(app.getPath('userData'), 'preferences.json'),
      // Installed: next to FFmpeg in the resources; in development: made by "npm run licences".
      licences: app.isPackaged
        ? join(RESOURCES, 'THIRD_PARTY_LICENSES.txt')
        : join(APP_ROOT, 'THIRD_PARTY_LICENSES.txt'),
    },
    dialogs: electronDialogs(() => mainWindow),
    files: projectFiles(join(app.getPath('userData'), 'text')),
    closeAnswer: (close) => closeGuard?.answer(close),
    // AN15: the web page player is built beside main.cjs; the fonts are the built pages' own.
    pageFiles: {
      player: join(__dirname, 'player.js'),
      assets: join(APP_ROOT, 'dist', 'assets'),
      read: async (path) => new Uint8Array(await readFile(path)),
      show: showTestPage,
    },
    updates,
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

  if (DEV_ICON) app.dock?.setIcon(DEV_ICON);
  mainWindow = createWindow();
  updates.start();
  if (process.env.ONEEDITOR_PERF_REPORT)
    recordPerformance(process.env.ONEEDITOR_PERF_REPORT, mainWindow);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
