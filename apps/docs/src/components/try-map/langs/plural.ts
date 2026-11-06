/** A language's plural forms, as its catalogue writes them: `#` is the formatted number. */
export function pluralIn(lang: string) {
  const rules = new Intl.PluralRules(lang);
  return (
    n: number,
    f: string,
    forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string },
  ) => (forms[rules.select(n)] ?? forms.other).replace('#', f);
}
