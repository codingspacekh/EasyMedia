// M16 exit gate (AN17): the coursebook's Chapter 19 questions 1–22, and the theory parts of
// exam-style questions 1b and 2b, can be answered from Learn ▸ Animation and the glossary. Each test
// is a question; the text must hold the points a mark scheme looks for (as M11's test of Book A).
import { describe, expect, it } from 'vitest';
import { GLOSSARY } from '../../src/core/teaching/glossary.ts';
import {
  ANIMATION_TYPES,
  COMPONENTS,
  PRINCIPLES,
  learnText,
} from '../../src/core/teaching/animation.ts';

const meaning = (term: string) => {
  const entry = GLOSSARY.find((e) => e.term === term);
  if (!entry) throw new Error(`No glossary entry for ${term}`);
  return entry.meaning;
};
const type = (id: string) => ANIMATION_TYPES.find((t) => t.id === id)!;
const typeText = (id: string) => {
  const t = type(id);
  return [t.how, ...t.advantages, ...t.disadvantages].join(' ');
};
const principle = (id: string) => PRINCIPLES.find((p) => p.id === id)!.text.join(' ');
/** How many of the points the text makes. */
const points = (text: string, ...patterns: RegExp[]) => patterns.filter((p) => p.test(text)).length;

describe('Coursebook Chapter 19 questions 1–5 (types of animation)', () => {
  it('1 Describe cel animations.', () => {
    const text = `${meaning('Cel animation')} ${typeText('cel')}`;
    expect(
      points(
        text,
        /drawn/i,
        /separate (sheet|page|cel)/i,
        /photograph/i,
        /one (frame )?at a time/i,
      ),
    ).toBeGreaterThanOrEqual(3);
  });

  it('2 What is a time lapse animation?', () => {
    const text = meaning('Time lapse');
    expect(text).toMatch(/camera/i);
    expect(text).toMatch(/(set|regular|fixed) (time )?intervals?|every (minute|set)/i);
    expect(text).toMatch(/shown (one after another|in (order|sequence))/i);
  });

  it('3 How do you create a stop frame animation?', () => {
    const text = meaning('Stop motion animation');
    expect(text).toMatch(/photograph/i);
    expect(text).toMatch(/move[sd]? (it |them )?(a little|slightly)/i);
    expect(text).toMatch(/shown one after another|played in order/i);
  });

  it('4 Name the animation that involves drawing an image in a book, and then changing it.', () => {
    expect(meaning('Flip book animation')).toMatch(/each page/i);
    expect(type('flipbook').name).toMatch(/flip book/i);
  });

  it('5 What does CGI stand for?', () => {
    expect(meaning('CGI')).toMatch(/computer.generated imagery/i);
  });
});

describe('Coursebook Chapter 19 questions 6–10 (frames and the stage)', () => {
  it('6 What is a frame in animation?', () => {
    expect(meaning('Frame')).toMatch(/one (screen|picture|image|page)/i);
    expect(meaning('Frame')).toMatch(/one after (the )?other|in (quick )?succession|series/i);
  });

  it('7 Describe what a ratio of 4:3 means and when it is used.', () => {
    const text = meaning('Aspect ratio');
    expect(text).toMatch(/4 units wide (to|by) 3 (units )?high|4:3 .*width .* height/i);
    expect(text).toMatch(/old televisions?|standard/i);
  });

  it('8 Name two other common ratios and when they are used.', () => {
    const text = meaning('Aspect ratio');
    expect(
      points(text, /16:9[^.]*(television|TV|monitor)/i, /2\.35:1[^.]*film/i, /16:10[^.]*phone/i),
    ).toBeGreaterThanOrEqual(2);
  });

  it('9 Explain the purpose of rulers, grids and guides.', () => {
    expect(meaning('Ruler')).toMatch(/position|size/i);
    expect(meaning('Grid')).toMatch(/line .*up|align/i);
    expect(meaning('Guides')).toMatch(/drag/i);
    expect(meaning('Guides')).toMatch(/line .*up|align|position/i);
  });

  it('10 Explain the advantage(s) of using snapping.', () => {
    const text = meaning('Snapping');
    expect(text).toMatch(/align|lines? up/i);
    expect(text).toMatch(/exact|accurate|precise|quick/i);
  });
});

describe('Coursebook Chapter 19 questions 11–15 (vector objects, symbols, bitmaps)', () => {
  it('11 Describe vector graphics.', () => {
    const text = meaning('Vector graphic');
    expect(text).toMatch(/points|coordinates/i);
    expect(text).toMatch(/equations|calculat/i);
    expect(text).toMatch(/without (losing quality|pixelat)|not pixelate/i);
  });

  it('12 What is the difference between line and fill colours?', () => {
    const text = meaning('Stroke and fill');
    expect(text).toMatch(/(line|stroke)[^.]*outline/i);
    expect(text).toMatch(/fill[^.]*inside/i);
  });

  it('13 Which option do you select to rotate a shape or object?', () => {
    expect(meaning('Transform')).toMatch(/rotat/i);
  });

  it('14 Why do you have to change a shape to a symbol?', () => {
    const text = meaning('Symbol');
    expect(text).toMatch(/tween|animate/i);
    expect(text).toMatch(/one (item|object)|together|copies|instances/i);
  });

  it('15 Why can’t bitmap images be used in inbetweening?', () => {
    const text = meaning('Bitmap');
    expect(text).toMatch(/pixels/i);
    expect(text).toMatch(/not (made of|stored as) (points|coordinates)/i);
    expect(text).toMatch(/pixelate/i);
  });
});

