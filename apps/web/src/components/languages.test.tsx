/**
 * #450: the language pickers search by own name, English name and the interface's name for a
 * language, and typing never changes the language until one is chosen.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGES, LanguageSelect, LanguagesMultiSelect } from '@/components/languages';
import type { Locale } from '@/lib/prefs';
import { expectLogicalOnly, renderUI } from '@/test/render';

function Picker({
  onChange,
  compact,
  start = 'en',
}: {
  onChange?: (l: Locale) => void;
  compact?: boolean;
  start?: Locale;
}) {
  const [value, setValue] = useState<Locale>(start);
  return (
    <>
      <LanguageSelect
        label="Language"
        compact={compact ?? false}
        value={value}
        onChange={(l) => {
          onChange?.(l);
          setValue(l);
        }}
      />
      <button type="button">Elsewhere</button>
    </>
  );
}

function Several({ start, onChange }: { start: string[]; onChange?: (tags: string[]) => void }) {
  const [value, setValue] = useState(start);
  return (
    <>
      <LanguagesMultiSelect
        label="Languages spoken here"
        value={value}
        onChange={(tags) => {
          onChange?.(tags);
          setValue(tags);
        }}
      />
      <button type="button">Elsewhere</button>
    </>
  );
}

const optionNames = () =>
  within(screen.getByRole('listbox'))
    .getAllByRole('option')
    .map((o) => o.textContent);

describe('LanguageSelect', () => {
  it('is a combobox named for its label, showing the current language with its flag', async () => {
    const { container } = await renderUI(<Picker start="fr" />);
    const box = screen.getByRole('combobox', { name: 'Language' });
    expect(box).toHaveValue('Français');
    expect(box).toHaveAttribute('lang', 'fr');
    expect(container.querySelector('svg[data-flag="fr"]')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('select')).toBeNull();
  });

  it('opens the whole list on a click, in own names with flags, lang and dir', async () => {
    const { user } = await renderUI(<Picker />);
    await user.click(screen.getByRole('combobox', { name: 'Language' }));
    expect(optionNames()).toEqual([
      'العربية',
      'Deutsch',
      'English',
      'Español',
      'Français',
      'Italiano',
      'Українська',
      'Tiếng Việt',
    ]);
    const arabic = screen.getByRole('option', { name: 'العربية' });
    expect(arabic.querySelector('[lang="ar"]')).toHaveAttribute('dir', 'rtl');
    expect(arabic.querySelector('svg[data-flag="ar"]')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('option', { name: 'English' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('opens the whole list with ArrowDown, from the keyboard', async () => {
    const { user } = await renderUI(<Picker />);
    await user.tab();
    expect(screen.queryByRole('listbox')).toBeNull();
    await user.keyboard('{ArrowDown}');
    expect(optionNames()).toHaveLength(LANGUAGES.length);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it.each([
    ['german', 'Deutsch'],
    ['deutsch', 'Deutsch'],
    ['francais', 'Français'],
    ['vietnames', 'Tiếng Việt'],
    ['spanish', 'Español'],
    ['espanol', 'Español'],
    ['العربية', 'العربية'],
    ['arabic', 'العربية'],
  ])('finds "%s" and shows only %s', async (query, name) => {
    const { user } = await renderUI(<Picker />);
    const box = screen.getByRole('combobox');
    await user.click(box);
    await user.keyboard(query);
    expect(box).toHaveValue(query);
    expect(optionNames()).toEqual([name]);
  });

  it("finds a language by its name in the interface's own language", async () => {
    const { user } = await renderUI(<Picker />, { locale: 'de' });
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('Französisch');
    expect(optionNames()).toEqual(['Français']);
  });

  it('finds one in Arabic, in Arabic, right to left', async () => {
    const { user } = await renderUI(<Picker start="ar" />, { locale: 'ar' });
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('الألمانية');
    expect(optionNames()).toEqual(['Deutsch']);
    expectLogicalOnly();
  });

  it('says so when nothing matches, and keeps the language', async () => {
    const onChange = vi.fn();
    const { user } = await renderUI(<Picker start="de" onChange={onChange} />);
    const box = screen.getByRole('combobox');
    await user.click(box);
    await user.keyboard('zzz');
    expect(screen.getByRole('option')).toHaveTextContent('No matches');
    await user.click(screen.getByText('Elsewhere'));
    expect(box).toHaveValue('Deutsch');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('chooses with the keyboard: type, ArrowDown, Enter', async () => {
    const onChange = vi.fn();
    const { user } = await renderUI(<Picker onChange={onChange} />);
    const box = screen.getByRole('combobox');
    await user.tab();
    await user.keyboard('ger{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('de');
    await waitFor(() => expect(box).toHaveValue('Deutsch'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('chooses the first match with Enter alone', async () => {
    const onChange = vi.fn();
    const { user } = await renderUI(<Picker onChange={onChange} />);
    const box = screen.getByRole('combobox');
    await user.tab();
    await user.keyboard('ger{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('de');
    await waitFor(() => expect(box).toHaveValue('Deutsch'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps the language when Enter has nothing to choose', async () => {
    const onChange = vi.fn();
    const { user } = await renderUI(<Picker start="fr" onChange={onChange} />);
    const box = screen.getByRole('combobox');
    // The whole list, opened by a click, with nothing typed.
    await user.click(box);
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('listbox')).toBeNull();
    // Nothing matches.
    await user.click(box);
    await user.keyboard('zzz{Enter}');
    await waitFor(() => expect(box).toHaveValue('Français'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes the list and goes back to the current language when one fails to load', async () => {
    const { user } = await renderUI(
      <LanguageSelect label="Language" value="fr" onChange={() => Promise.resolve(false)} />,
    );
    const box = screen.getByRole('combobox');
    await user.click(box);
    await user.click(screen.getByRole('option', { name: 'Deutsch' }));
    await waitFor(() => expect(box).toHaveValue('Français'));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box).toHaveAttribute('lang', 'fr');
  });

  it('replaces the name on the first keystroke, and that keystroke loses nothing', async () => {
    const onChange = vi.fn();
    const { user, container } = await renderUI(<Picker start="it" onChange={onChange} />);
    const box = screen.getByRole<HTMLInputElement>('combobox');
    await user.click(box);
    expect([box.selectionStart, box.selectionEnd]).toEqual([0, 'Italiano'.length]);
    await user.keyboard('g');
    expect(box).toHaveValue('g');
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('svg[data-flag="it"]')).not.toBeNull();
  });

  it('restores the current language when the box is cleared and left', async () => {
    const onChange = vi.fn();
    const { user, container } = await renderUI(<Picker start="fr" onChange={onChange} />);
    const box = screen.getByRole('combobox');
    await user.click(box);
    await user.clear(box);
    expect(box).toHaveValue('');
    expect(box).toHaveAttribute('placeholder', 'Français');
    expect(container.querySelector('svg[data-flag="fr"]')).not.toBeNull();
    await user.click(screen.getByText('Elsewhere'));
    expect(box).toHaveValue('Français');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('restores the current language when the box is cleared and Escape pressed', async () => {
    const onChange = vi.fn();
    const { user } = await renderUI(<Picker start="fr" onChange={onChange} />);
    const box = screen.getByRole('combobox');
    await user.click(box);
    await user.clear(box);
    await user.keyboard('{Escape}');
    expect(box).toHaveValue('Français');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does nothing when the current language is chosen again', async () => {
    const onChange = vi.fn();
    const { user } = await renderUI(<Picker start="de" onChange={onChange} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Deutsch' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toHaveValue('Deutsch');
  });

  it('follows a new value from outside', async () => {
    function Outside() {
      const [value, setValue] = useState<Locale>('en');
      return (
        <>
          <LanguageSelect label="Language" value={value} onChange={setValue} />
          <button type="button" onClick={() => setValue('vi')}>
            From another tab
          </button>
        </>
      );
    }
    const { user } = await renderUI(<Outside />);
    await user.click(screen.getByRole('button', { name: 'From another tab' }));
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('Tiếng Việt'));
  });

  it('keeps the name on screen readers only, when compact', async () => {
    await renderUI(<Picker compact />);
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeInTheDocument();
    expect(screen.queryByText('Language')).toBeNull();
  });

  it('types at 16 px when compact too: a smaller box zooms the page on an iPhone', async () => {
    await renderUI(<Picker compact />);
    const box = screen.getByRole('combobox');
    expect(box.className).toContain('text-[16px]');
    expect(box.className).not.toContain('text-[14px]');
  });
});

describe('LanguagesMultiSelect with the keyboard', () => {
  it('adds the first match with Enter alone', async () => {
    const onChange = vi.fn();
    const { user } = await renderUI(<Several start={['en']} onChange={onChange} />);
    await user.tab();
    await user.keyboard('german{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['en', 'de']);
  });
});

describe('LanguageSelect on a phone', () => {
  afterEach(() => vi.unstubAllGlobals());

  // A tap brings up the keyboard, and the browser scrolls the box clear of it. React Aria closes
  // a popover like this one on any scroll of what's around it.
  it('stays open when the keyboard coming up scrolls the page', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }));
    const { user } = await renderUI(<Picker />);
    await user.click(screen.getByRole('combobox'));
    fireEvent.scroll(window);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    expect(optionNames()).toHaveLength(LANGUAGES.length);
  });

  it('closes after a quick tap on an option, and stays closed', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }));
    const onChange = vi.fn();
    const { user } = await renderUI(<Picker onChange={onChange} />);
    const box = screen.getByRole('combobox');
    // Touch, not a mouse: a tap on the box, then one straight away on an option.
    await user.pointer({ keys: '[TouchA]', target: box });
    await user.pointer({
      keys: '[TouchA]',
      target: screen.getByRole('option', { name: 'Deutsch' }),
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith('de');
    await waitFor(() => expect(box).toHaveValue('Deutsch'));
    // Long enough for a wrongful reopen to have happened.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('listbox')).toBeNull();
    // Nothing left hiding the page from screen readers.
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toBeInTheDocument();
  });

  it('closes with Escape straight after a tap', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }));
    const { user } = await renderUI(<Picker />);
    await user.pointer({ keys: '[TouchA]', target: screen.getByRole('combobox') });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('still closes when the page is scrolled later on', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }));
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const { user } = await renderUI(<Picker />);
    await user.click(screen.getByRole('combobox'));
    now.mockReturnValue(5000);
    fireEvent.scroll(window);
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    now.mockRestore();
  });

  it('closes on a scroll with a mouse', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const { user } = await renderUI(<Picker />);
    await user.click(screen.getByRole('combobox'));
    fireEvent.scroll(window);
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });
});

describe('LanguagesMultiSelect', () => {
  it('shows every chosen language, with its flag, and describes the box with them', async () => {
    await renderUI(<Several start={['fr', 'ar-EG', 'pt']} />);
    const box = screen.getByRole('combobox', { name: 'Languages spoken here' });
    expect(box).toHaveValue('');
    const described = document.getElementById(box.getAttribute('aria-describedby') ?? '');
    expect(described).toHaveTextContent('Français');
    expect(described).toHaveTextContent('العربية');
    expect(described?.querySelectorAll('svg[data-flag]')).toHaveLength(2);
    expect(within(described as HTMLElement).getByText('العربية')).toHaveAttribute('dir', 'rtl');
  });

  it('searches, and chooses several without closing', async () => {
    const onChange = vi.fn();
    const { user } = await renderUI(<Several start={[]} onChange={onChange} />);
    const box = screen.getByRole('combobox');
    await user.click(box);
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
    await user.keyboard('german');
    expect(optionNames()).toEqual(['Deutsch']);
    await user.click(screen.getByRole('option', { name: 'Deutsch' }));
    expect(onChange).toHaveBeenLastCalledWith(['de']);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('removes one from the list, keeping stored region tags and other tags', async () => {
    const onChange = vi.fn();
    const { user } = await renderUI(<Several start={['ar-EG', 'fr', 'pt']} onChange={onChange} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Français' }));
    expect(onChange).toHaveBeenLastCalledWith(['ar-EG', 'pt']);
  });

  it('keeps the choices when the box is cleared and left, and empties the box', async () => {
    const onChange = vi.fn();
    const { user } = await renderUI(<Several start={['it']} onChange={onChange} />);
    const box = screen.getByRole('combobox');
    await user.click(box);
    await user.keyboard('fre');
    await user.clear(box);
    await user.click(screen.getByText('Elsewhere'));
    expect(box).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Italiano')).toBeInTheDocument();
  });

  it('empties the box when left with a query in it', async () => {
    const { user } = await renderUI(<Several start={['it']} />);
    const box = screen.getByRole('combobox');
    await user.click(box);
    await user.keyboard('fre');
    await user.click(screen.getByText('Elsewhere'));
    expect(box).toHaveValue('');
  });
});
