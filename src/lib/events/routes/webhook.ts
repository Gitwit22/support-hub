// ---------------------------------------------------------------------------
// Route integration: webhook – emits room & voice lifecycle events
// Non-blocking, fires after existing Horizon events.
//
// Events emitted:
//   room.started, room.ended,
//   room.participant_joined, room.participant_left,
//   voice.stream.started, voice.stream.ended
// ---------------------------------------------------------------------------

import {
  emitRoomStarted,
  emitRoomEnded,
  emitRoomParticipantJoined,
  emitRoomParticipantLeft,
  emitVoiceStreamStarted,
  emitVoiceStreamEnded,
} from "../emitters";

/**
 * Call when a room session starts (e.g. LiveKit room_started webhook).
 */
export function onRoomStarted(params: { roomId: string; name: string }) {
  try {
    emitRoomStarted(params);
  } catch {
    // Non-blocking
  }
}

/**
 * Call when a room session ends.
 */
export function onRoomEnded(params: { roomId: string; name: string }) {
  try {
    emitRoomEnded(params);
  } catch {
    // Non-blocking
  }
}

/**
 * Call when a participant joins a room.
 */
export function onRoomParticipantJoined(params: {
  roomId: string;
  userId: string;
  userName: string;
}) {
  try {
    emitRoomParticipantJoined(params);
  } catch {
    // Non-blocking
  }
}

/**
 * Call when a participant leaves a room.
 */
export function onRoomParticipantLeft(params: {
  roomId: string;
  userId: string;
  userName: string;
}) {
  try {
    emitRoomParticipantLeft(params);
  } catch {
    // Non-blocking
  }
}

/**
 * Call when a voice/media stream starts in a room.
 */
export function onVoiceStreamStarted(params: {
  roomId: string;
  streamId: string;
  userId: string;
}) {
  try {
    emitVoiceStreamStarted(params);
  } catch {
    // Non-blocking
  }
}

/**
 * Call when a voice/media stream ends.
 */
export function onVoiceStreamEnded(params: {
  roomId: string;
  streamId: string;
  userId: string;
}) {
  try {
    emitVoiceStreamEnded(params);
  } catch {
    // Non-blocking
  }
}
