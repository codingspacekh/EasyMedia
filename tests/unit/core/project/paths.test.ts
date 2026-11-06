import { describe, expect, it } from 'vitest';
import {
  cleanFileName,
  fromProjectPath,
  madePicturePath,
  namedPath,
  toProjectPath,
  withExtension,
} from '../../../../src/core/project/paths.ts';

describe('X1 media paths are stored relative to the project file', () => {
  describe('toProjectPath', () => {
    it.each([
      ['/Users/t/proj', '/Users/t/proj/media/a.mp4', 'media/a.mp4'],
      ['/Users/t/proj', '/Users/t/clips/a.mp4', '../clips/a.mp4'],
      ['/Users/t/proj/', '/Users/t/proj/a.mp4', 'a.mp4'],
      ['C:\\Users\\s\\proj', 'C:\\Users\\s\\media\\a.mp4', '../media/a.mp4'],
      ['c:\\Users\\s\\proj', 'C:\\Users\\s\\proj\\a.mp4', 'a.mp4'],
    ])('%s + %s → %s', (dir, file, expected) => {
      expect(toProjectPath(dir, file)).toBe(expected);
    });

    it('keeps an absolute path (with "/") when the file is on another drive', () => {
      expect(toProjectPath('C:\\Users\\s\\proj', 'D:\\clips\\a.mp4')).toBe('D:/clips/a.mp4');
    });
  });

  describe('fromProjectPath', () => {
    it.each([
      ['/Users/t/proj', 'media/a.mp4', '/Users/t/proj/media/a.mp4'],
      ['/Users/t/proj', '../clips/a.mp4', '/Users/t/clips/a.mp4'],
      ['C:\\Users\\s\\proj', '../media/a.mp4', 'C:/Users/s/media/a.mp4'],
      ['C:\\Users\\s\\proj', 'D:/clips/a.mp4', 'D:/clips/a.mp4'],
      ['/Users/t/proj', '/Volumes/USB/a.mp4', '/Volumes/USB/a.mp4'],
    ])('%s + %s → %s', (dir, stored, expected) => {
      expect(fromProjectPath(dir, stored)).toBe(expected);
    });
  });

  it('a project folder moved to another computer still finds its media', () => {
    const stored = toProjectPath(
      'C:\\Users\\student\\IT\\Task11d',
      'C:\\Users\\student\\IT\\Task11d\\media\\Lake.mp4',
    );
    expect(fromProjectPath('/Users/teacher/Marking/Task11d', stored)).toBe(
      '/Users/teacher/Marking/Task11d/media/Lake.mp4',
    );
  });
});

describe('V11, V18 a new picture named by the student, beside the original', () => {
  it("takes the original's folder and kind of file (m25credits.png → credits.png)", () => {
    expect(namedPath('/m/m25credits.png', 'credits')).toBe('/m/credits.png');
    expect(namedPath('C:\\m\\j26bg.png', 'bg')).toBe('C:\\m\\bg.png');
  });

  it('a name typed with its own extension keeps only one', () => {
    expect(namedPath('/m/j26bg.png', 'bg.png')).toBe('/m/bg.png');
  });

  it('characters no file name may have become "-"; spaces round it go', () => {
    expect(cleanFileName('  a/b:c*d?  ')).toBe('a-b-c-d-');
    expect(cleanFileName('   ')).toBe('');
  });
});

describe('AN5 a picture made see-through is a PNG beside the original', () => {
  it('takes the .png ending (pearl.jpg → pearl.png), numbered or named as the other new pictures', () => {
    expect(withExtension('/m/pearl.jpg', '.png')).toBe('/m/pearl.png');
    expect(withExtension('C:\\m\\shell.photo.JPG', '.png')).toBe('C:\\m\\shell.photo.png');
    expect(withExtension('/m.d/noext', '.png')).toBe('/m.d/noext.png');
    expect(madePicturePath(withExtension('/m/pearl.jpg', '.png'), undefined, 0)).toBe(
      '/m/pearl1.png',
    );
    expect(madePicturePath(withExtension('/m/pearl.jpg', '.png'), 'cut out', 1)).toBe(
      '/m/cut out2.png',
    );
  });
});
