# Feature suggestions

Suggestions made on 2026-11-05, before the v1.5.0 pilot, after the 15 past 9626/04 papers were
done in the app (`acceptance/M17.md`) and the gaps they showed were built (`acceptance/M17a.md`).
Kept for reference: what was done, what waits for the pilot's feedback, and what was ruled out.

Each item says where the idea came from: **from the papers** or **from the trials** (evidence), or
**judgement** (a reasoned guess about the pilot).

## Before the pilot — done (M17a step 12, 2026-11-05)

| # | Suggestion | Why | Status |
|---|---|---|---|
| 1 | **Help ▸ Report a Problem…** — a log of errors, failed jobs, crashes and menu commands; the report (version, computer, what happened) saved as a text file for the teacher. Nothing sent anywhere | *Judgement:* the pilot is the first time students use the app without the maintainer there; the app kept no log, so "it didn't work" was all a teacher could pass on | ✅ Done (README P9) |
| 2 | **Exam file names** — *File ▸ Candidate Details…* (centre number, candidate number, name) once; every Save and Export box then suggests `<name>_<centre>_<candidate>` | *From the papers:* every paper asks for e.g. `Gas_ZZ999_9999`, `TTTVideo_ZZ999_9999`; a wrong name can cost marks | ✅ Done (README P8) |
| 3 | **Group opacity** — a see-through group faded as one picture, not each part, so overlaps are no darker | *From the trials:* open bug of the M/J/26 Gas task (the cloud needed a workaround) | ✅ Done |

## After the pilot, before v2.0 — decide with the teacher's feedback

| # | Suggestion | Why | Size |
|---|---|---|---|
| 4 | **Sound in animations** (✅ done 2026-11-06, README AN28) — a sound track on the animation timeline, so an animation's MP4 can have sound. Today: export, *Send to Video mode*, add the music there | *Judgement:* none of the 15 papers asked for it, but Adobe Animate (the coursebook's software) can do it, and a paper asking for "the animation with this sound" would need the clumsy route | Medium |
| 5 | **File ▸ Open Recent** | *Judgement:* in an exam students reopen the same work many times; it is missing now | Small |
| 6 | **A GIF frame-rate note** — exporting a 24 fps animation as GIF says it will play at 25 fps and offers 25 fps | *From the trials:* open limit (a GIF stores frame times in hundredths of a second; 24 fps plays about 4 % fast) | Small |
| 7 | **More past papers first** — run another batch (other years, Oct/Nov sessions) through the app as a student would, then decide what to build | *From the trials:* the first 15 papers found 8 missing features; this is the cheapest way to find the next gaps before students do | — |
| 8 | **Text drawn as shapes in animations** — letters drawn from the bundled font files as paths, so text is identical on Windows and macOS | *From CI (2026-11-05):* each OS's font engine smooths letter edges a little differently (same font, size and place; 25–27 dB in the text, 56–59 dB elsewhere). Only worth it if teachers notice | Large |

## Gaps a later paper might show (2026-11-06)

Suggested after both benchmarks (2017–2021 and 2022–2026, all three components) were done, by
checking every syllabus line (11.1, 11.2, 20.1) and the gaps the benchmarks left open. Every
syllabus line has a screen; these are ways a paper could word a task that the app does only
slowly, or not at all. The maintainer chose to build the small ones first; items 9–18 were done on 2026-11-06 (`acceptance/M17a.md`).

| # | Suggestion | Why | Size | Status |
|---|---|---|---|---|
| 9 | **Animation: play once and stop** (GIF and web page) | *Syllabus 20.1:* "looping or stopping animations"; *papers:* March 2019 "should then stop". GIFs and the web page always looped | Small | ✅ Done |
| 10 | **Animation: select the same colour** after *Trace bitmap* | *Papers:* March 2021 (1676 traced shapes) | Small | ✅ Done |
| 11 | **Animation: a font size typed in Properties grows from the centre** | *Papers:* most; x and y had to be keyed too | Small | ✗ Withdrawn: the workbook keys sizes at fixed x, y (WB Task 1.1); *Zoom in* grows words in place |
| 12 | **Animation: skew** | *Papers:* June 2021 shield "turned sideways" | Small | ✅ Done |
| 13 | **Animation: outline widths scale with a resized group** | *Papers:* June 2020 meter redrawn smaller | Small | ✅ Done |
| 14 | **Animation: crop a picture, make a colour see-through** | *Papers:* Nov 2019 pearl (a mask was the workaround) | Small | ✅ Done |
| 15 | **Video: add a clip at the playhead; the project's size from a clip** | *From the trials:* a new clip always went at the end; the size had to be typed | Small | ✅ Done |
| 16 | **Video: turn or flip a clip** | *Judgement:* phone footage filmed sideways | Small | ✅ Done |
| 17 | **Audio: 8-bit WAV** | *Syllabus 11.2:* sampling resolution; "8 kHz, 8-bit mono for a telephone" is a natural question | Small | ✅ Done |
| 18 | **Audio: Change tempo** (length changes, pitch kept) and **Reverse** | *Judgement:* Audacity effects the coursebooks show; "speed up the speech without it sounding squeaky" | Small | ✅ Done |
| 19 | **Animation: text along a curve** | *Papers:* June 2017, Nov 2017, June 2018, March 2021 (each letter placed by hand) | Medium | ✅ Done |
| 20 | **Animation: turn about a chosen point** (pivot) | *Papers:* June 2020 needle; clock hands, windmills, pendulums | Medium | ✅ Done |
| 21 | **Video: a picture or video over the video** (logo in a corner, picture-in-picture) | *Judgement:* "inserting a still image" worded as a logo over the video | Medium–large | ✅ Done |
| 22 | **Animation: gradients with three or more colours; a radial centre that moves** | *Papers:* June 2018, June 2020, June 2021 | Small–medium | ✅ Done |
| 23 | **Animation: export at another size, as AVI/MOV, or a range of frames** | *Papers:* March 2019, June 2019, June 2020 | Small–medium | ✅ Done |
| 24 | **Video: volume changes inside one music clip; sound effects that overlap** | *Judgement* and a benchmark note | Medium | ✅ Done |
| 25 | **Audio: a volume change across a selection; remove silences** | *Judgement* | Medium | ✅ Done |

Sound in animations (item 4) is also named by syllabus 20.1 ("secondary components: sound"); it was built with items 19–25 on 2026-11-06 (README AN28). Only item 8 (text drawn as shapes) is left of the feature list.

## Not recommended for now

- **3D, SWF, a browser version**: outside the syllabus, or already ruled out in the README (§2, §7, §11.4).
- **Paid code signing**: the earlier decision stands; the install guide's *Run anyway* / *Open Anyway* steps are enough for a pilot.

## Still open, not features

Known limits from the trials (none stopped a paper being finished): a 24 fps GIF plays 4 % fast
(item 6); SWF and 3D are not supported. Proof that the coursebook and the papers can be done
without anything missing still needs the teacher's re-run of the papers' steps (M17a exit gate)
and the full phase 2 acceptance run on both OSes (M17 item 1).
