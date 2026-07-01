import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  Connection,
  SavedCommand,
} from "../features/connections/types";
import {
  deleteSavedCommand,
  saveSavedCommand,
} from "../shared/api/wails";
import type { CommandEditorRequest } from "./CommandModals";
import {
  commandScopeKey,
  commandScopeTags,
  reorderTerminalSmartBarCommands,
  sortSavedCommands,
  type CommandScopeKey,
} from "./terminalSmartBarCommands";

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type UseSavedCommandActionsOptions = {
  activeConnectionId: string | null;
  backendAvailable: boolean;
  connections: Connection[];
  savedCommands: SavedCommand[];
  setSavedCommands: Dispatch<SetStateAction<SavedCommand[]>>;
  setStatus: (status: string) => void;
};

export function useSavedCommandActions({
  activeConnectionId,
  backendAvailable,
  connections,
  savedCommands,
  setSavedCommands,
  setStatus,
}: UseSavedCommandActionsOptions) {
  const [commandEditor, setCommandEditor] = useState<CommandEditorRequest | null>(null);
  const [pendingCommandDelete, setPendingCommandDelete] = useState<SavedCommand | null>(null);
  const [deletingCommandId, setDeletingCommandId] = useState<string | null>(null);

  function handleCreateSavedCommand(scopeKey: CommandScopeKey) {
    setCommandEditor({ command: null, scopeKey });
  }

  function handleEditSavedCommand(command: SavedCommand) {
    setCommandEditor({ command, scopeKey: commandScopeKey(command) });
  }

  function handleDeleteSavedCommand(command: SavedCommand) {
    setPendingCommandDelete(command);
  }

  async function handleSaveCommandEditor(input: Parameters<typeof saveSavedCommand>[0]) {
    if (!backendAvailable) {
      setStatus("Saved commands require the Wails backend");
      return;
    }
    const existingSortOrder = input.id ? savedCommands.find((command) => command.id === input.id)?.sortOrder : undefined;
    const nextSortOrder = savedCommands.length === 0 ? 0 : Math.max(...savedCommands.map((command) => command.sortOrder ?? 0)) + 1;
    const saved = await saveSavedCommand({
      ...input,
      sortOrder: input.sortOrder ?? existingSortOrder ?? nextSortOrder,
    });
    setSavedCommands((current) => {
      const existingIndex = current.findIndex((item) => item.id === saved.id);
      const next = existingIndex >= 0
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved];
      return sortSavedCommands(next);
    });
    setCommandEditor(null);
    setStatus(`${input.id ? "Updated" : "Saved"} command: ${saved.name}`);
  }

  async function confirmDeleteSavedCommand(command: SavedCommand) {
    if (!backendAvailable) {
      setStatus("Deleting saved commands requires the Wails backend");
      setPendingCommandDelete(null);
      return;
    }
    setDeletingCommandId(command.id);
    try {
      await deleteSavedCommand(command.id);
      setSavedCommands((current) => current.filter((item) => item.id !== command.id));
      setPendingCommandDelete(null);
      setStatus(`Deleted command: ${command.name}`);
    } catch (error) {
      setStatus(messageFromError(error));
    } finally {
      setDeletingCommandId(null);
    }
  }

  async function handleToggleCommandPin(command: SavedCommand) {
    const hasGlobal = commandScopeKey(command) === "global";
    const activeConnectionForCommand = activeConnectionId ?? connections[0]?.id ?? "";
    const nextTags = hasGlobal
      ? commandScopeTags(command.tags, "connection", activeConnectionForCommand, command.tags.includes("danger"))
      : commandScopeTags(command.tags, "global", "", command.tags.includes("danger"));
    const input = {
      id: command.id,
      name: command.name,
      command: command.command,
      description: command.description,
      tags: nextTags,
      sortOrder: command.sortOrder ?? 0,
    };
    if (!backendAvailable) {
      setSavedCommands((current) => current.map((item) => (item.id === command.id ? { ...item, tags: nextTags } : item)));
      return;
    }
    try {
      const saved = await saveSavedCommand(input);
      setSavedCommands((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setStatus(hasGlobal ? `Unpinned command: ${saved.name}` : `Pinned command: ${saved.name}`);
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  async function handleReorderTerminalSmartBarCommand(sourceId: string, targetId: string) {
    const nextCommands = reorderTerminalSmartBarCommands(savedCommands, activeConnectionId, sourceId, targetId);
    const changedCommands = nextCommands.filter((command) => {
      const previous = savedCommands.find((item) => item.id === command.id);
      return previous && previous.sortOrder !== command.sortOrder;
    });
    if (changedCommands.length === 0) {
      return;
    }

    setSavedCommands(nextCommands);
    if (!backendAvailable) {
      setStatus("Reordered quick commands");
      return;
    }

    try {
      const saved = await Promise.all(
        changedCommands.map((command) =>
          saveSavedCommand({
            id: command.id,
            name: command.name,
            command: command.command,
            description: command.description,
            tags: command.tags,
            sortOrder: command.sortOrder,
          }),
        ),
      );
      setSavedCommands((current) =>
        sortSavedCommands(current.map((command) => saved.find((item) => item.id === command.id) ?? command)),
      );
      setStatus("Reordered quick commands");
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  return {
    commandEditor,
    deletingCommandId,
    pendingCommandDelete,
    confirmDeleteSavedCommand,
    handleCreateSavedCommand,
    handleDeleteSavedCommand,
    handleEditSavedCommand,
    handleReorderTerminalSmartBarCommand,
    handleSaveCommandEditor,
    handleToggleCommandPin,
    setCommandEditor,
    setPendingCommandDelete,
  };
}
