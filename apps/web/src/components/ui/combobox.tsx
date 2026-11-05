/**
 * Combobox: the only picker Kept uses. Never a native <select> or an OS picker (the maintainer's
 * no-native-controls rule): those can't be searched, styled, or translated consistently.
 *
 * Type to filter, ArrowDown/ArrowUp to move, Enter to choose, Escape to close. The popover
 * aligns to the field's inline start, so it follows the reading direction.
 *
 *   <Combobox label="Currency" items={[{ id: 'EGP', label: 'Egyptian pound' }]}
 *             selectedKey={code} onSelectionChange={setCode} />
 */
import { useLingui } from '@lingui/react/macro';
import { type ReactNode, useContext, useEffect, useRef } from 'react';
import {
  Button as ButtonPrimitive,
  ComboBox as ComboBoxPrimitive,
  type ComboBoxProps as ComboBoxPrimitiveProps,
  ComboBoxStateContext,
  ComboBoxValue,
  composeRenderProps,
  Group,
  Input,
  type InputProps,
  type Key,
  ListBox,
  ListBoxItem,
  type ListBoxItemProps,
  Popover,
} from 'react-aria-components';
import { CheckIcon, ChevronDownIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Description, type FieldChrome, FieldError, inputClass, Label } from './field';

export type ComboboxOption = {
  id: Key;
  label: string;
  /** A second line, e.g. "Cairo · 12 things". Wraps; never cut off. */
  description?: string;
};

type SelectionMode = 'single' | 'multiple';

export type ComboboxProps<T extends ComboboxOption, M extends SelectionMode = 'single'> = Omit<
  ComboBoxPrimitiveProps<T, M>,
  'children' | 'items' | 'defaultItems'
> &
  FieldChrome & {
    items: Iterable<T>;
    placeholder?: string;
    /** Shown when nothing matches what was typed. */
    emptyText?: ReactNode;
    children?: (item: T) => ReactNode;
    /** Decorative, at the box's inline start: the current choice's flag. 21 px wide at most. */
    leading?: ReactNode;
    /**
     * The field holds a choice rather than a blank: focus selects the text, so the first keystroke
     * replaces it, and a click opens the whole list, as a picker does.
     */
    showsChoice?: boolean;
    inputProps?: { lang?: string; className?: string | undefined };
    /** What a `selectionMode="multiple"` box has chosen, shown below it; describes the box. */
    renderValue?: (selected: T[]) => ReactNode;
  };

/** How long after a tap into the box a scroll counts as the keyboard coming up. */
const KEYBOARD_SETTLES_MS = 700;
/** A close this soon after a scroll was caused by it, not by a choice or Escape. */
const CLOSED_BY_SCROLL_MS = 100;

/** The box of a `showsChoice` Combobox. */
function ChoiceInput(props: InputProps) {
  const state = useContext(ComboBoxStateContext);
  const focused = useRef<{ input: HTMLInputElement; at: number } | null>(null);
  const scrolledAt = useRef(Number.NEGATIVE_INFINITY);
  const wasOpen = useRef(false);
  const isOpen = !!state?.isOpen;
  useEffect(() => {
    if (!isOpen) return;
    const note = () => {
      scrolledAt.current = performance.now();
    };
    window.addEventListener('scroll', note, true);
    return () => window.removeEventListener('scroll', note, true);
  }, [isOpen]);
  // A tap brings up the keyboard and the browser scrolls the box clear of it, and React Aria closes
  // this kind of popover on any scroll around it, so the list would vanish as it opens. Only that
  // close is undone: an open list hides the page from screen readers, so one that came back after
  // a choice or Escape would leave the page unreadable.
  useEffect(() => {
    const justClosed = wasOpen.current && !isOpen;
    wasOpen.current = isOpen;
    if (!justClosed || !focused.current) return;
    const { input, at } = focused.current;
    const now = performance.now();
    if (
      document.activeElement === input &&
      now - at < KEYBOARD_SETTLES_MS &&
      now - scrolledAt.current < CLOSED_BY_SCROLL_MS
    )
      state?.open(null, 'manual');
  });
  return (
    <Input
      {...props}
      onFocus={(e) => {
        // React Aria also fires focus at the box each time the list's highlight moves or clears.
        if (state?.isFocused) return;
        e.currentTarget.select();
        if (window.matchMedia?.('(pointer: coarse)').matches)
          focused.current = { input: e.currentTarget, at: performance.now() };
      }}
      onClick={(e) => {
        if (!state || state.isOpen) return;
        // Again here: Safari's mouse-up undoes what focus selected.
        e.currentTarget.select();
        state.open(null, 'manual');
      }}
    />
  );
}

