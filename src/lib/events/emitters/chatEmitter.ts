// ---------------------------------------------------------------------------
// Chat domain emitter – convenience functions for chat-related Streamline events.
// ---------------------------------------------------------------------------

import { getEventBus } from "../eventBus";
import {
  createEventPayload,
  CHAT_MESSAGE_CREATED,
  CHAT_MESSAGE_UPDATED,
  CHAT_MESSAGE_DELETED,
} from "../eventTypes";

const SOURCE = "chatEmitter";

export function emitChatMessageCreated(data: {
  roomId: string;
  messageId: string;
  userId: string;
  content: string;
}) {
  getEventBus().emit(createEventPayload(CHAT_MESSAGE_CREATED, SOURCE, data));
}

export function emitChatMessageUpdated(data: {
  roomId: string;
  messageId: string;
  userId: string;
  content: string;
}) {
  getEventBus().emit(createEventPayload(CHAT_MESSAGE_UPDATED, SOURCE, data));
}

export function emitChatMessageDeleted(data: {
  roomId: string;
  messageId: string;
  userId: string;
}) {
  getEventBus().emit(createEventPayload(CHAT_MESSAGE_DELETED, SOURCE, data));
}
