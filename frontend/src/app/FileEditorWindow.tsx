import { useMemo, useRef } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { openSearchPanel } from "@codemirror/search";
import { Icon } from "./Icon";
import { fileEditorCodeMirrorExtensions } from "./fileEditorCodeMirror";
import { detectEditorLanguage } from "./fileEditorLanguage";

export type FileEditorState = {
  id: string;
  side: "local" | "remote";
  path: string;
  name: string;
  language: string;
  originalContent: string;
  content: string;
  isBinary: boolean;
  saving: boolean;
  loading?: boolean;
  error?: string | null;
  wrapLines?: boolean;
  hidden: boolean;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

function clampEditorPosition(x: number, y: number): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x, y };
  }
  return {
    x: Math.max(8, Math.min(x, Math.max(8, window.innerWidth - 120))),
    y: Math.max(40, Math.min(y, Math.max(40, window.innerHeight - 120))),
  };
}

export function clampEditorSize(width: number, height: number, x: number, y: number): { width: number; height: number } {
  if (typeof window === "undefined") {
    return { width, height };
  }
  return {
    width: Math.max(360, Math.min(width, Math.max(360, window.innerWidth - x - 8))),
    height: Math.max(260, Math.min(height, Math.max(260, window.innerHeight - y - 34))),
  };
}