export function Combobox<T extends ComboboxOption, M extends SelectionMode = 'single'>({
  label,
  description,
  errorMessage,
  items,
  placeholder,
  emptyText,
  children,
  leading,
  showsChoice = false,
  inputProps,
  renderValue,
  className,
  ...props
}: ComboboxProps<T, M>) {
  const { t } = useLingui();
  const BoxInput = showsChoice ? ChoiceInput : Input;
  return (
    <ComboBoxPrimitive<T, M>
      data-slot="combobox"
      defaultItems={items}
      // Keep the popover open with a "No matches" line rather than silently closing.
      allowsEmptyCollection
      className={composeRenderProps(className, (cls) => cn('grid gap-1', cls))}
      {...props}
    >
      {label ? <Label>{label}</Label> : null}
      <Group className="relative flex">
        {leading ? (
          <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center">
            {leading}
          </span>
        ) : null}
        <BoxInput
          {...inputProps}
          className={cn(inputClass, 'pe-11', leading && 'ps-[41px]', inputProps?.className)}
          placeholder={placeholder}
        />
        <ButtonPrimitive
          data-slot="combobox-trigger"
          className="absolute inset-y-0 end-0 grid w-11 cursor-pointer place-items-center rounded-e-lg text-ink-2 outline-none data-hovered:text-ink"
        >
          <ChevronDownIcon />
        </ButtonPrimitive>
      </Group>
      {renderValue ? (
        <ComboBoxValue<T> className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 empty:hidden">
          {({ selectedItems }) => renderValue(selectedItems.filter((i): i is T => i != null))}
        </ComboBoxValue>
      ) : null}
      {description ? <Description>{description}</Description> : null}
      <FieldError>{errorMessage}</FieldError>
      <Popover
        data-slot="combobox-popover"
        offset={6}
        className="z-50 max-h-72 w-(--trigger-width) min-w-48 overflow-y-auto rounded-[10px] border border-line bg-surface text-ink shadow-[0_10px_30px_rgba(0,0,0,.14)] outline-none"
      >
        <ListBox<T>
          className="grid gap-px p-1 outline-none"
          renderEmptyState={() => (
            <div className="px-3 py-2.5 text-small text-ink-3">{emptyText ?? t`No matches`}</div>
          )}
        >
          {children ?? ((item: T) => <ComboboxItem item={item} />)}
        </ListBox>
      </Popover>
    </ComboBoxPrimitive>
  );
}

export function ComboboxItem<T extends ComboboxOption>({
  item,
  content,
  className,
  ...props
}: Omit<ListBoxItemProps<T>, 'id' | 'value' | 'textValue' | 'children'> & {
  item: T;
  /** Drawn in place of the label, e.g. a flag beside a name. The label stays its text value. */
  content?: ReactNode;
}) {
  return (
    <ListBoxItem
      id={item.id}
      value={item}
      textValue={item.label}
      data-slot="combobox-item"
      className={composeRenderProps(className, (cls) =>
        cn(
          'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[15px] leading-snug outline-none data-focused:bg-sunken data-disabled:cursor-not-allowed data-disabled:opacity-50',
          cls,
        ),
      )}
      {...props}
    >
      {({ isSelected }) => (
        <>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="[overflow-wrap:anywhere]">{content ?? item.label}</span>
            {item.description ? (
              <span className="text-small text-ink-3 [overflow-wrap:anywhere]">
                {item.description}
              </span>
            ) : null}
          </span>
          <span className="grid size-5 shrink-0 place-items-center text-ok">
            {isSelected ? <CheckIcon /> : null}
          </span>
        </>
      )}
    </ListBoxItem>
  );
}
