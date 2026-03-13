// ---------------------------------------------------------------------------
// Support domain emitter – convenience functions for support ticket events.
// ---------------------------------------------------------------------------

import { getEventBus } from "../eventBus";
import {
  createEventPayload,
  SUPPORT_TICKET_CREATED,
  SUPPORT_TICKET_UPDATED,
  SUPPORT_TICKET_CLOSED,
  SUPPORT_TICKET_ASSIGNED,
} from "../eventTypes";

const SOURCE = "supportEmitter";

export function emitSupportTicketCreated(data: {
  ticketId: string;
  title: string;
  userId: string;
  priority: string;
}) {
  getEventBus().emit(createEventPayload(SUPPORT_TICKET_CREATED, SOURCE, data));
}

export function emitSupportTicketUpdated(data: {
  ticketId: string;
  changes: Record<string, unknown>;
}) {
  getEventBus().emit(createEventPayload(SUPPORT_TICKET_UPDATED, SOURCE, data));
}

export function emitSupportTicketClosed(data: {
  ticketId: string;
  closedBy: string;
}) {
  getEventBus().emit(createEventPayload(SUPPORT_TICKET_CLOSED, SOURCE, data));
}

export function emitSupportTicketAssigned(data: {
  ticketId: string;
  assignedTo: string;
  assignedBy: string;
}) {
  getEventBus().emit(createEventPayload(SUPPORT_TICKET_ASSIGNED, SOURCE, data));
}
