import { useRef, useState } from "react";
import {
  clampEditorSize,
  type FileEditorState,
} from "./FileEditorWindow";

function fileEditorId(side: "local" | "remote", path: string): string {
  return `${side}:${path}`;
}

function defaultEditorPosition(index: number): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x: 280 + index * 48, y: 72 + index * 48 };
  }
  const x = Math.min(280 + index * 48, Math.max(16, window.innerWidth - 560));
  const y = Math.min(72 + index * 48, Math.max(48, window.innerHeight - 220));
  return { x, y };
}

function defaultEditorSize(): { width: number; height: number } {
  if (typeof window === "undefined") {
    return { width: 640, height: 640 };
  }
  return {
    width: Math.max(420, Math.min(720, Math.floor(window.innerWidth * 0.48))),
    height: Math.max(360, Math.min(640, window.innerHeight - 72)),
  };
}

export function useFileEditors() {
  const [fileEditors, setFileEditors] = useState<FileEditorState[]>([]);
  const editorZIndexRef = useRef(260);

  function nextEditorZIndex(): number {
    editorZIndexRef.current += 1;
    return editorZIndexRef.current;
  }

  function openFileEditor(editor: Omit<FileEditorState, "id" | "hidden" | "zIndex" | "x" | "y" | "width" | "height">) {
    const id = fileEditorId(editor.side, editor.path);
    const zIndex = nextEditorZIndex();
    setFileEditors((current) => {
      const existing = current.find((item) => item.id === id);
      if (existing) {
        return current.map((item) =>
          item.id === id ? { ...item, hidden: false, zIndex } : item,
        );
      }
      const position = defaultEditorPosition(current.length);
      const size = defaultEditorSize();
      return [...current, { ...editor, id, hidden: false, zIndex, ...position, ...size }];
    });
  }

  function finishLoadingFileEditor(editor: Omit<FileEditorState, "id" | "hidden" | "zIndex" | "x" | "y" | "width" | "height">) {
    const id = fileEditorId(editor.side, editor.path);
    setFileEditors((current) =>
      current.map((item) =>
        item.id === id && item.loading
          ? { ...item, ...editor, loading: false, error: null }
          : item,
      ),
    );
  }

  function failLoadingFileEditor(side: "local" | "remote", path: string, message: string) {
    const id = fileEditorId(side, path);
    setFileEditors((current) =>
      current.map((editor) =>
        editor.id === id && editor.loading
          ? { ...editor, loading: false, error: message }
          : editor,
      ),
    );
  }

  function focusFileEditor(editorId: string) {
    const zIndex = nextEditorZIndex();
    setFileEditors((current) =>
      current.map((editor) =>
        editor.id === editorId ? { ...editor, hidden: false, zIndex } : editor,
      ),
    );
  }

  function hideFileEditor(editorId: string) {
    setFileEditors((current) =>
      current.map((editor) =>
        editor.id === editorId ? { ...editor, hidden: true } : editor,
      ),
    );
  }

  function updateFileEditorContent(editorId: string, content: string) {
    setFileEditors((current) =>
      current.map((editor) =>
        editor.id === editorId ? { ...editor, content } : editor,
      ),
    );
  }

  function toggleFileEditorWrap(editorId: string) {
    setFileEditors((current) =>
      current.map((editor) =>
        editor.id === editorId ? { ...editor, wrapLines: !editor.wrapLines } : editor,
      ),
    );
  }

  function moveFileEditor(editorId: string, x: number, y: number) {
    setFileEditors((current) =>
      current.map((editor) =>
        editor.id === editorId ? { ...editor, x, y } : editor,
      ),
    );
  }

  function resizeFileEditor(editorId: string, width: number, height: number) {
    setFileEditors((current) =>
      current.map((editor) => {
        if (editor.id !== editorId) {
          return editor;
        }
        const size = clampEditorSize(width, height, editor.x, editor.y);
        return { ...editor, ...size };
      }),
    );
  }

  function closeFileEditor(editorId: string) {
    const editor = fileEditors.find((item) => item.id === editorId);
    if (editor && editor.content !== editor.originalContent && !window.confirm("Discard unsaved file changes?")) {
      return;
    }
    setFileEditors((current) => current.filter((item) => item.id !== editorId));
  }

  function startSavingFileEditor(editorId: string) {
    setFileEditors((current) =>
      current.map((editor) =>
        editor.id === editorId ? { ...editor, saving: true } : editor,
      ),
    );
  }

  function markFileEditorSaved(editorId: string) {
    setFileEditors((current) =>
      current.map((editor) =>
        editor.id === editorId ? { ...editor, originalContent: editor.content, saving: false } : editor,
      ),
    );
  }

  function stopSavingFileEditor(editorId: string) {
    setFileEditors((current) =>
      current.map((editor) =>
        editor.id === editorId ? { ...editor, saving: false } : editor,
      ),
    );
  }

  return {
    fileEditors,
    closeFileEditor,
    failLoadingFileEditor,
    finishLoadingFileEditor,
    focusFileEditor,
    hideFileEditor,
    markFileEditorSaved,
    moveFileEditor,
    openFileEditor,
    resizeFileEditor,
    startSavingFileEditor,
    stopSavingFileEditor,
    toggleFileEditorWrap,
    updateFileEditorContent,
  };
}
