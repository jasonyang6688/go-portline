import { useEffect, useMemo, useRef, useState } from "react";
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
  getMonitorSnapshot,
  getSettings,
  listCommandHistory,
  openSession,
  listFiles,
  listConnections,
  listSavedCommands,
  onWailsEvent,
  readFile,
  renameFile,
  runCommand,
  saveConnection,
  saveFile,
  saveSavedCommand,
  saveSettings,
  transferFile,
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
    keyPath: "",
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
    keyPath: "~/.ssh/id_ed25519",
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
    keyPath: "",
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
    keyPath: "",
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
    keyPath: "~/.ssh/id_ed25519",
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
    keyPath: "",
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
    keyPath: "",
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
  return `'${value.replaceAll("'", "'\\''")}'`;
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

function joinPath(base: string, name: string): string {
  return `${base.replace(/\/+$/, "")}/${name.replace(/^\/+/, "")}`;
}

const DEMO_LOCAL_FILES: BackendFileEntry[] = [
  { name: "frontend", path: "/Projects/go-termflow/frontend", size: 0, sizeLabel: "--", modTime: DEMO_NOW, isDir: true },
  { name: "internal", path: "/Projects/go-termflow/internal", size: 0, sizeLabel: "--", modTime: DEMO_NOW, isDir: true },
  { name: "main.go", path: "/Projects/go-termflow/main.go", size: 1200, sizeLabel: "1.2 KB", modTime: DEMO_NOW, isDir: false },
  { name: "app.go", path: "/Projects/go-termflow/app.go", size: 8400, sizeLabel: "8.4 KB", modTime: DEMO_NOW, isDir: false },
  { name: "go.mod", path: "/Projects/go-termflow/go.mod", size: 612, sizeLabel: "612 B", modTime: DEMO_NOW, isDir: false },
];

const DEMO_REMOTE_FILES: BackendFileEntry[] = [
  { name: "app", path: "/var/www/app", size: 0, sizeLabel: "--", modTime: DEMO_NOW, isDir: true },
  { name: "html", path: "/var/www/html", size: 0, sizeLabel: "--", modTime: DEMO_NOW, isDir: true },
  { name: "static", path: "/var/www/static", size: 0, sizeLabel: "--", modTime: DEMO_NOW, isDir: true },
  { name: "nginx.conf", path: "/var/www/nginx.conf", size: 2100, sizeLabel: "2.1 KB", modTime: DEMO_NOW, isDir: false },
  { name: "deploy.sh", path: "/var/www/deploy.sh", size: 2400, sizeLabel: "2.4 KB", modTime: DEMO_NOW, isDir: false },
];

