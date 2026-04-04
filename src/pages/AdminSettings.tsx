import { Link, Settings2 } from "lucide-react";
import { useProgram } from "@/lib/programs/ProgramContext";
import type { ProgramConfig } from "@/lib/types/program";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-all text-sm text-card-foreground">{value || "-"}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings page — shown for all programs
// ---------------------------------------------------------------------------

function ProgramSettingsView({ program }: { program: ProgramConfig }) {
  const enabledCaps = (
    Object.keys(program.capabilities) as (keyof typeof program.capabilities)[]
  ).filter((k) => program.capabilities[k]);

  const endpointPairs = Object.entries(program.endpoints).filter(([, v]) => Boolean(v));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Integration configuration for{" "}
          <span className="font-medium">{program.name}</span>.
        </p>
      </div>

      {/* Connection overview */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Connection</h2>
            <p className="text-sm text-muted-foreground">Stored configuration for this program.</p>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
              program.apiBaseUrl
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {program.apiBaseUrl ? "Configured" : "Not configured"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow label="Program ID" value={program.id} />
          <InfoRow label="System Name" value={program.systemName ?? program.name} />
          <InfoRow label="Environment" value={program.environment} />
          <InfoRow label="Preset" value={program.presetType ?? "custom"} />
          <InfoRow label="API Base URL" value={program.apiBaseUrl} />
          <InfoRow label="Health Endpoint" value={program.healthEndpoint} />
          <InfoRow label="Auth Method" value={program.auth.method} />
          <InfoRow label="Resource Type" value={program.resourceLabel ?? "-"} />
        </div>
      </div>

      {/* Enabled modules */}
      {enabledCaps.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Enabled Modules</h2>
            <p className="text-sm text-muted-foreground">Modules active for this program.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {enabledCaps.map((cap) => (
              <span
                key={cap}
                className="rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize text-secondary-foreground"
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Endpoint mapping */}
      {endpointPairs.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Link className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Endpoint Mapping</h2>
              <p className="text-sm text-muted-foreground">Configured API paths for this program.</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {endpointPairs.map(([key, path]) => (
              <div key={key} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-xs text-muted-foreground capitalize w-36 shrink-0">{key}</span>
                <span className="text-xs font-mono text-card-foreground break-all">{path as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!program.apiBaseUrl && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <Settings2 className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">No API configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Use the program switcher to edit this program's integration settings.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function AdminSettingsPage() {
  const { activeProgram } = useProgram();
  return <ProgramSettingsView program={activeProgram} />;
}
