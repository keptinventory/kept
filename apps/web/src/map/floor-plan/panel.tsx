/**
 * "Rooms from the plan" (1.14.3, D266, spec §5.3, §6): the review's panel, in the map's card place
 * (the side panel on a wide screen, the bottom sheet on a phone). It is the full alternative to
 * the canvas: every change the map offers is a field here, for a keyboard or a screen reader.
 *
 * - The scale line says where the scale came from; Set a room's size fixes it in one step.
 * - One group per plan floor, with the floor it goes to (the app's Select, never a native one).
 * - One row per proposed room: Add (a Switch), its name, its size, its kind, and one note.
 */
import { MAP_ROOM_KINDS, type MapRoomKind } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Button as AriaButton,
  Group,
  I18nProvider,
  Input,
  NumberField,
} from 'react-aria-components';
import { ChevronEndIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter, Modal } from '@/components/ui/dialog';
import { Label } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { TickBox } from '@/components/ui/tick-box';
import { useFormat } from '@/lib/format';
import { formatLocale, usePrefs } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import type { Level } from '../layout';
import { isNewLevel, newLevelKey, type Proposal, type Review } from './review';

/** Metres to the 10 cm, as the map's sizes are (D267). */
const tenth = (m: number) => Math.round(m * 10) / 10;

function MetreField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <NumberField
      className="kmap-height"
      value={value}
      minValue={1}
      maxValue={100}
      step={0.1}
      formatOptions={{ maximumFractionDigits: 1, minimumFractionDigits: 1 }}
      onChange={(v) => {
        if (Number.isFinite(v)) onChange(tenth(v));
      }}
    >
      <Label>{label}</Label>
      <Group className="kmap-height-row">
        <AriaButton slot="decrement">−</AriaButton>
        <Input className="kmap-input" />
        <AriaButton slot="increment">+</AriaButton>
      </Group>
    </NumberField>
  );
}

