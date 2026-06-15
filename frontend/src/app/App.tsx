import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { ConnectionSidebar } from "../features/connections/ConnectionSidebar";
import { ConnectionModal } from "../features/connections/ConnectionModal";
import { StatusBar } from "../features/status/StatusBar";
import { TerminalPane } from "../features/terminal/TerminalPane";
import {
  clearCommandHistory,
  closeSession,
  createFolder,
  deleteConnection,
  deleteFile,
  deleteSavedCommand,
  getMonitorSnapshot,
  getSettings,
  listCommandHistory,
  openSession,
  listFiles,
  listConnections,
  listSavedCommands,
  onWailsEvent,
  readFile,
  recordCommandHistory,
  renameFile,
  runCommand,
  saveConnection,
  saveFile,
  saveSavedCommand,
  saveSettings,
  selectLocalFile,
  selectLocalDirectory,
  selectLocalFiles,
  selectSaveFile,
  transferFile,
  writeTerminal,
} from "../shared/api/wails";
import type {
  AppSettings,
  CommandHistoryEntry,
  Connection,
  FileContent,
  FileEntry as BackendFileEntry,
  MonitorSnapshot,
  SaveConnectionInput,
  SavedCommand,
  Session,
  SessionClosedEvent,
  SessionErrorEvent,
  SessionOutputEvent,
  SessionStatusEvent,
  TerminalSize,
} from "../features/connections/types";
import {
  SESSION_CLOSED_EVENT,
  SESSION_ERROR_EVENT,
  SESSION_OUTPUT_EVENT,
  SESSION_STATUS_EVENT,
} from "../features/connections/types";

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isBackendUnavailable(error: unknown): boolean {
  return messageFromError(error) === "Wails backend is not available";
}

function sortConnections(connections: Connection[]): Connection[] {
  return [...connections].sort((left, right) => {
    const leftKey = `${left.group}\u0000${left.name}`.toLowerCase();
    const rightKey = `${right.group}\u0000${right.name}`.toLowerCase();
    return leftKey.localeCompare(rightKey);
  });
}

const DEFAULT_TERMINAL_SIZE: TerminalSize = { cols: 120, rows: 32 };
const DEFAULT_REMOTE_PATH = "/home/ubuntu";
const MAX_TERMINAL_BUFFER_LENGTH = 200_000;
const DEMO_NOW = new Date().toISOString();
const DEMO_CONNECTIONS: Connection[] = [
  {
    id: "c1",
    name: "prod-01",
    host: "10.0.1.100",
    port: 22,
    username: "root",
    authType: "password",
    password: "demo",
    keyPath: "",
    insecureIgnoreHostKey: false,
    group: "SSH Servers",
    tags: ["prod"],
    createdAt: DEMO_NOW,
    updatedAt: DEMO_NOW,
  },
  {
    id: "c2",
    name: "staging-02",
    host: "10.0.1.101",
    port: 22,
    username: "deploy",
    authType: "key",
    password: "",
    keyPath: "~/.ssh/id_ed25519",
    insecureIgnoreHostKey: false,
    group: "SSH Servers",
    tags: ["staging"],
    createdAt: DEMO_NOW,
    updatedAt: DEMO_NOW,
  },
  {
    id: "c3",
    name: "dev-server",
    host: "192.168.1.50",
    port: 22,
    username: "ubuntu",
    authType: "agent",
    password: "",
    keyPath: "",
    insecureIgnoreHostKey: false,
    group: "SSH Servers",
    tags: [],
    createdAt: DEMO_NOW,
    updatedAt: DEMO_NOW,
  },
  {
    id: "c4",
    name: "backup-01",
    host: "10.0.1.102",
    port: 22,
    username: "backup",
    authType: "agent",
    password: "",
    keyPath: "",
    insecureIgnoreHostKey: false,
    group: "SSH Servers",
    tags: [],
    createdAt: DEMO_NOW,
    updatedAt: DEMO_NOW,
  },
  {
    id: "c6",
    name: "123123",
    host: "13123123",
    port: 22,
    username: "root",
    authType: "key",
    password: "",
    keyPath: "~/.ssh/id_ed25519",
    insecureIgnoreHostKey: false,
    group: "SSH Servers",
    tags: ["load"],
    createdAt: DEMO_NOW,
    updatedAt: DEMO_NOW,
  },
  {
    id: "c5",
    name: "Ubuntu 22.04",
    host: "localhost",
    port: 22,
    username: "jason",
    authType: "agent",
    password: "",
    keyPath: "",
    insecureIgnoreHostKey: false,
    group: "WSL",
    tags: ["wsl"],
    createdAt: DEMO_NOW,
    updatedAt: DEMO_NOW,
  },
  {
    id: "c7",
    name: "Debian 12",
    host: "localhost",
    port: 22,
    username: "debian",
    authType: "agent",
    password: "",
    keyPath: "",
    insecureIgnoreHostKey: false,
    group: "WSL",
    tags: ["wsl"],
    createdAt: DEMO_NOW,
    updatedAt: DEMO_NOW,
  },
];
const DEMO_SESSIONS: Session[] = [
  {
    id: "demo-prod",
    connectionId: "c1",
    name: "prod-01",
    status: "connected",
    createdAt: DEMO_NOW,
    lastActiveAt: DEMO_NOW,
  },
  {
    id: "demo-wsl",
    connectionId: "c5",
    name: "Ubuntu 22.04",
    status: "connected",
    createdAt: DEMO_NOW,
    lastActiveAt: DEMO_NOW,
  },
  {
    id: "demo-staging",
    connectionId: "c2",
    name: "staging-02",
    status: "connected",
    createdAt: DEMO_NOW,
    lastActiveAt: DEMO_NOW,
  },
  {
    id: "demo-123123",
    connectionId: "c6",
    name: "123123",
    status: "connected",
    createdAt: DEMO_NOW,
    lastActiveAt: DEMO_NOW,
  },
];
const DEMO_BUFFERS: Record<string, string> = {
  "demo-prod": [
    "\u001b[3mConnecting to root@prod-01 (10.0.1.100:22)...\u001b[0m",
    "\u001b[32;1m✓  Connected  ·  Ubuntu 22.04 LTS  ·  SSH-2.0-OpenSSH_8.9\u001b[0m",
    "",
    "Welcome to Ubuntu 22.04.5 LTS (GNU/Linux 5.15.0-113-generic x86_64)",
    "",
    "  * Documentation:  https://help.ubuntu.com",
    "  * Support:        https://ubuntu.com/pro",
    "",
    "\u001b[36;1mroot\u001b[0m@\u001b[34;1mprod-01\u001b[0m:\u001b[35m/var/www\u001b[0m # ls -la",
    "total 28",
    "drwxr-xr-x  5 www-data www-data  4096 May 25 09:43 .",
    "drwxr-xr-x 13 root     root      4096 May 12 08:31 ..",
    "drwxr-xr-x  8 www-data www-data  4096 May 28 08:15 \u001b[34;1mapp\u001b[0m",
    "drwxr-xr-x  2 www-data www-data  4096 Apr 15 14:22 \u001b[34;1mhtml\u001b[0m",
    "drwxr-xr-x  6 www-data www-data  4096 May 27 23:00 \u001b[34;1mstatic\u001b[0m",
    "-rw-r--r--  1 root     root       847 May 20 11:15 nginx.conf",
    "",
    "\u001b[36;1mroot\u001b[0m@\u001b[34;1mprod-01\u001b[0m:\u001b[35m/var/www\u001b[0m # systemctl status nginx",
    "\u001b[32m●\u001b[0m nginx.service - A high performance web server",
    "     Loaded: loaded (/lib/systemd/system/nginx.service; enabled)",
    "     Active: \u001b[32;1mactive (running)\u001b[0m since Wed 2026-05-28 08:15:33 UTC; 2h 14min ago",
    "    Main PID: 1235 (nginx)",
    "",
    "\u001b[36;1mroot\u001b[0m@\u001b[34;1mprod-01\u001b[0m:\u001b[35m/var/www\u001b[0m # ",
  ].join("\r\n"),
  "demo-wsl": [
    "Starting WSL: Ubuntu 22.04...",
    "\u001b[32;1m✓  WSL session ready\u001b[0m",
    "",
    "\u001b[36;1mjason\u001b[0m@\u001b[34;1mUbuntu\u001b[0m:\u001b[35m~\u001b[0m # uname -a",
    "Linux Ubuntu 5.15.167.4-microsoft-standard-WSL2 x86_64 GNU/Linux",
    "",
    "\u001b[36;1mjason\u001b[0m@\u001b[34;1mUbuntu\u001b[0m:\u001b[35m~/projects/go-termflow\u001b[0m # git log --oneline -5",
    "\u001b[33m3f4a1d2\u001b[0m feat: improve SSH reconnect logic",
    "\u001b[33mc8e52b1\u001b[0m fix: WSL session cleanup on close",
    "\u001b[33ma1209fd\u001b[0m style: update sidebar layout",
  ].join("\r\n"),
};
const NAV_ITEMS = [
  { id: "terminal", label: "Terminal", icon: "terminal" },
  { id: "files", label: "File Manager", icon: "files" },
  { id: "monitor", label: "Monitor", icon: "monitor" },
  { id: "commands", label: "Commands", icon: "commands" },
  { id: "settings", label: "Settings", icon: "settings" },
] as const;

type ViewId = (typeof NAV_ITEMS)[number]["id"];

function appendTerminalData(buffer: string, data: string): string {
  const next = buffer + data;
  return next.length > MAX_TERMINAL_BUFFER_LENGTH
    ? next.slice(next.length - MAX_TERMINAL_BUFFER_LENGTH)
    : next;
}

