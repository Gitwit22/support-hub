import { useState, useEffect } from "react";
import { listRooms } from "@/lib/api/admin";
import type { Room, RoomStatus, RoomType } from "@/lib/types/admin";
import { formatDistanceToNow } from "date-fns";
import { Radio, Users, Video, MonitorPlay, Presentation } from "lucide-react";

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

  useEffect(() => {
    listRooms().then((r) => { setRooms(r); setLoading(false); });
  }, []);

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
          return (
            <div key={room.id} className="rounded-lg border border-border bg-card p-5 space-y-3">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
