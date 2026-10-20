import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/lib/prefs';
import { expectLogicalOnly, renderUI } from '@/test/render';
import { HeightField } from './height';
import type { Item } from './layout';

// #138: a thing on a wall's Height, on its card while arranging. A React Aria NumberField in
// metres: arrow keys and the − and + buttons move it by 5 cm, typing sets it, and it keeps to
// where the thing can hang.

const tv: Item = {
  id: '01926f00-0000-7000-8000-000000000001',
  subject: 'thing',
  roomId: '01926f00-0000-7000-8000-000000000010',
  name: 'Living room TV',
  shortCode: null,
  model: 'wall_tv',
  x: 1,
  z: 0.1,
  rot: 0,
  on: null,
  parentId: '01926f00-0000-7000-8000-000000000010',
  isContainer: false,
  quantity: 1,
  auto: false,
  hang: 1.2,
};

afterEach(() => setLocale('en'));

describe('HeightField', () => {
  it('shows how high the middle hangs, in metres, and says what that means', async () => {
    await renderUI(<HeightField item={tv} onHeight={vi.fn()} />);
    const field = screen.getByRole('textbox', { name: 'Height' });
    expect((field as HTMLInputElement).value).toBe('1.2 m');
    expect(screen.getByText('From the floor to its middle')).toBeTruthy();
    expectLogicalOnly();
  });

  it('goes up and down by 5 cm with the arrow keys and the buttons', async () => {
    const onHeight = vi.fn();
    const { user } = await renderUI(<HeightField item={tv} onHeight={onHeight} />);
    const field = screen.getByRole('textbox', { name: 'Height' });
    await user.click(field);
    await user.keyboard('{ArrowUp}');
    expect(onHeight).toHaveBeenLastCalledWith(1.25);
    await user.keyboard('{ArrowDown}');
    expect(onHeight).toHaveBeenLastCalledWith(1.15);
    // Each button says what it does and to what: "Lower Height", "Higher Height".
    await user.click(screen.getByRole('button', { name: /^Lower/ }));
    expect(onHeight).toHaveBeenLastCalledWith(1.15);
    await user.click(screen.getByRole('button', { name: /^Higher/ }));
    expect(onHeight).toHaveBeenLastCalledWith(1.25);
  });

  it('takes a typed height when the field is left or Enter is pressed', async () => {
    const onHeight = vi.fn();
    const { user } = await renderUI(<HeightField item={tv} onHeight={onHeight} />);
    const field = screen.getByRole('textbox', { name: 'Height' });
    await user.clear(field);
    await user.type(field, '1.75{Enter}');
    expect(onHeight).toHaveBeenLastCalledWith(1.75);
  });

  it('stops where the thing can hang: its bottom on the floor, its top under 3 m', async () => {
    const onHeight = vi.fn();
    const { user } = await renderUI(
      <HeightField item={{ ...tv, hang: 2.6 }} onHeight={onHeight} />,
    );
    expect(screen.getByRole('button', { name: /^Higher/ }).hasAttribute('disabled')).toBe(true);
    const field = screen.getByRole('textbox', { name: 'Height' });
    await user.clear(field);
    await user.type(field, '0.1{Enter}');
    expect(onHeight).toHaveBeenLastCalledWith(0.4);
  });

  it('reads in Arabic, right to left, in Arabic digits', async () => {
    setLocale('ar');
    await renderUI(<HeightField item={tv} onHeight={vi.fn()} />, { locale: 'ar' });
    const field = screen.getByRole('textbox', { name: 'الارتفاع' }) as HTMLInputElement;
    expect(field.value).toMatch(/١٫٢/);
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByRole('button', { name: /^أعلى/ })).toBeTruthy();
    expectLogicalOnly();
  });
});
