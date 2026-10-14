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
- Manual: export Book B Task 11b through the UI.

---

### M5 — Video editing core

**Goal:** everyday editing through the inspector and timeline, matching screens 01, 10–11.

**Build order**
1. Project settings dialog (V1) — screen 11.
2. Inspector **Clip** tab: Start/End point fields, set-to-playhead, speed buttons (V2, V14) — screen 01.
3. Timeline: drag to reorder, Split, Join, Delete, trim handles, snapping, zoom.
4. Clip sound: mute, unlink, delete audio (V13 removal).
5. Image clips and duration (V12).
6. Package project (P2), missing-media relink (P6).

**Tests first**
- Typing `12.50` in End point dispatches `TrimCommand` and updates the duration label.
- Invalid input (`abc`, end < start) shows an inline error and changes nothing.
- Undo after every inspector change restores the previous value.

**Exit gate — acceptance**
- Automated: Book A **11.01, 11.03, 11.04, 11.08, 11.13**; Book B **11b, 11c**.
- Manual on both OSes with the real coursebook clips.

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
1. Audio tracks: add at playhead, start offset, trim, volume, fades, lower under voiceover (V13) — screen 08.
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
1. Change pitch, key-to-key (A9) — SoundTouch WASM.
2. Echo; Delay with 3 types (A10).
3. Reverb (A11).
4. Graphic EQ + presets, high-pass, low-pass (A12).
5. Noise reduction, two-step (A13).
6. Compressor (A19) — screen 18.
7. Recording / overdub: microphone choice, level meter, count-in, permission handling on both OSes (A14, X4) — screen 15.

**Tests first**
- All remaining rows in §3.1.
- Recorder adapter contract test with a fake microphone stream; macOS permission-denied path shows the friendly message.

**Exit gate — acceptance**
- Automated: Book A **11.20–11.24**; Book B **Tasks 11k–11p**, Activities **11f–11i**.
- Manual: record a real voiceover on a Windows laptop and on a Mac.

---

### M11 — Teaching layer

**Goal:** Learn mode and the remaining teaching features — screens 21–22.

**Build order**
1. Media inspector with explanations (T1).
2. Audio file-size calculator with worked steps (T2).
3. Sampling visualiser (T4).
4. Compression comparison, audio and video (T3).
5. Format guide (T7).
6. Task checker for teachers (T6).

**Tests first**
- Calculator: 44 100 Hz × 16-bit × mono × 120 s = 84 672 000 bits = 10.58 MB (Book A Question 5a); 32-bit doubles it (5b).
- Sampling: quantising to 3 bits gives exactly 8 levels.
- Task checker passes a correct export and fails one with the wrong resolution / duration / channel count.
- Every editing tool links to a "why" text (registry test from M7 extended to non-effect tools).

**Exit gate — acceptance**
- Book A **11.28** reproduced in the visualiser; Book A exam-style questions 1–6 answerable from Learn mode content.

---

### M12 — Hardening & v1.0

**Goal:** release quality on both platforms.

**Build order**
1. Full acceptance run: every task in README §13, on a Windows 11 laptop and a Mac.
2. **Bali practice paper** (Book B questions 1–7) end-to-end, timed.
3. Cross-platform: project made on Windows opens and exports identically on macOS and vice versa (X1, X2, X6).
4. Performance pass on the weakest laptop (N1–N5); fix regressions found by the performance tests.
5. Installers: Windows NSIS + portable zip, macOS universal DMG; first-launch guide (X7); `THIRD_PARTY_LICENSES`.
6. User guide for students; teacher notes mapping screens to syllabus points.

**Exit gate**
- All acceptance tasks pass on both OSes; results in `docs/acceptance/M12.md`.
- No open blocker or major bugs.
- Tag `v1.0.0`, publish GitHub Release.

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

Automated acceptance tests live in `tests/acceptance/`, one file per task, e.g. `bookB-task-11c.test.ts`. They use fixture media with the same specs as the coursebook files.

## 8. Progress tracker

| Milestone | Status | Gate passed | Release tag |
|---|---|---|---|
| M0 Foundations & spike | ✅ Done ([gate record](acceptance/M0.md)) — Windows-laptop spike waived, deferred to M4 | 2026-10-14 | `v0.0.0` |
| M1 Core model & commands | ✅ Done ([gate record](acceptance/M1.md)) | 2026-10-14 | `v0.1.0` |
| M2 Media engine adapter | ☐ Not started | | |
| M3 Render compiler v1 | ☐ Not started | | |
| M4 Walking skeleton | ☐ Not started | | |
| M5 Video editing core | ☐ Not started | | |
| M6 Text & stills | ☐ Not started | | |
| M7 Effects & transitions | ☐ Not started | | |
| M8 Audio-in-video & export | ☐ Not started | | |
| M9 Audio editor core | ☐ Not started | | |
| M10 Audio effects & recording | ☐ Not started | | |
| M11 Teaching layer | ☐ Not started | | |
| M12 Hardening & v1.0 | ☐ Not started | | |
