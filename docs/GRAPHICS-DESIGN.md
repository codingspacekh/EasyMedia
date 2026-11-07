# Phase 3 — Graphics mode (syllabus 19): analysis and design proposal

Status: **agreed 2026-11-07** (§7). Its requirements are in README §7a, its milestones in
`docs/MILESTONES.md` (Phase 3) and its design in `docs/ARCHITECTURE.md` §7.10; this document
keeps the analysis of the sources, the decisions and the estimate.

## 1. What the sources ask for

| Source | Software it teaches with | What it contributes |
|---|---|---|
| Syllabus 9626 (2025–27) §19.1–19.5 | none named | The checklist: layers, transforms (incl. envelope and perspective), grouping and Boolean shapes, align and distribute, rulers, grids, guides and snapping, colour picker, crop and clip, colour systems (RGB, HSL, CMYK, CMS), resolution, 7 export formats (SVG, BMP, JPG, PNG, GIF, TIF, PDF), fills; vector tools (freehand, Bézier, lines, rectangles, ellipses, arcs, stars, polygons, spirals, nodes of four kinds, convert to curves, replication, trace bitmap); bitmap tools (lasso, magic wand, colour select, cut-out, crop, masks, greyscale and B&W, brightness, contrast, colour balance, shadows and highlights, brush, pencil and pen presets, distort, clone, erase, blur, smudge, sharpen, red-eye, image and canvas size, colour depth, resolution); compression (lossless, lossy, effects); text (face, size, kerning, letter and line spacing, text on a path, text in a shape, text to curves) |
| Coursebook Ch.18 (33 pp.) | Adobe Photoshop | The tool-by-tool walk-through in the syllabus order, the theory (bitmap vs vector, DPI and file size, RGB hex, HSL, CMYK, "CMS" as picking a colour from an image, the format table, lossless vs lossy, colour depth in bits), society and ethics of image editing, 4 worked examples, 15 practical activities, 2 exam-style questions (a TV logo with arched text, a roller coaster with distorted rectangle and text on an arc) |
| Workbook Ch.6 (pp. 79–94) | Pixelmator Pro (Mac) | 9 tasks with given files: layer order, drop shadow, a 6-colour gradient, fill opacity 50 %, node editing, align an edge to X = 800 / Y = 1900, union; cut a cat from its photo, flip a copy, text to curves with stretched letters, save as JPG, PNG, GIF, TIFF **and PDF**; remove a sign and ropes, swirl blur, **replace colour**, layers with opacity and rotation, resize to 640 px; clipping mask + text round a circle, then trace the logo to SVG; **colour depth 16 bits/channel**, levels, exposure, contrast, shadows, highlights, temperature; remove tram cables (clone, repair), **red-eye**; greyscale scene + silhouettes + gradient balloons; **sky replacement** between leaves + a plaque cut with subtract; a metallic plaque with 3-D letters |
| Past papers 9626/04, 2017–2026 | any | **23 graphics tasks** (sessions; none in M/18 and J/25) (Downloads/exam-paper-batch4/…/4_Graphics_Editing, 18 source files). Summarised in §1.1 |

### 1.1 The 23 past-paper tasks and what each needs

