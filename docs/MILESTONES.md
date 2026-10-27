# EasyMedia — Milestones & TDD Workflow

How the app is built, **in what order**, and **how each part is proven to work** before the next one starts.

- Requirements (V1, A3, T2…): [`../README.md`](../README.md)
- System design (layers, patterns, flows): [`ARCHITECTURE.md`](ARCHITECTURE.md)
- UI prototype: [`../design/screens/index.html`](../design/screens/index.html)

---

## Contents

1. [Principles](#1-principles)
2. [The TDD workflow](#2-the-tdd-workflow)
3. [Testing strategy per layer](#3-testing-strategy-per-layer)
4. [Definition of Done and milestone gates](#4-definition-of-done-and-milestone-gates)
5. [Milestone overview](#5-milestone-overview)
6. [Milestones in detail](#6-milestones-in-detail)
7. [Coursebook task → milestone map](#7-coursebook-task--milestone-map)
8. [Progress tracker](#8-progress-tracker)

---

## 1. Principles

1. **Build from the inside out.** Pure logic first (no Electron, no FFmpeg), then the FFmpeg engine, then the UI. Each layer rests on one that is already tested.
2. **A thin end-to-end slice early.** By Milestone 4 the app can import → edit → preview → export one clip. Later milestones only *add* features to a working app; they never wait for "integration at the end".
3. **One gate per milestone.** A milestone is finished only when its **exit gate** passes (§4). The next milestone does not start before that.
4. **Coursebook tasks are the acceptance tests.** Every milestone ends with specific coursebook tasks that must work (§7).
5. **Small, always green.** Work in slices of a few hours. `main` is always releasable: all tests pass on Windows and macOS.
6. **Biggest risks first.** Performance on weak laptops (M0) and the FFmpeg compiler (M3) are tackled before the bulk of the UI.

## 2. The TDD workflow

### 2.1 The cycle

```
        ┌──────────────┐
        │ 1. RED       │  Write ONE small test for the next behaviour. Run it. It must fail
        │              │  (and fail for the right reason).
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │ 2. GREEN     │  Write the simplest code that makes it pass. Run ALL tests.
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │ 3. REFACTOR  │  Clean up names, duplication, structure. Tests stay green.
        └──────┬───────┘  Commit.
               └──────────► next test
```

### 2.2 Double-loop TDD (feature level)

Each feature uses two loops:

```
OUTER LOOP — acceptance test (slow, few)
  "Book B Task 11c: trim 0–6.3 s, mute, 1.5× speed → 4.2 s MP4, 1920×1080, no audio"
  ── written FIRST, fails until the whole feature works ──
        │
        ▼
  INNER LOOP — unit tests (fast, many), red → green → refactor
    • timeline rule: duration = (out − in) / speed
    • TrimCommand do/undo
    • SpeedCommand rejects speed ≤ 0
    • compiler emits setpts=PTS/1.5 and -an
        │
        ▼
  outer test passes → feature done
```

### 2.3 Rules

| # | Rule |
|---|---|
| R1 | **No production code without a failing test first**, for `core/`, `app/`, `adapters/`, `main/` and `workers/`. |
| R2 | UI *behaviour* is test-driven (typing 12.5 into End point updates the clip). UI *looks* (spacing, colours) are checked against the prototype, not unit-tested. |
| R3 | Write a short **test list** before starting a feature: the behaviours, edge cases and requirement IDs. Tick them off one by one. |
| R4 | **Every bug starts with a failing regression test** that reproduces it. |
| R5 | Test names carry the requirement ID: `describe('V2 trim')`, `it('A3 removes DC offset so the mean is ~0')`. |
| R6 | Keep the unit suite **under 10 seconds**. Tests that run FFmpeg are tagged `integration` and run separately. |
| R7 | Commit on green. Small commits, message starts with the ID: `V14: speed recalculates clip length`. |
| R8 | Spikes (throw-away experiments) are allowed **only** in `spikes/`, are never merged into `src/`, and are rewritten test-first. |

### 2.4 Worked example (V2 trim)

```ts
// 1. RED — tests/core/model/trim.test.ts
describe('V2 trim', () => {
  it('sets in/out points and recalculates duration', () => {
    const clip = makeVideoClip({ sourceLength: 20 });
    const trimmed = trim(clip, { in: 8, out: 12.5 });
    expect(trimmed.duration).toBeCloseTo(4.5, 2);
  });
  it('rejects an end point before the start point', () => {
    expect(() => trim(makeVideoClip({ sourceLength: 20 }), { in: 5, out: 3 }))
      .toThrow(/end point must be after start point/i);
  });
});
// 2. GREEN — simplest trim() in src/core/model/timeline.ts
// 3. REFACTOR — extract clampToSource(), commit "V2: trim with validation"
```

## 3. Testing strategy per layer

| Layer | What is tested | Tools | How |
|---|---|---|---|
| `core/model`, `core/teaching` | Timeline rules, durations, file-size maths | Vitest | Pure unit tests. Target **≥ 90 %** line + branch coverage. |
| `app/commands`, `app/usecases` | Every command `do()` / `undo()`; use-cases against the **mock adapter** | Vitest | Property: *do then undo = original project*. ≥ 85 % coverage. |
| `core/render` (compiler) | Project → FFmpeg arguments | Vitest | **Snapshot tests** per scenario, plus focused assertions (`contains setpts=PTS/1.5`). |
| `core/audio` DSP | Effects on sample arrays | Vitest | **Synthetic signals with known answers** (see 3.1). |
| `adapters/electron`, `main/` | Real ffprobe/ffmpeg, job queue, file I/O | Vitest `integration` | Generated fixture media; check results with ffprobe. |
| `ui/` components | Behaviour: inputs, dialogs, keyboard | Vitest + Testing Library (Svelte) | Render with the mock store; simulate typing/clicking. |
| Whole app | Key user flows | Playwright (Electron) | ~1 flow per milestone, on Windows **and** macOS in CI. |
| Coursebook tasks | Real outcomes | Vitest `acceptance` | Scenario built through use-cases → real export → ffprobe checks (see 3.2). |

### 3.1 Testing audio DSP with known answers

| Effect | Test signal | Assertion |
|---|---|---|
| Fade in / out | constant 1.0 | first sample 0, last of fade ≈ 1, monotonic |
| Normalise | sine peak 0.25 | new peak = −1 dB (0.891) ± 0.001 |
| Remove DC offset | sine + 0.2 offset | mean ≈ 0 (|mean| < 1e-4) |
| Amplify −6 dB | sine peak 1.0 | peak ≈ 0.501 |
| Stereo → mono | L = 1, R = 0 | output = 0.5 |
| Change speed ×2 | 2 s sine 440 Hz | length 1 s, frequency 880 Hz |
| Change pitch +12 | 2 s sine 440 Hz | length 2 s, frequency 880 Hz (±2 %) |
| Echo 0.5 s / 0.8 | single impulse | impulses at 0.5 s (0.8), 1.0 s (0.64)… |
| High-pass 1 kHz | 100 Hz + 5 kHz sines | 100 Hz attenuated ≥ 15 dB, 5 kHz within 1 dB |
| Noise reduction | sine + white noise, noise-only profile | signal-to-noise ratio improves ≥ 10 dB |
| Compressor 3:1 @ −20 dB | step from −30 dB to −5 dB | output above threshold ≈ −15 dB (after attack time) |
| Reverb | impulse | output energy decays; length > input |

### 3.2 Fixture media (no copyrighted files in the repo)

`scripts/make-fixtures` generates small test files with FFmpeg's built-in generators, matching the coursebook specs:

| Fixture | Made with | Used for |
|---|---|---|
| `clip_1080p30_10s.mp4` | `testsrc2` + 440 Hz `sine` | trim, speed, mute, export |
| `clip_4x3_640x480.mov`, `.avi`, `.wmv` | `testsrc2` | import of every format, letterbox |
| `photo_3764x3092.jpg` | `testsrc2` single frame | resize & crop (V11, Book B Task 11a) |
| `music_stereo_45s.mp3` | two sines | audio tracks, mix, fades |
| `tone_dc_offset.wav` | `aevalsrc` with + 0.2 offset | normalise / DC offset |
| `voice_noisy.wav` | sine bursts + `anoisesrc` | noise reduction, compressor |

Coursebook media stays on the teacher's machine and is used only for the manual checks in each gate.

## 4. Definition of Done and milestone gates

### 4.1 Definition of Done (every feature)

- [ ] Test list written; every item has a test that went red → green.
- [ ] Requirement ID in test names and the commit message.
- [ ] Unit + integration tests pass locally.
- [ ] CI green on **Windows and macOS**.
- [ ] Coverage thresholds for the touched layer still met.
- [ ] Matches the prototype screen (if it has UI).
- [ ] "Why?" help text and syllabus tag present (if it is an editing tool) (T5).
- [ ] No `TODO` without a linked issue.

### 4.2 Milestone exit gate (all must pass)

1. ✅ All Definition-of-Done items for every feature in the milestone.
2. ✅ The milestone's **automated acceptance tests** (coursebook scenarios) pass in CI.
3. ✅ The milestone's **manual checks** done on one Windows laptop and one Mac, with the real coursebook files, results noted in `docs/acceptance/M<n>.md`.
4. ✅ No open bugs marked *blocker*.
5. ✅ Performance budget still met (from M4 onwards): app start ≤ 5 s, RAM ≤ 600 MB for the sample project (N4, N5).
6. ✅ Tagged release `v0.<n>.0` with a short changelog.

If a gate fails, fix forward inside the same milestone. Do **not** start the next one.

### 4.3 Branches and merging

| Branch | Purpose |
|---|---|
| `dev` | Day-to-day work. Every push runs CI on Windows x64, macOS Apple Silicon and macOS Intel. |
| `main` | Only code that has passed CI on **all three** platforms. Changes arrive **only** through a pull request from `dev`. |

Rules:

1. Never push directly to `main`.
2. Open a pull request `dev → main`. Merge only when all three CI jobs on its latest commit are green.
3. If any job fails, fix it on `dev` (regression test first, R4); the pull request picks up the new run.
4. While the repository is private on the free plan, GitHub cannot enforce rule 2, so it is followed by process. When the repository becomes public, turn on branch protection for `main` with the three CI jobs as required checks.
5. Phase 2 (2026-10-27): the animation work is on the **`animation`** branch while `dev` waits to be released as v1.0.0, so a release never carries half a mode. CI is run on it by hand (`gh workflow run ci.yml --ref animation`); it merged into `dev` once `v1.0.0` was tagged (2026-10-27, released as `v1.1.0`), and from then on the work continues on `dev`.

## 5. Milestone overview

```
M0 Foundations & spike ─► M1 Core model ─► M2 Media engine ─► M3 Render compiler
                                                                   │
            ┌──────────────────────────────────────────────────────┘
            ▼
M4 Walking skeleton (first usable app) ─► M5 Video editing core ─► M6 Text
                                                                    │
            ┌───────────────────────────────────────────────────────┘
            ▼
M7 Effects & transitions ─► M8 Audio-in-video & export ─► M9 Audio editor core
                                                                    │
            ┌───────────────────────────────────────────────────────┘
            ▼
M10 Audio effects ─► M11 Teaching layer ─► M12 Hardening & v1.0 release
                                                                    │
            ┌──── phase 2: Animation (syllabus 20.1) ───────────────┘
            ▼
M13 Animation core ─► M14 Timeline & tweens ─► M15 Paths, morphing & masks
                                                                    │
            ┌───────────────────────────────────────────────────────┘
            ▼
M16 Pictures, web export & teaching ─► M17 Hardening & v2.0 release
```

| # | Milestone | Main requirements | Size | Rough part-time weeks* |
|---|---|---|---|---|
| M0 | Foundations & performance spike | tooling, CI, fixtures, N1–N5 check | S | 2 |
| M1 | Core model & commands | data model, timeline rules, undo/redo | M | 2–3 |
| M2 | Media engine adapter | probe, jobs, proxies, errors | M | 2–3 |
| M3 | Render compiler v1 | V1, V2, V3, V12, V13 (mute), V14, V16 (MP4) | L | 3–4 |
| M4 | Walking skeleton | shell, import → preview → export, P1–P3 | L | 3–4 |
| M5 | Video editing core | V1–V3, V12–V14, inspector, project files | M | 3 |
| M6 | Text & stills | V4–V6, V11 | L | 3–4 |
| M7 | Effects & transitions | V7–V10, V15, effect registry | L | 4 |
| M8 | Audio-in-video & full export | V13, V16, V17, T7 (video) | M | 2–3 |
| M9 | Audio editor core | A1–A8, A15–A18 | L | 4 |
| M10 | Audio effects & recording | A9–A14, A19 | L | 4–5 |
| M11 | Teaching layer | T1–T7 | M | 3 |
| M12 | Hardening & v1.0 | all acceptance, N1–N14, X1–X7, packaging | M | 3 |
| M13 | Animation core: stage, objects, layers | AN1–AN4, AN6, AN7, AN16 | L | 4 |
| M14 | Timeline & tweens | AN8, AN9, AN13, AN15 (MP4, GIF, PNG) | L | 4 |
| M15 | Paths, morphing & masks | AN10, AN11, AN12 | M | 3 |
| M16 | Pictures, web export, stop motion & teaching | AN5, AN14, AN15 (HTML), AN17, AN18 | L | 4 |
| M17 | Hardening & v2.0 | phase 2 acceptance, N1–N5, X1, X6, packaging | M | 2–3 |

\* *Very rough, for one maintainer working ~8–10 h/week. Re-estimate after M2 using your real pace.*

## 6. Milestones in detail

Each milestone lists: **goal · build order (TDD slices) · tests written first · exit gate.**

---

### M0 — Foundations & performance spike

**Goal:** an empty but fully tested project skeleton on both platforms, and proof that the approach is fast enough.

**Build order**
1. Repo, TypeScript, Vite, Svelte, Vitest, ESLint (with the rule *core imports nothing outside core*), Prettier.
2. CI (GitHub Actions): matrix `windows-latest`, `macos-latest`; jobs `lint`, `typecheck`, `unit`, `integration`.
3. `scripts/fetch-ffmpeg` (downloads pinned FFmpeg builds per platform) and `scripts/make-fixtures`.
4. **Spike** (in `spikes/`, throw-away): Electron window → import a 1080p clip → make 640×360 proxy → play it → export MP4. Measure RAM, preview smoothness and export time on the weakest student laptop and on a Mac.

**Tests first**
- A "hello" unit test and an integration test that runs `ffmpeg -version` from the bundled path — on both OSes in CI.
- ESLint boundary rule test: a file in `core/` importing `electron` fails lint.

**Exit gate**
- CI green on Windows + macOS.
- Spike numbers recorded in `docs/acceptance/M0.md`: go / no-go decision for Electron. If no-go, stop and revisit the architecture.

---

### M1 — Core model & commands (pure TypeScript)

**Goal:** the project data model and all editing rules, with unlimited undo/redo, without any UI or FFmpeg.

**Build order (TDD slices)**
1. `time.ts`: parse/format seconds (`12.5` ↔ `00:12.50`), rounding to 0.01 s (N8).
2. `types.ts` + `factory.ts`: create project, clips, title slides, text items with defaults (P12).
3. `timeline.ts` rules: item start times on the magnetic main track, total duration, trim, split, join, speed → duration, overlap rules for text/audio.
4. Command pattern: `History.execute/undo/redo`; commands `AddClip`, `RemoveClip`, `Trim`, `Split`, `Join`, `SetSpeed`, `Move`, `SetProjectSettings`.
5. Project schema v1 + JSON (de)serialisation + migration framework (P11).

**Tests first**
- `duration = (out − in) / speed` (6.3 s at 1.5× → 4.2 s).
- Split at 3.0 s gives two clips whose durations add up to the original.
- Property test: for any command, `do` then `undo` returns a deep-equal project.
- Round-trip: `deserialize(serialize(p))` equals `p`; relative paths stay relative (X1).

**Exit gate**
- `core/` ≥ 90 % coverage. Unit suite < 10 s.
- Automated scenario: build Book B Task 11d's *timeline* through commands and assert every item's start time and the total length (40.70 s).

---

### M2 — Media engine adapter

**Goal:** a tested bridge to FFmpeg: inspect files, run background jobs with progress, make proxies, thumbnails and waveform peaks.

**Build order**
1. `MediaEngine.probe()` → `ProbeInfo` (container, codecs, resolution, fps, duration, sample rate, channels, bit depth).
2. `JobQueue`: max concurrency, progress parsing (`-progress pipe:1`), cancellation, temp-file then rename.
3. Jobs: proxy (640×360), thumbnails, waveform peaks, `extractFrame`.
4. Error mapper: FFmpeg stderr → plain-English messages (N11).
5. Hardware encoder detection with fallback to `libx264` (VideoToolbox / QSV / AMF / NVENC).
6. `MockAdapter` implementing the same ports, used by app/UI tests.

**Tests first**
- Probe every fixture format (MP4, MOV, AVI, WMV, JPG, PNG, MP3, WAV) and assert the fields.
- Cancelling a running job stops FFmpeg and leaves no output file.
- Progress events are monotonic and end at 100 %.
- A corrupt file produces the friendly error, not a crash.
- **Contract tests**: one shared test suite runs against both the real adapter and the mock, so the mock cannot drift.

**Exit gate**
- Integration suite green on both OSes.
- Proxy of a 1080p 60 s clip finishes within the M0 spike time budget.

---

### M3 — Render compiler v1

**Goal:** turn a project into a correct FFmpeg command for the basic video features — tested **without the UI** through a small CLI (`mve-render project.json out.mp4`).

**Build order (one feature per slice)**
1. Single clip, project resolution, letterbox / crop-to-fill (V1).
2. Trim (V2).
3. Concat of several clips (V3).
4. Image clip with duration (V12).
5. Speed incl. `atempo` chaining (V14).
6. Mute / remove audio (V13).
7. MP4 H.264/AAC output with quality setting (V16, first container).

**Tests first**
- Snapshot of the generated arguments for each slice.
- Integration: render → ffprobe → assert duration (± 1 frame), resolution, presence/absence of audio stream.

**Exit gate — automated acceptance**
- Book B **Task 11b** (trim 8–12.5 s, no sound → 4.5 s, 1920×1080, no audio stream).
- Book B **Task 11c** (trim 0–6.3 s, mute, 1.5× → 4.2 s).
- Book A **Activity 11.04 / 11.08** (trim to 5 s; speed 200 %).

---

### M4 — Walking skeleton (first usable app)

**Goal:** a real Electron app on Windows and macOS: import → see on the timeline → preview → export. Ugly is fine; working is required.

**Build order**
1. Electron main + preload facade (`window.mve`) + typed IPC (P2); security flags.
2. App store + history wired to the UI (P3, P4).
3. Screens (from the prototype, minimal styling): media bin, preview player on proxies, timeline (main track only), Export button with progress.
4. Save / open / autosave `.mve` (P1, P3).
5. Native menus, `CmdOrCtrl` shortcuts (X3).

**Tests first**
- Component tests: media bin shows "preparing" until the proxy job finishes.
- Playwright E2E (both OSes): launch → import fixture → export → file exists and probes as MP4.

**Exit gate**
- E2E green on Windows + macOS.
- **Performance check on a real Windows laptop** (carried over from M0, where it was waived): start ≤ 5 s, preview smooth, RAM ≤ 600 MB.
- ~~Manual: export Book B Task 11b through the UI.~~ Moved to M5: 11b needs the trim and remove-sound controls, which M5 adds.
- Manual: import → add → preview → export a coursebook clip through the UI.

---

### M5 — Video editing core

**Goal:** everyday editing through the inspector and timeline, matching screens 01, 10–11.

**Build order**
1. Project settings dialog (V1) — screen 11.
2. Inspector **Clip** tab: Start/End point fields, set-to-playhead, speed buttons (V2, V14) — screen 01.
3. Timeline: drag to reorder, Split, Join, Delete, trim handles, snapping, zoom.
4. Clip sound: mute / remove sound (V13 removal). *Unlink audio moved to M8: it needs the audio tracks M8 adds.*
5. Image clips and duration (V12).
6. Package project (P2), missing-media relink (P6).

**Tests first**
- Typing `12.50` in End point dispatches `TrimCommand` and updates the duration label.
- Invalid input (`abc`, end < start) shows an inline error and changes nothing.
- Undo after every inspector change restores the previous value.

**Exit gate — acceptance**
- Automated: Book A **11.01, 11.03, 11.04, 11.08, 11.13**; Book B **11b, 11c**.
- Manual on both OSes with the real coursebook clips, including **Book B Task 11b exported through the UI** (moved here from M4).
- **Performance check on a real Windows laptop** (carried over from M0 and M4): start ≤ 5 s, preview smooth, RAM ≤ 600 MB — run `Measure performance.bat` from the `app-bundle.yml` build.

---

### M6 — Text & stills

**Goal:** title slides, captions, subtitles and scrolling credits, rendered identically in preview and export; resizing/cropping stills — screens 02–04, 10.

**Build order**
1. Bundled fonts (X2) + canvas text renderer → transparent PNG (shared by preview and export).
2. Title slide with colour/image/video background (V4) — screen 03.
3. Captions & subtitles with position, start, duration, text fades (V4) — screen 02.
4. Readability: shadow, outline, background box, **contrast ratio check** (V6).
5. Scrolling credits with blank lines and source lines (V5) — screen 04.
6. Resize & crop still image dialog (V11) — screen 10.

**Tests first**
- Contrast function: white on black = 21 : 1; warning below 4.5 : 1.
- Credits scroll position at t = 0 starts below the frame and ends above it at t = duration.
- Text PNG for the same item is byte-identical on two renders (deterministic).
- Crop maths: 3764×3092 → width 1920 keeps ratio (1577 high) → crop to 1080 with bottom-right anchor removes 497 px from the top.

**Exit gate — acceptance**
- Automated: Book A **11.02, 11.05, 11.10, 11.14**; Book B **Task 11a**, Activity **11a**.
- Manual: compare preview frame vs exported frame for text position (≤ 2 px difference).

---

### M7 — Effects & transitions

**Goal:** the effect registry with schema-generated dialogs, then fades, transitions, filters, pan & zoom and snapshot — screens 05–07, 09.

**Build order**
1. **Effect registry + schema-driven dialog** (P6, P7) — built first, used by every later effect (video *and* audio).
2. Fades in/out, to black/white (V7) — screen 06.
3. Transitions via `xfade` with durations (V9) — screen 05.
4. Filters & colour correction, whole clip or split part (V15) — screen 06.
5. Pan & zoom presets + custom Start/End frames (V8) — screen 07.
6. Snapshot / extract still: frame stepping, hide text, PNG/JPG/BMP/TIFF (V10) — screen 09.

**Tests first**
- Registry: every effect has `id`, `label`, `syllabus`, `why`, `params` with defaults (also enforces T5).
- Dialog generator: a schema with 2 numeric params renders 2 fields with units and limits.
- Transition timing: total length = sum of clips − transition overlap.
- Snapshot at 16.66 s with text hidden returns the clip frame (pixel check against a frame extracted directly).

**Exit gate — acceptance**
- Automated: Book A **11.06, 11.07, 11.09, 11.11, 11.12**; Book B **11d, 11g, 11h, 11i**.

---

### M8 — Audio in video & full export

**Goal:** music and voiceover tracks in Video mode, and every export container and preset — screens 08, 12.

**Build order**
1. Audio tracks: add at playhead, start offset, trim, volume, fades, lower under voiceover (V13) — screen 08. Also **unlink a clip's sound onto an audio track** (moved here from M5).
2. All containers: MP4, MOV, AVI, WMV, MPG; lossy and genuinely lossless (V16).
3. Destination presets + **estimated file size** (V17).
4. Format pros/cons in the export dialog (T7, video).

**Tests first**
- Each container exports and probes with the expected codecs (e.g. AVI lossless → FFV1).
- File-size estimate within ± 25 % of the real size for the fixture project.
- Music starting at 5.00 s: first 5 s of output audio are silent (RMS check).

**Exit gate — acceptance**
- Automated: Book A **11.15, 11.30**; Book B **11e, 11f**; Activities **11b–11d**.

---

### M9 — Audio editor core

**Goal:** Audio mode with Audacity-style editing on in-memory PCM in a Web Worker — screens 13–14, 20.

**Build order**
1. Decode to PCM, waveform drawing, zoom, playback (Web Audio) (A1).
2. Selection tool + numeric Selection Start/End (A5); Memento undo (P5, A18).
3. Cut, copy, paste, delete, trim to selection, insert silence (A5).
4. Tracks menu: add, import as new track, move, align end-to-end / to cursor, mix and render (A2, A6) — screen 14.
5. Fade in/out, amplify, normalise + DC offset (A3, A4, A7).
6. Change speed (A8), stereo → mono (A15).
7. Export audio: MP3, M4A, AAC, WAV, FLAC; sample rate, bit depth, bit rate, tags, size estimate, pros/cons (A16, A17, T7) — screen 20.

**Tests first**
- All DSP rows in §3.1 for these effects.
- Undo after an effect restores the exact original samples.
- Mix and render of two aligned clips = sample-wise sum (clipped).
- WAV export at 48 kHz / 24-bit probes with those values.

**Exit gate — acceptance**
- Automated: Book A **11.16–11.19, 11.25–11.27, 11.29**; Book B **Task 11j**, Activity **11e**.

---

### M10 — Audio effects & recording

**Goal:** the remaining audio effects and voiceover recording — screens 15–19.

**Build order** (each effect = registry entry + DSP + tests)
1. Change pitch, key-to-key (A9) — WSOLA time-stretch + resampling (SoundTouch's method, in TypeScript).
2. Echo; Delay with 3 types (A10).
3. Reverb (A11).
4. Graphic EQ + presets, high-pass, low-pass (A12).
5. Noise reduction, two-step (A13).
6. Compressor (A19) — screen 18.
7. Recording / overdub: microphone choice, level meter, count-in, permission handling on both OSes (A14, X4) — screen 15.
8. Save the Audio mode session (as Audacity's *Save Project*): P1, P3, P7 for Audio mode — save and open, autosave and recovery, and a warning before quitting or closing with audio edits not saved (added after the M9 gate, at the teacher's choice).

**Tests first**
- All remaining rows in §3.1.
- Recorder adapter contract test with a fake microphone stream; macOS permission-denied path shows the friendly message.
- An Audio mode session saved and opened again gives the exact same samples, tracks and settings; quitting with unsaved audio edits asks first.

**Exit gate — acceptance**
- Automated: Book A **11.20–11.24**; Book B **Tasks 11k–11p**, Activities **11f–11i**.
- Manual: record a real voiceover on a Windows laptop and on a Mac.

---

### M11 — Teaching layer

**Goal:** Learn mode and the remaining teaching features — screens 21–22.

**Build order** (the maths and texts in `core/teaching/`, pure and unit-tested; Learn mode never changes the project)
1. Audio file-size calculator with worked steps and "What if…" rows (T2) — screen 21. MB = 1 000 000 bytes, as the books and the export dialogs.
2. Sampling visualiser (T4) — screen 21: an analogue wave, a sample-count and a resolution slider, the stored (stepped) result, the sample table and how far it is from the original. The first wave is Book A's Figure 11.23, so 10 samples read 6, 8.5, 2.5, 8, 3.5, 2, 4.5, 3, 8.5, 3.5 (Activity 11.28).
3. Media inspector with explanations (T1) — screen 21: choose or drop any file; container, codecs (lossy / lossless / uncompressed), resolution and aspect ratio, frame rate, video and audio bit rate, sample rate, bit depth, channels, duration, size; "File vs container". The probe gains the video stream's own bit rate and the display aspect ratio.
4. Format guide (T7) — screen 22: every export format's compression, advantages, disadvantages and best use, from the same data as the export dialogs; video compression and quality (pixels per frame SD / HD / 4K, frame rate and length; Book B 11.1.19), with pictures at lower resolutions shown at the same size.
5. Compression comparison, audio and video (T3) — screens 21–22: the first 10 s of the inspected file exported at several settings into the app's own folder (audio: WAV, FLAC, MP3 192 / 128 / 64 kbps; video: lossless, MP4 high, MP4 640 × 360, MP4 426 × 240), each with its real size and % saving, ready to play side by side. Reuses the export code (`encodeAudio`, `renderVideo`).
6. Task checker for teachers (T6) — a third Learn tab (not in the design screens): the teacher sets the expected format, resolution, duration ± tolerance, channels and sample rate, and saves it as a small file to give to students; a student opens it and their export and sees pass / fail for each row.
7. "Why use this?" on every editing tool (T5 completed): the tools that are not registry effects (trim, split, speed, clip sound, titles, captions, credits, resize & crop, cut / copy / paste / delete, silence, align, mix, mono, recording…) get one registry of syllabus point + why, shown from the "?" of their section, as the design screens show.
8. Glossary (screens 21–22 *Glossary* button): the coursebooks' key words, written so that Book A's exam-style questions 1–6 can be answered from it.

**Tests first**
- Calculator: 44 100 Hz × 16-bit × mono × 120 s = 84 672 000 bits = 10.58 MB (Book A Question 5a); 32-bit doubles it (5b).
- Sampling: quantising to 3 bits gives exactly 8 levels; Figure 11.23 sampled 10 times gives the book's table; 20 samples are closer to the original than 10 (Activity 11.28).
- Media inspector: every row has an explanation; H.264 / AAC / MP3 are lossy, FLAC / PNG / FFV1 lossless, PCM uncompressed; 1920 × 1080 is 16:9.
- Compression comparison: sizes and % saving from real files (integration test with FFmpeg); lossless is the biggest.
- Task checker passes a correct export and fails one with the wrong resolution / duration / channel count.
- Every editing tool links to a "why" text (registry test from M7 extended to non-effect tools).

**Exit gate — acceptance**
- Book A **11.28** reproduced in the visualiser; Book A exam-style questions 1–6 answerable from Learn mode content.

---

### M12 — Hardening & v1.0

**Goal:** release quality on both platforms.

**Decisions (2026-10-19):** no paid code signing for v1.0 on either platform — the install guide shows the free way past macOS Gatekeeper (*right-click → Open*, or *Privacy & Security → Open Anyway*) and Windows SmartScreen (*More info → Run anyway*). Signing can be added later without changing the app.

**Build order** (installers first, so the teacher's checks run on what students will install)
1. **Installers and release build** — electron-builder (MIT): Windows x64 NSIS installer + portable zip; a macOS DMG for **Apple-chip** Macs and one for **Intel** Macs, each with its own FFmpeg (189 / 207 MB; one universal DMG was 358 MB, as it carries both of each — decided 2026-10-19). The packaged app carries FFmpeg, the fonts and the licences; on macOS `NSMicrophoneUsageDescription` and, with the hardened runtime, the `audio-input` entitlement (M10 note; not needed while the app is not notarised: no hardened runtime). An app icon (none yet). A `release.yml` workflow builds all three on a `v*` tag and attaches them to a **draft** GitHub Release; every CI run also builds them and starts each packaged app once (smoke test).
2. **`THIRD_PARTY_LICENSES`** made by a script at build time: FFmpeg (GPL-3.0, with where to get its source), Electron and Chromium, every bundled font (SIL OFL), and every npm package that ends up in the app. Shipped in the installers and shown from *Help ▸ Licences*.
3. **First-launch guide (X7)**: `docs/INSTALL.md` (download, install, the Gatekeeper and SmartScreen steps, microphone permission, where projects are saved) and an in-app **Welcome** shown on first launch (the three modes, where to start, *Help ▸ Welcome* to see it again).
4. **Bali practice paper** (Book B practice questions 1–7) as an automated acceptance test through the app's use cases with stand-in files of the same kind (`EQ11-*` are not in the repo), then end-to-end through the UI with a time budget. Book inconsistencies decided as in earlier tasks and noted: the storyboard's `Bali1.mp3` / `EQ11-Bali2.mp3` are the `.mp4` clips; "Bali2 placed for 7 seconds" at 11.74 s would overlap the clip at 17.74 s with no transition allowed, so it is 6 s (the times win); the sound's times are read after the first 2 s are removed.
5. **Cross-platform (X1, X2, X6)**: a CI job makes a project and an export on Windows, and the macOS jobs open that project and export it again: same format, size, length and codecs, and the pictures alike (PSNR ≥ 40 dB); the same in the other direction.
6. **Student user guide and teacher notes** (`docs/guide/`): how to do each coursebook kind of task in EasyMedia; teacher notes mapping every screen and tool to the syllabus points 11.1 / 11.2. Shipped with the app and opened from *Help ▸ User guide* (offline).
7. **Performance pass on the weakest laptop (N1–N5)** with the teacher: the installed app on an 8 GB Windows laptop measures preview frame rate, export time, effect time, RAM of an exam-sized project and start-up (`EASYMEDIA_PERF_REPORT`); fix what misses its budget (moving the audio DSP to a Web Worker is the planned way out for N3 / N12).
8. **Full acceptance run** by the teacher on a Windows 11 laptop and a Mac with the installed app: every task in README §14, the Bali paper timed; results in `docs/acceptance/M12.md`.

**Tests first**
- Packaging: the build config names FFmpeg for each platform, the fonts, `THIRD_PARTY_LICENSES` and the microphone description; the packaged app finds its FFmpeg and fonts (smoke test in CI on Windows x64, macOS Apple Silicon and Intel).
- Licences: the file names FFmpeg's licence and source, Electron, every bundled font and every bundled npm package; a font or package without a licence fails the build.
- Welcome: shown on the first launch only; *Help ▸ Welcome* shows it again.
- Bali: Bali_sound.mp3 is stereo 44.1 kHz, 37.3 s (faded out from 35.3 s and cut there), silent from 17.7 to 25.4 s, peaks just below 0 dBFS after 6 s, less hiss; Bali1.mp4 and Bali3.mp4 are 1920 × 1080 16:9 with no sound, Bali3 lasting 4× the original; the stills are the first and last frames and are named Bali1 and Bali2 (the snapshot dialog gains a File name box for this); Bali_video.mp4 matches the storyboard times (the picture at 3 s, 9 s, 15 s, 21 s, 30 s comes from the right source; "Bali" top-right; captions 11.74–17.74 s; credits scrolling 25.38–37.38 s on the left) in the Blu-ray preset.
- Cross-platform: a project saved on one OS opens on the other with every file found, and exports with the same settings and length.

**Exit gate**
- All acceptance tasks pass on both OSes; results in `docs/acceptance/M12.md`.
- No open blocker or major bugs.
- Tag `v1.0.0`, publish GitHub Release.

---

## Phase 2 — Animation (syllabus 20.1)

Decided 2026-10-27 (README §16, decisions 10–13): the Animation mode is built in the same way as the first phase — core first, pure and tested; then the app layer; then the UI — in five milestones. The three documents (`animation_syllabus.pdf`, `animation_book.pdf` = coursebook Chapter 19 with Adobe Animate, `animation_workbook.pdf` = workbook Chapter 7 with Tumult Hype) give the acceptance tests: the workbook's worked example and Tasks 1–9, the coursebook's Practical Activities 19.01–19.07 and exam-style questions 1–3.

What stays the same: the architecture rule (`core/animation/` imports nothing outside `core/`), immutable documents with the Command / History undo (P4), one drawing function for the preview and every export (as the text drawing, ARCHITECTURE §7.3), FFmpeg for every video or GIF file, the job queue with progress and Cancel (N12), the "Why use this?" registry (T5) and the task checker (T6).

What is new: a second document type, the **animation** (`.mvea`): a stage, layers of vector objects, and keyframes. It is never mixed into the video project.

```
Video / Audio / Learn (v1.0) ─► M13 Animation core ─► M14 Timeline & tweens
                                                                │
            ┌───────────────────────────────────────────────────┘
            ▼
M15 Paths, morphing & masks ─► M16 Pictures, web export & teaching ─► M17 Hardening & v2.0
```

The workbook's numbers are the test data, so every slice is checked against a real task: a 600 × 400 stage with a grey background; a 135 × 135 star at (128, 102); a circle of radius 102 at (0, 0); a rectangle whose fill goes from `#FF1CC8` to `#F0DB82` and opacity from 100 % to 57 % over three seconds; text that grows from 0 to 64 px; a star that turns once in three seconds; a 19 px road at y = 500 on a 1240 × 800 stage.

---

### M13 — Animation core (stage, objects, layers)

**Goal:** the Animation mode exists: a stage set up exactly as a task says (size, colour, frame rate, rulers, grid, guides, snapping), vector shapes and text drawn and given exact numbers, layers, undo, and the animation saved in its own file and exported as a picture. Nothing moves yet.

**Layout** (no design screen yet; drawn after the Video mode screens): the mode buttons gain **Animation**; a toolbar of tools (Select, Rectangle, Ellipse, Star, Polygon, Line, Pen, Brush, Text, Picture) with the stage chip (600 × 400 · 24 fps · #808080), Save, Undo, Redo, Export; the **stage** in the middle with rulers along the top and left, zoomed to fit or 100 %; the **Layers** panel on the left; the **Properties** panel on the right; the status bar with the pointer's coordinates and what the last move snapped to. The timeline (M14) will sit under the stage.

**Build order** (core first, every file pure TypeScript)
1. **Document model** (`core/animation/types.ts`, `factory.ts`, `stage.ts`): the stage (width, height, background, fps, length in frames), layers (name, visible, locked, colour) holding objects in drawing order, guides and grid settings, pictures (relative paths, X1). Objects: rectangle (corner radius), ellipse, star (points, inner radius), polygon (sides), line, path (Bézier points, open / closed), text (words, font, size, bold, italic, alignment), picture, group (children). Every object has a name, X and Y (its top-left corner), W and H, rotation about its centre, opacity, fill (none / solid / linear / radial) and stroke (colour, width, dash). Defaults: 1280 × 720, white, 24 fps, 5 s (120 frames); a new shape has a mid-grey fill and a dark 2 px stroke. Validation: size 16–4096 px, fps 1–60, length 1–36 000 frames, opacity 0–100 %. Aspect-ratio presets (4:3, 16:9, 16:10, 2.35:1) and `aspectOf(width, height)` for the chip.
2. **Geometry** (`geometry.ts`): the outline of every shape as points (a star's 10 points, a polygon's n points, an ellipse's arc, a path's flattened curves, a line's two ends); bounds with rotation; the centre; hit-testing a point (the fill, or the stroke of an open path or line); resize from any of 8 handles keeping the opposite edge still, with proportions locked when asked; rotate from the rotation handle (rounded to whole degrees with Shift); nudge by 1 or 10 px.
3. **Layers** (`layers.ts`): add (above the selected one), rename, reorder, lock, hide, remove (with its objects, undoable), folders; add an object to the selected layer; bring forward / send back / to front / to back within a layer; move objects to another layer; group / ungroup; duplicate (offset 10 px); find an object and its layer by id; the drawing order (bottom layer first, bottom object first). A locked layer's objects cannot be selected, moved or edited; a hidden layer is not drawn or exported.
4. **Snapping** (`snap.ts`): a move or resize snaps X, Y, W or H to the grid, guides, other objects' edges and centres, and whole pixels, within a threshold in stage pixels (so it feels the same at every zoom), each source on or off; the result says what it snapped to (shown in the status bar). Snapping is off while Alt is held.
5. **Drawing** (`draw.ts`): draws the document at frame 0 (M14: any frame) onto any 2D canvas through a small `StageCanvas` interface (a recording fake in tests): background, then each visible layer, each object with its rotation, opacity, fill (gradients made with the canvas's gradient calls), stroke and dash, text with the bundled fonts, pictures, groups recursively. The preview and the PNG export (M13), the video and GIF exports (M14) and the HTML player (M16) all use this one function.
6. **Files** (`serialize.ts`, `migrate.ts`): `.mvea` JSON with `schemaVersion: 1`, picture paths relative to the file (`core/project/paths.ts`), a shape check that refuses other files ("This file is not an EasyMedia animation, or it is damaged."), the newer-version message, and the migration table for later versions.
7. **Animation app** (`app/animation.ts`, `app/animation-commands.ts`): its own store (history of the document, file path, saved document, selection, tool, zoom, rulers / grid / guides / snap on or off, message) on the generic History; use cases: new, open, save, save as, the P7 close guard together with the video project ("Video, Audio and Animation work that is not saved will be lost"), add a shape / text, set properties (one command per change, labelled for the History), delete, cut / copy / paste / duplicate, nudge, group / ungroup, layer actions, zoom, export the stage as PNG (the canvas's PNG through `ProjectFiles`), autosave (P3) alongside the video project's.
8. **UI** (`ui/animation/`): `AnimationMode.svelte` (keys: Delete, arrows, Ctrl/Cmd + D duplicate, G group, Space-drag to pan, 1 / 0 zoom), `AnimationToolbar.svelte`, `Stage.svelte` (the canvas, rulers, grid, guides, selection outline and handles, drag to draw a shape with the tool, drag to move, Shift for proportions / 45° steps), `LayersPanel.svelte`, `PropertiesPanel.svelte` (number boxes that apply on Enter or blur, as the time boxes: X, Y, W, H, lock, rotation, opacity, fill and stroke pickers with hex boxes, text boxes for text objects, name), `StageSettings.svelte` (the chip's dialog: presets, size, colour, fps, length), `AnimationStatusBar.svelte`; the native menus act on the mode that is showing (New, Open, Save, Save As, Undo, Redo, Select All, Cut / Copy / Paste); *File ▸ Export Animation…*. The dialogs port gains `openAnimation`, `saveAnimation`, `exportAnimation`.

**Tests first**
- Factory and stage: a new animation is 1280 × 720, white, 24 fps, 120 frames with one layer "Layer 1"; `aspectOf(600, 400)` is "3:2", of 1024 × 768 "4:3", of 1280 × 800 "16:10"; the 2.35:1 preset at 800 px high is 1880 × 800; a 15 px stage, 0 fps and 0 frames are refused with plain messages.
- Geometry, with the workbook's numbers: a star 135 × 135 at (128, 102) has its centre at (195.5, 169.5), 10 outline points, the top point at (195.5, 102); a circle of radius 102 at (0, 0) is 204 × 204 and contains (102, 102) but not (0, 0); a 100 × 100 square turned 45° has bounds 141.42 wide around the same centre; resizing from the bottom-right handle keeps the top-left corner; a line from (0, 500) to (1240, 500) with a 19 px stroke is hit at (600, 505) and not at (600, 520).
- Layers: the top layer draws last; an object added goes to the selected layer at the front; a locked layer refuses a move; bring forward swaps with the next object only; grouping two objects makes one object whose bounds enclose both and whose children keep their positions; ungrouping restores them; duplicating offsets by 10 px and keeps everything else.
- Snapping: 103 snaps to 100 on a 10 px grid within 4 px and reports "grid"; a guide at 250 wins over the grid at 248; an object's right edge at 263 snaps the moved object's left edge to 263 ("edge of Star"); 103.4 snaps to 103 with only pixels on; nothing snaps with snapping off; the threshold is in stage pixels.
- Drawing: the recording canvas receives the background, then each object in order with `save` / `translate` / `rotate` around its centre / `globalAlpha` / the fill and stroke calls; a hidden layer draws nothing; a gradient fill asks for a gradient with both colours; text sets the font string from the bundled font, size and style.
- Files: a document round-trips through text unchanged; a picture at `C:\Users\x\Task5.jpg` is stored as `Task5.jpg` beside the file and restored; a `.mve` project, random JSON and a cut-off file are refused with the animation message; `schemaVersion: 99` gives the newer-version message.
- App: every use case is undoable and undo restores the exact document; the window title shows the animation's name and the unsaved dot; closing with unsaved animation work asks; new / open / save work with the mock dialogs; export PNG writes the stage's picture.
- UI (jsdom): the fourth mode button; the tools; dragging a rectangle on the stage adds a rectangle to the selected layer with the dragged size; typing X = 128, Y = 102, W = 135, H = 135 in the Properties panel moves and sizes it; the layers panel lists the layers and the selected object's layer; Delete removes the selection; the stage chip opens the stage settings and 600 × 400 with #808080 is applied; the status bar shows the pointer's coordinates.

**Exit gate — acceptance**
- Workbook **Task 1's set-up** through the UI: 600 × 400 stage, the star and the circle with their exact numbers, saved as `Chapter07_Task1_1.mvea`, closed, reopened, exported as PNG; the picture checked with FFmpeg (size 600 × 400).
- Workbook **Task 3's stage**: 1024 × 768, `#CBCDF0`, rulers and grid shown; **Task 9's face** from ellipses and rounded rectangles aligned with the grid.
- Coursebook **19.01**: a stick person with each part in its own layer in a folder; the underwater scene; a name with each letter on its own layer — each saved and reopened.
- On both OSes; tag `v1.1.0`.

---

### M14 — Timeline & tweens

**Goal:** things move: keyframes, tweens with easing, a frame-based timeline, play / loop, groups whose parts keep their own motion, repeat, and export as MP4, animated GIF and PNG sequence — the first complete workbook tasks.

**Build order**
1. **Time** (`core/animation/time.ts`): frames ↔ seconds at the stage's fps (frame 72 at 24 fps = 3.00 s; "3 s" typed = frame 72); the length in frames; changing the fps keeps keyframes at the same times (rounded to frames) or at the same frames, as chosen; the time shown as `0:03.00 · frame 72`.
2. **Keyframes and tweens** (`tween.ts`): per property (x, y, width, height, rotation, opacity, fill colour, stroke colour, stroke width, corner radius, font size, text), a sorted list of keyframes {frame, value, easing, hold}; `valueAt(track, frame)` interpolates numbers, colours (in RGB, hex in and out) and angles; easings linear, ease in, ease out, ease in-out, bounce; hold keeps the previous value until the next keyframe; before the first keyframe the first value, after the last the last; *Repeat* on a property (the tween between two keyframes plays again and again until the end, or n times); property keyframes can be moved, copied (Alt-drag) and deleted; *Reverse* copies the keyframes mirrored after the last one (Task 1.2).
3. **The document at a frame** (`state.ts`): `stateAt(doc, frame)` returns every object with its tweened values; a group's children are placed by the group's position, rotation and scale and keep their own tweens (AN13); `draw.ts` draws `stateAt`. The whole chain stays pure, so one test asks for frame 36 and reads off the numbers.
4. **Animation app**: the playhead (frame), play / pause / stop / step forward and back, loop (whole or a frame range), setting a property at a frame makes a keyframe (the first keyframe at frame 0 is made with it), *Insert keyframe* at the playhead for a property or for everything, moving and deleting keyframes, the length of the animation, the fps change.
5. **Timeline UI** (`ui/animation/Timeline.svelte`): under the stage: one row per layer and, when opened, one per object and per animated property; frames across the top numbered every 5, the seconds under them; keyframe dots, tween bars between them (a dash for a hold), the repeat mark; the playhead, dragged or typed (frame or seconds); transport buttons and the loop range; zoom of the frames.
6. **Export** (`core/animation/export.ts`, a new `AnimationExporter` port, implemented in `main/media/animation.ts`): the app draws every frame onto an offscreen canvas and streams raw RGBA frames to the main process, which pipes them into FFmpeg (`-f rawvideo`): MP4 (H.264, `yuv420p`, even sizes padded), animated GIF (two passes: `palettegen` then `paletteuse`), PNG sequence (`%04d.png`); progress per frame and Cancel (N12); the export dialog with each format's pros and cons and the estimated size (T7); a preset for the stage's size.
7. **Send to Video mode**: export an MP4 beside the animation file and import it into the video project as a clip.

**Tests first**
- Time: 3 s at 24 fps is frame 72; frame 36 is 1.50 s; a 30 fps change keeps a keyframe at 3 s on frame 90 (by time) or on frame 72 = 2.40 s (by frame).
- Tweens with Task 1's numbers: a circle at (0, 0) with a keyframe at frame 72 at (396, 196) is at (198, 98) at frame 36 with linear easing; the fill `#FF1CC8` → `#F0DB82` is `#F87CA5` halfway; opacity 100 → 57 % is 78.5 % halfway; a font size 0 → 64 px; a star's rotation 0 → 360° in 72 frames repeated is 90° at frame 18 and 90° again at frame 90; ease-in starts slower than linear (frame 18 < 25 % of the way) and ends at the same place; bounce ends exactly at the end value; a hold keeps the value until the keyframe; *Reverse* puts the start values at frame 144.
- Groups: a wheel at (40, 60) inside a car group at (100, 500) draws at (140, 560); the car turning 90° turns the wheel's position with it; the wheel's own rotation adds to the car's.
- Export (integration, real FFmpeg): a 600 × 400, 3 s, 24 fps animation makes an MP4 that probes as 600 × 400, 24 fps, 3.00 s, H.264; a GIF with 72 frames; a PNG sequence of 72 files; an odd size (601 × 401) is padded to even and reported; Cancel stops the job and leaves no file.
- UI: the timeline shows frame numbers every 5 and the seconds; dragging the playhead to frame 36 shows the circle halfway; changing X at frame 72 adds a keyframe dot; Space plays and the playhead advances; Loop keeps it playing past the end.

**Exit gate — acceptance** (each as an automated test through the commands, then through the UI on both OSes)
- Workbook **Task 1.1** (circle, growing rectangle with colour and opacity, growing text, turning star over 3 s), **Task 1.2** without the morph (reverse, the star keeps turning), **Task 2** (letters entering one by one along straight moves, "playcentre" growing, the smile), **Task 3** (slides moving in from the left, fading, "Au revoir"), coursebook **19.02** and **19.03**, exam-style **question 3** (Films by Ying: letters bounce in, stay 2 s, fade, loop, exported as GIF), each exported as MP4 and checked by the task checker.
- Tag `v1.2.0`.

---

### M15 — Paths, morphing & masks

**Goal:** the remaining tweening tools of 20.1: an object follows a drawn path (and turns with it), a shape becomes another shape, and a layer masks the layers under it.

**Build order**
1. **Path geometry** (`core/animation/path.ts`): a path of Bézier segments flattened to points within a tolerance; its length; the point and tangent angle at a distance or a fraction; the fraction at even speed (arc-length table).
2. **Motion paths** (AN11): a property track `path` {pathId or the path's points, from frame, to frame, orient, easing, even speed}; `stateAt` places the object's centre on the path; the path itself can be any path or shape outline in the document (drawn with the pen, or chosen), shown only while editing.
3. **Morphing** (AN10, `morph.ts`): shape keyframes hold a whole outline; between two outlines the points are resampled to the same count by arc length and matched from the nearest start point, then interpolated; a closed shape to an open line and back; the fill and stroke tween at the same time.
4. **Masks** (AN12): a layer marked as a mask clips the layers under it (until the next mask or folder end) to its shapes' union; drawn with `clip`; animated like any object.
5. **UI**: the pen and path editing (anchor points, handles, add / remove a point); *Follow path…* on a tween; *Orient to path*; *Morph into…* at a keyframe (draw or pick the new shape); *Mask* on a layer (padlock as in the coursebook: the masked layers are shown through it when locked).

**Tests first**
- Paths: a straight path from (0, 0) to (300, 0) is 300 long and its half-way point is (150, 0) with angle 0; a quarter circle of radius 100 is 157.08 long and its end angle is 90°; a path of two unequal segments at even speed is at the join at the right fraction, not at 50 %.
- Motion: Task 5's car on an undulating path over 5 s at 24 fps is on the path at every frame and its rotation follows the tangent when oriented; the small cars go left to right and right to left; the wheels turn 360° per second, anticlockwise on the way back.
- Morph: a circle into a square has four-fold symmetry halfway (the outline's bounds stay square); a line into a circle into a rectangle into a line (worked example 19.02) is the line again at the end; the colour changes with it.
- Masks: a circle mask over a text layer draws `clip` with the circle before the text; moving the mask moves the clip; an unmasked layer above is not clipped.

**Exit gate — acceptance**
- Workbook **Task 1.2** complete (the circle morphs), **Task 5** (the car, the road appearing, the small cars on paths, loop), **Task 6** (scrolling introduction, computers growing in along paths and leaving along others, THE END); coursebook **19.04–19.06**, exam-style **question 1** (Saif's Comics: letters fading one at a time, 2.35:1, looping, GIF) and **question 2** (Henry's Homes: the logo pulsing, the ball revealing text, the mask).
- Tag `v1.3.0`.

---

### M16 — Pictures, web export, stop motion & teaching

**Goal:** everything else in 20.1: pictures and tracing, the HTML web animation with buttons, stop motion and frame-by-frame, and the theory in Learn mode; then the user guide and teacher notes for animation.

**Build order**
1. **Pictures** (AN5): import PNG, JPG, GIF, BMP (through the media engine's probe for the size) and SVG (drawn by the canvas from the file); a picture is an object like any other (moved, sized, turned, faded, tweened, masked); *Package* copies them (P2).
2. **Trace bitmap** (`core/animation/trace.ts`): the picture's pixels (read by the canvas) are quantised to n colours, each colour's regions are traced to outlines (marching squares), simplified (Ramer–Douglas–Peucker) and smoothed into paths — one path object per region, grouped; the dialog shows colours, detail and smoothing with a preview and the note about lost detail. A published tracer with a compatible licence may replace this file if the quality is not enough (as the pitch-shift decision in M10).
3. **HTML export** (`core/animation/html.ts`): one self-contained `.html` file: the document as JSON, the pictures as data URLs, and a small player built from the same `draw.ts` and `stateAt` (bundled by Vite as a library file read at build time), looping, sized to its stage, playing in any browser without the internet; with AN18's buttons.
4. **Buttons** (AN18): a button object (label, action: pause, continue, restart, go to frame) that works in the preview and in the HTML player; in video and GIF exports it is drawn as it looks.
5. **Stop motion and frame-by-frame** (AN14): *Import frames…* chooses a folder of pictures (sorted by name) and makes a picture layer with one held keyframe per frame at the chosen rate; a *frame-by-frame* layer where every keyframe holds its own drawing (the objects drawn at that frame), with onion skin (the previous and next drawings faint); *Duplicate frame*.
6. **Teaching** (AN17): `core/teaching/animation.ts` (types of animation with advantages and disadvantages, the principles, the components, variables and avars, in the coursebook's words), a Learn ▸ **Animation** tab with those pages and a frame-rate demonstration (the same motion at 5, 12 and 24 fps side by side); glossary entries (frame, key frame, property keyframe, tween, morphing, stage, layer, mask, path, symbol, avar…); the syllabus registry (`core/teaching/syllabus.ts`) gains section 20.1 with where each point is done; "Why use this?" on every animation tool (T5); the task checker (T6) reads an exported MP4 / GIF / PNG sequence / HTML and checks size, frame rate, length, format and (for GIF and HTML) looping.
7. **Guides**: the student user guide and the teacher notes gain the animation chapter (`scripts/guides.ts` from the syllabus registry); the Welcome mentions the fourth mode.

**Tests first**
- Pictures: a JPG is imported with its pixel size and keeps its proportions when W is typed with the lock on; the SVG of a star draws; packaging copies the pictures beside the file.
- Trace: a picture of a red circle on white traces to two regions, one red path whose bounds are the circle's within 2 px; fewer colours merge regions; the detail setting changes the point count.
- HTML: the file contains no external references, plays at the stage size, loops, and the Pause / Continue buttons change the player's state (tested in jsdom with the player's module).
- Stop motion: 24 pictures at 12 fps make a 2 s layer with a held keyframe per frame; onion skin draws the neighbours at reduced opacity.
- Teaching: every 20.1 syllabus point has a place in the app and every animation tool sits under a point (the existing registry test extended); the coursebook's questions 1–22 are answerable from the pages and glossary (acceptance test over the texts, as M11's).
- Task checker: an MP4 exported from a 600 × 400, 24 fps, 3 s animation passes a check for those values and fails one for 30 fps.

**Exit gate — acceptance**
- Workbook **Task 3** and **Task 6** with the real pictures (`Paris1–6.jpg`, the eight computers), **Task 4** (Pause and Continue buttons in a browser), **Task 7** (flowchart iteration) and **Task 8** (bubble sort) as frame-by-frame plus tweens, the **worked example** (Star Designs: MP4 and HTML); coursebook **19.07** (every format); Learn mode answers questions 1–22.
- Tag `v1.4.0`.

---

### M17 — Hardening & v2.0

**Goal:** release quality for the whole app on both platforms, with animation.

**Build order**
1. **Full acceptance run** of README §14 phase 2 by the teacher on a Windows 11 laptop and a Mac with the installed app: the worked example, Tasks 1–9, Practical Activities 19.01–19.07 and exam-style questions 1–3; results in `docs/acceptance/M17.md`.
2. **Performance (N1–N5)** with an animation open: the stage redraws at ≥ 30 fps with 100 objects on the minimum-spec laptop; a 10 s 1024 × 768 MP4 exports in ≤ 30 s; RAM within N4 with a video project and an animation open together; start-up unchanged.
3. **Cross-platform (X1, X6)**: a `.mvea` with pictures made on Windows opens on macOS and exports the same MP4 (same size, fps, length; pictures alike at PSNR ≥ 40 dB), and the other way, in the existing CI job.
4. **Installers**: the three builds with the new guides and licences (any vendored tracer listed); the smoke test opens an animation; `INSTALL.md` updated.
5. **Design screens**: the Animation mode's screens added to `design/screens/` from the built UI, so the prototype stays the reference.
6. Version 2.0.0; PR `animation` / `dev` → `main`; tag `v2.0.0`; GitHub Release.

**Exit gate**
- All phase 2 acceptance tasks pass on both OSes; no open blocker or major bugs; performance budget met.
- Tag `v2.0.0`, publish GitHub Release.

## 7. Coursebook task → milestone map

| Milestone | `sound_video_editing.pdf` (Book A) | `video_audio_editing.pdf` (Book B) |
|---|---|---|
| M3 | 11.04, 11.08 (compiler level) | Tasks 11b, 11c (compiler level) |
| M5 | 11.01, 11.03, 11.04, 11.08, 11.13 | Tasks 11b, 11c |
| M6 | 11.02, 11.05, 11.10, 11.14 | Task 11a, Activity 11a |
| M7 | 11.06, 11.07, 11.09, 11.11, 11.12 | Tasks 11d, 11g, 11h, 11i |
| M8 | 11.15, 11.30 | Tasks 11e, 11f; Activities 11b–11d |
| M9 | 11.16–11.19, 11.25–11.27, 11.29 | Task 11j; Activity 11e |
| M10 | 11.20–11.24 | Tasks 11k–11p; Activities 11f–11i |
| M11 | 11.28; exam-style questions 1–6 | Theory sections 11.1.19, 11.2.20–11.2.22 |
| M12 | All of the above, on both OSes | Practice questions 1–7 (Bali) |

Phase 2 — `animation_book.pdf` (coursebook Chapter 19) and `animation_workbook.pdf` (workbook Chapter 7):

| Milestone | Coursebook Chapter 19 | Workbook Chapter 7 |
|---|---|---|
| M13 | 19.01 (layers); questions 1–15 as glossary targets | Task 1's set-up; Task 3's stage; Task 9's face (static) |
| M14 | 19.02, 19.03; exam-style question 3 | Task 1.1, Task 1.2 (without the morph), Task 2, Task 3 |
| M15 | 19.04, 19.05, 19.06; exam-style questions 1 and 2 | Task 1.2 complete, Task 5, Task 6 |
| M16 | 19.07; questions 1–22 from Learn mode | Worked example (Star Designs), Task 4, Task 7, Task 8; Tasks 3 and 6 with the real pictures |
| M17 | All of the above, on both OSes | All of the above, on both OSes |

Automated animation acceptance tests live in `tests/acceptance/` too, e.g. `workbook-task-1.test.ts`, built through the animation commands and exported with the real FFmpeg.

Automated acceptance tests live in `tests/acceptance/`, one file per task, e.g. `bookB-task-11c.test.ts`. They use fixture media with the same specs as the coursebook files.

## 8. Progress tracker

| Milestone | Status | Gate passed | Release tag |
|---|---|---|---|
| M0 Foundations & spike | ✅ Done ([gate record](acceptance/M0.md)) — Windows-laptop spike waived, deferred to M4 | 2026-10-14 | `v0.0.0` |
| M1 Core model & commands | ✅ Done ([gate record](acceptance/M1.md)) | 2026-10-14 | `v0.1.0` |
| M2 Media engine adapter | ✅ Done ([gate record](acceptance/M2.md)) | 2026-10-14 | `v0.2.0` |
| M3 Render compiler v1 | ✅ Done ([gate record](acceptance/M3.md)) | 2026-10-15 | `v0.3.0` |
| M4 Walking skeleton | ✅ Done ([gate record](acceptance/M4.md)) — Windows-laptop check not done, carried to M5 | 2026-10-14 | `v0.4.0` |
| M5 Video editing core | ✅ Done ([gate record](acceptance/M5.md)) — Windows-laptop check skipped, left to M12 | 2026-10-14 | `v0.5.0` |
| M6 Text & stills | ✅ Done ([gate record](acceptance/M6.md)) — crop tool and caption dragging added after the teacher's test | 2026-10-15 | `v0.6.0` |
| M7 Effects & transitions | ✅ Done ([gate record](acceptance/M7.md)) — plus the layout redesign to match the design screens | 2026-10-15 | `v0.7.0` |
| M8 Audio-in-video & export | ✅ Done ([gate record](acceptance/M8.md)) — plus split, join and speed for sound clips after the teacher's test | 2026-10-16 | `v0.8.0` |
| M9 Audio editor core | ✅ Done ([gate record](acceptance/M9.md)) — undo steps on disk (as Audacity) to keep RAM in budget | 2026-10-17 | `v0.9.0` |
| M10 Audio effects & recording | ✅ Done ([gate record](acceptance/M10.md)) — Audio mode is saved with the project; pitch in TypeScript (SoundTouch's method) | 2026-10-18 | `v0.10.0` |
| M11 Teaching layer | ✅ Done ([gate record](acceptance/M11.md)) — plus Audio mode clips, tooltips, 33 transitions, 20 fonts, text looks and animations after the teacher's test | 2026-10-19 | `v0.11.0` |
| M12 Hardening & v1.0 | ✅ Done ([gate record](acceptance/M12.md)) — installers for Windows and both Mac chips, self-checking; cross-platform at ≥ 40 dB; the teacher's performance and acceptance runs passed | 2026-10-27 | `v1.0.0` |
| M13 Animation core | ✅ Done ([gate record](acceptance/M13.md)) — the Animation mode: stage, vector shapes and text with exact numbers, layers and folders, snapping, `.mvea` files, PNG export; the teacher's check on Windows and a Mac passed | 2026-10-27 | `v1.1.0` |
| M14 Timeline & tweens | ✅ Done ([gate record](acceptance/M14.md)) — keyframes, tweens, the timeline, MP4 / GIF / PNG export, Split into letters, Send to Video mode; the teacher's check passed | 2026-10-27 | `v1.2.0` |
| M15 Paths, morphing & masks | 🔶 Built and passing on the MacBook 2026-10-27 ([gate record](acceptance/M15.md)): motion paths (several per object), morphing, masks, pen path editing; the teacher's check on Windows and a Mac next | | |
| M16 Pictures, web export & teaching | ⬜ | | |
| M17 Hardening & v2.0 | ⬜ | | |
