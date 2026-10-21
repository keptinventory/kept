/**
 * A registry row's icon: a person's initials, a tag's colour (#209), or the kind's tile. Its own
 * module, so the brand, person and vendor pages (precached) don't pull in the account settings'
 * list.
 */
import type { RegistryPathKind } from '@/api/inventory/paths';
import type { RegistryItem, Tag } from '@/api/inventory/types';
import { BriefcaseIcon, LinkIcon, ShieldIcon } from '@/components/icons';
import { Avatar, IconTile } from '@/components/page';
import { TagDot } from '@/components/tags/chip';
import { registryName } from './registry-edit-sheet';

type Item = RegistryItem[RegistryPathKind];

export function RegistryIcon({ kind, item }: { kind: RegistryPathKind; item: Item }) {
  if (kind === 'people') return <Avatar name={registryName(item)} />;
  // A tag's own colour (#209), or the plain tile when it has none.
  if (kind === 'tags' && (item as Tag).colour)
    return (
      <IconTile>
        <TagDot colour={(item as Tag).colour} className="size-3.5" />
      </IconTile>
    );
  return (
    <IconTile>
      {kind === 'brands' ? <ShieldIcon /> : kind === 'vendors' ? <BriefcaseIcon /> : <LinkIcon />}
    </IconTile>
  );
}
