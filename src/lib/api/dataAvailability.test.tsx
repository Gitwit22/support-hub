import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { getMonitoringOverview, listAlerts } from "./admin";
import { getEndpointFailures, resetEndpointFailures } from "./dataAvailability";
import { DataUnavailableBanner } from "@/components/layout/DataUnavailableBanner";

describe("admin reads flag their fallbacks instead of failing silently", () => {
  beforeEach(() => {
    resetEndpointFailures();
  });

  it("records a failure when a read falls back to empty data", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const alerts = await listAlerts();

    expect(alerts).toEqual([]);
    expect(getEndpointFailures()).toEqual([
      expect.objectContaining({ endpoint: "/admin/alerts", reason: "fetch failed" }),
    ]);
  });

  it("records the HTTP status for server errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" });
    await getMonitoringOverview();
    expect(getEndpointFailures()[0]).toMatchObject({ endpoint: "/admin/monitoring", reason: "HTTP 404" });
  });

  it("clears the failure once the endpoint answers again", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await listAlerts();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => [{ id: "a1" }],
    });
    await listAlerts();
    expect(getEndpointFailures()).toEqual([]);
  });

  it("shows the banner only while live data is unavailable", async () => {
    render(<DataUnavailableBanner />);
    expect(screen.queryByRole("alert")).toBeNull();

    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await act(async () => {
      await listAlerts();
    });
    expect(screen.getByRole("alert").textContent).toContain("Live data unavailable");
    expect(screen.getByRole("alert").textContent).toContain("/admin/alerts");

    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), json: async () => [] });
    await act(async () => {
      await listAlerts();
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
