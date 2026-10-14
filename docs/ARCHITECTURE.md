# Mini Video Editor — System Design

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
| P4 | **Command** | `app/commands/*` | Every video edit (trim, move, add title…) is an object with `do()` and `undo()` → unlimited undo/redo |
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
minivideoeditor/
├─ README.md                  requirements
├─ docs/ARCHITECTURE.md       this file
├─ src/
│  ├─ core/                   ← NO imports from electron, node, svelte
│  │  ├─ model/               types.ts, factory.ts, timeline.ts (rules), time.ts
│  │  ├─ effects/             registry.ts + one file per effect
│  │  │  ├─ video/            fade.ts, panzoom.ts, colour.ts, blur.ts, speed.ts …
│  │  │  ├─ transitions/      dissolve.ts, wipe.ts …
│  │  │  └─ audio/            normalise.ts, compressor.ts, echo.ts, reverb.ts, eq.ts, noise.ts …
│  │  ├─ render/              compile.ts (project → RenderPlan → ffmpeg args), presets.ts
│  │  ├─ audio/               pcm.ts, dsp/*.ts, history.ts (memento)
│  │  ├─ teaching/            fileSize.ts, sampling.ts, explain.ts ("why" texts, T5)
│  │  └─ ports.ts             interfaces only
│  ├─ app/                    store.ts, commands/*, usecases/*
│  ├─ ui/                     Svelte: App.svelte, screens/, components/, dialogs/
│  ├─ adapters/
│  │  ├─ electron/            implements ports via window.mve
│  │  └─ mock/                fake media, fake jobs (browser + tests)
│  ├─ workers/                audio.worker.ts
│  ├─ main/                   Electron main: index.ts, ipc/*, jobs/*, ffmpeg/*, protocol.ts
│  └─ preload/                preload.ts (Facade)
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
  ─► new TrimCommand(clipId, in, 12.5)   (validates against timeline rules)
  ─► history.execute(cmd)  →  store updated  →  timeline + preview re-render
Ctrl/⌘+Z ─► history.undo() → cmd.undo()
```

### 7.3 Preview ("approximate preview, exact export")

- Plays **proxy** files in at most two `<video>` elements (current + next, for transitions).
- Effects use their `preview` hint: CSS `filter` (brightness, contrast, saturate, grayscale, sepia, blur), CSS `opacity` for fades and dissolves, CSS `transform` for pan/zoom.
- Text items are canvas-rendered PNGs layered on top (same images used in export, so fonts match).
- **"Render preview of selection"** runs the real compiler on a short range for a frame-exact check.

### 7.4 Export

```
ExportDialog (container, preset, quality) ─► compile(project, options)
   compile = pure function:
     1. resolve timeline   → absolute start/end of every item
     2. build RenderPlan   → inputs[], filtergraph nodes, output options
     3. emit ffmpeg args   → string[]
   ─► JobQueue.run(args) ─► progress events (parsed from ffmpeg -progress)
   ─► done: show file, size, and "Inspect" button (T1)
```

Example: a 3 s title + a trimmed clip at 1.5× with a 1 s dissolve compiles to roughly:

```
ffmpeg -loop 1 -t 3 -i title.png  -ss 8 -to 12.5 -i Lake_Naivasha.mp4
 -filter_complex "
   [0:v]scale=1920:1080,format=yuv420p,setsar=1[v0];
   [1:v]scale=1920:1080:force_original_aspect_ratio=decrease,
        pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS/1.5,setsar=1[v1];
   [v0][v1]xfade=transition=dissolve:duration=1:offset=2[vout]"
 -map "[vout]" -an -c:v libx264 -crf 20 -preset veryfast out.mp4
```

The compiler is **snapshot-tested**: each coursebook task has a stored expected command.

### 7.5 Audio effect (audio mode)

```
Select 4.00–6.00 s ─► Effect ▸ Reverb… ─► dialog generated from schema
  ─► Preview: worker processes a copy, plays via Web Audio
  ─► OK: history.saveRegion(4–6 s)  (Memento)
        worker.apply(reverb, region) ─► new samples ─► waveform redraw
```

## 8. Ports and IPC contract

```ts
// core/ports.ts
interface MediaEngine {
  probe(path: string): Promise<ProbeInfo>;
  extractFrame(path: string, t: Seconds, out: string, format: 'png'|'jpg'|'bmp'|'tiff'): Promise<void>; // V10
  decodeAudio(path: string): Promise<{ sampleRate: number; channels: Float32Array[] }>;
  encodeAudio(pcm: Float32Array[], opts: AudioExportOptions): Promise<string>;                          // A16, A17
  runJob(job: JobSpec): JobHandle;           // proxy, thumbnails, waveform, export
}
interface ProjectRepository { open(path): Promise<Project>; save(path, p): Promise<void>; pack(path, dest): Promise<void>; } // P1–P3
interface FileDialogs { openMedia(): Promise<string[]>; saveAs(kind, suggested): Promise<string | null>; }
interface Recorder { start(deviceId?): Promise<void>; stop(): Promise<Float32Array[]>; }  // A14 (uses getUserMedia)
interface JobEvents { on(jobId, cb: (e: JobProgress | JobDone | JobError) => void): () => void; }
```

| IPC channel | Direction | Purpose |
|---|---|---|
| `media:probe` | invoke | ffprobe a file |
| `media:frame` | invoke | extract still |
| `media:decode-audio` / `media:encode-audio` | invoke | PCM in/out (transferred as `ArrayBuffer`) |
| `job:start` / `job:cancel` | invoke | queue / cancel FFmpeg jobs |
| `job:event` | main → renderer | progress, done, error |
| `project:open` / `project:save` / `project:pack` | invoke | file I/O |
| `dialog:open` / `dialog:save` | invoke | native dialogs |

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
