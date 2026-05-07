<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { EventsOn } from '../../../wailsjs/runtime/runtime'
import { ensureConnectionsLoaded, ensureFileSession, selectedFileConnection } from '../../stores/fileWorkbench'
import { registerFileDropTarget } from '../../stores/fileDrops'

interface FileItem {
  name: string
  path: string
  isDir: boolean
  size: number
  modified: number
}

interface PaneState {
  path: string
  pathDraft: string
  search: string
  files: FileItem[]
  selectedPath: string
  loading: boolean
  error: string
}

interface TransferProgress {
  id: string
  name: string
  kind: string
  written: number
  total: number
  percent: number
  status: string
  error?: string
  savePath?: string
  targetPath?: string
}

interface BrowserUploadFile {
  file: File
  path: string
}

interface BrowserFileSystemEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  fullPath: string
}

interface BrowserFileSystemFileEntry extends BrowserFileSystemEntry {
  file(success: (file: File) => void, error?: (error: DOMException) => void): void
}

interface BrowserFileSystemDirectoryEntry extends BrowserFileSystemEntry {
  createReader(): {
    readEntries(success: (entries: BrowserFileSystemEntry[]) => void, error?: (error: DOMException) => void): void
  }
}

interface BrowserDataTransferItem {
  webkitGetAsEntry?: () => BrowserFileSystemEntry | null
}

const local = ref<PaneState>(emptyPane(''))
const remote = ref<PaneState>(emptyPane('~'))
const remoteStates = ref<Record<number, PaneState>>({})
const remoteSessionId = ref('')
const connecting = ref(false)
const transfers = ref<TransferProgress[]>([])
const remotePaneEl = ref<HTMLElement | null>(null)
const menu = ref<{ open: boolean; x: number; y: number; scope: 'local' | 'remote'; file: FileItem | null }>({
  open: false,
  x: 0,
  y: 0,
  scope: 'local',
  file: null,
})
let removeTransferListener: (() => void) | undefined
let removeFileDropTarget: (() => void) | undefined
let connectToken = 0

const selectedName = computed(() => selectedFileConnection.value?.name || 'No server selected')

onMounted(async () => {
  removeTransferListener = EventsOn('transfer:progress', (progress: TransferProgress) => {
    const index = transfers.value.findIndex(item => item.id === progress.id)
    if (index >= 0) transfers.value[index] = progress
    else transfers.value.unshift(progress)
    if (progress.status === 'done') {
      if (progress.kind === 'download') loadLocal()
      if (progress.kind === 'upload') loadRemote()
    }
  })
  removeFileDropTarget = registerFileDropTarget({
    element: () => remotePaneEl.value,
    enabled: () => Boolean(remoteSessionId.value),
    onDrop: paths => paths.forEach(path => uploadLocalPath({ name: baseName(path), path, isDir: false, size: 0, modified: 0 })),
  })
  await ensureConnectionsLoaded()
  await Promise.all([loadLocal(), connectRemote()])
})
onUnmounted(() => {
  removeTransferListener?.()
  removeFileDropTarget?.()
})

watch(selectedFileConnection, () => connectRemote())

function emptyPane(path: string): PaneState {
  return { path, pathDraft: path, search: '', files: [], selectedPath: '', loading: false, error: '' }
}

function visibleFiles(scope: 'local' | 'remote') {
  const state = pane(scope)
  const query = state.search.trim().toLowerCase()
  if (!query) return state.files
  return state.files.filter(file =>
    file.name.toLowerCase().includes(query) ||
    file.path.toLowerCase().includes(query)
  )
}

async function connectRemote() {
  const conn = selectedFileConnection.value
  const token = ++connectToken
  remoteSessionId.value = ''
  remote.value = conn ? remoteStateFor(conn.id) : emptyPane('~')
  remote.value.files = []
  remote.value.selectedPath = ''
  remote.value.error = ''
  if (!conn) return

  connecting.value = true
  try {
    const sessionId = await ensureFileSession(conn)
    if (token !== connectToken) return
    remoteSessionId.value = sessionId
    await loadRemote(remote.value.path || '~')
  } catch (e) {
    if (token !== connectToken) return
    remote.value.error = formatError(e)
  } finally {
    if (token === connectToken) {
      connecting.value = false
    }
  }
}

