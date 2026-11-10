/**
 * Language, theme, digits, region, date format and content width: device preferences kept in
 * localStorage (lib/prefs.ts), applied before first paint by index.html (region and date format
 * when React draws dates, #362). Used on Settings → Me → Display (D203, D204), the sign-in pages
 * (language only) and the gallery. Signed in, Units too (#385): metric or imperial, kept on the
 * account rather than the device, so every device and the PDFs follow it.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useQueryClient } from '@tanstack/react-query';
import { setAccountLocale, setUnits } from '@/api/account';
import { keys, useMe } from '@/api/queries';
import type { Me } from '@/api/types';
import { LANGUAGE_NAMES, LanguageSelect } from '@/components/languages';
import { Segmented } from '@/components/ui/segmented';
import { toast } from '@/components/ui/toast';
import { activateLocale } from '@/i18n/i18n';
import { makeFormatter } from '@/lib/format';
import {
  DATE_FORMATS,
  type DateFormatPref,
  type Digits,
  type EnglishRegion,
  formatLocale,
  type Locale,
  markLocaleSent,
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

/**
 * Changes the language, or says why it can't. Offline, a catalogue never loaded online isn't cached
 * (sw.ts), so the language stays as it was. Resolves to whether it changed.
 */
function useSwitchLocale(digits: Digits) {
  const { t } = useLingui();
  return async (locale: Locale) => {
    try {
      await switchLocale(locale, digits);
      return true;
    } catch {
      toast({ title: t`Needs a connection`, description: LANGUAGE_NAMES[locale], tone: 'danger' });
      return false;
    }
  };
}

async function switchDigits(locale: Locale, digits: Digits) {
  await activateLocale(locale, digits);
  setDigits(digits);
}

/** The sign-in pages' language picker: flags and each language's own name, in a small box. */
export function LanguageToggle() {
  const { t } = useLingui();
  const { locale, digits } = usePrefs();
  const change = useSwitchLocale(digits);
  return <LanguageSelect compact label={t`Language`} value={locale} onChange={change} />;
}

/** `signedIn`: a language chosen here is also kept on the account, which mail goes by. */
export function DisplayPrefs({ signedIn = false }: { signedIn?: boolean }) {
  const { t } = useLingui();
  const { theme, locale, digits, region, dateFormat, width } = usePrefs();
  const qc = useQueryClient();
  const change = useSwitchLocale(digits);
  const choose = async (next: Locale) => {
    if (!(await change(next)) || !signedIn) return;
    // This device has its language either way; a failure here only leaves mail as it was.
    void setAccountLocale(next)
      .then(() => {
        markLocaleSent(next);
        return qc.invalidateQueries({ queryKey: keys.me });
      })
      .catch(() => undefined);
  };
  // Each format shown as today's date written that way (#362).
  const today = new Date().toISOString();
  const tag = formatLocale(locale, digits, region);
  const sample = (f: DateFormatPref) => makeFormatter(tag, f).date(today);
  return (
    <div className="grid gap-4">
      <LanguageSelect
        label={t`Language`}
        value={locale}
        onChange={choose}
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
        // Each label may wrap: in an equal-width cell on a phone, Vietnamese's "3 thg 11, 2026"
        // would otherwise run past its edge and be cut off (the 1.14.4 final review).
        options={DATE_FORMATS.map((f) => ({
          id: f,
          label: f === 'auto' ? t({ message: 'Default', context: 'date format' }) : sample(f),
        }))}
      />
      {signedIn ? <UnitsChoice /> : null}
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

type Units = Me['profile']['units'];

/** Metric or imperial (#385), on the account: shown at once, put back if it can't be saved. */
function UnitsChoice() {
  const { t } = useLingui();
  const qc = useQueryClient();
  const me = useMe();
  const units = me.data?.profile.units ?? 'metric';
  const put = (next: Units) =>
    qc.setQueryData<Me>(keys.me, (m) => (m ? { ...m, profile: { ...m.profile, units: next } } : m));
  const choose = (next: Units) => {
    if (next === units) return;
    const was = units;
    put(next);
    void setUnits(next)
      .then(() => qc.invalidateQueries({ queryKey: keys.me }))
      .catch(() => {
        put(was);
        toast({ title: t`Couldn't change the units`, tone: 'danger' });
      });
  };
  return (
    <Segmented<Units>
      label={t`Units`}
      value={units}
      onChange={choose}
      description={
        <Trans>
          Sizes on the map, label sizes, fuel use and a new vehicle’s odometer. What you’ve saved
          stays as it is.
        </Trans>
      }
      options={[
        { id: 'metric', label: t`Metric` },
        { id: 'imperial', label: t`Imperial` },
      ]}
    />
  );
}
