// AN17: the theory of syllabus 20.1 for Learn ▸ Animation — the types of animation with their
// advantages and disadvantages, the principles, the components and animation variables — written
// so the coursebook's Chapter 19 questions can be answered from them, and with where each idea is
// tried in EasyMedia. The frame-rate demonstration's numbers are worked out here too.

export interface AnimationType {
  id: 'cel' | 'stopmotion' | 'timelapse' | 'flipbook' | 'cgi2d' | 'cgi3d';
  name: string;
  /** How it is made. */
  how: string;
  advantages: string[];
  disadvantages: string[];
  /** Where it is tried in EasyMedia, if it is. */
  inApp?: string;
}

export const ANIMATION_TYPES: readonly AnimationType[] = [
  {
    id: 'cel',
    name: 'Cel animation',
    how: 'Every frame is drawn, usually by hand, on its own separate sheet (a cel); the outlines are drawn and then coloured in. Each cel is photographed one frame at a time and the photographs are shown quickly one after another. It was the first kind of animation.',
    advantages: [
      'Complete control over every frame, so any change at all can be drawn.',
      'A recognisable, hand-made style.',
    ],
    disadvantages: [
      'Very slow and costly: thousands of drawings for a few minutes.',
      'Hard to keep characters the same size and colour from drawing to drawing.',
    ],
    inApp: 'Animation ▸ a frame-by-frame layer: draw each keyframe, with onion skin.',
  },
  {
    id: 'stopmotion',
    name: 'Stop motion',
    how: 'Real objects or models (clay figures, toys, paper cut-outs) are photographed, moved a little, and photographed again, many times. The photographs are shown one after another so the objects seem to move by themselves.',
    advantages: [
      'Only a camera and the objects are needed; no drawing skill.',
      'Real materials and lighting give a solid, textured look.',
    ],
    disadvantages: [
      'Slow: every small movement needs another photograph (12 a second at least).',
      'A knocked model or a change of light spoils the run of photographs.',
    ],
    inApp: 'Animation ▸ Import frames… (a folder of photographs at a chosen rate).',
  },
  {
    id: 'timelapse',
    name: 'Time lapse',
    how: 'A camera stays in one place and automatically takes a photograph at set intervals, such as once a minute. Shown one after another, the photographs make something slow, like a plant growing or clouds crossing a city, happen in seconds.',
    advantages: [
      'Shows changes too slow to see, such as building work or a flower opening.',
      'Once set up the camera works by itself.',
    ],
    disadvantages: [
      'Takes hours or days to record, and the camera must not move.',
      'Nothing can be changed afterwards except which photographs are used.',
    ],
    inApp: 'Animation ▸ Import frames… with the camera’s photographs.',
  },
  {
    id: 'flipbook',
    name: 'Flip book animation',
    how: 'A picture is drawn on each page of a small book, changed a little from page to page. Flipping the pages quickly with a thumb makes the picture move.',
    advantages: [
      'Needs only paper and a pencil, so it is cheap and quick to try.',
      'Shows clearly how a series of frames makes movement.',
    ],
    disadvantages: [
      'Short and small: only as many frames as pages.',
      'Cannot be shared, played at a set speed or given sound.',
    ],
    inApp: 'Animation ▸ a frame-by-frame layer with Duplicate frame (each keyframe a page).',
  },
  {
    id: 'cgi2d',
    name: 'CGI in 2D',
    how: 'Computer-generated imagery drawn flat, on the x and y axes only, with no depth, such as most cartoons today. The computer works out the frames between key frames (tweening).',
    advantages: [
      'Much faster than drawing every frame: the computer does the in-between frames.',
      'Easy to change, reuse and resize, as the shapes are vectors.',
    ],
    disadvantages: [
      'Needs a computer, software and the skill to use it.',
      'Tweened movement can look mechanical unless it is eased and checked.',
    ],
    inApp: 'Animation mode: shapes, keyframes, tweens, paths, morphs and masks.',
  },
  {
    id: 'cgi3d',
    name: 'CGI in 3D',
    how: 'Computer-generated imagery with x, y and z axes: models built in 3D (as wire frames) are posed with avars, lit and drawn (rendered) by the computer, as in most films’ effects and games.',
    advantages: [
      'Realistic depth, lighting and camera moves.',
      'Models can be posed and reused in any scene.',
    ],
    disadvantages: [
      'Rendering needs powerful computers and a lot of time.',
      'Building and rigging models takes specialist skill.',
    ],
  },
];

/** A page of theory: a title and its paragraphs, and where it is tried in EasyMedia. */
export interface LearnTopic {
  id: string;
  title: string;
  text: string[];
  where?: string;
}

