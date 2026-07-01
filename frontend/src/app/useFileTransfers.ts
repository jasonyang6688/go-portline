import { useState } from "react";
import type { FileEntry as BackendFileEntry } from "../features/connections/types";
import {
  selectLocalDirectory,
  selectLocalFile,
  selectLocalFiles,
  selectSaveFile,
  transferFile,
} from "../shared/api/wails";
import { formatBytes } from "./appDemoData";
import { baseName, joinPath, parentPath } from "./appHelpers";

export type TransferRecord = {
  id: string;
  direction: "upload" | "download";
  name: string;
  detail: string;
  status: "running" | "done" | "failed";
  bytes?: number;
  completedAt?: string;
};

type UseFileTransfersOptions = {
  backendAvailable: boolean;
  localPath: string;
  remotePath: string;
  refreshLocalFiles: () => Promise<void>;
  refreshRemoteFiles: (path?: string) => Promise<void>;
  requireActiveRemoteSession: () => string | null;
  setStatus: (status: string) => void;
};

export function useFileTransfers({
  backendAvailable,
  localPath,
  remotePath,
  refreshLocalFiles,
  refreshRemoteFiles,
  requireActiveRemoteSession,
  setStatus,
}: UseFileTransfersOptions) {
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);

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
      const message = error instanceof Error ? error.message : String(error);
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

  return {
    transfers,
    clearFinishedTransfers,
    dismissTransfer,
    handleFileTransfer,
    handleFileTransfers,
    handleUploadFolderToRemoteDirectory,
    handleUploadToRemoteDirectory,
  };
}
