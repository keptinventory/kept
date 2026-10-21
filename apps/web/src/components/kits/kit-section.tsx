/**
 * A kit on its container's page (1.14, #170): the Parts tab. A kit is a container with a parts
 * list, what *should* be in it, so a part moved out, lent or lost isn't forgotten.
 *
 * - Not a kit: "Make this a kit" (its contents ticked as parts, more added by search).
 * - A kit: the header says Complete, "2 parts not in the kit" or "With Sam since 3 Oct"; each
 *   part is In the kit, Elsewhere (where; **Put back** moves it in), Missing (marked not here),
 *   With someone, or In the Trash. **Check this kit** counts it with a scan session whose list is
 *   the parts, wherever they are; **Edit parts** and **No longer a kit** are undoable.
 *
 * Writers are members and above; a viewer reads. Every change needs a connection.
 */
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { householdApi, useKit } from '@/api/household/queries';
import type { Kit } from '@/api/household/types';
import { inventoryApi, useThings } from '@/api/inventory/queries';
import { useOfferUndo } from '@/components/history/undo';
import { BoxIcon } from '@/components/icons';
import { useOnLoanConfirm } from '@/components/lending/on-loan';
import {
  EmptyState,
  ErrorState,
  List,
  LoadingRows,
  Pill,
  type PillTone,
  Row,
  Section,
  useErrorText,
} from '@/components/page';
import { useThingCtx } from '@/components/things/context';
import { useBlocked, useHouseholdDone } from '@/components/things/household';
import { Sheet } from '@/components/things/sheet';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { useConfirm } from '@/components/ui/confirm';
import { DialogFooter } from '@/components/ui/dialog';
import { TickBox } from '@/components/ui/tick-box';
import { toast } from '@/components/ui/toast';
import { isolate } from '@/lib/bidi';
import { sep, useFormat } from '@/lib/format';

export function KitSection() {
  const { thing, can } = useThingCtx();
  const { t } = useLingui();
  const q = useKit(thing.id);
  const blocked = useBlocked();
  const [editing, setEditing] = useState(false);
  const edit = can('things.edit');
  if (q.isPending) return <LoadingRows rows={2} label={t`Loading the kit`} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const kit = q.data.kit;
  return (
    <Section title={<Trans>Parts</Trans>}>
      {kit ? (
        <KitParts kit={kit} onEdit={() => setEditing(true)} />
      ) : (
        <EmptyState
          icon={<BoxIcon />}
          title={<Trans>Not a kit</Trans>}
          action={
            edit ? (
              <Button variant="secondary" isDisabled={!!blocked} onPress={() => setEditing(true)}>
                <Trans>Make this a kit</Trans>
              </Button>
            ) : undefined
          }
        >
          <Trans>
            A kit remembers what should be in it: move a part out or lend it, and the kit still
            knows.
          </Trans>
        </EmptyState>
      )}
      {edit ? <PartsSheet kit={kit} isOpen={editing} onClose={() => setEditing(false)} /> : null}
    </Section>
  );
}

