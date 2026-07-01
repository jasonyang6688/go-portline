import { useCallback, useState } from "react";
import type {
  MonitorHistoryEntry,
  MonitorSnapshot,
  Session,
} from "../features/connections/types";
import {
  getMonitorIncidentReport,
  getMonitorSnapshot,
  listMonitorHistory,
} from "../shared/api/wails";
import {
  appendMonitorHistory,
  createMonitorHistory,
  DEFAULT_MONITOR_RULES,
  type MonitorHistory,
  type MonitorRules,
} from "./monitorSnapshot";

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function loadMonitorRules(): MonitorRules {
  try {
    const raw = window.localStorage.getItem("termflow.monitorRules");
    if (!raw) {
      return DEFAULT_MONITOR_RULES;
    }
    return { ...DEFAULT_MONITOR_RULES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_MONITOR_RULES;
  }
}

function saveMonitorRules(rules: MonitorRules) {
  window.localStorage.setItem("termflow.monitorRules", JSON.stringify(rules));
}

type UseMonitorDataOptions = {
  activeSession: Session | null;
  backendAvailable: boolean;
  setStatus: (status: string) => void;
};

export function useMonitorData({
  activeSession,
  backendAvailable,
  setStatus,
}: UseMonitorDataOptions) {
  const [monitorSnapshot, setMonitorSnapshot] = useState<MonitorSnapshot | null>(null);
  const [monitorHistory, setMonitorHistory] = useState<MonitorHistory>(() => createMonitorHistory());
  const [persistedMonitorHistory, setPersistedMonitorHistory] = useState<MonitorHistoryEntry[]>([]);
  const [monitorRules, setMonitorRules] = useState<MonitorRules>(() => loadMonitorRules());

  const resetMonitorData = useCallback(() => {
    setMonitorSnapshot(null);
    setMonitorHistory(createMonitorHistory());
    setPersistedMonitorHistory([]);
  }, []);

  const applyMonitorSnapshot = useCallback((snapshot: MonitorSnapshot) => {
    setMonitorSnapshot(snapshot);
    setMonitorHistory((current) => appendMonitorHistory(current, snapshot));
  }, []);

  const refreshPersistedMonitorHistory = useCallback(async (sessionId: string, connectionId: string) => {
    if (!backendAvailable) {
      setPersistedMonitorHistory([]);
      return;
    }
    try {
      const history = await listMonitorHistory({ sessionId, connectionId, limit: 200 });
      setPersistedMonitorHistory(history);
    } catch {
      setPersistedMonitorHistory([]);
    }
  }, [backendAvailable]);

  const refreshMonitorSnapshot = useCallback(async () => {
    if (!activeSession || !backendAvailable) {
      return;
    }
    try {
      applyMonitorSnapshot(await getMonitorSnapshot(activeSession.id));
      await refreshPersistedMonitorHistory(activeSession.id, activeSession.connectionId);
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }, [activeSession, applyMonitorSnapshot, backendAvailable, refreshPersistedMonitorHistory, setStatus]);

  const handleMonitorRulesChange = useCallback((rules: MonitorRules) => {
    setMonitorRules(rules);
    saveMonitorRules(rules);
  }, []);

  const copyMonitorIncidentReport = useCallback(async (): Promise<string> => {
    if (!activeSession) {
      const message = "Open a session before collecting an incident report";
      setStatus(message);
      return message;
    }
    if (!backendAvailable) {
      const message = "Incident report requires the desktop backend";
      setStatus(message);
      return message;
    }
    try {
      const report = await getMonitorIncidentReport(activeSession.id);
      await navigator.clipboard?.writeText(report);
      const message = "Incident report copied";
      setStatus(message);
      return message;
    } catch (error) {
      const message = messageFromError(error);
      setStatus(message);
      return message;
    }
  }, [activeSession, backendAvailable, setStatus]);

  return {
    monitorHistory,
    monitorRules,
    monitorSnapshot,
    persistedMonitorHistory,
    applyMonitorSnapshot,
    copyMonitorIncidentReport,
    handleMonitorRulesChange,
    refreshMonitorSnapshot,
    refreshPersistedMonitorHistory,
    resetMonitorData,
  };
}
