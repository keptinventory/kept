import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/lib/prefs';
import { expectLogicalOnly, renderUI } from '@/test/render';
import { SizeFields } from './size';

// #240, #241: a sized shape's numbers on its card while arranging. A cube shelf by its cubes
// across and up (turned on its side by swapping them); a bookcase by its width, depth and height
// in centimetres and its levels. Each change is a new model for the shape, its numbers in it.

afterEach(() => setLocale('en'));

const value = (name: string) => (screen.getByRole('textbox', { name }) as HTMLInputElement).value;

describe('SizeFields: a cube shelf (#240)', () => {
  it('shows its grid and its outside size, 2 × 2 at first', async () => {
    await renderUI(<SizeFields model="cube_grid" onModel={vi.fn()} />);
    expect(value('Cubes across')).toBe('2');
    expect(value('Cubes up')).toBe('2');
    expect(screen.getByText('77 × 39 × 77 cm')).toBeTruthy();
    // A square grid is the same on its side.
    expect(screen.queryByRole('button', { name: 'Turn on its side' })).toBeNull();
    expectLogicalOnly();
  });

  it('adds and takes away cubes with the arrow keys, the buttons and typing', async () => {
    const onModel = vi.fn();
    const { user } = await renderUI(<SizeFields model="cube_grid" onModel={onModel} />);
    await user.click(screen.getByRole('textbox', { name: 'Cubes across' }));
    await user.keyboard('{ArrowUp}');
    expect(onModel).toHaveBeenLastCalledWith('cube_grid_3x2');
    const up = screen.getByRole('textbox', { name: 'Cubes up' });
    await user.clear(up);
    await user.type(up, '4{Enter}');
    expect(onModel).toHaveBeenLastCalledWith('cube_grid_2x4');
    // No more than eight, no fewer than one.
    await user.clear(up);
    await user.type(up, '12{Enter}');
    expect(onModel).toHaveBeenLastCalledWith('cube_grid_2x8');
  });

  it('turns a standing one on its side, and reads back what it wrote', async () => {
    const onModel = vi.fn();
    const { user, unmount } = await renderUI(
      <SizeFields model="cube_grid_1x4" onModel={onModel} />,
    );
    expect(screen.getByText('42 × 39 × 147 cm')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Turn on its side' }));
    expect(onModel).toHaveBeenLastCalledWith('cube_grid_4x1');
    unmount();
    await renderUI(<SizeFields model="cube_grid_4x1" onModel={onModel} />);
    expect(value('Cubes across')).toBe('4');
    expect(value('Cubes up')).toBe('1');
    expect(screen.getByText('147 × 39 × 42 cm')).toBeTruthy();
  });
});

describe('SizeFields: a bookcase (#241)', () => {
  it('shows its size in centimetres and its levels, 80 × 28 × 202 with 6 at first', async () => {
    await renderUI(<SizeFields model="bookcase" onModel={vi.fn()} />);
    expect(value('Width')).toBe('80 cm');
    expect(value('Depth')).toBe('28 cm');
    expect(value('Height')).toBe('202 cm');
    expect(value('Levels')).toBe('6');
    expectLogicalOnly();
  });

  it('changes its size and its levels, and keeps the levels to what its height fits', async () => {
    const onModel = vi.fn();
    const { user } = await renderUI(<SizeFields model="bookcase" onModel={onModel} />);
    const width = screen.getByRole('textbox', { name: 'Width' });
    await user.clear(width);
    await user.type(width, '40{Enter}');
    expect(onModel).toHaveBeenLastCalledWith('bookcase_40x28x202_6');
    await user.click(screen.getByRole('textbox', { name: 'Levels' }));
    await user.keyboard('{ArrowDown}');
    expect(onModel).toHaveBeenLastCalledWith('bookcase_80x28x202_5');
    // A 60 cm high bookcase holds four levels at most.
    const height = screen.getByRole('textbox', { name: 'Height' });
    await user.clear(height);
    await user.type(height, '60{Enter}');
    expect(onModel).toHaveBeenLastCalledWith('bookcase_80x28x60_4');
  });

  it('says nothing for a shape with one size', async () => {
    const { container } = await renderUI(<SizeFields model="bookshelf" onModel={vi.fn()} />);
    expect(container.textContent).toBe('');
  });

  it('reads in Arabic, right to left, in Arabic digits', async () => {
    setLocale('ar');
    await renderUI(<SizeFields model="cube_grid_1x4" onModel={vi.fn()} />, { locale: 'ar' });
    const across = screen.getAllByRole('textbox')[0] as HTMLInputElement;
    expect(across.value).toBe('١');
    expectLogicalOnly();
  });
});
