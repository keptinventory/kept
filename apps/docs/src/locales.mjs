// The site's locales (plan Q19), in one place: astro.config.mjs hands them to Starlight, and
// the language menu (components/language/LanguageSelect.astro) lists them. `root` is English, at
// the site's root.
export const locales = {
  ar: { label: 'العربية', lang: 'ar', dir: 'rtl' },
  de: { label: 'Deutsch', lang: 'de' },
  root: { label: 'English', lang: 'en' },
  es: { label: 'Español', lang: 'es' },
  fr: { label: 'Français', lang: 'fr' },
  it: { label: 'Italiano', lang: 'it' },
  uk: { label: 'Українська', lang: 'uk' },
  vi: { label: 'Tiếng Việt', lang: 'vi' },
};
