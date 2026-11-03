// The glossary of Learn mode (screens 21–22 Glossary button): the key words of both coursebooks,
// in their words where they define them, written so the exam-style questions can be answered.

export interface GlossaryEntry {
  term: string;
  meaning: string;
}

const MEDIA: GlossaryEntry[] = [
  {
    term: 'Amplify',
    meaning:
      'Make a sound louder (a positive number of decibels) or quieter (negative). Too much makes the loudest parts clip and distort.',
  },
  {
    term: 'Aspect ratio',
    meaning:
      'The ratio of the width of a screen, video frame or animation stage to its height. 4:3 is 4 units wide to 3 units high, called standard: old televisions used it, so it is rarely used now. 16:9 is used by television, computer monitors and laptops; 2.35:1 is widescreen for films; 16:10 suits most modern mobile phones. Shown at the wrong aspect ratio, a video gets black bars or looks stretched.',
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
      'One screen, picture or page of a video or animation: a series of frames shown quickly one after the other gives the illusion of movement. The frame rate is how many frames are shown each second (fps); 30 fps needs twice the data of 15 fps.',
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

/** Chapter 19 (animation, syllabus 20.1): the key words, so its questions can be answered. */
const ANIMATION: GlossaryEntry[] = [
  {
    term: 'Animation',
    meaning:
      'A series of still images played one after another quickly enough to look like movement.',
  },
  {
    term: 'Avar',
    meaning:
      'An animation variable: a hinge on a wire-frame (3D) model, such as a joint of a finger, that is turned to change the position of that part of the object.',
  },
  {
    term: 'Bitmap',
    meaning:
      'A picture stored as a grid of coloured pixels, such as a photograph. It is not made of points and equations as a vector graphic is, so its parts cannot be tweened separately, and it may pixelate when it is enlarged. Tracing turns it into vector shapes, losing some detail.',
  },
  {
    term: 'Cel animation',
    meaning:
      'Animation where every frame is drawn, usually by hand, on its own separate sheet (a cel), coloured in, then photographed one frame at a time and shown in order. Also written cell animation.',
  },
  {
    term: 'CGI',
    meaning:
      'Computer-generated imagery: any still or moving image made with a computer. 2D CGI is drawn on the x and y axes only (most cartoons); 3D CGI also has depth (the z axis), as in film effects.',
  },
  {
    term: 'Coordinates',
    meaning:
      'The position of an object on the stage: x pixels across from the left edge and y pixels down from the top, with (0, 0) at the top-left corner.',
  },
  {
    term: 'Flip book animation',
    meaning:
      'A different picture is drawn on each page of a book, changing a little each time; when the pages are flicked through quickly the picture seems to move.',
  },
  {
    term: 'Frame rate',
    meaning:
      'How many frames are shown each second (fps). A frame is not one second: at 10 fps, 200 frames last 20 seconds. A higher frame rate needs more frames for the same time but makes movement smoother; too low a rate looks jerky.',
  },
  {
    term: 'Grid',
    meaning:
      'Lines drawn across the background of the stage (not in the finished animation) to help line up and align objects; snapping can make objects jump to its lines.',
  },
  {
    term: 'Guides',
    meaning:
      'Lines dragged out of the rulers onto the stage to help position and line up objects; they are not part of the finished animation.',
  },
  {
    term: 'Key frame',
    meaning:
      'A frame on the timeline that marks a change in the animation: a new drawing, or the start or end of a tween. Ordinary frames between key frames show no change of their own. A property key frame fixes one property (such as x or opacity) at a frame.',
  },
  {
    term: 'Layer',
    meaning:
      'Part of an animation with its own timeline, so the objects on it are animated independently of the others (each leg of a stick person on its own layer). Layers also set the order: the top layer is in front.',
  },
  {
    term: 'Library',
    meaning:
      'The list of the symbols and imported pictures used in an animation, from which more copies (instances) can be placed.',
  },
  {
    term: 'Mask',
    meaning:
      'A layer whose shapes restrict what can be seen of the layer beneath: only the parts under the shapes are visible. For example, a moving circle as a spotlight that reveals words as it passes over them.',
  },
  {
    term: 'Morphing',
    meaning:
      'Another name for a shape tween: one shape gradually changes into another, such as a rain cloud into a sun.',
  },
  {
    term: 'Motion path',
    meaning:
      'A line drawn for an object to follow during a tween, so it can move along a curve, such as a car on a winding road.',
  },
  {
    term: 'Motion tween',
    meaning:
      'A tween that changes where an object is (its position) and how it is turned (rotation) — and in most software its size, colour and opacity — between two key frames; the computer fills in the frames between.',
  },
  {
    term: 'Object',
    meaning:
      'An image, or a combination of images, that is changed and moved as one item in an animation.',
  },
  {
    term: 'Onion skin',
    meaning:
      'Showing the drawings of the frames just before and after the current one faintly, so each new drawing in frame-by-frame animation can be changed by an even step.',
  },
  {
    term: 'Primary variable',
    meaning:
      'The main focus of an animation: its graphic components, such as the main characters, which the animator changes most.',
  },
  {
    term: 'Ruler',
    meaning:
      'A scale along the top and left of the stage that shows the position of items, and helps draw them at the correct size; guides are dragged out of it.',
  },
  {
    term: 'Secondary variable',
    meaning:
      'Parts of an animation that are animated but are not its focus: the background and sound, such as rippling water or trees moving in the wind.',
  },
  {
    term: 'Shape tween',
    meaning:
      'A tween in which one shape changes into another (morphing), such as a red circle into a blue square; the computer works out the shapes between.',
  },
  {
    term: 'Snapping',
    meaning:
      'Objects jump into line with the grid, guides or other objects when they come close, so they line up and align exactly and quickly without careful dragging.',
  },
  {
    term: 'Stage',
    meaning:
      'The area where the animation takes place, measured in pixels: only what is on the stage is in the animation. Its size, colour and aspect ratio are set first.',
  },
  {
    term: 'Stop motion animation',
    meaning:
      'Real objects or models are photographed, moved a little, and photographed again, many times; the photographs are then shown one after another so the objects seem to move.',
  },
  {
    term: 'Stroke and fill',
    meaning:
      'The stroke (line) colour is the outline of a shape; the fill colour is the inside of the shape. Each can be set separately, or left empty.',
  },
  {
    term: 'Symbol',
    meaning:
      'An object (or several grouped together) given a name and kept in the library, so it can be animated with a tween as one item and copied many times (instances); changing the symbol changes every copy.',
  },
  {
    term: 'Time lapse',
    meaning:
      'A camera stays still and automatically takes a photograph at set intervals, such as once a minute; the photographs are shown one after another so a slow change, such as a plant growing, happens in seconds.',
  },
  {
    term: 'Timeline',
    meaning:
      'The part of animation software that shows the frames in order from left to right, one row per layer, with the key frames and tweens, and controls the order the frames are played.',
  },
  {
    term: 'Tracing bitmap',
    meaning:
      'Turning a bitmap picture into vector shapes, one for each area of colour, so its parts can be changed and animated; some detail is lost.',
  },
  {
    term: 'Transform',
    meaning:
      'Changing an object’s size, rotation (orientation), skew or centre point, typed exactly or dragged; over the frames between two key frames a transform becomes a tween.',
  },
  {
    term: 'Tween',
    meaning:
      'Inbetweening: only the start and end key frames are set and the computer works out (generates) every frame between them in small, even steps, so the change is smooth rather than robotic or jerky, and quicker to make than drawing every frame.',
  },
  {
    term: 'Vector graphic',
    meaning:
      'A picture stored as points (coordinates) and equations that are used to calculate its lines, shapes and colours, so it can be resized without losing quality (it does not pixelate) and its parts can be changed and tweened.',
  },
];

/** Every key word, in alphabetical order. */
export const GLOSSARY: GlossaryEntry[] = [...MEDIA, ...ANIMATION].sort((a, b) =>
  a.term.localeCompare(b.term, 'en'),
);

/** The entries whose word or meaning contains the text (capitals ignored); all for no text. */
export function searchGlossary(text: string): GlossaryEntry[] {
  const q = text.trim().toLowerCase();
  if (!q) return GLOSSARY;
  return GLOSSARY.filter(
    (e) => e.term.toLowerCase().includes(q) || e.meaning.toLowerCase().includes(q),
  );
}
