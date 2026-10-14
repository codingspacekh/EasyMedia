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

  it('an effect with no settings says so', () => {
    render(EffectParams, {
      props: { def: { ...echoLike, params: {} }, params: {}, onchange: () => null },
    });
    expect(screen.getByText(/no settings/i)).toBeTruthy();
  });
});
