import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type {
  CommandHistoryEntry,
  Session,
  TerminalSize,
} from "../features/connections/types";
import {
  clearCommandHistory,
  closeSession,
  recordCommandHistory,
  runCommand,
} from "../shared/api/wails";
import { MAX_TERMINAL_BUFFER_LENGTH } from "./appDemoData";
import {
  appendTerminalData,
  canWriteShellCommand,
} from "./terminalReplay";
import type { CommandHistoryScope } from "./TerminalHistoryDock";
import { canInteractWithSession } from "./terminalSessions";
import type { SessionReconnectAttempt, SessionReconnectInputStore } from "./terminalViewTypes";

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type UseTerminalActionsOptions = {
  activeSession: Session | null;
  activeSessionId: string | null;
  backendAvailable: boolean;
  commandHistoryScope: CommandHistoryScope;
  fullscreenTerminalSessionsRef: MutableRefObject<Record<string, boolean>>;
  sessions: Session[];
  terminalBroadcast: boolean;
  terminalCommandInputRef: RefObject<HTMLInputElement | null>;
  terminalDisplayHost: string;
  terminalDisplayPath: string;
  terminalDisplayUser: string;
  refreshCommandHistory: (scope?: CommandHistoryScope) => Promise<void>;
  reconnectAttemptRef: MutableRefObject<SessionReconnectAttempt | null>;
  reconnectInputsRef: MutableRefObject<SessionReconnectInputStore>;
  setActiveSessionId: Dispatch<SetStateAction<string | null>>;
  setCommandHistory: Dispatch<SetStateAction<CommandHistoryEntry[]>>;
  setFullscreenTerminalSessions: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSessions: Dispatch<SetStateAction<Session[]>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setTerminalBuffers: Dispatch<SetStateAction<Record<string, string>>>;
  setTerminalCommand: Dispatch<SetStateAction<string>>;
  setTerminalCommandLog: Dispatch<SetStateAction<string[]>>;
  setTerminalSize: Dispatch<SetStateAction<TerminalSize>>;
  setTerminalSmartOpen: Dispatch<SetStateAction<boolean>>;
};

export function useTerminalActions({
  activeSession,
  activeSessionId,
  backendAvailable,
  commandHistoryScope,
  fullscreenTerminalSessionsRef,
  sessions,
  terminalBroadcast,
  terminalCommandInputRef,
  terminalDisplayHost,
  terminalDisplayPath,
  terminalDisplayUser,
  refreshCommandHistory,
  reconnectAttemptRef,
  reconnectInputsRef,
  setActiveSessionId,
  setCommandHistory,
  setFullscreenTerminalSessions,
  setSessions,
  setStatus,
  setTerminalBuffers,
  setTerminalCommand,
  setTerminalCommandLog,
  setTerminalSize,
  setTerminalSmartOpen,
}: UseTerminalActionsOptions) {
  function handleTerminalSizeChange(size: TerminalSize) {
    setTerminalSize((current) =>
      current.cols === size.cols && current.rows === size.rows ? current : size,
    );
  }

  function handleTerminalFullscreenChange(sessionId: string, fullscreen: boolean) {
    setFullscreenTerminalSessions((current) => {
      if (current[sessionId] === fullscreen) {
        return current;
      }
      const next = {
        ...current,
        [sessionId]: fullscreen,
      };
      fullscreenTerminalSessionsRef.current = next;
      return next;
    });
  }

  function handleCloseSession(sessionId: string) {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) {
      return;
    }
    if (reconnectAttemptRef.current?.sessionId === sessionId) {
      reconnectAttemptRef.current = null;
    }
    reconnectInputsRef.current.delete(sessionId);
    setSessions((current) => current.filter((item) => item.id !== sessionId));
    setTerminalBuffers((current) => {
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
    setFullscreenTerminalSessions((current) => {
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
    if (activeSessionId === sessionId) {
      const nextSession = sessions.find((item) => item.id !== sessionId);
      setActiveSessionId(nextSession?.id ?? null);
    }
    if (backendAvailable) {
      void closeSession(sessionId).catch((error) => setStatus(messageFromError(error)));
    }
  }

  async function handleRunTerminalCommand(command: string) {
    const trimmed = command.trim();
    if (!trimmed) {
      return;
    }
    if (!activeSession) {
      setStatus("No active session");
      return;
    }
    if (!canInteractWithSession(activeSession)) {
      setStatus(`Session ${activeSession.status}: ${activeSession.name}`);
      return;
    }
    if (!canWriteShellCommand(activeSession.id, fullscreenTerminalSessionsRef.current)) {
      setStatus("Exit the fullscreen terminal app before running shell commands");
      return;
    }

    if (!backendAvailable) {
      setTerminalCommandLog((current) => [...current, trimmed]);
      setTerminalBuffers((current) => ({
        ...current,
        [activeSession.id]: appendTerminalData(
          current[activeSession.id] ?? "",
          `\r\n${terminalDisplayUser}@${terminalDisplayHost}:${terminalDisplayPath} # ${trimmed}\r\n`,
          {
            maxLength: MAX_TERMINAL_BUFFER_LENGTH,
            preserveReplayContext: false,
          },
        ),
      }));
      setTerminalCommand("");
      setTerminalSmartOpen(false);
      setStatus(`Preview command: ${trimmed}`);
      return;
    }

    try {
      await runCommand({
        sessionId: activeSession.id,
        command: trimmed,
        broadcast: terminalBroadcast,
      });
      setTerminalCommand("");
      setTerminalSmartOpen(false);
      await refreshCommandHistory(commandHistoryScope);
      setStatus(terminalBroadcast ? `Broadcast command: ${trimmed}` : `Ran command: ${trimmed}`);
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  async function handleTerminalCommandCommit(command: string) {
    if (!activeSession || !backendAvailable || !canInteractWithSession(activeSession)) {
      return;
    }
    try {
      await recordCommandHistory(activeSession.id, command);
      await refreshCommandHistory(commandHistoryScope);
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  async function handleClearActiveHistory() {
    if (!activeSession) {
      return;
    }
    if (!backendAvailable) {
      setCommandHistory([]);
      return;
    }
    try {
      await clearCommandHistory(activeSession.connectionId);
      setCommandHistory([]);
      setStatus("Command history cleared");
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  function pickTerminalSmartCommand(command: string) {
    setTerminalCommand(command);
    setTerminalSmartOpen(false);
    const focusInput = () => {
      const input = terminalCommandInputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      input.setSelectionRange(command.length, command.length);
    };
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.setTimeout(focusInput, 0);
      });
    });
  }

  return {
    handleClearActiveHistory,
    handleCloseSession,
    handleRunTerminalCommand,
    handleTerminalCommandCommit,
    handleTerminalSizeChange,
    handleTerminalFullscreenChange,
    pickTerminalSmartCommand,
  };
}
