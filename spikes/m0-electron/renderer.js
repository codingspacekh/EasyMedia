// M0 performance spike — throw-away.
const $ = (id) => document.getElementById(id);
const log = (s) => ($('log').textContent += `${s}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fileUrl = (p) => 'file://' + (p.startsWith('/') ? '' : '/') + p.replaceAll('\\', '/');

window.spike.onProgress(
  (label, p) => ($('status').textContent = `${label}: ${Math.round(p * 100)} %`),
);
setInterval(async () => {
  const r = await window.spike.ram();
  $('ram').textContent = `RAM ${Math.round(r.nowMB)} MB (peak ${Math.round(r.peakMB)} MB)`;
}, 500);

async function importAndProxy(file) {
  const input = await window.spike.probe(file);
  log(`Probed ${file}: ${input.width}×${input.height}, ${input.duration.toFixed(1)} s`);
  const proxy = await window.spike.makeProxy(file, input.duration);
  log(`Proxy made in ${proxy.seconds.toFixed(1)} s`);
  $('video').src = fileUrl(proxy.path);
  return { input, proxy };
}

async function measurePlayback(seconds) {
  const v = $('video');
  await v.play();
  await sleep(seconds * 1000);
  v.pause();
  const q = v.getVideoPlaybackQuality();
  const droppedPct = q.totalVideoFrames ? (100 * q.droppedVideoFrames) / q.totalVideoFrames : 100;
  log(
    `Playback: ${q.droppedVideoFrames}/${q.totalVideoFrames} frames dropped (${droppedPct.toFixed(1)} %)`,
  );
  return {
    seconds,
    totalFrames: q.totalVideoFrames,
    droppedFrames: q.droppedVideoFrames,
    droppedPct,
  };
}

async function exportWith(file, duration, encoder) {
  const r = await window.spike.exportVideo(file, duration, encoder);
  log(
    `Export ${encoder}: ${r.seconds.toFixed(1)} s (${(duration / r.seconds).toFixed(2)}× real time), ${r.sizeMB.toFixed(1)} MB`,
  );
  return { ...r, realtimeFactor: duration / r.seconds };
}

let current = null;
$('import').onclick = async () => {
  const file = await window.spike.pickFile();
  if (!file) return;
  current = { file, ...(await importAndProxy(file)) };
  $('export').disabled = false;
};
$('export').onclick = () => exportWith(current.file, current.input.duration, 'libx264');

(async () => {
  const file = await window.spike.autoInput();
  if (!file) return;
  const { input, proxy } = await importAndProxy(file);
  await sleep(1000);
  const playback = await measurePlayback(10);
  const exportSoftware = await exportWith(file, input.duration, 'libx264');
  const hw = await window.spike.hardwareEncoder();
  const exportHardware = hw ? await exportWith(file, input.duration, hw) : null;
  await window.spike.report({
    input: { file, ...input },
    proxy: { seconds: proxy.seconds, realtimeFactor: input.duration / proxy.seconds },
    playback,
    exportSoftware,
    exportHardware,
  });
})().catch((e) => log(`ERROR ${e.message}`));
