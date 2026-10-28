/** Account → Templates (D76, D177): list-standard, with the template sheet. Things or furniture
 * (#238), chosen in the URL (`for`). */
import { Trans, useLingui } from '@lingui/react/macro';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import * as z from 'zod/mini';
import { LoadingRows } from '@/components/page';
import { useRequestedAccountScope } from '@/components/registries/api';
import { PlaceTemplateList } from '@/components/templates/place-template-list';
import { TemplateList } from '@/components/templates/template-list';
import { Segmented } from '@/components/ui/segmented';
import { listSearch } from '@/lib/url-state';

export const Route = createFileRoute('/_app/settings/account/templates')({
  validateSearch: listSearch([], { for: z.optional(z.enum(['things', 'places'])) }),
  component: TemplatesTab,
});

function TemplatesTab() {
  const { t } = useLingui();
  const scope = useRequestedAccountScope();
  const search = Route.useSearch() as { for?: 'things' | 'places' };
  const navigate = useNavigate();
  const which = search.for ?? 'things';
  if (scope.isPending || !scope.accountId) return <LoadingRows rows={3} />;
  return (
    <div className="grid gap-3">
      <Segmented
        label={t`Templates for`}
        value={which}
        onChange={(next) =>
          void navigate({
            to: '.',
            search: ((prev: Record<string, unknown>) => ({
              ...(prev.account ? { account: prev.account } : {}),
              ...(next === 'places' ? { for: 'places' } : {}),
            })) as never,
          })
        }
        options={[
          { id: 'things', label: <Trans>Things</Trans> },
          { id: 'places', label: <Trans>Furniture</Trans> },
        ]}
      />
      {which === 'places' ? (
        <PlaceTemplateList key={scope.accountId} scope={scope} />
      ) : (
        <TemplateList key={scope.accountId} scope={scope} />
      )}
    </div>
  );
}
