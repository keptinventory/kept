import type { Scope } from '../db/scope.js';
import type { AuditActor } from './audited.js';

// Who an audit event names. A
// request or tool call made with a personal token or an OAuth grant acts as the token, not as
// its creator: the event is `{type: 'token', id}`, which "Recent changes by connections" lists
// and its creator can undo (D58, D124). kept_app's audit policy pins both (0070): a token-scoped
// transaction can write only its own token's events, and a user-scoped one only the user's.
// Every service builds its actor here, never `{type: 'user'}` by hand.

export function actorOf(scope: Pick<Scope, 'userId' | 'tokenId'>): AuditActor & {
  type: 'user' | 'token';
  id: string;
} {
  return scope.tokenId
    ? { type: 'token', id: scope.tokenId.toLowerCase() }
    : { type: 'user', id: scope.userId };
}
