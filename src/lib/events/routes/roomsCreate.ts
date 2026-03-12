// ---------------------------------------------------------------------------
// Route integration: roomsCreate – emits room.created
// Non-blocking, fires after existing Horizon events.
// ---------------------------------------------------------------------------

import { emitRoomCreated } from "../emitters/roomEmitter";

/**
 * Call after a room has been created and any Horizon events have fired.
 * The Streamline event is emitted asynchronously and will never throw.
 */
export function onRoomCreated(params: {
  roomId: string;
  name: string;
  type: string;
  createdBy: string;
}) {
  try {
    emitRoomCreated(params);
  } catch {
    // Non-blocking – swallow errors so the original route is never affected
  }
}