type TransferRecord = {
  id: string;
  direction: "upload" | "download";
  name: string;
  detail: string;
  status: "running" | "done" | "failed";
  bytes?: number;
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

const DEMO_SAVED_COMMANDS: SavedCommand[] = [
  { id: "demo-1", name: "Check nginx status", command: "systemctl status nginx", description: "View nginx service status and recent logs", tags: ["global", "server"], createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
  { id: "demo-2", name: "Tail access log", command: "tail -f /var/log/nginx/access.log", description: "Stream nginx access log in real time", tags: ["global", "log"], createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
  { id: "demo-3", name: "Check disk usage", command: "df -h", description: "Show mounted filesystem usage", tags: ["global"], createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
  { id: "demo-4", name: "Docker containers", command: 'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"', description: "List running containers with ports", tags: ["global", "docker"], createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
  { id: "demo-5", name: "Deploy app", command: "git pull && npm run build && pm2 restart all", description: "Pull, build, and restart all PM2 processes", tags: ["server", "danger"], createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
  { id: "demo-6", name: "Restart a service", command: "systemctl restart {{service}}", description: "Restart a parameterized systemd service", tags: ["server", "danger", "param"], createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
  { id: "demo-7", name: "Tail a log file", command: "tail -n {{lines}} {{file}}", description: "Stream the last N lines of any file", tags: ["global", "log", "param"], createdAt: DEMO_NOW, updatedAt: DEMO_NOW },
];

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
const SMART_COMMANDS = ["top", "df -h", "tail -f /var/log/nginx/error.log", "systemctl status nginx"];

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
          <MiniGauge value={cpu} label="CPU" sub={snapshot?.loadAverage ?? "live"} color={cpu > 85 ? "var(--red)" : "var(--yellow)"} />
          <MiniGauge value={mem} label="MEM" sub="usage" color={mem > 85 ? "var(--red)" : "var(--green)"} />
          <MiniGauge value={disk} label="DISK" sub="/ volume" color={disk > 85 ? "var(--red)" : "var(--peach)"} />
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
  onRunCommand,
  onRefresh,
  onTransfer,
  onEdit,
  onDelete,
  onClose,
}: {
  files: BackendFileEntry[];
  path: string;
  onRunCommand(command: string): void;
  onRefresh(): void;
  onTransfer(entry: BackendFileEntry): void;
  onEdit(entry: BackendFileEntry): void;
  onDelete(entry: BackendFileEntry): void;
  onClose(): void;
}) {
  const shownFiles = files.length > 0 ? files : DEMO_REMOTE_FILES;
  return (
    <aside className="term-files" aria-label="Files panel">
      <div className="tf-head">
        <span className="tf-head-title"><Icon name="files" size={13} />Files</span>
        <span className="tf-head-spacer" />
        <button className="tf-sync" type="button" onClick={onRefresh}><Icon name="link" size={12} />Synced</button>
        <button className="tf-icon-btn" type="button" title="Upload" onClick={() => shownFiles[0] && onTransfer(shownFiles[0])}><Icon name="upload" size={13} /></button>
        <button className="tf-icon-btn" type="button" title="Close panel" onClick={onClose}><Icon name="close" size={13} /></button>
      </div>
      <div className="tf-path">
        {path.split("/").filter(Boolean).map((part, index) => (
          <span className="tf-path-seg" key={`${part}-${index}`}>{index === 0 ? "/" : "›"} {part}</span>
        ))}
      </div>
      <div className="tf-list">
        {shownFiles.slice(0, 12).map((file, index) => (
          <div className={`tf-row${index === 0 ? " selected" : ""}${file.isDir ? " dir" : ""}`} key={file.path}>
            <span className="tf-row-icon">{file.isDir ? "🗂" : "📄"}</span>
            <span className="tf-row-name">{file.name}</span>
            <span className="tf-row-size">{file.sizeLabel}</span>
            <span className="tf-actions">
              {file.isDir ? (
                <button className="tf-act" type="button" title="cd here" onClick={() => onRunCommand(`cd ${shellQuote(file.path)}`)}>
                  <Icon name="terminal" size={11} />
                </button>
              ) : (
                <button className="tf-act" type="button" title="Edit" onClick={() => onEdit(file)}>
                  <Icon name="edit" size={11} />
                </button>
              )}
              <button className="tf-act" type="button" title="Download" onClick={() => onTransfer(file)}>
                <Icon name="download" size={11} />
              </button>
              <button className="tf-act danger" type="button" title="Delete" onClick={() => onDelete(file)}>
                <Icon name="trash" size={11} />
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="tf-foot">
        <span>{shownFiles.length} items</span>
        <button className="tf-foot-up" type="button" onClick={() => shownFiles[0] && onTransfer(shownFiles[0])}><Icon name="upload" size={11} />Upload</button>
      </div>
    </aside>
  );
}

function TerminalHistoryDock({
  host,
  history,
  onRunCommand,
  onClear,
  onClose,
}: {
  host: string;
  history: CommandHistoryEntry[];
  onRunCommand(command: string): void;
  onClear(): void;
  onClose(): void;
}) {
  return (
    <aside className="term-files term-hist" aria-label="History panel">
      <div className="tf-head">
        <span className="tf-head-title"><Icon name="list" size={13} />History</span>
        <span className="tf-head-spacer" />
        <button className="tf-icon-btn" type="button" title="Close panel" onClick={onClose}><Icon name="close" size={13} /></button>
      </div>
      <div className="hp-controls">
        <input className="hp-search" name="command-history-search" placeholder="Search commands..." readOnly value="" />
        <div className="hp-scope">
          <button className="active" type="button">{host}</button>
          <button type="button">All hosts</button>
        </div>
      </div>
      <div className="hp-list">
        {history.length === 0 ? (
          <div className="hp-empty">No commands logged yet — everything you run is recorded here, searchable per host.</div>
        ) : (
          history.map((entry) => (
            <button className="hp-item" type="button" key={entry.id} onClick={() => onRunCommand(entry.command)}>
              <code>{entry.command}</code>
              <span>{new Date(entry.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
            </button>
          ))
        )}
      </div>
      <div className="tf-foot">
        <span>{history.length} entries</span>
        <button className="tf-foot-up" type="button" onClick={onClear}><Icon name="trash" size={11} />Clear</button>
      </div>
    </aside>
  );
}

function TerminalSmartBar({ onClose, onPick }: { onClose(): void; onPick(command: string): void }) {
  return (
    <div className="term-smartbar">
      <div className="sm-head">
        <span className="sm-title"><Icon name="zap" size={12} />Suggestions</span>
        <span className="sm-kbd">⌘J</span>
        <button className="tf-icon-btn sm-close" type="button" title="Close suggestions" onClick={onClose}>
          <Icon name="close" size={11} />
        </button>
      </div>
      <div className="sm-row">
        <span className="sm-cat">Context</span>
        {SMART_COMMANDS.map((command) => (
          <button className="tq-chip" type="button" key={command} onClick={() => onPick(command)}><Icon name="play" size={9} />{command}</button>
        ))}
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
  rows,
  selected,
  onSelect,
  onUp,
  onRefresh,
  onNewFolder,
  onTransfer,
  onEdit,
  onRename,
  onDelete,
}: {
  side: "local" | "remote";
  path: string;
  rows: BackendFileEntry[];
  selected: string | null;
  onSelect(name: string): void;
  onUp(): void;
  onRefresh(): void;
  onNewFolder(): void;
  onTransfer(entry: BackendFileEntry): void;
  onEdit(entry: BackendFileEntry): void;
  onRename(entry: BackendFileEntry): void;
  onDelete(entry: BackendFileEntry): void;
}) {
  const transferLabel = side === "local" ? "Upload" : "Download";
  const selectedEntry = rows.find((row) => row.name === selected) ?? rows[0] ?? null;

  return (
    <div className="files-pane">
      <div className="files-pane-header">
        <span className={`fp-badge ${side}`}>{side}</span>
        <span className="fp-path">{path}</span>
        <div className="fp-actions">
          <button className="fp-btn" type="button" title="Go up" onClick={onUp}>↑</button>
          <button className="fp-btn" type="button" title="New folder" onClick={onNewFolder}><Icon name="plus" size={13} /></button>
          <button className="fp-btn" type="button" title="Refresh" onClick={onRefresh}><Icon name="refresh" size={12} /></button>
          <button
            className="fp-btn"
            type="button"
            title={transferLabel}
            onClick={() => selectedEntry && onTransfer(selectedEntry)}
          >
            <Icon name={side === "local" ? "upload" : "download"} size={12} />
          </button>
        </div>
      </div>
      <div className="files-toolbar">
        <span className="files-toolbar-label">Path:</span>
        {path.split("/").filter(Boolean).map((part, index) => (
          <span className="files-crumb" key={`${side}-${part}-${index}`}>{index === 0 ? "/" : "›"} {part}</span>
        ))}
      </div>
      <div className="files-list">
        {rows.map((row) => (
          <div
            className={`f-item${selected === row.name ? " selected" : ""}`}
            key={`${side}-${row.name}`}
            onClick={() => onSelect(row.name)}
          >
            <span className="f-item-icon">{fileGlyph(row)}</span>
            <span className="f-item-name">{row.name}</span>
            <span className="f-item-meta">
              <span className="f-item-size">{row.sizeLabel}</span>
              <span className="f-item-date">{formatFileDate(row.modTime)}</span>
            </span>
            <span className="f-row-actions">
              <button className="f-act go" type="button" title={transferLabel} onClick={(event) => {
                event.stopPropagation();
                onTransfer(row);
              }}>
                <Icon name={side === "local" ? "upload" : "download"} size={13} />
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
        {selected ? <span>Selected: <strong>{selected}</strong></span> : null}
        <span className="fs-spacer" />
        <span className={`fs-dest ${side}`}>
          <Icon name={side === "local" ? "upload" : "download"} size={11} />
          {transferLabel} → <b>{side === "local" ? "REMOTE /var/www" : "LOCAL /Projects/go-termflow"}</b>
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
  onNewFolder,
  onTransfer,
  onEdit,
  onRename,
  onDelete,
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
  onNewFolder(side: "local" | "remote"): void;
  onTransfer(side: "local" | "remote", entry: BackendFileEntry): void;
  onEdit(side: "local" | "remote", entry: BackendFileEntry): void;
  onRename(side: "local" | "remote", entry: BackendFileEntry): void;
  onDelete(side: "local" | "remote", entry: BackendFileEntry): void;
}) {
  const [localSelection, setLocalSelection] = useState<string | null>("frontend");
  const [remoteSelection, setRemoteSelection] = useState<string | null>("nginx.conf");

  useEffect(() => {
    if (localFiles.length === 0) {
      setLocalSelection(null);
      return;
    }
    if (!localFiles.some((file) => file.name === localSelection)) {
      setLocalSelection(localFiles[0].name);
    }
  }, [localFiles, localSelection]);

  useEffect(() => {
    if (remoteFiles.length === 0) {
      setRemoteSelection(null);
      return;
    }
    if (!remoteFiles.some((file) => file.name === remoteSelection)) {
      setRemoteSelection(remoteFiles[0].name);
    }
  }, [remoteFiles, remoteSelection]);

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
          rows={localFiles}
          selected={localSelection}
          onSelect={setLocalSelection}
          onUp={onLocalUp}
          onRefresh={onLocalRefresh}
          onNewFolder={() => onNewFolder("local")}
          onTransfer={(entry) => onTransfer("local", entry)}
          onEdit={(entry) => onEdit("local", entry)}
          onRename={(entry) => onRename("local", entry)}
          onDelete={(entry) => onDelete("local", entry)}
        />
        <div className="pane-divider" />
        <FilesPane
          side="remote"
          path={remotePath}
          rows={remoteFiles}
          selected={remoteSelection}
          onSelect={setRemoteSelection}
          onUp={onRemoteUp}
          onRefresh={onRemoteRefresh}
          onNewFolder={() => onNewFolder("remote")}
          onTransfer={(entry) => onTransfer("remote", entry)}
          onEdit={(entry) => onEdit("remote", entry)}
          onRename={(entry) => onRename("remote", entry)}
          onDelete={(entry) => onDelete("remote", entry)}
        />
        {transfers.length > 0 ? (
          <div className="xfer-stack">
            {transfers.slice(0, 4).map((transfer) => (
              <div className={`xfer-card ${transfer.status}`} key={transfer.id}>
                <div className="xfer-top">
                  <span className="xfer-dir">
                    <Icon name={transfer.direction === "upload" ? "upload" : "download"} size={13} />
                  </span>
                  <span className="xfer-name">{transfer.name} · {transfer.detail}</span>
                  <span className="xfer-pct">{transfer.status === "running" ? "..." : transfer.status}</span>
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
  onRun,
  onCreate,
  onTogglePin,
}: {
  savedCommands: SavedCommand[];
  onRun(command: string): void;
  onCreate(): void;
  onTogglePin(command: SavedCommand): void;
}) {
  const [activeTag, setActiveTag] = useState("all");
  const commandCountByTag = (tag: string) =>
    savedCommands.filter((command) => tag === "all" || command.tags.includes(tag)).length;
  const nav = [
    ["all", "All Commands", commandCountByTag("all")],
    ["global", "Global", commandCountByTag("global")],
    ["server", "Server-scoped", commandCountByTag("server")],
    ["log", "Log", commandCountByTag("log")],
    ["docker", "Docker", commandCountByTag("docker")],
    ["danger", "Destructive", commandCountByTag("danger")],
  ] as const;
  const commands = savedCommands.filter((command) => activeTag === "all" || command.tags.includes(activeTag));

  return (
    <section className="view-stack">
      <div className="view-header">
        <Icon name="commands" size={16} />
        <span className="view-header-title">Command Library</span>
        <button className="view-btn primary" type="button" onClick={onCreate}><Icon name="plus" size={13} />New Command</button>
      </div>
      <div className="cmd-wrap">
        <aside className="cmd-sidebar">
          {nav.map(([id, item, count]) => (
            <button
              className={`cmd-nav-item${activeTag === id ? " active" : ""}`}
              type="button"
              key={id}
              onClick={() => setActiveTag(id)}
            >
              <Icon name={id === "danger" ? "shield" : id === "server" ? "network" : "list"} size={14} />
              {item}
              <span className="cmd-count">{count}</span>
            </button>
          ))}
        </aside>
        <div className="cmd-grid">
          {commands.map((command) => (
            <article className={`cmd-card${command.tags.includes("global") ? " pinned" : ""}`} key={command.id}>
              <div className="cmd-card-head">
                <div className="cmd-card-name">{command.name}</div>
                <button
                  className={`cmd-pin${command.tags.includes("global") ? " on" : ""}`}
                  type="button"
                  title="Pin to Quick bar"
                  onClick={() => onTogglePin(command)}
                >
                  <Icon name="pin" size={13} />
                </button>
              </div>
              <code className="cmd-card-code">{command.command}</code>
              <div className="cmd-card-desc">{command.description}</div>
              <div className="cmd-card-footer">
                {command.tags.map((tag) => (
                  <span className={`tag tag-${tag === "danger" ? "danger" : tag === "param" ? "param" : tag === "global" ? "global" : "server"}`} key={tag}>{tag}</span>
                ))}
                <button className="cmd-run-btn" type="button" onClick={() => onRun(command.command)}>
                  <Icon name="play" size={10} />{command.tags.includes("param") ? "Run..." : "Run"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
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
  appSettings,
  onRunCommand,
  onSaveSettings,
  onLocalUp,
  onRemoteUp,
  onLocalRefresh,
  onRemoteRefresh,
  onNewFolder,
  onTransfer,
  onEditFile,
  onRenameFile,
  onDeleteFile,
  onCreateSavedCommand,
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
  appSettings: AppSettings;
  onRunCommand(command: string): void;
  onSaveSettings(settings: AppSettings): Promise<void> | void;
  onLocalUp(): void;
  onRemoteUp(): void;
  onLocalRefresh(): void;
  onRemoteRefresh(): void;
  onNewFolder(side: "local" | "remote"): void;
  onTransfer(side: "local" | "remote", entry: BackendFileEntry): void;
  onEditFile(side: "local" | "remote", entry: BackendFileEntry): void;
  onRenameFile(side: "local" | "remote", entry: BackendFileEntry): void;
  onDeleteFile(side: "local" | "remote", entry: BackendFileEntry): void;
  onCreateSavedCommand(): void;
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
        onNewFolder={onNewFolder}
        onTransfer={onTransfer}
        onEdit={onEditFile}
        onRename={onRenameFile}
        onDelete={onDeleteFile}
      />
    );
  }
  if (view === "monitor") {
    return <MonitorView snapshot={monitorSnapshot} />;
  }
  if (view === "commands") {
    return <CommandsView savedCommands={savedCommands} onRun={onRunCommand} onCreate={onCreateSavedCommand} onTogglePin={onToggleCommandPin} />;
  }
  return <SettingsView appSettings={appSettings} onSave={onSaveSettings} />;
}

export default function App() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terminalBuffers, setTerminalBuffers] = useState<Record<string, string>>({});
  const [savedCommands, setSavedCommands] = useState<SavedCommand[]>(DEMO_SAVED_COMMANDS);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);
  const [localFiles, setLocalFiles] = useState<BackendFileEntry[]>(DEMO_LOCAL_FILES);
  const [remoteFiles, setRemoteFiles] = useState<BackendFileEntry[]>(DEMO_REMOTE_FILES);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [fileEditor, setFileEditor] = useState<FileEditorState | null>(null);
  const [monitorSnapshot, setMonitorSnapshot] = useState<MonitorSnapshot | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [localPath, setLocalPath] = useState("/Users/delong/Work/go-termflow");
  const [remotePath, setRemotePath] = useState("/var/www");
  const liveSessionIdsRef = useRef<Set<string>>(new Set());
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
    if (!activeSession) {
      setStatus("No active session");
      return;
    }
    if (!backendAvailable) {
      setRemoteFiles(DEMO_REMOTE_FILES);
      return;
    }
    try {
      const files = await listFiles({ side: "remote", sessionId: activeSession.id, path });
      setRemotePath(path);
      setRemoteFiles(files);
    } catch (error) {
      setStatus(messageFromError(error));
    }
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
          setSavedCommands(DEMO_SAVED_COMMANDS);
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
      setTerminalBuffers((current) => ({
        ...current,
        [event.sessionId]: appendTerminalData(current[event.sessionId] ?? "", event.data),
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
      setSessions((current) => current.filter((session) => session.id !== event.sessionId));
      setTerminalBuffers((current) => {
        const next = { ...current };
        delete next[event.sessionId];
        return next;
      });
      setStatus(`Session closed: ${event.sessionId}`);
    });

    return () => {
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
      return;
    }
    if (!backendAvailable) {
      setCommandHistory([]);
      setRemoteFiles(DEMO_REMOTE_FILES);
      return;
    }

    async function loadSessionData() {
      try {
        const [history, files, snapshot] = await Promise.all([
          listCommandHistory({ connectionId: activeSession.connectionId, limit: 50 }),
          listFiles({ side: "remote", sessionId: activeSession.id, path: remotePath }),
          getMonitorSnapshot(activeSession.id),
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
      void getMonitorSnapshot(activeSession.id)
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
  }, [activeSession, backendAvailable, remotePath]);

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

  async function handleDeleteConnection(connection: Connection) {
    const shouldDelete = window.confirm(`Delete connection "${connection.name}"?`);
    if (!shouldDelete) {
      return;
    }

    const removeConnection = () => {
      const removedSessionIds = new Set(
        sessions
          .filter((session) => session.connectionId === connection.id)
          .map((session) => session.id),
      );
      setConnections((current) => current.filter((item) => item.id !== connection.id));
      setSessions((current) => current.filter((session) => session.connectionId !== connection.id));
      setTerminalBuffers((current) => {
        const next = { ...current };
        removedSessionIds.forEach((sessionID) => {
          delete next[sessionID];
        });
        return next;
      });
      setActiveSessionId((current) => {
        if (current && !removedSessionIds.has(current)) {
          return current;
        }
        const nextSession = sessions.find((session) => session.connectionId !== connection.id);
        return nextSession?.id ?? null;
      });
    };

    if (!backendAvailable) {
      removeConnection();
      setStatus(`Deleted preview connection: ${connection.name}`);
      return;
    }

    try {
      const sessionsToClose = sessions.filter((session) => session.connectionId === connection.id);
      await Promise.all(sessionsToClose.map((session) => closeSession(session.id).catch(() => undefined)));
      await deleteConnection(connection.id);
      removeConnection();
      setStatus(`Deleted connection: ${connection.name}`);
      await refreshConnectionsFromBackend();
    } catch (error) {
      setStatus(messageFromError(error));
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
        [session.id]: DEMO_BUFFERS["demo-prod"].replaceAll("prod-01", connection.name),
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
      const history = await listCommandHistory({ connectionId: activeSession.connectionId, limit: 50 });
      setCommandHistory(history);
      setStatus(terminalBroadcast ? `Broadcast command: ${trimmed}` : `Ran command: ${trimmed}`);
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

  async function handleFileTransfer(side: "local" | "remote", entry: BackendFileEntry) {
    if (entry.isDir) {
      setStatus("Folder transfer is not supported yet; choose a file");
      return;
    }
    if (!backendAvailable) {
      setStatus("Transfer requires the Wails backend");
      return;
    }
    const sessionId = requireActiveRemoteSession();
    if (!sessionId) {
      return;
    }

    const direction = side === "local" ? "upload" : "download";
    const defaultLocalPath = side === "local" ? entry.path : joinPath(localPath, entry.name);
    const defaultRemotePath = side === "local" ? joinPath(remotePath, entry.name) : entry.path;
    const destination = window.prompt(
      direction === "upload" ? "Upload to remote path" : "Download to local path",
      direction === "upload" ? defaultRemotePath : defaultLocalPath,
    );
    if (!destination?.trim()) {
      return;
    }

    const localTarget = direction === "upload" ? defaultLocalPath : destination.trim();
    const remoteTarget = direction === "upload" ? destination.trim() : defaultRemotePath;
    const transferId = `transfer-${Date.now()}`;
    const running: TransferRecord = {
      id: transferId,
      direction,
      name: entry.name,
      detail: direction === "upload" ? `${localTarget} -> ${remoteTarget}` : `${remoteTarget} -> ${localTarget}`,
      status: "running",
    };
    setTransfers((current) => [running, ...current].slice(0, 6));
    setStatus(`${direction === "upload" ? "Uploading" : "Downloading"} ${entry.name}`);

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
            ? { ...transfer, status: "done", bytes: result.bytesTransferred }
            : transfer,
        ),
      );
      setStatus(`${direction === "upload" ? "Uploaded" : "Downloaded"} ${entry.name} (${formatBytes(result.bytesTransferred)})`);
      await Promise.all([refreshLocalFiles(), refreshRemoteFiles()]);
    } catch (error) {
      const message = messageFromError(error);
      setTransfers((current) =>
        current.map((transfer) =>
          transfer.id === transferId ? { ...transfer, status: "failed", detail: message } : transfer,
        ),
      );
      setStatus(message);
    }
  }

  async function handleNewFolder(side: "local" | "remote") {
    const name = window.prompt("New folder name");
    if (!name?.trim()) {
      return;
    }
    if (!backendAvailable) {
      setStatus("Folder creation requires the Wails backend");
      return;
    }
    const sessionId = side === "remote" ? requireActiveRemoteSession() : undefined;
    if (side === "remote" && !sessionId) {
      return;
    }
    const target = joinPath(side === "local" ? localPath : remotePath, name.trim());
    try {
      await createFolder({ side, sessionId, path: target });
      setStatus(`Created ${side} folder: ${target}`);
      if (side === "local") {
        await refreshLocalFiles();
      } else {
        await refreshRemoteFiles();
      }
    } catch (error) {
      setStatus(messageFromError(error));
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
    const sessionId = side === "remote" ? requireActiveRemoteSession() : undefined;
    if (side === "remote" && !sessionId) {
      return;
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

  async function handleRenameFile(side: "local" | "remote", entry: BackendFileEntry) {
    const nextName = window.prompt(`Rename "${entry.name}" to`, entry.name);
    if (!nextName?.trim() || nextName.trim() === entry.name) {
      return;
    }
    if (!backendAvailable) {
      setStatus("Rename requires the Wails backend");
      return;
    }
    const sessionId = side === "remote" ? requireActiveRemoteSession() : undefined;
    if (side === "remote" && !sessionId) {
      return;
    }
    const newPath = joinPath(parentPath(entry.path), nextName.trim());
    try {
      await renameFile({ side, sessionId, path: entry.path, newPath });
      setStatus(`Renamed ${entry.name} to ${nextName.trim()}`);
      if (side === "local") {
        await refreshLocalFiles();
      } else {
        await refreshRemoteFiles();
      }
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  async function handleDeleteFile(side: "local" | "remote", entry: BackendFileEntry) {
    if (!window.confirm(`Delete ${side} ${entry.isDir ? "folder" : "file"} "${entry.name}"?`)) {
      return;
    }
    if (!backendAvailable) {
      setStatus("Delete requires the Wails backend");
      return;
    }
    const sessionId = side === "remote" ? requireActiveRemoteSession() : undefined;
    if (side === "remote" && !sessionId) {
      return;
    }
    try {
      await deleteFile({ side, sessionId, path: entry.path });
      setStatus(`Deleted ${entry.name}`);
      if (side === "local") {
        await refreshLocalFiles();
      } else {
        await refreshRemoteFiles();
      }
    } catch (error) {
      setStatus(messageFromError(error));
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
    const sessionId = fileEditor.side === "remote" ? requireActiveRemoteSession() : undefined;
    if (fileEditor.side === "remote" && !sessionId) {
      return;
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

  async function handleCreateSavedCommand() {
    const name = window.prompt("Command name");
    if (!name?.trim()) {
      return;
    }
    const command = window.prompt("Command to run");
    if (!command?.trim()) {
      return;
    }
    const description = window.prompt("Description", "") ?? "";
    const input = {
      name: name.trim(),
      command: command.trim(),
      description: description.trim(),
      tags: ["global"],
    };
    if (!backendAvailable) {
      const created: SavedCommand = {
        ...input,
        id: `demo-command-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSavedCommands((current) => [...current, created]);
      return;
    }
    try {
      const created = await saveSavedCommand(input);
      setSavedCommands((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)));
      setStatus(`Saved command: ${created.name}`);
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  async function handleToggleCommandPin(command: SavedCommand) {
    const hasGlobal = command.tags.includes("global");
    const nextTags = hasGlobal ? command.tags.filter((tag) => tag !== "global") : [...command.tags, "global"];
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
  const terminalDisplayPath = terminalPath(activeConnection);
  const activeTerminalBuffer = activeSession ? terminalBuffers[activeSession.id] ?? "" : "";
  const terminalCPU = monitorSnapshot?.cpuPercent ?? 0;
  const terminalMemory = monitorSnapshot?.memoryPercent ?? 0;
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

        <ConnectionSidebar
          connections={connections}
          activeConnectionId={activeConnection?.id ?? null}
          collapsed={sidebarCollapsed}
          connectedConnectionIds={sessions
            .filter((session) => session.status === "connected")
            .map((session) => session.connectionId)}
          onCreate={() => {
            setEditingConnection(null);
            setIsModalOpen(true);
          }}
          onEdit={(connection) => {
            setEditingConnection(connection);
            setIsModalOpen(true);
          }}
          onDelete={handleDeleteConnection}
          onOpen={handleOpenConnection}
          onRefresh={() => void refreshConnectionsFromBackend()}
        />

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
                    <button className="tt-vital critical cpu" type="button" onClick={() => setTerminalDock("monitor")}>
                      <span className="tt-vital-k">CPU</span>
                      <span className="tt-vital-v">{terminalCPU}%</span>
                      <span className="tt-spark" aria-hidden="true">
                        {Array.from({ length: 16 }).map((_, index) => (
                          <span key={index} style={{ height: `${8 + ((index * 5 + terminalCPU) % 16)}px` }} />
                        ))}
                      </span>
                    </button>
                    <button className="tt-vital mem" type="button" onClick={() => setTerminalDock("monitor")}>
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
                  onClick={() => setTerminalDock((current) => (current === "files" ? null : "files"))}
                >
                  <Icon name="files" size={12} />
                  Files
                </button>
                <button
                  className={`tt-btn${terminalDock === "history" ? " active" : ""}`}
                  type="button"
                  onClick={() => setTerminalDock((current) => (current === "history" ? null : "history"))}
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
                  onTerminalSizeChange={handleTerminalSizeChange}
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
                    onRunCommand={(command) => void handleRunTerminalCommand(command)}
                    onRefresh={() => void refreshRemoteFiles()}
                    onTransfer={(entry) => handleFileTransfer("remote", entry)}
                    onEdit={(entry) => void handleEditFile("remote", entry)}
                    onDelete={(entry) => void handleDeleteFile("remote", entry)}
                    onClose={() => setTerminalDock(null)}
                  />
                ) : null}
                {terminalDock === "history" ? (
                  <TerminalHistoryDock
                    host={terminalDisplayHost}
                    history={commandHistory}
                    onRunCommand={(command) => void handleRunTerminalCommand(command)}
                    onClear={() => void handleClearActiveHistory()}
                    onClose={() => setTerminalDock(null)}
                  />
                ) : null}
              </div>
              {terminalSmartOpen ? (
                <TerminalSmartBar
                  onClose={() => setTerminalSmartOpen(false)}
                  onPick={(command) => {
                    setTerminalCommand(command);
                    setTerminalSmartOpen(false);
                  }}
                />
              ) : null}
              {terminalBroadcast ? (
                <div className="bcast-banner">
                  <Icon name="network" size={12} />
                  Broadcasting — Enter sends this command to {sessions.filter((session) => session.status === "connected").length} connected sessions
                  <button type="button" onClick={() => setTerminalBroadcast(false)}>turn off</button>
                </div>
              ) : null}
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
                appSettings={appSettings}
                onRunCommand={(command) => void handleRunTerminalCommand(command)}
                onSaveSettings={handleSaveAppSettings}
                onLocalUp={() => void refreshLocalFiles(parentPath(localPath))}
                onRemoteUp={() => void refreshRemoteFiles(parentPath(remotePath))}
                onLocalRefresh={() => void refreshLocalFiles()}
                onRemoteRefresh={() => void refreshRemoteFiles()}
                onNewFolder={(side) => void handleNewFolder(side)}
                onTransfer={handleFileTransfer}
                onEditFile={(side, entry) => void handleEditFile(side, entry)}
                onRenameFile={(side, entry) => void handleRenameFile(side, entry)}
                onDeleteFile={(side, entry) => void handleDeleteFile(side, entry)}
                onCreateSavedCommand={() => void handleCreateSavedCommand()}
                onToggleCommandPin={(command) => void handleToggleCommandPin(command)}
              />
            </section>
          )}
        </main>
      </div>

      <StatusBar
        status={status}
        sessions={sessions}
        activeSession={activeSession}
        activeConnection={activeConnection}
        backendAvailable={backendAvailable}
      />

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
