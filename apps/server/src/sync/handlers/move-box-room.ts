import { chooseRoom, requireMovingOn } from '../../moving/service.js';
import { type Handler, requireLive } from './common.js';

// `move_box_room` (1.x, D251) → moving/service.ts chooseRoom(): the room a moving box goes to,
// chosen on a phone in the middle of the move, where there may be no signal.
//
// Conflicts follow D35, as rooms do online: the change the server gets last wins, and each is in
// the box's history. A box unpacked by the time the op arrives keeps the room it was unpacked into
// (answered `applied`, `superseded`: nothing changed, and the board shows where it went). The
// same room again is `superseded` too. A box or room trashed meanwhile drops with who trashed it,
// and a restore; a box taken out of the move, or a move deleted, drops as `target_missing`; a
// room where the move isn't going, a move marked done, or Moving mode turned off, as `invalid`.

export const moveBoxRoomOp: Handler<'move_box_room'> = async (ctx, { locationId, payload }) => {
  const { client } = ctx;
  await requireMovingOn(ctx, locationId);
  const gone = await requireLive(client, [
    { type: 'thing', id: payload.containerId },
    { type: 'place', id: payload.placeId },
  ]);
  if (gone) return gone;
  const out = await chooseRoom(ctx, payload.moveId, payload.containerId, payload.placeId);
  return {
    outcome: 'applied',
    ...(out.changed ? {} : { reason: 'superseded' }),
    entity: { type: 'thing', id: payload.containerId.toLowerCase() },
  };
};
