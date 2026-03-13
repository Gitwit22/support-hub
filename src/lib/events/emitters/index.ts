// ---------------------------------------------------------------------------
// Barrel export for all domain emitters.
// ---------------------------------------------------------------------------

export {
  emitChatMessageCreated,
  emitChatMessageUpdated,
  emitChatMessageDeleted,
} from "./chatEmitter";

export {
  emitVoiceStreamStarted,
  emitVoiceStreamEnded,
  emitVoiceParticipantMuted,
  emitVoiceParticipantUnmuted,
} from "./voiceEmitter";

export {
  emitSupportTicketCreated,
  emitSupportTicketUpdated,
  emitSupportTicketClosed,
  emitSupportTicketAssigned,
} from "./supportEmitter";

export {
  emitRoomCreated,
  emitRoomStarted,
  emitRoomEnded,
  emitRoomParticipantJoined,
  emitRoomParticipantLeft,
} from "./roomEmitter";

export {
  emitServiceDegraded,
  emitServiceRestored,
  emitHealthCheck,
} from "./monitoringEmitter";

export {
  emitAlertTriggered,
  emitAlertAcknowledged,
  emitAlertResolved,
} from "./alertEmitter";
