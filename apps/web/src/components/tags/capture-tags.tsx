/**
 * Capture's tags (#209): the tags every new thing of this capture run gets, kept from one photo
 * to the next as the place is. A chip on the dark capture screen opens the picker; members make a
 * tag inline. The capture queues them with each thing, so they work offline too.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Button } from 'react-aria-components';
import type { ThingTag } from '@/api/inventory/types';
import { TagIcon } from '@/components/icons';
import { sep } from '@/lib/format';
import { TagPicker } from './lazy';

export function CaptureTags({
  accountId,
  value,
  onChange,
  canCreate,
}: {
  accountId: string;
  value: readonly ThingTag[];
  onChange: (next: ThingTag[]) => void;
  canCreate: boolean;
}) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const names = value.map((g) => g.name).join(sep());
  return (
    <>
      <Button
        onPress={() => setOpen(true)}
        className="mx-3 mt-2 inline-flex min-h-11 max-w-[calc(100%-1.5rem)] cursor-pointer items-center gap-2 justify-self-start rounded-full border border-[#34302A] bg-[#1E1C19] px-3.5 text-start text-[#F2EFE9] text-[14px] outline-none data-focus-visible:outline-2 data-focus-visible:outline-[#F2EFE9]"
      >
        <TagIcon aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {value.length ? (
            <Trans>
              Tags: <bdi>{names}</bdi>
            </Trans>
          ) : (
            <Trans>Add tags</Trans>
          )}
        </span>
      </Button>
      <TagPicker
        isOpen={open}
        onClose={() => setOpen(false)}
        accountId={accountId}
        title={t`Tags`}
        value={value}
        onApply={onChange}
        canCreate={canCreate}
      />
    </>
  );
}
