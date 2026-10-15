// ---------------------------------------------------------------------------
// ProgramIntakeWizard — 6-step guided wizard for onboarding a new program.
// Saving registers the program with the monitoring backend (application,
// environment, health checks, telemetry key) before it joins the local
// program list, so a program in the switcher is always really monitored.
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
import { CheckCircle2, XCircle, Loader2, ChevronRight, ChevronLeft, Plus, Trash2, Circle, Copy, AlertTriangle } from "lucide-react";
import type {
  ProgramConfig,
  ProgramCapabilities,
  ProgramEndpoints,
  ProgramEnvironment,
  AuthMethod,
  UsageItem,
} from "@/lib/types/program";
import { useProgram } from "@/lib/programs/ProgramContext";
import {
  APPLICATION_ID_PATTERN,
  SECRET_NAME_PATTERN,
  OnboardingError,
  isHttpsUrl,
  joinUrl,
  onboardProgram,
  probeEndpoint,
  suggestSecretName,
  toMonitoringEnvironment,
  type OnboardingProgress,
  type OnboardingResult,
  type OnboardingStep,
  type PlannedHealthCheck,
} from "@/lib/api/monitoring";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Wizard state shape
// ---------------------------------------------------------------------------

interface WizardState {
  // Step 1 — Basic Info + Usage Items
  name: string;
  slug: string;
  systemName: string;
  resourceLabel: string;
  environment: ProgramEnvironment;
  description: string;
  usageItems: UsageItem[];

  // Step 2 — API Connection
  apiBaseUrl: string;
  healthEndpoint: string;
  authMethod: AuthMethod;

  // Step 3 — Health Checks (polled by Support Hub)
  healthChecks: PlannedHealthCheck[];
  /** Worker secret (HC_*) holding the bearer token for checks that require auth. */
  authSecretName: string;

  // Step 4 — Module Selection
  capabilities: ProgramCapabilities;

  // Step 5 — Endpoint Mapping (generic categories)
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
  systemName: "",
  resourceLabel: "",
  environment: "production",
  description: "",
  usageItems: [],
  apiBaseUrl: "",
  healthEndpoint: "/health",
  authMethod: "bearer",
  healthChecks: [],
  authSecretName: "",
  capabilities: { ...DEFAULT_CAPABILITIES },
  endpoints: {},
};

const STEPS = [
  "Program Info",
  "API Connection",
  "Health Checks",
  "Modules",
  "Endpoint Mapping",
  "Save",
];
const STEP_HEALTH_CHECKS = 2;

const ONBOARDING_STEPS: { step: OnboardingStep; label: string }[] = [
  { step: "application", label: "Register application" },
  { step: "environment", label: "Register environment" },
  { step: "healthChecks", label: "Add health checks" },
  { step: "telemetryKey", label: "Issue telemetry key" },
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

/** Convert a human label to a snake_case key: "Rooms Created" → "rooms_created" */
function labelToKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type ConnectionStatus = "idle" | "testing" | "success" | "failure";

// ---------------------------------------------------------------------------
// Add Usage Item inline form
// ---------------------------------------------------------------------------

interface AddUsageItemFormProps {
  onAdd: (item: UsageItem) => void;
  onCancel: () => void;
  existingKeys: string[];
}

function AddUsageItemForm({ onAdd, onCancel, existingKeys }: AddUsageItemFormProps) {
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("");
  const [type, setType] = useState<"count" | "duration">("count");

  const derivedKey = labelToKey(label.trim());
  const keyEmpty = label.trim() !== "" && derivedKey === "";
  const keyDuplicate = derivedKey !== "" && existingKeys.includes(derivedKey);
  const canAdd = label.trim() !== "" && derivedKey !== "" && !keyDuplicate;

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({
      key: derivedKey,
      label: label.trim(),
      unit: unit.trim() || undefined,
      type,
    });
  };

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
      <p className="text-xs font-medium text-foreground">New Usage Item</p>
      <div className="space-y-1.5">
        <Label className="text-xs">Item Label *</Label>
        <Input
          className="h-8 text-sm"
          placeholder='e.g. "Rooms Created"'
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          autoFocus
        />
        {label.trim() && (
          keyEmpty ? (
            <p className="text-xs text-destructive">Label must contain at least one letter or digit.</p>
          ) : keyDuplicate ? (
            <p className="text-xs text-destructive">
              Key <span className="font-mono">{derivedKey}</span> already exists. Use a different label.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Key: <span className="font-mono">{derivedKey}</span>
            </p>
          )
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Unit (optional)</Label>
          <Input
            className="h-8 text-sm"
            placeholder="e.g. minutes"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as "count" | "duration")}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="count">Count</SelectItem>
              <SelectItem value="duration">Duration</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleAdd} disabled={!canAdd}>
          Add Item
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

