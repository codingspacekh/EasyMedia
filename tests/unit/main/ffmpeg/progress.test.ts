import { describe, expect, it } from 'vitest';
import { createProgressParser } from '../../../../src/main/ffmpeg/progress.ts';

function collect(duration: number) {
  const seen: number[] = [];
  const parser = createProgressParser(duration, (r) => seen.push(r));
  return { seen, feed: parser };
}

describe('N12 progress from ffmpeg -progress pipe:1', () => {
  it('reports out_time as a share of the duration', () => {
    const { seen, feed } = collect(10);
    feed('frame=30\nout_time_us=2500000\nprogress=continue\n');
    expect(seen).toEqual([0.25]);
  });

  it('copes with a line split across two chunks', () => {
    const { seen, feed } = collect(10);
    feed('out_time_us=50');
    feed('00000\n');
    expect(seen).toEqual([0.5]);
  });

  it('never goes backwards and never passes 1 before the end', () => {
    const { seen, feed } = collect(10);
    feed('out_time_us=6000000\nout_time_us=4000000\nout_time_us=12000000\n');
    expect(seen).toEqual([0.6, 0.99]);
  });

  it('reports 1 when ffmpeg says progress=end', () => {
    const { seen, feed } = collect(10);
    feed('out_time_us=9000000\nprogress=end\n');
    expect(seen).toEqual([0.9, 1]);
  });

  it('ignores N/A times and unknown durations', () => {
    const { seen, feed } = collect(0);
    feed('out_time_us=N/A\nout_time_us=1000000\n');
    expect(seen).toEqual([]);
  });
});
