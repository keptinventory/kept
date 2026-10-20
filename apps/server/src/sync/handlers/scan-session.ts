import { addSessionLines, finishSession } from '../../sessions/service.js';
import { type Handler, requireLive, targetRef } from './common.js';

// `scan_session_lines` and `scan_session_finish` (1.12) → sessions/service.ts. A walk is saved
// as its lines in chunks, then its finish, which `dependsOn` every chunk: a dropped chunk drops the
// finish (`parent_dropped`), so a half-saved walk is never applied.
//
// - lines: the session's target trashed meanwhile drops it with who trashed it, and a restore; a
//   target in another location than the op's, a session already saved, or one of another mode is
//   `invalid`; another person's session is `target_missing`.
// - finish: a session that never arrived is `target_missing`; one already saved is `invalid`.
//   Lines that can't be applied any more are skipped inside it, and counted (`skipped`).

export const scanSessionLinesOp: Handler<'scan_session_lines'> = async (
  ctx,
  { locationId, payload, takenAt },
) => {
  const ref = targetRef(payload.session.target as { placeId?: string; containerId?: string });
  if (ref) {
    const gone = await requireLive(ctx.client, [ref]);
    if (gone) return gone;
  }
  const { sessionId } = await addSessionLines(ctx, locationId, payload, takenAt);
  return { outcome: 'applied', entity: { type: 'scan_session', id: sessionId } };
};

export const scanSessionFinishOp: Handler<'scan_session_finish'> = async (ctx, { payload }) => {
  const { sessionId } = await finishSession(ctx, payload);
  return { outcome: 'applied', entity: { type: 'scan_session', id: sessionId } };
};
