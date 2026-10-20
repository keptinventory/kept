/**
 * Where an import comes from: a spreadsheet (step
 * 3's CSV flow, unchanged), a Homebox export, or a Kept export. Homebox's help names its own menu
 * path and the version that makes the export ZIP: v0.26.1 or newer (v0.26.0's Docker image loses
 * attachments), v0.27.0 recommended; an older Homebox imports its spreadsheet, or is updated on a
 * copy first. Choosing an archive moves to its upload; the CSV flow keeps its own file step below
 * this.
 */
import type { ArchiveSource } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { ChoiceCards } from '@/components/ui/segmented';

export type ImportSourceChoice = 'csv' | ArchiveSource;

/** The docs' way from a Homebox older than v0.26 (apps/docs users/import-export.md). */
export const OLDER_HOMEBOX_DOCS =
  'https://keptinventory.info/users/import-export/#coming-from-an-older-homebox';

export function SourceStep({
  value,
  onChange,
}: {
  value: ImportSourceChoice;
  onChange: (source: ImportSourceChoice) => void;
}) {
  const { t } = useLingui();
  return (
    <ChoiceCards<ImportSourceChoice>
      label={t`Import from`}
      value={value}
      onChange={onChange}
      options={[
        {
          id: 'csv',
          title: <Trans>A spreadsheet (CSV)</Trans>,
          body: <Trans>One thing per row, with a header row naming the columns.</Trans>,
        },
        {
          id: 'homebox_zip',
          title: <Trans>A Homebox export</Trans>,
          body: (
            <Trans>
              Homebox v0.26.1 or newer (v0.27.0 recommended): Collection settings → Export. Older
              than v0.26: import its spreadsheet export, or update a copy of Homebox first.
            </Trans>
          ),
        },
        {
          id: 'kept_zip',
          title: <Trans>A Kept export</Trans>,
          body: (
            <Trans>
              A location exported from this Kept or another one. It comes in as a new location.
            </Trans>
          ),
        },
      ]}
    />
  );
}
