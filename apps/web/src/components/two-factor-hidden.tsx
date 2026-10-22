/**
 * A location of yours that asks for two-factor, while this session hasn't proven a second factor:
 * the server hides it everywhere (row-level security), and `GET /me`'s `twoFactorHidden` names
 * it, only to its own members. The location page says why and what to do, and the lists (the
 * sidebar, Home, Settings → Locations) show it with a lock rather than leaving it out. Turning on
 * the authenticator app proves a second factor in this session (Settings → Two-factor refreshes
 * /me and the locations), so the location opens without a reload; a new passkey counts once you
 * sign in with it.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { useMe } from '@/api/queries';
import type { TwoFactorHiddenLocation } from '@/api/types';
import { ChevronEndIcon, LockIcon } from '@/components/icons';
import { KindIcon } from '@/components/kind-icon';
import { LinkButton, Notice } from '@/components/page';
import { SIGN_IN_SECURITY_ANCHOR } from '@/components/sign-in-security';
import { locationIdOf } from '@/lib/address';

/** Your locations this session can't open until it proves a second factor. */
export function useTwoFactorHidden(): TwoFactorHiddenLocation[] {
  return useMe().data?.twoFactorHidden ?? [];
}

/** The hidden location an address names: its id, or a readable address (`/loc/workshop-3f9c2a1b`). */
export function hiddenAt(
  hidden: readonly TwoFactorHiddenLocation[],
  param: string,
): TwoFactorHiddenLocation | null {
  const id = locationIdOf(
    param,
    hidden.map((h) => ({ id: h.locationId })),
  );
  return hidden.find((h) => h.locationId === id) ?? null;
}

/** Why the location doesn't open, and the way to Settings → Sign-in and security. */
export function TwoFactorHiddenNotice({ name }: { name: string }) {
  return (
    <Notice
      tone="warn"
      title={
        <Trans>
          <bdi>{name}</bdi> asks for two-factor
        </Trans>
      }
    >
      <div className="grid gap-3">
        <p className="m-0">
          <Trans>
            Turn on an authenticator app to open it, or add a passkey and sign in with it.
          </Trans>
        </p>
        <div>
          <LinkButton to="/settings" hash={SIGN_IN_SECURITY_ANCHOR} variant="primary">
            <LockIcon />
            <span>
              <Trans>Set up two-factor</Trans>
            </span>
          </LinkButton>
        </div>
      </div>
    </Notice>
  );
}

/** The line a list shows under a hidden location's name. */
export function TwoFactorHiddenLine() {
  return <Trans>Asks for two-factor: set it up to open it</Trans>;
}

/** Home's card for a hidden location: its name, a lock, and the way to open it. */
export function TwoFactorHiddenCard({ location }: { location: TwoFactorHiddenLocation }) {
  const { t } = useLingui();
  return (
    <Link
      to="/loc/$id"
      params={{ id: location.locationId }}
      aria-label={t`${location.name}, asks for two-factor`}
      className="grid min-h-[104px] content-start gap-2 rounded-xl border border-line border-dashed px-3 pt-3 pb-[13px] text-ink no-underline outline-none hover:border-ink-3 focus-visible:outline-2 focus-visible:outline-info"
    >
      <span className="flex items-center gap-2 font-semibold text-[15px] leading-snug [overflow-wrap:anywhere]">
        <KindIcon kind={location.kind} className="size-[18px] shrink-0 text-ink-2" />
        <bdi className="min-w-0">{location.name}</bdi>
        <LockIcon className="size-4 shrink-0 text-ink-3" />
        <ChevronEndIcon className="ms-auto size-[18px] shrink-0 text-ink-3" />
      </span>
      <span className="text-[13px] text-ink-2">
        <TwoFactorHiddenLine />
      </span>
    </Link>
  );
}
