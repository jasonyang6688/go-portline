import type {
  Connection,
  SaveConnectionInput,
  SaveSavedCommandInput,
  SavedCommand,
} from "../features/connections/types";
import { ConnectionModal } from "../features/connections/ConnectionModal";
import {
  CommandDeleteConfirm,
  CommandEditorModal,
  type CommandEditorRequest,
} from "./CommandModals";
import { CommandPalette } from "./CommandPalette";
import type { CommandPaletteItem } from "./commandPaletteItems";
import { DeleteConnectionConfirm } from "./ConnectionDeleteConfirm";
import { FileEditorDock } from "./FileEditorDock";
import { FileEditorWindow, type FileEditorState } from "./FileEditorWindow";
import {
  FileDeleteConfirm,
  NewFileItemModal,
  RenameFileItemModal,
  type PendingFileDelete,
  type PendingNewItem,
  type PendingRenameItem,
} from "./FileModals";

type AppOverlaysProps = {
  commandEditor: CommandEditorRequest | null;
  connections: Connection[];
  deletingCommandId: string | null;
  deletingConnectionId: string | null;
  deletingFiles: boolean;
  editingConnection: Connection | null;
  fileEditors: FileEditorState[];
  isConnectionModalOpen: boolean;
  newItemBasePath: string | null;
  paletteItems: CommandPaletteItem[];
  paletteOpen: boolean;
  paletteQuery: string;
  pendingCommandDelete: SavedCommand | null;
  pendingDeleteConnection: Connection | null;
  pendingFileDelete: PendingFileDelete | null;
  pendingNewItem: PendingNewItem | null;
  pendingRenameItem: PendingRenameItem | null;
  onCancelCommandDelete: () => void;
  onCancelCommandEditor: () => void;
  onCancelConnectionDelete: () => void;
  onCancelConnectionModal: () => void;
  onCancelFileDelete: () => void;
  onCancelNewItem: () => void;
  onCancelRenameItem: () => void;
  onChangeFileEditor: (editorId: string, content: string) => void;
  onChangeNewItemName: (name: string) => void;
  onChangePaletteQuery: (query: string) => void;
  onChangeRenameItemName: (name: string) => void;
  onCloseFileEditor: (editorId: string) => void;
  onClosePalette: () => void;
  onConfirmCommandDelete: (command: SavedCommand) => void;
  onConfirmConnectionDelete: (connection: Connection) => void;
  onConfirmFileDelete: (pendingDelete: PendingFileDelete) => void;
  onConfirmNewItem: (pendingItem: PendingNewItem) => void;
  onConfirmRenameItem: (pendingItem: PendingRenameItem) => void;
  onFocusFileEditor: (editorId: string) => void;
  onHideFileEditor: (editorId: string) => void;
  onMoveFileEditor: (editorId: string, x: number, y: number) => void;
  onResizeFileEditor: (editorId: string, width: number, height: number) => void;
  onSaveCommandEditor: (input: SaveSavedCommandInput) => void;
  onSaveConnection: (input: SaveConnectionInput) => void;
  onSaveFileEditor: (editorId: string) => void;
  onToggleFileEditorWrap: (editorId: string) => void;
};

export function AppOverlays({
  commandEditor,
  connections,
  deletingCommandId,
  deletingConnectionId,
  deletingFiles,
  editingConnection,
  fileEditors,
  isConnectionModalOpen,
  newItemBasePath,
  paletteItems,
  paletteOpen,
  paletteQuery,
  pendingCommandDelete,
  pendingDeleteConnection,
  pendingFileDelete,
  pendingNewItem,
  pendingRenameItem,
  onCancelCommandDelete,
  onCancelCommandEditor,
  onCancelConnectionDelete,
  onCancelConnectionModal,
  onCancelFileDelete,
  onCancelNewItem,
  onCancelRenameItem,
  onChangeFileEditor,
  onChangeNewItemName,
  onChangePaletteQuery,
  onChangeRenameItemName,
  onCloseFileEditor,
  onClosePalette,
  onConfirmCommandDelete,
  onConfirmConnectionDelete,
  onConfirmFileDelete,
  onConfirmNewItem,
  onConfirmRenameItem,
  onFocusFileEditor,
  onHideFileEditor,
  onMoveFileEditor,
  onResizeFileEditor,
  onSaveCommandEditor,
  onSaveConnection,
  onSaveFileEditor,
  onToggleFileEditorWrap,
}: AppOverlaysProps) {
  return (
    <>
      {isConnectionModalOpen ? (
        <ConnectionModal
          initialConnection={editingConnection}
          onCancel={onCancelConnectionModal}
          onSave={onSaveConnection}
        />
      ) : null}
      {pendingDeleteConnection ? (
        <DeleteConnectionConfirm
          connection={pendingDeleteConnection}
          deleting={deletingConnectionId === pendingDeleteConnection.id}
          onCancel={onCancelConnectionDelete}
          onConfirm={() => onConfirmConnectionDelete(pendingDeleteConnection)}
        />
      ) : null}
      {pendingFileDelete ? (
        <FileDeleteConfirm
          pendingDelete={pendingFileDelete}
          deleting={deletingFiles}
          onCancel={onCancelFileDelete}
          onConfirm={() => onConfirmFileDelete(pendingFileDelete)}
        />
      ) : null}
      {pendingNewItem && newItemBasePath ? (
        <NewFileItemModal
          pendingItem={pendingNewItem}
          basePath={newItemBasePath}
          onChangeName={onChangeNewItemName}
          onCancel={onCancelNewItem}
          onConfirm={() => onConfirmNewItem(pendingNewItem)}
        />
      ) : null}
      {pendingRenameItem ? (
        <RenameFileItemModal
          pendingItem={pendingRenameItem}
          onChangeName={onChangeRenameItemName}
          onCancel={onCancelRenameItem}
          onConfirm={() => onConfirmRenameItem(pendingRenameItem)}
        />
      ) : null}
      {commandEditor ? (
        <CommandEditorModal
          request={commandEditor}
          connections={connections}
          onCancel={onCancelCommandEditor}
          onSave={onSaveCommandEditor}
        />
      ) : null}
      {pendingCommandDelete ? (
        <CommandDeleteConfirm
          command={pendingCommandDelete}
          deleting={deletingCommandId === pendingCommandDelete.id}
          onCancel={onCancelCommandDelete}
          onConfirm={() => onConfirmCommandDelete(pendingCommandDelete)}
        />
      ) : null}
      {fileEditors.filter((editor) => !editor.hidden).map((editor) => (
        <FileEditorWindow
          editor={editor}
          key={editor.id}
          onChange={(content) => onChangeFileEditor(editor.id, content)}
          onFocus={() => onFocusFileEditor(editor.id)}
          onMove={(x, y) => onMoveFileEditor(editor.id, x, y)}
          onResize={(width, height) => onResizeFileEditor(editor.id, width, height)}
          onHide={() => onHideFileEditor(editor.id)}
          onClose={() => onCloseFileEditor(editor.id)}
          onSave={() => onSaveFileEditor(editor.id)}
          onToggleWrap={() => onToggleFileEditorWrap(editor.id)}
        />
      ))}
      <FileEditorDock editors={fileEditors} onFocusEditor={onFocusFileEditor} />
      {paletteOpen ? (
        <CommandPalette
          items={paletteItems}
          query={paletteQuery}
          onQueryChange={onChangePaletteQuery}
          onClose={onClosePalette}
        />
      ) : null}
    </>
  );
}
