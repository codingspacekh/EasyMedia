// Cambridge International AS & A Level IT 9626 (2025–2027), Chapter 11: every syllabus point in
// its own words, where it is done in EasyMedia, and the app's tools under it (their `syllabus`
// labels). The teacher notes are made from this (scripts/guides.ts).

export interface SyllabusPoint {
  section: '11.1' | '11.2';
  group: string;
  point: string;
  /** Where in EasyMedia (mode ▸ place). */
  where: string;
  /** The `syllabus` labels of the effects and tools that teach it. */
  tools: readonly string[];
}

const EDIT_V = 'Editing a video clip for its application and audience';
const WHY_V = 'Why typical video editing features are used';
const EDIT_A = 'Editing an audio clip for its application and audience';
const WHY_A = 'How and why typical audio editing features are used';
const COMPRESS = 'The effects of different methods of compression';
const FORMATS = 'Advantages and disadvantages of export file formats';
const SAMPLING = 'Why file sizes depend on sampling rate and resolution';

const p = (
  section: SyllabusPoint['section'],
  group: string,
  point: string,
  where: string,
  tools: string[] = [],
): SyllabusPoint => ({ section, group, point, where, tools });

const v = (point: string, where: string, tools?: string[]) =>
  p('11.1', EDIT_V, point, where, tools);
const a = (point: string, where: string, tools?: string[]) =>
  p('11.2', EDIT_A, point, where, tools);
const whyV = (point: string, where: string) => p('11.1', WHY_V, point, where);
const whyA = (point: string, where: string) => p('11.2', WHY_A, point, where);
const WHY_BOX = 'the "Why use this?" box of the tool, and the glossary (Learn ▸ Glossary)';

