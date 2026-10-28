/**
 * A thing's or a place's Paperless-ngx documents (1.x, D248), in its Paperwork section, in one
 * list with its files (#347): each linked document's thumbnail, title, kind, type, correspondent
 * and date as Kept last saw them, with its kind to change, "Open in Paperless", Download (members
 * and up), "Copy into Kept" and Unlink. "Link from Paperless" sits beside "Add a file". The list
 * never waits for Paperless: when it can't be reached the titles still show, with a notice saying
 * so. Shown only where the location is connected, or where links remain.
 *
 * The Paperwork list's Kind filter (`f.role`) narrows these too: a link's kind is one of the
 * attachment roles.
 */
import { can, type Role } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { isApiError } from '@/api/client';
import { paperlessPaths } from '@/api/paperless/paths';
import {
  paperlessApi,
  paperlessKeys,
  usePaperlessLinks,
  usePaperlessStatus,
} from '@/api/paperless/queries';
import {
  PAPERLESS_KINDS,
  type PaperlessKind,
  type PaperlessLink,
  type PaperlessSubject,
} from '@/api/paperless/types';
import { useMe } from '@/api/queries';
import { DocumentIcon, LinkIcon, TrashIcon } from '@/components/icons';
import { Notice, Pill, Row, useErrorText } from '@/components/page';
import { useRoleLabels } from '@/components/things/labels';
import { Button, buttonClass } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { Select, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { sep, useFormat } from '@/lib/format';
import { useOnline } from '@/lib/online';
import { PaperlessPicker } from './picker';
import { usePaperlessErrorWords } from './words';

/** A Paperless thumbnail through Kept's server, or the document icon when it can't load. */
export function PaperlessThumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-sunken text-ink-2">
        <DocumentIcon className="size-5" />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-12 shrink-0 rounded-lg border border-line bg-white object-cover object-top"
    />
  );
}

/**
 * A thing's or a place's Paperless links for its Paperwork list (of `kind` when the list's Kind
 * filter has one), whether the location is connected, and whether Paperless answers.
 */
export function usePaperlessPaperwork(
  subject: PaperlessSubject,
  locationId: string,
  { kind, enabled = true }: { kind?: string | undefined; enabled?: boolean } = {},
) {
  const links = usePaperlessLinks(subject, enabled);
  const connected = links.data?.connected ?? false;
  const status = usePaperlessStatus(locationId, enabled && connected);
  const all = links.data?.items ?? [];
  return {
    items: all.filter((l) => !kind || l.kind === kind),
    /** Any links at all, whatever the filter. */
    linked: all.length > 0,
    connected,
    down: status.data?.reachable === false,
    error: status.data?.error,
  };
}

