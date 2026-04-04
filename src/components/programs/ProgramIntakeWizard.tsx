// ---------------------------------------------------------------------------
// ProgramIntakeWizard — 5-step guided wizard for onboarding a new program.
// ---------------------------------------------------------------------------

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import type { ProgramConfig, ProgramCapabilities, ProgramEndpoints, ProgramEnvironment, AuthMethod } from "@/lib/types/program";
import { useProgram } from "@/lib/programs/ProgramContext";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Wizard state shape
// ---------------------------------------------------------------------------

interface WizardState {
  // Step 1 — Basic Info
  name: string;
  slug: string;
  environment: ProgramEnvironment;
  description: string;

  // Step 2 — API Connection
  apiBaseUrl: string;
  healthEndpoint: string;
  authMethod: AuthMethod;

  // Step 3 — Module Selection
  capabilities: ProgramCapabilities;

  // Step 4 — Endpoint Mapping
  endpoints: ProgramEndpoints;
}

const DEFAULT_CAPABILITIES: ProgramCapabilities = {
  monitoring: false,
  tickets: false,
  logs: false,
  metrics: false,
  alerts: false,
  chat: false,
  diagnostics: false,
};

const INITIAL_STATE: WizardState = {
  name: "",
  slug: "",
  environment: "production",
  description: "",
  apiBaseUrl: "",
  healthEndpoint: "/support/status",
  authMethod: "bearer",
  capabilities: { ...DEFAULT_CAPABILITIES },
  endpoints: {},
};

