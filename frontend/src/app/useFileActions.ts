import { useState } from "react";
import type {
  FileContent,
  FileEntry as BackendFileEntry,
} from "../features/connections/types";
import {
  createFolder,
  deleteFile,
  readFile,
  renameFile,
  saveFile,
} from "../shared/api/wails";
import type {
  PendingFileDelete,
  PendingNewItem,
  PendingRenameItem,
} from "./FileModals";
import type { FileEditorState } from "./FileEditorWindow";
import { joinPath, parentPath } from "./appHelpers";

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type UseFileActionsOptions = {
  backendAvailable: boolean;
  fileEditors: FileEditorState[];
  localFiles: BackendFileEntry[];
  localPath: string;
  remoteFiles: BackendFileEntry[];
  remotePath: string;
  failLoadingFileEditor: (side: "local" | "remote", path: string, message: string) => void;
  finishLoadingFileEditor: (editor: Omit<FileEditorState, "id" | "hidden" | "zIndex" | "x" | "y" | "width" | "height">) => void;
  markFileEditorSaved: (editorId: string) => void;
  openFileEditor: (editor: Omit<FileEditorState, "id" | "hidden" | "zIndex" | "x" | "y" | "width" | "height">) => void;
  refreshLocalFiles: () => Promise<void>;
  refreshRemoteFiles: () => Promise<void>;
  requireActiveRemoteSession: () => string | null;
  setStatus: (status: string) => void;
  startSavingFileEditor: (editorId: string) => void;
  stopSavingFileEditor: (editorId: string) => void;
};

export function useFileActions({
  backendAvailable,
  fileEditors,
  localFiles,
  localPath,
  remoteFiles,
  remotePath,
  failLoadingFileEditor,
  finishLoadingFileEditor,
  markFileEditorSaved,
  openFileEditor,
  refreshLocalFiles,
  refreshRemoteFiles,
  requireActiveRemoteSession,
  setStatus,
  startSavingFileEditor,
  stopSavingFileEditor,
}: UseFileActionsOptions) {
  const [pendingNewItem, setPendingNewItem] = useState<PendingNewItem | null>(null);
  const [pendingRenameItem, setPendingRenameItem] = useState<PendingRenameItem | null>(null);
  const [pendingFileDelete, setPendingFileDelete] = useState<PendingFileDelete | null>(null);
  const [deletingFiles, setDeletingFiles] = useState(false);

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
        openFileEditor({
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
    const alreadyOpen = fileEditors.some((editor) => editor.side === side && editor.path === entry.path);
    openFileEditor({
      side,
      path: entry.path,
      name: entry.name,
      language: "text",
      originalContent: "",
      content: "",
      isBinary: false,
      saving: false,
      loading: true,
      error: null,
    });
    if (alreadyOpen) {
      setStatus(`Focused ${entry.name}`);
      return;
    }
    setStatus(`Opening ${entry.name}...`);
    try {
      const content: FileContent = await readFile({ side, sessionId, path: entry.path });
      finishLoadingFileEditor({
        side,
        path: content.path,
        name: content.name,
        language: content.language || "text",
        originalContent: content.content,
        content: content.content,
        isBinary: content.isBinary,
        saving: false,
        loading: false,
        error: null,
      });
      setStatus(`Opened ${entry.name}`);
    } catch (error) {
      const message = messageFromError(error);
      failLoadingFileEditor(side, entry.path, message);
      setStatus(message);
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

  async function handleSaveEditedFile(editorId: string) {
    const fileEditor = fileEditors.find((editor) => editor.id === editorId);
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
    startSavingFileEditor(editorId);
    try {
      await saveFile({
        side: fileEditor.side,
        sessionId,
        path: fileEditor.path,
        content: fileEditor.content,
      });
      markFileEditorSaved(editorId);
      setStatus(`Saved ${fileEditor.name}`);
      if (fileEditor.side === "local") {
        await refreshLocalFiles();
      } else {
        await refreshRemoteFiles();
      }
    } catch (error) {
      stopSavingFileEditor(editorId);
      setStatus(messageFromError(error));
    }
  }

  return {
    deletingFiles,
    pendingFileDelete,
    pendingNewItem,
    pendingRenameItem,
    confirmCreateNewItem,
    confirmDeleteFiles,
    confirmRenameItem,
    handleDeleteFile,
    handleDeleteFiles,
    handleEditFile,
    handleNewFile,
    handleNewFolder,
    handleRenameFile,
    handleSaveEditedFile,
    setPendingFileDelete,
    setPendingNewItem,
    setPendingRenameItem,
  };
}
