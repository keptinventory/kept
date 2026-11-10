---
title: Languages and right-to-left
description: How strings are translated with Lingui, what the catalogue checks enforce, and the rules that keep Arabic correct.
---

Kept ships in Arabic, English, French, German, Italian (D204), Spanish, Ukrainian and
Vietnamese.
Arabic is right-to-left, so every screen has to mirror without per-screen overrides. The web app
uses [Lingui](https://lingui.dev/) with PO catalogues (D96); the server has its own small typed
tables for mail and reports.

## Lingui in the web app

`apps/web/lingui.config.ts` sets the source locale `en`, the locales `ar`, `de`, `en`, `es`, `fr`, `it`,
`uk`, `vi`, and one catalogue per locale at `apps/web/src/locales/<locale>/messages.po`, extracted from
`src` (tests and `routeTree.gen.ts` excluded). Catalogues have no line numbers, so they don't
churn on every edit.

`apps/web/src/i18n/i18n.ts` loads the catalogue of the language in use on demand: each `.po` is
compiled by `@lingui/vite-plugin` into its own chunk under `assets/locales/`, cached by the
service worker on first use. `activateLocale` also passes the digit choice into Lingui, so a
plural's `#` shows ٣ or 3 as the reader chose.

In components, write strings with the macros:

```tsx title="apps/web/src/components/oidc-sign-in.tsx"
<Trans>Sign in with <bdi>{name}</bdi></Trans>
```

```ts
const { t } = useLingui();
t`Needs a connection`;
```

## Adding a string

1. Write it with `` t`…` `` or `<Trans>`.
2. Add its entry to **every** catalogue, with a written `msgstr` in each language but English.
   `pnpm --filter @kept/web i18n:extract` runs `lingui extract --clean`, which rewrites every
   catalogue and drops obsolete entries. When several changes are in flight on the catalogues, the
   house practice is to **append** the new entries by hand instead of running a `--clean`
   re-extract, and to commit catalogue changes on their own.
3. Run the checks below.

A plural in Arabic carries every form, as the existing entries do:

```text title="apps/web/src/locales/ar/messages.po"
msgid "{0, plural, =0 {no fields} one {# field} other {# fields}}"
msgstr "{0, plural, =0 {بلا حقول} zero {بلا حقول} one {حقل واحد} two {حقلان} few {# حقول} many {# حقلًا} other {# حقل}}"
```

## What the checks enforce

| Check | Runs in | Fails when |
|---|---|---|
| `scripts/check-i18n.mjs` | `pnpm lint` | A message in the source is missing from any catalogue; a non-English translation is empty; a launch locale is missing from the config; a translation's shape differs from its source (different placeholders, numbered tags, or number of plural/select arguments) |
| `scripts/check-i18n-extract.mjs` | ci-local's `catalogues` step | The real `lingui extract` CLI, run into a scratch copy under `.tmp/`, adds an id the committed catalogues don't hold, or a committed non-English catalogue has an empty translation |
| `scripts/check-logical-css.mjs` | `pnpm lint` | A physical side in CSS, a style object or a Tailwind class (below) |

A message missing from a catalogue matters: the macro strips the source text in a production
build, so a missing message renders as its hashed id, not as English. Neither script checks
obsolete entries or moved `#:` references.

:::note[Arabic house style]
Arabic is written natively, not translated word for word, with every plural form and Eastern
Arabic digits where the reader chose them. The scripts check that each Arabic message exists, is
not empty and keeps its source's shape; whether it reads well, and carries the full set of plural
forms, is checked in review.
:::

## Digits, numbers and dates

The reader picks Eastern (٠١٢٣) or Western digits for Arabic (D143); other languages are always
Western. `formatLocale` in `apps/web/src/lib/prefs.ts` turns that into `ar-u-nu-arab` or
`ar-u-nu-latn`. Format numbers and dates through `useFormat()` in `apps/web/src/lib/format.ts`
(`fmt.num`, `fmt.day`, `fmt.longDay`, `fmt.dateTime`, `fmt.relative`), and sizes with
`useBytes()`, never with a bare `toLocaleString`.

Short IDs, codes, serials, usernames and URLs never go through the formatter. They stay as printed
on the label, Western and left-to-right, inside the `.ltr` class (`apps/web/src/styles/index.css`:
`direction: ltr; unicode-bidi: isolate`).

## Right-to-left rules

**Logical CSS only.** `scripts/check-logical-css.mjs` fails on `margin-left`, `padding-right`,
`left:`, `text-align: right`, their camelCase forms in style objects, and Tailwind's `ml-`, `pr-`,
`left-`, `border-l`, `rounded-r`, `text-left` and friends. Use `margin-inline-start` / `ms-`,
`padding-inline-end` / `pe-`, `inset-inline-start` / `start-`, `border-s`, `rounded-e`,
`text-start`. A line that genuinely needs a physical side (a chart axis) can end with the comment
`logical-css-ignore` and a reason.

**Names inside sentences are isolated.** A Latin name in an Arabic sentence, or an Arabic one in
French, must keep its own direction without turning the sentence around it:

- in JSX, wrap the name in `<bdi>`;
- in a string (a toast, an `aria-label`, a title built with `t`), use `isolate()` from
  `apps/web/src/lib/bidi.ts`, which wraps it in Unicode's first-strong isolate marks:

```ts title="apps/web/src/components/registries/convert-field-sheet.household.tsx"
t`Make ${isolate(label)} secret?`
```

`bidi()` in the same file gives a `<bdi>` element for a name inside a `<Trans>` placeholder, and
`plainText()` strips the marks for comparisons.

**Separators come from the formatter.** Never write a separator between a line's parts by hand,
and never the middle dot. Use `fmt.sep` (from `useFormat()`) or `sep()` from
`apps/web/src/lib/format.ts`: a comma, and in Arabic the Arabic comma `"، "`. Or make the parts
separate elements. A message whose source text still has a middle dot gets the language's comma
in its place at load time (`localiseSeparators`), so translators don't write it.
`apps/web/src/lib/separator.test.ts` checks every message in every language, and every line built
in code outside a message.

```tsx title="apps/web/src/components/vehicles/recent-services.tsx"
{i > 0 ? fmt.sep : null}
```

**Empty fields.** User text fields use `dir="auto"`. While a placeholder shows, the field takes the
page's direction (a rule in `index.css`), so an Arabic placeholder isn't laid out left-to-right.

Check every screen in Arabic at 375 px and 1280 px, in light and dark. See [UI kit](/developers/ui-kit/).

## Server-side text

The server doesn't use Lingui:

- **Mail** (`apps/server/src/mail/`): a typed table per language, keyed by the recipient's
  profile locale. English and Arabic are in `messages.ts`; every other language in
  `messages-<locale>.ts`. A mail kind missing from a language is a type error, and `mail.test.ts` renders every
  kind in each.
  Each language's chrome sets `dir`.
- **Reminders** (`apps/server/src/notify/words.ts`): one wording shared by the email, the push
  payload and the calendar feed.
- **The PDFs** (`apps/server/src/reports/words/`): the inventory, insurance, condition and
  vehicle reports, a move's contents sheets, the readable copy and the claim pack's report, in
  every language Kept speaks. One table per language (`words/<locale>.ts`), gathered in
  `words/index.ts` as a `Record` over `REPORT_LOCALES`, so a missing language or key is a type
  error; `languages.test.ts` checks each has every key English has and renders each kind in each
  language with the report font alone. Each table follows the web catalogue's wording for terms
  the app already uses. How each language writes what isn't a word (its Intl locale, Arabic's
  Eastern digits and right to left, the separator, French's space before a colon, plural forms)
  is in `reports/locale.ts`. Add a language there and in `words/`.
