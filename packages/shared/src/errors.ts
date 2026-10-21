/**
 * The one error-code enum. Every API error body carries one of these as
 * `code`; `error` is the human sentence and `hint` the optional next step (D63's `{error, hint}`).
 * Step-1 codes, then step 2's; later steps add theirs here.
 */
export const ErrorCode = Object.freeze({
  validation: 'validation',
  unauthenticated: 'unauthenticated',
  mfa_required: 'mfa_required',
  forbidden: 'forbidden',
  not_found: 'not_found',
  conflict: 'conflict',
  precondition_failed: 'precondition_failed',
  module_off: 'module_off',
  rate_limited: 'rate_limited',
  id_out_of_window: 'id_out_of_window',
  idempotency_mismatch: 'idempotency_mismatch',
  setup_required: 'setup_required',
  setup_code_invalid: 'setup_code_invalid',
  invite_invalid: 'invite_invalid',
  last_owner: 'last_owner',
  /** A sensitive change (email) needs the password again, or a fresh sign-in (D176). */
  reauth_required: 'reauth_required',
  /** Removing a passkey would leave the account with no way to sign in (409). */
  last_sign_in_method: 'last_sign_in_method',
  /** Turning two-factor off while a location the person belongs to asks for it, and no passkey
   * can stand in for it (409). */
  two_factor_required: 'two_factor_required',
  /** An emailed link's token (magic link, email change) is unknown, used or expired. */
  token_invalid: 'token_invalid',
  /** The instance admin has not yet acknowledged the recovery kit (D193): needed before the
   * first secret value, AI key or backup setup. */
  recovery_kit_required: 'recovery_kit_required',
  /** 1.2 (D225): the account is in its 30 days before deletion; only /me, keeping it and
   * signing out answer. The body carries `purgeAfter`. */
  account_deletion_pending: 'account_deletion_pending',
  /** 1.2 (D225): the account can't be deleted yet; the body carries `blockers`. */
  account_deletion_blocked: 'account_deletion_blocked',
  /** A registry row (type, place kind, brand, vendor, person, tag) is still referenced;
   * archive or merge it instead (D92, D160). */
  in_use: 'in_use',
  /** Trashing a place or container that holds something needs `contents: 'move' |
   * 'trash'` (D160, D162); the body carries `counts: {places, things}`. */
  contents_choice_required: 'contents_choice_required',
  /** An upload over KEPT_MAX_FILE_MB. */
  payload_too_large: 'payload_too_large',
  /** An upload whose sniffed content is not on the allow-list (D157). */
  unsupported_media_type: 'unsupported_media_type',
  /** An upload whose bytes don't match the SHA-256 the client declared (D117). */
  checksum_mismatch: 'checksum_mismatch',
  /** A sync batch holds a payload older than MIN_PAYLOAD_VERSION (D148). */
  client_outdated: 'client_outdated',
  /** A sync batch holds a payload newer than this server's PAYLOAD_VERSION. */
  server_outdated: 'server_outdated',
  /** The event can't be undone: too late, not yours, or changed since (D150). */
  undo_refused: 'undo_refused',
  /** A blank label was claimed first by someone else (D43, D112). */
  label_claimed: 'label_claimed',
  /** The location already has 1,000 unclaimed blank labels (D172). */
  blank_cap_reached: 'blank_cap_reached',
  /** No AI provider resolves for this location, or the provider failed (D19, D121). */
  ai_unavailable: 'ai_unavailable',
  /** The paying account's AI budget is used up; the body carries `pausedUntil` (D19). */
  ai_paused: 'ai_paused',
  /** A URL resolves to a private address and private addresses are off (D83). */
  private_address: 'private_address',
  /** A location's AI cap above its account's cap in the same unit (D206). */
  cap_above_account: 'cap_above_account',
  /** "Resume now" while usage is still at the cap: raise or remove it. */
  ai_cap_still_reached: 'ai_cap_still_reached',
  /** An AI cap or price in a currency the instance hasn't turned on. */
  currency_not_enabled: 'currency_not_enabled',
  /** A warranty needs quantity 1; split the row first (D10). */
  quantity_not_one: 'quantity_not_one',
  /** The thing already has an open loan (one per thing). */
  already_on_loan: 'already_on_loan',
  /** The thing already has a claim in repair (one per thing). */
  thing_in_repair: 'thing_in_repair',
  /** A thing with an open loan can't leave its location. */
  open_loan: 'open_loan',
  /** A thing with a claim in repair can't leave its location. */
  open_claim: 'open_claim',
  /** A status change the record's transitions don't allow (a claim's). */
  invalid_transition: 'invalid_transition',
  /** A schedule needs an interval in months or units, or a date. */
  schedule_interval_required: 'schedule_interval_required',
  /** No exchange rate for a pair on or before the date; the body lists `missing`
   * pairs (D76). Never estimated. */
  rate_missing: 'rate_missing',
  /** Web push isn't set up on this server, or this device can't receive it. */
  push_unavailable: 'push_unavailable',
  /** A test send to a channel (webhook, push) failed to arrive. */
  channel_unreachable: 'channel_unreachable',
  /** A download link (a claim pack's) is unknown, revoked or expired. */
  link_expired: 'link_expired',
  /** 1.10.5 (#141): an email was asked for (a report mailed or scheduled) and this server has no
   * mail transport (KEPT_SMTP_URL unset). Refused rather than accepted and dropped. */
  mail_not_configured: 'mail_not_configured',
  /** 1.10.5 (#141): an email was asked for and the account has no address Kept can send to (a
   * managed account, D47). */
  no_email_address: 'no_email_address',
  /** 1.14: a thing is a part of at most one kit. */
  in_another_kit: 'in_another_kit',
  /** 1.14: it is with someone (an open hand-over line): say so and confirm before changing it. */
  on_loan: 'on_loan',
  /** A reading a fuel entry or service record owns is changed through its owner;
   * the body carries `ownedBy: {type: 'fuel' | 'service', id}`. */
  reading_owned: 'reading_owned',
  /** A draft service record (an invoice read by AI) is finished before it's used. */
  service_draft: 'service_draft',
  /** A fill's odometer needs the thing to have a meter. */
  fuel_needs_meter: 'fuel_needs_meter',
  /** The token is revoked or expired; make a new one. */
  token_revoked: 'token_revoked',
  /** A token called a route or tool its scope or the route's catalogue entry doesn't
   * allow. */
  token_scope: 'token_scope',
  /** The tool isn't offered here: its module is off, the location isn't reachable, or no
   * handler exists yet. The same answer for each, so nothing leaks (D113). */
  tool_unavailable: 'tool_unavailable',
  /** A proposal's 10 minutes are up (D22). */
  proposal_expired: 'proposal_expired',
  /** The proposal's target changed since it was proposed. */
  proposal_conflict: 'proposal_conflict',
  /** The thread already has a turn in flight. */
  turn_running: 'turn_running',
  /** What was asked for was removed when access ended (D164). */
  thread_redacted: 'thread_redacted',
  /** An archive Kept won't read; the body's `reason` says why (ARCHIVE_REFUSALS, D157). */
  archive_invalid: 'archive_invalid',
  /** An archive over the upload cap or the 5 GB uncompressed cap. */
  archive_too_large: 'archive_too_large',
  /** The passphrase doesn't open the export's secrets (D68). */
  passphrase_wrong: 'passphrase_wrong',
  /** A passphrase shorter than PASSPHRASE_MIN, or the two entries differ. */
  passphrase_weak: 'passphrase_weak',
  /** An export past its seven days. */
  export_expired: 'export_expired',
  /** An export is already running for that location. */
  export_running: 'export_running',
  /** An archive import needs its target location first. */
  import_target_needed: 'import_target_needed',
  /** A field of this kind can't be converted to that one (CONVERSIONS, D172). */
  field_convert_blocked: 'field_convert_blocked',
  /** "Keep at least" needs a consumable type (D14). */
  not_consumable: 'not_consumable',
  /** 1.x (D236): a service line takes more of a consumable than is left; the body names the
   * thing (`thing: {id, name}`) and what is left (`left`). */
  not_enough_stock: 'not_enough_stock',
  /** The optional Homebox connection failed: unreachable, a redirect, a refused key or
   * sign-in, or an answer that isn't Homebox's (502). */
  homebox_unreachable: 'homebox_unreachable',
  /** No backup target with a password is set (no password, no backup). */
  backup_not_configured: 'backup_not_configured',
  /** A backup run (nightly, manual or pre-upgrade) already holds the lock. */
  backup_running: 'backup_running',
  /** The backup target can't be reached (a directory, a bucket or an SFTP server). */
  backup_target_unreachable: 'backup_target_unreachable',
  /** A backup password shorter than BACKUP_PASSWORD_MIN. */
  backup_password_weak: 'backup_password_weak',
  /** A setting the server's environment fixes was changed (D186). */
  setting_locked: 'setting_locked',
  /** Restic failed; the body's `reason` is a RESTIC_ERROR_REASONS code. */
  restic_failed: 'restic_failed',
  /** A secret, an export or an admin change over plain HTTP (D181). */
  https_required: 'https_required',
  /** The database is more than one release ahead of this image. */
  downgrade_refused: 'downgrade_refused',
  /** Keeping this offline would pass the device's cap (KEEP_OFFLINE). */
  keep_offline_too_large: 'keep_offline_too_large',
  /** 1.x (D248): the location's Paperless-ngx server didn't answer, refused its token, or
   * answered unlike Paperless (502); the body's `paperlessError` says which. */
  paperless_unreachable: 'paperless_unreachable',
  /** Postgres can't be reached: refused, ended, restarting, out of connections (503). Nothing
   * the request did; the same request works once the database is back. */
  database_unavailable: 'database_unavailable',
  internal: 'internal',
} as const);

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Step 3's error codes. */
export type CaptureErrorCode =
  | 'client_outdated'
  | 'server_outdated'
  | 'undo_refused'
  | 'label_claimed'
  | 'blank_cap_reached'
  | 'ai_unavailable'
  | 'ai_paused'
  | 'private_address'
  | 'cap_above_account'
  | 'ai_cap_still_reached'
  | 'currency_not_enabled';

