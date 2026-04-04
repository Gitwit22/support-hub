// ---------------------------------------------------------------------------
// Admin Settings page — editable endpoint management, per-endpoint diagnostics,
// usage key mapping, and troubleshooting hints.
// ---------------------------------------------------------------------------

import { useState, useCallback } from "react";
import {
  Link,
  Settings2,
  Trash2,
  PlayCircle,
  Save,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Pencil,
  X,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useProgram } from "@/lib/programs/ProgramContext";
import type { ProgramConfig, EndpointTestResult } from "@/lib/types/program";
import { isBuiltInProgram, getDefaultEndpoints } from "@/lib/programs/registry";
import {
  testEndpoint,
  testAllEndpoints,
} from "@/lib/programs/endpointValidator";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Ordered list of standard endpoint keys with human-readable labels. */
const STANDARD_ENDPOINTS: { key: string; label: string; description: string }[] = [
  { key: "health", label: "Health", description: "Simple connectivity / ping check" },
  { key: "status", label: "Status", description: "Detailed service status" },
  { key: "resourceList", label: "Resource List", description: "List of primary resources (rooms, tickets…)" },
  { key: "resourceDetail", label: "Resource Detail", description: "Single resource — use :id as placeholder" },
  { key: "resourceActivity", label: "Resource Activity", description: "Activity stream for a resource" },
  { key: "alerts", label: "Alerts", description: "Alerts / monitoring feed" },
  { key: "usage", label: "Usage", description: "Usage / metering overview" },
  { key: "webhooks", label: "Webhooks", description: "Webhook management" },
  { key: "diagnostics", label: "Diagnostics", description: "Self-check / diagnostics" },
];

/** Internal UsageMetrics keys with display labels. */
const USAGE_METRIC_KEYS: { key: string; label: string }[] = [
  { key: "ticketsToday", label: "Tickets Today" },
  { key: "activeUsers", label: "Active Users" },
  { key: "roomsCreated", label: "Rooms Created" },
  { key: "messagesSent", label: "Messages Sent" },
  { key: "streamMinutes", label: "Stream Minutes" },
  { key: "apiRequests", label: "API Requests" },
  { key: "recordingsCreated", label: "Recordings Created" },
  { key: "hlsMinutes", label: "HLS Minutes" },
];

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

function StatusBadge({ result }: { result: EndpointTestResult | undefined }) {
  if (!result) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        Untested
      </Badge>
    );
  }
  if (result.validationPassed) {
    return (
      <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        OK
        {result.status && <span className="ml-1 opacity-70">{result.status}</span>}
      </Badge>
    );
  }
  if (result.reachable) {
    return (
      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Reachable
        {result.status && <span className="ml-1 opacity-70">{result.status}</span>}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs text-destructive border-destructive/30 bg-destructive/5">
      <XCircle className="h-3 w-3 mr-1" />
      Failed
    </Badge>
  );
}

