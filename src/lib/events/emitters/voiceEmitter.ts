// ---------------------------------------------------------------------------
// Voice domain emitter – convenience functions for voice/streaming events.
// ---------------------------------------------------------------------------

import { getEventBus } from "../eventBus";
import {
  createEventPayload,
  VOICE_STREAM_STARTED,
  VOICE_STREAM_ENDED,
  VOICE_PARTICIPANT_MUTED,
  VOICE_PARTICIPANT_UNMUTED,
} from "../eventTypes";

const SOURCE = "voiceEmitter";

export function emitVoiceStreamStarted(data: {
  roomId: string;
  streamId: string;
  userId: string;
}) {
  getEventBus().emit(createEventPayload(VOICE_STREAM_STARTED, SOURCE, data));
}

export function emitVoiceStreamEnded(data: {
  roomId: string;
  streamId: string;
  userId: string;
}) {
  getEventBus().emit(createEventPayload(VOICE_STREAM_ENDED, SOURCE, data));
}

export function emitVoiceParticipantMuted(data: {
  roomId: string;
  userId: string;
}) {
  getEventBus().emit(createEventPayload(VOICE_PARTICIPANT_MUTED, SOURCE, data));
}

export function emitVoiceParticipantUnmuted(data: {
  roomId: string;
  userId: string;
}) {
  getEventBus().emit(createEventPayload(VOICE_PARTICIPANT_UNMUTED, SOURCE, data));
}
