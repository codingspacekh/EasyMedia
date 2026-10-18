// "Why use this?" (T5) for the tools that are not registry effects, in the syllabus's words.
export const WHY = {
  // ---- Video mode ----
  aspectRatio:
    'The aspect ratio is the ratio of the width of each frame to its height. 16:9 is used by almost all screens today. If a 4:3 video is shown on a 16:9 screen without black bars, it is stretched and looks distorted, so set it for the screen the audience will use.',
  trim: 'Trimming removes unwanted footage from the start or end of a clip, so the video shows only what the audience needs and is the length the task asks for.',
  split:
    'Splitting cuts a clip in two at the playhead, so a part in the middle can be removed or something can be put between the parts. Joining (splicing) puts clips back together into one.',
  remove:
    'Deleting takes away a clip the video does not need. What comes after it moves up, so no gap is left.',
  duration:
    'A still image, title or caption has no length of its own: its duration decides how long the audience sees it. Long enough to read, short enough to keep their attention.',
  speed:
    'Speeding a clip up shows a long event in a short time (time-lapse); slowing it down shows detail in fast movement (slow motion). The clip becomes shorter or longer.',
  clipSound:
    'Removing a clip’s own sound takes away wind, traffic or talking the audience should not hear, so music or a voiceover can be heard clearly. Lowering its volume keeps a little background sound.',
  separateSound:
    'Separating the sound puts it on its own track, so it can be moved, trimmed or deleted without changing the picture — for example to keep the sound playing over the next clip.',
  title:
    'A text slide (title) introduces the video or a new part of it, so the audience knows what they are about to watch.',
  caption:
    'Captions show words on top of the video: they name a place or a person, and they help viewers who are deaf or hard of hearing, or who watch with the sound off.',
  subtitle:
    'Subtitles show what is being said, at the bottom of the picture. They help viewers who are deaf or hard of hearing, who speak another language, or who watch with the sound off.',
  credits:
    'Credits name the people who made the video and the sources of the clips, music and pictures that were used. Scrolling credits need blank lines so each part can be read.',
  resizeCrop:
    'Resizing and cropping a still image makes it match the video’s aspect ratio, so it fills the frame without black bars or looking stretched. Cropping also removes unwanted parts of the picture.',
  fade: 'Fading from black gently opens a scene; fading to black closes it and shows that time has passed or that the video is ending. Fading to white feels bright, like a memory.',
  panZoom:
    'Pan and zoom moves across or into a picture so a still image does not look frozen. It also removes unwanted parts at the edges and draws attention to an important detail.',
  filters:
    'Filters change the look of a clip: correct colours that are wrong, make clips match, or create a mood — black and white for the past, a cyan tone for cold, blur to hide details.',
  transition:
    'A transition decides how one clip changes into the next. A plain cut is quick; dissolves and fades are smoother. Too many different transitions distract the audience.',
  snapshot:
    'A still holds an important moment on screen, can be a background for captions or credits, or can be edited in an image editor and put back into the video.',
  audio:
    'Sound gets an emotional response from the viewer: music sets the mood, a voiceover (narration) explains what is happening, and sound effects emphasise the action. Lowering the music under the voice keeps the words clear.',
  export:
    'Not every device plays every format, so choose the one the audience will use: MP4 for the web and phones, WMV for Windows, MPG for a DVD player. A smaller size and lossy compression make the file quick to send or stream; lossless keeps a perfect master copy that is much bigger.',
  // ---- Audio mode ----
  cutCopyPaste:
    'Cut removes the selected sound and keeps it to paste somewhere else; Copy keeps a copy without removing it; Paste puts it in at the cursor. Together they move or repeat a part of a clip.',
  trimAudio:
    'Trimming removes unwanted material: Trim to selection keeps only the selected sound, so silence, coughs or extra music at the start and end are gone.',
  silence:
    'Silence gives a pause: room between two pieces of music, before a voiceover starts, or to replace a sudden noise without changing the timing of what comes after it.',
  addTrack:
    'Each sound on its own track — music, a voiceover, sound effects — can be moved, trimmed and made louder or quieter on its own, then mixed together.',
  moveTrack:
    'Moving a track up or down changes only the order they are shown in, so the tracks that belong together can be seen and selected together. It does not change the sound.',
  align:
    'Aligning places tracks exactly in time: end to end splices two clips into one after the other with no gap; start to cursor or zero lines a sound up with a moment in another track.',
  mix: 'Mix and render combines the selected tracks into one, exactly as they sound together, so the result can be edited as one clip or exported.',
  mono: 'Mono has one channel, played the same through every speaker. It halves the file size, and suits speech, phone calls and a single speaker; stereo gives music a sense of space.',
  removeTrack:
    'Removing a track takes away a sound that is not needed — for example the original tracks after they have been mixed and rendered into one.',
  recording:
    'Overdubbing records a new track — such as a voiceover — while the other tracks play, so the narration fits the music and the moments it talks about.',
  audioExport:
    'Export makes a file that plays on other devices; the project itself only opens in EasyMedia. A lossy format (MP3, AAC) makes a small file for streaming, phones and email; a lossless one (WAV, FLAC) keeps the sound exactly. A lower sample rate, bit rate or mono makes the file smaller but loses quality.',
} as const;

