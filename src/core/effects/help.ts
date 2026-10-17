// "Why use this?" (T5) for the tools that are not registry effects, in the syllabus's words.
export const WHY = {
  fade: 'Fading from black gently opens a scene; fading to black closes it and shows that time has passed or that the video is ending. Fading to white feels bright, like a memory.',
  panZoom:
    'Pan and zoom moves across or into a picture so a still image does not look frozen. It also removes unwanted parts at the edges and draws attention to an important detail.',
  filters:
    'Filters change the look of a clip: correct colours that are wrong, make clips match, or create a mood — black and white for the past, a cyan tone for cold, blur to hide details.',
  snapshot:
    'A still holds an important moment on screen, can be a background for captions or credits, or can be edited in an image editor and put back into the video.',
  export:
    'Not every device plays every format, so choose the one the audience will use: MP4 for the web and phones, WMV for Windows, MPG for a DVD player. A smaller size and lossy compression make the file quick to send or stream; lossless keeps a perfect master copy that is much bigger.',
  audio:
    'Sound gets an emotional response from the viewer: music sets the mood, a voiceover (narration) explains what is happening, and sound effects emphasise the action. Lowering the music under the voice keeps the words clear.',
  silence:
    'Silence gives a pause: room between two pieces of music, before a voiceover starts, or to replace a sudden noise without changing the timing of what comes after it.',
  audioExport:
    'Export makes a file that plays on other devices; the project itself only opens in EasyMedia. A lossy format (MP3, AAC) makes a small file for streaming, phones and email; a lossless one (WAV, FLAC) keeps the sound exactly. A lower sample rate, bit rate or mono makes the file smaller but loses quality.',
  transition:
    'A transition decides how one clip changes into the next. A plain cut is quick; dissolves and fades are smoother. Too many different transitions distract the audience.',
} as const;