function DiagnosticsPanel({
  result,
  baseUrl,
}: {
  result: EndpointTestResult;
  baseUrl: string;
}) {
  return (
    <div className="mt-2 ml-4 rounded-md border border-border bg-muted/40 p-3 text-xs space-y-1.5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Full URL</span>
        <span className="font-mono break-all text-card-foreground">
          {baseUrl || "(no base URL)"}{result.path}
        </span>

        <span className="text-muted-foreground">HTTP Status</span>
        <span className={result.status != null && result.status < 400 ? "text-emerald-700" : "text-destructive"}>
          {result.status ?? "—"}
        </span>

        <span className="text-muted-foreground">Response Time</span>
        <span>{result.responseTimeMs != null ? `${result.responseTimeMs} ms` : "—"}</span>

        <span className="text-muted-foreground">Reachable</span>
        <span className={result.reachable ? "text-emerald-700" : "text-destructive"}>
          {result.reachable ? "Yes" : "No"}
        </span>

        <span className="text-muted-foreground">Validation</span>
        <span className={result.validationPassed ? "text-emerald-700" : "text-amber-600"}>
          {result.validationPassed ? "Passed" : "Failed"}
        </span>

        {result.failureReason && (
          <>
            <span className="text-muted-foreground">Failure Reason</span>
            <span className="text-destructive">{result.failureReason}</span>
          </>
        )}

        {result.lastSuccessAt && (
          <>
            <span className="text-muted-foreground">Last Success</span>
            <span>{new Date(result.lastSuccessAt).toLocaleString()}</span>
          </>
        )}

        {result.detectedKeys && result.detectedKeys.length > 0 && (
          <>
            <span className="text-muted-foreground">Detected Keys</span>
            <span className="font-mono">{result.detectedKeys.join(", ")}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EndpointRow — single editable endpoint row
// ---------------------------------------------------------------------------

interface EndpointRowProps {
  endpointKey: string;
  label: string;
  description: string;
  path: string;
  baseUrl: string;
  testResult: EndpointTestResult | undefined;
  onSave: (key: string, path: string) => void;
  onTest: (key: string, path: string) => Promise<void>;
  isTesting: boolean;
}

function EndpointRow({
  endpointKey,
  label,
  description,
  path,
  baseUrl,
  testResult,
  onSave,
  onTest,
  isTesting,
}: EndpointRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(path);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const handleEdit = () => {
    setDraft(path);
    setEditing(true);
  };

  const handleCancel = () => {
    setDraft(path);
    setEditing(false);
  };

  const handleSave = () => {
    onSave(endpointKey, draft);
    setEditing(false);
  };

  const handleTest = async () => {
    const pathToTest = editing ? draft : path;
    await onTest(endpointKey, pathToTest);
    setShowDiagnostics(true);
  };

  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-start gap-3">
        {/* Label column */}
        <div className="w-36 shrink-0 pt-1">
          <p className="text-sm font-medium text-card-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        {/* Path input / display */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="font-mono text-xs h-8"
              placeholder="/api/your/endpoint"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
          ) : (
            <p className="text-xs font-mono text-card-foreground break-all pt-1.5">
              {path || <span className="text-muted-foreground italic">not configured</span>}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <StatusBadge result={testResult} />

          {editing ? (
            <>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSave}>
                <Save className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={handleCancel}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleEdit} title="Edit path">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={handleTest}
            disabled={isTesting || (!path && !draft)}
            title="Test endpoint"
          >
            {isTesting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
          </Button>

          {testResult && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-muted-foreground"
              onClick={() => setShowDiagnostics((v) => !v)}
              title={showDiagnostics ? "Hide diagnostics" : "Show diagnostics"}
            >
              {showDiagnostics ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {showDiagnostics && testResult && (
        <DiagnosticsPanel result={testResult} baseUrl={baseUrl} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Usage metric mapping editor
// ---------------------------------------------------------------------------

interface UsageMappingEditorProps {
  currentMapping: Record<string, string>;
  detectedApiKeys: string[];
  onSave: (mapping: Record<string, string>) => void;
}

function UsageMappingEditor({
  currentMapping,
  detectedApiKeys,
  onSave,
}: UsageMappingEditorProps) {
  const [draft, setDraft] = useState<Record<string, string>>(currentMapping);
  const [dirty, setDirty] = useState(false);

  const handleChange = (internalKey: string, apiKey: string) => {
    setDraft((prev) => ({ ...prev, [internalKey]: apiKey }));
    setDirty(true);
  };

  const handleSave = () => {
    onSave(draft);
    setDirty(false);
  };

  const apiKeyOptions = ["(none)", ...detectedApiKeys];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Map each Support Hub usage metric to the corresponding key in your API&apos;s
        usage response. Run the <strong>Usage</strong> endpoint test first to
        detect available keys.
      </p>

      <div className="divide-y divide-border rounded-md border border-border">
        {USAGE_METRIC_KEYS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3 px-3 py-2.5">
            <span className="text-sm text-card-foreground w-40 shrink-0">{label}</span>
            <span className="text-xs font-mono text-muted-foreground w-32 shrink-0">{key}</span>
            <span className="text-muted-foreground text-xs">←</span>
            <Select
              value={draft[key] ?? "(none)"}
              onValueChange={(v) => handleChange(key, v === "(none)" ? "" : v)}
            >
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Select API key…" />
              </SelectTrigger>
              <SelectContent>
                {apiKeyOptions.map((k) => (
                  <SelectItem key={k} value={k} className="text-xs font-mono">
                    {k}
                  </SelectItem>
                ))}
                {detectedApiKeys.length === 0 && (
                  <SelectItem value="__hint__" disabled className="text-xs text-muted-foreground">
                    Run a Usage endpoint test to detect keys
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={!dirty} className="gap-2">
          <Save className="h-3.5 w-3.5" />
          Save Mapping
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Troubleshooting hints
// ---------------------------------------------------------------------------

interface TroubleshootingHintsProps {
  testResults: Record<string, EndpointTestResult>;
  usageMapping: Record<string, string>;
  resourceLabel: string;
}

function TroubleshootingHints({
  testResults,
  usageMapping,
  resourceLabel,
}: TroubleshootingHintsProps) {
  const hints: string[] = [];

  const usageResult = testResults["usage"];
  const resourceResult = testResults["resourceList"];

  if (
    usageResult?.reachable &&
    resourceLabel === "room" &&
    !usageMapping["roomsCreated"]
  ) {
    hints.push(
      'The usage endpoint is reachable, but no usage metric is currently mapped to the "rooms created" card. Add a mapping under Usage Metric Mapping.'
    );
  }

  if (
    resourceResult?.reachable &&
    resourceResult.validationPassed &&
    (!usageResult || !usageResult.reachable)
  ) {
    hints.push(
      `The ${resourceLabel} list endpoint is reachable and returning data, but the usage endpoint is missing or failing. Consider deriving a count metric from the resource list response.`
    );
  }

  const unauthorized = Object.values(testResults).filter(
    (r) => r.status === 401 || r.status === 403
  );
  if (unauthorized.length > 0) {
    hints.push(
      `${unauthorized.length} endpoint(s) returned an auth error (401/403). Verify that the API token / auth method is correct.`
    );
  }

  const missing = Object.values(testResults).filter(
    (r) => !r.reachable && r.failureReason?.includes("connection")
  );
  if (missing.length > 0) {
    hints.push(
      `${missing.length} endpoint(s) could not be reached. This usually means the API base URL is wrong or the server is unreachable from the browser (check CORS headers).`
    );
  }

  if (hints.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
      <div className="flex items-center gap-2 text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <h3 className="text-sm font-semibold">Troubleshooting</h3>
      </div>
      <ul className="space-y-1.5 pl-5 list-disc">
        {hints.map((h, i) => (
          <li key={i} className="text-xs text-amber-800 leading-relaxed">
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main settings view
// ---------------------------------------------------------------------------

function ProgramSettingsView({ program }: { program: ProgramConfig }) {
  const { removeProgram, updateProgramEndpoints, updateProgramUsageMapping } =
    useProgram();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isBuiltIn = isBuiltInProgram(program.id);

  const [endpointDrafts, setEndpointDrafts] = useState<Record<string, string>>(
    () => {
      const drafts: Record<string, string> = {};
      for (const { key } of STANDARD_ENDPOINTS) {
        drafts[key] = (program.endpoints[key] as string | undefined) ?? "";
      }
      for (const [k, v] of Object.entries(program.endpoints)) {
        if (!(k in drafts) && v) drafts[k] = v as string;
      }
      return drafts;
    }
  );

  const [testResults, setTestResults] = useState<Record<string, EndpointTestResult>>({});
  const [testingKeys, setTestingKeys] = useState<Set<string>>(new Set());
  const [testingAll, setTestingAll] = useState(false);

  const enabledCaps = (
    Object.keys(program.capabilities) as (keyof typeof program.capabilities)[]
  ).filter((k) => program.capabilities[k]);

  const customKeys = Object.keys(endpointDrafts).filter(
    (k) => !STANDARD_ENDPOINTS.some((s) => s.key === k)
  );

  const detectedUsageKeys: string[] =
    testResults["usage"]?.detectedKeys ?? [];

  const handleSaveEndpoint = useCallback(
    (key: string, path: string) => {
      setEndpointDrafts((prev) => ({ ...prev, [key]: path }));
      updateProgramEndpoints({ [key]: path });
    },
    [updateProgramEndpoints]
  );

  const handleSaveAllEndpoints = useCallback(() => {
    updateProgramEndpoints(endpointDrafts);
  }, [endpointDrafts, updateProgramEndpoints]);

  const handleTestEndpoint = useCallback(
    async (key: string, path: string) => {
      if (!path) return;
      setTestingKeys((prev) => new Set(prev).add(key));
      try {
        const result = await testEndpoint(key, path, program.apiBaseUrl, program.auth);
        setTestResults((prev) => ({ ...prev, [key]: result }));
      } finally {
        setTestingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [program.apiBaseUrl, program.auth]
  );

  const handleTestAll = useCallback(async () => {
    const allEndpoints: Record<string, string> = {};
    for (const [k, v] of Object.entries(endpointDrafts)) {
      if (v) allEndpoints[k] = v;
    }
    setTestingAll(true);
    try {
      const results = await testAllEndpoints(allEndpoints, program.apiBaseUrl, program.auth);
      setTestResults(results);
    } finally {
      setTestingAll(false);
    }
  }, [endpointDrafts, program.apiBaseUrl, program.auth]);

  const handleResetEndpoints = useCallback(() => {
    const defaults = getDefaultEndpoints(program.id);
    if (!defaults) return;
    const reset: Record<string, string> = {};
    for (const [k, v] of Object.entries(defaults)) {
      if (v) reset[k] = v as string;
    }
    setEndpointDrafts(reset);
    updateProgramEndpoints(reset);
  }, [program.id, updateProgramEndpoints]);

  const handleSaveUsageMapping = useCallback(
    (mapping: Record<string, string>) => {
      updateProgramUsageMapping(mapping);
    },
    [updateProgramUsageMapping]
  );

  const hasTestResults = Object.keys(testResults).length > 0;
  const hasIssues =
    hasTestResults &&
    Object.values(testResults).some((r) => !r.validationPassed);

  const lastTestedAt = hasTestResults
    ? Object.values(testResults).sort((a, b) =>
        b.lastTestedAt.localeCompare(a.lastTestedAt)
      )[0].lastTestedAt
    : null;

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
            <p className="text-sm text-muted-foreground">
              Stored configuration for this program.
            </p>
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
            <p className="text-sm text-muted-foreground">
              Modules active for this program.
            </p>
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

      {/* Editable endpoint settings */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Link className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">
                Endpoint Settings
              </h2>
              <p className="text-sm text-muted-foreground">
                Edit paths, save, and test each endpoint. Paths are relative to
                the API base URL.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={handleResetEndpoints}
              title="Reset to original defaults"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Defaults
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={handleSaveAllEndpoints}
            >
              <Save className="h-3.5 w-3.5" />
              Save All
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleTestAll}
              disabled={testingAll}
            >
              {testingAll ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlayCircle className="h-3.5 w-3.5" />
              )}
              Test All / Re-run Validation
            </Button>
          </div>
        </div>

        <div>
          {STANDARD_ENDPOINTS.map(({ key, label, description }) => (
            <EndpointRow
              key={key}
              endpointKey={key}
              label={label}
              description={description}
              path={endpointDrafts[key] ?? ""}
              baseUrl={program.apiBaseUrl}
              testResult={testResults[key]}
              onSave={handleSaveEndpoint}
              onTest={handleTestEndpoint}
              isTesting={testingKeys.has(key) || testingAll}
            />
          ))}

          {customKeys.map((key) => (
            <EndpointRow
              key={key}
              endpointKey={key}
              label={key}
              description="Custom endpoint"
              path={endpointDrafts[key] ?? ""}
              baseUrl={program.apiBaseUrl}
              testResult={testResults[key]}
              onSave={handleSaveEndpoint}
              onTest={handleTestEndpoint}
              isTesting={testingKeys.has(key) || testingAll}
            />
          ))}
        </div>

        {hasTestResults && lastTestedAt && (
          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Last validated{" "}
              {new Date(lastTestedAt).toLocaleString()}
              {" · "}
              {Object.values(testResults).filter((r) => r.validationPassed).length}/
              {Object.keys(testResults).length} endpoints passed
            </span>
          </div>
        )}
      </div>

      {/* Troubleshooting hints */}
      {hasIssues && (
        <TroubleshootingHints
          testResults={testResults}
          usageMapping={program.usageKeyMapping ?? {}}
          resourceLabel={program.resourceLabel ?? "resource"}
        />
      )}

      {/* Usage metric mapping */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">
            Usage Metric Mapping
          </h2>
          <p className="text-sm text-muted-foreground">
            Map your API&apos;s usage response keys to Support Hub&apos;s internal metric
            labels. Test the <em>Usage</em> endpoint above to auto-detect
            available keys.
          </p>
        </div>

        <UsageMappingEditor
          currentMapping={program.usageKeyMapping ?? {}}
          detectedApiKeys={detectedUsageKeys}
          onSave={handleSaveUsageMapping}
        />

        {detectedUsageKeys.length > 0 && (() => {
          const mapped = Object.values(program.usageKeyMapping ?? {});
          const unmapped = detectedUsageKeys.filter((k) => !mapped.includes(k));
          if (unmapped.length === 0) return null;
          return (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
              <p className="font-medium">Unmapped API keys detected</p>
              <p>
                The following keys were found in the usage response but are not
                yet mapped:{" "}
                <span className="font-mono">{unmapped.join(", ")}</span>
              </p>
            </div>
          );
        })()}
      </div>

      {/* No API configured */}
      {!program.apiBaseUrl && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <Settings2 className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">No API configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Use the program switcher to edit this program&apos;s integration
            settings.
          </p>
        </div>
      )}

      {/* Program management */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">
            Program Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Remove this program from Support Hub.
          </p>
        </div>

        {isBuiltIn ? (
          <p className="text-sm text-muted-foreground">
            Built-in programs cannot be deleted.
          </p>
        ) : (
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete Program
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {program.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the program configuration from local registry
                  storage. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => removeProgram(program.id)}
                >
                  Delete Program
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function AdminSettingsPage() {
  const { activeProgram } = useProgram();
  return <ProgramSettingsView program={activeProgram} />;
}