function formatStatusLine(event: SessionStatusEvent): string {
  const detail = event.message.trim();
  const message = detail ? `[${event.status}] ${detail}` : `[${event.status}]`;
  return `\r\n\u001b[38;5;245m${message}\u001b[0m\r\n`;
}

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "terminal":
      return (
        <svg {...common}>
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      );
    case "files":
      return (
        <svg {...common}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "monitor":
      return (
        <svg {...common}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case "commands":
      return (
        <svg {...common}>
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
          <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      );
    case "pin":
      return (
        <svg {...common}>
          <path d="M12 17v5" />
          <path d="M9 10.5 5.5 7 7 5.5 10.5 9 17 2.5 21.5 7 15 13.5 18.5 17 17 18.5 13.5 15z" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <circle cx="7.5" cy="14.5" r="3.5" />
          <path d="M10 12 21 1" />
          <path d="M15 6h5v5" />
        </svg>
      );
    case "palette":
      return (
        <svg {...common}>
          <circle cx="13.5" cy="6.5" r=".5" />
          <circle cx="17.5" cy="10.5" r=".5" />
          <circle cx="8.5" cy="7.5" r=".5" />
          <circle cx="6.5" cy="12.5" r=".5" />
          <path d="M12 22a10 10 0 1 1 10-10c0 2-1.5 3-3.5 3H17a2 2 0 0 0-2 2c0 1.5-1 5-3 5z" />
        </svg>
      );
    case "network":
      return (
        <svg {...common}>
          <rect x="16" y="16" width="6" height="6" rx="1" />
          <rect x="2" y="16" width="6" height="6" rx="1" />
          <rect x="9" y="2" width="6" height="6" rx="1" />
          <path d="M12 8v4H5v4" />
          <path d="M12 12h7v4" />
        </svg>
      );
    case "zap":
      return (
        <svg {...common}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case "link":
      return (
        <svg {...common}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case "cpu":
      return (
        <svg {...common}>
          <rect x="7" y="7" width="10" height="10" rx="1.5" />
          <path d="M4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      );
    case "edit":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      );
    case "sidebar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="9" y1="4" x2="9" y2="20" />
        </svg>
      );
    default:
      return null;
  }
}

function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function isProductionConnection(connection: Connection | null): boolean {
  return Boolean(
    connection?.tags.some((tag) => tag.toLowerCase() === "prod") ||
      connection?.name.toLowerCase().includes("prod"),
  );
}

function terminalUser(connection: Connection | null): string {
  return connection?.username || "root";
}

function defaultRemotePath(connection: Connection | null): string {
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

function terminalHost(connection: Connection | null, session: Session | null): string {
  return connection?.host || session?.name || "prod-01";
}

function terminalPath(connection: Connection | null): string {
  if (connection?.group.toLowerCase().includes("wsl")) {
    return "/home/jason/projects/go-termflow";
  }
  if (connection && isProductionConnection(connection)) {
    return "/var/www";
  }
  return "~";
}

function shellQuote(value: string): string {
  return `'${value.split("'").join("'\\''")}'`;
}

function parentPath(path: string): string {
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

function pathSegments(path: string): Array<{ label: string; path: string }> {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) {
    return [{ label: "/", path: "/" }];
  }
  return parts.map((part, index) => ({
    label: `${index === 0 ? "/" : "›"} ${part}`,
    path: `/${parts.slice(0, index + 1).join("/")}`,
  }));
}

function joinPath(base: string, name: string): string {
  return `${base.replace(/\/+$/, "")}/${name.replace(/^\/+/, "")}`;
}

function baseName(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? "";
}

function normalizeRemotePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  return `/${trimmed.split("/").filter(Boolean).join("/")}`;
}

const CWD_SYNC_OSC_PREFIX = "\u001b]6973;TermFlowCwd=";
const CWD_SYNC_OSC_SUFFIX = "\u0007";
const CWD_SYNC_COMMAND = `printf '\\033]6973;TermFlowCwd=%s\\007' "$PWD"\r`;
const CWD_SYNC_ECHO = `printf '\\033]6973;TermFlowCwd=%s\\007' "$PWD"`;

function extractSyncedWorkingDirectory(output: string): string | null {
  const start = output.lastIndexOf(CWD_SYNC_OSC_PREFIX);
  if (start < 0) {
    return null;
  }
  const valueStart = start + CWD_SYNC_OSC_PREFIX.length;
  const end = output.indexOf(CWD_SYNC_OSC_SUFFIX, valueStart);
  if (end < 0) {
    return null;
  }
  const path = output.slice(valueStart, end).trim();
  if (!path.startsWith("/")) {
    return null;
  }
  return normalizeRemotePath(path);
}

function cleanCwdSyncOutput(output: string): string {
  let cleaned = output.split(CWD_SYNC_ECHO).join("");
  for (;;) {
    const start = cleaned.indexOf(CWD_SYNC_OSC_PREFIX);
    if (start < 0) {
      break;
    }
    const end = cleaned.indexOf(CWD_SYNC_OSC_SUFFIX, start + CWD_SYNC_OSC_PREFIX.length);
    if (end < 0) {
      cleaned = cleaned.slice(0, start);
      break;
    }
    cleaned = `${cleaned.slice(0, start)}${cleaned.slice(end + CWD_SYNC_OSC_SUFFIX.length)}`;
  }
  return cleaned.replace(/^\r?\n/, "");
}

function demoDir(basePath: string, name: string): BackendFileEntry {
  return { name, path: joinPath(basePath, name), size: 0, sizeLabel: "--", modTime: DEMO_NOW, isDir: true };
}

function demoFile(basePath: string, name: string, size: number): BackendFileEntry {
  return { name, path: joinPath(basePath, name), size, sizeLabel: formatBytes(size), modTime: DEMO_NOW, isDir: false };
}

const DEMO_LOCAL_FILES: BackendFileEntry[] = [
  { name: "frontend", path: "/Projects/go-termflow/frontend", size: 0, sizeLabel: "--", modTime: DEMO_NOW, isDir: true },
  { name: "internal", path: "/Projects/go-termflow/internal", size: 0, sizeLabel: "--", modTime: DEMO_NOW, isDir: true },
  { name: "main.go", path: "/Projects/go-termflow/main.go", size: 1200, sizeLabel: "1.2 KB", modTime: DEMO_NOW, isDir: false },
  { name: "app.go", path: "/Projects/go-termflow/app.go", size: 8400, sizeLabel: "8.4 KB", modTime: DEMO_NOW, isDir: false },
  { name: "go.mod", path: "/Projects/go-termflow/go.mod", size: 612, sizeLabel: "612 B", modTime: DEMO_NOW, isDir: false },
];

const DEMO_REMOTE_TREE: Record<string, BackendFileEntry[]> = {
  "/home/ubuntu": [
    demoDir("/home/ubuntu", "apps"),
    demoDir("/home/ubuntu", "logs"),
    demoFile("/home/ubuntu", "README.md", 1200),
    demoFile("/home/ubuntu", "deploy.sh", 2400),
  ],
  "/home/ubuntu/apps": [
    demoDir("/home/ubuntu/apps", "termflow"),
    demoFile("/home/ubuntu/apps", "package.json", 3200),
  ],
  "/home/ubuntu/logs": [
    demoFile("/home/ubuntu/logs", "app.log", 16_400),
  ],
  "/var/www": [
    demoDir("/var/www", "app"),
    demoDir("/var/www", "html"),
    demoDir("/var/www", "static"),
    demoFile("/var/www", "nginx.conf", 2100),
    demoFile("/var/www", "deploy.sh", 2400),
  ],
  "/var/www/app": [
    demoDir("/var/www/app", "releases"),
    demoDir("/var/www/app", "shared"),
    demoFile("/var/www/app", "ecosystem.config.js", 1800),
    demoFile("/var/www/app", "package.json", 3200),
  ],
  "/var/www/html": [
    demoDir("/var/www/html", "assets"),
    demoFile("/var/www/html", "index.html", 5100),
    demoFile("/var/www/html", "robots.txt", 64),
  ],
  "/var/www/html/assets": [
    demoFile("/var/www/html/assets", "app.css", 7800),
    demoFile("/var/www/html/assets", "app.js", 42_000),
  ],
  "/var/www/static": [
    demoDir("/var/www/static", "img"),
    demoFile("/var/www/static", "manifest.json", 740),
  ],
};

const DEMO_REMOTE_FILES: BackendFileEntry[] = DEMO_REMOTE_TREE[DEFAULT_REMOTE_PATH];

function demoRemoteFilesForPath(path: string): BackendFileEntry[] {
  return DEMO_REMOTE_TREE[normalizeRemotePath(path)] ?? [];
}

type TransferRecord = {
  id: string;
  direction: "upload" | "download";
  name: string;
  detail: string;
  status: "running" | "done" | "failed";
  bytes?: number;
  completedAt?: string;
};

type FileEditorState = {
  side: "local" | "remote";
  path: string;
  name: string;
  language: string;
  originalContent: string;
  content: string;
  isBinary: boolean;
  saving: boolean;
};

type PendingFileDelete = {
  side: "local" | "remote";
  entries: BackendFileEntry[];
};

type PendingNewItem = {
  side: "local" | "remote";
  kind: "file" | "folder";
  name: string;
  error: string | null;
  saving: boolean;
};

type PendingRenameItem = {
  side: "local" | "remote";
  entry: BackendFileEntry;
  name: string;
  error: string | null;
  saving: boolean;
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "light",
  accent: "#8aadf4",
  fontSize: 13,
  transparency: false,
  ligatures: true,
  copyOnSelect: true,
  sshAgent: true,
  defaultKeyPath: "~/.ssh/id_ed25519",
  knownHostsPath: "~/.ssh/known_hosts",
};

const TERMINAL_ALERTS = [
  { cpu: 91, proc: "nginx", pid: 1235, load: "2.5%" },
  { cpu: 92, proc: "python3", pid: 2841, load: "3.3%" },
  { cpu: 92, proc: "python3", pid: 2841, load: "2.9%" },
  { cpu: 93, proc: "python3", pid: 2841, load: "2.6%", active: true },
  { cpu: 90, proc: "nginx", pid: 1235, load: "4.0%" },
  { cpu: 91, proc: "nginx", pid: 1235, load: "2.2%" },
  { cpu: 95, proc: "python3", pid: 2841, load: "2.2%" },
  { cpu: 91, proc: "nginx", pid: 1235, load: "4.2%" },
  { cpu: 92, proc: "nginx", pid: 1235, load: "3.5%" },
  { cpu: 96, proc: "nginx", pid: 1235, load: "2.9%" },
  { cpu: 92, proc: "nginx", pid: 1235, load: "4.1%" },
  { cpu: 90, proc: "nginx", pid: 1235, load: "3.1%" },
  { cpu: 91, proc: "nginx", pid: 1235, load: "4.1%" },
  { cpu: 91, proc: "nginx", pid: 1235, load: "2.3%" },
  { cpu: 91, proc: "nginx", pid: 1235, load: "2.1%" },
  { cpu: 95, proc: "nginx", pid: 1235, load: "4.2%" },
] as const;

type TerminalDock = "monitor" | "files" | "history" | null;
type CommandHistoryScope = "host" | "all";
type CommandScopeKey = "global" | `connection:${string}`;
type CommandScopeType = "global" | "connection";
type CommandEditorRequest = {
  command: SavedCommand | null;
  scopeKey: CommandScopeKey;
};
type PendingCwdSync = {
  sessionId: string;
  output: string;
  timeoutId: number;
};
const CONNECTION_TAG_PREFIX = "connection:";

const MONITOR_CPU_HISTORY = [72, 75, 76, 77, 78, 79, 80, 80, 79, 78, 76, 74, 78, 81, 82, 83, 84, 83, 82, 85, 86, 87, 86, 84, 82, 80, 78, 76];
const MONITOR_NET_HISTORY = [24, 8, 25, 24, 16, 4, 7, 5, 11, 24, 9, 7, 22, 15, 26, 14, 28, 31, 27, 18, 17, 10, 21, 8, 5, 17, 31, 36];
const MONITOR_PROCESSES = [
  { name: "nginx", pid: 1235, mem: "5.8M", cpu: "4.1%" },
  { name: "python3", pid: 2841, mem: "42.3M", cpu: "3.4%" },
  { name: "mysqld", pid: 981, mem: "184M", cpu: "1.3%" },
  { name: "node", pid: 3204, mem: "98.2M", cpu: "0.7%" },
  { name: "redis-server", pid: 1102, mem: "12.1M", cpu: "0.4%" },
  { name: "sshd", pid: 892, mem: "3.4M", cpu: "0.1%" },
];
const TERMINAL_FILES = [
  { icon: "🗂", name: "..", size: "", selected: true },
  { icon: "🗂", name: ".ssh/", size: "" },
  { icon: "🔒", name: ".bashrc", size: "3.7 KB" },
  { icon: "🔒", name: ".profile", size: "807 B" },
  { icon: "⚙", name: "deploy.sh", size: "2.4 KB" },
  { icon: "⚙", name: "backup.sh", size: "1.8 KB" },
];
function SparkBars({ values, color }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  return (
    <span className="spark">
      {values.map((value, index) => (
        <span
          className="spark-bar"
          key={`${value}-${index}`}
          style={{
            height: `${Math.max(4, (value / max) * 34)}px`,
            background: color,
            opacity: 0.35 + (index / values.length) * 0.65,
          }}
        />
      ))}
    </span>
  );
}

function MiniGauge({ value, label, sub, color }: { value: number; label: string; sub: string; color: string }) {
  const radius = 36;
  const circumference = Math.PI * radius;
  const dash = (value / 100) * circumference;

  return (
    <div className="mg">
      <svg width="104" height="68" viewBox="0 0 104 68" aria-hidden="true">
        <path d="M 14 54 A 38 38 0 0 1 90 54" fill="none" stroke="var(--surface0)" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M 14 54 A 38 38 0 0 1 90 54"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
        <text x="52" y="52" textAnchor="middle" fontSize="16" fill="var(--text)" fontFamily="var(--font-mono)" fontWeight="700">{value}%</text>
      </svg>
      <div className="mg-label">{label}</div>
      <div className="mg-sub">{sub}</div>
    </div>
  );
}

function metricTone(value: number) {
  if (value >= 85) return "critical";
  if (value >= 60) return "warn";
  return "ok";
}

function metricColor(value: number) {
  if (value >= 85) return "var(--red)";
  if (value >= 60) return "var(--yellow)";
  return "var(--green)";
}

function commandConnectionId(command: SavedCommand): string | null {
  const connectionTag = command.tags.find((tag) => tag.startsWith(CONNECTION_TAG_PREFIX));
  return connectionTag ? connectionTag.slice(CONNECTION_TAG_PREFIX.length) : null;
}

function commandScopeKey(command: SavedCommand): CommandScopeKey {
  const connectionId = commandConnectionId(command);
  return connectionId ? `connection:${connectionId}` : "global";
}

function scopeKeyForConnection(connectionId: string): CommandScopeKey {
  return `connection:${connectionId}`;
}

function connectionIdFromScopeKey(scopeKey: CommandScopeKey): string | null {
  return scopeKey.startsWith(CONNECTION_TAG_PREFIX) ? scopeKey.slice(CONNECTION_TAG_PREFIX.length) : null;
}

function commandMatchesTerminalScope(command: SavedCommand, connectionId: string | null): boolean {
  const commandConnection = commandConnectionId(command);
  if (commandConnection) {
    return commandConnection === connectionId;
  }
  return command.tags.includes("global");
}

function commandScopeTags(existingTags: string[], scopeType: CommandScopeType, connectionId: string, danger: boolean): string[] {
  const retained = existingTags.filter((tag) => tag !== "global" && tag !== "danger" && !tag.startsWith(CONNECTION_TAG_PREFIX));
  const scopeTags = scopeType === "connection" ? [`${CONNECTION_TAG_PREFIX}${connectionId}`] : ["global"];
  const dangerTags = danger ? ["danger"] : [];
  return [...retained, ...scopeTags, ...dangerTags];
}

function TerminalMonitorDock({
  host,
  user,
  snapshot,
  onFullView,
  onClose,
}: {
  host: string;
  user: string;
  snapshot: MonitorSnapshot | null;
  onFullView(): void;
  onClose(): void;
}) {
  const cpu = snapshot?.cpuPercent ?? 86;
  const mem = snapshot?.memoryPercent ?? 25;
  const disk = snapshot?.diskPercent ?? 45;
  const processes = snapshot?.processes.length
    ? snapshot.processes
    : MONITOR_PROCESSES.map((process) => ({
        name: process.name,
        pid: process.pid,
        memory: process.mem,
        cpuPercent: Number(process.cpu.replace("%", "")),
        memoryPercent: 0,
      }));
  return (
    <aside className="term-monitor" aria-label="Monitor panel">
      <div className="tf-head">
        <span className="tf-head-title"><Icon name="monitor" size={13} />Monitor</span>
        <span className="tf-head-spacer" />
        <span className="tm-live"><span className="tm-live-dot" />live · 2s</span>
        <button className="tf-icon-btn" type="button" title="Open full view" onClick={onFullView}><Icon name="chart" size={13} /></button>
        <button className="tf-icon-btn" type="button" title="Close panel" onClick={onClose}><Icon name="close" size={13} /></button>
      </div>
      <div className="tm-host">{user}@{host}</div>
      <div className="tm-scroll">
        <div className="tm-gauges">
          <MiniGauge value={cpu} label="CPU" sub={snapshot?.loadAverage ?? "live"} color={metricColor(cpu)} />
          <MiniGauge value={mem} label="MEM" sub="usage" color={metricColor(mem)} />
          <MiniGauge value={disk} label="DISK" sub="/ volume" color={metricColor(disk)} />
        </div>
        <section className="tm-chart">
          <div className="tm-chart-head"><Icon name="cpu" size={12} />CPU<span>{cpu}%</span></div>
          <SparkBars values={MONITOR_CPU_HISTORY} color="var(--blue)" />
        </section>
        <section className="tm-chart">
          <div className="tm-chart-head"><Icon name="network" size={12} />Net<span>↓1.9 ↑1.3 MB/s</span></div>
          <SparkBars values={MONITOR_NET_HISTORY} color="var(--teal)" />
        </section>
        <div className="tm-procs-head">
          <span>Top processes</span>
          <span>hover → act</span>
        </div>
        <div className="tm-procs">
          {processes.map((process) => (
            <div className="tm-proc" key={process.pid}>
              <span className="tm-proc-name">{process.name}</span>
              <span className="tm-proc-pid">{process.pid}</span>
              <span className="tm-proc-mem">{process.memory}</span>
              <span className="tm-proc-cpu">{process.cpuPercent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="tm-foot">
        <span className="tm-cpu-dot">● CPU {cpu}%</span>
        <span className="tm-mem-dot">● MEM {mem}%</span>
        <button className="tf-foot-up" type="button" onClick={onFullView}><Icon name="chart" size={11} />Full view</button>
      </div>
    </aside>
  );
}

function TerminalFilesDock({
  files,
  path,
  hasSession,
  transfers,
  onRunCommand,
  onOpenFolder,
  onOpenPath,
  onRefresh,
  onUpload,
  onUploadFolder,
  onNewFile,
  onNewFolder,
  onTransfer,
  onEdit,
  onRename,
  onDelete,
  onDismissTransfer,
  onClearFinishedTransfers,
  onClose,
}: {
  files: BackendFileEntry[];
  path: string;
  hasSession: boolean;
  transfers: TransferRecord[];
  onRunCommand(command: string): void;
  onOpenFolder(entry: BackendFileEntry): void;
  onOpenPath(path: string): void;
  onRefresh(): void;
  onUpload(): void;
  onUploadFolder(): void;
  onNewFile(): void;
  onNewFolder(): void;
  onTransfer(entry: BackendFileEntry): void;
  onEdit(entry: BackendFileEntry): void;
  onRename(entry: BackendFileEntry): void;
  onDelete(entry: BackendFileEntry): void;
  onDismissTransfer(id: string): void;
  onClearFinishedTransfers(): void;
  onClose(): void;
}) {
  const openEntry = (entry: BackendFileEntry) => {
    if (entry.isDir) {
      onOpenFolder(entry);
      return;
    }
    onEdit(entry);
  };
  const [pathDraft, setPathDraft] = useState(path);

  useEffect(() => {
    setPathDraft(path);
  }, [path]);

  const handlePathSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPath = pathDraft.trim();
    if (!nextPath) {
      setPathDraft(path);
      return;
    }
    onOpenPath(nextPath);
  };

  const handleEntryKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, entry: BackendFileEntry) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    openEntry(entry);
  };

  return (
    <aside className="term-files" aria-label="Files panel">
      <div className="tf-head">
        <span className="tf-head-title"><Icon name="files" size={13} />Files</span>
        <span className="tf-head-spacer" />
        <button className="tf-sync" type="button" onClick={onRefresh}><Icon name="link" size={12} />Synced</button>
        <button className="tf-icon-btn" type="button" title="Go up" onClick={() => onOpenPath(parentPath(path))}>↑</button>
        <button className="tf-icon-btn" type="button" title="New file" onClick={onNewFile}><Icon name="file" size={13} /></button>
        <button className="tf-icon-btn" type="button" title="New folder" onClick={onNewFolder}><Icon name="files" size={13} /></button>
        <button className="tf-icon-btn" type="button" title="Upload local file" onClick={onUpload}><Icon name="upload" size={13} /></button>
        <button className="tf-icon-btn" type="button" title="Upload local folder" onClick={onUploadFolder}><Icon name="files" size={13} /></button>
        <button className="tf-icon-btn" type="button" title="Close panel" onClick={onClose}><Icon name="close" size={13} /></button>
      </div>
      <form className="tf-path-edit" onSubmit={handlePathSubmit}>
        <input
          aria-label="Remote path"
          value={pathDraft}
          onChange={(event) => setPathDraft(event.target.value)}
        />
        <button className="tf-go" type="submit">Go</button>
      </form>
      <div className="tf-path">
        {pathSegments(path).map((segment) => (
          <button className="tf-path-seg" type="button" key={segment.path} onClick={() => onOpenPath(segment.path)}>
            {segment.label}
          </button>
        ))}
      </div>
      <div className="tf-list">
        {files.length === 0 ? (
          <div className="tf-empty">
            {hasSession ? "No files found at this path." : "Open an SSH session to browse remote files."}
          </div>
        ) : null}
        {files.map((file, index) => (
          <div
            aria-label={`${file.isDir ? "Open folder" : "Edit file"} ${file.name}`}
            className={`tf-row${index === 0 ? " selected" : ""}${file.isDir ? " dir" : ""}`}
            key={file.path}
            onClick={() => openEntry(file)}
            onKeyDown={(event) => handleEntryKeyDown(event, file)}
            role="button"
            tabIndex={0}
            title={file.isDir ? `Open ${file.path}` : `Edit ${file.path}`}
          >
            <span className="tf-row-icon">{file.isDir ? "🗂" : "📄"}</span>
            <span className="tf-row-name">{file.name}</span>
            <span className="tf-row-size">{file.sizeLabel}</span>
            <span className="tf-actions">
              {file.isDir ? (
                <button className="tf-act" type="button" title="Open folder" onClick={(event) => {
                  event.stopPropagation();
                  onOpenFolder(file);
                }}>
                  <Icon name="files" size={11} />
                </button>
              ) : (
                <button className="tf-act" type="button" title="Edit" onClick={(event) => {
                  event.stopPropagation();
                  onEdit(file);
                }}>
                  <Icon name="edit" size={11} />
                </button>
              )}
              {file.isDir ? (
                <button className="tf-act" type="button" title="cd here" onClick={(event) => {
                  event.stopPropagation();
                  onRunCommand(`cd ${shellQuote(file.path)}`);
                }}>
                  <Icon name="terminal" size={11} />
                </button>
              ) : null}
              <button className="tf-act" type="button" title="Rename" onClick={(event) => {
                event.stopPropagation();
                onRename(file);
              }}>
                <Icon name="file" size={11} />
              </button>
              <button className="tf-act" type="button" title="Download" onClick={(event) => {
                event.stopPropagation();
                onTransfer(file);
              }}>
                <Icon name="download" size={11} />
              </button>
              <button className="tf-act danger" type="button" title="Delete" onClick={(event) => {
                event.stopPropagation();
                onDelete(file);
              }}>
                <Icon name="trash" size={11} />
              </button>
            </span>
          </div>
        ))}
      </div>
      {transfers.length > 0 ? (
        <div className="tf-xfer-stack" aria-label="File transfer progress">
          <div className="tf-xfer-head">
            <span>Transfer history</span>
            <button className="tf-xfer-clear" type="button" onClick={onClearFinishedTransfers}>Clear done</button>
          </div>
          {transfers.map((transfer) => (
            <div className={`tf-xfer-card ${transfer.status}`} key={transfer.id}>
              <div className="tf-xfer-top">
                <span className="tf-xfer-dir">
                  <Icon name={transfer.direction === "upload" ? "upload" : "download"} size={12} />
                </span>
                <span className="tf-xfer-name">{transfer.name}</span>
                <span className="tf-xfer-status">{transfer.status === "running" ? "uploading" : transfer.status}</span>
                <button className="tf-xfer-close" type="button" title={`Hide ${transfer.name}`} onClick={() => onDismissTransfer(transfer.id)}>
                  <Icon name="close" size={10} />
                </button>
              </div>
              <div className="tf-xfer-bar">
                <div className="tf-xfer-fill" style={{ width: transfer.status === "running" ? "48%" : "100%" }} />
              </div>
              <div className="tf-xfer-detail">
                <span>{transfer.detail}</span>
                {transfer.bytes !== undefined ? <b>{formatBytes(transfer.bytes)}</b> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="tf-foot">
        <span>{files.length} items</span>
        <button className="tf-foot-up" type="button" onClick={onUpload}><Icon name="upload" size={11} />Upload</button>
        <button className="tf-foot-up" type="button" onClick={onUploadFolder}><Icon name="files" size={11} />Folder</button>
      </div>
    </aside>
  );
}

function TerminalHistoryDock({
  host,
  history,
  query,
  scope,
  onQueryChange,
  onScopeChange,
  onRunCommand,
  onClear,
  onClose,
}: {
  host: string;
  history: CommandHistoryEntry[];
  query: string;
  scope: CommandHistoryScope;
  onQueryChange(query: string): void;
  onScopeChange(scope: CommandHistoryScope): void;
  onRunCommand(command: string): void;
  onClear(): void;
  onClose(): void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredHistory = normalizedQuery
    ? history.filter((entry) =>
        entry.command.toLowerCase().includes(normalizedQuery) ||
        entry.connectionName.toLowerCase().includes(normalizedQuery),
      )
    : history;

  return (
    <aside className="term-files term-hist" aria-label="History panel">
      <div className="tf-head">
        <span className="tf-head-title"><Icon name="list" size={13} />History</span>
        <span className="tf-head-spacer" />
        <button className="tf-icon-btn" type="button" title="Close panel" onClick={onClose}><Icon name="close" size={13} /></button>
      </div>
      <div className="hp-controls">
        <input
          className="hp-search"
          name="command-history-search"
          placeholder="Search commands..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <div className="hp-scope">
          <button className={scope === "host" ? "active" : ""} type="button" onClick={() => onScopeChange("host")}>{host}</button>
          <button className={scope === "all" ? "active" : ""} type="button" onClick={() => onScopeChange("all")}>All hosts</button>
        </div>
      </div>
      <div className="hp-list">
        {filteredHistory.length === 0 ? (
          <div className="hp-empty">
            {history.length === 0 ? "No commands logged yet. Commands you run in this terminal are recorded here." : "No commands match this search."}
          </div>
        ) : (
          filteredHistory.map((entry) => (
            <button className="hp-item" type="button" key={entry.id} onClick={() => onRunCommand(entry.command)}>
              <code>{entry.command}</code>
              <span>{scope === "all" ? entry.connectionName : new Date(entry.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
            </button>
          ))
        )}
      </div>
      <div className="tf-foot">
        <span>{filteredHistory.length}/{history.length} entries</span>
        <button className="tf-foot-up" type="button" onClick={onClear}><Icon name="trash" size={11} />Clear</button>
      </div>
    </aside>
  );
}

function TerminalSmartBar({
  savedCommands,
  connectionId,
  onClose,
  onPick,
}: {
  savedCommands: SavedCommand[];
  connectionId: string | null;
  onClose(): void;
  onPick(command: string): void;
}) {
  const pinnedCommands = savedCommands.filter((command) => commandMatchesTerminalScope(command, connectionId)).slice(0, 8);

  return (
    <div className="term-smartbar">
      <div className="sm-head">
        <span className="sm-title"><Icon name="zap" size={12} />Quick Commands</span>
        <span className="sm-kbd">⌘J</span>
        <button className="tf-icon-btn sm-close" type="button" title="Close suggestions" onClick={onClose}>
          <Icon name="close" size={11} />
        </button>
      </div>
      <div className="sm-row">
        <span className="sm-cat">Scope</span>
        {pinnedCommands.length === 0 ? (
          <span className="sm-empty">No pinned commands</span>
        ) : (
          pinnedCommands.map((command) => (
            <button className="tq-chip" type="button" key={command.id} onClick={() => onPick(command.command)} title={command.name}>
              <Icon name="play" size={9} />
              {command.command}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function sessionConnection(session: Session, connections: Connection[]): Connection | null {
  return connections.find((connection) => connection.id === session.connectionId) ?? null;
}

function sessionBadge(connection: Connection | null): string {
  if (isProductionConnection(connection)) {
    return "PROD";
  }
  if (connection?.group.toLowerCase().includes("wsl")) {
    return "WSL";
  }
  return "SSH";
}

function formatFileDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("zh-CN", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatBytes(value: number | undefined): string {
  if (!Number.isFinite(value ?? NaN)) {
    return "";
  }
  const size = Math.max(0, value ?? 0);
  if (size < 1024) {
    return `${size} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let current = size / 1024;
  for (const unit of units) {
    if (current < 1024) {
      return `${current.toFixed(1)} ${unit}`;
    }
    current /= 1024;
  }
  return `${current.toFixed(1)} PB`;
}

function fileGlyph(entry: BackendFileEntry): string {
  if (entry.isDir) return "📁";
  if (entry.name.endsWith(".go")) return "🔷";
  if (entry.name.endsWith(".md")) return "📝";
  if (entry.name.endsWith(".env")) return "🔑";
  if (entry.name.endsWith(".sh")) return "⚙";
  return "📄";
}

function FilesPane({
  side,
  path,
  transferTargetPath,
  rows,
  selectedNames,
  onSelectSingle,
  onToggleSelection,
  onUp,
  onRefresh,
  onNewFile,
  onNewFolder,
  onUploadFolder,
  onOpenFolder,
  onOpenPath,
  onTransfer,
  onTransferMany,
  onEdit,
  onRename,
  onDelete,
  onDeleteMany,
}: {
  side: "local" | "remote";
  path: string;
  transferTargetPath: string;
  rows: BackendFileEntry[];
  selectedNames: string[];
  onSelectSingle(name: string): void;
  onToggleSelection(name: string): void;
  onUp(): void;
  onRefresh(): void;
  onNewFile(): void;
  onNewFolder(): void;
  onUploadFolder(): void;
  onOpenFolder(entry: BackendFileEntry): void;
  onOpenPath(path: string): void;
  onTransfer(entry: BackendFileEntry): void;
  onTransferMany(entries: BackendFileEntry[]): void;
  onEdit(entry: BackendFileEntry): void;
  onRename(entry: BackendFileEntry): void;
  onDelete(entry: BackendFileEntry): void;
  onDeleteMany(entries: BackendFileEntry[]): void;
}) {
  const transferLabel = side === "local" ? "Upload" : "Download";
  const selectedSet = useMemo(() => new Set(selectedNames), [selectedNames]);
  const selectedEntries = rows.filter((row) => selectedSet.has(row.name));
  const selectedEntry = selectedEntries[0] ?? rows[0] ?? null;
  const activeTransferEntries = selectedEntries.length > 0 ? selectedEntries : selectedEntry ? [selectedEntry] : [];
  const [pathDraft, setPathDraft] = useState(path);

  useEffect(() => {
    setPathDraft(path);
  }, [path]);

  const handlePathSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPath = pathDraft.trim();
    if (!nextPath) {
      setPathDraft(path);
      return;
    }
    onOpenPath(nextPath);
  };

  const openOrSelect = (entry: BackendFileEntry) => {
    if (entry.isDir) {
      onOpenFolder(entry);
      return;
    }
    onSelectSingle(entry.name);
  };

  const handleRowKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, entry: BackendFileEntry) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    openOrSelect(entry);
  };

  return (
    <div className="files-pane">
      <div className="files-pane-header">
        <span className={`fp-badge ${side}`}>{side}</span>
        <form className="fp-path-form" onSubmit={handlePathSubmit}>
          <input
            aria-label={`${side} path`}
            className="fp-path-input"
            value={pathDraft}
            onChange={(event) => setPathDraft(event.target.value)}
          />
          <button className="fp-btn" type="submit">Go</button>
        </form>
        <div className="fp-actions">
          <button className="fp-btn" type="button" title="Go up" onClick={onUp}>↑</button>
          <button className="fp-btn" type="button" title="New file" onClick={onNewFile}><Icon name="file" size={13} /></button>
          <button className="fp-btn" type="button" title="New folder" onClick={onNewFolder}><Icon name="files" size={13} /></button>
          {side === "local" ? (
            <button className="fp-btn" type="button" title="Upload local folder" onClick={onUploadFolder}><Icon name="files" size={13} /></button>
          ) : null}
          <button className="fp-btn" type="button" title="Refresh" onClick={onRefresh}><Icon name="refresh" size={12} /></button>
          <button
            className="fp-btn"
            type="button"
            title={activeTransferEntries.length > 1 ? `${transferLabel} selected` : selectedEntry?.isDir ? transferLabel : transferLabel}
            onClick={() => {
              if (activeTransferEntries.length === 0) {
                return;
              }
              onTransferMany(activeTransferEntries);
            }}
          >
            <Icon name={side === "local" ? "upload" : "download"} size={12} />
          </button>
          <button
            className="fp-btn danger"
            type="button"
            title="Delete selected"
            onClick={() => activeTransferEntries.length > 0 && onDeleteMany(activeTransferEntries)}
          >
            <Icon name="trash" size={12} />
          </button>
        </div>
      </div>
      <div className="files-toolbar">
        <span className="files-toolbar-label">Path:</span>
        {pathSegments(path).map((segment) => (
          <button className="files-crumb" type="button" key={`${side}-${segment.path}`} onClick={() => onOpenPath(segment.path)}>
            {segment.label}
          </button>
        ))}
      </div>
      <div className="files-list">
        {rows.map((row) => (
          <div
            className={`f-item${selectedSet.has(row.name) ? " selected" : ""}`}
            key={`${side}-${row.path}`}
            onClick={() => openOrSelect(row)}
            onDoubleClick={() => row.isDir && onOpenFolder(row)}
            onKeyDown={(event) => handleRowKeyDown(event, row)}
            role="button"
            tabIndex={0}
          >
            <label className="f-check" onClick={(event) => event.stopPropagation()} title={`Select ${row.name}`}>
              <input
                aria-label={`Select ${row.name}`}
                checked={selectedSet.has(row.name)}
                type="checkbox"
                onChange={() => onToggleSelection(row.name)}
              />
            </label>
            <span className="f-item-icon">{fileGlyph(row)}</span>
            <span className="f-item-name">{row.name}</span>
            <span className="f-item-meta">
              <span className="f-item-size">{row.sizeLabel}</span>
              <span className="f-item-date">{formatFileDate(row.modTime)}</span>
            </span>
            <span className="f-row-actions">
              <button className="f-act go" type="button" title={row.isDir ? "Open folder" : transferLabel} onClick={(event) => {
                event.stopPropagation();
                if (row.isDir) {
                  onOpenFolder(row);
                  return;
                }
                onTransfer(row);
              }}>
                <Icon name={row.isDir ? "files" : side === "local" ? "upload" : "download"} size={13} />
              </button>
              {!row.isDir ? (
                <button className="f-act" type="button" title="Edit" onClick={(event) => {
                  event.stopPropagation();
                  onEdit(row);
                }}>
                  <Icon name="edit" size={13} />
                </button>
              ) : null}
              <button className="f-act" type="button" title="Rename" onClick={(event) => {
                event.stopPropagation();
                onRename(row);
              }}>
                <Icon name="file" size={13} />
              </button>
              <button className="f-act danger" type="button" title="Delete" onClick={(event) => {
                event.stopPropagation();
                onDelete(row);
              }}>
                <Icon name="trash" size={13} />
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="files-status">
        <span>{rows.length} items</span>
        {selectedNames.length > 0 ? <span>Selected: <strong>{selectedNames.length}</strong></span> : null}
        <span className="fs-spacer" />
        <span className={`fs-dest ${side}`}>
          <Icon name={side === "local" ? "upload" : "download"} size={11} />
          {transferLabel} → <b>{side === "local" ? `REMOTE ${transferTargetPath}` : `LOCAL ${transferTargetPath}`}</b>
        </span>
      </div>
    </div>
  );
}

function FilesView({
  activeSession,
  localFiles,
  remoteFiles,
  localPath,
  remotePath,
  transfers,
  onLocalUp,
  onRemoteUp,
  onLocalRefresh,
  onRemoteRefresh,
  onNewFile,
  onNewFolder,
  onUploadFolder,
  onOpenFolder,
  onOpenPath,
  onTransfer,
  onTransferMany,
  onEdit,
  onRename,
  onDelete,
  onDeleteMany,
  onDismissTransfer,
  onClearFinishedTransfers,
}: {
  activeSession: Session | null;
  localFiles: BackendFileEntry[];
  remoteFiles: BackendFileEntry[];
  localPath: string;
  remotePath: string;
  transfers: TransferRecord[];
  onLocalUp(): void;
  onRemoteUp(): void;
  onLocalRefresh(): void;
  onRemoteRefresh(): void;
  onNewFile(side: "local" | "remote"): void;
  onNewFolder(side: "local" | "remote"): void;
  onUploadFolder(): void;
  onOpenFolder(side: "local" | "remote", entry: BackendFileEntry): void;
  onOpenPath(side: "local" | "remote", path: string): void;
  onTransfer(side: "local" | "remote", entry: BackendFileEntry): void;
  onTransferMany(side: "local" | "remote", entries: BackendFileEntry[]): void;
  onEdit(side: "local" | "remote", entry: BackendFileEntry): void;
  onRename(side: "local" | "remote", entry: BackendFileEntry): void;
  onDelete(side: "local" | "remote", entry: BackendFileEntry): void;
  onDeleteMany(side: "local" | "remote", entries: BackendFileEntry[]): void;
  onDismissTransfer(id: string): void;
  onClearFinishedTransfers(): void;
}) {
  const [localSelection, setLocalSelection] = useState<string[]>(["frontend"]);
  const [remoteSelection, setRemoteSelection] = useState<string[]>(["nginx.conf"]);

  useEffect(() => {
    const availableNames = new Set(localFiles.map((file) => file.name));
    setLocalSelection((current) => {
      if (localFiles.length === 0) {
        return current.length === 0 ? current : [];
      }
      const nextSelection = current.filter((name) => availableNames.has(name));
      return nextSelection.length === current.length ? current : nextSelection;
    });
  }, [localFiles]);

  useEffect(() => {
    const availableNames = new Set(remoteFiles.map((file) => file.name));
    setRemoteSelection((current) => {
      if (remoteFiles.length === 0) {
        return current.length === 0 ? current : [];
      }
      const nextSelection = current.filter((name) => availableNames.has(name));
      return nextSelection.length === current.length ? current : nextSelection;
    });
  }, [remoteFiles]);

  const toggleLocalSelection = (name: string) => {
    setLocalSelection((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  };
  const toggleRemoteSelection = (name: string) => {
    setRemoteSelection((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  };

  return (
    <section className="view-stack">
      <div className="view-header">
        <Icon name="files" size={16} />
        <span className="view-header-title">File Manager</span>
        <span className="view-header-note">{activeSession?.name ?? "No session"} · hover rows for actions</span>
      </div>
      <div className="files-split">
        <FilesPane
          side="local"
          path={localPath}
          transferTargetPath={remotePath}
          rows={localFiles}
          selectedNames={localSelection}
          onSelectSingle={(name) => setLocalSelection([name])}
          onToggleSelection={toggleLocalSelection}
          onUp={onLocalUp}
          onRefresh={onLocalRefresh}
          onNewFile={() => onNewFile("local")}
          onNewFolder={() => onNewFolder("local")}
          onUploadFolder={onUploadFolder}
          onOpenFolder={(entry) => onOpenFolder("local", entry)}
          onOpenPath={(path) => onOpenPath("local", path)}
          onTransfer={(entry) => onTransfer("local", entry)}
          onTransferMany={(entries) => onTransferMany("local", entries)}
          onEdit={(entry) => onEdit("local", entry)}
          onRename={(entry) => onRename("local", entry)}
          onDelete={(entry) => onDelete("local", entry)}
          onDeleteMany={(entries) => onDeleteMany("local", entries)}
        />
        <div className="pane-divider" />
        <FilesPane
          side="remote"
          path={remotePath}
          transferTargetPath={localPath}
          rows={remoteFiles}
          selectedNames={remoteSelection}
          onSelectSingle={(name) => setRemoteSelection([name])}
          onToggleSelection={toggleRemoteSelection}
          onUp={onRemoteUp}
          onRefresh={onRemoteRefresh}
          onNewFile={() => onNewFile("remote")}
          onNewFolder={() => onNewFolder("remote")}
          onUploadFolder={onUploadFolder}
          onOpenFolder={(entry) => onOpenFolder("remote", entry)}
          onOpenPath={(path) => onOpenPath("remote", path)}
          onTransfer={(entry) => onTransfer("remote", entry)}
          onTransferMany={(entries) => onTransferMany("remote", entries)}
          onEdit={(entry) => onEdit("remote", entry)}
          onRename={(entry) => onRename("remote", entry)}
          onDelete={(entry) => onDelete("remote", entry)}
          onDeleteMany={(entries) => onDeleteMany("remote", entries)}
        />
        {transfers.length > 0 ? (
          <div className="xfer-stack">
            <div className="xfer-history-head">
              <span>Transfer history</span>
              <button type="button" onClick={onClearFinishedTransfers}>Clear done</button>
            </div>
            {transfers.map((transfer) => (
              <div className={`xfer-card ${transfer.status}`} key={transfer.id}>
                <div className="xfer-top">
                  <span className="xfer-dir">
                    <Icon name={transfer.direction === "upload" ? "upload" : "download"} size={13} />
                  </span>
                  <span className="xfer-name">{transfer.name} · {transfer.detail}</span>
                  <span className="xfer-pct">{transfer.status === "running" ? "..." : transfer.status}</span>
                  <button className="xfer-close" type="button" title={`Hide ${transfer.name}`} onClick={() => onDismissTransfer(transfer.id)}>
                    <Icon name="close" size={11} />
                  </button>
                </div>
                <div className="xfer-bar">
                  <div className="xfer-bar-fill" style={{ width: transfer.status === "running" ? "48%" : "100%" }} />
                </div>
                {transfer.bytes !== undefined ? <div className="xfer-bytes">{formatBytes(transfer.bytes)}</div> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FileEditorModal({
  editor,
  onChange,
  onClose,
  onSave,
}: {
  editor: FileEditorState;
  onChange(content: string): void;
  onClose(): void;
  onSave(): void;
}) {
  const dirty = editor.content !== editor.originalContent;
  const lineCount = Math.max(1, editor.content.split("\n").length);
  const lineNumbers = Array.from({ length: lineCount }, (_, index) => index + 1).join("\n");

  return (
    <div className="tf-overlay" role="presentation" onMouseDown={onClose}>
      <section className="file-editor-card" role="dialog" aria-modal="true" aria-label={`Edit ${editor.name}`} onMouseDown={(event) => event.stopPropagation()}>
        <header className="file-editor-head">
          <div className="fe-title-block">
            <span className={`fp-badge ${editor.side}`}>{editor.side}</span>
            <span className="fe-title">{editor.name}</span>
            <span className="fe-language">{editor.language}</span>
            {dirty ? <span className="fe-dirty">unsaved</span> : null}
          </div>
          <button className="fp-btn" type="button" title="Close editor" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </header>
        <div className="fe-path">{editor.path}</div>
        {editor.isBinary ? (
          <div className="fe-binary">
            <Icon name="shield" size={18} />
            <span>This file looks binary and is opened read-only.</span>
          </div>
        ) : (
          <div className={`fe-editor language-${editor.language}`}>
            <pre className="fe-lines" aria-hidden="true">{lineNumbers}</pre>
            <textarea
              className="fe-textarea"
              name="file-editor-content"
              spellCheck={false}
              value={editor.content}
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
        )}
        <footer className="file-editor-foot">
          <button className="view-btn" type="button" disabled={!dirty || editor.saving} onClick={() => onChange(editor.originalContent)}>
            Revert
          </button>
          <button className="view-btn primary" type="button" disabled={!dirty || editor.saving || editor.isBinary} onClick={onSave}>
            {editor.saving ? "Saving..." : "Save"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function DeleteConnectionConfirm({
  connection,
  deleting,
  onCancel,
  onConfirm,
}: {
  connection: Connection;
  deleting: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <div className="danger-overlay" role="presentation" onMouseDown={deleting ? undefined : onCancel}>
      <section
        className="danger-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-connection-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="danger-head">
          <span className="danger-icon">
            <Icon name="trash" size={16} />
          </span>
          <div>
            <div className="danger-title" id="delete-connection-title">Delete Connection</div>
            <div className="danger-sub">This removes the saved host from your connection list.</div>
          </div>
        </header>
        <div className="danger-target">
          <span className="danger-target-name">{connection.name}</span>
          <span>{connection.username}@{connection.host}:{connection.port}</span>
        </div>
        <footer className="danger-actions">
          <button className="btn" type="button" onClick={onCancel} disabled={deleting}>
            Cancel
          </button>
          <button className="btn danger" type="button" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function FileDeleteConfirm({
  pendingDelete,
  deleting,
  onCancel,
  onConfirm,
}: {
  pendingDelete: PendingFileDelete;
  deleting: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  const { side, entries } = pendingDelete;
  const singleEntry = entries.length === 1 ? entries[0] : null;
  const title = entries.length === 1 ? `Delete ${singleEntry?.isDir ? "Folder" : "File"}` : "Delete Items";
  const subtitle =
    side === "remote"
      ? "This removes the selected remote item from the active SSH session."
      : "This removes the selected local item from disk.";

  return (
    <div className="danger-overlay" role="presentation" onMouseDown={deleting ? undefined : onCancel}>
      <section
        className="danger-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-file-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="danger-head">
          <span className="danger-icon">
            <Icon name="trash" size={16} />
          </span>
          <div>
            <div className="danger-title" id="delete-file-title">{title}</div>
            <div className="danger-sub">{subtitle}</div>
          </div>
        </header>
        <div className="danger-target">
          <span className="danger-target-name">
            {singleEntry ? singleEntry.name : `${entries.length} ${side} items`}
          </span>
          <span>{singleEntry ? singleEntry.path : entries.map((entry) => entry.name).join(", ")}</span>
        </div>
        <footer className="danger-actions">
          <button className="btn" type="button" onClick={onCancel} disabled={deleting}>
            Cancel
          </button>
          <button className="btn danger" type="button" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function NewFileItemModal({
  pendingItem,
  basePath,
  onChangeName,
  onCancel,
  onConfirm,
}: {
  pendingItem: PendingNewItem;
  basePath: string;
  onChangeName(name: string): void;
  onCancel(): void;
  onConfirm(): void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const title = `New ${pendingItem.side} ${pendingItem.kind}`;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onConfirm();
  };

  return (
    <div className="tf-overlay" role="presentation" onMouseDown={pendingItem.saving ? undefined : onCancel}>
      <section
        className="modal-card new-item-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-file-item-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <span className="modal-head-icon">
            <Icon name={pendingItem.kind === "file" ? "file" : "files"} size={16} />
          </span>
          <div>
            <div className="modal-title" id="new-file-item-title">{title}</div>
            <div className="modal-sub">{basePath}</div>
          </div>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label className="field">
              <span>Name</span>
              <input
                ref={inputRef}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={pendingItem.name}
                onChange={(event) => onChangeName(event.target.value)}
                placeholder={pendingItem.kind === "file" ? "example.txt" : "new-folder"}
              />
            </label>
            {pendingItem.error ? <div className="modal-error">{pendingItem.error}</div> : null}
          </div>
          <footer className="modal-foot">
            <button className="btn" type="button" onClick={onCancel} disabled={pendingItem.saving}>
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={pendingItem.saving}>
              {pendingItem.saving ? "Creating..." : "Create"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function RenameFileItemModal({
  pendingItem,
  onChangeName,
  onCancel,
  onConfirm,
}: {
  pendingItem: PendingRenameItem;
  onChangeName(name: string): void;
  onCancel(): void;
  onConfirm(): void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const kind = pendingItem.entry.isDir ? "folder" : "file";
  const title = `Rename ${pendingItem.side} ${kind}`;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onConfirm();
  };

  return (
    <div className="tf-overlay" role="presentation" onMouseDown={pendingItem.saving ? undefined : onCancel}>
      <section
        className="modal-card new-item-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-file-item-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <span className="modal-head-icon">
            <Icon name={pendingItem.entry.isDir ? "files" : "file"} size={16} />
          </span>
          <div>
            <div className="modal-title" id="rename-file-item-title">{title}</div>
            <div className="modal-sub">{pendingItem.entry.path}</div>
          </div>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label className="field">
              <span>Name</span>
              <input
                ref={inputRef}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={pendingItem.name}
                onChange={(event) => onChangeName(event.target.value)}
              />
            </label>
            {pendingItem.error ? <div className="modal-error">{pendingItem.error}</div> : null}
          </div>
          <footer className="modal-foot">
            <button className="btn" type="button" onClick={onCancel} disabled={pendingItem.saving}>
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={pendingItem.saving}>
              {pendingItem.saving ? "Renaming..." : "Rename"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function MonitorView({ snapshot }: { snapshot: MonitorSnapshot | null }) {
  const cpu = snapshot?.cpuPercent ?? 18;
  const mem = snapshot?.memoryPercent ?? 62;
  const disk = snapshot?.diskPercent ?? 41;
  const cards = [
    ["CPU", `${cpu}%`, `load ${snapshot?.loadAverage ?? "0.62"}`, cpu > 85 ? "var(--red)" : "var(--green)", cpu],
    ["Memory", `${mem}%`, "remote memory usage", mem > 85 ? "var(--red)" : "var(--yellow)", mem],
    ["Disk", `${disk}%`, "/ volume", disk > 85 ? "var(--red)" : "var(--blue)", disk],
  ] as const;
  const processes = snapshot?.processes.length
    ? snapshot.processes
    : ["nginx", "node", "postgres", "systemd", "sshd", "wails"].map((name, index) => ({
        name,
        pid: 1240 + index,
        cpuPercent: Number((12.4 - index * 1.7).toFixed(1)),
        memory: `${280 - index * 21}M`,
        memoryPercent: 0,
      }));

  return (
    <section className="view-stack">
      <div className="view-header">
        <Icon name="monitor" size={16} />
        <span className="view-header-title">Monitor</span>
        <span className="tm-live"><span className="tm-live-dot" /> Live prod-01</span>
      </div>
      <div className="monitor-wrap">
        <div className="monitor-cards">
          {cards.map(([label, value, sub, color, pct]) => (
            <article className="monitor-card" key={label}>
              <div className="mc-label">{label}</div>
              <div className="mc-value">{value}</div>
              <div className="mc-sub">{sub}</div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
              </div>
              <div className="mc-stats">
                <span className="mc-stat"><span className="mc-stat-label">peak </span><span className="mc-stat-value">{Number(pct) + 11}%</span></span>
                <span className="mc-stat"><span className="mc-stat-label">avg </span><span className="mc-stat-value">{Math.max(8, Number(pct) - 14)}%</span></span>
              </div>
            </article>
          ))}
        </div>
        <div className="monitor-bottom">
          <section className="monitor-section">
            <div className="ms-header">Processes</div>
            {processes.map((process) => (
              <div className="proc-row" key={`${process.name}-${process.pid}`}>
                <span className="proc-name">{process.name}</span>
                <span className="proc-pid">{process.pid}</span>
                <span className="proc-cpu">{process.cpuPercent.toFixed(1)}%</span>
                <span className="proc-mem">{process.memory}</span>
              </div>
            ))}
          </section>
          <section className="monitor-section">
            <div className="ms-header">Network</div>
            <div className="chart-area">
              <div className="mini-chart">
                {[26, 44, 32, 58, 72, 45, 63, 38, 81, 54, 66, 40, 74, 51].map((height, index) => (
                  <span className="chart-bar" key={index} style={{ height: `${height}%`, background: index % 3 === 0 ? "var(--teal)" : "var(--blue)" }} />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function CommandsView({
  savedCommands,
  connections,
  onRun,
  onCreate,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  savedCommands: SavedCommand[];
  connections: Connection[];
  onRun(command: string): void;
  onCreate(scopeKey: CommandScopeKey): void;
  onEdit(command: SavedCommand): void;
  onDelete(command: SavedCommand): void;
  onTogglePin(command: SavedCommand): void;
}) {
  const [activeScope, setActiveScope] = useState<CommandScopeKey>("global");
  const activeConnectionId = connectionIdFromScopeKey(activeScope);
  const activeConnection = activeConnectionId ? connections.find((connection) => connection.id === activeConnectionId) ?? null : null;
  const commands = savedCommands.filter((command) => commandScopeKey(command) === activeScope);
  const scopeTitle = activeConnection ? activeConnection.name : "Global Commands";
  const scopeSubtitle = activeConnection
    ? `${activeConnection.username}@${activeConnection.host}:${activeConnection.port}`
    : "Available from every terminal session";
  const globalCount = savedCommands.filter((command) => commandScopeKey(command) === "global").length;
  const countForConnection = (connectionId: string) =>
    savedCommands.filter((command) => commandScopeKey(command) === scopeKeyForConnection(connectionId)).length;

  return (
    <section className="view-stack">
      <div className="view-header">
        <Icon name="commands" size={16} />
        <span className="view-header-title">Command Library</span>
        <button className="view-btn primary" type="button" onClick={() => onCreate(activeScope)}><Icon name="plus" size={13} />New Command</button>
      </div>
      <div className="cmd-wrap">
        <aside className="cmd-sidebar" aria-label="Command scopes">
          <button
            className={`cmd-nav-item cmd-scope-main${activeScope === "global" ? " active" : ""}`}
            type="button"
            onClick={() => setActiveScope("global")}
          >
            <Icon name="list" size={14} />
            <span>
              <span className="cmd-scope-name">Global Commands</span>
              <span className="cmd-scope-meta">All terminals</span>
            </span>
            <span className="cmd-count">{globalCount}</span>
          </button>
          {connections.map((connection) => {
            const scopeKey = scopeKeyForConnection(connection.id);
            return (
              <button
                className={`cmd-nav-item${activeScope === scopeKey ? " active" : ""}`}
                type="button"
                key={connection.id}
                onClick={() => setActiveScope(scopeKey)}
              >
                <Icon name={connection.tags.includes("wsl") ? "terminal" : "network"} size={14} />
                <span>
                  <span className="cmd-scope-name">{connection.name}</span>
                  <span className="cmd-scope-meta">{connection.username}@{connection.host}</span>
                </span>
                <span className="cmd-count">{countForConnection(connection.id)}</span>
              </button>
            );
          })}
        </aside>
        <div className="cmd-main">
          <div className="cmd-main-head">
            <div>
              <div className="cmd-main-title">{scopeTitle}</div>
              <div className="cmd-main-sub">{scopeSubtitle}</div>
            </div>
            <button className="view-btn" type="button" onClick={() => onCreate(activeScope)}>
              <Icon name="plus" size={13} />Add here
            </button>
          </div>
          <div className="cmd-grid">
          {commands.length === 0 ? (
            <div className="cmd-empty">
              <div className="cmd-empty-title">No commands in this scope</div>
              <div className="cmd-empty-sub">Save reusable shell commands for {activeConnection ? activeConnection.name : "all connections"}.</div>
              <button className="view-btn primary" type="button" onClick={() => onCreate(activeScope)}>
                <Icon name="plus" size={13} />Create command
              </button>
            </div>
          ) : (
            commands.map((command) => {
              const isGlobal = commandScopeKey(command) === "global";
              return (
                <article className={`cmd-card${isGlobal ? " pinned" : ""}`} key={command.id}>
                  <div className="cmd-card-head">
                    <div className="cmd-card-name">{command.name}</div>
                    <button
                      className={`cmd-pin${isGlobal ? " on" : ""}`}
                      type="button"
                      title={isGlobal ? "Global command" : "Make global"}
                      disabled={isGlobal}
                      onClick={() => onTogglePin(command)}
                    >
                      <Icon name="pin" size={13} />
                    </button>
                  </div>
                  <code className="cmd-card-code">{command.command}</code>
                  <div className="cmd-card-desc">{command.description}</div>
                  <div className="cmd-card-footer">
                    {command.tags.map((tag) => (
                      <span className={`tag tag-${tag === "danger" ? "danger" : tag === "param" ? "param" : tag === "global" ? "global" : tag.startsWith(CONNECTION_TAG_PREFIX) ? "server" : "server"}`} key={tag}>
                        {tag.startsWith(CONNECTION_TAG_PREFIX) ? "host" : tag}
                      </span>
                    ))}
                    <button className="cmd-run-btn secondary" type="button" onClick={() => onEdit(command)}>
                      <Icon name="edit" size={10} />Edit
                    </button>
                    <button className="cmd-run-btn danger" type="button" onClick={() => onDelete(command)}>
                      <Icon name="trash" size={10} />Delete
                    </button>
                    <button className="cmd-run-btn" type="button" onClick={() => onRun(command.command)}>
                      <Icon name="play" size={10} />{command.tags.includes("param") ? "Run..." : "Run"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
          </div>
        </div>
      </div>
    </section>
  );
}

function CommandEditorModal({
  request,
  connections,
  onCancel,
  onSave,
}: {
  request: CommandEditorRequest;
  connections: Connection[];
  onCancel(): void;
  onSave(input: Parameters<typeof saveSavedCommand>[0]): Promise<void>;
}) {
  const editingCommand = request.command;
  const initialConnectionId = editingCommand ? commandConnectionId(editingCommand) : connectionIdFromScopeKey(request.scopeKey);
  const [name, setName] = useState(editingCommand?.name ?? "");
  const [command, setCommand] = useState(editingCommand?.command ?? "");
  const [description, setDescription] = useState(editingCommand?.description ?? "");
  const [scopeType, setScopeType] = useState<CommandScopeType>(initialConnectionId ? "connection" : "global");
  const [connectionId, setConnectionId] = useState(initialConnectionId ?? connections[0]?.id ?? "");
  const [danger, setDanger] = useState(editingCommand?.tags.includes("danger") ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEditing = editingCommand !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !command.trim()) {
      setError("Name and command are required.");
      return;
    }
    if (scopeType === "connection" && !connectionId) {
      setError("Choose a connection for this command.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        id: editingCommand?.id,
        name: name.trim(),
        command: command.trim(),
        description: description.trim(),
        tags: commandScopeTags(editingCommand?.tags ?? [], scopeType, connectionId, danger),
      });
    } catch (saveError) {
      setError(messageFromError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tf-overlay" role="presentation" onMouseDown={saving ? undefined : onCancel}>
      <form className="modal-card command-modal-card" onSubmit={handleSubmit} aria-labelledby="command-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <div className="modal-head-icon"><Icon name="commands" size={14} /></div>
          <div>
            <div className="modal-title" id="command-modal-title">{isEditing ? "Edit Command" : "New Command"}</div>
            <div className="modal-sub">Choose whether this command is global or tied to one connection</div>
          </div>
          <button className="tf-icon-btn" type="button" onClick={onCancel} aria-label="Close command modal" title="Close command modal">
            <Icon name="close" size={12} />
          </button>
        </header>

        <div className="modal-body">
          {error ? <div className="modal-error">{error}</div> : null}
          <label className="field">
            <span className="field-label">Name</span>
            <input className="field-input" name="command-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Restart nginx" autoFocus required />
          </label>
          <label className="field">
            <span className="field-label">Command</span>
            <textarea className="field-input command-textarea" name="command-body" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="systemctl restart nginx" required />
          </label>
          <label className="field">
            <span className="field-label">Description</span>
            <input className="field-input" name="command-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short note shown in the command library" />
          </label>
          <div className="field">
            <span className="field-label">Scope</span>
            <div className="seg-control">
              <button className={`seg-opt${scopeType === "global" ? " on" : ""}`} type="button" onClick={() => setScopeType("global")}>Global</button>
              <button className={`seg-opt${scopeType === "connection" ? " on" : ""}`} type="button" onClick={() => setScopeType("connection")}>Connection</button>
            </div>
          </div>
          {scopeType === "connection" ? (
            <label className="field">
              <span className="field-label">Connection</span>
              <select className="field-input" name="command-connection" value={connectionId} onChange={(event) => setConnectionId(event.target.value)} required>
                {connections.map((connection) => (
                  <option value={connection.id} key={connection.id}>{connection.name} · {connection.username}@{connection.host}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="auth-check">
            <input type="checkbox" checked={danger} onChange={(event) => setDanger(event.target.checked)} />
            Mark as destructive
          </label>
        </div>

        <footer className="modal-foot">
          <button className="btn" type="button" onClick={onCancel}>Cancel</button>
          <button className="btn primary" type="submit" disabled={saving || !name.trim() || !command.trim()}>
            {saving ? "Saving..." : isEditing ? "Save changes" : "Save command"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function CommandDeleteConfirm({
  command,
  deleting,
  onCancel,
  onConfirm,
}: {
  command: SavedCommand;
  deleting: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <div className="danger-overlay" role="presentation" onMouseDown={deleting ? undefined : onCancel}>
      <section
        className="danger-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-command-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="danger-head">
          <span className="danger-icon">
            <Icon name="trash" size={16} />
          </span>
          <div>
            <div className="danger-title" id="delete-command-title">Delete Command</div>
            <div className="danger-sub">This removes the saved shortcut from the command library.</div>
          </div>
        </header>
        <div className="danger-target">
          <span className="danger-target-name">{command.name}</span>
          <span>{command.command}</span>
        </div>
        <footer className="danger-actions">
          <button className="btn" type="button" onClick={onCancel} disabled={deleting}>
            Cancel
          </button>
          <button className="btn danger" type="button" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function SettingsView({
  appSettings,
  onSave,
}: {
  appSettings: AppSettings;
  onSave(settings: AppSettings): Promise<void> | void;
}) {
  const [activeSection, setActiveSection] = useState("appearance");
  const [settings, setSettings] = useState<AppSettings>(appSettings);
  useEffect(() => {
    setSettings(appSettings);
  }, [appSettings]);
  const setSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };
  const nav = [
    ["appearance", "Appearance", "palette"],
    ["terminal", "Terminal", "terminal"],
    ["ssh", "SSH / Keys", "key"],
    ["transfer", "File Transfer", "download"],
    ["security", "Security", "shield"],
  ] as const;

  return (
    <section className="view-stack">
      <div className="view-header">
        <Icon name="settings" size={16} />
        <span className="view-header-title">Settings</span>
        <button className="view-btn primary" type="button" onClick={() => void onSave(settings)}>Save Changes</button>
      </div>
      <div className="settings-wrap">
        <aside className="settings-nav">
          {nav.map(([id, label, icon]) => (
            <button className={`sn-item${activeSection === id ? " active" : ""}`} type="button" key={id} onClick={() => setActiveSection(id)}>
              <Icon name={icon} size={14} />
              {label}
            </button>
          ))}
        </aside>
        <div className="settings-content">
          {activeSection === "appearance" ? (
            <section className="settings-section">
              <div className="ss-title">Theme & Colors</div>
              <div className="ss-desc">Choose the color scheme and accent for the entire app.</div>
              <div className="ss-row">
                <div className="ss-label">
                  <div className="ss-label-name">Color Theme</div>
                  <div className="ss-label-hint">Catppuccin Macchiato / Latte parity</div>
                </div>
                <select className="ss-select" name="theme" value={settings.theme} onChange={(event) => setSetting("theme", event.target.value)}>
                  <option value="light">Catppuccin Latte</option>
                  <option value="dark">Catppuccin Macchiato</option>
                  <option value="tokyo-night">Tokyo Night</option>
                  <option value="nord">Nord</option>
                </select>
              </div>
              <div className="ss-row">
                <div className="ss-label">
                  <div className="ss-label-name">Accent Color</div>
                  <div className="ss-label-hint">Used for active states and highlights</div>
                </div>
                <div className="color-swatches">
                  {["#8aadf4", "#c6a0f6", "#8bd5ca", "#a6da95", "#f5a97f", "#ed8796"].map((color) => (
                    <button
                      className={`color-swatch${settings.accent === color ? " active" : ""}`}
                      key={color}
                      style={{ background: color }}
                      type="button"
                      onClick={() => setSetting("accent", color)}
                    />
                  ))}
                </div>
              </div>
              <SettingsToggle
                label="Window Transparency"
                name="window-transparency"
                hint="Requires compositor support"
                checked={settings.transparency}
                onChange={(value) => setSetting("transparency", value)}
              />
            </section>
          ) : null}
          {activeSection === "terminal" ? (
            <section className="settings-section">
              <div className="ss-title">Font & Text</div>
              <div className="ss-desc">Configure terminal typeface and rendering.</div>
              <div className="ss-row">
                <div className="ss-label">
                  <div className="ss-label-name">Font Size</div>
                  <div className="ss-label-hint">Terminal text size in pixels</div>
                </div>
                <div className="range-control">
                  <input name="terminal-font-size" type="range" min="10" max="20" value={settings.fontSize} onChange={(event) => setSetting("fontSize", Number(event.target.value))} />
                  <span>{settings.fontSize}px</span>
                </div>
              </div>
              <SettingsToggle
                label="Ligatures"
                name="terminal-ligatures"
                hint="Enable terminal programming ligatures"
                checked={settings.ligatures}
                onChange={(value) => setSetting("ligatures", value)}
              />
              <SettingsToggle
                label="Copy on Select"
                name="copy-on-select"
                hint="Auto-copy selected terminal text"
                checked={settings.copyOnSelect}
                onChange={(value) => setSetting("copyOnSelect", value)}
              />
              <div className="term-preview" style={{ fontSize: settings.fontSize }}>
                <span className="t-user">jason@Ubuntu</span><span className="t-sep">:</span><span className="t-path">~/projects</span><span className="t-prompt"> # </span><span className="t-cmd">ls -la</span>
                <br />
                <span className="t-muted">drwxr-xr-x 5 jason jason 4096 May 28 </span><span className="t-host">go-termflow/</span>
              </div>
            </section>
          ) : null}
          {activeSection === "ssh" ? (
            <section className="settings-section">
              <div className="ss-title">SSH Keys & Auth</div>
              <div className="ss-desc">Manage authentication and connection defaults.</div>
              <div className="ss-row">
                <div className="ss-label">
                  <div className="ss-label-name">Default Key Path</div>
                  <div className="ss-label-hint">Path to default SSH private key</div>
                </div>
                <input className="ss-input" name="default-key-path" value={settings.defaultKeyPath} onChange={(event) => setSetting("defaultKeyPath", event.target.value)} />
              </div>
              <SettingsToggle
                label="SSH Agent Forwarding"
                name="ssh-agent-forwarding"
                hint="Forward the local agent into remote sessions"
                checked={settings.sshAgent}
                onChange={(value) => setSetting("sshAgent", value)}
              />
            </section>
          ) : null}
          {activeSection === "transfer" || activeSection === "security" ? (
            <section className="settings-section">
              <div className="ss-title">{activeSection === "transfer" ? "File Transfer" : "Security"}</div>
              <div className="ss-desc">Reserved settings area from the UX prototype.</div>
              <div className="empty-state-inline">Settings coming soon</div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SettingsToggle({
  label,
  name,
  hint,
  checked,
  onChange,
}: {
  label: string;
  name: string;
  hint: string;
  checked: boolean;
  onChange(value: boolean): void;
}) {
  return (
    <div className="ss-row">
      <div className="ss-label">
        <div className="ss-label-name">{label}</div>
        <div className="ss-label-hint">{hint}</div>
      </div>
      <label className="toggle">
        <input name={name} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="toggle-track" />
        <span className="toggle-thumb" />
      </label>
    </div>
  );
}

function SecondaryView({
  view,
  activeSession,
  localFiles,
  remoteFiles,
  localPath,
  remotePath,
  transfers,
  monitorSnapshot,
  savedCommands,
  connections,
  appSettings,
  onRunCommand,
  onSaveSettings,
  onLocalUp,
  onRemoteUp,
  onLocalRefresh,
  onRemoteRefresh,
  onNewFile,
  onNewFolder,
  onUploadFolder,
  onOpenFolder,
  onOpenPath,
  onTransfer,
  onTransferMany,
  onEditFile,
  onRenameFile,
  onDeleteFile,
  onDeleteFiles,
  onDismissTransfer,
  onClearFinishedTransfers,
  onCreateSavedCommand,
  onEditSavedCommand,
  onDeleteSavedCommand,
  onToggleCommandPin,
}: {
  view: ViewId;
  activeSession: Session | null;
  localFiles: BackendFileEntry[];
  remoteFiles: BackendFileEntry[];
  localPath: string;
  remotePath: string;
  transfers: TransferRecord[];
  monitorSnapshot: MonitorSnapshot | null;
  savedCommands: SavedCommand[];
  connections: Connection[];
  appSettings: AppSettings;
  onRunCommand(command: string): void;
  onSaveSettings(settings: AppSettings): Promise<void> | void;
  onLocalUp(): void;
  onRemoteUp(): void;
  onLocalRefresh(): void;
  onRemoteRefresh(): void;
  onNewFile(side: "local" | "remote"): void;
  onNewFolder(side: "local" | "remote"): void;
  onUploadFolder(): void;
  onOpenFolder(side: "local" | "remote", entry: BackendFileEntry): void;
  onOpenPath(side: "local" | "remote", path: string): void;
  onTransfer(side: "local" | "remote", entry: BackendFileEntry): void;
  onTransferMany(side: "local" | "remote", entries: BackendFileEntry[]): void;
  onEditFile(side: "local" | "remote", entry: BackendFileEntry): void;
  onRenameFile(side: "local" | "remote", entry: BackendFileEntry): void;
  onDeleteFile(side: "local" | "remote", entry: BackendFileEntry): void;
  onDeleteFiles(side: "local" | "remote", entries: BackendFileEntry[]): void;
  onDismissTransfer(id: string): void;
  onClearFinishedTransfers(): void;
  onCreateSavedCommand(scopeKey: CommandScopeKey): void;
  onEditSavedCommand(command: SavedCommand): void;
  onDeleteSavedCommand(command: SavedCommand): void;
  onToggleCommandPin(command: SavedCommand): void;
}) {
  if (view === "files") {
    return (
      <FilesView
        activeSession={activeSession}
        localFiles={localFiles}
        remoteFiles={remoteFiles}
        localPath={localPath}
        remotePath={remotePath}
        transfers={transfers}
        onLocalUp={onLocalUp}
        onRemoteUp={onRemoteUp}
        onLocalRefresh={onLocalRefresh}
        onRemoteRefresh={onRemoteRefresh}
        onNewFile={onNewFile}
        onNewFolder={onNewFolder}
        onUploadFolder={onUploadFolder}
        onOpenFolder={onOpenFolder}
        onOpenPath={onOpenPath}
        onTransfer={onTransfer}
        onTransferMany={onTransferMany}
        onEdit={onEditFile}
        onRename={onRenameFile}
        onDelete={onDeleteFile}
        onDeleteMany={onDeleteFiles}
        onDismissTransfer={onDismissTransfer}
        onClearFinishedTransfers={onClearFinishedTransfers}
      />
    );
  }
  if (view === "monitor") {
    return <MonitorView snapshot={monitorSnapshot} />;
  }
  if (view === "commands") {
    return (
      <CommandsView
        savedCommands={savedCommands}
        connections={connections}
        onRun={onRunCommand}
        onCreate={onCreateSavedCommand}
        onEdit={onEditSavedCommand}
        onDelete={onDeleteSavedCommand}
        onTogglePin={onToggleCommandPin}
      />
    );
  }
  return <SettingsView appSettings={appSettings} onSave={onSaveSettings} />;
}

export default function App() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terminalBuffers, setTerminalBuffers] = useState<Record<string, string>>({});
  const [fullscreenTerminalSessions, setFullscreenTerminalSessions] = useState<Record<string, boolean>>({});
  const [savedCommands, setSavedCommands] = useState<SavedCommand[]>([]);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);
  const [commandHistoryQuery, setCommandHistoryQuery] = useState("");
  const [commandHistoryScope, setCommandHistoryScope] = useState<CommandHistoryScope>("host");
  const [localFiles, setLocalFiles] = useState<BackendFileEntry[]>([]);
  const [remoteFiles, setRemoteFiles] = useState<BackendFileEntry[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [fileEditor, setFileEditor] = useState<FileEditorState | null>(null);
  const [monitorSnapshot, setMonitorSnapshot] = useState<MonitorSnapshot | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [localPath, setLocalPath] = useState("/Users/delong/Work/go-termflow");
  const [remotePathBySession, setRemotePathBySession] = useState<Record<string, string>>({});
  const liveSessionIdsRef = useRef<Set<string>>(new Set());
  const pendingCwdSyncRef = useRef<PendingCwdSync | null>(null);
  const refreshRemoteFilesRef = useRef<(path?: string) => Promise<void>>(async () => {});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewId>("terminal");
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [terminalDock, setTerminalDock] = useState<TerminalDock>(null);
  const [terminalSmartOpen, setTerminalSmartOpen] = useState(false);
  const [terminalBroadcast, setTerminalBroadcast] = useState(false);
  const [terminalCommand, setTerminalCommand] = useState("");
  const [terminalCommandLog, setTerminalCommandLog] = useState<string[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [status, setStatus] = useState("Ready");
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [pendingDeleteConnection, setPendingDeleteConnection] = useState<Connection | null>(null);
  const [deletingConnectionId, setDeletingConnectionId] = useState<string | null>(null);
  const [pendingNewItem, setPendingNewItem] = useState<PendingNewItem | null>(null);
  const [pendingRenameItem, setPendingRenameItem] = useState<PendingRenameItem | null>(null);
  const [pendingFileDelete, setPendingFileDelete] = useState<PendingFileDelete | null>(null);
  const [commandEditor, setCommandEditor] = useState<CommandEditorRequest | null>(null);
  const [pendingCommandDelete, setPendingCommandDelete] = useState<SavedCommand | null>(null);
  const [deletingFiles, setDeletingFiles] = useState(false);
  const [deletingCommandId, setDeletingCommandId] = useState<string | null>(null);
  const [terminalSize, setTerminalSize] = useState<TerminalSize>(DEFAULT_TERMINAL_SIZE);
  const clock = useClock();

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );
  const activeConnection = useMemo(
    () =>
      activeSession
        ? connections.find((connection) => connection.id === activeSession.connectionId) ?? null
        : null,
    [activeSession, connections],
  );
  const remoteHomePath = defaultRemotePath(activeConnection);
  const remotePath = activeSession ? remotePathBySession[activeSession.id] ?? remoteHomePath : remoteHomePath;

  function setSessionRemotePath(sessionID: string, path: string) {
    const nextPath = normalizeRemotePath(path);
    setRemotePathBySession((current) => {
      if (current[sessionID] === nextPath) {
        return current;
      }
      return {
        ...current,
        [sessionID]: nextPath,
      };
    });
  }

  async function refreshConnectionsFromBackend() {
    if (!backendAvailable) {
      setConnections(DEMO_CONNECTIONS);
      setStatus("Offline preview");
      return;
    }
    try {
      const loaded = await listConnections();
      setConnections(sortConnections(loaded));
      setStatus(`Refreshed ${loaded.length} saved connections`);
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  async function refreshLocalFiles(path = localPath) {
    if (!backendAvailable) {
      setLocalFiles(DEMO_LOCAL_FILES);
      return;
    }
    try {
      const files = await listFiles({ side: "local", path });
      setLocalPath(path);
      setLocalFiles(files);
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  async function refreshRemoteFiles(path = remotePath) {
    const session = activeSession;
    if (!session) {
      setStatus("No active session");
      setRemoteFiles([]);
      return;
    }
    const nextPath = normalizeRemotePath(path);
    if (!backendAvailable) {
      setSessionRemotePath(session.id, nextPath);
      setRemoteFiles(demoRemoteFilesForPath(nextPath));
      setStatus(`Preview files: ${nextPath}`);
      return;
    }
    try {
      const files = await listFiles({ side: "remote", sessionId: session.id, path: nextPath });
      setSessionRemotePath(session.id, nextPath);
      setRemoteFiles(files);
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  async function syncRemoteFilesToTerminalCwd() {
    if (!activeSession) {
      setStatus("No active session");
      setRemoteFiles([]);
      return;
    }
    if (!backendAvailable) {
      await refreshRemoteFiles(remotePath);
      setStatus(`Preview files: ${remotePath}`);
      return;
    }

    if (pendingCwdSyncRef.current) {
      window.clearTimeout(pendingCwdSyncRef.current.timeoutId);
      pendingCwdSyncRef.current = null;
    }

    const sessionId = activeSession.id;
    const timeoutId = window.setTimeout(() => {
      if (pendingCwdSyncRef.current?.sessionId !== sessionId) {
        return;
      }
      pendingCwdSyncRef.current = null;
      setStatus("Could not read terminal working directory");
    }, 2500);

    pendingCwdSyncRef.current = { sessionId, output: "", timeoutId };
    setStatus("Syncing files with terminal path");
    try {
      await writeTerminal(sessionId, CWD_SYNC_COMMAND);
    } catch (error) {
      window.clearTimeout(timeoutId);
      if (pendingCwdSyncRef.current?.sessionId === sessionId) {
        pendingCwdSyncRef.current = null;
      }
      setStatus(messageFromError(error));
    }
  }

  useEffect(() => {
    refreshRemoteFilesRef.current = refreshRemoteFiles;
  });

  async function refreshCommandHistory(scope = commandHistoryScope) {
    if (!backendAvailable) {
      setCommandHistory([]);
      return;
    }
    if (scope === "host" && !activeSession) {
      setCommandHistory([]);
      return;
    }
    const filter: Parameters<typeof listCommandHistory>[0] =
      scope === "host" && activeSession
        ? { connectionId: activeSession.connectionId, limit: 200 }
        : { limit: 200 };
    const history = await listCommandHistory(filter);
    setCommandHistory(history);
  }

  async function refreshMonitorSnapshot() {
    if (!activeSession || !backendAvailable) {
      return;
    }
    try {
      setMonitorSnapshot(await getMonitorSnapshot(activeSession.id));
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  useEffect(() => {
    liveSessionIdsRef.current = new Set(sessions.map((session) => session.id));
  }, [sessions]);

  useEffect(() => {
    let cancelled = false;

    async function loadConnections() {
      try {
        const [loaded, commands, settings, loadedLocalFiles] = await Promise.all([
          listConnections(),
          listSavedCommands(),
          getSettings(),
          listFiles({ side: "local", path: localPath }),
        ]);
        if (cancelled) {
          return;
        }
        setConnections(sortConnections(loaded));
        setSavedCommands(commands);
        setAppSettings(settings);
        setTheme(settings.theme === "dark" ? "dark" : "light");
        setLocalFiles(loadedLocalFiles);
        setBackendAvailable(true);
        setStatus(loaded.length > 0 ? `Loaded ${loaded.length} saved connections` : "Ready");
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (isBackendUnavailable(error)) {
          setBackendAvailable(false);
          setConnections(DEMO_CONNECTIONS);
          setSessions(DEMO_SESSIONS);
          setTerminalBuffers(DEMO_BUFFERS);
          setSavedCommands([]);
          setLocalFiles(DEMO_LOCAL_FILES);
          setRemoteFiles(DEMO_REMOTE_FILES);
          setAppSettings(DEFAULT_APP_SETTINGS);
          setActiveSessionId("demo-123123");
          setStatus("Offline preview");
          return;
        }
        setStatus(messageFromError(error));
      }
    }

    void loadConnections();

    return () => {
      cancelled = true;
    };
  }, [localPath]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    const offOutput = onWailsEvent<SessionOutputEvent>(SESSION_OUTPUT_EVENT, (event) => {
      if (!liveSessionIdsRef.current.has(event.sessionId)) {
        return;
      }
      let terminalOutput = event.data;
      const pendingSync = pendingCwdSyncRef.current;
      if (pendingSync?.sessionId === event.sessionId) {
        const output = `${pendingSync.output}${event.data}`.slice(-4096);
        const syncedPath = extractSyncedWorkingDirectory(output);
        if (syncedPath) {
          window.clearTimeout(pendingSync.timeoutId);
          pendingCwdSyncRef.current = null;
          terminalOutput = cleanCwdSyncOutput(output);
          void refreshRemoteFilesRef.current(syncedPath).then(() => {
            setStatus(`Synced files to ${syncedPath}`);
          });
        } else {
          pendingCwdSyncRef.current = { ...pendingSync, output };
          return;
        }
      }
      if (!terminalOutput) {
        return;
      }
      setTerminalBuffers((current) => ({
        ...current,
        [event.sessionId]: appendTerminalData(current[event.sessionId] ?? "", terminalOutput),
      }));
    });

    const offStatus = onWailsEvent<SessionStatusEvent>(SESSION_STATUS_EVENT, (event) => {
      if (!liveSessionIdsRef.current.has(event.sessionId)) {
        return;
      }
      setSessions((current) =>
        current.map((session) =>
          session.id === event.sessionId
            ? { ...session, status: event.status, lastActiveAt: new Date().toISOString() }
            : session,
        ),
      );
      setTerminalBuffers((current) => ({
        ...current,
        [event.sessionId]: appendTerminalData(current[event.sessionId] ?? "", formatStatusLine(event)),
      }));
      setStatus(event.message ? `${event.status}: ${event.message}` : event.status);
    });

    const offError = onWailsEvent<SessionErrorEvent>(SESSION_ERROR_EVENT, (event) => {
      setStatus(event.message);
    });

    const offClosed = onWailsEvent<SessionClosedEvent>(SESSION_CLOSED_EVENT, (event) => {
      liveSessionIdsRef.current.delete(event.sessionId);
      if (pendingCwdSyncRef.current?.sessionId === event.sessionId) {
        window.clearTimeout(pendingCwdSyncRef.current.timeoutId);
        pendingCwdSyncRef.current = null;
      }
      setSessions((current) => current.filter((session) => session.id !== event.sessionId));
      setTerminalBuffers((current) => {
        const next = { ...current };
        delete next[event.sessionId];
        return next;
      });
      setFullscreenTerminalSessions((current) => {
        const next = { ...current };
        delete next[event.sessionId];
        return next;
      });
      setStatus(`Session closed: ${event.sessionId}`);
    });

    return () => {
      if (pendingCwdSyncRef.current) {
        window.clearTimeout(pendingCwdSyncRef.current.timeoutId);
        pendingCwdSyncRef.current = null;
      }
      offOutput();
      offStatus();
      offError();
      offClosed();
    };
  }, []);

  useEffect(() => {
    if (activeSessionId && sessions.some((session) => session.id === activeSessionId)) {
      return;
    }
    setActiveSessionId(sessions.find((session) => session.id === "demo-123123")?.id ?? sessions[0]?.id ?? null);
  }, [activeSessionId, sessions]);

  useEffect(() => {
    let cancelled = false;
    if (!activeSession) {
      setCommandHistory([]);
      setMonitorSnapshot(null);
      setRemoteFiles([]);
      return;
    }
    if (!backendAvailable) {
      setCommandHistory([]);
      setRemoteFiles(demoRemoteFilesForPath(remotePath));
      return;
    }
    const session = activeSession;

    async function loadSessionData() {
      try {
        const historyFilter: Parameters<typeof listCommandHistory>[0] =
          commandHistoryScope === "host"
            ? { connectionId: session.connectionId, limit: 200 }
            : { limit: 200 };
        const [history, files, snapshot] = await Promise.all([
          listCommandHistory(historyFilter),
          listFiles({ side: "remote", sessionId: session.id, path: remotePath }),
          getMonitorSnapshot(session.id),
        ]);
        if (cancelled) {
          return;
        }
        setCommandHistory(history);
        setRemoteFiles(files);
        setMonitorSnapshot(snapshot);
      } catch (error) {
        if (!cancelled) {
          setStatus(messageFromError(error));
        }
      }
    }

    void loadSessionData();
    const id = window.setInterval(() => {
      void getMonitorSnapshot(session.id)
        .then((snapshot) => {
          if (!cancelled) {
            setMonitorSnapshot(snapshot);
          }
        })
        .catch(() => {});
    }, 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeSession, backendAvailable, commandHistoryScope, remotePath]);

  async function handleSaveConnection(input: SaveConnectionInput) {
    if (!backendAvailable) {
      const saved: Connection = {
        ...input,
        id: input.id ?? `demo-${Date.now()}`,
        createdAt: DEMO_NOW,
        updatedAt: new Date().toISOString(),
      };
      setConnections((current) => {
        const exists = current.some((connection) => connection.id === saved.id);
        return sortConnections(
          exists
            ? current.map((connection) => (connection.id === saved.id ? saved : connection))
            : [...current, saved],
        );
      });
      setSessions((current) =>
        current.map((session) =>
          session.connectionId === saved.id ? { ...session, name: saved.name } : session,
        ),
      );
      setStatus(`${input.id ? "Updated" : "Saved"} preview connection: ${saved.name}`);
      setEditingConnection(null);
      setIsModalOpen(false);
      return;
    }

    try {
      const saved = await saveConnection(input);
      setConnections((current) => {
        const existingIndex = current.findIndex((connection) => connection.id === saved.id);
        const next =
          existingIndex >= 0
            ? current.map((connection) => (connection.id === saved.id ? saved : connection))
            : [...current, saved];
        return sortConnections(next);
      });
      setBackendAvailable(true);
      setStatus(`Saved connection: ${saved.name}`);
      setEditingConnection(null);
      setIsModalOpen(false);
    } catch (error) {
      if (isBackendUnavailable(error)) {
        setBackendAvailable(false);
        setStatus("Offline preview");
      } else {
        setStatus(messageFromError(error));
      }
      throw error;
    }
  }

  async function handleTrustHostKeyAndOpen(connection: Connection) {
    const trustedInput: SaveConnectionInput = {
      id: connection.id,
      name: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      authType: connection.authType,
      password: connection.password,
      keyPath: connection.keyPath,
      insecureIgnoreHostKey: true,
      group: connection.group,
      tags: connection.tags,
    };

    if (!backendAvailable) {
      const trusted = { ...connection, insecureIgnoreHostKey: true };
      setConnections((current) =>
        sortConnections(current.map((item) => (item.id === connection.id ? trusted : item))),
      );
      await handleOpenConnection(trusted, trusted.password, true);
      return;
    }

    try {
      setStatus(`Trusting host key for ${connection.name}`);
      const saved = await saveConnection(trustedInput);
      setConnections((current) =>
        sortConnections(current.map((item) => (item.id === saved.id ? saved : item))),
      );
      await handleOpenConnection(saved, saved.password, true);
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  async function confirmDeleteConnection(connection: Connection) {
    const removeConnection = () => {
      const removedSessionIds = new Set(
        sessions
          .filter((session) => session.connectionId === connection.id)
          .map((session) => session.id),
      );
      setConnections((current) => current.filter((item) => item.id !== connection.id));
      setSessions((current) => current.filter((session) => session.connectionId !== connection.id));
      setTerminalBuffers((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([sessionID]) => !removedSessionIds.has(sessionID)),
        ),
      );
      setFullscreenTerminalSessions((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([sessionID]) => !removedSessionIds.has(sessionID)),
        ),
      );
      setActiveSessionId((current) => {
        if (current && !removedSessionIds.has(current)) {
          return current;
        }
        const nextSession = sessions.find((session) => session.connectionId !== connection.id);
        return nextSession?.id ?? null;
      });
    };

    setDeletingConnectionId(connection.id);
    if (!backendAvailable) {
      removeConnection();
      setStatus(`Deleted preview connection: ${connection.name}`);
      setPendingDeleteConnection(null);
      setDeletingConnectionId(null);
      return;
    }

    try {
      const sessionsToClose = sessions.filter((session) => session.connectionId === connection.id);
      await Promise.all(sessionsToClose.map((session) => closeSession(session.id).catch(() => undefined)));
      await deleteConnection(connection.id);
      removeConnection();
      setStatus(`Deleted connection: ${connection.name}`);
      setPendingDeleteConnection(null);
      await refreshConnectionsFromBackend();
    } catch (error) {
      setStatus(messageFromError(error));
    } finally {
      setDeletingConnectionId((current) => (current === connection.id ? null : current));
    }
  }

  async function handleOpenConnection(
    connection: Connection,
    password: string,
    insecureIgnoreHostKey: boolean,
  ) {
    setStatus(`Connecting to ${connection.name}`);

    if (!backendAvailable) {
      const existing = sessions.find((session) => session.connectionId === connection.id);
      if (existing) {
        setActiveSessionId(existing.id);
        setActiveView("terminal");
        setStatus(`Preview session: ${connection.name}`);
        return;
      }
      const session: Session = {
        id: `demo-${connection.id}-${Date.now()}`,
        connectionId: connection.id,
        name: connection.name,
        status: "connected",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      setSessions((current) => [...current, session]);
      setTerminalBuffers((current) => ({
        ...current,
        [session.id]: DEMO_BUFFERS["demo-prod"].split("prod-01").join(connection.name),
      }));
      setActiveSessionId(session.id);
      setActiveView("terminal");
      setStatus(`Preview session: ${connection.name}`);
      return;
    }

    try {
      const session = await openSession({
        connectionId: connection.id,
        password,
        size: terminalSize,
        insecureIgnoreHostKey,
      });

      setTerminalBuffers((current) => ({ ...current, [session.id]: current[session.id] ?? "" }));
      liveSessionIdsRef.current = new Set([...liveSessionIdsRef.current, session.id]);
      setSessions((current) => [...current, session]);
      setActiveSessionId(session.id);
      setBackendAvailable(true);
      setStatus(`Connected to ${connection.name}`);
    } catch (error) {
      if (isBackendUnavailable(error)) {
        setBackendAvailable(false);
        setStatus("Offline preview");
      } else {
        setStatus(messageFromError(error));
      }
      throw error;
    }
  }

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
      return {
        ...current,
        [sessionId]: fullscreen,
      };
    });
  }

  function handleCloseSession(sessionId: string) {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) {
      return;
    }
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

    if (!backendAvailable) {
      setTerminalCommandLog((current) => [...current, trimmed]);
      setTerminalBuffers((current) => ({
        ...current,
        [activeSession.id]: appendTerminalData(
          current[activeSession.id] ?? "",
          `\r\n${terminalDisplayUser}@${terminalDisplayHost}:${terminalDisplayPath} # ${trimmed}\r\n`,
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
    if (!activeSession || !backendAvailable) {
      return;
    }
    try {
      await recordCommandHistory(activeSession.id, command);
      await refreshCommandHistory(commandHistoryScope);
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  async function handleSaveAppSettings(settings: AppSettings) {
    if (!backendAvailable) {
      setAppSettings(settings);
      setTheme(settings.theme === "dark" ? "dark" : "light");
      setStatus("Saved preview settings");
      return;
    }
    try {
      const saved = await saveSettings(settings);
      setAppSettings(saved);
      setTheme(saved.theme === "dark" ? "dark" : "light");
      setStatus("Settings saved");
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

  function sessionIDForSide(side: "local" | "remote"): string | undefined {
    return side === "remote" ? activeSession?.id : undefined;
  }

  function requireActiveRemoteSession(): string | null {
    if (!activeSession) {
      setStatus("Open an SSH session before using remote files");
      return null;
    }
    return activeSession.id;
  }

  function dismissTransfer(id: string) {
    setTransfers((current) => current.filter((transfer) => transfer.id !== id));
  }

  function clearFinishedTransfers() {
    setTransfers((current) => current.filter((transfer) => transfer.status === "running"));
  }

  async function runFileTransfer({
    sessionId,
    direction,
    name,
    localTarget,
    remoteTarget,
    refreshRemotePath,
  }: {
    sessionId: string;
    direction: "upload" | "download";
    name: string;
    localTarget: string;
    remoteTarget: string;
    refreshRemotePath?: string;
  }) {
    const transferId = `transfer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const detail = direction === "upload" ? `${localTarget} -> ${remoteTarget}` : `${remoteTarget} -> ${localTarget}`;
    const running: TransferRecord = {
      id: transferId,
      direction,
      name,
      detail,
      status: "running",
    };
    setTransfers((current) => [running, ...current].slice(0, 20));
    setStatus(`${direction === "upload" ? "Uploading" : "Downloading"} ${name}`);

    try {
      const result = await transferFile({
        sessionId,
        direction,
        localPath: localTarget,
        remotePath: remoteTarget,
        overwrite: true,
      });
      setTransfers((current) =>
        current.map((transfer) =>
          transfer.id === transferId
            ? {
                ...transfer,
                status: "done",
                bytes: result.bytesTransferred,
                completedAt: new Date().toISOString(),
              }
            : transfer,
        ),
      );
      setStatus(`${direction === "upload" ? "Uploaded" : "Downloaded"} ${name} (${formatBytes(result.bytesTransferred)})`);
      await Promise.all([
        refreshLocalFiles(),
        refreshRemoteFiles(refreshRemotePath ?? (direction === "upload" ? parentPath(remoteTarget) : remotePath)),
      ]);
    } catch (error) {
      const message = messageFromError(error);
      setTransfers((current) =>
        current.map((transfer) =>
          transfer.id === transferId
            ? { ...transfer, status: "failed", detail: message, completedAt: new Date().toISOString() }
            : transfer,
        ),
      );
      setStatus(message);
    }
  }

  async function transferEntry(side: "local" | "remote", entry: BackendFileEntry, sessionId: string) {
    const direction = side === "local" ? "upload" : "download";
    let localTarget = side === "local" ? entry.path : joinPath(localPath, entry.name);
    let remoteTarget = side === "local" ? joinPath(remotePath, entry.name) : entry.path;

    if (direction === "upload") {
      const destination = window.prompt("Upload to remote path", remoteTarget);
      if (!destination?.trim()) {
        return;
      }
      remoteTarget = destination.trim();
    } else if (entry.isDir) {
      let localParent = "";
      try {
        localParent = await selectLocalDirectory("Select local destination folder");
      } catch {
        localParent = window.prompt("Download folder into local directory", localPath) ?? "";
      }
      if (!localParent?.trim()) {
        return;
      }
      localTarget = joinPath(localParent.trim(), entry.name);
    } else {
      try {
        localTarget = await selectSaveFile(entry.name);
      } catch {
        localTarget = window.prompt("Download to local path", localTarget) ?? "";
      }
      if (!localTarget?.trim()) {
        return;
      }
      localTarget = localTarget.trim();
    }

    await runFileTransfer({
      sessionId,
      direction,
      name: entry.name,
      localTarget,
      remoteTarget,
      refreshRemotePath: direction === "upload" ? parentPath(remoteTarget) : remotePath,
    });
  }

  async function handleFileTransfer(side: "local" | "remote", entry: BackendFileEntry) {
    await handleFileTransfers(side, [entry]);
  }

  async function handleFileTransfers(side: "local" | "remote", entries: BackendFileEntry[]) {
    if (!backendAvailable) {
      setStatus("Transfer requires the Wails backend");
      return;
    }
    const sessionId = requireActiveRemoteSession();
    if (!sessionId) {
      return;
    }
    const selectedEntries = entries.filter(Boolean);
    if (selectedEntries.length === 0) {
      setStatus("Select files or folders to transfer");
      return;
    }
    if (selectedEntries.length > 1) {
      if (side === "local") {
        for (const entry of selectedEntries) {
          await runFileTransfer({
            sessionId,
            direction: "upload",
            name: entry.name,
            localTarget: entry.path,
            remoteTarget: joinPath(remotePath, entry.name),
            refreshRemotePath: remotePath,
          });
        }
        return;
      }

      let localParent = "";
      try {
        localParent = await selectLocalDirectory("Select local destination folder");
      } catch {
        localParent = window.prompt("Download selected items into local directory", localPath) ?? "";
      }
      if (!localParent?.trim()) {
        return;
      }
      for (const entry of selectedEntries) {
        await runFileTransfer({
          sessionId,
          direction: "download",
          name: entry.name,
          localTarget: joinPath(localParent.trim(), entry.name),
          remoteTarget: entry.path,
          refreshRemotePath: remotePath,
        });
      }
      return;
    }
    for (const entry of selectedEntries) {
      await transferEntry(side, entry, sessionId);
    }
  }

  async function handleUploadToRemoteDirectory() {
    if (!backendAvailable) {
      setStatus("Upload requires the Wails backend");
      return;
    }
    const sessionId = requireActiveRemoteSession();
    if (!sessionId) {
      return;
    }

    let localSources: string[] = [];
    try {
      localSources = await selectLocalFiles();
    } catch {
      const localSource = await selectLocalFile().catch(() => window.prompt("Local file to upload", localPath) ?? "");
      localSources = localSource ? [localSource] : [];
    }
    const cleanSources = localSources.map((source) => source.trim()).filter(Boolean);
    if (cleanSources.length === 0) {
      return;
    }
    for (const localSource of cleanSources) {
      const name = baseName(localSource);
      if (!name) {
        setStatus("Choose a local file path to upload");
        continue;
      }
      await runFileTransfer({
        sessionId,
        direction: "upload",
        name,
        localTarget: localSource,
        remoteTarget: joinPath(remotePath, name),
        refreshRemotePath: remotePath,
      });
    }
  }

  async function handleUploadFolderToRemoteDirectory() {
    if (!backendAvailable) {
      setStatus("Upload requires the Wails backend");
      return;
    }
    const sessionId = requireActiveRemoteSession();
    if (!sessionId) {
      return;
    }
    let localSource = "";
    try {
      localSource = await selectLocalDirectory("Select local folder to upload");
    } catch {
      localSource = window.prompt("Local folder to upload", localPath) ?? "";
    }
    if (!localSource?.trim()) {
      return;
    }
    const cleanSource = localSource.trim();
    const name = baseName(cleanSource);
    if (!name) {
      setStatus("Choose a local folder path to upload");
      return;
    }
    await runFileTransfer({
      sessionId,
      direction: "upload",
      name,
      localTarget: cleanSource,
      remoteTarget: joinPath(remotePath, name),
      refreshRemotePath: remotePath,
    });
  }

  function handleNewFile(side: "local" | "remote") {
    setPendingNewItem({ side, kind: "file", name: "", error: null, saving: false });
  }

  function handleNewFolder(side: "local" | "remote") {
    setPendingNewItem({ side, kind: "folder", name: "", error: null, saving: false });
  }

  async function confirmCreateNewItem(item: PendingNewItem) {
    const cleanName = item.name.trim();
    if (!cleanName) {
      setPendingNewItem((current) => current ? { ...current, error: "Name is required" } : current);
      return;
    }
    if (!backendAvailable) {
      const label = item.kind === "file" ? "File" : "Folder";
      setPendingNewItem((current) => current ? { ...current, error: `${label} creation requires the Wails backend` } : current);
      setStatus(`${label} creation requires the Wails backend`);
      return;
    }

    let sessionId: string | undefined;
    if (item.side === "remote") {
      const remoteSessionId = requireActiveRemoteSession();
      if (!remoteSessionId) {
        return;
      }
      sessionId = remoteSessionId;
    }

    const existingFiles = item.side === "local" ? localFiles : remoteFiles;
    if (existingFiles.some((file) => file.name === cleanName)) {
      setPendingNewItem((current) => current ? { ...current, error: `${cleanName} already exists` } : current);
      return;
    }

    const target = joinPath(item.side === "local" ? localPath : remotePath, cleanName);
    setPendingNewItem((current) => current ? { ...current, error: null, saving: true } : current);
    try {
      if (item.kind === "file") {
        await saveFile({ side: item.side, sessionId, path: target, content: "" });
        setFileEditor({
          side: item.side,
          path: target,
          name: cleanName,
          language: "text",
          originalContent: "",
          content: "",
          isBinary: false,
          saving: false,
        });
      } else {
        await createFolder({ side: item.side, sessionId, path: target });
      }
      setStatus(`Created ${item.side} ${item.kind}: ${target}`);
      setPendingNewItem(null);
      if (item.side === "local") {
        await refreshLocalFiles();
      } else {
        await refreshRemoteFiles();
      }
    } catch (error) {
      const message = messageFromError(error);
      setPendingNewItem((current) => current ? { ...current, error: message, saving: false } : current);
      setStatus(message);
    }
  }

  async function handleEditFile(side: "local" | "remote", entry: BackendFileEntry) {
    if (entry.isDir) {
      return;
    }
    if (!backendAvailable) {
      setStatus("Editing requires the Wails backend");
      return;
    }
    let sessionId: string | undefined;
    if (side === "remote") {
      const remoteSessionId = requireActiveRemoteSession();
      if (!remoteSessionId) {
        return;
      }
      sessionId = remoteSessionId;
    }
    try {
      const content: FileContent = await readFile({ side, sessionId, path: entry.path });
      setFileEditor({
        side,
        path: content.path,
        name: content.name,
        language: content.language || "text",
        originalContent: content.content,
        content: content.content,
        isBinary: content.isBinary,
        saving: false,
      });
      setStatus(`Opened ${entry.name}`);
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  function handleRenameFile(side: "local" | "remote", entry: BackendFileEntry) {
    setPendingRenameItem({ side, entry, name: entry.name, error: null, saving: false });
  }

  async function confirmRenameItem(item: PendingRenameItem) {
    const nextName = item.name.trim();
    if (!nextName) {
      setPendingRenameItem((current) => current ? { ...current, error: "Name is required" } : current);
      return;
    }
    if (nextName === item.entry.name) {
      setPendingRenameItem(null);
      return;
    }
    if (!backendAvailable) {
      setPendingRenameItem((current) => current ? { ...current, error: "Rename requires the Wails backend" } : current);
      setStatus("Rename requires the Wails backend");
      return;
    }

    let sessionId: string | undefined;
    if (item.side === "remote") {
      const remoteSessionId = requireActiveRemoteSession();
      if (!remoteSessionId) {
        return;
      }
      sessionId = remoteSessionId;
    }

    const existingFiles = item.side === "local" ? localFiles : remoteFiles;
    if (existingFiles.some((file) => file.path !== item.entry.path && file.name === nextName)) {
      setPendingRenameItem((current) => current ? { ...current, error: `${nextName} already exists` } : current);
      return;
    }

    const newPath = joinPath(parentPath(item.entry.path), nextName);
    setPendingRenameItem((current) => current ? { ...current, error: null, saving: true } : current);
    try {
      await renameFile({ side: item.side, sessionId, path: item.entry.path, newPath });
      setStatus(`Renamed ${item.entry.name} to ${nextName}`);
      setPendingRenameItem(null);
      if (item.side === "local") {
        await refreshLocalFiles();
      } else {
        await refreshRemoteFiles();
      }
    } catch (error) {
      const message = messageFromError(error);
      setPendingRenameItem((current) => current ? { ...current, error: message, saving: false } : current);
      setStatus(message);
    }
  }

  async function handleDeleteFile(side: "local" | "remote", entry: BackendFileEntry) {
    await handleDeleteFiles(side, [entry]);
  }

  async function handleDeleteFiles(side: "local" | "remote", entries: BackendFileEntry[]) {
    const selectedEntries = entries.filter(Boolean);
    if (selectedEntries.length === 0) {
      setStatus("Select files or folders to delete");
      return;
    }
    setPendingFileDelete({ side, entries: selectedEntries });
  }

  async function confirmDeleteFiles(pendingDelete: PendingFileDelete) {
    const { side, entries } = pendingDelete;
    if (!backendAvailable) {
      setStatus("Delete requires the Wails backend");
      setPendingFileDelete(null);
      return;
    }
    let sessionId: string | undefined;
    if (side === "remote") {
      const remoteSessionId = requireActiveRemoteSession();
      if (!remoteSessionId) {
        return;
      }
      sessionId = remoteSessionId;
    }
    setDeletingFiles(true);
    try {
      for (const entry of entries) {
        await deleteFile({ side, sessionId, path: entry.path });
      }
      setStatus(entries.length === 1 ? `Deleted ${entries[0].name}` : `Deleted ${entries.length} ${side} items`);
      setPendingFileDelete(null);
      if (side === "local") {
        await refreshLocalFiles();
      } else {
        await refreshRemoteFiles();
      }
    } catch (error) {
      setStatus(messageFromError(error));
    } finally {
      setDeletingFiles(false);
    }
  }

  async function handleSaveEditedFile() {
    if (!fileEditor || fileEditor.isBinary) {
      return;
    }
    if (!backendAvailable) {
      setStatus("Saving requires the Wails backend");
      return;
    }
    let sessionId: string | undefined;
    if (fileEditor.side === "remote") {
      const remoteSessionId = requireActiveRemoteSession();
      if (!remoteSessionId) {
        return;
      }
      sessionId = remoteSessionId;
    }
    setFileEditor((current) => current ? { ...current, saving: true } : current);
    try {
      await saveFile({
        side: fileEditor.side,
        sessionId,
        path: fileEditor.path,
        content: fileEditor.content,
      });
      setFileEditor((current) =>
        current ? { ...current, originalContent: current.content, saving: false } : current,
      );
      setStatus(`Saved ${fileEditor.name}`);
      if (fileEditor.side === "local") {
        await refreshLocalFiles();
      } else {
        await refreshRemoteFiles();
      }
    } catch (error) {
      setFileEditor((current) => current ? { ...current, saving: false } : current);
      setStatus(messageFromError(error));
    }
  }

  function handleCloseEditor() {
    if (fileEditor && fileEditor.content !== fileEditor.originalContent && !window.confirm("Discard unsaved file changes?")) {
      return;
    }
    setFileEditor(null);
  }

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
    const saved = await saveSavedCommand(input);
    setSavedCommands((current) => {
      const existingIndex = current.findIndex((item) => item.id === saved.id);
      const next = existingIndex >= 0
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved];
      return next.sort((left, right) => left.name.localeCompare(right.name));
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
    const activeConnectionForCommand = activeConnection?.id ?? connections[0]?.id ?? "";
    const nextTags = hasGlobal
      ? commandScopeTags(command.tags, "connection", activeConnectionForCommand, command.tags.includes("danger"))
      : commandScopeTags(command.tags, "global", "", command.tags.includes("danger"));
    const input = {
      id: command.id,
      name: command.name,
      command: command.command,
      description: command.description,
      tags: nextTags,
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

  const paletteItems = [
    {
      label: "New connection",
      sub: "Add an SSH host",
      action: () => {
        setEditingConnection(null);
        setIsModalOpen(true);
      },
    },
    ...connections.map((connection) => ({
      label: `Connect ${connection.name}`,
      sub: `${connection.username}@${connection.host}:${connection.port}`,
      action: () => void handleOpenConnection(connection, "", false),
    })),
    ...savedCommands.map((command) => ({
      label: command.name,
      sub: command.command,
      action: () => void handleRunTerminalCommand(command.command),
    })),
    ...NAV_ITEMS.map((item) => ({
      label: item.label,
      sub: "Navigate",
      action: () => setActiveView(item.id),
    })),
  ];
  const filteredPaletteItems = paletteItems.filter((item) => {
    const query = paletteQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return `${item.label} ${item.sub}`.toLowerCase().includes(query);
  });
  const terminalIsProd = isProductionConnection(activeConnection);
  const terminalDisplayUser = terminalUser(activeConnection);
  const terminalDisplayHost = terminalHost(activeConnection, activeSession);
  const terminalDisplayPath = terminalDock === "files" ? remotePath : terminalPath(activeConnection);
  const activeTerminalBuffer = activeSession ? terminalBuffers[activeSession.id] ?? "" : "";
  const activeTerminalFullscreen = activeSession ? fullscreenTerminalSessions[activeSession.id] === true : false;
  const terminalLayoutKey = [
    activeSession?.id ?? "none",
    activeTerminalFullscreen ? "fullscreen" : "shell",
    terminalDock ?? "none",
    terminalSmartOpen && !activeTerminalFullscreen ? "smart" : "no-smart",
    terminalBroadcast && !activeTerminalFullscreen ? "broadcast" : "no-broadcast",
  ].join(":");
  const terminalCPU = monitorSnapshot?.cpuPercent ?? 0;
  const terminalMemory = monitorSnapshot?.memoryPercent ?? 0;
  const hideStatusBar = activeView === "terminal" && activeTerminalFullscreen;
  const showConnectionSidebar = activeView !== "commands" && activeView !== "settings";
  return (
    <div className="app" data-theme={theme}>
      <header className="titlebar">
        <div className="tb-brand">
          <span className="tb-logo">
            <Icon name="terminal" size={14} />
          </span>
          TermFlow
        </div>
        <div className="tb-tabs">
          {sessions.length === 0 ? (
            <span className="tb-tab muted">No active session</span>
          ) : (
            sessions.map((session) => {
              const connection = sessionConnection(session, connections);
              const badge = sessionBadge(connection);
              const isProd = badge === "PROD";

              return (
                <button
                  className={`tb-tab${session.id === activeSessionId ? " active" : ""}`}
                  key={session.id}
                  type="button"
                  onClick={() => setActiveSessionId(session.id)}
                  title={`${session.name} (${session.status})`}
                >
                  <span className={`tab-dot ${session.status === "connected" ? "on" : "off"}${isProd ? " prod" : ""}`} />
                  <span className="tab-name">{session.name}</span>
                  <span className={`tab-type ${badge.toLowerCase()}`}>{badge}</span>
                  <span
                    className="tab-close"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCloseSession(session.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.stopPropagation();
                        handleCloseSession(session.id);
                      }
                    }}
                  >
                    ×
                  </span>
                </button>
              );
            })
          )}
          <button
            className="tb-add"
            type="button"
            onClick={() => {
              setEditingConnection(null);
              setIsModalOpen(true);
            }}
            title="New connection"
          >
            <Icon name="plus" size={13} />
          </button>
        </div>
        <div className="tb-right">
          <button className="tb-command" type="button" title="Command palette" onClick={() => setPaletteOpen(true)}>
            <Icon name="search" size={12} />
            <span className="tb-kbd">⌘K</span>
          </button>
          <span className="tb-time">{clock}</span>
          <button
            className="tb-icon-btn"
            type="button"
            title="Theme"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          >
            <Icon name={theme === "dark" ? "moon" : "settings"} size={14} />
          </button>
          <button className="tb-icon-btn" type="button" title="Notifications">
            <Icon name="bell" size={14} />
          </button>
          <button className="tb-icon-btn" type="button" title="Account">
            <Icon name="user" size={14} />
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="actbar" aria-label="Primary navigation">
          <button
            className={`act-btn${sidebarCollapsed ? "" : " active-secondary"}`}
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? "Show connections sidebar" : "Hide connections sidebar"}
            title={sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
          >
            <Icon name="sidebar" size={18} />
          </button>
          {NAV_ITEMS.filter((item) => item.id !== "settings").map((item) => (
            <button
              key={item.id}
              className={`act-btn${activeView === item.id ? " active" : ""}`}
              type="button"
              onClick={() => setActiveView(item.id)}
              aria-label={item.label}
              title={item.label}
            >
              <Icon name={item.icon} size={18} />
            </button>
          ))}
          <div className="act-spacer" />
          <button
            className={`act-btn${activeView === "settings" ? " active" : ""}`}
            type="button"
            onClick={() => setActiveView("settings")}
            aria-label="Settings"
            title="Settings"
          >
            <Icon name="settings" size={18} />
          </button>
          <button className="act-btn" type="button" aria-label="Account" title="Account">
            <Icon name="user" size={18} />
          </button>
        </aside>

        {showConnectionSidebar ? (
          <ConnectionSidebar
            connections={connections}
            activeConnectionId={activeConnection?.id ?? null}
            collapsed={sidebarCollapsed}
            connectedConnectionIds={sessions
              .filter((session) => session.status === "connected")
              .map((session) => session.connectionId)}
            onCreate={() => {
              setEditingConnection(null);
              setPendingDeleteConnection(null);
              setIsModalOpen(true);
            }}
            onEdit={(connection) => {
              setEditingConnection(connection);
              setPendingDeleteConnection(null);
              setIsModalOpen(true);
            }}
            onDelete={(connection) => {
              setEditingConnection(null);
              setIsModalOpen(false);
              setPendingDeleteConnection(connection);
            }}
            onOpen={handleOpenConnection}
            onTrustHostKey={(connection) => void handleTrustHostKeyAndOpen(connection)}
            onRefresh={() => void refreshConnectionsFromBackend()}
          />
        ) : null}

        <main className="main-pane">
          {activeView === "terminal" ? (
            <section className="term-pane">
              <div className="term-toolbar">
                <div className="tt-host tt-host-compact">
                  <span className={`dot${terminalIsProd ? " prod" : ""}`} />
                  <span className="tt-crumb">{terminalDisplayPath}</span>
                </div>
                <div className="tt-spacer" />
                {!terminalDock ? (
                  <div className="tt-vitals" aria-label="Session vitals">
                    <button className={`tt-vital ${metricTone(terminalCPU)} cpu`} type="button" onClick={() => setTerminalDock("monitor")}>
                      <span className="tt-vital-k">CPU</span>
                      <span className="tt-vital-v">{terminalCPU}%</span>
                      <span className="tt-spark" aria-hidden="true">
                        {Array.from({ length: 16 }).map((_, index) => (
                          <span key={index} style={{ height: `${8 + ((index * 5 + terminalCPU) % 16)}px` }} />
                        ))}
                      </span>
                    </button>
                    <button className={`tt-vital ${metricTone(terminalMemory)} mem`} type="button" onClick={() => setTerminalDock("monitor")}>
                      <span className="tt-vital-k">MEM</span>
                      <span className="tt-vital-v">{terminalMemory}%</span>
                    </button>
                  </div>
                ) : null}
                <button
                  className="tt-vital power"
                  type="button"
                  aria-label="Power"
                  title="Close active session"
                  onClick={() => activeSession && handleCloseSession(activeSession.id)}
                >
                  ⏻
                </button>
                <button
                  className={`tt-btn${terminalDock === "monitor" ? " active" : ""}`}
                  type="button"
                  onClick={() => setTerminalDock((current) => (current === "monitor" ? null : "monitor"))}
                >
                  <Icon name="monitor" size={12} />
                  Monitor
                </button>
                <button
                  className={`tt-btn${terminalDock === "files" ? " active" : ""}`}
                  type="button"
                  onClick={() => {
                    setTerminalDock((current) => (current === "files" ? null : "files"));
                    if (terminalDock !== "files") {
                      void refreshRemoteFiles();
                    }
                  }}
                >
                  <Icon name="files" size={12} />
                  Files
                </button>
                <button
                  className={`tt-btn${terminalDock === "history" ? " active" : ""}`}
                  type="button"
                  onClick={() => {
                    setTerminalDock((current) => (current === "history" ? null : "history"));
                    if (terminalDock !== "history") {
                      void refreshCommandHistory(commandHistoryScope);
                    }
                  }}
                >
                  <Icon name="list" size={12} />
                  History
                </button>
              </div>
              <div className="terminal-stage terminal-stage-alerts">
                <TerminalPane
                  session={activeSession}
                  terminalBuffer={activeTerminalBuffer}
                  themeMode={theme}
                  layoutKey={terminalLayoutKey}
                  onTerminalSizeChange={handleTerminalSizeChange}
                  onFullscreenChange={handleTerminalFullscreenChange}
                  onCommandCommit={(command) => void handleTerminalCommandCommit(command)}
                />
                {terminalDock === "monitor" ? (
                  <TerminalMonitorDock
                    host={terminalDisplayHost}
                    user={terminalDisplayUser}
                    snapshot={monitorSnapshot}
                    onFullView={() => {
                      setTerminalDock(null);
                      setActiveView("monitor");
                      void refreshMonitorSnapshot();
                    }}
                    onClose={() => setTerminalDock(null)}
                  />
                ) : null}
                {terminalDock === "files" ? (
                  <TerminalFilesDock
                    files={remoteFiles}
                    path={remotePath}
                    hasSession={Boolean(activeSession)}
                    transfers={transfers}
                    onRunCommand={(command) => void handleRunTerminalCommand(command)}
                    onOpenFolder={(entry) => void refreshRemoteFiles(entry.path)}
                    onOpenPath={(path) => void refreshRemoteFiles(path)}
                    onRefresh={() => void syncRemoteFilesToTerminalCwd()}
                    onUpload={() => void handleUploadToRemoteDirectory()}
                    onUploadFolder={() => void handleUploadFolderToRemoteDirectory()}
                    onNewFile={() => void handleNewFile("remote")}
                    onNewFolder={() => void handleNewFolder("remote")}
                    onTransfer={(entry) => handleFileTransfer("remote", entry)}
                    onEdit={(entry) => void handleEditFile("remote", entry)}
                    onRename={(entry) => void handleRenameFile("remote", entry)}
                    onDelete={(entry) => void handleDeleteFile("remote", entry)}
                    onDismissTransfer={dismissTransfer}
                    onClearFinishedTransfers={clearFinishedTransfers}
                    onClose={() => setTerminalDock(null)}
                  />
                ) : null}
                {terminalDock === "history" ? (
                  <TerminalHistoryDock
                    host={terminalDisplayHost}
                    history={commandHistory}
                    query={commandHistoryQuery}
                    scope={commandHistoryScope}
                    onQueryChange={setCommandHistoryQuery}
                    onScopeChange={(scope) => {
                      setCommandHistoryScope(scope);
                      void refreshCommandHistory(scope);
                    }}
                    onRunCommand={(command) => void handleRunTerminalCommand(command)}
                    onClear={() => void handleClearActiveHistory()}
                    onClose={() => setTerminalDock(null)}
                  />
                ) : null}
              </div>
              {terminalSmartOpen && !activeTerminalFullscreen ? (
                <TerminalSmartBar
                  savedCommands={savedCommands}
                  connectionId={activeConnection?.id ?? null}
                  onClose={() => setTerminalSmartOpen(false)}
                  onPick={(command) => {
                    setTerminalCommand(command);
                    setTerminalSmartOpen(false);
                  }}
                />
              ) : null}
              {terminalBroadcast && !activeTerminalFullscreen ? (
                <div className="bcast-banner">
                  <Icon name="network" size={12} />
                  Broadcasting — Enter sends this command to {sessions.filter((session) => session.status === "connected").length} connected sessions
                  <button type="button" onClick={() => setTerminalBroadcast(false)}>turn off</button>
                </div>
              ) : null}
              {!activeTerminalFullscreen ? (
                <div className="term-input-row">
                  <span className="term-prompt-label">
                    <span className="t-user">{terminalDisplayUser}</span>
                    <span className="t-muted">@</span>
                    <span className="t-host">{terminalDisplayHost}</span>
                    <span className="t-muted">:</span>
                    <span className="t-path">{terminalDisplayPath}</span>
                    <span className="t-prompt"> # </span>
                  </span>
                  <input
                    className="term-input"
                    name="terminal-command"
                    aria-label="Command input"
                    autoComplete="off"
                    spellCheck={false}
                    value={terminalCommand}
                    onChange={(event) => setTerminalCommand(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") {
                        return;
                      }
                      const command = terminalCommand.trim();
                      if (!command) {
                        return;
                      }
                      void handleRunTerminalCommand(command);
                    }}
                  />
                  <button
                    className={`tir-btn${terminalSmartOpen ? " active" : ""}`}
                    type="button"
                    title="Smart suggestions (⌘J)"
                    onClick={() => setTerminalSmartOpen((current) => !current)}
                  >
                    <Icon name="zap" size={14} />
                  </button>
                  <button
                    className={`tir-btn${terminalBroadcast ? " active bcast" : ""}`}
                    type="button"
                    title="Broadcast input to all connected sessions"
                    onClick={() => setTerminalBroadcast((current) => !current)}
                  >
                    <Icon name="network" size={14} />
                    {terminalBroadcast ? <span className="tir-lab">ALL</span> : null}
                  </button>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="placeholder-view">
              <SecondaryView
                view={activeView}
                activeSession={activeSession}
                localFiles={localFiles}
                remoteFiles={remoteFiles}
                localPath={localPath}
                remotePath={remotePath}
                transfers={transfers}
                monitorSnapshot={monitorSnapshot}
                savedCommands={savedCommands}
                connections={connections}
                appSettings={appSettings}
                onRunCommand={(command) => void handleRunTerminalCommand(command)}
                onSaveSettings={handleSaveAppSettings}
                onLocalUp={() => void refreshLocalFiles(parentPath(localPath))}
                onRemoteUp={() => void refreshRemoteFiles(parentPath(remotePath))}
                onLocalRefresh={() => void refreshLocalFiles()}
                onRemoteRefresh={() => void refreshRemoteFiles()}
                onNewFile={(side) => void handleNewFile(side)}
                onNewFolder={(side) => void handleNewFolder(side)}
                onUploadFolder={() => void handleUploadFolderToRemoteDirectory()}
                onOpenFolder={(side, entry) => {
                  if (!entry.isDir) {
                    return;
                  }
                  void (side === "local" ? refreshLocalFiles(entry.path) : refreshRemoteFiles(entry.path));
                }}
                onOpenPath={(side, path) => void (side === "local" ? refreshLocalFiles(path) : refreshRemoteFiles(path))}
                onTransfer={handleFileTransfer}
                onTransferMany={(side, entries) => void handleFileTransfers(side, entries)}
                onEditFile={(side, entry) => void handleEditFile(side, entry)}
                onRenameFile={(side, entry) => void handleRenameFile(side, entry)}
                onDeleteFile={(side, entry) => void handleDeleteFile(side, entry)}
                onDeleteFiles={(side, entries) => void handleDeleteFiles(side, entries)}
                onDismissTransfer={dismissTransfer}
                onClearFinishedTransfers={clearFinishedTransfers}
                onCreateSavedCommand={handleCreateSavedCommand}
                onEditSavedCommand={handleEditSavedCommand}
                onDeleteSavedCommand={handleDeleteSavedCommand}
                onToggleCommandPin={(command) => void handleToggleCommandPin(command)}
              />
            </section>
          )}
        </main>
      </div>

      {!hideStatusBar ? (
        <StatusBar
          status={status}
          sessions={sessions}
          activeSession={activeSession}
          activeConnection={activeConnection}
          backendAvailable={backendAvailable}
        />
      ) : null}

      {isModalOpen ? (
        <ConnectionModal
          initialConnection={editingConnection}
          onCancel={() => {
            setEditingConnection(null);
            setIsModalOpen(false);
          }}
          onSave={handleSaveConnection}
        />
      ) : null}
      {pendingDeleteConnection ? (
        <DeleteConnectionConfirm
          connection={pendingDeleteConnection}
          deleting={deletingConnectionId === pendingDeleteConnection.id}
          onCancel={() => setPendingDeleteConnection(null)}
          onConfirm={() => void confirmDeleteConnection(pendingDeleteConnection)}
        />
      ) : null}
      {pendingFileDelete ? (
        <FileDeleteConfirm
          pendingDelete={pendingFileDelete}
          deleting={deletingFiles}
          onCancel={() => setPendingFileDelete(null)}
          onConfirm={() => void confirmDeleteFiles(pendingFileDelete)}
        />
      ) : null}
      {pendingNewItem ? (
        <NewFileItemModal
          pendingItem={pendingNewItem}
          basePath={pendingNewItem.side === "local" ? localPath : remotePath}
          onChangeName={(name) =>
            setPendingNewItem((current) => current ? { ...current, name, error: null } : current)
          }
          onCancel={() => setPendingNewItem(null)}
          onConfirm={() => void confirmCreateNewItem(pendingNewItem)}
        />
      ) : null}
      {pendingRenameItem ? (
        <RenameFileItemModal
          pendingItem={pendingRenameItem}
          onChangeName={(name) =>
            setPendingRenameItem((current) => current ? { ...current, name, error: null } : current)
          }
          onCancel={() => setPendingRenameItem(null)}
          onConfirm={() => void confirmRenameItem(pendingRenameItem)}
        />
      ) : null}
      {commandEditor ? (
        <CommandEditorModal
          request={commandEditor}
          connections={connections}
          onCancel={() => setCommandEditor(null)}
          onSave={handleSaveCommandEditor}
        />
      ) : null}
      {pendingCommandDelete ? (
        <CommandDeleteConfirm
          command={pendingCommandDelete}
          deleting={deletingCommandId === pendingCommandDelete.id}
          onCancel={() => setPendingCommandDelete(null)}
          onConfirm={() => void confirmDeleteSavedCommand(pendingCommandDelete)}
        />
      ) : null}
      {fileEditor ? (
        <FileEditorModal
          editor={fileEditor}
          onChange={(content) => setFileEditor((current) => current ? { ...current, content } : current)}
          onClose={handleCloseEditor}
          onSave={() => void handleSaveEditedFile()}
        />
      ) : null}
      {paletteOpen ? (
        <div
          className="tf-overlay"
          role="presentation"
          onMouseDown={() => {
            setPaletteOpen(false);
            setPaletteQuery("");
          }}
        >
          <div className="palette-card" onMouseDown={(event) => event.stopPropagation()}>
            <div className="pal-search">
              <Icon name="search" size={17} />
              <input
                className="pal-input"
                name="command-palette-search"
                autoFocus
                value={paletteQuery}
                placeholder="Search connections, commands, views..."
                onChange={(event) => setPaletteQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setPaletteOpen(false);
                    setPaletteQuery("");
                  }
                  if (event.key === "Enter" && filteredPaletteItems[0]) {
                    setPaletteOpen(false);
                    setPaletteQuery("");
                    filteredPaletteItems[0].action();
                  }
                }}
              />
              <span className="pal-kbd">ESC</span>
            </div>
            <div className="pal-list">
              <div className="pal-section">Actions</div>
              {filteredPaletteItems.map((item) => (
                <button
                  className="pal-item"
                  type="button"
                  key={`${item.label}-${item.sub}`}
                  onClick={() => {
                    setPaletteOpen(false);
                    setPaletteQuery("");
                    item.action();
                  }}
                >
                  <span className="pal-item-icon"><Icon name="terminal" size={14} /></span>
                  <span className="pal-item-main">
                    <span className="pal-item-title">{item.label}</span>
                    <span className="pal-item-sub">{item.sub}</span>
                  </span>
                  <span className="pal-enter">enter</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
