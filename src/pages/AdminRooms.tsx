import { useState, useEffect } from "react";
import { listRooms } from "@/lib/api/admin";
import type { Room, RoomStatus, RoomType } from "@/lib/types/admin";
import { formatDistanceToNow } from "date-fns";
import { Radio, Users, Video, MonitorPlay, Presentation } from "lucide-react";
import {
  fetchRooms,
  fetchRoomDetails,
  fetchRoomChat,
  getStreamlineDiagnostics,
  isStreamlineConfigured,
  isStreamlineValidationError,
  type StreamlineRoomDetails,
  type StreamlineRoomChatMessage,
} from "@/services/streamlineApi";

const statusConfig: Record<RoomStatus, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950" },
  idle:   { label: "Idle",   color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950" },
  closed: { label: "Closed", color: "text-muted-foreground", bg: "bg-muted" },
  error:  { label: "Error",  color: "text-destructive",  bg: "bg-red-50 dark:bg-red-950" },
};

const typeIcon: Record<RoomType, typeof Radio> = {
  classroom: MonitorPlay,
  meeting: Video,
  broadcast: Radio,
  webinar: Presentation,
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedRoomDetails, setSelectedRoomDetails] = useState<StreamlineRoomDetails | null>(null);
  const [roomChat, setRoomChat] = useState<StreamlineRoomChatMessage[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [diagnosticsText, setDiagnosticsText] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadRooms = async () => {
      try {
        const result = isStreamlineConfigured()
          ? await fetchRooms()
          : await listRooms();
        if (!mounted) return;

        setRooms(result);
        setConnectionError(null);

        if (result.length > 0) {
          setSelectedRoomId((prev) => prev ?? result[0].id);
        }
        setDiagnosticsText([]);
      } catch (error) {
        if (!mounted) return;

        const message = isStreamlineValidationError(error)
          ? "StreamLine returned unexpected data"
          : "StreamLine connection unavailable";

        if (isStreamlineConfigured()) {
          setRooms([]);
          setSelectedRoomDetails(null);
          setRoomChat([]);
        }

        setConnectionError(message);
        const d = getStreamlineDiagnostics();
        const lines = [
          `Base URL: ${d.baseUrl || "-"}`,
          `Source: ${d.supportDataSource || "-"}`,
          `Endpoint: ${d.lastEndpoint || "-"}`,
          `Status Code: ${d.lastStatusCode ?? "-"}`,
          `Error Type: ${d.lastErrorType || "-"}`,
          `Error: ${d.lastErrorMessage || "-"}`,
        ];
        if (d.lastValidationDetails?.length) {
          lines.push(`Validation: ${d.lastValidationDetails.join(" | ")}`);
        }
        setDiagnosticsText(lines);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadRooms();
    const intervalId = window.setInterval(loadRooms, 8_000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!selectedRoomId) {
      setSelectedRoomDetails(null);
      setRoomChat([]);
      return;
    }

    if (!isStreamlineConfigured()) {
      setSelectedRoomDetails(null);
      setRoomChat([]);
      return;
    }

    let mounted = true;

    const loadSelectedRoom = async () => {
      try {
        const [details, chat] = await Promise.all([
          fetchRoomDetails(selectedRoomId),
          fetchRoomChat(selectedRoomId),
        ]);

        if (!mounted) return;

        setSelectedRoomDetails(details);
        setRoomChat(chat);
        setDiagnosticsText([]);
      } catch (error) {
        if (!mounted) return;
        setSelectedRoomDetails(null);
        setRoomChat([]);
        if (isStreamlineValidationError(error)) {
          setConnectionError("StreamLine returned unexpected data");
        }
        const d = getStreamlineDiagnostics();
        const lines = [
          `Base URL: ${d.baseUrl || "-"}`,
          `Source: ${d.supportDataSource || "-"}`,
          `Endpoint: ${d.lastEndpoint || "-"}`,
          `Status Code: ${d.lastStatusCode ?? "-"}`,
          `Error Type: ${d.lastErrorType || "-"}`,
          `Error: ${d.lastErrorMessage || "-"}`,
        ];
        if (d.lastValidationDetails?.length) {
          lines.push(`Validation: ${d.lastValidationDetails.join(" | ")}`);
        }
        setDiagnosticsText(lines);
      }
    };

    loadSelectedRoom();

    return () => {
      mounted = false;
    };
  }, [selectedRoomId]);

  const activeCount = rooms.filter((r) => r.status === "active").length;
  const totalParticipants = rooms.reduce((sum, r) => sum + r.participants, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Rooms</h1>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rooms</h1>
        <p className="text-sm text-muted-foreground mt-1">Active rooms, participants, and broadcast state.</p>
        {connectionError && (
          <p className="mt-2 text-sm text-destructive">{connectionError}</p>
        )}
        {connectionError && diagnosticsText.length > 0 && (
          <div className="mt-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground space-y-1">
            {diagnosticsText.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Active Rooms</p>
          <p className="mt-1 text-3xl font-bold text-card-foreground">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total Participants</p>
          <p className="mt-1 text-3xl font-bold text-card-foreground">{totalParticipants}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total Rooms</p>
          <p className="mt-1 text-3xl font-bold text-card-foreground">{rooms.length}</p>
        </div>
      </div>

      {/* Room list */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rooms.map((room) => {
          const sCfg = statusConfig[room.status];
          const TypeIcon = typeIcon[room.type];
          const isSelected = selectedRoomId === room.id;
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => setSelectedRoomId(room.id)}
              className={`w-full rounded-lg border bg-card p-5 space-y-3 text-left ${isSelected ? "border-primary" : "border-border"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TypeIcon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-card-foreground">{room.name}</h3>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sCfg.bg} ${sCfg.color}`}>
                  {sCfg.label}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  <span>{room.participants} / {room.maxParticipants}</span>
                </div>
                <span className="capitalize">{room.type}</span>
              </div>
              {room.broadcastActive && (
                <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                  <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  Live Broadcast
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Last activity {formatDistanceToNow(new Date(room.lastActivityAt), { addSuffix: true })}
              </p>
            </button>
          );
        })}
      </div>

      {selectedRoomId && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">Room Details</h2>
            {selectedRoomDetails ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedRoomDetails.name} • {selectedRoomDetails.type} • {selectedRoomDetails.participants}/{selectedRoomDetails.maxParticipants}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Unable to load room details.</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Room Chat History</h3>
            {roomChat.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No room chat messages available.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {roomChat.map((message) => (
                  <div key={message.id} className="rounded-md border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-card-foreground">{message.authorName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-card-foreground">{message.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
