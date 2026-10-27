/**
 * "This Kept is set up for <address>. Open it there.", with a link to the same page at that
 * address: on the sign-in page when its requests are refused, and as one strip above the app the
 * first time a save is (lib/origin-mismatch.ts notes it).
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { AlertIcon } from '@/components/icons';
import { Notice } from '@/components/page';
import { sameRouteAt, useOriginMismatch } from '@/lib/origin-mismatch';

function OpenThere({ expected }: { expected: string }) {
  const { t } = useLingui();
  return (
    <a
      href={sameRouteAt(expected)}
      className="font-semibold text-ink underline underline-offset-2 outline-none focus-visible:outline-2 focus-visible:outline-info"
    >
      {t`Open ${expected}`}
    </a>
  );
}

function Sentence({ expected }: { expected: string }) {
  return (
    <Trans>
      This Kept is set up for <bdi className="ltr [overflow-wrap:anywhere]">{expected}</bdi>. Open
      it there.
    </Trans>
  );
}

export function OriginMismatchNotice({ expected }: { expected: string }) {
  return (
    <Notice tone="danger" action={<OpenThere expected={expected} />}>
      <Sentence expected={expected} />
    </Notice>
  );
}

export function OriginMismatchBanner() {
  const expected = useOriginMismatch();
  if (!expected) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-danger bg-surface px-3.5 py-2 text-small text-ink-2 md:px-6"
    >
      <AlertIcon aria-hidden="true" className="size-[18px] shrink-0 text-danger" />
      <span className="min-w-0 flex-1">
        <Sentence expected={expected} />
      </span>
      <OpenThere expected={expected} />
    </div>
  );
}