| Paper | Task | Needs (beyond shapes, fills and SVG/PNG export) |
|---|---|---|
| M/17 | Woodlands sticker | Union 3 circles + 1 pt outline, convert rectangle to curves and flare it, duplicate ×2, **text on a hidden path**, white text with black outline, resize group to 250 × 200 px, vector save + bitmap export |
| J/17 | HUNGRY logo | 200 × 200 px, "compressed format for a website" (choice of format) |
| O/N/17 | RockICT guitar | 3 pt red outline, text curved along the bottom of a shape, **single layer**, transparent background |
| J/18 | TTS balloons | **A4 (21 × 29.7 cm)**, body + neck combined, radial "light bloom", duplicate and recolour, **text on a curved path** in a script font, transparent bitmap |
| M/19 | 7-segment digits | 60 × 110 px, grey RGB 150,150,150 outline, a template reused for 10 images |
| J/19 | Medical monitor | Green 1 cm grid, rounded "3-D" buttons, metallic gradient, **transparent panels**, **each group saved separately** as a transparent bitmap, whole as SVG |
| O/N/19 | Harbour, Pearl | **Remove rubbish and a bin** (clone/heal); **crop to content**, transparent background, width 210 px |
| J/20 | Wi-Fi meter | Parts exported **each as SVG and transparent bitmap**, red–yellow–green gradient, bitmap at **600 px wide, not transparent** |
| M/21 | WorldMap, Global logo | **Recolour** land green and sea light blue (colour select / fill), land shown through a ring, left-to-right red gradient, bitmap **500 px high** with transparency |
| J/21 | Shield, Bolt | Gold and silver gradients, domed studs, **shadow** for depth, panel off-centre |
| O/N/21 | Lens, Cloud, Bolt | **Magnified circle** of a bitmap, transparent "light blooms", 500 px high bitmap; clouds with darker shading |
| M/22 | Heron logo | **10 cm × 10 cm SVG** and 200 × 200 px bitmap with a transparent inside, photo inside an ellipse, **each letter halfway through the ellipse's outline**, gradient-filled outlined text |
| J/22 | Balloon, Scene | **Extract** the balloon at **3000 × 2250 px** transparent, **repair the sky**, remove posts, fence and wires **without cropping**, **replace the sky** from another photo; then a vector balloon traced over it with gradients and a **pattern fill** |
| O/N/22 | VPlane | Accurate vector copy of a photo (trace over a template), designs, a ribbon streamer |
| M/23 | Spaceship, Flame, Rocket | Close copy using rulers and guides, combine images |
| J/23 | BasicWheel, NewWheel | Exact px sizes and hex colours, **spokes evenly round a hub** (rotated copies) |
| O/N/23 | Castle, Ocean, Sky | **3 layers each saved as its own image**, transparent cut-out, resized to fit, combined |
| J/24 | Cake | Gradients, contours for depth, **raised lettering**, candle flames, then a **slice cut out** (subtract) |
| O/N/24 | Night scene | Remove a figure and repair the sea, **greyscale**, remove the sky, black-to-blue gradient sky, **blue layer at 40 % opacity**, recolour the Moon, **halo**, stars and lights, a reflection |
| M/25 | Jigsaw | Piece based on an **80 mm square**, 4 fitted copies, then **cut a bitmap with the vector template** into 4 PNGs that fit |
| O/N/25 | Apple | 300 px square, RGB 180,0,0, blooms, **wireframe view**, bites (subtract), core, rotten |
| M/26 | Chip | Trace over Chip.png, **import ChipLeg.svg** as the legs, **evenly spaced**, **no bitmap elements in the SVG**, resized to 10 cm × 6 cm at 15° |
| J/26 | Atoms | RGB 255,0,0 → 166,0,0 gradient with blooms, **recolour** the same image twice, half size, nucleus of 6 + 6, a cloud at **50 % transparency** |