function KitParts({ kit, onEdit }: { kit: Kit; onEdit: () => void }) {
  const { thing, can } = useThingCtx();
  const { t } = useLingui();
  const fmt = useFormat();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const withConfirm = useOnLoanConfirm();
  const errorText = useErrorText();
  const offerUndo = useOfferUndo();
  const done = useHouseholdDone();
  const blocked = useBlocked();
  const edit = can('things.edit');
  const statusText: Record<Kit['parts'][number]['status'], [string, PillTone]> = {
    in_kit: [t`In the kit`, 'ok'],
    elsewhere: [t`Elsewhere`, 'warn'],
    missing: [t`Missing`, 'danger'],
    with_someone: [t`With someone`, 'info'],
    trashed: [t`In the Trash`, 'neutral'],
  };

  const putBack = async (ids: string[]) => {
    try {
      const r = await withConfirm(
        (onLoan) =>
          inventoryApi.move({
            thingIds: ids,
            to: { containerId: thing.id },
            ...(onLoan ? { onLoan: 'confirm' as const } : {}),
          }),
        t`Put it back anyway`,
      );
      if (!r) return;
      offerUndo({ title: t`Put back in ${isolate(thing.name ?? '')}` }, r.auditEvents);
      await done();
    } catch (e) {
      toast({ title: t`Couldn't put it back`, description: errorText(e), tone: 'danger' });
    }
  };

  const dissolve = async () => {
    const ok = await confirm({
      title: t`No longer a kit?`,
      body: t`Its parts stay where they are; only the list goes. You can undo this for 7 days.`,
      confirmLabel: t`No longer a kit`,
    });
    if (!ok) return;
    try {
      const r = await householdApi.dissolveKit(thing.id);
      offerUndo({ title: t`No longer a kit` }, r.auditEvents);
      await done();
    } catch (e) {
      toast({ title: t`Couldn't change it`, description: errorText(e), tone: 'danger' });
    }
  };

  return (
    <div className="grid gap-3" data-tour="kit-parts">
      <p className="m-0 font-semibold text-[16px]">
        {kit.lent ? (
          <Trans>
            With <bdi>{kit.lent.person}</bdi> since {fmt.day(kit.lent.since)}
          </Trans>
        ) : kit.summary.complete ? (
          <Trans>Complete</Trans>
        ) : (
          plural(kit.summary.notInKit, {
            one: '# part not in the kit',
            other: '# parts not in the kit',
          })
        )}
      </p>
      <List aria-label={t`Parts`}>
        {kit.parts.map((p) => {
          const [label, tone] = statusText[p.status];
          return (
            <li key={p.thing.id}>
              <Row
                title={<bdi dir="auto">{p.thing.name ?? t`Unnamed`}</bdi>}
                subtitle={
                  <>
                    {p.quantity !== '1' ? (
                      <>
                        {fmt.num(Number(p.quantity))}
                        {sep()}
                      </>
                    ) : null}
                    {p.with ? (
                      <Trans>
                        with <bdi>{p.with.person}</bdi>
                      </Trans>
                    ) : p.where ? (
                      <Trans>
                        in <bdi>{p.where.name}</bdi>
                      </Trans>
                    ) : null}
                  </>
                }
                trailing={
                  <span className="flex flex-wrap items-center justify-end gap-2">
                    <Pill tone={tone}>{label}</Pill>
                    {edit && (p.status === 'elsewhere' || p.status === 'missing') ? (
                      <Button
                        size="small"
                        variant="secondary"
                        isDisabled={!!blocked}
                        onPress={() => void putBack([p.thing.id])}
                      >
                        <Trans>Put back</Trans>
                      </Button>
                    ) : null}
                  </span>
                }
              />
            </li>
          );
        })}
      </List>
      <div className="flex flex-wrap gap-2">
        {can('things.mark-seen') || !edit ? (
          <Button
            variant="secondary"
            onPress={() =>
              void navigate({ to: '/scan-session', search: { mode: 'count', box: thing.id } })
            }
          >
            <Trans>Check this kit</Trans>
          </Button>
        ) : null}
        {edit ? (
          <>
            <Button variant="secondary" isDisabled={!!blocked} onPress={onEdit}>
              <Trans>Edit parts</Trans>
            </Button>
            <Button variant="ghost" isDisabled={!!blocked} onPress={() => void dissolve()}>
              <Trans>No longer a kit</Trans>
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Make a kit (its contents ticked) or edit its parts. */
function PartsSheet({
  kit,
  isOpen,
  onClose,
}: {
  kit: Kit | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { thing } = useThingCtx();
  const { t } = useLingui();
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={kit ? t`Parts of ${thing.name ?? ''}` : t`Make ${thing.name ?? ''} a kit`}
    >
      {isOpen ? <PartsForm kit={kit} onClose={onClose} /> : null}
    </Sheet>
  );
}

function PartsForm({ kit, onClose }: { kit: Kit | null; onClose: () => void }) {
  const { thing } = useThingCtx();
  const { t } = useLingui();
  const errorText = useErrorText();
  const offerUndo = useOfferUndo();
  const done = useHouseholdDone();
  const inside = useQuery({
    queryKey: ['kit', 'inside', thing.id],
    queryFn: () => inventoryApi.things({ containerId: thing.id, limit: 200 }),
  });
  const all = useThings({ locationId: thing.locationId, limit: 200 });
  const [picked, setPicked] = useState<Map<string, string | null>>(
    () => new Map((kit?.parts ?? []).map((p) => [p.thing.id, p.thing.name])),
  );
  const [seeded, setSeeded] = useState(!!kit);
  const [busy, setBusy] = useState(false);
  const contents = inside.data?.items ?? [];
  // A new kit starts with what is in it now.
  if (!seeded && inside.data) {
    setSeeded(true);
    setPicked(new Map(contents.map((c) => [c.id, c.name])));
  }
  const rows = [
    ...contents.map((c) => ({ id: c.id, name: c.name })),
    ...[...picked]
      .filter(([id]) => !contents.some((c) => c.id === id))
      .map(([id, name]) => ({ id, name })),
  ];
  const options = (all.data?.pages.flatMap((p) => p.items) ?? [])
    .filter((x) => x.id !== thing.id && x.name && !picked.has(x.id))
    .map((x) => ({ id: x.id, label: x.name ?? '' }));

  const save = async () => {
    setBusy(true);
    const body = { parts: [...picked.keys()].map((thingId) => ({ thingId })) };
    try {
      const r = kit
        ? await householdApi.updateKit(thing.id, body, kit.rowVersion)
        : await householdApi.makeKit(thing.id, body);
      offerUndo({ title: kit ? t`Parts changed` : t`Made a kit` }, r.auditEvents);
      await done();
      onClose();
    } catch (e) {
      toast({ title: t`Couldn't save it`, description: errorText(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3.5">
      {rows.length ? (
        <ul aria-label={t`Parts`} className="m-0 grid list-none gap-1.5 p-0">
          {rows.map((r) => (
            <li key={r.id}>
              <TickBox
                isSelected={picked.has(r.id)}
                onChange={(on) =>
                  setPicked((m) => {
                    const next = new Map(m);
                    if (on) next.set(r.id, r.name);
                    else next.delete(r.id);
                    return next;
                  })
                }
              >
                <bdi dir="auto">{r.name ?? t`Unnamed`}</bdi>
              </TickBox>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-ink-2 text-small">
          <Trans>Nothing in it yet: add its parts below.</Trans>
        </p>
      )}
      <Combobox
        label={t`Add a part`}
        items={options}
        selectedKey={null}
        onSelectionChange={(k) => {
          if (!k) return;
          const found = options.find((o) => o.id === String(k));
          setPicked((m) => new Map(m).set(String(k), found?.label ?? null));
        }}
        placeholder={t`Search things here`}
      />
      <DialogFooter>
        <Button variant="secondary" onPress={onClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button isPending={busy} onPress={() => void save()}>
          <Trans>Save</Trans>
        </Button>
      </DialogFooter>
    </div>
  );
}
