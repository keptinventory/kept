/**
 * Name a file (#183): "Insurance 2026", "Registration card", so a thing's or a home's papers
 * aren't a list of "Document". The name is the attachment's (`PATCH /attachments/:id`, If-Match);
 * an empty one clears it and the row shows its kind again. Who may: as for removing it, your own
 * as a member, anyone's as an owner or admin (`mayChangeAttachment`).
 */
import { can, type Role } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { thingApi } from '@/api/inventory/thing-api';
import type { AttachmentView } from '@/api/inventory/types';
import { useErrorText } from '@/components/page';
import { Sheet } from '@/components/things/sheet';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { isolate } from '@/lib/bidi';

/** As long as the server takes (files/routes.ts AttachmentName). */
export const FILE_NAME_MAX = 200;

/** The row's title: its name, else what it is ("Receipt"). */
export const attachmentTitle = (a: Pick<AttachmentView, 'name' | 'role'>, roleLabel: string) =>
  a.name?.trim() ? a.name : roleLabel;

/** Who may rename (or remove) it: their own for members and up, anyone's for owners and admins. */
export function mayChangeAttachment(
  a: Pick<AttachmentView, 'createdBy'>,
  role: Role,
  me: string,
): boolean {
  return a.createdBy.displayName === me
    ? can(role, 'attachments.delete-own')
    : can(role, 'attachments.delete-any');
}

export function RenameFileSheet({
  attachment,
  what: title,
  onClose,
  onRenamed,
}: {
  /** The file to name; null: closed. */
  attachment: AttachmentView | null;
  /** What it is now, for the title: its name or its kind. */
  what: string;
  onClose: () => void;
  onRenamed: (a: AttachmentView) => void | Promise<void>;
}) {
  const { t } = useLingui();
  return (
    <Sheet
      isOpen={attachment !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t`Name ${title}`}
    >
      {attachment ? (
        <RenameForm attachment={attachment} onClose={onClose} onRenamed={onRenamed} />
      ) : null}
    </Sheet>
  );
}

function RenameForm({
  attachment,
  onClose,
  onRenamed,
}: {
  attachment: AttachmentView;
  onClose: () => void;
  onRenamed: (a: AttachmentView) => void | Promise<void>;
}) {
  const { t } = useLingui();
  const errorText = useErrorText();
  const [name, setName] = useState(attachment.name ?? '');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();
  const save = async () => {
    if (trimmed.length > FILE_NAME_MAX) {
      const NAME_MAX = FILE_NAME_MAX;
      setError(t`Use ${NAME_MAX} characters or fewer.`);
      return;
    }
    setBusy(true);
    try {
      const after = await thingApi.updateAttachment(
        attachment.id,
        { name: trimmed === '' ? null : trimmed },
        attachment.rowVersion,
      );
      await onRenamed(after);
      onClose();
      toast({ title: trimmed ? t`Named ${isolate(trimmed)}` : t`Name cleared`, tone: 'ok' });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      noValidate
      className="grid gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        // The sheet is a portal, but React's submit still bubbles up its tree: opened from a form
        // (the purchase editor's receipts), Enter here would submit that form too.
        e.stopPropagation();
        void save();
      }}
    >
      <TextField
        label={t`Name`}
        value={name}
        onChange={(v) => {
          setName(v);
          setError(undefined);
        }}
        autoFocus
        description={t`What it is, e.g. Insurance 2026. Leave it empty to show its kind.`}
        {...(error ? { errorMessage: error, isInvalid: true } : {})}
      />
      <DialogFooter>
        <Button variant="secondary" onPress={onClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button type="submit" isPending={busy}>
          <Trans>Save</Trans>
        </Button>
      </DialogFooter>
    </form>
  );
}