/** Endpoint category fields shown in Step 4. */
const ENDPOINT_CATEGORIES: { field: keyof ProgramEndpoints; label: string; placeholder: string }[] = [
  { field: "health",           label: "Health / ping",          placeholder: "/health" },
  { field: "status",           label: "Status (detailed)",      placeholder: "/status" },
  { field: "eventsIngest",     label: "Events / telemetry",     placeholder: "/events" },
  { field: "alerts",           label: "Alerts feed",            placeholder: "/alerts" },
  { field: "usage",            label: "Usage / metering",       placeholder: "/usage" },
  { field: "webhooks",         label: "Webhook management",     placeholder: "/webhooks" },
  { field: "diagnostics",      label: "Diagnostics self-check", placeholder: "/diagnostics" },
  { field: "resourceList",     label: "Resource list",          placeholder: "/resources" },
  { field: "resourceDetail",   label: "Resource detail (:id)",  placeholder: "/resources/:id" },
  { field: "resourceActivity", label: "Resource activity (:id)",placeholder: "/resources/:id/activity" },
];

function StepProgramInfo({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);

  const addItem = (item: UsageItem) => {
    onChange({ usageItems: [...state.usageItems, item] });
    setShowAddForm(false);
  };

  const removeItem = (key: string) => {
    onChange({ usageItems: state.usageItems.filter((i) => i.key !== key) });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="prog-name">Program Name *</Label>
        <Input
          id="prog-name"
          placeholder="e.g. My Platform"
          value={state.name}
          onChange={(e) => {
            const name = e.target.value;
            onChange({ name, slug: slugify(name) });
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="prog-system">System Name</Label>
          <Input
            id="prog-system"
            placeholder="e.g. StreamLine"
            value={state.systemName}
            onChange={(e) => onChange({ systemName: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prog-resource">Resource Label</Label>
          <Input
            id="prog-resource"
            placeholder="e.g. room, ticket, job"
            value={state.resourceLabel}
            onChange={(e) => onChange({ resourceLabel: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prog-slug">Slug *</Label>
        <Input
          id="prog-slug"
          placeholder="e.g. my-platform"
          value={state.slug}
          onChange={(e) => onChange({ slug: slugify(e.target.value) })}
        />
        {state.slug && !APPLICATION_ID_PATTERN.test(state.slug) ? (
          <p className="text-xs text-destructive">
            Must start with a letter and be 2–48 characters of lowercase letters, digits or "-".
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Auto-generated from name. This is the application id the program sends in its telemetry.
          </p>
        )}
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

      {/* Usage Items */}
      <div className="space-y-2">
        <div>
          <Label>Usage Items to Monitor</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            What metrics should this program track? Each item maps to a key returned by the usage API.
          </p>
        </div>

        {state.usageItems.length > 0 && (
          <div className="space-y-1">
            {state.usageItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium truncate">{item.label}</span>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    {item.key}
                  </span>
                  {item.unit && (
                    <Badge variant="secondary" className="text-xs shrink-0">{item.unit}</Badge>
                  )}
                  <Badge variant="outline" className="text-xs shrink-0 capitalize">{item.type}</Badge>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Remove ${item.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showAddForm ? (
          <AddUsageItemForm onAdd={addItem} onCancel={() => setShowAddForm(false)} existingKeys={state.usageItems.map((i) => i.key)} />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Usage Item
          </Button>
        )}
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
        {state.apiBaseUrl.trim() && !isHttpsUrl(state.apiBaseUrl.trim()) && (
          <p className="text-xs text-destructive">Must be a full https:// URL — Support Hub only polls over https.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="api-health">Health Endpoint *</Label>
        <Input
          id="api-health"
          placeholder="/health"
          value={state.healthEndpoint}
          onChange={(e) => onChange({ healthEndpoint: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Relative path used to verify connectivity. Tested from Support Hub's server, the same way it will be polled.
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
          disabled={!isHttpsUrl(state.apiBaseUrl.trim()) || connectionStatus === "testing"}
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

const CHECK_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;

function healthCheckErrors(state: WizardState): string[] {
  const errors: string[] = [];
  if (state.healthChecks.length === 0) errors.push("Add at least one health check.");
  const names = new Set<string>();
  state.healthChecks.forEach((check, index) => {
    const label = check.name.trim() || `Check ${index + 1}`;
    if (!CHECK_NAME_PATTERN.test(check.name.trim())) errors.push(`${label}: name must be 1–64 letters, digits, spaces, ".", "_" or "-".`);
    if (names.has(check.name.trim().toLowerCase())) errors.push(`${label}: names must be unique.`);
    names.add(check.name.trim().toLowerCase());
    if (!check.path.trim().startsWith("/")) errors.push(`${label}: path must start with "/".`);
  });
  if (state.healthChecks.some((check) => check.requiresAuth) && !SECRET_NAME_PATTERN.test(state.authSecretName)) {
    errors.push('Secret name must start with "HC_" and use only A–Z, 0–9 and "_".');
  }
  return errors;
}

function StepHealthChecks({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  const update = (index: number, patch: Partial<PlannedHealthCheck>) => {
    onChange({ healthChecks: state.healthChecks.map((check, i) => (i === index ? { ...check, ...patch } : check)) });
  };
  const remove = (index: number) => onChange({ healthChecks: state.healthChecks.filter((_, i) => i !== index) });
  const add = () => onChange({ healthChecks: [...state.healthChecks, { name: "", path: "/", requiresAuth: false }] });
  const needsSecret = state.healthChecks.some((check) => check.requiresAuth);
  const errors = healthCheckErrors(state);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Support Hub polls each path every minute. A check is up when it answers HTTP 200 within 10 seconds; an
        endpoint may also report <span className="font-mono">X-Health-Status: degraded</span>.
      </p>

      <div className="space-y-2">
        {state.healthChecks.map((check, index) => (
          <div key={index} className="rounded-md border border-border p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Check ${index + 1} name`}
                className="h-8 text-sm w-36"
                placeholder="name, e.g. live"
                value={check.name}
                onChange={(e) => update(index, { name: e.target.value })}
              />
              <Input
                aria-label={`Check ${index + 1} path`}
                className="h-8 text-sm font-mono flex-1"
                placeholder="/health"
                value={check.path}
                onChange={(e) => update(index, { path: e.target.value })}
              />
              <button
                type="button"
                onClick={() => remove(index)}
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove check ${index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  aria-label={`Check ${index + 1} requires auth`}
                  checked={check.requiresAuth}
                  onCheckedChange={(value) => update(index, { requiresAuth: value === true })}
                />
                Requires bearer token
              </label>
              {state.apiBaseUrl && check.path.startsWith("/") && (
                <span className="text-xs text-muted-foreground font-mono truncate">{joinUrl(state.apiBaseUrl, check.path)}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={add}>
        <Plus className="h-3.5 w-3.5" />
        Add Health Check
      </Button>

      {needsSecret && (
        <div className="space-y-1.5">
          <Label htmlFor="hc-secret">Health-check secret name *</Label>
          <Input
            id="hc-secret"
            className="font-mono"
            value={state.authSecretName}
            onChange={(e) => onChange({ authSecretName: e.target.value.toUpperCase() })}
          />
          <p className="text-xs text-muted-foreground">
            Name of the Support Hub Worker secret holding the token this program expects. Only the name is stored;
            set the value with <span className="font-mono">wrangler secret put {state.authSecretName || "HC_…"}</span>.
          </p>
        </div>
      )}

      {errors.length > 0 && state.healthChecks.length > 0 && (
        <ul className="space-y-0.5 text-xs text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const MODULE_OPTIONS: { key: keyof ProgramCapabilities; label: string }[] = [
  { key: "monitoring", label: "Monitoring" },
  { key: "tickets",    label: "Tickets" },
  { key: "logs",       label: "Logs" },
  { key: "metrics",    label: "Metrics" },
  { key: "alerts",     label: "Alerts" },
  { key: "chat",       label: "Chat" },
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
  const updateEndpoint = (field: keyof ProgramEndpoints, value: string) => {
    onChange({
      endpoints: { ...state.endpoints, [field]: value || undefined },
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Define API paths for each category (relative to API base URL). Leave
        blank to skip.
      </p>
      <div className="space-y-2">
        {ENDPOINT_CATEGORIES.map(({ field, label, placeholder }) => (
          <div key={field} className="flex items-center gap-2">
            <Label className="w-40 flex-shrink-0 text-xs">{label}</Label>
            <Input
              className="h-8 text-sm"
              placeholder={placeholder}
              value={(state.endpoints[field] as string | undefined) ?? ""}
              onChange={(e) => updateEndpoint(field, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StepSave({ state }: { state: WizardState }) {
  const id = generateId(state.slug, state.environment);
  const enabledModules = MODULE_OPTIONS.filter(({ key }) => state.capabilities[key]).map(({ label }) => label);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review the configuration below and click <strong>Save Program</strong>{" "}
        to register it with Support Hub monitoring. Saving registers the application and environment, adds the
        health checks and issues a telemetry key.
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
        {state.systemName && (
          <div className="flex gap-2">
            <span className="w-28 text-muted-foreground">System</span>
            <span>{state.systemName}</span>
          </div>
        )}
        <div className="flex gap-2">
          <span className="w-28 text-muted-foreground">Environment</span>
          <Badge variant="secondary" className="capitalize">{state.environment}</Badge>
        </div>
        <div className="flex gap-2">
          <span className="w-28 text-muted-foreground">API Base URL</span>
          <span className="font-mono text-xs break-all">{state.apiBaseUrl || "(none)"}</span>
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
          <span className="w-28 text-muted-foreground shrink-0">Health Checks</span>
          <div className="space-y-0.5 min-w-0">
            {state.healthChecks.map((check) => (
              <div key={check.name} className="text-xs">
                <span className="font-medium">{check.name}</span>{" "}
                <span className="font-mono text-muted-foreground break-all">{check.path}</span>
                {check.requiresAuth && (
                  <Badge variant="outline" className="ml-1 text-[10px] font-mono">{state.authSecretName}</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
        {state.resourceLabel && (
          <div className="flex gap-2">
            <span className="w-28 text-muted-foreground">Resource</span>
            <span>{state.resourceLabel}</span>
          </div>
        )}
        <div className="flex gap-2">
          <span className="w-28 text-muted-foreground">Modules</span>
          <div className="flex flex-wrap gap-1">
            {enabledModules.length > 0
              ? enabledModules.map((m) => (
                  <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                ))
              : <span className="text-muted-foreground">None selected</span>}
          </div>
        </div>
        {state.usageItems.length > 0 && (
          <div className="flex gap-2">
            <span className="w-28 text-muted-foreground shrink-0">Usage Items</span>
            <div className="flex flex-wrap gap-1">
              {state.usageItems.map((item) => (
                <Badge key={item.key} variant="outline" className="text-xs">{item.label}</Badge>
              ))}
            </div>
          </div>
        )}
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
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<Partial<Record<OnboardingStep, OnboardingProgress>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [copied, setCopied] = useState(false);

  const updateState = useCallback((patch: Partial<WizardState>) => {
    setWizardState((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleClose = () => {
    // The telemetry token is shown once; don't let a stray click lose it.
    if (result && !copied && !window.confirm("The telemetry key will not be shown again. Close anyway?")) return;
    setStep(0);
    setWizardState(INITIAL_STATE);
    setConnectionStatus("idle");
    setConnectionMessage("");
    setSaved(false);
    setSaving(false);
    setProgress({});
    setSaveError(null);
    setResult(null);
    setCopied(false);
    onClose();
  };

  const canAdvance = (): boolean => {
    if (step === 0) return wizardState.name.trim() !== "" && APPLICATION_ID_PATTERN.test(wizardState.slug);
    if (step === 1) return isHttpsUrl(wizardState.apiBaseUrl.trim()) && wizardState.healthEndpoint.trim().startsWith("/");
    if (step === STEP_HEALTH_CHECKS) return healthCheckErrors(wizardState).length === 0;
    return true;
  };

  const goNext = () => {
    // Seed the health-check step from the connection step the first time it opens.
    if (step + 1 === STEP_HEALTH_CHECKS) {
      setWizardState((prev) => ({
        ...prev,
        healthChecks: prev.healthChecks.length
          ? prev.healthChecks
          : [{ name: "health", path: prev.healthEndpoint.trim(), requiresAuth: false }],
        authSecretName: prev.authSecretName || suggestSecretName(prev.slug, prev.environment),
      }));
    }
    setStep((s) => s + 1);
  };

  const testConnection = async () => {
    setConnectionStatus("testing");
    try {
      const probe = await probeEndpoint(joinUrl(wizardState.apiBaseUrl, wizardState.healthEndpoint));
      if (probe.status === "down") {
        setConnectionStatus("failure");
        setConnectionMessage(probe.errorMessage ?? "Endpoint is down");
      } else {
        setConnectionStatus("success");
        setConnectionMessage(
          `Reachable (HTTP ${probe.httpStatus}, ${probe.latencyMs}ms)${probe.status === "degraded" ? " — reports degraded" : ""}`,
        );
      }
    } catch (err) {
      setConnectionStatus("failure");
      setConnectionMessage(err instanceof Error ? err.message : "Connection test failed");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setProgress({});
    let onboarding: OnboardingResult;
    try {
      onboarding = await onboardProgram(
        {
          applicationId: wizardState.slug,
          name: wizardState.name.trim(),
          description: wizardState.description.trim() || undefined,
          environment: toMonitoringEnvironment(wizardState.environment),
          baseUrl: wizardState.apiBaseUrl.trim().replace(/\/+$/, ""),
          healthChecks: wizardState.healthChecks.map((check) => ({ ...check, name: check.name.trim(), path: check.path.trim() })),
          authSecretName: wizardState.healthChecks.some((check) => check.requiresAuth) ? wizardState.authSecretName : undefined,
          keyLabel: `${wizardState.name.trim()} ${wizardState.environment} (onboarding)`,
        },
        (update) => setProgress((prev) => ({ ...prev, [update.step]: update })),
      );
    } catch (error) {
      // Nothing is added to the local registry unless the backend registration completed.
      setSaveError(
        error instanceof OnboardingError
          ? `${ONBOARDING_STEPS.find((s) => s.step === error.step)?.label ?? error.step} failed: ${error.message}`
          : (error as Error).message,
      );
      setSaving(false);
      return;
    }

    const id = generateId(wizardState.slug, wizardState.environment);
    const config: ProgramConfig = {
      id,
      name: wizardState.name.trim(),
      slug: wizardState.slug,
      systemName: wizardState.systemName.trim() || undefined,
      resourceLabel: wizardState.resourceLabel.trim() || undefined,
      environment: wizardState.environment,
      description: wizardState.description.trim() || undefined,
      apiBaseUrl: wizardState.apiBaseUrl.trim(),
      healthEndpoint: wizardState.healthEndpoint.trim(),
      auth: { method: wizardState.authMethod },
      capabilities: wizardState.capabilities,
      endpoints: wizardState.endpoints,
      usageItems: wizardState.usageItems.length > 0 ? wizardState.usageItems : undefined,
      registeredAt: new Date().toISOString(),
      monitoring: {
        applicationId: onboarding.applicationId,
        environmentId: onboarding.environmentId,
        telemetryKeyId: onboarding.telemetryKey.id,
      },
    };
    addProgram(config, true);
    setResult(onboarding);
    setSaving(false);
    setSaved(true);
  };

  const envSnippet = result
    ? [
        `SUPPORT_HUB_URL=${window.location.origin}`,
        `SUPPORT_HUB_TELEMETRY_KEY=${result.telemetryKey.token}`,
        `SUPPORT_HUB_ENVIRONMENT=${toMonitoringEnvironment(wizardState.environment)}`,
      ].join("\n")
    : "";

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(envSnippet);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{saved ? "Program Registered!" : "Add Program"}</DialogTitle>
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
        <div className="py-2 max-h-[60vh] overflow-y-auto pr-1">
          {saved && result ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-lg font-semibold">{wizardState.name} registered</p>
                <p className="text-sm text-muted-foreground">
                  Monitoring is set up. Health checks start running within a minute.
                </p>
              </div>

              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Copy this now: the telemetry key is shown once and Support Hub stores only its hash. Add these to the
                  program's server environment (never a browser/<span className="font-mono">VITE_</span> variable).
                </span>
              </div>

              <pre data-testid="telemetry-env" className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {envSnippet}
              </pre>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copySnippet}>
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </Button>

              {wizardState.healthChecks.some((check) => check.requiresAuth) && (
                <p className="text-xs text-muted-foreground">
                  Authenticated checks read Worker secret{" "}
                  <span className="font-mono">{wizardState.authSecretName}</span>. Until it is set (
                  <span className="font-mono">wrangler secret put {wizardState.authSecretName}</span>) they report down
                  with a configuration error.
                </p>
              )}

              <div className="flex justify-end">
                <Button onClick={handleClose}>Done</Button>
              </div>
            </div>
          ) : (
            <>
              {step === 0 && <StepProgramInfo state={wizardState} onChange={updateState} />}
              {step === 1 && (
                <StepApiConnection
                  state={wizardState}
                  onChange={updateState}
                  connectionStatus={connectionStatus}
                  connectionMessage={connectionMessage}
                  onTestConnection={testConnection}
                />
              )}
              {step === STEP_HEALTH_CHECKS && <StepHealthChecks state={wizardState} onChange={updateState} />}
              {step === 3 && <StepModules state={wizardState} onChange={updateState} />}
              {step === 4 && <StepEndpointMapping state={wizardState} onChange={updateState} />}
              {step === 5 && (
                <div className="space-y-4">
                  <StepSave state={wizardState} />
                  {(saving || saveError || Object.keys(progress).length > 0) && (
                    <ul className="space-y-1.5 text-sm" aria-label="Registration progress">
                      {ONBOARDING_STEPS.map(({ step: id, label }) => {
                        const entry = progress[id];
                        return (
                          <li key={id} className="flex items-start gap-2">
                            {entry?.status === "running" ? (
                              <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-muted-foreground" />
                            ) : entry?.status === "done" ? (
                              <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
                            ) : entry?.status === "failed" ? (
                              <XCircle className="h-4 w-4 mt-0.5 text-destructive" />
                            ) : (
                              <Circle className="h-4 w-4 mt-0.5 text-muted-foreground/50" />
                            )}
                            <span>
                              {label}
                              {entry?.detail && <span className="block text-xs text-muted-foreground">{entry.detail}</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {saveError && (
                    <p role="alert" className="text-sm text-destructive">
                      {saveError} Nothing was added to the program list. Fix the issue and retry — completed steps are reused.
                    </p>
                  )}
                </div>
              )}
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
              disabled={step === 0 || saving}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={goNext} disabled={!canAdvance()}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saveError ? "Retry" : "Save Program"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
