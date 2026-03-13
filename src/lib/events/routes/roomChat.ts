// ---------------------------------------------------------------------------
// Route integration: roomChat – emits chat.message.created
// Non-blocking, fires after existing Horizon events.
// ---------------------------------------------------------------------------

import { emitChatMessageCreated } from "../emitters/chatEmitter";

/**
 * Call after a chat message has been persisted and any Horizon events have
 * been dispatched. The Streamline event is emitted asynchronously and will
 * never throw or block the request.
 */
export function onChatMessageCreated(params: {
  roomId: string;
  messageId: string;
  userId: string;
  content: string;
}) {
  try {
    emitChatMessageCreated(params);
  } catch {
    // Non-blocking – swallow errors so the original route is never affected
  }
}
