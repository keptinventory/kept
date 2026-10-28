/**
 * Paperwork: the thing's attachments by role (task 17), under the list standard with the role
 * as a filter in the URL (`f.role`), under the thing's warranties and their coverage bars (step 4,
 * T20: components/warranties).
 * Originals open only for members and above (D117); viewers get the display copy.
 * 1.x (D248, #347): the documents linked from the location's Paperless-ngx are in the same list,
 * after the files, and "Link from Paperless" sits beside "Add a file". The Kind filter narrows
 * both. The links come in one request (at most 50 a thing), so they ride on the files' pages: on
 * the last one loaded.
 */
import { ATTACHMENT_ROLES } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { thingApi, useInvalidateThing, useThingAttachments } from '@/api/inventory/thing-api';
import type { AttachmentRole, AttachmentView, Page } from '@/api/inventory/types';
import type { PaperlessLink } from '@/api/paperless/types';
import { DocumentIcon, ShareIcon, TrashIcon } from '@/components/icons';
import { ListSurface } from '@/components/list-surface';
import { EmptyState, Row, Section, useErrorText } from '@/components/page';
import {
  LinkFromPaperless,
  PaperlessDownNotice,
  PaperlessLinkRow,
  usePaperlessPaperwork,
} from '@/components/paperless/documents';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { useConfirm } from '@/components/ui/confirm';
import { toast } from '@/components/ui/toast';
import { sep, useFormat } from '@/lib/format';
import { firstOf, useListState } from '@/lib/url-state';
import { useThingCtx } from './context';
import { WarrantiesBlock } from './household-lazy';
import { useRoleLabels } from './labels';
import { useAttachmentFile } from './purchase-section';
import { UploadButton } from './upload';

/** A row of the Paperwork list: a file in Kept, or a document linked from Paperless. */
type PaperworkItem = { type: 'file'; file: AttachmentView } | { type: 'link'; link: PaperlessLink };

/** The files' pages with the links after the files of the last page loaded, for ListSurface. */
function useWithLinks(
  query: UseInfiniteQueryResult<InfiniteData<Page<AttachmentView>>>,
  links: readonly PaperlessLink[],
): UseInfiniteQueryResult<InfiniteData<Page<PaperworkItem>>> {
  return useMemo(() => {
    const pages = query.data?.pages;
    const data = query.data && {
      ...query.data,
      pages: (pages ?? []).map((pg, i) => ({
        ...pg,
        items: [
          ...pg.items.map((file): PaperworkItem => ({ type: 'file', file })),
          ...(i === (pages?.length ?? 0) - 1
            ? links.map((link): PaperworkItem => ({ type: 'link', link }))
            : []),
        ],
      })),
    };
    // The same query, its pages holding both kinds of row: ListSurface reads only `data` and the
    // query's own state and calls (pending, error, refetch, the next page).
    return { ...query, data } as unknown as UseInfiniteQueryResult<
      InfiniteData<Page<PaperworkItem>>
    >;
  }, [query, links]);
}

