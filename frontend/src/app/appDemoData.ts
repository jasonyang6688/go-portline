import type {
  AppSettings,
  Connection,
  FileEntry as BackendFileEntry,
  Session,
  TerminalSize,
} from "../features/connections/types";

export const DEFAULT_TERMINAL_SIZE: TerminalSize = { cols: 120, rows: 32 };
export const DEFAULT_REMOTE_PATH = "/home/ubuntu";
export const DEFAULT_LOCAL_PATH = "/";
export const MAX_TERMINAL_BUFFER_LENGTH = 200_000;
export const DEMO_NOW = new Date().toISOString();

export const DEMO_CONNECTIONS: Connection[] = [
  {
    id: "c1",
    name: "prod-01",
    host: "10.0.1.100",
    port: 22,
    username: "root",
    authType: "agent",
    password: "",
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

export const DEMO_SESSIONS: Session[] = [
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

export const DEMO_BUFFERS: Record<string, string> = {
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

export const DEFAULT_APP_SETTINGS: AppSettings = {
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

export function formatBytes(value: number | undefined): string {
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

export function normalizeRemotePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  return `/${trimmed.split("/").filter(Boolean).join("/")}`;
}

function joinDemoPath(base: string, name: string): string {
  return `${base.replace(/\/+$/, "")}/${name.replace(/^\/+/, "")}`;
}

function demoDir(basePath: string, name: string): BackendFileEntry {
  return { name, path: joinDemoPath(basePath, name), size: 0, sizeLabel: "--", modTime: DEMO_NOW, isDir: true };
}

function demoFile(basePath: string, name: string, size: number): BackendFileEntry {
  return { name, path: joinDemoPath(basePath, name), size, sizeLabel: formatBytes(size), modTime: DEMO_NOW, isDir: false };
}

export const DEMO_LOCAL_FILES: BackendFileEntry[] = [
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

export const DEMO_REMOTE_FILES: BackendFileEntry[] = DEMO_REMOTE_TREE[DEFAULT_REMOTE_PATH];

export function demoRemoteFilesForPath(path: string): BackendFileEntry[] {
  return DEMO_REMOTE_TREE[normalizeRemotePath(path)] ?? [];
}