export type ToolId = keyof typeof WHY;

export interface Tool {
  id: ToolId;
  label: string;
  /** The syllabus point, in its words (11.1 video, 11.2 audio). */
  syllabus: string;
  why: string;
}

const tool = (id: ToolId, label: string, syllabus: string): Tool => ({
  id,
  label,
  syllabus,
  why: WHY[id],
});

/** Every editing tool that is not a registry effect, with its syllabus point and why (T5). */
export const TOOLS: Tool[] = [
  tool('aspectRatio', 'Aspect ratio', '11.1 setting an aspect ratio'),
  tool('trim', 'Trim', '11.1 trimming a video clip'),
  tool('split', 'Split and join', '11.1 splicing / joining video clips'),
  tool('remove', 'Delete', '11.1 trimming a video clip'),
  tool('duration', 'Duration', '11.1 inserting a still image'),
  tool('speed', 'Speed', '11.1 altering the speed of a video clip'),
  tool('clipSound', 'Clip sound', '11.1 removing audio from a video clip'),
  tool('separateSound', 'Separate sound', '11.1 editing audio within a video clip'),
  tool('title', 'Title', '11.1 creating text-based slides'),
  tool('caption', 'Caption', '11.1 adding captions'),
  tool('subtitle', 'Subtitles', '11.1 adding subtitles'),
  tool('credits', 'Credits', '11.1 creating credits'),
  tool('resizeCrop', 'Resize & crop', '11.1 resizing and cropping a still image'),
  tool('fade', 'Fade', '11.1 adding fading effects'),
  tool('panZoom', 'Pan & zoom', '11.1 adding pan and zoom effects'),
  tool('filters', 'Filters & colour', '11.1 using filters and colour correction'),
  tool('transition', 'Transition', '11.1 adding transitions'),
  tool('snapshot', 'Snapshot', '11.1 extracting a still image'),
  tool('audio', 'Music & voiceover', '11.1 adding audio to a video clip'),
  tool('export', 'Export video', '11.1 exporting · compressing to different resolutions'),
  tool('cutCopyPaste', 'Cut, copy & paste', '11.2 splicing / joining audio clips'),
  tool('trimAudio', 'Trim to selection', '11.2 trimming an audio clip'),
  tool('silence', 'Insert silence', '11.2 trimming an audio clip'),
  tool('addTrack', 'New track', '11.2 importing new tracks · adding a track'),
  tool('moveTrack', 'Move track', '11.2 adding a track to an audio clip'),
  tool('align', 'Align', '11.2 splicing / joining audio clips'),
  tool('mix', 'Mix and render', '11.2 adding a track to an audio clip'),
  tool('mono', 'Stereo to mono', '11.2 changing stereo to mono'),
  tool('removeTrack', 'Remove track', '11.2 adding a track to an audio clip'),
  tool('recording', 'Record', '11.2 overdubbing, including voiceover'),
  tool('audioExport', 'Export audio', '11.2 exporting · sample rates'),
];

export function toolById(id: ToolId): Tool {
  return TOOLS.find((t) => t.id === id)!;
}

/** A toolbar button's or menu item's tooltip: what it does, then why it is used (T5). */
export const withWhy = (tip: string, id: ToolId): string => `${tip}\n\nWhy? ${WHY[id]}`;