/**
 * The English sentence for each step-3 code, for the server's message table (spread into
 * `MESSAGES` in apps/server/src/http/errors.ts) and for the phone, which shows some of these
 * without a server round trip ("Update Kept to finish syncing").
 */
export const CAPTURE_ERROR_MESSAGES: Readonly<Record<CaptureErrorCode, string>> = Object.freeze({
  client_outdated: 'Update Kept to finish syncing.',
  server_outdated: 'Kept on the server is older than this app; ask your admin.',
  undo_refused: "That can't be undone any more.",
  label_claimed: 'This label was already claimed.',
  blank_cap_reached:
    'This location already has 1,000 unclaimed labels. Use some before printing more.',
  ai_unavailable: "AI isn't available for this location right now.",
  ai_paused: 'AI is paused until the budget resets.',
  private_address: 'That address is on a private network.',
  cap_above_account: "A location's AI cap can't be above its account's cap.",
  ai_cap_still_reached: 'This month is still at the cap. Raise or remove the cap to resume.',
  currency_not_enabled: "That currency isn't turned on for this server.",
});

/** Step 4's error codes. */
export type HouseholdErrorCode =
  | 'quantity_not_one'
  | 'already_on_loan'
  | 'thing_in_repair'
  | 'open_loan'
  | 'open_claim'
  | 'invalid_transition'
  | 'schedule_interval_required'
  | 'rate_missing'
  | 'push_unavailable'
  | 'channel_unreachable'
  | 'link_expired'
  | 'mail_not_configured'
  | 'no_email_address'
  | 'in_another_kit'
  | 'on_loan';

