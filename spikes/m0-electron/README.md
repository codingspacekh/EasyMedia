# M0 performance spike (throw-away)

**Not production code.** Per MILESTONES rule R8 this folder is never merged into `src/` and is not test-driven. It answers one question: *is Electron + bundled FFmpeg + proxy editing fast enough on our laptops?*

It imports a clip, makes a 640×360 proxy, plays the proxy for 10 s, exports a 1920×1080 MP4 with the software encoder (libx264) and, if available, a hardware encoder, then writes a JSON report checked against README targets N1, N2, N4 and N5.

## Run it

```bash
npm ci
npm run fetch:ffmpeg
npm run fixtures -- --group spike --out spikes/m0-electron/out     # 60 s 1080p test clip
npm run spike -- --auto spikes/m0-electron/out/spike_1080p30_60s.mp4 --report spikes/m0-electron/out/report.json
```

Without `--auto` a window opens with **Import**, **Export** buttons and a live RAM display, for trying your own clips (e.g. a coursebook video).

Copy the printed summary into `docs/acceptance/M0.md`.
