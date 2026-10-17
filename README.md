# EasyMedia — System Requirements

A lightweight, offline desktop video and audio editor built for teaching **Cambridge International AS & A Level Information Technology (9626), Chapter 11: Video and audio editing** (syllabus 2025–2027).

It covers every practical skill the syllabus asks for and leaves out professional features that the exam never needs, so it runs smoothly on ordinary student laptops (Windows 11 and macOS) that struggle with Adobe Premiere or DaVinci Resolve.

**Status:** requirements stage · **Maintainer:** subject teacher · **Licence:** open source (GPL-3.0), for study use · **Platforms:** Windows 11, macOS

---

## Contents

1. [Background](#1-background)
2. [Goals and non-goals](#2-goals-and-non-goals)
3. [Users](#3-users)
4. [Hardware and OS requirements](#4-hardware-and-os-requirements)
5. [Functional requirements — Video editor (11.1)](#5-functional-requirements--video-editor-syllabus-111)
6. [Functional requirements — Audio editor (11.2)](#6-functional-requirements--audio-editor-syllabus-112)
7. [Functional requirements — Teaching features](#7-functional-requirements--teaching-features)
8. [Functional requirements — Project and file handling](#8-functional-requirements--project-and-file-handling)
9. [Non-functional requirements](#9-non-functional-requirements)
10. [Architecture](#10-architecture)
11. [Technology stack](#11-technology-stack)
12. [Development phases](#12-development-phases)
13. [Acceptance testing](#13-acceptance-testing)
14. [Risks and constraints](#14-risks-and-constraints)
15. [Decisions log](#15-decisions-log)
16. [Licence](#16-licence)

---

## 1. Background

The two coursebooks used for Chapter 11 teach the same syllabus with different software:

| Source file | Video software | Audio software | Other tools needed |
|---|---|---|---|
| `sound_video_editing.pdf` | DaVinci Resolve | Audacity | — |
| `video_audio_editing.pdf` | Windows Movie Maker (discontinued) | Audacity | Prism (format conversion), Express Burn (DVD), Photoshop (crop/resize stills) |
| `video_audio_editing_syllabus.pdf` | Syllabus sections 11.1 and 11.2 — the authoritative list of required skills | | |

Problems with the current options:

- **DaVinci Resolve / Premiere Pro** need a strong GPU and lots of RAM. They do not run smoothly on typical student laptops, and they are overwhelming for students.
- **Movie Maker** is discontinued, and its replacement (Photos / Clipchamp) lacks required features.
- Students end up switching between **up to five programs** to finish one chapter.

**This project:** one small application that does everything in syllabus 11.1 and 11.2, with menus and wording close enough to Movie Maker and Audacity that both coursebooks can still be followed.

## 2. Goals and non-goals

### Goals

- Cover **100% of syllabus 11.1 and 11.2** practical skills in one application.
- Run smoothly and **offline** on ordinary student laptops — **Windows 11 and macOS** — from one codebase.
- Support **precise numeric entry** (times to 0.01 s), as exam tasks require exact values.
- Help students understand the **theory** (compression, containers, codecs, sampling) as well as the practical skills.
- Be easy to learn within one lesson.

### Non-goals

- Professional features: multi-cam, colour grading wheels, motion tracking, VFX, 3D, plugins, more than 4 tracks.
- 4K/8K editing, HDR, RAW camera formats.
- Burning physical DVD/Blu-ray discs (a DVD-compatible *file* is produced instead).
- Cloud storage, accounts or online collaboration.
- Running in a web browser (possible future option — see §10.4).

## 3. Users

| User | Needs |
|---|---|
| **Students** (age 16–18) | Simple interface, clear menus, exact numeric controls, explanations of *why* each feature is used |
| **Teacher** (also the maintainer, using a MacBook) | Can demonstrate every coursebook activity; can check that student output matches task specs (resolution, duration, format); can build and release the app for both platforms |
| **Students installing on their own laptops** | One-click install without admin rights, clear first-launch instructions (especially macOS), works offline |

## 4. Hardware and OS requirements

The app runs on **students' personal laptops** (mostly Windows 11, some macOS) and on the teacher's MacBook. Both platforms are **first-class targets**, built from the same code.

### 4.1 Supported platforms

| Platform | Versions | CPU architectures | Package |
|---|---|---|---|
| **Windows** | Windows 11 (Windows 10 64-bit also works) | x64 (ARM64 optional) | NSIS installer (per-user, no admin) + portable `.zip` |
| **macOS** | macOS 12 Monterey or later (current Electron minimum) | Apple Silicon (arm64) **and** Intel (x64) — universal build | `.dmg` |

Not supported: Windows 7/8, 32-bit Windows, Linux (possible later from the same code, not planned).

### 4.2 Hardware

| | Minimum | Recommended |
|---|---|---|
| **CPU** | Dual-core, 2 GHz (e.g. Intel Core i3 / Celeron N-series, any Apple Silicon) | Quad-core or Apple M1 and newer |
| **RAM** | 4 GB | 8 GB |
| **Graphics** | Integrated graphics | Any; hardware encoding is used if present (Windows: Intel Quick Sync / AMD AMF / NVIDIA NVENC; macOS: VideoToolbox) |
| **Storage** | 400 MB for the app + 2 GB free for proxy and export files | SSD |
| **Screen** | 1366 × 768 | 1920 × 1080 or Retina |
| **Audio** | Headset with microphone (students have these; needed for voiceover / overdubbing, A14) | — |
| **Internet** | Not required after installation | — |

### 4.3 Cross-platform requirements

| ID | Requirement |
|---|---|
| **X1** | A project saved on Windows opens on macOS and vice versa (media paths stored **relative** to the project file; *Package project* (P2) for moving between machines). |
| **X2** | **Bundled fonts** (open-licence, e.g. a sans-serif, a serif and a monospace "Courier-style" font) are used for titles, captions and credits, so text looks identical on both platforms. System fonts can still be chosen but are flagged as "may differ on other computers". |
| **X3** | Keyboard shortcuts follow platform conventions (`Ctrl` on Windows, `⌘` on macOS); menus use the native menu bar on macOS. |
| **X4** | Microphone access: on macOS the app declares microphone usage (`NSMicrophoneUsageDescription`) and shows a clear message if permission is denied; on Windows it respects the *Microphone privacy* setting. |
| **X5** | FFmpeg/ffprobe binaries bundled for each platform and architecture (Windows x64, macOS arm64, macOS x64). |
| **X6** | Exported files are identical in format and settings on both platforms (same FFmpeg version and command lines). |
| **X7** | Installation and first launch instructions for both platforms, including what to do about the macOS Gatekeeper warning if the app is not notarised (see §14). |

## 5. Functional requirements — Video editor (syllabus 11.1)

| ID | Syllabus item | Requirement | Engine (FFmpeg) |
|---|---|---|---|
| **V1** | Setting an aspect ratio | Project settings: 16:9, 4:3 or custom, plus a resolution preset (e.g. 1920×1080, 1280×720, 960×720, 640×360). Clips that don't match can be **letterboxed** or **cropped to fill**. | `scale`, `pad`, `crop` |
| **V2** | Trimming a clip | Trim with drag handles **and** numeric *Start point* / *End point* boxes (0.01 s precision). | `trim`, `atrim` |
| **V3** | Splicing/joining clips | Place clips one after another on the main track; reorder by drag; *Split at playhead*; *Join clips*. | `concat` |
| **V4** | Titles, subtitles and captions | **Title slide**: text on a solid colour or image background. **Caption/subtitle**: text overlay on a clip. Controls: font, size, colour, bold/italic, alignment, line breaks, position (drag or 9-point presets), start time, duration. Subtitles have their own default style (bottom-centre). | Text rendered to PNG → `overlay` with `enable='between(t,a,b)'` |
| **V5** | Credits, scrolling credits with blank lines | **Credits** object: multi-line text that scrolls bottom to top, on black or over an image/clip, with blank lines kept. Duration sets the scroll speed. | Tall PNG → `overlay` with animated y |
| **V6** | Ensuring readability of text | Optional outline, drop shadow and semi-transparent background box. **Contrast warning** when text and background colours are too similar. | Drawn into the text PNG |
| **V7** | Fading effects | Fade in / fade out on clips, images and text; fade to/from black or white; numeric duration. | `fade`, `afade` |
| **V8** | Pan and zoom | **Presets** (zoom in/out at centre/left/right/top/bottom, pan left→right, etc. — like Movie Maker) and a **custom 2-keyframe mode** (start and end position/zoom — like DaVinci Resolve). | `zoompan` (images), animated `crop`+`scale` (video) |
| **V9** | Transitions | Library: dissolve/crossfade, fade through black, wipes, slides, push, circle, etc. Numeric duration (default 1.0 s). | `xfade` |
| **V10** | Extracting a still image | *Snapshot* button at the playhead → save as **PNG, JPG, BMP or TIFF**; option to add the still to the timeline automatically. | `-ss <t> -frames:v 1` |
| **V11** | Resizing and cropping a still to the video's aspect ratio | Image dialog: width/height with **constrain proportions**, crop to target ratio with a **9-point anchor** (as in Photoshop *Canvas Size*), save as a new file. | `scale`, `crop` |
| **V12** | Inserting a still image | Images are clips with a numeric duration (default 5 s). | `loop`, `-t` |
| **V13** | Adding / editing / removing audio | Video clip audio can be **muted**, **unlinked** and **deleted**. Two audio tracks (music, voiceover) with start offset, trim, volume, fade in/out. *Add music at the current point*. | `amix`, `volume`, `adelay`, `-an` |
| **V14** | Altering speed | Speed 0.25× – 4× (presets + numeric); clip length recalculates automatically (e.g. 6.3 s at 1.5× → 4.2 s). Option to keep or mute audio. | `setpts`, chained `atempo` |
| **V15** | Filters and colour correction | Brightness, contrast, saturation, black & white, sepia, cyan tone, blur, sharpen, invert. Apply to a whole clip or to a segment created by *Split*. Multiple effects per clip. | `eq`, `hue`, `colorchannelmixer`, `boxblur`, `unsharp`, `negate` |
| **V16** | Export in MP4, AVI, MOV, WMV | Export dialog: choose container and codec. **Lossy** and genuinely **lossless** options for each container (see table below). | See table below |
| **V17** | Compress to different resolutions for different media | Presets (see table below), plus custom resolution, frame rate and quality. **Estimated file size shown before export.** | `scale`, `-crf`, `-b:v`, `-r` |

### V16 — Export containers and codecs

| Container | Lossy (default) | Lossless option |
|---|---|---|
| **MP4** | H.264 + AAC | — (H.264 lossless not widely playable; use MOV/AVI) |
| **MOV** | H.264 + AAC | ProRes 422 HQ / PNG codec + PCM |
| **AVI** | MPEG-4 Part 2 or MJPEG + MP3 | FFV1 / uncompressed + PCM |
| **WMV** | WMV2 + WMA2 | — |
| **MPG** (DVD) | MPEG-2 + AC-3/MP2 | — |

### V17 — Output presets

| Preset | Resolution | Notes |
|---|---|---|
| Blu-ray / HD display | 1920×1080 | High bitrate |
| Internet / YouTube | 1920×1080 or 1280×720 | H.264, web-optimised (`+faststart`) |
| Mobile (medium) | 960×720 / 854×480 | Lower bitrate |
| Mobile (small) | 640×360 / 426×240 | Very low bitrate |
| DVD (PAL / NTSC) | 720×576 / 720×480 | MPEG-2 `.mpg`, DVD-compliant |
| Custom | Any | User-set resolution, fps, quality |

## 6. Functional requirements — Audio editor (syllabus 11.2)

The audio editor follows the **Audacity model**: select a region on the waveform, then apply an effect to that selection. Both coursebooks teach Audacity, so tasks like *"add reverb between 4 and 6 seconds"* translate directly.

| ID | Syllabus item | Requirement | Implementation |
|---|---|---|---|
| **A1** | Importing new tracks | Open / import MP3, WAV, M4A, AAC, FLAC, OGG, and the audio from video files. Multi-track waveform view with zoom. | FFmpeg decode → PCM |
| **A2** | Adding a track to an existing clip | *Import as new track*; move track up/down; *Align end to end*; *Align start to cursor*; time-shift tool. | Track model |
| **A3** | Normalising, removing DC offset | *Normalise* dialog: max peak (dB, ≤ 0), *Remove DC offset* checkbox, clipping warning. | DSP |
| **A4** | Amplify (used in both books) | Gain in dB, *Allow clipping* checkbox, auto-calculated max gain. | DSP |
| **A5** | Trimming | Selection tool + numeric **Selection Start / End** and **Audio Position** boxes; Cut, Copy, Paste, Delete, *Trim to selection*, *Insert silence*. | PCM buffer ops |
| **A6** | Splicing/joining two clips | Copy/paste between tracks; *Mix and render* (to same track or new track). | Mixer |
| **A7** | Fading in and out | *Fade in* / *Fade out* on the selection. | Gain ramp |
| **A8** | Altering clip speed | *Change speed* by multiplier or %, which changes pitch as in Audacity; shows the new length. | Resampling |
| **A9** | Changing pitch | *Change pitch* by semitones, **from key → to key**, or %; length unchanged. | Time-stretch (WSOLA, as SoundTouch) + resampling |
| **A10** | Delay / echo | *Echo*: delay time, decay factor. *Delay*: type (regular / bouncing ball / reverse bouncing ball), delay time, number of echoes. | Feedback delay line |
| **A11** | Reverberation | *Reverb*: room size, reverberance, damping, wet/dry; **Preview** button. | Freeverb |
| **A12** | Equalisation, high- and low-pass filters | **Graphic EQ** (≈ 10 bands, 20 Hz – 20 kHz, ±20 dB) with presets: *Bass boost*, *Treble boost*, *Treble cut*, *Telephone*, *Walkie-talkie*, *Flat*. **High-pass** and **Low-pass** with cutoff (Hz) and roll-off (dB/octave). | Biquad filters |
| **A13** | Noise reduction | Two steps as in Audacity: **1. Get noise profile** from a selected noise-only section → **2. Apply** with reduction (dB), sensitivity, frequency smoothing. | Spectral subtraction (FFT) |
| **A14** | Overdubbing, voiceover | **Record** from the microphone into a new track at the playhead; lower the music under the voice (*Amplify* −6 dB on the selection). | Mic input + mixer |
| **A15** | Stereo → mono | *Mix stereo down to mono*; also *Force mono* on export. | Channel average |
| **A16** | Compressing to different sample rates | Export sample rate: 8, 11.025, 22.05, 32, 44.1, 48, 96 kHz; bit depth 16/24/32-bit (WAV); bitrate CBR/VBR (MP3/AAC). **Estimated file size shown.** | FFmpeg `-ar`, `-sample_fmt`, `-b:a` |
| **A17** | Export MP3, M4A (MP4a), WAV, AAC | Plus FLAC (lossless example used in the coursebook). Metadata tags editor (title, artist, year, credits). | FFmpeg encoders |
| **A18** | (Usability) | Unlimited undo/redo, play/pause/stop, loop selection, **Preview** in every effect dialog. | Region snapshots |
| **A19** | Effects of compression on audio: *dynamic range* compression (taught in `video_audio_editing.pdf` §11.2.22) | *Compressor*: threshold, ratio, attack, release, make-up gain; before/after waveform and input→output curve. The dialog explains that this evens out loud and quiet parts and is **different from file compression** (lossy/lossless), which reduces file size. | DSP (envelope follower + gain) |

## 7. Functional requirements — Teaching features

These cover the **theory** parts of the syllabus that ordinary editors don't teach.

| ID | Syllabus link | Feature |
|---|---|---|
| **T1** | Files vs containers; codecs; lossy vs lossless | **Media inspector**: for any file, show container, video/audio codec, resolution, aspect ratio, fps, bitrate, sample rate, bit depth, channels, duration, file size — with a short explanation of each. |
| **T2** | Why file size depends on sampling rate and resolution | **Audio file-size calculator**: sample rate × bit depth × channels × duration, worked step by step in bits → bytes → KB → MB. |
| **T3** | Effects of compression on quality | **Compression comparison**: export the same 5–10 s at several settings (e.g. lossless, high, medium, low), play them side by side, show file sizes and % saving. Same for audio (WAV vs MP3 128/64/32 kbps). |
| **T4** | Describing sampling rate and resolution | **Sampling visualiser**: an analogue wave with adjustable sample rate and bit depth, showing the stepped digital result. |
| **T5** | Why typical features are used | **"Why use this?"** help button on each tool, worded to match the syllabus "why" points (e.g. why captions help hearing-impaired viewers, why fade to black shows time passing). |
| **T6** | Meeting requirements of application and audience | **Task checker** (teacher-defined): compare an exported file against expected specs (format, resolution, duration ± tolerance, mono/stereo, sample rate) and report pass/fail. |
| **T7** | Advantages and disadvantages of export file formats (11.1 and 11.2) | Every export dialog shows the **pros and cons of the selected format** (e.g. MP3: plays everywhere, small · lossy, lower quality than AAC at the same bit rate), and the Learn mode glossary compares all formats side by side. |

## 8. Functional requirements — Project and file handling

| ID | Requirement |
|---|---|
| **P1** | Save/open projects as `.mve` (JSON) — stores links to media plus all edits. |
| **P2** | **Package project**: copy all media into one folder with the project file, so it can be moved to another PC or handed in (Movie Maker's `.wlmp` stored links only, a known problem). |
| **P3** | Autosave every 60 s and crash recovery. |
| **P4** | Import by drag-and-drop from File Explorer and via File → Import. |
| **P5** | Supported import: video MP4, MOV, AVI, WMV, MKV, MPG; image JPG, PNG, BMP, TIFF, GIF; audio MP3, WAV, M4A, AAC, FLAC, OGG, WMA. |
| **P6** | Missing-media detection with "locate file" prompt. |
| **P7** | Separate **Save project** (editable) and **Export** (playable file) commands, clearly explained — the coursebook tips stress this distinction. |

## 9. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| **N1** | Performance | Smooth preview (≥ 24 fps) of a 1080p project on minimum-spec hardware, using proxies. |
| **N2** | Performance | Export of a 1-minute 1080p H.264 video in ≤ 3 minutes on minimum spec. |
| **N3** | Performance | Audio effects on a 3-minute stereo clip apply in ≤ 3 s. |
| **N4** | Memory | ≤ 600 MB RAM for a typical exam-sized project (≈ 10 clips, ≤ 5 min). |
| **N5** | Startup | App opens in ≤ 5 s. |
| **N6** | Install | Installer ≤ 150 MB per platform (Windows: per-user, **no admin rights**, plus a portable `.zip`; macOS: drag-to-Applications `.dmg`). |
| **N7** | Offline | All features work with **no internet connection**. No telemetry. |
| **N8** | Precision | Every time value can be typed with 0.01 s precision; durations shown in seconds (e.g. `12.40 s`) and as `mm:ss.ss`. |
| **N9** | Usability | A new student can complete a trim + title + export task in one lesson without prior training. Menu names follow Movie Maker / Audacity wording where possible. |
| **N10** | Accessibility | Keyboard shortcuts for all common actions; minimum 12 pt UI text; works at 1366 × 768. |
| **N11** | Reliability | An export failure never corrupts the project; FFmpeg errors are translated into plain-English messages. |
| **N12** | Responsiveness | Long operations (proxies, export, heavy effects) run in the background with a progress bar and a Cancel button; the UI never freezes. |
| **N13** | Maintainability | Single maintainer: TypeScript throughout; the project → FFmpeg command builder has unit tests; CI builds both platforms on every change. |
| **N14** | Licensing | All bundled components are open source and GPL-3.0-compatible (see §16). |

## 10. Architecture

### 10.1 Overview

> Detailed system design (layers, design patterns, data model, flows): see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
> UI prototype (23 high-fidelity screens, importable into Figma): see [`design/screens/index.html`](design/screens/index.html).
> Milestones and TDD workflow: see [`docs/MILESTONES.md`](docs/MILESTONES.md).

**Type: desktop application** (installed on each laptop, fully offline) for **Windows and macOS**, built with **Electron** and bundled **FFmpeg**.

```
┌──────────────── Electron app (installed per laptop: Windows / macOS) ─────────┐
│                                                                               │
│  Renderer process (UI: HTML / CSS / TypeScript)                               │
│  ┌──────────────────────────────┐   ┌──────────────────────────────────────┐  │
│  │ Video mode                   │   │ Audio mode                           │  │
│  │ • Storyboard / timeline      │   │ • Multi-track waveform editor        │  │
│  │ • Preview player             │   │ • Selection + effects dialogs        │  │
│  │   (<video> on proxy files,   │   │ • Audio DSP in a Web Worker          │  │
│  │    canvas text overlay,      │   │   (Float32Array PCM buffers,         │  │
│  │    CSS filters & opacity)    │   │    Web Audio API for playback)       │  │
│  └──────────────┬───────────────┘   └───────────────┬──────────────────────┘  │
│                 │ IPC (contextBridge)               │                         │
│  Main process (Node.js)                             │                         │
│  ┌──────────────┴───────────────────────────────────┴──────────────────────┐  │
│  │ • Project model (JSON) & file I/O                                       │  │
│  │ • Filtergraph compiler: project → FFmpeg command                        │  │
│  │ • Job queue: proxy generation, thumbnails, waveforms, export           │  │
│  │ • Local media protocol (streams files with range requests)              │  │
│  └──────────────────────────────┬──────────────────────────────────────────┘  │
│                                 │ child_process.spawn                         │
│                    ┌────────────┴────────────┐                                │
│                    │ ffmpeg / ffprobe (bundled)│                               │
│                    └─────────────────────────┘                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Key design decisions for low-spec hardware

1. **Proxy editing.** On import, each video is converted in the background to a 640×360 H.264 proxy. The preview always plays proxies; export always uses the originals. This is the single biggest performance gain.
2. **Approximate preview, exact export.** There is no real-time compositing engine. Preview uses at most two `<video>` elements, CSS filters (which map almost one-to-one onto FFmpeg `eq` / `hue` / `boxblur`) and CSS opacity for fades and transitions. A **"Render preview of selection"** button produces a frame-exact check using FFmpeg.
3. **Text rendered once, to PNG.** Titles, captions and credits are drawn by the UI's canvas and saved as transparent PNGs, which FFmpeg overlays. Fonts in the export therefore match the preview exactly.
4. **Deliberately small timeline**: 1 main video track (magnetic, Movie Maker style), 1 text track, 2 audio tracks. This covers every task in both coursebooks and the practice exam paper.
5. **All encoding/decoding by FFmpeg**, never in JavaScript. Hardware encoders are used when detected (VideoToolbox on macOS; Quick Sync / AMF / NVENC on Windows), with `libx264 -preset veryfast` as the fallback.
6. **Audio as in-memory PCM.** Decoded once by FFmpeg; a 3-minute stereo clip is ≈ 64 MB as 32-bit float. Effects work on the selected region in a Web Worker; undo stores snapshots of only the changed region.

### 10.3 Why Electron (over Tauri)

| Reason | Detail |
|---|---|
| Identical on Windows and macOS | Bundled Chromium renders the UI and plays H.264/AAC/MP3 the same on both platforms (Tauri would use WebView2 on Windows and WebKit on macOS, which behave differently). |
| Self-contained | No dependency on a system webview; works fully offline. |
| One language | TypeScript for both UI and backend — one maintainer can look after the whole codebase. |
| Proven reference | [LosslessCut](https://github.com/mifi/lossless-cut) is an open-source Electron + FFmpeg video tool. |
| Trade-off accepted | ≈ 80–100 MB more RAM and a larger installer than Tauri — kept in check by the design decisions above. |

### 10.4 Future option: browser version

Because the UI is written in web technologies, it can later be reused for a browser-based practice version for home use (with `ffmpeg.wasm`, much slower export). This is **not** part of the initial scope.

## 11. Technology stack

| Layer | Choice |
|---|---|
| App shell | Electron (current stable) + electron-builder: Windows NSIS per-user installer + portable `.zip`; macOS universal `.dmg` |
| Language | TypeScript |
| UI framework | Svelte (small, fast) — no heavy component library |
| Build tool | Vite |
| Media engine | FFmpeg + ffprobe, GPL static builds bundled per platform (Windows x64, macOS arm64, macOS x64) |
| Waveform display | Canvas, peaks pre-computed by FFmpeg |
| Audio playback | Web Audio API |
| Audio DSP | TypeScript (in a Web Worker for the heavy effects); pitch shifting by WSOLA time-stretch + resampling, the method SoundTouch uses |
| Project format | JSON (`.mve`) |
| Testing | Vitest (unit, filtergraph compiler), Playwright (UI end-to-end) |
| Fonts | Bundled open-licence fonts (e.g. Noto Sans, Noto Serif, Courier Prime) |
| CI / releases | GitHub Actions: build and test on `windows-latest` and `macos-latest`, attach installers to GitHub Releases |
| Source hosting | Public GitHub repository |

## 12. Development phases

Development follows **Test-Driven Development** in 13 milestones, each closed by a test gate before the next one starts. Full plan, TDD rules and coursebook-task mapping: [`docs/MILESTONES.md`](docs/MILESTONES.md).

| Milestone | Scope | Outcome |
|---|---|---|
| **M0–M2** | Tooling, CI, fixtures, performance spike; core model & undo; FFmpeg adapter | Tested foundations; Electron go / no-go |
| **M3–M4** | Render compiler v1; walking skeleton app | First usable app: import → preview → export on Windows + macOS |
| **M5–M8** | V1–V17 | All of syllabus 11.1 |
| **M9–M10** | A1–A19 | All of syllabus 11.2 |
| **M11** | T1–T7 | Theory support |
| **M12** | §13 acceptance on Windows 11 and macOS | Release v1.0 on GitHub Releases |

## 13. Acceptance testing

The two coursebooks provide a ready-made acceptance test suite. Version 1.0 is accepted when **every practical activity below can be completed in the app alone** (no other software), with outputs matching the task specs:

- `sound_video_editing.pdf`: Practical Activities 11.01 – 11.30 (BeeProject video and soundtrack).
- `video_audio_editing.pdf`: Tasks 11a – 11p and Activities 11a – 11i.
- `video_audio_editing.pdf`: end-of-chapter practice questions 1–7 (Bali tourism video).
- All of the above must be completed on **both a Windows 11 laptop and a Mac**, meeting performance targets N1–N4 on a minimum-spec machine.
- A project created on one platform opens and exports identically on the other (X1, X2, X6).

## 14. Risks and constraints

| Risk | Mitigation |
|---|---|
| **Exam use** — unclear whether centre-built software is allowed for practical papers | Confirm with the Cambridge exams officer before relying on it for assessed work. Teaching use is unaffected. |
| **Noise reduction quality** | Port Audacity's spectral noise-reduction approach; test with coursebook files `Voiceover_1.mp3`, `Task_11n_audio.mp3`. |
| **Pitch shift quality** | WSOLA (SoundTouch's method) written in TypeScript, tested with known tones; the teacher listens to real voice and music in the M10 check. If it is not good enough, SoundTouch (LGPL) replaces one DSP file. |
| **Performance on weaker student laptops** | Phase 0 spike measured on the weakest available laptop before further work. |
| **macOS Gatekeeper** — unsigned apps show *"cannot be opened because the developer cannot be verified"* | Option A: join the Apple Developer Program (US$99/year) to sign and notarise. Option B (free): document *right-click → Open* (or *System Settings → Privacy & Security → Open Anyway*) in the install guide. |
| **Windows SmartScreen** — unsigned installers show *"Windows protected your PC"* | Document *More info → Run anyway*; optional code-signing certificate later. |
| **Different fonts per OS** | Bundled fonts (X2). |
| **Single maintainer** | Keep scope tight (§2), automated tests and CI builds so releases are repeatable. |
| **Coursebook inaccuracy** — `sound_video_editing.pdf` implies MOV/AVI are lossless | They are *containers*; the app's lossless options use genuinely lossless codecs, and the media inspector (T1) shows the difference. |
| **FFmpeg licensing** | The project is open source, so a GPL FFmpeg build (with x264) can be bundled, provided the project is also GPL-compatible (see §16). |
| **Physical DVD/Blu-ray** | Out of scope; DVD-compliant `.mpg` export covers the syllabus point. |
| **Scope creep** | Any feature not traceable to syllabus 11.1/11.2 or §7 is rejected for v1. |

## 15. Decisions log

| # | Question | Decision (2026-10-14) |
|---|---|---|
| 1 | Target computers | Students' **personal laptops**: mostly Windows 11, some macOS. Teacher uses a MacBook. |
| 2 | Windows 7/8 support | **Not needed.** |
| 3 | Microphones / headsets | **Students have them** — voiceover recording (A14) is in scope. |
| 4 | Maintainer | **The subject teacher** maintains the project. |
| 5 | Licence | **Open source**, for study use only (see §16). |
| 6 | macOS support | **Yes** — first-class target alongside Windows. |
| 7 | App type and framework | Desktop app, Electron + bundled FFmpeg (§10). |

Still open:

- [ ] Apple Developer Program membership for notarised macOS builds, or document the free *right-click → Open* workaround (§14).
- [ ] Confirm with the Cambridge exams officer whether the app may be used for assessed practical work (§14).

## 16. Licence

The project is open source and intended for **study and teaching use**.

- Proposed licence: **GPL-3.0**. This is required because the bundled FFmpeg build includes GPL components (x264), and it keeps all derived versions open.
- Third-party components and their licences (FFmpeg — GPL; Electron — MIT; bundled fonts — SIL OFL) are listed in a `THIRD_PARTY_LICENSES` file shipped with each release.
- Coursebook media files are **not** included in the repository; they remain the property of their publishers.