/** The English sentence for each step-4 code (spread into the server's `MESSAGES`). */
export const HOUSEHOLD_ERROR_MESSAGES: Readonly<Record<HouseholdErrorCode, string>> = Object.freeze(
  {
    quantity_not_one: 'A warranty is for a single thing.',
    already_on_loan: 'This is already on loan.',
    thing_in_repair: 'This is already in repair.',
    open_loan: "A thing that's on loan can't move to another location.",
    open_claim: "A thing that's in repair can't move to another location.",
    invalid_transition: "The status can't change that way.",
    schedule_interval_required: 'A schedule needs an interval or a date.',
    rate_missing: 'An exchange rate is missing.',
    push_unavailable: "Push notifications aren't available here.",
    channel_unreachable: "The test didn't arrive.",
    link_expired: 'This link has expired or was revoked.',
    mail_not_configured: "Email isn't set up on this server.",
    no_email_address: 'Your account has no email address.',
    in_another_kit: 'It is a part of another kit.',
    on_loan: 'It is with someone: mark it returned first, or confirm.',
  },
);

/** Step 6's error codes. */
export type ConnectionsErrorCode =
  | 'token_revoked'
  | 'token_scope'
  | 'tool_unavailable'
  | 'proposal_expired'
  | 'proposal_conflict'
  | 'turn_running'
  | 'thread_redacted';

/** The English sentence for each step-6 code (spread into the server's `MESSAGES`). */
export const CONNECTIONS_ERROR_MESSAGES: Readonly<Record<ConnectionsErrorCode, string>> =
  Object.freeze({
    token_revoked: 'This token was revoked or has expired.',
    token_scope: "This token can't do that.",
    tool_unavailable: "That tool isn't available here.",
    proposal_expired: 'This change expired. Ask again.',
    proposal_conflict: 'This changed since it was proposed.',
    turn_running: 'The assistant is still answering in this thread.',
    thread_redacted: 'Removed: you no longer have access to this.',
  });

