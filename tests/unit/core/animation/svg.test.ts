// M16 / AN5: an SVG picture's size, read from the file the way a browser sizes it in an <img>:
// width and height (px or real units), else the viewBox, else 300 × 150.
import { describe, expect, it } from 'vitest';
import { svgSize } from '../../../../src/core/animation/svg.ts';

describe('svgSize (AN5)', () => {
  it('AN5 reads width and height in px or without units', () => {
    expect(svgSize('<svg xmlns="http://www.w3.org/2000/svg" width="135" height="120px"/>')).toEqual(
      {
        width: 135,
        height: 120,
      },
    );
  });

  it('AN5 turns real units into px at 96 per inch', () => {
    expect(svgSize('<svg width="1in" height="2.54cm"></svg>')).toEqual({ width: 96, height: 96 });
    expect(svgSize('<svg width="72pt" height="25.4mm"></svg>')).toEqual({ width: 96, height: 96 });
  });

  it('AN5 uses the viewBox when the size is missing or in %, keeping its proportions', () => {
    expect(svgSize('<svg viewBox="0 0 200 100"></svg>')).toEqual({ width: 200, height: 100 });
    expect(svgSize('<svg width="100%" viewBox="0,0,40,30"></svg>')).toEqual({
      width: 40,
      height: 30,
    });
    expect(svgSize('<svg width="400" viewBox="0 0 200 100"></svg>')).toEqual({
      width: 400,
      height: 200,
    });
    expect(svgSize('<svg height="50" viewBox="0 0 200 100"></svg>')).toEqual({
      width: 100,
      height: 50,
    });
  });

  it('AN5 a file with no size at all is 300 × 150, as in a browser', () => {
    expect(
      svgSize("<?xml version='1.0'?>\n<!-- star -->\n<svg xmlns='http://www.w3.org/2000/svg'>"),
    ).toEqual({
      width: 300,
      height: 150,
    });
  });

  it('AN5 refuses a file that is not an SVG picture', () => {
    expect(() => svgSize('<html><body>hello</body></html>')).toThrow(/SVG/);
  });
});