/** "Set a room's size": one room's real size rescales the whole plan (spec §6). */
export function SizeDialog({
  proposal,
  onClose,
  onRescale,
}: {
  proposal: Proposal | null;
  onClose: () => void;
  onRescale: (key: string, w: number, d: number) => void;
}) {
  const { t } = useLingui();
  const { locale, digits } = usePrefs();
  const [w, setW] = useState(proposal?.w ?? 3);
  const [d, setD] = useState(proposal?.d ?? 3);
  useEffect(() => {
    if (!proposal) return;
    setW(proposal.w);
    setD(proposal.d);
  }, [proposal]);
  const room = proposal?.name ?? '';
  return (
    <Modal isOpen={proposal !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <Dialog
        title={
          <Trans>
            <bdi>{room}</bdi> is…
          </Trans>
        }
      >
        {({ close }) => (
          <div className="grid gap-4">
            <I18nProvider locale={formatLocale(locale, digits)}>
              <div className="kmap-size">
                <MetreField label={t`Width (m)`} value={w} onChange={setW} />
                <MetreField label={t`Depth (m)`} value={d} onChange={setD} />
              </div>
            </I18nProvider>
            <DialogFooter>
              <Button
                variant="primary"
                onPress={() => {
                  if (proposal) onRescale(proposal.key, w, d);
                  close();
                }}
              >
                <Trans>Rescale</Trans>
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>
    </Modal>
  );
}

type PanelProps = {
  review: Review;
  /** The location's name, for "Keep the plan with …". */
  location: string;
  /** The map's levels (existing floors, and the no-floor level), for the floor picker. */
  levels: readonly Level[];
  /** The level a new floor would be ("Floor n"). */
  newFloorName: (index: number) => string;
  selected: string | null;
  onSelect: (key: string) => void;
  onEdit: (key: string, change: Partial<Proposal>) => void;
  onFloor: (index: number, levelKey: string) => void;
  onRescale: (key: string, w: number, d: number) => void;
  keepPlan: boolean;
  onKeepPlan: (keep: boolean) => void;
  /** Said under the heading (a conflict), when there is something to say. */
  message?: ReactNode;
};

export function PlanPanel(props: PanelProps) {
  const { review, selected, location } = props;
  const { t } = useLingui();
  const f = useFormat();
  const [sizing, setSizing] = useState<Proposal | null>(null);
  const scale = review.drafts.scale;
  const room = review.proposals.find((p) => p.key === scale.typedKey)?.name ?? '';
  const n = f.num(scale.agree);
  const m = f.num(scale.of);
  const scaleLine =
    scale.from === 'typed'
      ? t`Scale from ${room}’s size`
      : scale.from === 'sizes'
        ? t`Sizes from the plan: ${n} of ${m} rooms agree`
        : scale.from === 'scale_bar'
          ? t`Scale from the plan’s scale bar`
          : scale.from === 'doors'
            ? t`Scale from the doors, taken as 80 cm wide: check one room`
            : t`No sizes on the plan: these are a guess`;
  const target =
    review.proposals.find((p) => p.key === selected && !p.skip) ??
    review.proposals.find((p) => p.on && !p.skip) ??
    null;

  return (
    <section
      data-map-obstacle
      data-map-reserve="bottom"
      data-map-side
      className="kmap-panel kplan"
      aria-label={t`Rooms from the plan`}
    >
      <h2>
        <Trans>Rooms from the plan</Trans>
      </h2>
      {props.message ? (
        <p role="alert" className="kplan-note warn">
          {props.message}
        </p>
      ) : null}
      <div className="kplan-scale">
        <span>{scaleLine}</span>
        <button
          type="button"
          className="kmap-btn"
          onClick={() => setSizing(target)}
          disabled={!target}
        >
          <Trans>Set a room’s size</Trans>
        </button>
      </div>
      {review.drafts.more ? (
        <p className="kplan-note">
          <Trans>Kept read the first 60 rooms. Add the rest by drawing.</Trans>
        </p>
      ) : null}
      {review.floors.map((fl) => (
        <FloorGroup key={fl.index} {...props} floorIndex={fl.index} />
      ))}
      <TickBox isSelected={props.keepPlan} onChange={props.onKeepPlan}>
        <Trans>
          Keep the plan with <bdi>{location}</bdi>
        </Trans>
      </TickBox>
      <SizeDialog proposal={sizing} onClose={() => setSizing(null)} onRescale={props.onRescale} />
    </section>
  );
}

function FloorGroup(props: PanelProps & { floorIndex: number }) {
  const { review, levels, floorIndex } = props;
  const { t } = useLingui();
  const fl = review.floors.find((x) => x.index === floorIndex);
  if (!fl) return null;
  const rows = review.proposals.filter((p) => p.floor === floorIndex);
  const items = [
    ...levels.map((l) => ({ id: l.key, name: l.name })),
    { id: newLevelKey(floorIndex), name: t`A new floor` },
  ];
  const label = fl.label ?? props.newFloorName(floorIndex);
  return (
    <div className="kplan-floor">
      <div className="kplan-floor-head">
        <span className="kplan-floor-name">
          <bdi>{label}</bdi>
        </span>
        <ChevronEndIcon aria-hidden="true" className="mb-3 size-4 shrink-0 text-ink-3" />
        <Select
          className="min-w-0 flex-1"
          label={t`Floor`}
          items={items}
          value={isNewLevel(fl.levelKey) ? newLevelKey(floorIndex) : fl.levelKey}
          onChange={(k) => {
            if (k !== null) props.onFloor(floorIndex, String(k));
          }}
        >
          {(item) => (
            <SelectItem id={item.id} textValue={item.name}>
              {item.name}
            </SelectItem>
          )}
        </Select>
      </div>
      <ul className="kplan-rows">
        {rows.map((p) => (
          <ProposalRow key={p.key} {...props} p={p} />
        ))}
      </ul>
    </div>
  );
}

function ProposalRow(props: PanelProps & { p: Proposal }) {
  const { p, selected } = props;
  const { t } = useLingui();
  const f = useFormat();
  const { locale, digits } = usePrefs();
  const [sizeOpen, setSizeOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const isSelected = selected === p.key;
  useEffect(() => {
    if (isSelected) ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [isSelected]);
  const one = (v: number) => f.num(tenth(v));
  const kinds: Record<MapRoomKind, string> = {
    room: t`Room`,
    balcony: t`Balcony`,
    terrace: t`Terrace`,
    garden: t`Garden`,
  };
  const room = p.name;
  const printed = p.printed;
  const existing = p.useName ?? '';
  const size = printed?.text ?? '';
  const w = one(p.w);
  const d = one(p.d);
  // At most one note, the one that matters most.
  const note: ReactNode = p.skip ? (
    <span className="kplan-note warn">
      <Trans>Under 1 m: too small for the map.</Trans>
    </span>
  ) : p.arranged ? (
    <span className="kplan-note">
      <Trans>Already on the map.</Trans>
    </span>
  ) : p.use ? (
    <span className="kplan-note">
      <Trans>
        Uses your <bdi>{existing}</bdi>
      </Trans>{' '}
      <button
        type="button"
        className="kplan-link"
        onClick={() => props.onEdit(p.key, { use: null, useName: null })}
      >
        <Trans>Make a new room</Trans>
      </button>
    </span>
  ) : p.notes.includes('not_rectangle') ? (
    <span className="kplan-note">
      <Trans>Not a rectangle: drawn as its largest part.</Trans>
    </span>
  ) : p.notes.includes('size_disagrees') && printed ? (
    <button
      type="button"
      className="kplan-link kplan-note"
      onClick={() => props.onEdit(p.key, { w: tenth(printed.w), d: tenth(printed.d) })}
    >
      <Trans>
        The plan says <bdi>{size}</bdi>.
      </Trans>
    </button>
  ) : p.notes.includes('name_unclear') ? (
    <span className="kplan-note">
      <Trans>Name unclear on the plan.</Trans>
    </span>
  ) : null;

  return (
    <li
      ref={ref}
      className={cn('kplan-row', isSelected && 'selected', !p.on && 'off')}
      data-key={p.key}
    >
      <div className="kplan-row-head">
        <Switch
          isSelected={p.on && !p.skip}
          isDisabled={p.skip}
          aria-label={t`Add ${room}`}
          onChange={(on) => props.onEdit(p.key, { on })}
        />
        <button type="button" className="kplan-pick" onClick={() => props.onSelect(p.key)}>
          <bdi>{p.name}</bdi>
        </button>
      </div>
      <TextField
        label={t`Name`}
        value={p.name}
        onChange={(name) => props.onEdit(p.key, { name })}
        isDisabled={p.skip}
      />
      <div className="kplan-size">
        <span className="font-semibold text-[12px] text-ink-3 leading-none tracking-[.02em]">
          <Trans>Size</Trans>
        </span>
        <button
          type="button"
          className="kmap-btn"
          aria-expanded={sizeOpen}
          disabled={p.skip}
          onClick={() => setSizeOpen((x) => !x)}
        >
          <Trans>
            {w} × {d} m
          </Trans>
        </button>
      </div>
      {sizeOpen && !p.skip ? (
        <I18nProvider locale={formatLocale(locale, digits)}>
          <div className="kmap-size">
            <MetreField
              label={t`Width (m)`}
              value={p.w}
              onChange={(w) => props.onEdit(p.key, { w })}
            />
            <MetreField
              label={t`Depth (m)`}
              value={p.d}
              onChange={(d) => props.onEdit(p.key, { d })}
            />
          </div>
        </I18nProvider>
      ) : null}
      <Segmented
        label={t`Kind`}
        value={p.kind}
        onChange={(kind) => props.onEdit(p.key, { kind })}
        options={MAP_ROOM_KINDS.map((k) => ({ id: k, label: kinds[k], isDisabled: p.skip }))}
      />
      {note}
    </li>
  );
}