function remoteStateFor(connectionId: number) {
  if (!remoteStates.value[connectionId]) {
    remoteStates.value[connectionId] = emptyPane('~')
  }
  return remoteStates.value[connectionId]
}

async function loadLocal(path = local.value.path) {
  local.value.loading = true
  local.value.error = ''
  try {
    const { LocalListDir } = await import('../../../wailsjs/go/main/App')
    const result = await LocalListDir(path)
    local.value.path = result.path
    local.value.pathDraft = result.path
    local.value.files = result.files ?? []
    local.value.selectedPath = ''
  } catch (e) {
    local.value.error = formatError(e)
  } finally {
    local.value.loading = false
  }
}

async function loadRemote(path = remote.value.path) {
  if (!remoteSessionId.value) return
  remote.value.loading = true
  remote.value.error = ''
  try {
    const { RemoteListDir } = await import('../../../wailsjs/go/main/App')
    const result = await RemoteListDir(remoteSessionId.value, path || '~')
    remote.value.path = result.path
    remote.value.pathDraft = result.path
    remote.value.files = result.files ?? []
    remote.value.selectedPath = ''
  } catch (e) {
    remote.value.error = formatError(e)
  } finally {
    remote.value.loading = false
  }
}

function openItem(scope: 'local' | 'remote', file: FileItem) {
  if (!file.isDir) return
  if (scope === 'local') loadLocal(file.path)
  else loadRemote(file.path)
}

function parentPath(scope: 'local' | 'remote') {
  const path = scope === 'local' ? local.value.path : remote.value.path
  const sep = scope === 'local' && path.includes('\\') ? '\\' : '/'
  const trimmed = path.replace(/[\\/]+$/, '')
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (index <= 0) return sep === '\\' ? trimmed.slice(0, 3) : '/'
  return trimmed.slice(0, index)
}

async function mkdir(scope: 'local' | 'remote') {
  const name = window.prompt('Folder name')
  if (!name) return
  try {
    if (scope === 'local') {
      const { LocalMkdir } = await import('../../../wailsjs/go/main/App')
      await LocalMkdir(local.value.path, name)
      await loadLocal()
    } else {
      const { RemoteMkdir } = await import('../../../wailsjs/go/main/App')
      await RemoteMkdir(remoteSessionId.value, remote.value.path, name)
      await loadRemote()
    }
  } catch (e) {
    setError(scope, e)
  }
}

function showMenu(event: MouseEvent, scope: 'local' | 'remote', file: FileItem) {
  event.preventDefault()
  pane(scope).selectedPath = file.path
  menu.value = { open: true, x: event.clientX, y: event.clientY, scope, file }
}

async function renameMenu() {
  const { scope, file } = menu.value
  menu.value.open = false
  if (!file) return
  const next = window.prompt('New name', file.name)
  if (!next || next === file.name) return
  try {
    if (scope === 'local') {
      const { LocalRename } = await import('../../../wailsjs/go/main/App')
      await LocalRename(file.path, next)
      await loadLocal()
    } else {
      const { RemoteRename } = await import('../../../wailsjs/go/main/App')
      await RemoteRename(remoteSessionId.value, file.path, next)
      await loadRemote()
    }
  } catch (e) {
    setError(scope, e)
  }
}

async function deleteMenu() {
  const { scope, file } = menu.value
  menu.value.open = false
  if (!file || !window.confirm(`Delete ${file.name}?`)) return
  try {
    if (scope === 'local') {
      const { LocalDelete } = await import('../../../wailsjs/go/main/App')
      await LocalDelete(file.path)
      await loadLocal()
    } else {
      const { RemoteDelete } = await import('../../../wailsjs/go/main/App')
      await RemoteDelete(remoteSessionId.value, file.path)
      await loadRemote()
    }
  } catch (e) {
    setError(scope, e)
  }
}

async function uploadMenu() {
  const { scope, file } = menu.value
  menu.value.open = false
  if (scope !== 'local' || !file || !remoteSessionId.value) return
  await uploadLocalPath(file)
}

