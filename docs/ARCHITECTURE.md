# EasyMedia — System Design

This document describes **how** the app is built. For **what** it must do, see [`../README.md`](../README.md); requirement IDs (V1, A3, T2, X1…) refer to that file.

---

## 1. Architectural style

The app uses **layered architecture with ports and adapters** (also called *hexagonal architecture*):

- The **core** (project model, editing rules, FFmpeg command compiler, audio DSP) is plain TypeScript. It does not know about Electron, Node.js, the file system or the screen.
- The core talks to the outside world only through **ports** (TypeScript interfaces).
- **Adapters** implement those ports: the real one uses Electron + FFmpeg, and a **mock** one uses fake data.

Why this matters for a single-maintainer, teaching project:

| Benefit | How |
|---|---|
| Testable | The core is unit-tested with Vitest, no Electron or FFmpeg needed. |
| UI can be built first | The UI runs in an ordinary browser against the mock adapter. |
| Replaceable parts | Switching FFmpeg builds, or adding a browser version (`ffmpeg.wasm`) later, means writing one new adapter only. |
| Cross-platform | Windows/macOS differences live in the adapters; the core is identical (X6). |

```
┌──────────────────────────────────────────────────────────────────┐
│ PRESENTATION  (renderer, Svelte)                                 │
│  Screens · components · dialogs generated from effect schemas    │
├──────────────────────────────────────────────────────────────────┤
│ APPLICATION  (renderer, plain TS)                                │
│  Store · Command history · Use-cases (importMedia, exportVideo…) │
├──────────────────────────────────────────────────────────────────┤
│ DOMAIN / CORE  (plain TS, no dependencies)                       │
│  Project model · Timeline rules · Effect registry ·              │
│  Render-plan compiler · Audio DSP · File-size maths              │
├──────────────── PORTS (interfaces) ──────────────────────────────┤
│  MediaEngine · ProjectRepository · FileDialogs · Recorder ·      │
│  JobEvents                                                       │
├──────────────── ADAPTERS ────────────────────────────────────────┤
│  ElectronAdapter (IPC → main → FFmpeg)  │  MockAdapter (browser) │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Electron process model

```
┌───────────── Main process (Node.js) ─────────────┐
│ • Window + native menus (macOS menu bar, X3)     │
│ • IPC handlers  (ipc/*.ts)                       │
│ • JobQueue → spawns ffmpeg / ffprobe             │
│ • ProjectFileService (read/write .mve, migrate)  │
│ • media:// protocol (streams files, range reqs)  │
└───────────────▲──────────────────────────────────┘
                │ typed IPC (invoke / events)
┌───────────────┴─ Preload (contextBridge) ────────┐
│ exposes ONE object: window.mve  (Facade)          │
└───────────────▲──────────────────────────────────┘
                │
┌───────────────┴─ Renderer (UI) ──────────────────┐
│ Svelte app + store + core                        │
│   └─ Web Worker: audio DSP (never blocks the UI) │
└──────────────────────────────────────────────────┘
        ffmpeg / ffprobe  = separate OS processes
```

Security defaults: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The renderer can only call what `window.mve` exposes.

## 3. Design patterns used

| # | Pattern | Where | Why |
|---|---|---|---|
| P1 | **Ports & adapters** | `core/ports.ts`, `adapters/electron`, `adapters/mock` | Testability, UI-first development, cross-platform isolation |
| P2 | **Facade** | `preload.ts` → `window.mve` | One small, typed surface between UI and system |
| P3 | **Single store, one-way data flow** | `app/store.ts` | State always lives in one place: *UI → command → store → UI re-renders*. Easy to debug. |
| P4 | **Command** | `app/commands.ts`, `app/history.ts` | Every edit (trim, move, add title…) is a `Command` whose `apply()` returns a **new** project. Projects are immutable, so `History` keeps the previous project and undo restores it exactly: no per-command undo code, unlimited undo/redo |
| P5 | **Memento** | `core/audio/history.ts` | Audio effects change samples in place; undo stores a snapshot of **only the changed region** |
| P6 | **Strategy + Registry** | `core/effects/registry.ts` | Each effect, transition, filter and export preset is one self-describing object. Adding a feature = adding one file. |
| P7 | **Schema-driven UI** | `ui/components/EffectDialog.svelte` | Effect dialogs (Echo, Reverb, Normalise…) are **generated** from each effect's parameter schema. No hand-built dialog per effect. |
| P8 | **Compiler / Builder** | `core/render/compile.ts` | Project → *RenderPlan* → FFmpeg arguments. Pure function, snapshot-tested. |
| P9 | **Job queue (producer/consumer)** | `main/jobs/JobQueue.ts` | Proxies, thumbnails, waveforms and exports run in the background, limited to 1–2 at a time, cancellable (N12) |
| P10 | **Observer / event bus** | `JobEvents` port | Progress bars and "proxy ready" badges subscribe to job events |
| P11 | **Repository + schema migration** | `ProjectRepository` | `.mve` files carry a `schemaVersion`; old projects are upgraded step by step, never broken |
| P12 | **Factory** | `core/model/factory.ts` | Creates timeline items with correct defaults (title 5 s, image 5 s, transition 1 s) |

## 4. Folder structure

```
EasyMedia/
├─ README.md                  requirements
├─ docs/ARCHITECTURE.md       this file
├─ src/
│  ├─ core/                   ← NO imports from electron, node, svelte
│  │  ├─ model/               types.ts, factory.ts, timeline.ts (rules), time.ts, settings.ts, errors.ts
│  │  ├─ project/             serialize.ts (.mve JSON), migrate.ts (schema upgrades), paths.ts (relative paths, X1)
│  │  ├─ effects/             registry.ts + one file per effect
│  │  │  ├─ video/            fade.ts, panzoom.ts, colour.ts, blur.ts, speed.ts …
│  │  │  ├─ transitions/      dissolve.ts, wipe.ts …
│  │  │  └─ audio/            normalise.ts, compressor.ts, echo.ts, reverb.ts, eq.ts, noise.ts …
│  │  ├─ render/              compile.ts (project → RenderPlan → ffmpeg args), presets.ts
│  │  ├─ audio/               pcm.ts, dsp/*.ts, history.ts (memento)
│  │  ├─ teaching/            fileSize.ts, sampling.ts, explain.ts ("why" texts, T5)
│  │  └─ ports.ts             interfaces only
│  ├─ app/                    app.ts (use cases), history.ts, commands.ts, store.ts, preview.ts, proxy-path.ts
│  ├─ ui/                     Svelte: App.svelte, screens/, components/, dialogs/
│  ├─ adapters/
│  │  ├─ electron/            implements ports via window.mve
│  │  └─ mock/                fake media, fake jobs (browser + tests)
│  ├─ workers/                audio.worker.ts
│  ├─ main/                   Electron main: index.ts, ipc.ts, menu.ts, services.ts (dialogs, files), perf.ts
│  │  ├─ protocol/            media:// server: serve.ts, range.ts, allowlist.ts
│  │  ├─ ffmpeg/              paths.ts, progress.ts, errors.ts (plain-English), hardware.ts (encoder detection)
│  │  ├─ jobs/                queue.ts (concurrency, progress, cancel, temp-then-rename)
│  │  └─ media/               engine.ts (MediaEngine via FFmpeg), probe.ts, jobs.ts (FFmpeg arguments)
│  └─ preload/                index.ts (window.mve Facade), api.ts (typed channels)
├─ resources/
│  ├─ ffmpeg/{win-x64,mac-arm64,mac-x64}/
│  └─ fonts/                  bundled OFL fonts (X2)
└─ tests/                     unit (core), e2e (Playwright), coursebook acceptance
```

The rule *"core imports nothing outside core"* is enforced by an ESLint `no-restricted-imports` rule.

## 5. Domain model

```ts
type Seconds = number;           // always seconds, 0.01 precision in UI (N8)
type Id = string;

interface Project {
  schemaVersion: 1;
  name: string;
  settings: {
    aspect: '16:9' | '4:3' | 'custom';
    width: number; height: number;  // e.g. 1920×1080
    fps: 25 | 30;
    background: string;             // letterbox colour
  };
  media: MediaAsset[];              // imported files (the "media bin")
  timeline: {
    main: VisualItem[];             // V1 — magnetic, items play one after another
    text: TextItem[];               // T — overlays with absolute start times
    audio: [AudioItem[], AudioItem[]]; // A1 music, A2 voiceover
  };
}

interface MediaAsset {
  id: Id;
  kind: 'video' | 'image' | 'audio';
  path: string;                     // relative to project file (X1)
  proxyPath?: string;
  probe: ProbeInfo;                 // codec, container, w×h, fps, duration, sampleRate… (T1)
}

type VisualItem = VideoClip | ImageClip | TitleSlide;

interface ClipBase {
  id: Id;
  duration: Seconds;                // derived for video: (out - in) / speed
  effects: EffectInstance[];        // filters, fades, pan/zoom (V7, V8, V15)
  transitionIn?: EffectInstance;    // V9 — transition from the previous item
}
interface VideoClip extends ClipBase {
  type: 'video'; assetId: Id;
  in: Seconds; out: Seconds;        // V2 trim
  speed: number;                    // V14
  audio: { muted: boolean; volume: number; linked: boolean }; // V13
}
interface ImageClip extends ClipBase { type: 'image'; assetId: Id; }      // V12
interface TitleSlide extends ClipBase { type: 'title'; text: TextStyle & { content: string }; bg: string; }

interface TextItem {                // captions, subtitles, credits (V4–V6)
  id: Id;
  kind: 'caption' | 'subtitle' | 'credits';
  start: Seconds; duration: Seconds;
  content: string;
  style: TextStyle;
  fadeIn: Seconds; fadeOut: Seconds;
}

interface AudioItem {
  id: Id; assetId: Id;
  start: Seconds; in: Seconds; out: Seconds;
  volume: number; fadeIn: Seconds; fadeOut: Seconds;
}

interface EffectInstance { effectId: string; params: Record<string, number | string | boolean>; }
```

The audio editor (Audio mode) uses a separate, simpler model: a list of `AudioTrack { name, channels, sampleRate, pcm: Float32Array[] }`. Because effects change samples in place (Audacity model), it uses the Memento pattern (P5) instead of commands.

## 6. Effect registry (P6 + P7)

Every effect, filter and transition is **one object**. The registry drives the menus, the dialogs, the live preview, the final render and the help text.

```ts
interface EffectDef<P> {
  id: string;                         // 'audio.echo'
  label: string;                      // 'Echo…'
  appliesTo: 'video' | 'image' | 'text' | 'audio-region' | 'transition';
  syllabus: string;                   // '11.2 adding or adjusting delay/echo'
  why: string;                        // T5 help text
  params: ParamSchema<P>;             // generates the dialog
  preview?: (p: P) => PreviewHint;    // CSS filter / WebAudio node (video mode)
  render: (p: P, ctx: RenderCtx) => FilterSpec | DspFn;  // exact output
}

// Example: core/effects/audio/echo.ts
export const echo: EffectDef<{ delay: number; decay: number }> = {
  id: 'audio.echo',
  label: 'Echo…',
  appliesTo: 'audio-region',
  syllabus: '11.2 adding or adjusting delay/echo',
  why: 'An echo repeats the sound after a short delay, getting quieter each time. '
     + 'It makes a sound more distinctive or suggests a large space.',
  params: {
    delay: { label: 'Delay time', unit: 's', min: 0.01, max: 5, step: 0.01, default: 0.5 },
    decay: { label: 'Decay factor', min: 0, max: 1, step: 0.05, default: 0.5 },
  },
  render: ({ delay, decay }) => (pcm, rate) => feedbackDelay(pcm, rate, delay, decay),
};
```

Adding a new effect = one new file + one line in `registry.ts`. The dialog, menu entry, help text and undo support come automatically.

## 7. Key flows

### 7.1 Import media

```
UI drop file ─► usecase importMedia
   ├─► MediaEngine.probe(path)            ffprobe → ProbeInfo        (fast)
   ├─► store: add MediaAsset (badge "preparing…")
   └─► JobQueue: proxy (640×360), thumbnails, waveform peaks          (background)
           └─ JobEvents "done" ─► store: set proxyPath ─► badge disappears
```

### 7.2 Edit (video mode)

```
User types End point = 12.5
  ─► trimClip(clipId, { in, out: 12.5 })   (Command; validates against timeline rules)
  ─► history.execute(cmd)  →  store updated  →  timeline + preview re-render
Ctrl/⌘+Z ─► undo(history) → the previous (immutable) project is restored
```

### 7.3 Preview ("approximate preview, exact export")

- Plays **proxy** files in at most two `<video>` elements (current + next, for transitions).
- Effects use their `preview` hint: CSS `filter` (brightness, contrast, saturate, grayscale, sepia, blur), CSS `opacity` for fades and dissolves, CSS `transform` for pan/zoom.
- Text items are canvas-rendered PNGs layered on top (same images used in export, so fonts match).
- **"Render preview of selection"** runs the real compiler on a short range for a frame-exact check.

### 7.4 Export

```
ExportDialog (quality) ─► MediaEngine.renderVideo(project, output, { projectDir, quality })
   ─► compileProject(project, options)            core/render/compile.ts — pure
        1. refuse what cannot be exported yet     (EditError, shown to the student)
        2. one FFmpeg input per main-track item    (-ss/-t for video, -loop for stills, color= for titles)
        3. per item: speed → fit (letterbox/crop/stretch) → exact duration; sound or silence
        4. concat all items                        (no audio stream at all if nothing has sound)
        5. encoder options                         (libx264 crf, or bit rate for hardware encoders)
   ─► JobQueue.run(args) ─► progress events (parsed from ffmpeg -progress)
   ─► temp file renamed to the output on success
```

Example (M3): Book B Task 11c — Lake_Naivasha 0–6.3 s, sound removed, 1.5× speed:

```
ffmpeg -ss 0 -t 6.3 -i Lake_Naivasha.mp4
 -filter_complex "[0:v]setpts=(PTS-STARTPTS)/1.5,
                  scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,
                  pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#000000,setsar=1,fps=30,format=yuv420p,
                  trim=duration=4.2[v0];
                  [v0]concat=n=1:v=1:a=0[vout]"
 -map [vout] -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -an -movflags +faststart out.mp4
```

Sound of a clip with audio goes through `asetpts → atempo (chained in 0.5–2× steps) → volume → aformat 48 kHz stereo → apad → atrim`, so every segment's sound lasts exactly as long as its picture. Muted clips, stills and titles get `anullsrc` silence when other clips have sound.

The compiler is **snapshot-tested** (stored commands in `tests/unit/core/render/__snapshots__/`), and every feature is checked by **rendering real files**: length within one frame, sound length, fit-mode pixels, and — for the coursebook tasks — which moment of the source each frame came from.

### 7.5 Audio effect (audio mode)

```
Select 4.00–6.00 s ─► Effect ▸ Reverb… ─► dialog generated from schema
  ─► Preview: worker processes a copy, plays via Web Audio
  ─► OK: history.saveRegion(4–6 s)  (Memento)
        worker.apply(reverb, region) ─► new samples ─► waveform redraw
```

## 8. Ports and IPC contract

```ts
// core/ports.ts — implemented in M2 by src/main/media/engine.ts (FFmpeg) and src/adapters/mock/media-engine.ts
interface MediaEngine {
  probe(path: string): Promise<ProbeInfo>;                                   // T1: kind, container, codecs, size…
  makeProxy(input: string, output: string, duration: Seconds): JobHandle;   // 360 px preview copy
  makeThumbnails(input, output, { count, height, duration }): JobHandle;    // one strip image
  waveformPeaks(input: string, buckets: number): Promise<number[]>;         // 0–1 peaks
  extractFrame(input: string, time: Seconds, output: string): Promise<void>; // V10, format from extension
  onJobEvent(listener: (e: JobEvent) => void): () => void;                  // queued/started/progress/done/error/cancelled
}
interface JobHandle { id: string; done: Promise<void>; cancel(): void }      // done rejects JobCancelledError / MediaError

// Planned for later milestones:
//   decodeAudio / encodeAudio (M9, A16–A17), export jobs (M3/M8)
interface ProjectRepository { open(path): Promise<Project>; save(path, p): Promise<void>; pack(path, dest): Promise<void>; } // P1–P3
interface FileDialogs { openMedia(): Promise<string[]>; saveAs(kind, suggested): Promise<string | null>; }
interface Recorder { start(deviceId?): Promise<void>; stop(): Promise<Float32Array[]>; }  // A14 (uses getUserMedia)
```

The real and mock engines both pass one shared **contract test suite** (`tests/contract/media-engine.contract.ts`), so the mock used by UI tests cannot drift from real FFmpeg behaviour.

IPC as built in M4 (types: `src/preload/api.ts`; main side: `src/main/ipc.ts`; page side: `src/adapters/electron/`). Every request returns `{ ok, value }` or `{ ok: false, error: WireError }`; the page rebuilds the right error class (`core/wire.ts`), so students always see the plain-English message.

| IPC channel | Direction | Purpose |
|---|---|---|
| `media:probe` | invoke | ffprobe a file; the path is then allowed for `media://` |
| `media:proxy` / `media:thumbnails` | invoke | start a job under the page's job key |
| `media:render` | invoke | start an export job |
| `media:waveform` / `media:frame` | invoke | peaks / still frame |
| `job:cancel` | invoke | cancel a job by key |
| `job:event` | main → page | started, progress, done, failed (with WireError), cancelled |
| `app:paths` | invoke | proxy folder and recovery file |
| `dialog:openMedia` / `openProject` / `saveProject` / `exportVideo` / `confirm` / `chooseFolder` | invoke | native dialogs |
| `project:read` / `project:write` / `project:remove` | invoke | `.mve` files (write = temp file + rename) |
| `project:copy` | invoke | Package Project (P2): copies a media file — only files in the allow-list |
| `menu:action` | main → page | native menu items (new, open, save, saveAs, import, export, package, undo, redo) |

Local files reach the page only through the **`media://` protocol** (`src/main/protocol/`): range requests for seeking, and an **allow-list** of files the app probed or created — the page can never read arbitrary files.

Planned for later milestones: `media:decode-audio` / `media:encode-audio` (M9).

## 9. Error handling

- FFmpeg stderr is parsed by `main/ffmpeg/errors.ts` and mapped to plain-English messages (N11), e.g. *"This file uses a codec the app cannot read. Try converting it to MP4."*
- Exports write to a temporary file and are renamed only on success, so a failed export never leaves a broken file.
- Projects are saved atomically (write temp → rename) with autosave every 60 s (P3).

## 10. Cross-platform notes

| Concern | Windows | macOS |
|---|---|---|
| FFmpeg binary | `resources/ffmpeg/win-x64/ffmpeg.exe` | `mac-arm64` / `mac-x64`, chosen by `process.arch` |
| Hardware encoder | `h264_qsv` / `h264_amf` / `h264_nvenc` (probed at start-up) | `h264_videotoolbox` |
| Menus | In-window menu bar | Native top menu bar, app menu |
| Shortcuts | `Ctrl` | `⌘` (Electron `CmdOrCtrl`) |
| Microphone | Windows privacy setting | `NSMicrophoneUsageDescription` + `systemPreferences.askForMediaAccess` |
| Paths | Stored relative and with `/` in `.mve`; converted on load | same |

## 11. Testing strategy

The full TDD workflow, coverage targets and per-milestone test gates are in [`MILESTONES.md`](MILESTONES.md).

| Level | Tool | What |
|---|---|---|
| Unit | Vitest | Timeline rules, commands (do/undo), DSP functions, file-size maths |
| Snapshot | Vitest | `compile()` output for each coursebook task |
| Integration | Vitest + real FFmpeg | Export short clips; check result with ffprobe (duration, resolution, codec) |
| End-to-end | Playwright (Electron) | Import → edit → export flows on Windows and macOS in CI |
| Acceptance | Manual checklist | All coursebook activities (README §13) |