Two patterns stand out. **Most papers mix vector and bitmap work in one image** (Lens, Heron,
Night scene, Jigsaw, Balloon, the workbook's Rose Garden and poster). And **most graphics are made
to be animated next** ("used in the Task 2 animation"), so a graphic should move into Animation
mode as editable objects.

### 1.2 What OneEditor already has

The Animation mode (M13–M17a) already does most of the vector half, in `core/animation/`:

| Have it (Animation mode) | Requirement there |
|---|---|
| Rectangle (rounded), ellipse, star, polygon, line, pen (Bézier), brush (freehand) | AN3 |
| Properties with exact numbers; solid, linear and radial gradients of many stops; outlines solid/dashed/dotted; opacity | AN6 |
| Layers (add, rename, reorder, lock, hide, folders), group / ungroup, duplicate, front / back | AN7 |
| Rulers, guides, grid, snapping | AN2 |
| Trace bitmap (colours, detail, smoothing); select same fill / outline | AN5 |
| Picture crop and "make a colour see-through" (FFmpeg colorkey) | AN5 |
| Flip, skew, turn about a chosen point | AN23, AN25, AN27 |
| Union / Cut out / Intersect with holes (`polygon-clipping`) | AN24 |
| Text with bundled fonts, outline, split into letters, curved along an arc | AN4, AN26 |
| SVG export of a frame; PNG; transparent background | AN21, AN22 |
| Colour picker (the app's own), library of clip-art | V4, AN19 |
| Learn: format guide, compression comparison, file-size calculator, task checker | T1–T7 |

Missing entirely: **bitmap editing** (pixel layers, selections, brushes, retouching, adjustments,
filters, image and canvas size, colour depth), **cm / mm / in units with dpi**, arcs and spirals,
node types and node alignment, convert to curves, step-and-repeat, envelope and perspective,
pattern fills, shadow / glow / bevel, text on any path, text in a shape, text to curves, kerning
and spacing, SVG import as editable shapes, wireframe view, BMP / GIF / TIFF / PDF still export,
export of parts, HSL / CMYK in the picker, and the graphics theory pages.

## 2. Design decisions (proposed)

| # | Decision | Why | Rejected |
|---|---|---|---|
| D1 | **One Graphics mode** (a fifth tab: Video / Audio / Animation / Graphics) whose document holds **two kinds of layer: vector and pixel**, as Photoshop, Pixelmator and Affinity do | Most tasks mix both in one image (§1.1); the syllabus treats layers, transforms, crop and export as common to both | Two modes (Draw / Photo): every mixed task would need export and re-import between them |
| D2 | **A vector layer holds Animation mode's objects** (`AnimObject`, no keyframes), drawn by the same stage drawing and exported by the same SVG writer | Reuses ~6 400 lines that are tested and CI-checked; one look in both modes; **Send to Animation** becomes copying objects (most graphics are animated next) | A second vector model (two of everything to keep equal) |
| D3 | **Pixel layers are tiled** (256 × 256 RGBA tiles); all pixel maths is **pure TypeScript on typed arrays** in `core/graphics/pixels/`, run in a **Web Worker** | Known-answer unit tests, as for the audio DSP (MILESTONES §3.1); the window stays responsive on a 4128 × 2322 photo; undo stores only changed tiles | Canvas-only filters (`ctx.filter`): fast but not testable to the pixel and differ by GPU; WebGL: faster, harder to test, GPU-dependent on school laptops |
| D4 | **The document is measured in px with a dpi**; every size field accepts px, cm, mm, in or pt and shows the others | Papers give A4, 10 cm, 80 mm, 1 pt and px; the syllabus asks for resolution on screen and in print | px only (as Animation): cannot meet A4 / cm tasks or teach DPI |
| D5 | **Our own small encoders** for PNG (palette / grey / RGB / RGBA, 1–8 bit, dpi), BMP (1/4/8/24/32 bit), TIFF (none / LZW, dpi) and GIF (palette, 1-bit transparency); JPEG via the canvas (quality) with the dpi written in; **PDF by Electron's `printToPDF` of the SVG** at the page size (vector kept) | The tasks and theory need control of colour depth, palette and dpi, which FFmpeg's image writers and `canvas.toBlob` do not give; no new dependency for PDF | FFmpeg for stills (no dpi, awkward palettes); a PDF library (size, licence review) |
| D6 | **8 bits per channel** inside; colour depth is chosen on export (1, 4, 8, 24, 32 bit) and shown with its file size; "16 bits/channel" is explained in Learn, not edited in | All papers end in 8-bit formats; 16-bit doubles every buffer on laptops with 4–8 GB | A 16-bit pipeline (workbook Task 5 only names it) |
| D7 | **CMYK and "CMS" are taught, not printed**: the picker shows RGB, hex, HSL, HSB and CMYK together, the eyedropper picks from the image or anywhere on screen; Learn explains additive / subtractive colour and colour matching | No paper asks for a CMYK file; real colour management (ICC profiles) is a non-goal | CMYK documents and profiles |
| D8 | Retouching by **clone stamp and heal brush** (decided 2026-11-07) | Clone + heal do every removal in the papers (bin, posts, wires, figure, cables) and are what the books teach | A "Remove" brush that fills from the surroundings (content-aware: the largest single algorithm); generative / AI fill (offline, low-spec, and the exam wants the skill shown) |
| D9 | Native file **`.mveg`**: a zip (stored, not compressed) of `doc.json` + one lossless PNG per pixel layer and mask | One file to hand in or move; PNG keeps the pixels exact; JSON stays readable as `.mve` / `.mvea` are | JSON with base64 pixels (⅓ larger, slow to parse) |
| D10 | **Text to curves with `opentype.js`** (MIT, ~170 KB) reading the bundled fonts' files | The only way to get letter outlines as editable nodes; the bundled 26 fonts cover every paper (sans, serif, script, stencil) | Tracing rendered text (inexact); system fonts (their files are not always readable) |

## 3. Requirements

Moved into README §7a (2026-11-07), where every requirement of the app lives: G1–G14 (19.1),
GV1–GV8 (19.2), GB1–GB6 (19.3), GC1–GC2 (19.4), GT1–GT5 (19.5), GL1–GL3 and GN1–GN4.

## 4. Architecture

```
src/core/graphics/            pure TypeScript, unit-tested
  types.ts                    GraphicDoc { width, height (px), dpi, units, background, layers }
                              VectorLayer { kind:'vector', objects: AnimObject[] }   (D2)
                              PixelLayer  { kind:'pixel', tiles, x, y, mask?, blend, effects }
  document.ts, layers.ts      layer ops; merge / flatten; clipping
  units.ts                    px ↔ cm / mm / in / pt at a dpi
  transform.ts, envelope.ts,  vector transforms incl. envelope and perspective (subdivide, map)
  perspective.ts
  replicate.ts, nodes.ts      step and repeat; node types, align / distribute nodes, simplify, join
  shapes.ts                   arc, spiral, polyline outlines (beside core/animation/geometry.ts)
  text-path.ts, text-shape.ts text on a path; text in a shape; spacing and kerning
  outlines.ts                 text to curves (opentype.js over the bundled font files)
  svg-import.ts               SVG → objects (GV6)
  effects.ts                  shadow, glow, bevel, blur definitions (+ SVG filter writer)
  serialize.ts                .mveg read / write (zip of doc.json + PNG layers)
  pixels/                     tiles, selection masks, flood fill (wand, bucket), colour range,
                              adjustments (look-up tables), convolution (Gaussian, unsharp),
                              motion / zoom / twirl, warp, clone, heal, red-eye, resample,
                              quantise (median cut + Floyd–Steinberg), brush stamping
src/core/image/encode/        png.ts, bmp.ts, tiff.ts, gif.ts (palette, LZW), jpeg-dpi.ts (D5)
src/worker/pixels.ts          runs core/graphics/pixels off the page thread; transferable tiles
src/adapters/canvas/
  graphics-renderer.ts        composes layers: vector layers through the existing stage drawing,
                              pixel tiles as ImageBitmaps, blend modes (globalCompositeOperation),
                              a reduced copy below 50 % zoom ("approximate preview, exact export")
src/app/graphics/             mode actions by area (context.ts, document.ts, layers.ts, tools.ts,
                              selection.ts, adjust.ts, exporting.ts…), as app/animation/
src/ui/graphics/              Canvas, toolbar, Layers, Properties, option bar, dialogs on Dialog
src/main/                     PDF: printToPDF of the SVG in a hidden window at the page size
```

- **Undo** stays the app's one history: vector edits are document snapshots as in Animation;
  a pixel edit is a command holding the tiles it changed (before / after), so undoing a brush
  stroke on a 10-megapixel photo costs a few hundred KB, not 40 MB.
- **Tools** are one interface (`down / move / up / cursor / options`), registered in a table as
  effects and panels are, so a tool is one file (ARCHITECTURE §12 gets a row: "A graphics tool").
- **Exact numbers first** (as Animation): every tool's result can be typed in Properties.
- **New dependency**: `opentype.js` (MIT) only; `polygon-clipping` is already there.

## 5. Milestones (to become MILESTONES Phase 3)

Each closes with its tests, CI on the three platforms and the papers' steps listed done in the
app (the gate record in `docs/acceptance/M<n>.md`), as for M13–M17a.

| Milestone | Scope | Gate: done in the app |
|---|---|---|
| **M18 Graphics core** | The Graphics tab; G1 (incl. cm / dpi), vector layers of G2, G3 (no envelope), G4, G5, G6, G7, G8 (crop, trim, clip to shape), G12 (solid, gradient), G13; export SVG, PNG, JPG at a size and of a selection; `.mveg`; Send to Animation (GL3) | M/19 7-segment set; J/23 BasicWheel and NewWheel; J/26 Proton, Neutron, Electron, Orbit, CarbonStructure; J/17 HUNGRY; workbook Task 1 (but the shadow) |
| **M19 Vector toolkit** | GV1–GV8, G3 envelope and perspective, G4 Exclude / Combine / Join, G12 pattern, G14 effects, PDF export, export of each part | J/20 meter (all parts); J/21 shield and bolt; O/N/21 cloud and bolt; J/24 cake and slice; O/N/25 apple to old core (wireframe); M/23 rocket; M/26 chip with ChipLeg.svg; J/19 monitor; O/N/22 plane |
| **M20 Text** | GT1–GT5 | M/17 Woodlands; O/N/17 RockICT; J/18 balloons and TTS10; M/22 Heron (letters halfway through the ellipse); workbook Task 2; coursebook exam-style 1 and 2 |
| **M21 Bitmap core** | GB1, GB2, GB4, GB6, pixel layers in G2 (blend, merge, flatten, masks, clipping), paint bucket and gradient, the worker and tiled undo | O/N/19 pearl; M/21 world map recolour and Global logo; O/N/23 three layers; M/25 jigsaw cut of Tier.png; J/22 Balloon1 at 3000 × 2250; workbook Tasks 3.4–3.5 and 4 |
| **M22 Retouch and adjust** | GB3, GB5 (clone, heal, red-eye, brushes, filters, distort), G14 on pixel layers | O/N/19 harbour; J/22 Scene2–Scene4; O/N/24 night scene (all 8 steps); O/N/21 lens; workbook Tasks 3, 5–9 |
| **M23 Formats, theory and hardening** | G9, G10, G11 (BMP, GIF, TIFF, colour depth, dpi), GC1–GC2, GL1–GL2, GN1–GN4 measured on the pilot laptops | All 23 past-paper tasks and the 9 workbook tasks again on Windows 11 and macOS; release |

Estimated size, from M13–M17a: M18 and M19 are about one Animation milestone each (much is reuse),
M20 one, **M21 and M22 the largest** (a new engine), M23 one.

## 6. Risks

| Risk | Plan |
|---|---|
| Pixel speed and memory on low-spec laptops with 8–10 MP photos (GN1–GN2) | Tiles + worker from the first pixel commit; a performance spec with Ocean.jpg (as `animation-performance.spec.ts`), run on the weakest pilot laptop before M22 |
| Heal / remove quality on the papers' photos (posts and wires over sky, a figure on sand) | Build clone first; judge heal on Scene1 / Bay / Harbour early in M22, and tune it there |
| Magnetic lasso and colour range on hard edges (sky between leaves) | Colour range + feather + mask painting is the reliable route; magnetic lasso is a help, not the only way |
| Text to curves for system fonts | Bundled fonts always work; a system font whose file cannot be read is refused with a note |
| SVG import breadth (any file from the internet) | Support what the papers and our own export write; the rest becomes a picture with a note |
| Scope: ~70 requirements | Milestones are in the order the papers need them; each gate is real paper tasks, so stopping early still covers the most-asked ones (vector work is in 20 of the 23 sessions, bitmap work in 8) |

## 7. Decisions (the maintainer, 2026-11-07)

1. **One Graphics mode** with vector and pixel layers (D1).
2. **Clone and heal** for retouching; no Remove brush (D8).
3. **Branch `m18` off `dev`** once the pilot's 1.5.x settles; **each milestone shipped to the
   pilot** through the updater (1.6, 1.7, …).

## 8. Estimate (2026-11-07)

Measured from this repository's own history (commits without merges, lines in `src/` and `tests/`):

| Phase | Active days | Source lines added | Test lines added | Per active day (source) |
|---|---|---|---|---|
| 1: Video, Audio, Teaching (M0–M11, 43 requirements) | 7 (14–20 Oct) | 24 600 | 20 800 | ~3 500 |
| 2: Animation (M13–M16b, 20 requirements + workspace) | 6 (27 Oct – 4 Nov) | 15 600 | 13 100 | ~2 600 |
| M17a, extras, benchmarks | 4 (3–6 Nov) | 25 200 net | 12 500 | ~6 000 (much generated: sound effects, clip-art) |

Elapsed time was set less by building than by checks: v1.0's acceptance took a week (20 → 27
Oct), and M15's check was carried into M16 while the work went on.

At ~3 000 source lines (and ~2 500 test lines) per active day for new-engine work, faster where
Animation is reused:

| Milestone | Size (source lines) | Active days | Main uncertainty |
|---|---|---|---|
| M18 Graphics core | ~5 000 | 1.5–2 | little: mostly reuse |
| M19 Vector toolkit | ~7 000 | 2–2.5 | SVG import breadth; envelope on curves |
| M20 Text | ~4 000 | 1–1.5 | text on a path's side and spacing on every OS |
| M21 Bitmap core | ~11 000 | 3.5–4.5 | **speed and memory** on the weakest laptop (GN1–GN2) |
| M22 Retouch and adjust | ~8 000 | 2.5–3.5 | **heal quality** on the papers' photos |
| M23 Formats, theory, hardening | ~6 000 + 32 tasks checked | 3–4 | the full acceptance run (23 sessions + 9 workbook tasks) |
| **Total** | **~41 000** | **13.5–18** | |

Calendar, at the pace of the last three weeks, with each milestone's teacher check run while the
next one is built, ~20 % of the time going to the pilot's 1.5.x fixes, six releases (each about
half a day with CI and the Mac upload on this connection), and a final acceptance week as for
v1.0: **about 4 to 6 weeks**, so **mid to late December 2026**, starting once the 1.5.0 → 1.5.1
test update has been seen on Windows and a Mac.

| Week (from the start) | Expected |
|---|---|
| 1 | M18 released (1.6), M19 under way |
| 2 | M19 and M20 released (1.7, 1.8): every vector and text paper task can be done |
| 3 | M21 (1.9): photos, selections, layers with pixels |
| 4 | M22 (1.10): retouching and adjustments; every paper task can be done |
| 5–6 | M23 and the acceptance run on Windows 11 and macOS; v2.x release |

What would make it longer: M21 not meeting GN1–GN2 on the weakest laptop (the fix would be WebGL
for the slow filters, ~2–3 days more); heal not good enough on Scene1 / Bay (tuning, 1–2 days);
pilot problems that need fixes first; and the teacher's time for checks in the exam season.
