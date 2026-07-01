import { Icon } from "./Icon";
import type { FileEditorState } from "./FileEditorWindow";

export function FileEditorDock({
  editors,
  onFocusEditor,
}: {
  editors: FileEditorState[];
  onFocusEditor(editorId: string): void;
}) {
  if (editors.length === 0) {
    return null;
  }

  return (
    <div className="file-editor-dock" aria-label="Open files">
      {editors.map((editor) => {
        const dirty = editor.content !== editor.originalContent;
        return (
          <button
            className={`fe-dock-item${editor.hidden ? " hidden" : ""}`}
            type="button"
            key={editor.id}
            onClick={() => onFocusEditor(editor.id)}
            title={editor.path}
          >
            <Icon name={editor.isBinary ? "shield" : "file"} size={12} />
            <span>{editor.name}</span>
            {dirty ? <b aria-label="unsaved changes">•</b> : null}
          </button>
        );
      })}
    </div>
  );
}
