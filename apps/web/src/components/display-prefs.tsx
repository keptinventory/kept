/**
 * Language, theme, digits, region, date format and content width: device preferences kept in
 * localStorage (lib/prefs.ts), applied before first paint by index.html (region and date format
 * when React draws dates, #362). Used on Settings → Me → Display (D203, D204), the sign-in pages
 * (language only) and the gallery.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { LanguageSelect } from '@/components/languages';
import { Segmented } from '@/components/ui/segmented';
import { activateLocale } from '@/i18n/i18n';
import { makeFormatter } from '@/lib/format';
import {
  DATE_FORMATS,
  type DateFormatPref,
  type Digits,
  type EnglishRegion,
  formatLocale,
  type Locale,
  setDateFormat,
  setDigits,
  setLocale,
  setRegion,
  setThemePref,
  setWidthPref,
  type ThemePref,
  usePrefs,
  type WidthPref,
} from '@/lib/prefs';

export async function switchLocale(locale: Locale, digits: Digits) {
  await activateLocale(locale, digits);
  setLocale(locale);
}

async function switchDigits(locale: Locale, digits: Digits) {
  await activateLocale(locale, digits);
  setDigits(digits);
}

/** The sign-in pages' language picker: flags and each language's own name, in a small trigger. */
export function LanguageToggle() {
  const { t } = useLingui();
  const { locale, digits } = usePrefs();
  return (
    <LanguageSelect
      compact
      label={t`Language`}
      value={locale}
      onChange={(l) => void switchLocale(l, digits)}
    />
  );
}

export function DisplayPrefs() {
  const { t } = useLingui();
  const { theme, locale, digits, region, dateFormat, width } = usePrefs();
  // Each format shown as today's date written that way (#362).
  const today = new Date().toISOString();
  const tag = formatLocale(locale, digits, region);
  const sample = (f: DateFormatPref) => makeFormatter(tag, f).date(today);
  return (
    <div className="grid gap-4">
      <LanguageSelect
        label={t`Language`}
        value={locale}
        onChange={(l) => void switchLocale(l, digits)}
        className="md:max-w-sm"
      />
      {/* D204: the digit choice only means something in Arabic, so only Arabic shows it. */}
      {locale === 'ar' ? (
        <Segmented<Digits>
          label={t`Digits in Arabic`}
          value={digits}
          onChange={(d) => void switchDigits(locale, d)}
          description={
            <Trans>
              Used when Kept is in Arabic, for amounts, dates and counts. Short IDs, codes and
              serials always stay 0–9.
            </Trans>
          }
          options={[
            { id: 'western', label: <span className="ltr">0123</span> },
            { id: 'eastern', label: <span lang="ar">٠١٢٣</span> },
          ]}
        />
      ) : null}
      {/* #362: only English is written two ways, US and UK. */}
      {locale === 'en' ? (
        <Segmented<EnglishRegion>
          label={t`Region`}
          value={region}
          onChange={setRegion}
          description={<Trans>How dates and times are written in English.</Trans>}
          options={[
            { id: 'us', label: t`United States` },
            { id: 'gb', label: t`United Kingdom` },
          ]}
        />
      ) : null}
      <Segmented<DateFormatPref>
        label={t`Date format`}
        value={dateFormat}
        onChange={setDateFormat}
        description={
          <Trans>
            Default leaves the year off this year’s dates. Purchase and warranty dates always show
            it.
          </Trans>
        }
        options={DATE_FORMATS.map((f) => ({
          id: f,
          label:
            f === 'auto' ? (
              t({ message: 'Default', context: 'date format' })
            ) : (
              <span className="whitespace-nowrap">{sample(f)}</span>
            ),
        }))}
      />
      <Segmented<ThemePref>
        label={t`Theme`}
        value={theme}
        onChange={setThemePref}
        description={
          theme === 'system' ? <Trans>Follows this device’s light or dark setting.</Trans> : null
        }
        options={[
          { id: 'system', label: t`System` },
          { id: 'light', label: t`Light` },
          { id: 'dark', label: t`Dark` },
        ]}
      />
      {/* D203: phones always use their whole width, so the choice is shown from tablets up. */}
      <Segmented<WidthPref>
        label={t`Content width`}
        value={width}
        onChange={setWidthPref}
        className="max-md:hidden"
        description={
          <Trans>
            Full width gives lists and tables the whole screen. Text and forms keep a readable
            width.
          </Trans>
        }
        options={[
          { id: 'centered', label: t`Centered` },
          { id: 'full', label: t`Full width` },
        ]}
      />
    </div>
  );
}
