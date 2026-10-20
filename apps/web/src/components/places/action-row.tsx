/** A row on a place's page that does something (Count here, Rename, Move…): an icon tile, a
 * title and a line under it, as a button when it can be pressed. */
import type { ReactNode } from 'react';
import { Row } from '@/components/page';

export function ActionRow({
  icon,
  title,
  subtitle,
  onPress,
  danger = false,
  trailing,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  trailing?: ReactNode;
}) {
  const row = (
    <Row
      leading={
        <span
          aria-hidden="true"
          className={`grid size-10 shrink-0 place-items-center rounded-[10px] bg-sunken [&_svg]:size-5 ${danger ? 'text-danger' : 'text-ink-2'}`}
        >
          {icon}
        </span>
      }
      title={<span className={danger ? 'text-danger' : undefined}>{title}</span>}
      subtitle={subtitle}
      trailing={trailing}
    />
  );
  return (
    <li>
      {onPress ? (
        <button
          type="button"
          onClick={onPress}
          className="block w-full cursor-pointer bg-transparent p-0 text-start outline-none hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info"
        >
          {row}
        </button>
      ) : (
        row
      )}
    </li>
  );
}
