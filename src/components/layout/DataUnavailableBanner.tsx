import { AlertTriangle } from "lucide-react";
import { useEndpointFailures } from "@/lib/api/dataAvailability";

/**
 * Shown whenever an admin read fell back to empty data, so zero counts and
 * "unknown" health are never mistaken for a quiet, healthy system.
 */
export function DataUnavailableBanner() {
  const failures = useEndpointFailures();
  if (!failures.length) return null;

  return (
    <div
      role="alert"
      className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">Live data unavailable — values on this page are placeholders, not real readings.</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {failures.map((failure) => (
              <li key={failure.endpoint}>
                <code>{failure.endpoint}</code>: {failure.reason}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
