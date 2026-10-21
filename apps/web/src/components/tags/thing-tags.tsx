/**
 * A thing's Tags (#209) on its page: its chips, each a link to the tag's page, and for anyone who
 * may edit things the editor (× and "Add tag", ./editors.tsx, loaded on demand; the chips show
 * meanwhile).
 */
import { Trans } from '@lingui/react/macro';
import { Section } from '@/components/page';
import { useThingCtx } from '@/components/things/context';
import { useLocationAccountId } from '@/components/things/pickers';
import { TagChips } from './chip';
import { TagsEditor } from './lazy';

export function ThingTags() {
  const { thing, can, location, refresh } = useThingCtx();
  const accountId = useLocationAccountId(location);
  const canEdit = can('things.edit');
  if (!canEdit && thing.tags.length === 0) return null;
  return (
    <Section title={<Trans>Tags</Trans>}>
      {canEdit ? (
        <TagsEditor
          thingId={thing.id}
          locationId={thing.locationId}
          accountId={accountId}
          tags={thing.tags}
          canCreate={can('tags.create')}
          onChanged={refresh}
          fallback={<TagChips tags={thing.tags} link />}
        />
      ) : (
        <TagChips tags={thing.tags} link />
      )}
    </Section>
  );
}
