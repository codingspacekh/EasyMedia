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
│   (audio DSP runs here too: fast enough, §7.5)  │
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
| P5 | **Memento** | `core/audio/history.ts`, `stored.ts` | Audio edits change samples; undo stores **only what was removed** (the changed region, a track's old settings, a removed track). Every operation returns its inverse while it is applied, so undo and redo are the same mechanism. Sample arrays are never changed once made. As Audacity, the samples of undo steps are kept **on disk** (`UndoStore` port, IndexedDB in the app) and loaded back for undo / redo, so memory does not grow with the history (N4) |
| P6 | **Strategy + Registry** | `core/effects/registry.ts` | Each effect, transition, filter and export preset is one self-describing object. Adding a feature = adding one file. |
| P7 | **Schema-driven UI** | `ui/EffectParams.svelte`, `ui/audio/EffectDialog.svelte` | Effect dialogs (Echo, Reverb, Normalise…) are **generated** from each effect's parameter schema. No hand-built dialog per effect. |
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
│  │  ├─ render/              compile.ts (project → RenderPlan → ffmpeg args), formats.ts (V16, V17),
│  │  │                       audio-formats.ts (A16, A17: formats, rates, size, pros and cons)
│  │  ├─ text/                layout.ts (wrap, place, contrast), draw.ts (one drawing for preview + export),
│  │  │                       motion.ts (fades, fly-ins, credits scroll), fonts.ts
│  │  ├─ image/               crop.ts (V11 resize with constrained proportions + 9-point crop)
│  │  ├─ audio/               pcm.ts (tracks), edit.ts (cut/paste/align/mix), history.ts (memento),
│  │  │                       peaks.ts (waveform columns), recording.ts (level advice, A14),
│  │  │                       dsp/ (volume, speed, channels, pitch, echo, reverb, filters, fft,
│  │  │                       noise, compressor)
│  │  ├─ teaching/            file-size.ts (T2), sampling.ts (T4), inspect.ts (T1), format-guide.ts (T7),
│  │  │                       task-check.ts (T6), glossary.ts; the "why" texts (T5) are effects/help.ts
│  │  └─ ports.ts             interfaces only
│  ├─ app/                    app.ts (use cases), history.ts, commands.ts, store.ts, preview.ts, proxy-path.ts,
│  │                          audio.ts (Audio mode), learn.ts (Learn mode)
│  ├─ ui/                     Svelte: App.svelte, panels and dialogs; audio/ (Audio mode, screens 13–20);
│  │                          learn/ (Learn mode, screens 21–22, task checker, glossary); Why.svelte (T5);
│  │                          menu-actions.ts (native menus act on the mode showing)
│  ├─ adapters/
│  │  ├─ electron/            implements ports via window.mve
│  │  ├─ canvas/              text-renderer.ts (TextRenderer on OffscreenCanvas, bundled fonts)
│  │  ├─ webaudio/            output.ts (AudioOutput: Audio mode playback), recorder.ts (Recorder:
│  │  │                       getUserMedia + MediaStreamTrackProcessor)
│  │  ├─ indexeddb/           undo-store.ts (UndoStore: Audio mode undo steps on disk)
│  │  └─ mock/                fake media, fake jobs, fake microphone (browser + tests)
│  ├─ main/                   Electron main: index.ts, ipc.ts, menu.ts, services.ts (dialogs, files), perf.ts,
│  │                          microphone.ts (X4), close-guard.ts (P7: ask before closing)
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
  schemaVersion: 2;               // 2: Audio mode tracks hold clips (migration 1 → 2)
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

The audio editor (Audio mode) uses a separate, simpler model (`core/audio/pcm.ts`): an `AudioDoc { rate, tracks }` where every `AudioTrack { id, name, channelCount, clips, gain, pan, bits? }` shares the project rate (the first imported file's rate; later files are decoded at it). A track holds **clips**, as the video timeline does: `AudioClip { id, offset, source: Float32Array[], in, out }` plays samples `[in, out)` of `source` from `offset`. Trimming an edge only moves `in` / `out` (it can be dragged back out), and the two halves of a split share one `source`, so Split, Move, Trim and Join keep no samples in their undo steps. Clips on a track never overlap; gaps are silence. Edits work either on clips (click, drag, Split / Join / Delete: the gap stays) or on a selection `{ start, end, tracks }` (Audacity model: Cut, Copy, Paste, effects, which work across clips and gaps). Both use the Memento pattern (P5) instead of commands. Mute and solo only change what is heard and are not edits. The session is saved with the project (§7.6).

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
- Text items are drawn on a canvas layered on top, with the **same drawing code** (`core/text/draw.ts`) and bundled fonts as the PNGs the export uses, so words land on the same pixels (checked to ≤ 2 px by an E2E test). Fades, fly-ins and the credits scroll follow `core/text/motion.ts`, the same rules the export writes as FFmpeg expressions.
- **"Render preview of selection"** runs the real compiler on a short range for a frame-exact check.

### 7.4 Export

```
app.exportVideo ─► TextRenderer draws each text as a PNG (project:saveImage → app's own folder)
ExportDialog (quality) ─► MediaEngine.renderVideo(project, output, { projectDir, quality, textImages })
   ─► compileProject(project, options)            core/render/compile.ts — pure
        1. refuse what cannot be exported yet     (EditError, shown to the student)
        2. one FFmpeg input per main-track item    (-ss/-t for video, -loop for stills, color= for titles)
        3. per item: speed → fit (letterbox/crop/stretch) → exact duration; sound or silence
        4. concat all items                        (no audio stream at all if nothing has sound)
        3b. looks (M7): zoompan (pan & zoom) → registry filters → fade / afade, per item
        4.  with transitions (M7): items are joined one by one — a cut is concat n=2 (timebase reset
            with settb for xfade), a transition is xfade + acrossfade at offset = length so far − overlap
        4b. text layers (M6): each caption / subtitle / credits PNG is laid over the joined video
            with overlay … enable='between(t,start,end)', alpha fades and fly-in / scroll expressions;
            a title slide's words are laid over its colour, picture or video background
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

### 7.5 Audio mode (M9)

```
Import audio ─► MediaEngine.probe ─► media:decodeAudio: FFmpeg writes f32 samples to a temp file
  ─► the page fetches it once through media:// (allow-listed), splits it into channels,
     then media:release deletes it (the samples never sit in the main process)
  ─► editAudio('Import …', tx ⇒ tx.addTrack(…))                         (one undo step)

Select 19.10–40.00 s ─► Effect ▸ Amplify… ─► dialog generated from the registry schema (P7),
  settings suggested from the selection (largest gain without clipping)
  ─► Preview: the effect on (at most 6 s of) a copy, played through Web Audio
  ─► Apply: editAudio('Amplify 19.10 – 40.00 s', tx ⇒ applyToSelection(…))
        Memento keeps only the 20.9 s that were replaced ─► waveform redrawn (visible part only)
        ─► shortly after, those samples move to disk (UndoStore); Undo loads them back first
UI blocks keep labels and ids, never tracks or steps: a block holding one keeps its samples alive.

Export ─► mix of what is heard (mute / solo, gain, pan, clipped) from 0 s at the chosen channels
  ─► MediaEngine.encodeAudio ─► the main process writes the samples to a temp file just before
     FFmpeg starts (job queue prepare / clean-up) ─► MP3 / M4A / AAC / WAV / FLAC with tags
```

The DSP runs in the page, with no Web Worker: every effect on a 3-minute stereo clip takes under
N3's 3 s on the MacBook (M10: noise reduction 1.75 s, pitch 1.5–1.7 s, reverb 1.2 s, EQ 0.6 s,
compressor 0.5 s; Delay with 50 echoes 2.1 s). A worker would copy the samples both ways; it
remains the way out if slower laptops need it (checked in M12).

### 7.6 Audio mode additions (M10)

```
Effects ─► the same registry (P6/P7): drop-downs and buttons for choices, EQ bands as vertical
  sliders, presets that fill the settings (link), a curve + before / after picture (Compressor)

Noise reduction (two steps, as Audacity) ─► select noise only ─► Get noise profile: the mean
  power per frequency, kept in Audio mode's state (not an edit) ─► select the sound ─► Apply:
  the profile reaches the effect through its EffectContext

Record ─► Recorder.open: macOS asks the system once (main, askForMediaAccess); getUserMedia with
  no echo cancelling / noise suppression / auto gain; frames from MediaStreamTrackProcessor
  ─► level meter (peak held) ─► count-in ─► blocks kept (other tracks play: overdub)
  ─► Stop: one undo step adds "Recording N" at the playhead (resampled to the project rate)

Save (P1) ─► each clip's samples ─► MediaEngine.encodeAudio: 32-bit float WAV "clip-<id>.wav" in
  "<project> audio/" (one file per set of samples: split halves share it; a file is written again
  only if it no longer holds those very samples, e.g. after Undo)
  ─► the .mve gets audioMode { rate, tracks: name, channels, gain, pan,
     clips: { file, offset, in, out } } (paths relative)
Open ─► MediaEngine.decodeAudio of each WAV: exactly the same samples
Close / Quit (P7) ─► main stops the close and sends app:closeRequested ─► the page asks
  Save / Don't Save / Cancel if anything is unsaved ─► app:closeAnswer
```

### 7.7 Learn mode (M11)

Learn mode never changes the project: `app/learn.ts` has its own small store, and every page of it
is pure maths or text from `core/teaching/` shown by `ui/learn/`.

```
Inspector (T1) ─► Choose a file… (dialog) or drop it (window.mve.pathForFile) ─► MediaEngine.probe
  ─► inspect(): rows with an explanation each; codecs marked lossy / lossless / uncompressed
Calculator (T2), sampling visualiser (T4), format guide (T7), glossary ─► pure core functions, no I/O
Compression comparison (T3) ─► the inspected file's first 10 s of sound (decodeAudio → encodeAudio:
  WAV, FLAC, MP3 192 / 128 / 64) or 5 s of video (renderVideo of a one-clip project: AVI FFV1,
  MP4 high, 640 and 426 wide) into the app's "learn" folder (files replaced each time)
  ─► probe each file for its real size (this also allows it for media://) ─► play side by side;
  the lossless AVI cannot be played by Chromium, so one exact frame of it (PNG) is shown
Task checker (T6) ─► the teacher's TaskSpec saved as JSON (.mvetask, open / save dialogs)
  ─► a student opens it and checks an export: probe ─► checkFile(): pass / fail per row
```

"Why use this?" (T5): effect texts live in each registry entry; every other tool is in
`core/effects/help.ts` (`TOOLS`: label, syllabus point, why), shown in a section's "Why use this?"
box (`ui/Why.svelte`) or, for toolbar buttons and menu items, in the tooltip (`withWhy`). Tooltips
come from `ui/Tooltip.svelte`, one for the whole app: after 0.4 s on a button (or on keyboard
focus) it shows the button's title, or an icon-only button's label, with the "Why?" part under
it; the built-in tooltip is kept away meanwhile.

## 8. Ports and IPC contract

```ts
// core/ports.ts — implemented in M2 by src/main/media/engine.ts (FFmpeg) and src/adapters/mock/media-engine.ts
interface MediaEngine {
  probe(path: string): Promise<ProbeInfo>;                                   // T1: kind, container, codecs, size…
  makeProxy(input: string, output: string, duration: Seconds): JobHandle;   // 360 px preview copy
  makeThumbnails(input, output, { count, height, duration }): JobHandle;    // one strip image
  waveformPeaks(input: string, buckets: number): Promise<number[]>;         // 0–1 peaks
  extractFrame(input: string, time: Seconds, output: string): Promise<void>; // V10, format from extension
  resizeCropImage(input: string, plan: ResizeCrop): Promise<string>;         // V11, numbered copy beside it
  renderFrame(project, time, output, options): Promise<string>;               // V10 snapshot: the exact exported frame; returns the path written (never overwrites)
  renderVideo(project, output, { projectDir, quality?, textImages? }): JobHandle; // V16
  onJobEvent(listener: (e: JobEvent) => void): () => void;                  // queued/started/progress/done/error/cancelled
}
interface JobHandle { id: string; done: Promise<void>; cancel(): void }      // done rejects JobCancelledError / MediaError
interface TextRenderer { draw(text, style, frame, mode: 'frame' | 'block'): Promise<{ png, width, height }> } // §7.3

decodeAudio(path, sampleRate?): Promise<DecodedAudio>;                    // A1: { sampleRate, channels: Float32Array[], bits? }
decodeAudioToFile(path, sampleRate?): Promise<DecodedAudioFile>;        // the same, left in a temp f32 file (used over IPC)
releaseDecoded(raw): Promise<void>;
encodeAudio({ sampleRate, channels }, output, AudioExportSettings): JobHandle; // A16, A17
interface AudioOutput { play(audio, { loop, onEnded }); stop(); elapsed(): number }  // app/audio.ts; Web Audio adapter
interface UndoStore { save(channels): Promise<key>; load(key): Promise<Float32Array[]>; keepOnly(keys): Promise<void> } // IndexedDB
interface ProjectRepository { open(path): Promise<Project>; save(path, p): Promise<void>; pack(path, dest): Promise<void>; } // P1–P3
interface FileDialogs { openMedia(): Promise<string[]>; saveAs(kind, suggested): Promise<string | null>; exportAudio(name, format): Promise<string | null>; }
interface Recorder { microphones(): Promise<Microphone[]>; open(id | null, onBlock): Promise<MicrophoneInput> } // A14, X4; throws MicrophoneError
interface Dialogs { …; unsavedChanges(): Promise<'save' | 'discard' | 'cancel'>;                 // P7
                    openTaskCheck(): Promise<string | null>; saveTaskCheck(name): Promise<string | null> } // T6
interface AppPaths { proxies; recovery; snapshots; learn }                                     // learn: T3 comparison files
```

The real and mock engines both pass one shared **contract test suite** (`tests/contract/media-engine.contract.ts`), so the mock used by UI tests cannot drift from real FFmpeg behaviour. The recorder has one too (`tests/contract/recorder.contract.ts`): the MediaStream adapter (with a fake microphone stream) and the mock.

IPC as built in M4 (types: `src/preload/api.ts`; main side: `src/main/ipc.ts`; page side: `src/adapters/electron/`). Every request returns `{ ok, value }` or `{ ok: false, error: WireError }`; the page rebuilds the right error class (`core/wire.ts`), so students always see the plain-English message.

| IPC channel | Direction | Purpose |
|---|---|---|
| `media:probe` | invoke | ffprobe a file; the path is then allowed for `media://` |
| `media:proxy` / `media:thumbnails` | invoke | start a job under the page's job key |
| `media:render` | invoke | start an export job |
| `media:waveform` / `media:frame` | invoke | peaks / still frame |
| `media:snapshot` | invoke | V10: one frame of the project through the compiler, saved as PNG/JPG/BMP/TIFF without a dialog (a `Snapshots` folder next to the project, or the app's own folder before the first save); never overwrites; returns the path, which is then allowed for `media://` |
| `media:decodeAudio` / `media:release` | invoke | A1: decode to a temp f32 file the page may read once through `media://`; then delete it |
| `media:encodeAudio` | invoke | A16, A17: start an audio export job (samples written to a temp file just before FFmpeg starts) |
| `media:resizeCrop` | invoke | V11: numbers only (resize + crop box); main checks them, builds the filter and writes a numbered copy beside an allowed picture |
| `job:cancel` | invoke | cancel a job by key |
| `job:event` | main → page | started, progress, done, failed (with WireError), cancelled |
| `app:paths` | invoke | proxy, snapshot and Learn mode folders, recovery file |
| `dialog:openMedia` / `openProject` / `saveProject` / `exportVideo` / `exportAudio` / `confirm` / `chooseFolder` / `unsavedChanges` / `openTaskCheck` / `saveTaskCheck` | invoke | native dialogs (`unsavedChanges`: Save / Don't Save / Cancel, P7; task checks `.mvetask`, T6) |
| `media:microphoneAccess` | invoke | X4: on macOS asks the system for the microphone (once); true elsewhere |
| `app:closeRequested` | main → page | P7: the window is closing or the app quitting |
| `app:closeAnswer` | invoke | P7: the page's answer (close or not) |
| `project:read` / `project:write` / `project:remove` | invoke | `.mve` files (write = temp file + rename) |
| `project:copy` | invoke | Package Project (P2): copies a media file — only files in the allow-list |
| `project:saveImage` | invoke | a text PNG by plain name into the app's own `text` folder (never the student's folders) |
| `menu:action` | main → page | native menu items (new, open, save, saveAs, import, export, exportAudio, package, undo, redo, selectAll); undo, redo, import and Select All act on the mode that is showing (`ui/menu-actions.ts`) |

Besides `invoke` and `on`, `window.mve` has one plain function, `pathForFile(file)` (Electron's `webUtils.getPathForFile`): where a file dropped on the page is, for Learn mode's inspector.

Local files reach the page only through the **`media://` protocol** (`src/main/protocol/`): range requests for seeking, and an **allow-list** of files the app probed or created — the page can never read arbitrary files.

The `media://` scheme is CORS-enabled so the page can `fetch()` decoded sound; the allow-list stays the gate.

## 9. Error handling

- FFmpeg stderr is parsed by `main/ffmpeg/errors.ts` and mapped to plain-English messages (N11), e.g. *"This file uses a codec the app cannot read. Try converting it to MP4."*
- Exports write to a temporary file and are renamed only on success, so a failed export never leaves a broken file.
- A hardware video encoder cannot make every picture size (VideoToolbox refuses 426 × 240): an export made with one carries the software encoder's arguments as `fallbackArgs`, and the job queue tries them once, as the same job, if FFmpeg fails.
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
