# EasyMedia — System Requirements

A lightweight, offline desktop video and audio editor built for teaching **Cambridge International AS & A Level Information Technology (9626), Chapter 11: Video and audio editing** and, in phase 2, **Chapter 20: Animation** (syllabus 2025–2027).

It covers every practical skill the syllabus asks for and leaves out professional features that the exam never needs, so it runs smoothly on ordinary student laptops (Windows 11 and macOS) that struggle with Adobe Premiere, DaVinci Resolve or Adobe Animate.

**Status:** v1.0 (Chapter 11) done; phase 2 (Chapter 20 Animation) in progress · **Maintainer:** subject teacher · **Licence:** open source (GPL-3.0), for study use · **Platforms:** Windows 11, macOS

---

## Contents

1. [Background](#1-background)
2. [Goals and non-goals](#2-goals-and-non-goals)
3. [Users](#3-users)
4. [Hardware and OS requirements](#4-hardware-and-os-requirements)
5. [Functional requirements — Video editor (11.1)](#5-functional-requirements--video-editor-syllabus-111)
6. [Functional requirements — Audio editor (11.2)](#6-functional-requirements--audio-editor-syllabus-112)
7. [Functional requirements — Animation editor (20.1)](#7-functional-requirements--animation-editor-syllabus-201)
8. [Functional requirements — Teaching features](#8-functional-requirements--teaching-features)
9. [Functional requirements — Project and file handling](#9-functional-requirements--project-and-file-handling)
10. [Non-functional requirements](#10-non-functional-requirements)
11. [Architecture](#11-architecture)
12. [Technology stack](#12-technology-stack)
13. [Development phases](#13-development-phases)
14. [Acceptance testing](#14-acceptance-testing)
15. [Risks and constraints](#15-risks-and-constraints)
16. [Decisions log](#16-decisions-log)
17. [Licence](#17-licence)

---

## 1. Background

The two coursebooks used for Chapter 11 teach the same syllabus with different software (the PDFs are kept in `documents/`, never in the repository):

| Source file | Video software | Audio software | Other tools needed |
|---|---|---|---|
| `sound_video_editing.pdf` | DaVinci Resolve | Audacity | — |
| `video_audio_editing.pdf` | Windows Movie Maker (discontinued) | Audacity | Prism (format conversion), Express Burn (DVD), Photoshop (crop/resize stills) |
| `video_audio_editing_syllabus.pdf` | Syllabus sections 11.1 and 11.2 — the authoritative list of required skills | | |

Phase 2 (from 2026-10-27) adds Chapter 20, Animation, from three more documents:

| Source file | What it is | Software it uses |
|---|---|---|
| `animation_syllabus.pdf` | Syllabus section 20.1 — the authoritative list of required skills and theory | — |
| `animation_book.pdf` | Coursebook Chapter 19 *Animation*: practical activities 19.01–19.07, questions 1–22, exam-style questions 1–3 | Adobe Animate (paid subscription) |
| `animation_workbook.pdf` | Practical Skills Workbook Chapter 7 *Animation*: a worked example and Tasks 1–9 | Tumult Hype (macOS only) |

Problems with the current options:

- **DaVinci Resolve / Premiere Pro** need a strong GPU and lots of RAM. They do not run smoothly on typical student laptops, and they are overwhelming for students.
- **Movie Maker** is discontinued, and its replacement (Photos / Clipchamp) lacks required features.
- Students end up switching between **up to five programs** to finish one chapter.
- For animation, **Adobe Animate** needs a paid subscription and a strong laptop, and **Tumult Hype** runs only on a Mac; free alternatives (Synfig, Pencil2D) are either hard to learn or lack tweens, paths and masks together.

**This project:** one small application that does everything in syllabus 11.1, 11.2 and 20.1, with menus and wording close enough to Movie Maker, Audacity and the animation coursebook that the books can still be followed.

## 2. Goals and non-goals

### Goals

- Cover **100% of syllabus 11.1 and 11.2** practical skills in one application — and, in phase 2, **100% of syllabus 20.1** (animation) in the same application (§7).
- Run smoothly and **offline** on ordinary student laptops — **Windows 11 and macOS** — from one codebase.
- Support **precise numeric entry** (times to 0.01 s), as exam tasks require exact values.
- Help students understand the **theory** (compression, containers, codecs, sampling) as well as the practical skills.
- Be easy to learn within one lesson.

### Non-goals

- Professional features: multi-cam, colour grading wheels, motion tracking, VFX, 3D, plugins, more than 4 tracks.
- Animation: 3D, bones / rigging, scripting (ActionScript / JavaScript), SWF export, interactivity beyond simple buttons (AN18).
- 4K/8K editing, HDR, RAW camera formats.
- Burning physical DVD/Blu-ray discs (a DVD-compatible *file* is produced instead).
- Cloud storage, accounts or online collaboration.
- Running in a web browser (possible future option — see §11.4).

## 3. Users

| User | Needs |
|---|---|
| **Students** (age 16–18) | Simple interface, clear menus, exact numeric controls, explanations of *why* each feature is used |
| **Teacher** (also the maintainer, using a MacBook) | Can demonstrate every coursebook and workbook activity; can check that student output matches task specs (resolution, duration, format); can build and release the app for both platforms |
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
| **X2** | **Bundled fonts** (open-licence: 20 fonts in five groups — sans-serif, serif, display, handwriting, typewriter & retro — including a "Courier-style" font) are used for titles, captions and credits, so text looks identical on both platforms. System fonts can still be chosen but are flagged as "may differ on other computers". |
| **X3** | Keyboard shortcuts follow platform conventions (`Ctrl` on Windows, `⌘` on macOS); menus use the native menu bar on macOS. |
| **X4** | Microphone access: on macOS the app declares microphone usage (`NSMicrophoneUsageDescription`) and shows a clear message if permission is denied; on Windows it respects the *Microphone privacy* setting. |
| **X5** | FFmpeg/ffprobe binaries bundled for each platform and architecture (Windows x64, macOS arm64, macOS x64). |
| **X6** | Exported files are identical in format and settings on both platforms (same FFmpeg version and command lines). |
| **X7** | Installation and first launch instructions for both platforms, including what to do about the macOS Gatekeeper warning if the app is not notarised (see §15). |

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

## 7. Functional requirements — Animation editor (syllabus 20.1)

Phase 2 (decided 2026-10-27): the same app gains an **Animation** mode for syllabus Chapter 20. The coursebook teaches it with Adobe Animate (paid) and the workbook with Tumult Hype (Mac only); the syllabus names no software, so the Animation mode follows the syllabus's own vocabulary (stage, frames, key frames, tweens, layers, masks) and the numbers the tasks give (pixels, seconds, hex colours, percentages).

| ID | Syllabus item | Requirement | Implementation |
|---|---|---|---|
| **AN1** | Configuring the stage: colour, size | **Stage settings**: width × height in pixels, background colour (hex), frame rate (10, 12, 15, 24, 25, 30, 60 fps or custom 1–60) and length (frames, shown in seconds too). Aspect-ratio presets: 4:3, 16:9, 16:10, 2.35:1, custom. | Canvas 2D stage |
| **AN2** | Aspect ratio using rulers, guides and grid settings; snapping options | **Rulers** in pixels along the top and left showing the pointer's coordinates (0, 0 at the top left); **guides** dragged out of the rulers; a **grid** with its spacing (default 10 px), behind or over the objects; **snap** to grid, guides, other objects' edges and centres, and whole pixels — each on or off. Rulers, grid and guides never appear in an export. | UI state, `core/animation/snap.ts` |
| **AN3** | Creating vector objects | Tools: **rectangle** (corner radius), **ellipse**, **star** (points, inner radius), **polygon** (sides), **line**, **pen** (Bézier path, open or closed), **brush** (freehand, smoothed into a path). Drawn by dragging; exact numbers typed afterwards. | Outlines in `core/animation/geometry.ts` |
| **AN4** | Adding text | **Text** objects with the bundled fonts (X2), size in px, colour, bold / italic, alignment. *Split into letters* makes one object per letter, so letters can enter one at a time (workbook Task 2; coursebook exam-style questions 1 and 3). | Same text drawing as Video mode |
| **AN5** | Importing vector objects; tracing bitmaps | Import PNG, JPG, GIF, BMP and SVG pictures. **Trace bitmap** turns a picture into vector shapes (number of colours, detail, smoothing) that can be edited and animated part by part, with the note that detail is lost. | Vectoriser in `core/animation/trace.ts` |
| **AN6** | Stroke and fill settings; size, position and orientation; transparency | **Properties** panel with exact numbers: X and Y (top-left corner, px), W and H (lock proportions), rotation (°), opacity (%), **fill** (none, solid, linear or radial gradient with two colours and an angle), **stroke** (colour, width in px, solid / dashed / dotted). Every change is undoable. | Properties on each object |
| **AN7** | Using layers | **Layers** panel: add, rename, reorder by drag, lock, hide, folders; objects belong to a layer; the top layer is in front. **Group** / ungroup, duplicate, bring forward / send back inside a layer. | `core/animation/layers.ts` |
| **AN8** | Frames, key frames, timings, frame rate; looping or stopping animations | **Frame-based timeline** (numbered every 5 frames) with the time in seconds alongside, as the workbook's tasks give times in seconds. Play / pause / stop / step, **loop** the whole animation or a selected frame range; the frame rate can be changed with the keyframes kept at the same times or the same frames. | `core/animation/time.ts`, timeline UI |
| **AN9** | Key frames, property key frames, inbetweening (tweening): motion, size, colour | **Keyframes per property** (position, size, rotation, opacity, fill, stroke, corner radius…): change a value at a frame and a keyframe is set; the values in between are generated (**tween**) with easing (linear, ease in, ease out, ease in-out, bounce) or **held** (no tween, for frame-by-frame work). Keyframe dots on the object's row; they can be moved, copied and deleted. | `core/animation/tween.ts` |
| **AN10** | Morphing (shape tweening) and its effect | **Shape keyframes**: an object becomes another shape (a circle into a square, a line into a circle into a rectangle), the in-between shapes generated; colour, size and position can change at the same time. | Outline resampling in `core/animation/morph.ts` |
| **AN11** | Setting paths | **Motion path**: draw a path (pen) or use any shape's outline for an object to follow between two keyframes; *orient to path* (a car turns with the road); even speed along the path (roving keyframes) or eased. | `core/animation/path.ts` |
| **AN12** | Applying masks | A layer can be a **mask**: the layers under it show only through the mask's shapes; a mask animates like any object (a spotlight that reveals words). | Canvas clipping |
| **AN13** | Animation variables: controlling the position of an animated object or its parts | **Groups**: a group's parts move, rotate and scale with it while keeping their own tweens (a car's wheels spin while the car drives; a face whose eyes, ears and mouth move independently). **Repeat** on a tween (spin once per second for the whole animation, even while the rest runs in reverse). Named objects and layers. | Parent transforms in `stateAt()` |
| **AN14** | Stop motion, time lapse, cel and flip book animation | *Import frames…*: a folder of photographs or drawings becomes one frame each at the chosen frame rate (stop motion, time lapse). A **frame-by-frame** layer where each keyframe holds its own drawing (cel, flip book), with onion skin. | FFmpeg image sequence; keyframes |
| **AN15** | Creating an animation for its intended application and audience; exporting | Export as **MP4** (H.264; computer, phone, web video), **animated GIF** (web page, email; no sound), **PNG sequence** (one picture per frame), **HTML web animation** (one file that plays in any browser, looping, with optional Pause / Continue buttons) and the current frame as **PNG**. The pros and cons of each format are shown (T7), and the estimated size. | Frames drawn by the app → FFmpeg; HTML player |
| **AN16** | (Project) | Save / open `.mvea` animation files (JSON, picture paths relative to the file, X1); autosave and crash recovery (P3); unlimited undo / redo; *Package* with its pictures (P2); *Send to Video mode* puts an export on the video timeline. | `core/animation/serialize.ts` |
| **AN17** | The basic principles of animation; different animation types and methods; components of an animation; advantages and disadvantages of animation types | **Learn ▸ Animation**: cel, stop motion, time lapse, flip book, CGI, 2D and 3D with advantages and disadvantages; frames, key frames, property key frames, timings, coordinates, tweening and morphing; primary and secondary components; animation variables and avars. "Why use this?" on every animation tool (T5); glossary entries; the **task checker** (T6) checks an exported animation (size, frame rate, length, format, whether it loops). | `core/teaching/`, Learn mode |
| **AN18** | Controlling animations by stopping them | **Button** objects (Pause, Continue, Restart, Go to frame) that work in the preview and in the HTML export (workbook Task 4). Built last: the only interactive feature. | HTML player |

### AN15 — Animation export formats

| Format | Best for | Notes |
|---|---|---|
| **MP4** (H.264) | Computer, phone, web video, putting into a video | Smooth, small; no transparency; sound can be added in Video mode |
| **Animated GIF** | Web pages, email, messages | Plays everywhere without a player; 256 colours per frame; large for long animations; no sound |
| **PNG sequence** | Further editing, other animation software | One lossless picture per frame; transparency kept |
| **HTML** | A web page, with buttons | One `.html` file that plays the animation in any browser, loops, and can carry Pause / Continue buttons |
| **PNG** (one frame) | A still of the animation | The current frame, with transparency |

Not supported: SWF (Flash; the coursebook notes it is being phased out) and 3D (a non-goal).

## 8. Functional requirements — Teaching features

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

## 9. Functional requirements — Project and file handling

| ID | Requirement |
|---|---|
| **P1** | Save/open projects as `.mve` (JSON) — stores links to media plus all edits. |
| **P2** | **Package project**: copy all media into one folder with the project file, so it can be moved to another PC or handed in (Movie Maker's `.wlmp` stored links only, a known problem). |
| **P3** | Autosave every 60 s and crash recovery. |
| **P4** | Import by drag-and-drop from File Explorer and via File → Import. |
| **P5** | Supported import: video MP4, MOV, AVI, WMV, MKV, MPG; image JPG, PNG, BMP, TIFF, GIF; audio MP3, WAV, M4A, AAC, FLAC, OGG, WMA. |
| **P6** | Missing-media detection with "locate file" prompt. |
| **P7** | Separate **Save project** (editable) and **Export** (playable file) commands, clearly explained — the coursebook tips stress this distinction. |

## 10. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| **N1** | Performance | Smooth preview (≥ 24 fps) of a 1080p project on minimum-spec hardware, using proxies. |
| **N2** | Performance | Export of a 1-minute 1080p H.264 video in ≤ 3 minutes on minimum spec. |
| **N3** | Performance | Audio effects on a 3-minute stereo clip apply in ≤ 3 s. |
| **N4** | Memory | ≤ 600 MB RAM for a typical exam-sized project (≈ 10 clips, ≤ 5 min). |
| **N5** | Startup | App opens in ≤ 5 s. |
| **N6** | Install | Installer ≤ 220 MB per platform (raised from 150 MB on 2026-10-19: Electron alone is about 134 MB; the portable .zip is about 235 MB) (Windows: per-user, **no admin rights**, plus a portable `.zip`; macOS: drag-to-Applications `.dmg`). |
| **N7** | Offline | All features work with **no internet connection**. No telemetry. |
| **N8** | Precision | Every time value can be typed with 0.01 s precision; durations shown in seconds (e.g. `12.40 s`) and as `mm:ss.ss`. |
| **N9** | Usability | A new student can complete a trim + title + export task in one lesson without prior training. Menu names follow Movie Maker / Audacity wording where possible. |
| **N10** | Accessibility | Keyboard shortcuts for all common actions; minimum 12 pt UI text; works at 1366 × 768. |
| **N11** | Reliability | An export failure never corrupts the project; FFmpeg errors are translated into plain-English messages. |
| **N12** | Responsiveness | Long operations (proxies, export, heavy effects) run in the background with a progress bar and a Cancel button; the UI never freezes. |
| **N13** | Maintainability | Single maintainer: TypeScript throughout; the project → FFmpeg command builder has unit tests; CI builds both platforms on every change. |
| **N14** | Licensing | All bundled components are open source and GPL-3.0-compatible (see §17). |

## 11. Architecture

### 11.1 Overview

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

### 11.2 Key design decisions for low-spec hardware

1. **Proxy editing.** On import, each video is converted in the background to a 640×360 H.264 proxy. The preview always plays proxies; export always uses the originals. This is the single biggest performance gain.
2. **Approximate preview, exact export.** There is no real-time compositing engine. Preview uses at most two `<video>` elements, CSS filters (which map almost one-to-one onto FFmpeg `eq` / `hue` / `boxblur`) and CSS opacity for fades and transitions. A **"Render preview of selection"** button produces a frame-exact check using FFmpeg.
3. **Text rendered once, to PNG.** Titles, captions and credits are drawn by the UI's canvas and saved as transparent PNGs, which FFmpeg overlays. Fonts in the export therefore match the preview exactly.
4. **Deliberately small timeline**: 1 main video track (magnetic, Movie Maker style), 1 text track, 2 audio tracks. This covers every task in both coursebooks and the practice exam paper.
5. **All encoding/decoding by FFmpeg**, never in JavaScript. Hardware encoders are used when detected (VideoToolbox on macOS; Quick Sync / AMF / NVENC on Windows), with `libx264 -preset veryfast` as the fallback.
6. **Audio as in-memory PCM.** Decoded once by FFmpeg; a 3-minute stereo clip is ≈ 64 MB as 32-bit float. Effects work on the selected region in a Web Worker; undo stores snapshots of only the changed region.

### 11.3 Why Electron (over Tauri)

| Reason | Detail |
|---|---|
| Identical on Windows and macOS | Bundled Chromium renders the UI and plays H.264/AAC/MP3 the same on both platforms (Tauri would use WebView2 on Windows and WebKit on macOS, which behave differently). |
| Self-contained | No dependency on a system webview; works fully offline. |
| One language | TypeScript for both UI and backend — one maintainer can look after the whole codebase. |
| Proven reference | [LosslessCut](https://github.com/mifi/lossless-cut) is an open-source Electron + FFmpeg video tool. |
| Trade-off accepted | ≈ 80–100 MB more RAM and a larger installer than Tauri — kept in check by the design decisions above. |

### 11.4 Future option: browser version

Because the UI is written in web technologies, it can later be reused for a browser-based practice version for home use (with `ffmpeg.wasm`, much slower export). This is **not** part of the initial scope.

## 12. Technology stack

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

## 13. Development phases

Development follows **Test-Driven Development** in 18 milestones over two phases, each closed by a test gate before the next one starts. Full plan, TDD rules and coursebook-task mapping: [`docs/MILESTONES.md`](docs/MILESTONES.md).

| Milestone | Scope | Outcome |
|---|---|---|
| **M0–M2** | Tooling, CI, fixtures, performance spike; core model & undo; FFmpeg adapter | Tested foundations; Electron go / no-go |
| **M3–M4** | Render compiler v1; walking skeleton app | First usable app: import → preview → export on Windows + macOS |
| **M5–M8** | V1–V17 | All of syllabus 11.1 |
| **M9–M10** | A1–A19 | All of syllabus 11.2 |
| **M11** | T1–T7 | Theory support |
| **M12** | §14 acceptance on Windows 11 and macOS | Release v1.0 on GitHub Releases |
| **M13** | AN1–AN4, AN6, AN7, AN16: stage, vector objects, text, properties, layers, animation files | Animation mode: a stage set up and drawn on exactly as a task says (phase 2) |
| **M14** | AN8, AN9, AN13, AN15 (MP4, GIF, PNG): timeline, keyframes, tweens, groups, export | Moving animations exported as video |
| **M15** | AN10–AN12: motion paths, morphing, masks | All tweening tools of 20.1 |
| **M16** | AN5, AN14, AN15 (HTML), AN17, AN18: pictures and tracing, stop motion, web export, buttons, Learn | All of syllabus 20.1 |
| **M17** | §14 acceptance of the animation tasks on Windows 11 and macOS | Release v2.0 on GitHub Releases |

## 14. Acceptance testing

The two coursebooks provide a ready-made acceptance test suite. Version 1.0 is accepted when **every practical activity below can be completed in the app alone** (no other software), with outputs matching the task specs:

- `sound_video_editing.pdf`: Practical Activities 11.01 – 11.30 (BeeProject video and soundtrack).
- `video_audio_editing.pdf`: Tasks 11a – 11p and Activities 11a – 11i.
- `video_audio_editing.pdf`: end-of-chapter practice questions 1–7 (Bali tourism video).
- All of the above must be completed on **both a Windows 11 laptop and a Mac**, meeting performance targets N1–N4 on a minimum-spec machine.
- A project created on one platform opens and exports identically on the other (X1, X2, X6).

Version 2.0 (phase 2) is accepted when, in addition, every animation task below can be completed in the app alone:

- `animation_workbook.pdf`: the worked example (Star Designs) and Tasks 1–9 (Chapter 7).
- `animation_book.pdf`: Practical Activities 19.01–19.07 and exam-style questions 1–3 (Saif's Comics, Henry's Homes, Films by Ying).
- Questions 1–22 of the coursebook chapter answerable from Learn mode.
- All of the above on both a Windows 11 laptop and a Mac; an animation file made on one opens and exports identically on the other.

## 15. Risks and constraints

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
| **FFmpeg licensing** | The project is open source, so a GPL FFmpeg build (with x264) can be bundled, provided the project is also GPL-compatible (see §17). |
| **Physical DVD/Blu-ray** | Out of scope; DVD-compliant `.mpg` export covers the syllabus point. |
| **Scope creep** | Any feature not traceable to syllabus 11.1/11.2 or §8 is rejected for v1; for v2, not traceable to 20.1 or §7. |
| **Trace bitmap quality** (AN5) | A JavaScript vectoriser gives coarser shapes than Animate's; good enough to show the idea (and the detail loss the coursebook describes). The number of colours and the detail are adjustable. |
| **Two reference books, two models** — the coursebook's Animate is frame-based with tweens per layer; the workbook's Hype is time-based with keyframes per property | The timeline counts frames and shows seconds; keyframes are per property, which handles both books' tasks. The glossary explains both sets of words. |

## 16. Decisions log

| # | Question | Decision (2026-10-14) |
|---|---|---|
| 1 | Target computers | Students' **personal laptops**: mostly Windows 11, some macOS. Teacher uses a MacBook. |
| 2 | Windows 7/8 support | **Not needed.** |
| 3 | Microphones / headsets | **Students have them** — voiceover recording (A14) is in scope. |
| 4 | Maintainer | **The subject teacher** maintains the project. |
| 5 | Licence | **Open source**, for study use only (see §17). |
| 6 | macOS support | **Yes** — first-class target alongside Windows. |
| 7 | App type and framework | Desktop app, Electron + bundled FFmpeg (§11). |
| 8 | Code signing for v1.0 (2026-10-19) | **None, for now** — the install guide shows the free *right-click → Open* (macOS Gatekeeper) and *More info → Run anyway* (Windows SmartScreen). Signing can be added later. |
| 9 | Installer size (2026-10-19) | **At most 220 MB** per installer (N6 was 150 MB). Electron alone is about 134 MB compressed; slimmer self-built FFmpeg builds would save only a little and add upkeep. |
| 10 | Animation (2026-10-27) | Syllabus 20.1 is added to **the same app** as a fourth mode (Video · Audio · Learn · **Animation**), not a second app: one install, one set of fonts and export code, one place for students. |
| 11 | Animation timeline model (2026-10-27) | **Frame-based** (frames numbered, a frame rate), as the syllabus and the coursebook speak of frames and key frames, with the **time in seconds shown alongside** because the workbook's tasks give times in seconds. Keyframes are **per object property** (as Hype), not per layer (as Animate): simpler for students and enough for every task. |
| 12 | Animation files (2026-10-27) | Animations are saved in their own **`.mvea`** files (the tasks say "save in the native format"); *Send to Video mode* puts an exported animation on the video timeline. The `.mve` video project format is unchanged. |
| 13 | Versions (2026-10-27) | Each animation milestone tags `v1.<n>.0` (M13 → v1.1.0 … M16 → v1.4.0); M17 releases **v2.0.0**. |

Still open:

- [ ] Confirm with the Cambridge exams officer whether the app may be used for assessed practical work (§15).

## 17. Licence

The project is open source and intended for **study and teaching use**.

- Proposed licence: **GPL-3.0**. This is required because the bundled FFmpeg build includes GPL components (x264), and it keeps all derived versions open.
- Third-party components and their licences (FFmpeg — GPL; Electron — MIT; bundled fonts — SIL OFL) are listed in a `THIRD_PARTY_LICENSES` file shipped with each release.
- Coursebook media files are **not** included in the repository; they remain the property of their publishers.
