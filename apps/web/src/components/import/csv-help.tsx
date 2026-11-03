/**
 * The CSV import's help under "Choose a CSV file" (discussion 381): the columns Kept reads
 * (FIELD_ORDER, the mapping step's list, so the two never differ), how places, lists and dates are
 * written, a sample file to start from, and the docs. The sample is made on the page: invented
 * things whose headers the mapping step matches by itself (suggest.ts), places as paths with the
 * default separator.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { AiDisclosure } from '@/components/ai/disclosure';
import { DocumentIcon } from '@/components/icons';
import { Button, buttonClass } from '@/components/ui/button';
import { saveFile } from '@/lib/files';
import { FIELD_ORDER, useFieldLabel } from './labels';

/** The docs' CSV section (apps/docs users/import-export.md, "A spreadsheet (CSV)"). */
export const CSV_IMPORT_DOCS = 'https://keptinventory.info/users/import-export/#a-spreadsheet-csv';

export const SAMPLE_CSV_NAME = 'kept-sample.csv';

/** Invented things, never anyone's own. Every header maps without a choice. */
export const SAMPLE_CSV = [
  'Name,Quantity,Place,Brand,Tags,Purchase date,Price,Notes',
  'Cordless drill,1,Garage > Shelf A,Brightline,"tools, power tools",2024-03-12,89.99,With two batteries',
  'Camping tent,1,Garage > Shelf B,Fieldmark,"camping, outdoors",2023-06-02,149.00,Four people',
  'Extension cord,2,Garage > Shelf A,,tools,,,10 m',
  'AA batteries,24,Hallway > Drawer,,household,2025-01-20,6.50,',
  'Winter coat,1,Bedroom > Wardrobe,,clothes,,,',
].join('\r\n');

/** A byte order mark, so a spreadsheet opens the sample as UTF-8. */
const BOM = String.fromCharCode(0xfeff);

/** The fields listed: every one a column can go to, except "Don't import". */
const LISTED = FIELD_ORDER.filter((f) => f !== 'ignore');

export function CsvHelp() {
  const { t } = useLingui();
  const fieldLabel = useFieldLabel();
  return (
    <section className="grid gap-3" aria-labelledby="import-csv-help">
      <h2 id="import-csv-help" className="m-0 font-semibold text-[17px]">
        <Trans>What the file can hold</Trans>
      </h2>
      <p className="m-0 text-small text-ink-2">
        <Trans>
          The first row names the columns, in any of Kept's languages. Kept matches the names it
          knows, and you choose the rest in the next step. Only a name is needed.
        </Trans>
      </p>
      <AiDisclosure title={<Trans>The columns Kept reads</Trans>}>
        <div className="grid gap-3 px-1 pt-1 text-small">
          <ul aria-label={t`The columns Kept reads`} className="m-0 grid gap-1 ps-5">
            {LISTED.map((f) => (
              <li key={f}>{fieldLabel(f)}</li>
            ))}
            <li>
              <Trans>A field of your own types, such as Wattage</Trans>
            </li>
          </ul>
          <ul className="m-0 grid gap-1 ps-5 text-ink-2">
            <li>
              <Trans>
                Place: from the top down, separated by &gt;, like Garage &gt; Shelf A. Another
                separator can be chosen.
              </Trans>
            </li>
            <li>
              <Trans>Tags and other names: separated by commas.</Trans>
            </li>
            <li>
              <Trans>
                Dates: written the same way all through the file, like 2026-10-29 or 29/10/2026.
              </Trans>
            </li>
            <li>
              <Trans>Prices: a number, without the currency sign.</Trans>
            </li>
          </ul>
        </div>
      </AiDisclosure>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onPress={() =>
            saveFile(new File([`${BOM}${SAMPLE_CSV}\r\n`], SAMPLE_CSV_NAME, { type: 'text/csv' }))
          }
        >
          <DocumentIcon className="size-4" />
          <Trans>Download a sample CSV</Trans>
        </Button>
        <a
          href={CSV_IMPORT_DOCS}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass('ghost')}
        >
          <Trans>How importing works</Trans>
        </a>
      </div>
    </section>
  );
}