export const PRINCIPLES: readonly LearnTopic[] = [
  {
    id: 'frames',
    title: 'Frames',
    text: [
      'All animation is a series of still pictures shown quickly one after another, so the eye sees movement. Each picture is a frame.',
      'Cel, stop motion, time lapse and flip book animation are alike: all of them are a series of still pictures shown one after another. They differ in how the pictures are made — drawn by hand, photographed as real models are moved, or photographed automatically by a camera at set intervals.',
    ],
    where: 'Animation ▸ the timeline: one column per frame, numbered every 5.',
  },
  {
    id: 'keyframes',
    title: 'Key frames and property key frames',
    text: [
      'A key frame marks a frame where something changes: a new drawing, or the start or end of a tween. In an ordinary frame the picture stays as it was: there is no change.',
      'A property key frame fixes just one property of an object at a frame — its x, its opacity, its colour — so each property can change at its own time.',
    ],
    where:
      'Animation ▸ the timeline’s keyframe dots; Keyframe fixes the properties at the playhead.',
  },
  {
    id: 'timings',
    title: 'Timings and frame rate',
    text: [
      'A frame is not one second. Time is counted in frames per second (fps): at 10 fps, 200 frames last 20 seconds.',
      'A higher frame rate needs more frames for the same time, and each frame changes less, so the movement is smoother; a low frame rate looks jerky. Film uses 24 fps; stop motion often 12.',
    ],
    where: 'Animation ▸ the stage chip (fps); the frame-rate demonstration on this page.',
  },
  {
    id: 'coordinates',
    title: 'Coordinates',
    text: [
      'Every object has a position given by coordinates: x across from the left edge and y down from the top edge, in pixels, with (0, 0) at the top-left corner of the stage.',
    ],
    where: 'Animation ▸ the rulers and the Properties panel’s X and Y.',
  },
  {
    id: 'tweening',
    title: 'Inbetweening (tweening)',
    text: [
      'Drawing every frame by hand looks robotic or jerky unless every change is tiny, which takes a long time. In a tween only the start and end key frames are set and the computer works out every frame between them, in small, even steps, so the movement is smooth.',
      'A motion tween changes where an object is and how it is turned (and its size, colour and opacity). A shape tween changes one shape into another: this is morphing.',
    ],
    where:
      'Animation ▸ change a property with the playhead on a later frame; Properties ▸ Morph into….',
  },
  {
    id: 'paths',
    title: 'Paths',
    text: [
      'A motion path is a line the object follows during a tween, so it can move along a curve, such as a car on a road, instead of in a straight line.',
    ],
    where: 'Animation ▸ Properties ▸ Motion path.',
  },
  {
    id: 'layers',
    title: 'Layers and masks',
    text: [
      'Each layer has its own timeline, so the objects on it are animated independently; the top layer is in front. A mask layer’s shapes restrict what is seen of the layer beneath.',
    ],
    where: 'Animation ▸ the Layers panel; the Mask button.',
  },
];

export const COMPONENTS: readonly LearnTopic[] = [
  {
    id: 'primary',
    title: 'Primary components',
    text: [
      'The primary variables are the main focus of an animation: its graphic components, such as the main characters and the objects they use. They are what the animator changes most.',
    ],
  },
  {
    id: 'secondary',
    title: 'Secondary components',
    text: [
      'The secondary variables are not the focus but are still animated: the background and sound — water rippling behind the characters, trees moving in the wind, clothing swinging as a person walks.',
    ],
  },
  {
    id: 'other',
    title: 'Other components',
    text: [
      'An animation also has a stage (its size, colour and aspect ratio), text, buttons for the viewer, and its timing (the frame rate and length).',
    ],
  },
  {
    id: 'variables',
    title: 'Animation variables and avars',
    text: [
      'A variable is anything that can change. Animation variables control the position of an animated object, or of its parts.',
      'In 3D animation a wire-frame model has avars: hinges at its joints, each changed to pose that part — every joint of a finger can be bent separately.',
    ],
    where:
      'Animation ▸ Group: a car whose wheels turn as it drives, a face whose parts move; each part keeps its own keyframes.',
  },
];

/** All the text of the Learn ▸ Animation page (for searching and the acceptance test). */
export function learnText(): string {
  const topic = (t: LearnTopic) => [t.title, ...t.text, t.where ?? ''].join(' ');
  return [
    ...ANIMATION_TYPES.map((t) => [t.name, t.how, ...t.advantages, ...t.disadvantages].join(' ')),
    ...PRINCIPLES.map(topic),
    ...COMPONENTS.map(topic),
  ].join('\n');
}

// ---- the frame-rate demonstration ----

/** The rates shown side by side: the same motion at 5, 12 and 24 fps. */
export const DEMO_RATES = [5, 12, 24] as const;
/** The demonstration's ball crosses its box in this many seconds, then starts again. */
export const DEMO_SECONDS = 2;

/**
 * How far across (0–1) the ball is at a moment of the demonstration, at a frame rate: it moves
 * evenly but is only drawn again at each new frame, so a low rate jumps in fewer, bigger steps.
 */
export function demoPosition(fps: number, seconds: number): number {
  const t = ((seconds % DEMO_SECONDS) + DEMO_SECONDS) % DEMO_SECONDS;
  const frames = fps * DEMO_SECONDS;
  return Math.floor(t * fps) / frames;
}

/** How many different pictures the demonstration draws in one crossing at a frame rate. */
export const demoFrames = (fps: number): number => fps * DEMO_SECONDS;
