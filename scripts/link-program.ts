// Links an application to Support Hub monitoring from its manifest, then
// verifies the connection. Safe to re-run: existing records are reused and a
// new telemetry key is issued only when the environment has none (or --new-key).
//
//   npm run link-program -- <manifest.json> [--environment production] [--new-key] [--wait 600]
//
// Environment:
//   SUPPORT_HUB_URL            e.g. https://support.example.com (http://localhost:8787 for wrangler dev)
//   CF_ACCESS_CLIENT_ID        Cloudflare Access service token (not needed for localhost dev bypass)
//   CF_ACCESS_CLIENT_SECRET
//
// Exit codes: 0 connected · 2 partially connected · 1 not connected or failed.

import { readFileSync } from "node:fs";
import {
  APPLICATION_ID_PATTERN,
  SECRET_NAME_PATTERN,
  configureMonitoringClient,
  isHttpsUrl,
  onboardProgram,
  verifyConnection,
  type ConnectionReport,
  type MonitoringEnvironment,
  type OnboardingPlan,
} from "@/lib/api/monitoring";

interface Manifest {
  manifestVersion: 1;
  application: { id: string; name: string; description?: string };
  healthChecks: Array<{ name: string; path: string; requiresAuth?: boolean }>;
  environments: Partial<Record<MonitoringEnvironment, { baseUrl: string; authSecretName?: string }>>;
}

class UsageError extends Error {}

function parseArgs(argv: string[]) {
  const args = { manifest: "", environment: "production" as MonitoringEnvironment, newKey: false, waitSeconds: 0 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--environment") args.environment = argv[++i] as MonitoringEnvironment;
    else if (arg === "--new-key") args.newKey = true;
    else if (arg === "--wait") args.waitSeconds = Number(argv[++i]);
    else if (arg === "--") continue;
    else if (!arg.startsWith("--") && !args.manifest) args.manifest = arg;
    else throw new UsageError(`Unknown argument: ${arg}`);
  }
  if (!args.manifest) throw new UsageError("Missing <manifest.json>");
  if (!["production", "staging", "development"].includes(args.environment)) {
    throw new UsageError("--environment must be production, staging or development");
  }
  if (!Number.isInteger(args.waitSeconds) || args.waitSeconds < 0) throw new UsageError("--wait takes a number of seconds");
  return args;
}

function loadManifest(path: string): Manifest {
  const manifest = JSON.parse(readFileSync(path, "utf8")) as Manifest;
  const problems: string[] = [];
  if (manifest.manifestVersion !== 1) problems.push("manifestVersion must be 1");
  if (!APPLICATION_ID_PATTERN.test(manifest.application?.id ?? "")) problems.push("application.id must be a lowercase slug");
  if (!manifest.application?.name) problems.push("application.name is required");
  if (!Array.isArray(manifest.healthChecks) || !manifest.healthChecks.length) problems.push("healthChecks must list at least one check");
  for (const check of manifest.healthChecks ?? []) {
    if (!check.name || !check.path?.startsWith("/")) problems.push(`health check ${JSON.stringify(check)} needs a name and a path starting with "/"`);
  }
  if (problems.length) throw new UsageError(`Invalid manifest ${path}:\n  - ${problems.join("\n  - ")}`);
  return manifest;
}

function printReport(report: ConnectionReport): void {
  const mark = (ok: boolean) => (ok ? "✔" : "✘");
  console.log(`\nConnection: ${report.verdict.toUpperCase().replace("_", " ")}  (${report.applicationName} ${report.environment})`);
  for (const step of report.steps) console.log(`  ${mark(step.ok)} ${step.id}: ${step.detail}`);
  for (const check of report.healthChecks) {
    const detail = check.status === "not_run" ? "not run yet" : `${check.status}${check.httpStatus ? ` HTTP ${check.httpStatus}` : ""}${check.latencyMs !== null ? ` ${check.latencyMs}ms` : ""}`;
    console.log(`      - ${check.name}: ${detail}${check.errorMessage ? ` (${check.errorMessage})` : ""}`);
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const manifest = loadManifest(args.manifest);
  const target = manifest.environments?.[args.environment];
  if (!target) throw new UsageError(`Manifest has no "${args.environment}" environment`);
  if (!isHttpsUrl(target.baseUrl)) throw new UsageError(`environments.${args.environment}.baseUrl must be https`);
  const needsAuth = manifest.healthChecks.some((check) => check.requiresAuth);
  if (needsAuth && !SECRET_NAME_PATTERN.test(target.authSecretName ?? "")) {
    throw new UsageError(`environments.${args.environment}.authSecretName must be an HC_* secret name (a check requires auth)`);
  }

  const origin = process.env.SUPPORT_HUB_URL?.trim();
  if (!origin) throw new UsageError("Set SUPPORT_HUB_URL");
  const clientId = process.env.CF_ACCESS_CLIENT_ID?.trim();
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET?.trim();
  configureMonitoringClient({
    origin,
    headers: clientId && clientSecret ? { "CF-Access-Client-Id": clientId, "CF-Access-Client-Secret": clientSecret } : {},
  });

  const plan: OnboardingPlan = {
    applicationId: manifest.application.id,
    name: manifest.application.name,
    description: manifest.application.description,
    environment: args.environment,
    baseUrl: target.baseUrl.replace(/\/+$/, ""),
    healthChecks: manifest.healthChecks.map((check) => ({ name: check.name, path: check.path, requiresAuth: Boolean(check.requiresAuth) })),
    authSecretName: needsAuth ? target.authSecretName : undefined,
    keyLabel: `${manifest.application.name} ${args.environment} (link-program)`,
    keyPolicy: args.newKey ? "always" : "if-none-active",
  };

  console.log(`Linking ${plan.applicationId} (${plan.environment}) to ${origin}`);
  const result = await onboardProgram(plan, (progress) => {
    if (progress.status !== "running") console.log(`  ${progress.status === "done" ? "✔" : "✘"} ${progress.step}: ${progress.detail ?? ""}`);
  });

  if (result.telemetryKey) {
    console.log("\nSet these on the application's server, then redeploy it. The key is shown ONCE:\n");
    console.log(`SUPPORT_HUB_URL=${origin.replace(/\/+$/, "")}`);
    console.log(`SUPPORT_HUB_TELEMETRY_KEY=${result.telemetryKey.token}`);
    console.log(`SUPPORT_HUB_ENVIRONMENT=${plan.environment}`);
  }
  if (needsAuth) console.log(`\nAuthenticated checks use Worker secret ${plan.authSecretName} (npx wrangler secret put ${plan.authSecretName}).`);

  let report = await verifyConnection(result.environmentId, { runChecks: true });
  printReport(report);

  const deadline = Date.now() + args.waitSeconds * 1000;
  if (!report.steps.find((s) => s.id === "telemetry")?.ok && args.waitSeconds > 0) {
    console.log(`\nWaiting up to ${args.waitSeconds}s for the app's first event…`);
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      report = await verifyConnection(result.environmentId, { runChecks: false });
      if (report.steps.find((s) => s.id === "telemetry")?.ok) break;
    }
    printReport(report);
  }

  return report.verdict === "connected" ? 0 : report.verdict === "partial" ? 2 : 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    if (error instanceof UsageError) {
      console.error(`${error.message}\n\nUsage: npm run link-program -- <manifest.json> [--environment production] [--new-key] [--wait 600]`);
    } else {
      console.error(`Failed: ${(error as Error).message}`);
    }
    process.exit(1);
  },
);