function dragLocal(event: DragEvent, file: FileItem) {
  event.dataTransfer?.setData('application/x-termflow-local-file', JSON.stringify(file))
}

function dragRemote(event: DragEvent, file: FileItem) {
  if (file.isDir) return
  event.dataTransfer?.setData('application/x-termflow-remote-file', JSON.stringify(file))
}

async function dropOnRemote(event: DragEvent) {
  const localFile = parseDrag(event, 'application/x-termflow-local-file')
  if (localFile) {
    await uploadLocalPath(localFile)
    return
  }
  if ((event.dataTransfer?.files.length ?? 0) > 0) {
    return
  }
  const osFiles = await collectBrowserUploadFiles(event)
  for (const item of osFiles) {
    await uploadBrowserFile(item.file, item.path)
  }
}

async function dropOnLocal(event: DragEvent) {
  const remoteFile = parseDrag(event, 'application/x-termflow-remote-file')
  if (!remoteFile || remoteFile.isDir) return
  try {
    const { RemoteDownloadToDir } = await import('../../../wailsjs/go/main/App')
    await RemoteDownloadToDir(remoteSessionId.value, remoteFile.path, local.value.path, remoteFile.name, remoteFile.size)
  } catch (e) {
    setError('local', e)
  }
}

async function uploadLocalPath(file: FileItem) {
  try {
    const { RemoteUploadLocalFile } = await import('../../../wailsjs/go/main/App')
    await RemoteUploadLocalFile(remoteSessionId.value, file.path, remote.value.path)
  } catch (e) {
    setError('remote', e)
  }
}

async function uploadBrowserFile(file: File, relativePath = file.name) {
  try {
    const appApi = await import('../../../wailsjs/go/main/App') as typeof import('../../../wailsjs/go/main/App') & {
      RemoteStartUploadPath?: (sessionId: string, remoteDir: string, relativePath: string, total: number) => Promise<{ transferId: string }>
    }
    const uploadPath = normalizeBrowserUploadPath(relativePath || file.name)
    const startUploadPath = appApi.RemoteStartUploadPath ?? (window as Window & {
      go?: { main?: { App?: { RemoteStartUploadPath?: (sessionId: string, remoteDir: string, relativePath: string, total: number) => Promise<{ transferId: string }> } } }
    }).go?.main?.App?.RemoteStartUploadPath
    if (!startUploadPath && uploadPath.includes('/')) {
      throw new Error('Folder upload API is not loaded. Restart wails dev to refresh Wails bindings.')
    }
    const result = startUploadPath
      ? await startUploadPath(remoteSessionId.value, remote.value.path, uploadPath, file.size)
      : await appApi.RemoteStartUpload(remoteSessionId.value, remote.value.path, file.name, file.size)
    const chunkSize = 192 * 1024
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const encoded = await blobToBase64(file.slice(offset, Math.min(offset + chunkSize, file.size)))
      await appApi.RemoteWriteUploadChunk(result.transferId, encoded, false)
    }
    await appApi.RemoteWriteUploadChunk(result.transferId, '', true)
  } catch (e) {
    setError('remote', e)
  }
}

async function collectBrowserUploadFiles(event: DragEvent): Promise<BrowserUploadFile[]> {
  const entries = Array.from(event.dataTransfer?.items ?? [])
    .map(item => (item as BrowserDataTransferItem).webkitGetAsEntry?.())
    .filter((entry): entry is BrowserFileSystemEntry => Boolean(entry))
  if (entries.length > 0) {
    const nested = await Promise.all(entries.map(entry => readBrowserEntry(entry)))
    return nested.flat()
  }
  return Array.from(event.dataTransfer?.files ?? []).map(file => ({
    file,
    path: normalizeBrowserUploadPath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name),
  }))
}

async function readBrowserEntry(entry: BrowserFileSystemEntry): Promise<BrowserUploadFile[]> {
  if (entry.isFile) {
    const file = await readBrowserFile(entry as BrowserFileSystemFileEntry)
    return [{ file, path: normalizeBrowserUploadPath(entry.fullPath || file.name) }]
  }
  if (!entry.isDirectory) return []

  const reader = (entry as BrowserFileSystemDirectoryEntry).createReader()
  const children: BrowserFileSystemEntry[] = []
  while (true) {
    const batch = await readBrowserDirectoryBatch(reader)
    if (batch.length === 0) break
    children.push(...batch)
  }
  const nested = await Promise.all(children.map(child => readBrowserEntry(child)))
  return nested.flat()
}

