// ---------------------------------------------------------------------------
// Global active-program context.
// Provides activeProgramId + the full ProgramConfig for the selected program.
// Selection is persisted to localStorage so it survives page reloads.
// ---------------------------------------------------------------------------

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { ProgramConfig, ProgramEndpoints } from "@/lib/types/program";
import {
  getDefaultProgram,
  getProgramById,
  listPrograms,
  removeProgram as unregisterProgram,
  registerProgram,
  updateProgramEndpoints as registryUpdateEndpoints,
  updateProgramUsageMapping as registryUpdateUsageMapping,
} from "@/lib/programs/registry";

const STORAGE_KEY = "supportHubActiveProgramId";

function resolveInitialProgram(): ProgramConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const found = getProgramById(stored);
      if (found) return found;
    }
  } catch {
    // Storage unavailable — fall through.
  }
  return getDefaultProgram();
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface ProgramContextValue {
  /** The currently selected program config. */
  activeProgram: ProgramConfig;
  /** Unique ID of the currently selected program. */
  activeProgramId: string;
  /** All registered programs. */
  programs: ProgramConfig[];
  /** Switch to a different program by ID. */
  setActiveProgramId: (id: string) => void;
  /** Add a new program to the registry and optionally make it active. */
  addProgram: (config: ProgramConfig, makeActive?: boolean) => void;
  /** Remove a user-added program by ID. Built-ins are protected. */
  removeProgram: (id: string) => void;
  /** Re-read the registry (e.g. after external changes). */
  refreshPrograms: () => void;
  /** Update the endpoint paths for the active program. */
  updateProgramEndpoints: (endpoints: ProgramEndpoints) => void;
  /** Update the usage key mapping for the active program. */
  updateProgramUsageMapping: (mapping: Record<string, string>) => void;
}

const ProgramContext = createContext<ProgramContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

function isCommunityHubId(id: string): boolean {
  return (
    id.startsWith("community-hub") ||
    id.includes("community-hub")
  );
}

export function ProgramProvider({ children }: { children: ReactNode }) {
  const [activeProgram, setActiveProgram] = useState<ProgramConfig>(
    resolveInitialProgram
  );
  const [programs, setPrograms] = useState<ProgramConfig[]>(listPrograms);

  // One-time startup eviction: remove any stale community hub entries that
  // may have survived in React state from a hot-reload or prior session.
  useEffect(() => {
    const hasCommunityHub = programs.some(
      (p) =>
        isCommunityHubId(p.id) ||
        p.slug === "community-hub" ||
        p.presetType === "community-hub"
    );

    if (!hasCommunityHub) return;

    const cleaned = programs.filter(
      (p) =>
        !isCommunityHubId(p.id) &&
        p.slug !== "community-hub" &&
        p.presetType !== "community-hub"
    );
    setPrograms(cleaned);

    if (
      isCommunityHubId(activeProgram.id) ||
      activeProgram.slug === "community-hub" ||
      activeProgram.presetType === "community-hub"
    ) {
      const fallback = cleaned[0] ?? getDefaultProgram();
      setActiveProgram(fallback);
      try {
        localStorage.setItem(STORAGE_KEY, fallback.id);
      } catch {
        // ignore
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshPrograms = useCallback(() => {
    setPrograms(listPrograms());
  }, []);

  const setActiveProgramId = useCallback((id: string) => {
    const found = getProgramById(id);
    if (!found) return;
    setActiveProgram(found);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  const addProgram = useCallback(
    (config: ProgramConfig, makeActive = false) => {
      registerProgram(config);
      const updated = listPrograms();
      setPrograms(updated);
      if (makeActive) {
        setActiveProgram(config);
        try {
          localStorage.setItem(STORAGE_KEY, config.id);
        } catch {
          // ignore
        }
      }
    },
    []
  );

  const removeProgram = useCallback(
    (id: string) => {
      const deletingActive = activeProgram.id === id;
      unregisterProgram(id);
      const updated = listPrograms();
      setPrograms(updated);

      if (!deletingActive) return;

      const fallback = updated[0] ?? getDefaultProgram();
      setActiveProgram(fallback);
      try {
        localStorage.setItem(STORAGE_KEY, fallback.id);
      } catch {
        // ignore
      }
    },
    [activeProgram.id]
  );

  const updateProgramEndpoints = useCallback(
    (endpoints: ProgramEndpoints) => {
      registryUpdateEndpoints(activeProgram.id, endpoints);
      const updated = listPrograms();
      setPrograms(updated);
      const refreshed = updated.find((p) => p.id === activeProgram.id);
      if (refreshed) setActiveProgram(refreshed);
    },
    [activeProgram.id]
  );

  const updateProgramUsageMapping = useCallback(
    (mapping: Record<string, string>) => {
      registryUpdateUsageMapping(activeProgram.id, mapping);
      const updated = listPrograms();
      setPrograms(updated);
      const refreshed = updated.find((p) => p.id === activeProgram.id);
      if (refreshed) setActiveProgram(refreshed);
    },
    [activeProgram.id]
  );

  const value = useMemo<ProgramContextValue>(
    () => ({
      activeProgram,
      activeProgramId: activeProgram.id,
      programs,
      setActiveProgramId,
      addProgram,
      removeProgram,
      refreshPrograms,
      updateProgramEndpoints,
      updateProgramUsageMapping,
    }),
    [activeProgram, programs, setActiveProgramId, addProgram, removeProgram, refreshPrograms, updateProgramEndpoints, updateProgramUsageMapping]
  );

  return (
    <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProgram(): ProgramContextValue {
  const ctx = useContext(ProgramContext);
  if (!ctx) {
    throw new Error("useProgram must be used inside <ProgramProvider>");
  }
  return ctx;
}
