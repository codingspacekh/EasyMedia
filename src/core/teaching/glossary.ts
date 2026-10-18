// The glossary of Learn mode (screens 21–22 Glossary button): the key words of both coursebooks,
// in their words where they define them, written so the exam-style questions can be answered.

export interface GlossaryEntry {
  term: string;
  meaning: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Amplify',
    meaning:
      'Make a sound louder (a positive number of decibels) or quieter (negative). Too much makes the loudest parts clip and distort.',
  },
  {
    term: 'Aspect ratio',
    meaning:
      'The ratio of the width of a screen or video frame to its height, such as 16:9 (widescreen, used by almost all screens today) or 4:3 (old television). A video shown at the wrong aspect ratio gets black bars or looks stretched.',
  },
  {
    term: 'Bit rate',
    meaning:
      'How much data each second of a sound or video uses, in kilobits or megabits per second (kbit/s, Mbit/s). A higher bit rate keeps more quality but makes a bigger file; MP3 is often 128 kbit/s.',
  },
  {
    term: 'Caption',
    meaning:
      'Text shown over the top of the video to give further information about what is shown, such as the name of a place or a person. Captions help viewers who are deaf or hard of hearing, and viewers who watch with the sound off or in a noisy place.',
  },
  {
    term: 'Codec',
    meaning:
      'Short for coder / decoder: the method (a program) used to compress a sound or video stream to store it and decompress it to play it, such as H.264, AAC or MP3. A player needs the right codec, or the file will not play.',
  },
  {
    term: 'Compressor (dynamic range)',
    meaning:
      'An effect that makes the loudest parts of a sound quieter and then lifts everything, so loud and quiet parts are closer together. It is different from file compression, which makes the file smaller.',
  },
  {
    term: 'Container',
    meaning:
      'A file format, such as MP4, MOV, AVI or WAV, that holds the compressed sound and video streams together with information about them. The codec inside decides whether the data is lossy or lossless.',
  },
  {
    term: 'Credits',
    meaning:
      'Text, usually at the end of a video and scrolling from bottom to top, that shows who made the video (producer, director, writer) and gives credit to the authors of any material used, for copyright reasons.',
  },
  {
    term: 'DC offset',
    meaning:
      'A fault from a poor recording device: the waveform sits above or below the centre (0) line instead of on it. It can cause clicks, distortion and lost volume; Normalise can remove it.',
  },
  {
    term: 'Echo',
    meaning:
      'A repeat of the sound after a short delay, each repeat quieter by the decay factor. Delay effects make several repeats that can come closer together (bouncing ball).',
  },
  {
    term: 'Equalisation (EQ)',
    meaning:
      'Making chosen frequencies louder or quieter: more bass (low), more treble (high), or a clearer voice. A high-pass filter keeps the high frequencies and cuts the low ones; a low-pass filter does the opposite.',
  },
  {
    term: 'Fade',
    meaning:
      'A gradual change from (fade in) or to (fade out) black, white or silence. Fading to black shows that time has passed or that the video is ending.',
  },
  {
    term: 'Frame',
    meaning:
      'A single image in a video file. The frame rate is how many frames are shown each second (fps); 30 fps needs twice the data of 15 fps.',
  },
  {
    term: 'Lossless compression',
    meaning:
      'Compression that does not lose any data, so the original can be rebuilt exactly (FLAC, PNG, FFV1). The disadvantage: the file is much larger than a lossy one, so it needs more storage and takes longer to download, upload or stream.',
  },
  {
    term: 'Lossy compression',
    meaning:
      'Compression that removes data the eye or ear hardly notices (MP3, AAC, H.264). The advantages: a much smaller file, which needs less storage, is quicker to upload, download and send, and streams with less bandwidth and data allowance. The data removed can never be put back.',
  },
  {
    term: 'Mono',
    meaning:
      'A sound clip with a single track (channel): every speaker plays the same sound. It needs half the data of stereo.',
  },
  {
    term: 'Noise reduction',
    meaning:
      'Removing constant background noise such as hiss, hum or a fan: first take a noise profile from a part with only the noise, then reduce that noise everywhere.',
  },
  {
    term: 'Normalise',
    meaning:
      'Make a sound as loud as it can be without clipping: the loudest peak is raised (or lowered) to a set level, such as −1 dB, and the rest follows. It can also remove any DC offset.',
  },
  {
    term: 'Overdubbing',
    meaning:
      'Recording a new track, such as a voiceover, while listening to the tracks already there, so that the new sound fits them in time.',
  },
  {
    term: 'Pan and zoom',
    meaning:
      'Moving across (pan) or into (zoom) a picture or clip, so a still image does not look frozen, or to draw attention to a detail.',
  },
  {
    term: 'Pitch',
    meaning:
      'How high or low a sound is. Changing the pitch moves it to a higher or lower key without changing its length; changing the speed changes both.',
  },
  {
    term: 'Resolution (video)',
    meaning:
      'The number of pixels across and down in each frame: SD 720 × 480 (345 600 pixels), HD 1920 × 1080 (2 073 600), 4K 3840 × 2160 (8 294 400). More pixels give a sharper picture but a bigger file.',
  },
  {
    term: 'Reverb',
    meaning:
      'Reverberation: many fast reflections that make a sound seem to be played in a room or a hall. A little makes a voice fuller.',
  },
  {
    term: 'Sample rate',
    meaning:
      'The number of times sound is sampled (measured) each second, in hertz (Hz): 44 100 Hz (44.1 kHz) means 44 100 samples a second, as on a CD. A higher sample rate represents the sound more accurately, but stores more samples, so it makes a bigger file: doubling the sample rate doubles the file size.',
  },
  {
    term: 'Sample resolution',
    meaning:
      'The number of bits used to represent each sound sample (bit depth). 16-bit gives 65 536 levels; more bits record the volume more accurately but make a bigger file.',
  },
  {
    term: 'Splicing',
    meaning: 'Joining two clips together, one straight after the other, to make one clip.',
  },
  {
    term: 'Stereo',
    meaning:
      'A sound clip with more than one track (usually two: left and right), so different speakers can play different sounds and music has a sense of space.',
  },
  {
    term: 'Subtitles',
    meaning:
      'A text version of what is being said, usually at the bottom of the video. They help viewers who are deaf, and can show the speech in a different language.',
  },
  {
    term: 'Transition',
    meaning:
      'How one clip changes into the next: a plain cut, a dissolve, a wipe, a fade. Too many different transitions distract the audience.',
  },
  {
    term: 'Trimming',
    meaning:
      'Cutting off the start or end of a clip to remove unwanted footage (or sound), so the clip shows only what is needed and is the right length.',
  },
  {
    term: 'Voiceover',
    meaning:
      'A voice that explains or tells a story over the video or music (narration), recorded separately.',
  },
];

/** The entries whose word or meaning contains the text (capitals ignored); all for no text. */
export function searchGlossary(text: string): GlossaryEntry[] {
  const q = text.trim().toLowerCase();
  if (!q) return GLOSSARY;
  return GLOSSARY.filter(
    (e) => e.term.toLowerCase().includes(q) || e.meaning.toLowerCase().includes(q),
  );
}