export function PaperworkSection() {
  const { thing, can, moduleOn, role: myRole } = useThingCtx();
  const { t } = useLingui();
  const roles = useRoleLabels();
  const [list] = useListState();
  const role = firstOf(list, 'role');
  const query = useThingAttachments(thing.id, role);
  const invalidate = useInvalidateThing();
  const [uploadRole, setUploadRole] = useState<AttachmentRole>('document');
  const subject = useMemo(() => ({ thingId: thing.id }), [thing.id]);
  const paperless = usePaperlessPaperwork(subject, thing.locationId, { kind: role });
  const rows = useWithLinks(query, paperless.items);
  const name = thing.name ?? '';
  const hasRows = (query.data?.pages[0]?.items.length ?? 0) > 0 || paperless.linked;
  return (
    <Section
      title={
        moduleOn('warranties') ? <Trans>Paperwork and warranties</Trans> : <Trans>Paperwork</Trans>
      }
    >
      <WarrantiesBlock />
      {can('attachments.add') ? (
        <div
          data-tour="thing-paperwork-add"
          className="grid items-end gap-2 rounded-[10px] border border-line bg-surface p-3 md:grid-cols-[minmax(0,16rem)_auto]"
        >
          <Combobox
            label={t`Add as`}
            items={ATTACHMENT_ROLES.map((r) => ({ id: r, label: roles[r] }))}
            selectedKey={uploadRole}
            onSelectionChange={(k) => {
              if (k) setUploadRole(String(k) as AttachmentRole);
            }}
          />
          <div className="flex flex-wrap items-end gap-2">
            <UploadButton
              locationId={thing.locationId}
              subject={{ thingId: thing.id }}
              attachAs={uploadRole}
              label={t`Add a file`}
              onUploaded={() => void invalidate(thing.id)}
            />
            {paperless.connected ? (
              <LinkFromPaperless subject={subject} locationId={thing.locationId} name={name} />
            ) : null}
          </div>
        </div>
      ) : null}
      {paperless.down && paperless.linked ? <PaperlessDownNotice error={paperless.error} /> : null}
      <ListSurface<PaperworkItem>
        label={t`Paperwork`}
        search={false}
        filters={
          // Kind chips once there is something to narrow (or a kind is already chosen).
          !hasRows && !role
            ? []
            : [
                {
                  key: 'role',
                  label: t`Kind`,
                  kind: 'single',
                  values: {
                    from: 'static',
                    options: ATTACHMENT_ROLES.filter((r) => r !== 'photo').map((r) => ({
                      value: r,
                      label: roles[r],
                    })),
                  },
                },
              ]
        }
        query={rows}
        getKey={(r) => (r.type === 'file' ? r.file.id : r.link.id)}
        renderRow={(r) =>
          r.type === 'file' ? (
            <AttachmentRow attachment={r.file} />
          ) : (
            <PaperlessLinkRow
              link={r.link}
              role={myRole}
              name={name}
              subject={subject}
              onCopied={() => void invalidate(thing.id)}
            />
          )
        }
        empty={
          <EmptyState icon={<DocumentIcon />} title={<Trans>No paperwork yet</Trans>}>
            <Trans>Receipts, manuals and warranty cards live here, as the originals.</Trans>
          </EmptyState>
        }
      />
    </Section>
  );
}

function AttachmentRow({ attachment: a }: { attachment: AttachmentView }) {
  const { thing, can, me } = useThingCtx();
  const { t } = useLingui();
  const fmt = useFormat();
  const roles = useRoleLabels();
  const file = useAttachmentFile(a);
  const confirm = useConfirm();
  const errorText = useErrorText();
  const invalidate = useInvalidateThing();
  const mayDelete =
    a.createdBy.displayName === me ? can('attachments.delete-own') : can('attachments.delete-any');
  const size = a.file ? `${fmt.num(Math.max(1, Math.round(a.file.bytes / 1024)))} KB` : null;
  return (
    <Row
      leading={
        a.file?.thumbUrl ? (
          <img src={a.file.thumbUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sunken text-ink-2">
            <DocumentIcon className="size-5" />
          </span>
        )
      }
      title={roles[a.role]}
      subtitle={
        <>
          {a.file?.derivativeState === 'unavailable' ? (
            <>
              <Trans>Preview unavailable</Trans>
              {sep()}
            </>
          ) : null}
          {size ? (
            <>
              {size}
              {sep()}
            </>
          ) : null}
          <bdi>{a.createdBy.displayName}</bdi>
        </>
      }
      trailing={
        <span className="flex gap-1">
          <Button variant="secondary" size="small" isPending={file.pending} onPress={file.press}>
            {file.mode === 'share' ? (
              <>
                <ShareIcon className="size-4" />
                <Trans>Share</Trans>
              </>
            ) : (
              <Trans>Open</Trans>
            )}
          </Button>
          {mayDelete ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t`Remove this ${roles[a.role]}`}
              onPress={async () => {
                if (
                  !(await confirm({
                    title: t`Remove this ${roles[a.role]}?`,
                    body: t`It comes off ${thing.name ?? ''}. The file itself stays until it's purged.`,
                    confirmLabel: t`Remove`,
                    destructive: true,
                  }))
                )
                  return;
                try {
                  await thingApi.deleteAttachment(a.id);
                  await invalidate(thing.id);
                } catch (e) {
                  toast({
                    title: t`Couldn't remove it`,
                    description: errorText(e),
                    tone: 'danger',
                  });
                }
              }}
            >
              <TrashIcon />
            </Button>
          ) : null}
        </span>
      }
    />
  );
}
