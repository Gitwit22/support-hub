// ---------------------------------------------------------------------------
// Room domain emitter – convenience functions for room lifecycle events.
// ---------------------------------------------------------------------------

import { getEventBus } from "../eventBus";
import {
  createEventPayload,
  ROOM_CREATED,
  ROOM_STARTED,
  ROOM_ENDED,
  ROOM_PARTICIPANT_JOINED,
  ROOM_PARTICIPANT_LEFT,
} from "../eventTypes";

const SOURCE = "roomEmitter";

export function emitRoomCreated(data: {
  roomId: string;
  name: string;
  type: string;
  createdBy: string;
}) {
  getEventBus().emit(createEventPayload(ROOM_CREATED, SOURCE, data));
}

export function emitRoomStarted(data: {
  roomId: string;
  name: string;
}) {
  getEventBus().emit(createEventPayload(ROOM_STARTED, SOURCE, data));
}

export function emitRoomEnded(data: {
  roomId: string;
  name: string;
}) {
  getEventBus().emit(createEventPayload(ROOM_ENDED, SOURCE, data));
}

export function emitRoomParticipantJoined(data: {
  roomId: string;
  userId: string;
  userName: string;
}) {
  getEventBus().emit(createEventPayload(ROOM_PARTICIPANT_JOINED, SOURCE, data));
}

export function emitRoomParticipantLeft(data: {
  roomId: string;
  userId: string;
  userName: string;
}) {
  getEventBus().emit(createEventPayload(ROOM_PARTICIPANT_LEFT, SOURCE, data));
}