/**
 * The next step for each step-6 code: the `hint` of D63's `{error, hint}`,
 * for API bodies and for MCP tool errors, which a model reads.
 */
export const CONNECTIONS_ERROR_HINTS: Readonly<Record<ConnectionsErrorCode, string>> =
  Object.freeze({
    token_revoked: 'create a new token in Settings → Connections',
    token_scope: 'use a token with write access, or do this in Kept',
    tool_unavailable: 'call capabilities to see the tools for each location',
    proposal_expired: 'ask the assistant again',
    proposal_conflict: 'review the new values and ask again',
    turn_running: 'wait for the answer or cancel it',
    thread_redacted: 'start a new thread',
  });

/**
 * Step 5's error codes. A reading that doesn't fit (a fill's or a confirmed draft's odometer running
 * backwards) has no code of its own: it is step 4's 409 `conflict` with `reason`
 * (`lower_than_previous` | `higher_than_next`) and the neighbour (`previous` | `next`:
 * `{value, takenAt}`), exactly as the meters and service records refuse one (the
 * `reading_refused`; its T1 reuses step 4's code).
 */
export type VehicleErrorCode = 'reading_owned' | 'service_draft' | 'fuel_needs_meter';

/** The English sentence for each step-5 code (spread into the server's `MESSAGES`). */
export const VEHICLE_ERROR_MESSAGES: Readonly<Record<VehicleErrorCode, string>> = Object.freeze({
  reading_owned: 'Change this reading from its fuel entry or service.',
  service_draft: 'Finish logging this service first.',
  fuel_needs_meter: 'This thing has no meter for the odometer.',
});

/** Step 7's error codes. */
export type PortabilityErrorCode =
  | 'archive_invalid'
  | 'archive_too_large'
  | 'passphrase_wrong'
  | 'passphrase_weak'
  | 'export_expired'
  | 'export_running'
  | 'import_target_needed'
  | 'field_convert_blocked'
  | 'not_consumable'
  | 'not_enough_stock'
  | 'homebox_unreachable';

/** The English sentence for each step-7 code (spread into the server's `MESSAGES`). */
export const PORTABILITY_ERROR_MESSAGES: Readonly<Record<PortabilityErrorCode, string>> =
  Object.freeze({
    archive_invalid: "Kept can't read this archive.",
    archive_too_large: 'This archive is too large to import.',
    passphrase_wrong: "That passphrase doesn't open this export's secrets.",
    passphrase_weak: 'Use a passphrase of at least 12 characters, the same both times.',
    export_expired: 'This export has expired. Export again.',
    export_running: 'An export of this location is already running.',
    import_target_needed: 'Choose where to import it first.',
    field_convert_blocked: "A field of this kind can't be converted to that one.",
    not_consumable: 'Only things you run out of can have a minimum.',
    not_enough_stock: 'There is not that much left.',
    homebox_unreachable: "Kept couldn't read from that Homebox.",
  });

/** Step 8's error codes. */
export type OpsErrorCode =
  | 'backup_not_configured'
  | 'backup_running'
  | 'backup_target_unreachable'
  | 'backup_password_weak'
  | 'setting_locked'
  | 'restic_failed'
  | 'https_required'
  | 'downgrade_refused'
  | 'keep_offline_too_large';

/** The English sentence for each step-8 code (spread into the server's `MESSAGES`). */
export const OPS_ERROR_MESSAGES: Readonly<Record<OpsErrorCode, string>> = Object.freeze({
  backup_not_configured: 'Backups are not set up yet.',
  backup_running: 'A backup is already running.',
  backup_target_unreachable: "Kept can't reach the backup storage.",
  backup_password_weak: 'Use a backup password of at least 12 characters.',
  setting_locked: "This is set by the server's environment and can't be changed here.",
  restic_failed: 'The backup tool failed.',
  https_required: 'This needs a secure (https) connection to Kept.',
  downgrade_refused: 'This database is from a newer version of Kept.',
  keep_offline_too_large: 'That is more than this device can keep offline.',
});

/** 1.x's integration error codes (D248). */
export type IntegrationErrorCode = 'paperless_unreachable';

/** The English sentence for each integration code (spread into the server's `MESSAGES`). */
export const INTEGRATION_ERROR_MESSAGES: Readonly<Record<IntegrationErrorCode, string>> =
  Object.freeze({
    paperless_unreachable: "Paperless can't be reached.",
  });

export type ApiError = { error: string; hint?: string; code: ErrorCode };

export function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(ErrorCode, value);
}