function readBrowserFile(entry: BrowserFileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

function readBrowserDirectoryBatch(reader: ReturnType<BrowserFileSystemDirectoryEntry['createReader']>): Promise<BrowserFileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject))
}

function normalizeBrowserUploadPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(Boolean).join('/')
}

function parseDrag(event: DragEvent, type: string): FileItem | null {
  const raw = event.dataTransfer?.getData(type)
  if (!raw) return null
  try {
    return JSON.parse(raw) as FileItem
  } catch {
    return null
  }
}

function baseName(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  return normalized.slice(normalized.lastIndexOf('/') + 1) || normalized
}

function removeTransfer(id: string) {
  transfers.value = transfers.value.filter(transfer => transfer.id !== id)
}

function clearFinishedTransfers() {
  transfers.value = transfers.value.filter(transfer => transfer.status !== 'done' && transfer.status !== 'error')
}

function pane(scope: 'local' | 'remote') {
  return scope === 'local' ? local.value : remote.value
}

function setError(scope: 'local' | 'remote', e: unknown) {
  pane(scope).error = formatError(e)
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatModified(seconds: number) {
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleString()
}

function formatError(e: unknown) {
  return e instanceof Error ? e.message : String(e)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result ?? '')
      resolve(value.includes(',') ? value.slice(value.indexOf(',') + 1) : value)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
</script>

<template>
  <div class="file-workbench" @click="menu.open = false">
    <section class="pane local-pane" @dragover.prevent @drop.prevent="dropOnLocal">
      <header class="pane-head">
        <div>
          <h2>Local Files</h2>
          <span>Windows workspace</span>
        </div>
        <button @click="loadLocal()">Refresh</button>
      </header>
      <div class="path-row">
        <input v-model="local.pathDraft" spellcheck="false" @keydown.enter.prevent="loadLocal(local.pathDraft)" />
        <button @click="loadLocal(parentPath('local'))">Parent</button>
        <button @click="mkdir('local')">Mkdir</button>
      </div>
      <label class="search-row">
        <span>Search</span>
        <input v-model="local.search" type="search" spellcheck="false" placeholder="Filter local files and folders" />
        <button v-if="local.search" type="button" title="Clear search" @click="local.search = ''">Clear</button>
      </label>
      <div v-if="local.error" class="pane-error">{{ local.error }}</div>
      <div v-else-if="local.loading" class="pane-state">Loading local files...</div>
      <div v-else class="file-list">
        <button
          v-for="file in visibleFiles('local')"
          :key="file.path"
          :class="['file-row', { selected: local.selectedPath === file.path, folder: file.isDir }]"
          draggable="true"
          :title="file.path"
          @click="local.selectedPath = file.path"
          @dblclick="openItem('local', file)"
          @contextmenu="showMenu($event, 'local', file)"
          @dragstart="dragLocal($event, file)"
        >
          <span class="file-icon">{{ file.isDir ? '[D]' : '[F]' }}</span>
          <span class="file-main">
            <strong>{{ file.name }}</strong>
            <small>{{ formatModified(file.modified) }}</small>
          </span>
          <span class="file-size">{{ file.isDir ? 'folder' : formatSize(file.size) }}</span>
        </button>
        <div v-if="local.files.length === 0" class="pane-state">Directory is empty.</div>
        <div v-else-if="visibleFiles('local').length === 0" class="pane-state">No local files or folders match this search.</div>
      </div>
    </section>

    <section ref="remotePaneEl" class="pane remote-pane" @dragover.prevent @drop.prevent="dropOnRemote">
      <header class="pane-head">
        <div>
          <h2>Remote Files</h2>
          <span>{{ selectedName }}</span>
        </div>
        <button :disabled="!remoteSessionId || remote.loading" @click="loadRemote()">Refresh</button>
      </header>
      <div class="path-row">
        <input v-model="remote.pathDraft" :disabled="!remoteSessionId" spellcheck="false" @keydown.enter.prevent="loadRemote(remote.pathDraft)" />
        <button :disabled="!remoteSessionId" @click="loadRemote(parentPath('remote'))">Parent</button>
        <button :disabled="!remoteSessionId" @click="mkdir('remote')">Mkdir</button>
      </div>
      <label v-if="remoteSessionId" class="search-row">
        <span>Search</span>
        <input v-model="remote.search" type="search" spellcheck="false" placeholder="Filter remote files and folders" />
        <button v-if="remote.search" type="button" title="Clear search" @click="remote.search = ''">Clear</button>
      </label>
      <div v-if="remote.error" class="pane-error">{{ remote.error }}</div>
      <div v-else-if="connecting || remote.loading" class="pane-state">{{ connecting ? 'Connecting remote server...' : 'Loading remote files...' }}</div>
      <div v-else-if="!remoteSessionId" class="pane-state">Select a server from the left.</div>
      <div v-else class="file-list">
        <button
          v-for="file in visibleFiles('remote')"
          :key="file.path"
          :class="['file-row', { selected: remote.selectedPath === file.path, folder: file.isDir }]"
          :draggable="!file.isDir"
          :title="file.path"
          @click="remote.selectedPath = file.path"
          @dblclick="openItem('remote', file)"
          @contextmenu="showMenu($event, 'remote', file)"
          @dragstart="dragRemote($event, file)"
        >
          <span class="file-icon">{{ file.isDir ? '[D]' : '[F]' }}</span>
          <span class="file-main">
            <strong>{{ file.name }}</strong>
            <small>{{ formatModified(file.modified) }}</small>
          </span>
          <span class="file-size">{{ file.isDir ? 'folder' : formatSize(file.size) }}</span>
        </button>
        <div v-if="remote.files.length === 0" class="pane-state">Directory is empty.</div>
        <div v-else-if="visibleFiles('remote').length === 0" class="pane-state">No remote files or folders match this search.</div>
      </div>
    </section>

    <aside v-if="transfers.length" class="transfer-panel">
      <div class="transfer-title">
        <span>Transfers</span>
        <button
          v-if="transfers.some(transfer => transfer.status === 'done' || transfer.status === 'error')"
          class="transfer-clear"
          title="Clear finished transfers"
          @click="clearFinishedTransfers"
        >
          Clear
        </button>
      </div>
      <div v-for="transfer in transfers.slice(0, 5)" :key="transfer.id" class="transfer-row">
        <div class="transfer-line">
          <span>{{ transfer.kind }} {{ transfer.name }}</span>
          <span class="transfer-actions">
            <strong>{{ transfer.status === 'error' ? 'failed' : `${Math.round(transfer.percent || 0)}%` }}</strong>
            <button class="transfer-remove" title="Remove transfer record" @click="removeTransfer(transfer.id)">x</button>
          </span>
        </div>
        <small>{{ transfer.targetPath || transfer.savePath }}</small>
        <div class="progress"><i :style="{ width: `${transfer.status === 'done' ? 100 : transfer.percent || 0}%` }" /></div>
        <em v-if="transfer.error">{{ transfer.error }}</em>
      </div>
    </aside>

    <div v-if="menu.open" class="context-menu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }" @click.stop>
      <button v-if="menu.scope === 'local'" :disabled="!remoteSessionId" @click="uploadMenu">Upload</button>
      <button @click="renameMenu">Rename</button>
      <button class="danger" @click="deleteMenu">Delete</button>
    </div>
  </div>
</template>

<style scoped>
.file-workbench {
  position: relative;
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(360px, 1.15fr);
  gap: 1px;
  height: 100%;
  min-height: 0;
  background: var(--faint);
  color: var(--ink);
}
.pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--paper);
}
.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1.2px solid var(--faint);
  background: var(--paper-tabbar);
}
.pane-head h2 {
  margin: 0;
  color: var(--ink);
  font-size: 18px;
}
.pane-head span,
.pane-state,
.pane-error {
  color: var(--pencil);
  font-family: 'Kalam', 'Caveat', cursive;
}
button {
  min-height: 28px;
  border: 1.2px solid var(--faint);
  border-radius: var(--radius);
  background: rgba(250, 248, 244, 0.72);
  color: var(--ink);
  cursor: pointer;
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 14px;
  line-height: 1;
  padding: 0 10px;
  box-shadow: 0 1px 0 rgba(43, 42, 40, 0.08);
}
button:hover:not(:disabled) {
  border-color: var(--ink);
  background: var(--highlight);
}
button:disabled {
  color: var(--pencil);
  border-color: var(--faint);
  background: rgba(250, 248, 244, 0.35);
  box-shadow: none;
  opacity: 0.62;
  cursor: not-allowed;
}
.path-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 7px;
  padding: 10px 14px;
  border-bottom: 1.2px solid var(--faint);
}
.path-row input {
  min-width: 0;
  border: 1.2px dashed var(--pencil);
  border-radius: var(--radius);
  background: rgba(250, 248, 244, 0.58);
  padding: 6px 8px;
  color: var(--ink);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  outline: none;
}
.search-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1.2px solid var(--faint);
  color: var(--pencil);
  font-family: 'Kalam', 'Caveat', cursive;
}
.search-row input {
  min-width: 0;
  height: 28px;
  border: 1.2px dashed var(--pencil);
  border-radius: var(--radius);
  background: rgba(250, 248, 244, 0.58);
  color: var(--ink);
  outline: none;
  padding: 0 9px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.search-row input:focus {
  border-color: var(--ink);
  background: var(--paper);
}
.pane-state,
.pane-error {
  padding: 14px;
}
.pane-error {
  color: var(--env-prod);
}
.file-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
}
.file-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-bottom: 4px;
  padding: 8px;
  border: 1.2px solid transparent;
  background: transparent;
  text-align: left;
  cursor: default;
}
.file-row[draggable="true"] {
  cursor: grab;
}
.file-row:hover,
.file-row.selected {
  border-color: var(--ink);
  background: var(--highlight);
}
.file-row.folder {
  background: rgba(66, 166, 116, 0.07);
}
.file-icon,
.file-size,
.file-main small {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}
.file-icon {
  color: var(--remote-folder-color, var(--env-dev));
}
.file-main {
  min-width: 0;
}
.file-main strong,
.file-main small,
.file-size {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-main strong {
  color: var(--ink);
  font-family: 'Kalam', 'Caveat', cursive;
  font-size: 15px;
}
.file-main small,
.file-size {
  color: var(--pencil);
}
.file-size {
  justify-self: end;
}
.transfer-panel {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 18px;
  z-index: 8;
  max-height: 190px;
  overflow: auto;
  border: 1.4px solid var(--ink);
  border-radius: var(--radius);
  background: var(--paper);
  box-shadow: 0 14px 30px rgba(28, 27, 25, 0.18);
  padding: 10px 12px;
}
.transfer-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 7px;
  color: var(--pencil);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.transfer-row {
  padding: 6px 0;
}
.transfer-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-family: 'Kalam', 'Caveat', cursive;
}
.transfer-line > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.transfer-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}
.transfer-clear,
.transfer-remove {
  min-height: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}
.transfer-remove {
  width: 20px;
  padding: 0;
  color: var(--pencil);
}
.transfer-row small,
.transfer-row em {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--pencil);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-style: normal;
}
.transfer-row em {
  color: var(--env-prod);
}
.progress {
  height: 7px;
  margin-top: 5px;
  border: 1px solid var(--ink);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(250, 248, 244, 0.72);
}
.progress i {
  display: block;
  height: 100%;
  background: var(--env-dev);
}
.context-menu {
  position: fixed;
  z-index: 20;
  width: 132px;
  padding: 5px;
  border: 1.2px solid var(--ink);
  border-radius: var(--radius);
  background: var(--paper);
  box-shadow: 0 10px 24px rgba(28, 27, 25, 0.2);
}
.context-menu button {
  display: block;
  width: 100%;
  height: 28px;
  border: none;
  text-align: left;
}
.context-menu button:hover {
  background: var(--highlight);
}
.context-menu .danger {
  color: var(--env-prod);
}

@media (max-width: 980px) {
  .file-workbench {
    grid-template-columns: 1fr;
  }
}
</style>