export const SYLLABUS: readonly SyllabusPoint[] = [
  // ---- 11.1 Video editing ----
  v(
    'setting an aspect ratio',
    'Video ▸ the project settings chip (16:9 · 1920 × 1080 · 30 fps) at the top',
    ['11.1 setting an aspect ratio'],
  ),
  v(
    'trimming a video clip to remove unwanted footage',
    'Video ▸ drag a clip’s edges on the timeline, or its Clip tab ▸ Trim (Start point, End point)',
    ['11.1 trimming a video clip'],
  ),
  v(
    'splicing/joining together video clips',
    'Video ▸ timeline: add clips one after another; Split and Join',
    ['11.1 splicing / joining video clips'],
  ),
  v(
    'adding titles, subtitles and captions',
    'Video ▸ Title, Caption, Subtitle on the toolbar; the Text tab (font, looks, position, effects)',
    ['11.1 creating text-based slides', '11.1 adding captions', '11.1 adding subtitles'],
  ),
  v(
    'adding credits with appropriate source information',
    'Video ▸ Credits on the toolbar: who made it and where the clips, music and pictures came from',
    ['11.1 creating credits'],
  ),
  v(
    'using scrolling credits with appropriate blank lines',
    'Video ▸ Credits ▸ "Scroll up the screen"; blank lines between the parts',
    [],
  ),
  v(
    'ensuring readability of text',
    'Video ▸ Text tab ▸ Readability and effects (shadow, outline, box) and the contrast note',
    [],
  ),
  v(
    'adding fading effects',
    'Video ▸ a clip’s Effects tab ▸ Fade (in and out, to black or white); text fades in its Text tab ▸ Effects',
    ['11.1 adding fading effects'],
  ),
  v('adding pan and zoom effects', 'Video ▸ a clip’s Effects tab ▸ Pan & zoom', [
    '11.1 adding pan and zoom effects',
  ]),
  v(
    'adding transitions',
    'Video ▸ the next clip’s Effects tab ▸ Transition into this clip (33 kinds in five groups)',
    ['11.1 adding transitions', '11.1 transitions'],
  ),
  v(
    'extracting a still image from a video clip',
    'Video ▸ Snapshot on the toolbar (frame by frame, named, PNG / JPG / BMP / TIFF)',
    ['11.1 extracting a still image'],
  ),
  v(
    'resizing and cropping a still image to match a video’s aspect ratio',
    'Video ▸ media bin ▸ Resize & crop… on a picture',
    ['11.1 resizing and cropping a still image'],
  ),
  v(
    'inserting a still image',
    'Video ▸ Import a picture and add it to the timeline; its Duration',
    ['11.1 inserting a still image'],
  ),
  v('adding audio to a video clip', 'Video ▸ Add music (music and voiceover tracks)', [
    '11.1 adding audio to a video clip',
  ]),
  v(
    'editing audio within a video clip',
    'Video ▸ a clip’s Audio tab ▸ Clip sound (volume) and Separate sound; a music or voiceover clip: volume, fades, speed',
    ['11.1 editing audio within a video clip'],
  ),
  v('removing audio from a video clip', 'Video ▸ a clip’s Audio tab ▸ Clip sound ▸ Remove sound', [
    '11.1 removing audio from a video clip',
  ]),
  v('altering the speed of a video clip', 'Video ▸ a clip’s Clip tab ▸ Speed (0.25× to 4×)', [
    '11.1 altering the speed of a video clip',
  ]),
  v('using filters and colour correction', 'Video ▸ a clip’s Effects tab ▸ Filters & colour', [
    '11.1 filters',
    '11.1 colour correction',
    '11.1 using filters and colour correction',
  ]),
  v(
    'exporting a video clip in different file formats (including: MP4, AVI, MOV, WMV)',
    'Video ▸ Export: the format buttons',
    ['11.1 exporting · compressing to different resolutions'],
  ),
  v(
    'compressing a video to different resolutions to suit different media (including: DVD, internet, mobile devices)',
    'Video ▸ Export: the destination presets (Internet, mobile, DVD, Blu-ray) and Resolution',
    [],
  ),
  p(
    '11.1',
    COMPRESS,
    'how the different compression methods affect video quality',
    'Learn ▸ Formats & compression: the video comparison (lossless, MP4 high, smaller sizes) and the format guide',
  ),
  whyV('trimming and cropping a video clip', WHY_BOX),
  whyV('creating text-based slides', WHY_BOX),
  whyV('creating credits', WHY_BOX),
  whyV('adding captions and subtitles', WHY_BOX),
  whyV('adding fading effects', WHY_BOX),
  whyV('extracting a still image from a video clip', WHY_BOX),
  whyV('inserting a still image', WHY_BOX),
  whyV('editing audio within a video clip', WHY_BOX),
  whyV(
    'exporting a video clip in different file formats',
    'Video ▸ Export (pros and cons of the format) and Learn ▸ Format guide',
  ),
  whyV(
    'compressing a video to different resolutions',
    'Video ▸ Export (estimated size) and Learn ▸ what makes a video file bigger',
  ),
  p(
    '11.1',
    FORMATS,
    'advantages and disadvantages of export file formats (video)',
    'Video ▸ Export and Learn ▸ Format guide',
  ),

  // ---- 11.2 Audio editing ----
  a('importing new tracks', 'Audio ▸ Import audio, or Tracks ▸ Import audio as new track', [
    '11.2 importing new tracks · adding a track',
  ]),
  a(
    'adding a track to an existing audio clip',
    'Audio ▸ Tracks ▸ Add new mono / stereo track; Align; Mix and render',
    ['11.2 adding a track to an audio clip'],
  ),
  a(
    'normalising an audio clip, including removing any DC offset',
    'Audio ▸ Effect ▸ Normalise (and Amplify)',
    ['11.2 normalising, removing DC offset', '11.2 amplify'],
  ),
  a(
    'trimming an audio clip to remove unwanted material',
    'Audio ▸ drag a clip’s edges, Delete, or select a part and Trim to selection',
    ['11.2 trimming an audio clip'],
  ),
  a(
    'splicing/joining together two audio clips',
    'Audio ▸ Split, Join, move clips, Cut / Copy / Paste, Align end to end',
    ['11.2 splicing / joining audio clips'],
  ),
  a('fading in and fading out', 'Audio ▸ Effect ▸ Fade in / Fade out', ['11.2 fading in and out']),
  a('altering the clip speed', 'Audio ▸ Effect ▸ Change speed', ['11.2 altering clip speed']),
  a('changing the pitch', 'Audio ▸ Effect ▸ Change pitch', ['11.2 changing the pitch']),
  a('adding or adjusting delay/echo', 'Audio ▸ Effect ▸ Echo, Delay', ['11.2 delay / echo']),
  a('adding or adjusting reverberation', 'Audio ▸ Effect ▸ Reverb', ['11.2 reverberation']),
  a(
    'changing an audio clip from stereo to mono',
    'Audio ▸ Tracks ▸ Mix stereo down to mono; Export ▸ Mono',
    ['11.2 changing stereo to mono'],
  ),
  a(
    'applying equalisation, high and low pass filters',
    'Audio ▸ Effect ▸ Graphic EQ, High-pass filter, Low-pass filter',
    ['11.2 equalisation', '11.2 filters'],
  ),
  a('applying noise reduction', 'Audio ▸ Effect ▸ Noise reduction (Get noise profile first)', [
    '11.2 noise reduction',
  ]),
  a(
    'overdubbing an audio clip, including voiceover',
    'Audio ▸ Record (other tracks play while recording)',
    ['11.2 overdubbing, including voiceover'],
  ),
  a(
    'compressing an audio file to different sample rates to suit different media',
    'Audio ▸ Export: sample rate, bit rate, mono',
    ['11.2 exporting · sample rates'],
  ),
  a(
    'exporting an audio clip in different file formats, including: MP3, MP4a, WAV, AAC',
    'Audio ▸ Export: MP3, M4A, WAV, AAC, FLAC',
    [],
  ),
  whyA('trimming', WHY_BOX),
  whyA('splicing/joining together two audio clips', WHY_BOX),
  whyA('fading in and fading out', WHY_BOX),
  whyA('normalising audio', WHY_BOX),
  whyA('applying noise reduction', WHY_BOX),
  whyA('overdubbing an audio clip, including voiceover', WHY_BOX),
  whyA(
    'exporting an audio clip in different file formats',
    'Audio ▸ Export (pros and cons) and Learn ▸ Format guide',
  ),
  whyA(
    'compressing an audio file',
    'Audio ▸ Export (size compared with WAV) and Learn ▸ compression comparison',
  ),
  p(
    '11.2',
    FORMATS,
    'advantages and disadvantages of export file formats (audio)',
    'Audio ▸ Export and Learn ▸ Format guide',
  ),
  p(
    '11.2',
    SAMPLING,
    'describing sampling rate and sampling resolution',
    'Learn ▸ Sampling visualiser; Audio ▸ the side panel (Selected track)',
  ),
  p(
    '11.2',
    SAMPLING,
    'why file sizes depend on sampling rate and sampling resolution',
    'Learn ▸ Audio file-size calculator ("What if…"); Audio ▸ side panel "Why this size?"',
  ),
  p(
    '11.2',
    COMPRESS,
    'how the different compression methods affect the audio quality',
    'Learn ▸ Formats & compression: WAV, FLAC and MP3 at three bit rates, played side by side; Audio ▸ Effect ▸ Compressor (dynamic range)',
    ['11.2 compression · dynamic range'],
  ),
  p(
    '11.2',
    COMPRESS,
    'saving in files v containers',
    'Learn ▸ Media inspector ▸ "File vs container"',
  ),
  p(
    '11.2',
    COMPRESS,
    'lossy and lossless',
    'Learn ▸ Media inspector (codecs marked lossy / lossless / uncompressed) and the compression comparison',
  ),
];

/** Every tool label placed under a syllabus point. */
export const toolsFor = (points: readonly SyllabusPoint[]): Set<string> =>
  new Set(points.flatMap((p) => p.tools));