describe('Coursebook Chapter 19 questions 16–18 (layers and frame rate)', () => {
  it('16 What is a layer?', () => {
    expect(meaning('Layer')).toMatch(/own timeline/i);
  });

  it('17 Why are layers used in animation?', () => {
    const text = meaning('Layer');
    expect(text).toMatch(/independent|separately/i);
    expect(text).toMatch(/in front|order/i);
  });

  it('18 What effect will increasing the frame rate have on an animation?', () => {
    const text = `${meaning('Frame rate')} ${principle('timings')}`;
    expect(text).toMatch(/smoother/i);
    expect(text).toMatch(/more frames/i);
    expect(text).toMatch(/not (one|a) second/i);
  });
});

describe('Coursebook Chapter 19 questions 19–22 (keyframes, tweens, masks)', () => {
  it('19 What is the difference between a frame and a keyframe?', () => {
    expect(meaning('Key frame')).toMatch(/change/i);
    expect(meaning('Key frame')).toMatch(/start or end of a tween/i);
    expect(principle('keyframes')).toMatch(/frame[^.]*(no change|does not change|stays)/i);
  });

  it('20 What is the difference between a motion tween and a shape tween?', () => {
    expect(meaning('Motion tween')).toMatch(/position|move/i);
    expect(meaning('Motion tween')).toMatch(/rotat/i);
    expect(meaning('Shape tween')).toMatch(/one shape (changes|turns) into another/i);
    expect(meaning('Shape tween')).toMatch(/morph/i);
  });

  it('21 Explain why inbetweening produces smoother animations than frame-by-frame animations.', () => {
    const text = `${meaning('Tween')} ${principle('tweening')}`;
    expect(text).toMatch(/computer (works out|calculates|generates)/i);
    expect(text).toMatch(/every frame/i);
    expect(text).toMatch(/small(, even)? (steps|changes)/i);
    expect(text).toMatch(/robotic|jerky/i);
  });

  it('22 Describe the purpose of a mask and give an example of how it can be used.', () => {
    const text = meaning('Mask');
    expect(text).toMatch(/only .*(seen|visible)|restricts? what (is|can be) seen/i);
    expect(text).toMatch(/for example|such as/i);
  });
});

describe('Coursebook exam-style questions, theory parts', () => {
  it('1b Differences and similarities between cel, stop motion and time-lapse animation. [3]', () => {
    const page = learnText();
    // Similar: all are a series of still pictures shown quickly one after another.
    expect(page).toMatch(/all (of them )?(are|show) a series of (still )?(pictures|images)/i);
    expect(typeText('cel')).toMatch(/drawn/i);
    expect(typeText('stopmotion')).toMatch(/real (objects|models)|physical/i);
    expect(typeText('timelapse')).toMatch(/automatically/i);
  });

  it('2b Describe what is meant by a frame and a keyframe. [2]', () => {
    expect(meaning('Frame')).toMatch(/one (screen|picture|image|page)/i);
    expect(meaning('Key frame')).toMatch(/change/i);
  });
});

describe('Learn ▸ Animation covers the 20.1 theory', () => {
  it('the types of animation each have how they are made, advantages and disadvantages', () => {
    expect(ANIMATION_TYPES.map((t) => t.id)).toEqual([
      'cel',
      'stopmotion',
      'timelapse',
      'flipbook',
      'cgi2d',
      'cgi3d',
    ]);
    for (const t of ANIMATION_TYPES) {
      expect(t.advantages.length, t.name).toBeGreaterThanOrEqual(2);
      expect(t.disadvantages.length, t.name).toBeGreaterThanOrEqual(2);
    }
  });

  it('the principles: frames, key frames, property key frames, timings, coordinates, tweening, morphing', () => {
    const text = PRINCIPLES.map((p) => `${p.title} ${p.text.join(' ')}`).join(' ');
    for (const word of [
      /frames/i,
      /key frames?/i,
      /property key ?frames?/i,
      /timing|frames per second/i,
      /coordinates/i,
      /tween/i,
      /morph/i,
    ])
      expect(text).toMatch(word);
  });

  it('the components (primary, secondary, others) and animation variables with avars', () => {
    const text = COMPONENTS.map((p) => `${p.title} ${p.text.join(' ')}`).join(' ');
    expect(text).toMatch(/primary/i);
    expect(text).toMatch(/secondary[^.]*(background|sound)/i);
    expect(text).toMatch(/avars?[^.]*hinge/i);
    expect(meaning('Avar')).toMatch(/hinge/i);
    expect(meaning('Primary variable')).toMatch(/main|foremost|focus/i);
    expect(meaning('Secondary variable')).toMatch(/background/i);
  });
});
