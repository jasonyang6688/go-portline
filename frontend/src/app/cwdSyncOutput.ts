export const CWD_SYNC_OSC_PREFIX = "\u001b]6973;TermFlowCwd=";
export const CWD_SYNC_OSC_SUFFIX = "\u0007";
export const CWD_SYNC_COMMAND = `printf '\\033]6973;TermFlowCwd=%s\\007' "$PWD"\r`;
export const CWD_SYNC_ECHO = `printf '\\033]6973;TermFlowCwd=%s\\007' "$PWD"`;

function normalizeRemotePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  return `/${trimmed.split("/").filter(Boolean).join("/")}`;
}

export function extractSyncedWorkingDirectory(output: string): string | null {
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

export function resolveCwdSyncOutput(output: string): { syncedPath: string; terminalOutput: string } | null {
  const syncedPath = extractSyncedWorkingDirectory(output);
  if (!syncedPath) {
    return null;
  }
  return {
    syncedPath,
    terminalOutput: "",
  };
}