const STEPS = [
  "Program Info",
  "API Connection",
  "Modules",
  "Endpoint Mapping",
  "Save",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateId(slug: string, env: ProgramEnvironment): string {
  return `${slug}-${env}`;
}

type ConnectionStatus = "idle" | "testing" | "success" | "failure";

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function StepProgramInfo({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="prog-name">Program Name *</Label>
        <Input
          id="prog-name"
          placeholder="e.g. Horizon"
          value={state.name}
          onChange={(e) => {
            const name = e.target.value;
            onChange({ name, slug: slugify(name) });
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prog-slug">Slug *</Label>
        <Input
          id="prog-slug"
          placeholder="e.g. horizon"
          value={state.slug}
          onChange={(e) => onChange({ slug: slugify(e.target.value) })}
        />
        <p className="text-xs text-muted-foreground">
          Used in IDs and URLs. Auto-generated from name.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prog-env">Environment *</Label>
        <Select
          value={state.environment}
          onValueChange={(v) => onChange({ environment: v as ProgramEnvironment })}
        >
          <SelectTrigger id="prog-env">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="production">Production</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
            <SelectItem value="dev">Dev</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prog-desc">Description</Label>
        <Input
          id="prog-desc"
          placeholder="Optional description"
          value={state.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
    </div>
  );
}

function StepApiConnection({
  state,
  onChange,
  connectionStatus,
  connectionMessage,
  onTestConnection,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  connectionStatus: ConnectionStatus;
  connectionMessage: string;
  onTestConnection: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="api-base">API Base URL *</Label>
        <Input
          id="api-base"
          placeholder="https://api.example.com"
          value={state.apiBaseUrl}
          onChange={(e) => onChange({ apiBaseUrl: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="api-health">Health Endpoint *</Label>
        <Input
          id="api-health"
          placeholder="/support/status"
          value={state.healthEndpoint}
          onChange={(e) => onChange({ healthEndpoint: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Relative path used to verify connectivity.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="api-auth">Auth Method</Label>
        <Select
          value={state.authMethod}
          onValueChange={(v) => onChange({ authMethod: v as AuthMethod })}
        >
          <SelectTrigger id="api-auth">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bearer">Bearer Token</SelectItem>
            <SelectItem value="api-key">API Key</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onTestConnection}
          disabled={!state.apiBaseUrl || connectionStatus === "testing"}
        >
          {connectionStatus === "testing" && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Test Connection
        </Button>

        {connectionStatus === "success" && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            {connectionMessage}
          </span>
        )}
        {connectionStatus === "failure" && (
          <span className="flex items-center gap-1.5 text-sm text-destructive">
            <XCircle className="h-4 w-4" />
            {connectionMessage}
          </span>
        )}
      </div>
    </div>
  );
}

const MODULE_OPTIONS: { key: keyof ProgramCapabilities; label: string }[] = [
  { key: "monitoring", label: "Monitoring" },
  { key: "tickets", label: "Tickets" },
  { key: "logs", label: "Logs" },
  { key: "metrics", label: "Metrics" },
  { key: "alerts", label: "Alerts" },
  { key: "chat", label: "Chat" },
  { key: "diagnostics", label: "Diagnostics" },
];

function StepModules({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  const toggle = (key: keyof ProgramCapabilities) => {
    onChange({
      capabilities: { ...state.capabilities, [key]: !state.capabilities[key] },
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Select the modules this program supports. Only enabled tabs will be shown.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {MODULE_OPTIONS.map(({ key, label }) => (
          <label
            key={key}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
              state.capabilities[key]
                ? "border-primary bg-primary/5"
                : "border-border hover:border-border/80"
            )}
          >
            <Checkbox
              id={`cap-${key}`}
              checked={state.capabilities[key]}
              onCheckedChange={() => toggle(key)}
            />
            <span className="text-sm font-medium">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function StepEndpointMapping({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  const updateEndpoint = (
    module: keyof ProgramEndpoints,
    field: string,
    value: string
  ) => {
    onChange({
      endpoints: {
        ...state.endpoints,
        [module]: {
          ...(state.endpoints[module] ?? {}),
          [field]: value,
        },
      },
    });
  };

  const hasMonitoring = state.capabilities.monitoring;
  const hasTickets = state.capabilities.tickets;
  const hasLogs = state.capabilities.logs;
  const hasMetrics = state.capabilities.metrics;

  if (!hasMonitoring && !hasTickets && !hasLogs && !hasMetrics) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No modules with configurable endpoints are enabled. Go back to enable
        modules first.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Define API paths for each enabled module (relative to API base URL).
      </p>

      {hasMonitoring && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Monitoring</h4>
          <div className="grid grid-cols-1 gap-2">
            {[
              { field: "status", label: "Status endpoint" },
              { field: "rooms", label: "Rooms list" },
              { field: "roomDetail", label: "Room detail (:roomId)" },
            ].map(({ field, label }) => (
              <div key={field} className="flex items-center gap-2">
                <Label className="w-36 flex-shrink-0 text-xs">{label}</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder={`/support/${field}`}
                  value={
                    (state.endpoints.monitoring as Record<string, string> | undefined)?.[field] ?? ""
                  }
                  onChange={(e) =>
                    updateEndpoint("monitoring", field, e.target.value)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {hasTickets && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Tickets</h4>
          <div className="grid grid-cols-1 gap-2">
            {[
              { field: "list", label: "List tickets" },
              { field: "create", label: "Create ticket" },
              { field: "detail", label: "Ticket detail (:id)" },
            ].map(({ field, label }) => (
              <div key={field} className="flex items-center gap-2">
                <Label className="w-36 flex-shrink-0 text-xs">{label}</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder={`/api/tickets/${field}`}
                  value={
                    (state.endpoints.tickets as Record<string, string> | undefined)?.[field] ?? ""
                  }
                  onChange={(e) =>
                    updateEndpoint("tickets", field, e.target.value)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {hasLogs && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Logs</h4>
          <div className="flex items-center gap-2">
            <Label className="w-36 flex-shrink-0 text-xs">List logs</Label>
            <Input
              className="h-8 text-sm"
              placeholder="/api/logs"
              value={state.endpoints.logs?.list ?? ""}
              onChange={(e) => updateEndpoint("logs", "list", e.target.value)}
            />
          </div>
        </div>
      )}

      {hasMetrics && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Metrics</h4>
          <div className="flex items-center gap-2">
            <Label className="w-36 flex-shrink-0 text-xs">Metrics overview</Label>
            <Input
              className="h-8 text-sm"
              placeholder="/api/metrics"
              value={state.endpoints.metrics?.overview ?? ""}
              onChange={(e) =>
                updateEndpoint("metrics", "overview", e.target.value)
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StepSave({
  state,
}: {
  state: WizardState;
}) {
  const id = generateId(state.slug, state.environment);
  const enabledModules = MODULE_OPTIONS.filter(
    ({ key }) => state.capabilities[key]
  ).map(({ label }) => label);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review the configuration below and click <strong>Save Program</strong>{" "}
        to register it in Support Hub.
      </p>

      <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="w-28 text-muted-foreground">ID</span>
          <span className="font-mono font-medium">{id}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-28 text-muted-foreground">Name</span>
          <span className="font-medium">{state.name}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-28 text-muted-foreground">Environment</span>
          <Badge variant="secondary" className="capitalize">
            {state.environment}
          </Badge>
        </div>
        <div className="flex gap-2">
          <span className="w-28 text-muted-foreground">API Base URL</span>
          <span className="font-mono text-xs break-all">{state.apiBaseUrl}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-28 text-muted-foreground">Health Path</span>
          <span className="font-mono text-xs">{state.healthEndpoint}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-28 text-muted-foreground">Auth</span>
          <span className="capitalize">{state.authMethod}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-28 text-muted-foreground">Modules</span>
          <div className="flex flex-wrap gap-1">
            {enabledModules.length > 0
              ? enabledModules.map((m) => (
                  <Badge key={m} variant="outline" className="text-xs">
                    {m}
                  </Badge>
                ))
              : <span className="text-muted-foreground">None selected</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

interface ProgramIntakeWizardProps {
  open: boolean;
  onClose: () => void;
}

export function ProgramIntakeWizard({ open, onClose }: ProgramIntakeWizardProps) {
  const { addProgram } = useProgram();
  const [step, setStep] = useState(0);
  const [wizardState, setWizardState] = useState<WizardState>(INITIAL_STATE);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [saved, setSaved] = useState(false);

  const updateState = useCallback((patch: Partial<WizardState>) => {
    setWizardState((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleClose = () => {
    setStep(0);
    setWizardState(INITIAL_STATE);
    setConnectionStatus("idle");
    setConnectionMessage("");
    setSaved(false);
    onClose();
  };

  const canAdvance = (): boolean => {
    if (step === 0) return wizardState.name.trim() !== "" && wizardState.slug.trim() !== "";
    if (step === 1) return wizardState.apiBaseUrl.trim() !== "";
    return true;
  };

  const testConnection = async () => {
    setConnectionStatus("testing");
    const url = `${wizardState.apiBaseUrl.replace(/\/$/, "")}${wizardState.healthEndpoint}`;
    try {
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok || response.status < 500) {
        setConnectionStatus("success");
        setConnectionMessage(`Connected (HTTP ${response.status})`);
      } else {
        setConnectionStatus("failure");
        setConnectionMessage(`HTTP ${response.status} — server returned an error`);
      }
    } catch (err) {
      setConnectionStatus("failure");
      setConnectionMessage(
        err instanceof Error ? err.message : "Connection failed"
      );
    }
  };

  const handleSave = () => {
    const id = generateId(wizardState.slug, wizardState.environment);
    const config: ProgramConfig = {
      id,
      name: wizardState.name.trim(),
      slug: wizardState.slug,
      environment: wizardState.environment,
      description: wizardState.description.trim() || undefined,
      apiBaseUrl: wizardState.apiBaseUrl.trim(),
      healthEndpoint: wizardState.healthEndpoint.trim(),
      auth: { method: wizardState.authMethod },
      capabilities: wizardState.capabilities,
      endpoints: wizardState.endpoints,
      registeredAt: new Date().toISOString(),
    };
    addProgram(config, true);
    setSaved(true);
  };

  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {saved ? "Program Registered!" : "Add Program"}
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        {!saved && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Step {step + 1} of {STEPS.length}</span>
              <span>{STEPS[step]}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Step content */}
        <div className="py-2">
          {saved ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="text-lg font-semibold">{wizardState.name} registered</p>
              <p className="text-sm text-muted-foreground">
                The program has been added to the registry and is now active.
              </p>
              <Button onClick={handleClose} className="mt-2">
                Done
              </Button>
            </div>
          ) : (
            <>
              {step === 0 && (
                <StepProgramInfo state={wizardState} onChange={updateState} />
              )}
              {step === 1 && (
                <StepApiConnection
                  state={wizardState}
                  onChange={updateState}
                  connectionStatus={connectionStatus}
                  connectionMessage={connectionMessage}
                  onTestConnection={testConnection}
                />
              )}
              {step === 2 && (
                <StepModules state={wizardState} onChange={updateState} />
              )}
              {step === 3 && (
                <StepEndpointMapping state={wizardState} onChange={updateState} />
              )}
              {step === 4 && <StepSave state={wizardState} />}
            </>
          )}
        </div>

        {/* Navigation */}
        {!saved && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                size="sm"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleSave}>
                Save Program
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
