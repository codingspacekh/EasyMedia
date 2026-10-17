import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import EffectParams from '../../../src/ui/EffectParams.svelte';
import type { EffectDef } from '../../../src/core/effects/types.ts';

const echoLike: EffectDef = {
  id: 'test.two',
  label: 'Two numbers',
  syllabus: '11.1 test',
  why: 'A made-up effect with two settings, used to check that the settings are generated.',
  params: {
    delay: { label: 'Delay time', unit: 's', min: 0.01, max: 5, step: 0.01, default: 0.5 },
    decay: { label: 'Decay factor', min: 0, max: 1, step: 0.05, default: 0.5 },
  },
  render: () => '',
  preview: () => 'none()',
};

describe('settings generated from an effect schema (P7)', () => {
  it('a schema with 2 numbers gives 2 fields with their units and limits', () => {
    render(EffectParams, {
      props: { def: echoLike, params: { delay: 0.5, decay: 0.5 }, onchange: () => null },
    });
    const delay = screen.getByLabelText('Delay time') as HTMLInputElement;
    const decay = screen.getByLabelText('Decay factor') as HTMLInputElement;
    expect([delay.min, delay.max, delay.step, delay.value]).toEqual(['0.01', '5', '0.01', '0.5']);
    expect([decay.min, decay.max]).toEqual(['0', '1']);
    expect(screen.getByText('s')).toBeTruthy();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });

  it('reports the new settings, and shows a problem it is told about', async () => {
    const onchange = vi.fn(() => 'Delay time must be between 0.01 and 5.');
    render(EffectParams, {
      props: { def: echoLike, params: { delay: 0.5, decay: 0.5 }, onchange },
    });
    await fireEvent.change(screen.getByLabelText('Delay time'), { target: { value: '9' } });
    expect(onchange).toHaveBeenCalledWith({ delay: 9, decay: 0.5 });
    expect(screen.getByRole('alert').textContent).toMatch(/between 0.01 and 5/);
  });

  const withChoices: EffectDef = {
    ...echoLike,
    params: {
      key: {
        label: 'From key',
        min: 0,
        max: 3,
        step: 1,
        default: 0,
        choices: ['C', 'D', 'E', 'F'],
      },
      direction: {
        label: 'Direction',
        min: 0,
        max: 1,
        step: 1,
        default: 0,
        choices: ['Up', 'Down'],
      },
    },
  };

  it('more than three choices give a drop-down; it reports the position of the choice', async () => {
    const onchange = vi.fn(() => null);
    render(EffectParams, {
      props: { def: withChoices, params: { key: 2, direction: 0 }, onchange },
    });
    const key = screen.getByLabelText('From key') as HTMLSelectElement;
    expect([...key.options].map((o) => o.text)).toEqual(['C', 'D', 'E', 'F']);
    expect(key.value).toBe('2');
    await fireEvent.change(key, { target: { value: '3' } });
    expect(onchange).toHaveBeenCalledWith({ key: 3, direction: 0 });
  });

  it('up to three choices give buttons, with the chosen one pressed', async () => {
    const onchange = vi.fn(() => null);
    render(EffectParams, {
      props: { def: withChoices, params: { key: 0, direction: 0 }, onchange },
    });
    const group = screen.getByRole('group', { name: 'Direction' });
    const up = screen.getByRole('button', { name: 'Up' });
    expect(group.contains(up)).toBe(true);
    expect(up.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Down' }).getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(screen.getByRole('button', { name: 'Down' }));
    expect(onchange).toHaveBeenCalledWith({ key: 0, direction: 1 });
  });

  const eqLike: EffectDef = {
    ...echoLike,
    params: {
      preset: { label: 'Preset', min: 0, max: 1, step: 1, default: 0, choices: ['Custom', 'Flat'] },
      low: { label: '31 Hz', unit: 'dB', min: -20, max: 20, step: 0.5, default: 0, band: true },
      mid: { label: '1 kHz', unit: 'dB', min: -20, max: 20, step: 0.5, default: 0, band: true },
      high: { label: '16 kHz', unit: 'dB', min: -20, max: 20, step: 0.5, default: 0, band: true },
    },
  };

  it('EQ bands are sliders side by side, each showing its value; moving one reports it', async () => {
    const onchange = vi.fn(() => null);
    render(EffectParams, {
      props: { def: eqLike, params: { preset: 1, low: 0, mid: 4, high: -2 }, onchange },
    });
    const sliders = screen.getAllByRole('slider') as HTMLInputElement[];
    expect(sliders.map((s) => s.getAttribute('aria-label'))).toEqual(['31 Hz', '1 kHz', '16 kHz']);
    expect(sliders.map((s) => s.value)).toEqual(['0', '4', '-2']);
    expect([sliders[0]!.min, sliders[0]!.max, sliders[0]!.step]).toEqual(['-20', '20', '0.5']);
    expect(screen.getByText('+4')).toBeTruthy();
    expect(screen.getByText('−2')).toBeTruthy();
    expect(screen.getByRole('group', { name: /bands/i }).contains(sliders[0]!)).toBe(true);
    await fireEvent.input(sliders[2]!, { target: { value: '6' } });
    expect(onchange).toHaveBeenCalledWith({ preset: 1, low: 0, mid: 4, high: 6 });
  });

  it('an effect with no settings says so', () => {
    render(EffectParams, {
      props: { def: { ...echoLike, params: {} }, params: {}, onchange: () => null },
    });
    expect(screen.getByText(/no settings/i)).toBeTruthy();
  });
});
