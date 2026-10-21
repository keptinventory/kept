/**
 * Tags as a form field (#209): the chosen tags as chips with ×, and "Add tag", the picker (members
 * make one inline). Nothing is sent until the form is saved; the form sends the ids.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useId, useState } from 'react';
import type { ThingTag } from '@/api/inventory/types';
import { PlusIcon, XIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { isolate } from '@/lib/bidi';
import { TagChip } from './chip';
import { TagPicker } from './lazy';

export function TagsField({
  accountId,
  value,
  onChange,
  canCreate,
  label,
}: {
  accountId: string;
  value: readonly ThingTag[];
  onChange: (next: ThingTag[]) => void;
  canCreate: boolean;
  label?: string;
}) {
  const { t } = useLingui();
  const id = useId();
  const [picking, setPicking] = useState(false);
  const name = label ?? t`Tags`;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of chips and a button, named by its label
    <div role="group" aria-labelledby={id} className="grid gap-1.5">
      <span id={id} className="text-small font-semibold text-ink-2">
        {name}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((g) => (
          <TagChip
            key={g.id}
            tag={g}
            end={
              <button
                type="button"
                aria-label={t`Take ${isolate(g.name)} off`}
                onClick={() => onChange(value.filter((x) => x.id !== g.id))}
                className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full text-ink-2 outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-info"
              >
                <XIcon aria-hidden="true" className="size-3.5" />
              </button>
            }
          />
        ))}
        <Button variant="ghost" size="small" onPress={() => setPicking(true)}>
          <PlusIcon className="size-4" />
          <Trans>Add tag</Trans>
        </Button>
      </div>
      <TagPicker
        isOpen={picking}
        onClose={() => setPicking(false)}
        accountId={accountId}
        title={name}
        value={value}
        onApply={onChange}
        canCreate={canCreate}
      />
    </div>
  );
}
