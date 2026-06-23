import type { SavedCommand } from "../features/connections/types";

export type CommandScopeKey = "global" | `connection:${string}`;
export type CommandScopeType = "global" | "connection";

export const CONNECTION_TAG_PREFIX = "connection:";

export function commandConnectionId(command: SavedCommand): string | null {
  const connectionTag = command.tags.find((tag) => tag.startsWith(CONNECTION_TAG_PREFIX));
  return connectionTag ? connectionTag.slice(CONNECTION_TAG_PREFIX.length) : null;
}

export function commandScopeKey(command: SavedCommand): CommandScopeKey {
  const connectionId = commandConnectionId(command);
  return connectionId ? `connection:${connectionId}` : "global";
}

export function scopeKeyForConnection(connectionId: string): CommandScopeKey {
  return `connection:${connectionId}`;
}

export function connectionIdFromScopeKey(scopeKey: CommandScopeKey): string | null {
  return scopeKey.startsWith(CONNECTION_TAG_PREFIX) ? scopeKey.slice(CONNECTION_TAG_PREFIX.length) : null;
}

export function commandMatchesTerminalScope(command: SavedCommand, connectionId: string | null): boolean {
  const commandConnection = commandConnectionId(command);
  if (commandConnection) {
    return commandConnection === connectionId;
  }
  return command.tags.includes("global");
}

export function commandScopeTags(
  existingTags: string[],
  scopeType: CommandScopeType,
  connectionId: string,
  danger: boolean,
): string[] {
  const retained = existingTags.filter((tag) => tag !== "global" && tag !== "danger" && !tag.startsWith(CONNECTION_TAG_PREFIX));
  const scopeTags = scopeType === "connection" ? [`${CONNECTION_TAG_PREFIX}${connectionId}`] : ["global"];
  const dangerTags = danger ? ["danger"] : [];
  return [...retained, ...scopeTags, ...dangerTags];
}

export function getTerminalSmartBarCommands(savedCommands: SavedCommand[], connectionId: string | null): SavedCommand[] {
  return sortSavedCommands(savedCommands).filter((command) => commandMatchesTerminalScope(command, connectionId));
}

export function sortSavedCommands(savedCommands: SavedCommand[]): SavedCommand[] {
  return [...savedCommands].sort((left, right) => {
    const orderDiff = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    if (orderDiff !== 0) {
      return orderDiff;
    }
    const nameDiff = left.name.localeCompare(right.name);
    return nameDiff !== 0 ? nameDiff : left.id.localeCompare(right.id);
  });
}

export function reorderTerminalSmartBarCommands(
  savedCommands: SavedCommand[],
  connectionId: string | null,
  sourceId: string,
  targetId: string,
): SavedCommand[] {
  if (sourceId === targetId) {
    return sortSavedCommands(savedCommands);
  }

  const sortedCommands = sortSavedCommands(savedCommands);
  const visibleCommands = sortedCommands.filter((command) => commandMatchesTerminalScope(command, connectionId));
  const sourceIndex = visibleCommands.findIndex((command) => command.id === sourceId);
  const targetIndex = visibleCommands.findIndex((command) => command.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return sortedCommands;
  }

  const movedCommand = visibleCommands[sourceIndex];
  const reorderedVisible = visibleCommands.filter((command) => command.id !== sourceId);
  reorderedVisible.splice(targetIndex, 0, movedCommand);

  const visibleIds = new Set(visibleCommands.map((command) => command.id));
  const visibleQueue = [...reorderedVisible];
  return sortedCommands.map((command) => (visibleIds.has(command.id) ? visibleQueue.shift() ?? command : command)).map((command, index) => ({
    ...command,
    sortOrder: index,
  }));
}
