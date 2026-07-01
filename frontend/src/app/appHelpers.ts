import type {
  Connection,
  Session,
  SessionStatusEvent,
} from "../features/connections/types";
import { DEFAULT_REMOTE_PATH } from "./appDemoData";

export function sortConnections(connections: Connection[]): Connection[] {
  return [...connections].sort((left, right) => {
    const leftKey = `${left.group}\u0000${left.name}`.toLowerCase();
    const rightKey = `${right.group}\u0000${right.name}`.toLowerCase();
    return leftKey.localeCompare(rightKey);
  });
}

export function formatStatusLine(event: SessionStatusEvent): string {
  const detail = event.message.trim();
  const message = detail ? `[${event.status}] ${detail}` : `[${event.status}]`;
  return `\r\n\u001b[38;5;245m${message}\u001b[0m\r\n`;
}

export function isProductionConnection(connection: Connection | null): boolean {
  return Boolean(
    connection?.tags.some((tag) => tag.toLowerCase() === "prod") ||
      connection?.name.toLowerCase().includes("prod"),
  );
}

export function terminalUser(connection: Connection | null): string {
  return connection?.username || "root";
}

export function defaultRemotePath(connection: Connection | null): string {
  const username = connection?.username.trim();
  if (!username) {
    return DEFAULT_REMOTE_PATH;
  }
  if (username === "root") {
    return "/root";
  }
  if (username.includes("/")) {
    return DEFAULT_REMOTE_PATH;
  }
  return `/home/${username}`;
}

export function terminalHost(connection: Connection | null, session: Session | null): string {
  return connection?.host || session?.name || "prod-01";
}

export function terminalPath(connection: Connection | null): string {
  if (connection?.group.toLowerCase().includes("wsl")) {
    return "/home/jason/projects/go-termflow";
  }
  if (connection && isProductionConnection(connection)) {
    return "/var/www";
  }
  return "~";
}

export function parentPath(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  const index = trimmed.lastIndexOf("/");
  if (index <= 0) {
    return "/";
  }
  return trimmed.slice(0, index);
}

export function joinPath(base: string, name: string): string {
  return `${base.replace(/\/+$/, "")}/${name.replace(/^\/+/, "")}`;
}

export function baseName(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? "";
}

export function metricTone(value: number) {
  if (value >= 85) return "critical";
  if (value >= 60) return "warn";
  return "ok";
}
