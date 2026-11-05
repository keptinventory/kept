/**
 * What the language menu (LanguageSelect.astro) adds to its plain links: arrow keys, Escape, closing
 * on a click outside or when focus leaves, and the box that finds a language by typing (#450), with
 * the matcher the app's pickers use. The box comes out of the menu's <template> here, so a page
 * without JavaScript has just the links.
 */
import { findLanguages, languageSearch } from '@kept/shared';

class KeptLanguageMenu extends HTMLElement {
  connectedCallback() {
    const details = this.querySelector('details');
    const summary = details?.querySelector('summary');
    const panel = details?.querySelector('.kd-lang-panel');
    const results = details?.querySelector<HTMLElement>('.kd-lang-results');
    const list = details?.querySelector<HTMLElement>('.kd-lang-list');
    const template = details?.querySelector('template');
    if (!details || !summary || !panel || !results || !list || !template) return;

    const parts = template.content.cloneNode(true) as DocumentFragment;
    const filter = parts.querySelector<HTMLInputElement>('.kd-lang-filter');
    const none = parts.querySelector<HTMLElement>('.kd-lang-none');
    if (!filter || !none) return;
    panel.prepend(filter);
    results.append(none);

    /** The links the filter hasn't hidden. */
    const links = () => [
      ...details.querySelectorAll<HTMLAnchorElement>('.kd-lang-list li:not([hidden]) a'),
    ];
    const languages = links().map((link) => ({
      id: link.hreflang,
      name: link.querySelector('.kd-lang-name')?.textContent?.trim() ?? '',
      item: link.closest('li'),
    }));
    const search = languageSearch(languages, document.documentElement.lang);
    const applyFilter = () => {
      const found = new Set(findLanguages(search, filter.value));
      for (const language of languages) {
        if (language.item) language.item.hidden = !found.has(language);
      }
      // Written into a status element that's already there, so screen readers announce it.
      none.textContent = found.size === 0 ? (none.dataset.text ?? '') : '';
    };
    filter.addEventListener('input', applyFilter);

    const close = (refocus: boolean) => {
      if (!details.open) return;
      details.open = false;
      if (refocus) summary.focus();
    };
    const focusLink = (index: number) => {
      const all = links();
      all[(index + all.length) % all.length]?.focus();
    };

    summary.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        details.open = true;
        const all = links();
        const at = all.findIndex((a) => a.hasAttribute('aria-current'));
        focusLink(event.key === 'ArrowUp' ? all.length - 1 : Math.max(at, 0));
      }
    });
    details.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && details.open) {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.target === summary) return; // Its own handler above has already moved focus.
      const all = links();
      if (document.activeElement === filter) {
        if (event.key === 'ArrowDown') all[0]?.focus();
        else if (event.key === 'ArrowUp') all.at(-1)?.focus();
        else if (event.key === 'Enter') all[0]?.click();
        else return;
        event.preventDefault();
        return;
      }
      const at = all.indexOf(document.activeElement as HTMLAnchorElement);
      if (at === -1) return;
      if (event.key === 'ArrowDown') {
        if (at === all.length - 1) filter.focus();
        else focusLink(at + 1);
      } else if (event.key === 'ArrowUp') {
        if (at === 0) filter.focus();
        else focusLink(at - 1);
      } else if (event.key === 'Home') focusLink(0);
      else if (event.key === 'End') focusLink(all.length - 1);
      else return;
      event.preventDefault();
    });
    details.addEventListener('toggle', () => {
      if (!details.open) {
        filter.value = '';
        applyFilter();
        return;
      }
      // The panel keeps its height as languages drop out, so nothing moves while typing, on a
      // phone above all, where it opens upwards from the bottom of the menu.
      list.style.minBlockSize = `${list.offsetHeight}px`;
      // Arrow keys have already gone to a link. Opening with Enter or a mouse goes to the box,
      // ready to type. A tap leaves focus on the button, as a disclosure does: the list is in
      // full view, and the keyboard doesn't come up until the box is tapped.
      if (details.contains(document.activeElement) && document.activeElement !== summary) return;
      if (summary.matches(':focus-visible') || matchMedia('(pointer: fine)').matches) {
        filter.focus();
      }
    });
    // Tab out of the menu, or click anywhere else, and it closes.
    details.addEventListener('focusout', (event) => {
      const next = event.relatedTarget;
      if (next instanceof Node && !details.contains(next)) close(false);
    });
    document.addEventListener('click', (event) => {
      if (event.target instanceof Node && !details.contains(event.target)) close(false);
    });
    // A page restored from the back/forward cache comes back with the menu as it was left.
    window.addEventListener('pageshow', () => close(false));
  }
}
if (!customElements.get('kd-lang-menu')) customElements.define('kd-lang-menu', KeptLanguageMenu);
