/**
 * The launch languages (D204): each shown in its own name with a flag. Flags are SVG, not
 * emoji (Windows has no flag emoji), from country-flag-icons (MIT); only these are imported,
 * so the rest of the set never reaches the bundle.
 *
 * The flag for each language is the maintainer's choice and changes here, in one line each.
 */

import { findLanguages, languageSearch } from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import DE from 'country-flag-icons/react/3x2/DE';
import EG from 'country-flag-icons/react/3x2/EG';
import ES from 'country-flag-icons/react/3x2/ES';
import FR from 'country-flag-icons/react/3x2/FR';
import GB from 'country-flag-icons/react/3x2/GB';
import IT from 'country-flag-icons/react/3x2/IT';
import UA from 'country-flag-icons/react/3x2/UA';
import VN from 'country-flag-icons/react/3x2/VN';
import { useMemo, useState } from 'react';
import type { Key } from 'react-aria-components';
import { directionOf, LOCALES, type Locale, localeOfTag } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import { Combobox, ComboboxItem } from './ui/combobox';

type Flag = typeof GB;

/** `label` is the list's text value, for screen readers and the box: the name in itself. */
export type Language = { id: Locale; name: string; label: string };

/** Each language's name in itself, so a reader finds theirs whatever the interface says. */
export const LANGUAGE_NAMES: Readonly<Record<Locale, string>> = {
  ar: 'العربية',
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  uk: 'Українська',
  vi: 'Tiếng Việt',
};

const FLAGS: Readonly<Record<Locale, Flag>> = {
  ar: EG,
  de: DE,
  en: GB,
  es: ES,
  fr: FR,
  it: IT,
  uk: UA,
  vi: VN,
};

export const LANGUAGES: readonly Language[] = LOCALES.map((id) => ({
  id,
  name: LANGUAGE_NAMES[id],
  label: LANGUAGE_NAMES[id],
}));

/** A 3:2 flag, decorative: the language's name always sits beside it. */
export function LanguageFlag({ locale, className }: { locale: Locale; className?: string }) {
  const Flag = FLAGS[locale];
  return (
    <Flag
      aria-hidden="true"
      data-flag={locale}
      className={cn('h-[14px] w-[21px] shrink-0 rounded-[2px] ring-1 ring-line', className)}
    />
  );
}

/** The flag and the name, marked with the language so screen readers pronounce it right. */
export function LanguageName({ locale }: { locale: Locale }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LanguageFlag locale={locale} />
      <span lang={locale} dir={directionOf(locale)}>
        {LANGUAGE_NAMES[locale]}
      </span>
    </span>
  );
}

/** A Combobox filter for the languages (#450): the matcher the docs site's menu uses too. */
function useLanguageFilter() {
  const { i18n } = useLingui();
  return useMemo(() => {
    const search = languageSearch(LANGUAGES, i18n.locale);
    // React Aria hands the filter an item's text value, and own names are unique.
    return (ownName: string, query: string) =>
      findLanguages(search, query).some((language) => language.name === ownName);
  }, [i18n.locale]);
}

function LanguageItem({ item }: { item: Language }) {
  return <ComboboxItem item={item} content={<LanguageName locale={item.id} />} />;
}

/**
 * The interface language: one choice (Settings → Me, the sign-in pages). Typing only filters the
 * list: the language changes when one is chosen, and a box left empty or with anything else in it
 * goes back to the current language's name. The box's direction stays the page's, so its text
 * doesn't jump sides when typing starts; the name's letters still run the right way.
 */
export function LanguageSelect({
  label,
  value,
  onChange,
  compact = false,
  className,
}: {
  label: string;
  value: Locale;
  /** A promise says the change is still happening; it mustn't reject (say what went wrong here). */
  onChange: (locale: Locale) => unknown;
  /** No visible label and a small box (the sign-in header); the label stays accessible. */
  compact?: boolean;
  className?: string;
}) {
  const filter = useLanguageFilter();
  // The list closes when the selection changes, and a language can take a moment to load, or fail
  // to. Until then the box holds the choice; if the value doesn't follow, it goes back to the value.
  const [choosing, setChoosing] = useState<Locale | null>(null);
  const shown = choosing ?? value;
  return (
    <Combobox<Language>
      {...(compact ? { 'aria-label': label } : { label })}
      items={LANGUAGES}
      defaultFilter={filter}
      selectedKey={shown}
      onSelectionChange={(key) => {
        // A cleared box reports no selection: that isn't a choice.
        if (key == null || key === value) return;
        setChoosing(key as Locale);
        void Promise.resolve(onChange(key as Locale)).finally(() => setChoosing(null));
      }}
      showsChoice
      leading={<LanguageFlag locale={shown} />}
      placeholder={LANGUAGE_NAMES[shown]}
      inputProps={{ lang: shown, className: compact ? 'min-h-10 py-1.5' : undefined }}
      className={cn(compact && 'w-44 shrink-0', className)}
    >
      {(item) => <LanguageItem item={item} />}
    </Combobox>
  );
}

/**
 * A location's languages (D41): the languages AI writes search aliases in. Several choices. The
 * stored tags can carry a region (`ar-EG`); a chosen language keeps its stored tag, a new one is
 * stored as the bare language, and tags outside the list are kept as they are.
 */
export function LanguagesMultiSelect({
  label,
  description,
  value,
  onChange,
  isDisabled,
}: {
  label: string;
  description?: string;
  value: readonly string[];
  onChange: (tags: string[]) => void;
  isDisabled?: boolean;
}) {
  const { t } = useLingui();
  const filter = useLanguageFilter();
  const chosen = new Set(value.map(localeOfTag).filter((l): l is Locale => l !== null));
  const change = (keys: Key[]) => {
    const next = new Set(keys as Locale[]);
    const kept = value.filter((tag) => {
      const l = localeOfTag(tag);
      return l === null || next.has(l);
    });
    const added = LOCALES.filter((l) => next.has(l) && !chosen.has(l));
    onChange([...kept, ...added]);
  };
  return (
    <Combobox<Language, 'multiple'>
      label={label}
      description={description}
      selectionMode="multiple"
      items={LANGUAGES}
      defaultFilter={filter}
      value={[...chosen]}
      onChange={change}
      isDisabled={isDisabled ?? false}
      showsChoice
      placeholder={t`Find a language`}
      renderValue={(items) => items.map((item) => <LanguageName key={item.id} locale={item.id} />)}
    >
      {(item) => <LanguageItem item={item} />}
    </Combobox>
  );
}