/** "Link from Paperless", beside "Add a file": the picker that searches and links. */
export function LinkFromPaperless({
  subject,
  locationId,
  name,
}: {
  subject: PaperlessSubject;
  locationId: string;
  /** The thing's or place's name, for the picker's title. */
  name: string;
}) {
  const online = useOnline();
  const [picking, setPicking] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        size="small"
        isDisabled={!online}
        onPress={() => setPicking(true)}
      >
        <LinkIcon className="size-4" />
        <Trans>Link from Paperless</Trans>
      </Button>
      {picking ? (
        <PaperlessPicker
          locationId={locationId}
          subject={subject}
          name={name}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </>
  );
}

/** Paperless can't be reached: the linked documents below show as Kept last saw them. */
export function PaperlessDownNotice({ error }: { error: string | null | undefined }) {
  const words = usePaperlessErrorWords();
  return (
    <Notice tone="warn" title={<Trans>Paperless can't be reached</Trans>}>
      {words(error)} <Trans>The titles below are as Kept last saw them.</Trans>
    </Notice>
  );
}

export function PaperlessLinkRow({
  link: l,
  role,
  name,
  subject,
  onCopied,
}: {
  link: PaperlessLink;
  role: Role;
  name: string;
  subject: PaperlessSubject;
  onCopied?: (() => void) | undefined;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const roles = useRoleLabels();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const errorText = useErrorText();
  const words = usePaperlessErrorWords();
  const online = useOnline();
  const [busy, setBusy] = useState<'copy' | 'unlink' | 'kind' | null>(null);
  const me = useMe();
  const writer = can(role, 'attachments.add');
  // Changing its kind and unlinking it are as for an attachment: your own as a member and up,
  // anyone's as an owner or admin (the server checks the same).
  const mayChange =
    l.createdBy.id === me.data?.user.id
      ? can(role, 'attachments.delete-own')
      : can(role, 'attachments.delete-any');
  const title = l.title;
  const refresh = () => qc.invalidateQueries({ queryKey: paperlessKeys.links(subject) });
  const failure = (e: unknown) => {
    const code = isApiError(e) ? (e.details.paperlessError as string | undefined) : undefined;
    return code ? (words(code) ?? errorText(e)) : errorText(e);
  };
  const copy = async () => {
    setBusy('copy');
    try {
      await paperlessApi.copy(l.id);
      await refresh();
      onCopied?.();
      toast({ title: t`Copied into Kept`, tone: 'ok' });
    } catch (e) {
      toast({ title: t`Couldn't copy it`, description: failure(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };
  const setKind = async (kind: PaperlessKind) => {
    if (kind === l.kind) return;
    setBusy('kind');
    try {
      await paperlessApi.setKind(l.id, l.rowVersion, kind);
      await refresh();
    } catch (e) {
      toast({ title: t`Couldn't change its kind`, description: errorText(e), tone: 'danger' });
      await refresh();
    } finally {
      setBusy(null);
    }
  };
  const unlink = async () => {
    const yes = await confirm({
      title: t`Unlink this document?`,
      body: l.copiedAttachmentId
        ? t`It comes off ${name}. Paperless keeps it, and the copy in Kept stays.`
        : t`It comes off ${name}. Paperless keeps it.`,
      confirmLabel: t`Unlink`,
      destructive: true,
    });
    if (!yes) return;
    setBusy('unlink');
    try {
      await paperlessApi.unlink(l.id);
      await refresh();
    } catch (e) {
      toast({ title: t`Couldn't unlink it`, description: errorText(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };
  const details = [
    // The kind picker shows it to those who may change it.
    mayChange ? null : roles[l.kind],
    l.typeName && l.typeName !== roles[l.kind] ? l.typeName : null,
    l.correspondent,
  ]
    .filter(Boolean)
    .join(fmt.sep);
  return (
    <Row
      leading={<PaperlessThumb src={paperlessPaths.linkThumb(l.id)} />}
      title={<bdi>{l.title}</bdi>}
      subtitle={
        <>
          {details ? <bdi>{details}</bdi> : null}
          {l.createdOn ? (
            <>
              {details ? sep() : null}
              {fmt.day(l.createdOn)}
            </>
          ) : null}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
        {mayChange ? (
          <Select
            aria-label={t`Kind of ${title}`}
            items={PAPERLESS_KINDS.map((k) => ({ id: k, name: roles[k] }))}
            value={l.kind}
            onChange={(k) => {
              if (k) void setKind(String(k) as PaperlessKind);
            }}
            isDisabled={!online || busy === 'kind'}
            triggerClassName="min-h-8 w-auto py-1 text-[12.5px]"
          >
            {(k) => (
              <SelectItem id={k.id} textValue={k.name}>
                {k.name}
              </SelectItem>
            )}
          </Select>
        ) : null}
        <a
          href={l.openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass('secondary', 'small')}
        >
          <Trans>Open in Paperless</Trans>
        </a>
        {writer ? (
          <a
            href={paperlessPaths.linkPreview(l.id)}
            className={buttonClass('ghost', 'small')}
            download
          >
            <Trans>Download</Trans>
          </a>
        ) : null}
        {l.copiedAttachmentId ? (
          <Pill tone="ok">
            <Trans>Copied into Kept</Trans>
          </Pill>
        ) : writer ? (
          <Button
            variant="ghost"
            size="small"
            isDisabled={!online}
            isPending={busy === 'copy'}
            onPress={() => void copy()}
          >
            <Trans>Copy into Kept</Trans>
          </Button>
        ) : null}
        {mayChange ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t`Unlink ${l.title}`}
            isDisabled={!online}
            isPending={busy === 'unlink'}
            onPress={() => void unlink()}
          >
            <TrashIcon />
          </Button>
        ) : null}
      </div>
    </Row>
  );
}
