// M0 performance spike — throw-away (MILESTONES R8). Not test-driven, never merged into src/.
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out');
const KEY = `${process.platform}-${process.arch}`;
const EXT = process.platform === 'win32' ? '.exe' : '';
const FFMPEG = path.join(ROOT, 'resources', 'ffmpeg', KEY, `ffmpeg${EXT}`);
const FFPROBE = path.join(ROOT, 'resources', 'ffmpeg', KEY, `ffprobe${EXT}`);

const argv = process.argv.slice(2);
const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const AUTO_INPUT = opt('--auto') && path.resolve(opt('--auto'));
const REPORT = path.resolve(opt('--report') ?? path.join(OUT, 'report.json'));

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
fs.mkdirSync(OUT, { recursive: true });

// ---- RAM sampling (sum of all Electron processes) ----
let peakMB = 0;
let idleMB = 0;
const ramNowMB = () =>
  app.getAppMetrics().reduce((sum, p) => sum + (p.memory.workingSetSize ?? 0), 0) / 1024;
setInterval(() => (peakMB = Math.max(peakMB, ramNowMB())), 250).unref();

// ---- FFmpeg helpers ----
const run = (bin, args) =>
  new Promise((resolve, reject) =>
    execFile(bin, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) =>
      err ? reject(new Error(stderr || err.message)) : resolve(stdout),
    ),
  );

async function probe(file) {
  const json = JSON.parse(
    await run(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]),
  );
  const v = json.streams.find((s) => s.codec_type === 'video');
  return { duration: Number(json.format.duration), width: v?.width, height: v?.height };
}

function ffmpegWithProgress(args, duration, onProgress) {
  return new Promise((resolve, reject) => {
    const t = Date.now();
    const p = spawn(FFMPEG, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostats',
      '-progress',
      'pipe:1',
      ...args,
    ]);
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.stdout.on('data', (d) => {
      const m = /out_time_us=(\d+)/.exec(String(d));
      if (m && duration) onProgress(Math.min(1, Number(m[1]) / 1e6 / duration));
    });
    p.on('close', (code) =>
      code === 0 ? resolve((Date.now() - t) / 1000) : reject(new Error(err)),
    );
  });
}

async function hardwareEncoder() {
  const candidates =
    process.platform === 'darwin' ? ['h264_videotoolbox'] : ['h264_nvenc', 'h264_qsv', 'h264_amf'];
  for (const enc of candidates) {
    try {
      await run(FFMPEG, [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=640x360:d=0.2',
        '-c:v',
        enc,
        '-f',
        'null',
        '-',
      ]);
      return enc;
    } catch {
      /* not available on this machine */
    }
  }
  return null;
}

// ---- IPC ----
ipcMain.handle('auto-input', () => AUTO_INPUT ?? null);
ipcMain.handle('pick-file', async () => {
  const r = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi', 'wmv', 'mkv'] }],
  });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('probe', (_e, file) => probe(file));
ipcMain.handle('ram', () => ({ nowMB: ramNowMB(), peakMB, idleMB }));
ipcMain.handle('hw-encoder', () => hardwareEncoder());

ipcMain.handle('make-proxy', async (e, file, duration) => {
  const out = path.join(OUT, 'proxy.mp4');
  const seconds = await ffmpegWithProgress(
    [
      '-y',
      '-i',
      file,
      '-vf',
      'scale=-2:360',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '28',
      '-g',
      '30',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      out,
    ],
    duration,
    (p) => e.sender.send('progress', 'Proxy', p),
  );
  return { path: out, seconds };
});

ipcMain.handle('export', async (e, file, duration, encoder) => {
  const out = path.join(OUT, `export-${encoder}.mp4`);
  const quality = encoder === 'libx264' ? ['-preset', 'veryfast', '-crf', '20'] : ['-b:v', '8M'];
  const seconds = await ffmpegWithProgress(
    [
      '-y',
      '-i',
      file,
      '-vf',
      'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
      '-c:v',
      encoder,
      ...quality,
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      out,
    ],
    duration,
    (p) => e.sender.send('progress', `Export ${encoder}`, p),
  );
  return { encoder, seconds, sizeMB: fs.statSync(out).size / 1e6 };
});

ipcMain.handle('report', async (_e, data) => {
  const ffmpegVersion = (await run(FFMPEG, ['-hide_banner', '-version'])).split('\n')[0];
  const report = {
    date: new Date().toISOString(),
    machine: {
      platform: KEY,
      os: `${os.type()} ${os.release()}`,
      cpu: os.cpus()[0]?.model,
      cores: os.cpus().length,
      ramGB: Math.round(os.totalmem() / 2 ** 30),
    },
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      ffmpeg: ffmpegVersion,
    },
    startupMs,
    ram: { idleMB: Math.round(idleMB), peakMB: Math.round(peakMB) },
    ...data,
  };
  const d = report.input?.duration ?? 60;
  report.budget = {
    'N5 start ≤ 5 s': startupMs <= 5000,
    'N4 RAM ≤ 600 MB': report.ram.peakMB <= 600,
    'N1 preview: dropped frames ≤ 5 %': (report.playback?.droppedPct ?? 100) <= 5,
    'N2 export of 1 min ≤ 3 min (best encoder)':
      (Math.min(
        report.exportSoftware?.seconds ?? Infinity,
        report.exportHardware?.seconds ?? Infinity,
      ) /
        d) *
        60 <=
      180,
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${REPORT}`);
  if (AUTO_INPUT) app.quit();
});

// ---- Window ----
let startupMs = 0;
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    backgroundColor: '#101216',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => {
    startupMs = Math.round(Date.now() - performance.timeOrigin);
    win.show();
    setTimeout(() => (idleMB = ramNowMB()), 1000);
  });
  win.loadFile(path.join(__dirname, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