export function FileEditorWindow({
  editor,
  onChange,
  onFocus,
  onMove,
  onResize,
  onHide,
  onClose,
  onSave,
  onToggleWrap,
}: {
  editor: FileEditorState;
  onChange(content: string): void;
  onFocus(): void;
  onMove(x: number, y: number): void;
  onResize(width: number, height: number): void;
  onHide(): void;
  onClose(): void;
  onSave(): void;
  onToggleWrap(): void;
}) {
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    mode: "right" | "bottom" | "corner";
    startClientX: number;
    startClientY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const codeMirrorRef = useRef<ReactCodeMirrorRef | null>(null);
  const loading = editor.loading === true;
  const loadError = editor.error ?? "";
  const wrapLines = editor.wrapLines === true;
  const dirty = editor.content !== editor.originalContent;
  const detectedLanguage = useMemo(() => detectEditorLanguage(editor.path || editor.name), [editor.name, editor.path]);
  const codeMirrorExtensions = useMemo(
    () => fileEditorCodeMirrorExtensions(detectedLanguage.id, wrapLines),
    [detectedLanguage.id, wrapLines],
  );

  const openFindPanel = () => {
    const view = codeMirrorRef.current?.view;
    if (!view) {
      return;
    }
    onFocus();
    openSearchPanel(view);
  };

  const handleWindowKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      openFindPanel();
    }
  };

  const handleDragStart = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    if (event.target instanceof HTMLElement && event.target.closest("button")) {
      return;
    }
    event.preventDefault();
    onFocus();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: editor.x,
      startY: editor.y,
    };
  };

  const handleDragMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const next = clampEditorPosition(
      drag.startX + event.clientX - drag.startClientX,
      drag.startY + event.clientY - drag.startClientY,
    );
    onMove(next.x, next.y);
  };

  const handleDragEnd = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleResizeStart = (mode: "right" | "bottom" | "corner", event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onFocus();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      pointerId: event.pointerId,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: editor.width,
      startHeight: editor.height,
    };
  };

  const handleResizeMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }
    const nextWidth =
      resize.mode === "bottom" ? resize.startWidth : resize.startWidth + event.clientX - resize.startClientX;
    const nextHeight =
      resize.mode === "right" ? resize.startHeight : resize.startHeight + event.clientY - resize.startClientY;
    const size = clampEditorSize(nextWidth, nextHeight, editor.x, editor.y);
    onResize(size.width, size.height);
  };

  const handleResizeEnd = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (resizeRef.current?.pointerId === event.pointerId) {
      resizeRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const stopButtonPointer = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const runWindowAction = (event: ReactPointerEvent<HTMLButtonElement>, action: () => void) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    action();
  };

  return (
    <section
      className="file-editor-card"
      role="dialog"
      aria-label={`Edit ${editor.name}`}
      onMouseDown={onFocus}
      onKeyDown={handleWindowKeyDown}
      style={{
        zIndex: editor.zIndex,
        left: editor.x,
        top: editor.y,
        width: editor.width,
        height: editor.height,
      }}
    >
      <header
        className="file-editor-head"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <div className="fe-title-block">
          <span className={`fp-badge ${editor.side}`}>{editor.side}</span>
          <span className="fe-title">{editor.name}</span>
          <span className="fe-language">{detectedLanguage.label}</span>
          {dirty ? <span className="fe-dirty">unsaved</span> : null}
        </div>
        <div className="fe-window-actions">
          <button
            className="fp-btn"
            type="button"
            title="Hide editor"
            onPointerDown={(event) => runWindowAction(event, onHide)}
            onClick={onHide}
          >
            _
          </button>
          <button
            className="fp-btn"
            type="button"
            title="Close editor"
            onPointerDown={(event) => runWindowAction(event, onClose)}
            onClick={onClose}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      </header>
      <div className="fe-path">{editor.path}</div>
      {loading ? (
        <div className="fe-loading" role="status">
          <Icon name="file" size={18} />
          <span>Opening {editor.name}...</span>
        </div>
      ) : loadError ? (
        <div className="fe-loading fe-error" role="alert">
          <Icon name="shield" size={18} />
          <span>{loadError}</span>
        </div>
      ) : editor.isBinary ? (
        <div className="fe-binary">
          <Icon name="shield" size={18} />
          <span>This file looks binary and is opened read-only.</span>
        </div>
      ) : (
        <>
          <div className="fe-findbar fe-editor-toolbar" aria-label="Editor tools">
            <button
              className="view-btn fe-tool-btn"
              type="button"
              title="Find and replace"
              onClick={openFindPanel}
            >
              <Icon name="search" size={13} />
              Find
            </button>
            <button
              className={`view-btn fe-tool-btn fe-wrap${wrapLines ? " active" : ""}`}
              type="button"
              title={wrapLines ? "Disable line wrap" : "Enable line wrap"}
              aria-label="Toggle line wrap"
              aria-pressed={wrapLines}
              onClick={onToggleWrap}
            >
              <Icon name="wrap" size={13} />
              Wrap
            </button>
            <span className="fe-editor-hint">CodeMirror</span>
          </div>
          <div className={`fe-editor fe-code-editor language-${detectedLanguage.id}`}>
            <CodeMirror
              aria-label={`Editor content for ${editor.name}`}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                foldGutter: true,
                allowMultipleSelections: true,
                indentOnInput: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                rectangularSelection: true,
                crosshairCursor: false,
                highlightActiveLine: true,
                highlightSelectionMatches: false,
                searchKeymap: false,
                tabSize: 2,
              }}
              extensions={codeMirrorExtensions}
              height="100%"
              indentWithTab
              ref={codeMirrorRef}
              theme="none"
              value={editor.content}
              onChange={(value) => onChange(value)}
              onFocus={onFocus}
            />
          </div>
        </>
      )}
      <footer className="file-editor-foot">
        <button
          className="view-btn"
          type="button"
          disabled={!dirty || editor.saving}
          onPointerDown={stopButtonPointer}
          onClick={() => onChange(editor.originalContent)}
        >
          Revert
        </button>
        <button
          className="view-btn primary"
          type="button"
          disabled={!dirty || editor.saving || editor.isBinary}
          onPointerDown={stopButtonPointer}
          onClick={onSave}
        >
          {editor.saving ? "Saving..." : "Save"}
        </button>
      </footer>
      <span
        className="fe-resize fe-resize-right"
        aria-hidden="true"
        onPointerDown={(event) => handleResizeStart("right", event)}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
      />
      <span
        className="fe-resize fe-resize-bottom"
        aria-hidden="true"
        onPointerDown={(event) => handleResizeStart("bottom", event)}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
      />
      <span
        className="fe-resize fe-resize-corner"
        aria-hidden="true"
        onPointerDown={(event) => handleResizeStart("corner", event)}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
      />
    </section>
  );
}
