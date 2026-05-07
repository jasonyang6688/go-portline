<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { EventsOn } from '../../../wailsjs/runtime/runtime'
import { registerFileDropTarget } from '../../stores/fileDrops'
import CodeEditor from './CodeEditor.vue'

const props = defineProps<{
  sessionId: string | null
  sessionName?: string
  pathRequest?: { path: string; nonce: number } | null
}>()
defineEmits<{ (e: 'close'): void }>()

interface RemoteFile {
  name: string
  path: string
  isDir: boolean
  size: number
  modified: number
}

interface SessionFileState {
  path: string
  pathDraft: string
  search: string
  files: RemoteFile[]
  selectedPath: string
}

interface EditorTab {
  id: string
  sessionId: string
  name: string
  path: string
  content: string
  dirty: boolean
  saving: boolean
}

const states = ref<Record<string, SessionFileState>>({})
const transfers = ref<TransferProgress[]>([])
const editOpen = ref(false)
const editTabs = ref<EditorTab[]>([])
const activeEditId = ref('')
const menu = ref<{ open: boolean; x: number; y: number; file: RemoteFile | null }>({
  open: false,
  x: 0,
  y: 0,
  file: null,
})
const loading = ref(false)
const error = ref('')
const dragging = ref(false)
const drawerEl = ref<HTMLElement | null>(null)
const drawerWidth = ref(loadDrawerWidth())
const resizing = ref(false)
let removeTransferListener: (() => void) | undefined
let removeFileDropTarget: (() => void) | undefined
let startX = 0
let startWidth = 0

const activeEditor = computed(() => editTabs.value.find(tab => tab.id === activeEditId.value) ?? null)
const activeEditContent = computed({
  get() {
    return activeEditor.value?.content ?? ''
  },
  set(value: string) {
    const tab = activeEditor.value
    if (!tab || tab.content === value) return
    tab.content = value
    tab.dirty = true
  },
})

function loadDrawerWidth() {
  const saved = Number(window.localStorage?.getItem('termflow.files.width') || 0)
  return Number.isFinite(saved) && saved >= 360 ? saved : 480
}

function startResize(event: MouseEvent) {
  resizing.value = true
  startX = event.clientX
  startWidth = drawerWidth.value
  window.addEventListener('mousemove', resizeDrawer)
  window.addEventListener('mouseup', stopResize)
}

function resizeDrawer(event: MouseEvent) {
  if (!resizing.value) return
  const next = startWidth + (startX - event.clientX)
  const max = Math.max(420, Math.floor(window.innerWidth * 0.72))
  drawerWidth.value = Math.min(max, Math.max(360, next))
}

function stopResize() {
  resizing.value = false
  window.removeEventListener('mousemove', resizeDrawer)
  window.removeEventListener('mouseup', stopResize)
  window.localStorage?.setItem('termflow.files.width', String(Math.round(drawerWidth.value)))
}

function currentKey() {
  return props.sessionId || 'none'
}

function currentState() {
  const key = currentKey()
  if (!states.value[key]) {
    states.value[key] = {
      path: '~',
      pathDraft: '~',
      search: '',
      files: [],
      selectedPath: '',
    }
  }
  return states.value[key]
}

function visibleFiles() {
  const state = currentState()
  const query = state.search.trim().toLowerCase()
  if (!query) return state.files
  return state.files.filter(file =>
    file.name.toLowerCase().includes(query) ||
    file.path.toLowerCase().includes(query)
  )
}

function selectedFile() {
  const state = currentState()
  return state.files.find(file => file.path === state.selectedPath) ?? null
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

onMounted(() => {
  removeTransferListener = EventsOn('transfer:progress', (progress: TransferProgress) => {
    const index = transfers.value.findIndex(t => t.id === progress.id)
    if (index >= 0) {
      transfers.value[index] = progress
    } else {
      transfers.value.unshift(progress)
    }
    if (progress.status === 'done' && progress.kind === 'upload') {
      load()
    }
  })
  removeFileDropTarget = registerFileDropTarget({
    element: () => drawerEl.value,
    enabled: () => Boolean(props.sessionId),
    onDrop: paths => paths.forEach(path => uploadLocalPath(path)),
  })
  load()
})
onUnmounted(() => {
  removeTransferListener?.()
  removeFileDropTarget?.()
})
watch(() => props.sessionId, () => {
  const state = currentState()
  load(state.path)
})
watch(() => props.pathRequest?.nonce, () => {
  if (props.pathRequest?.path) {
    load(props.pathRequest.path)
  }
})

async function load(nextPath = currentState().path) {
  if (!props.sessionId) return
  const state = currentState()
  loading.value = true
  error.value = ''
  try {
    const { RemoteListDir } = await import('../../../wailsjs/go/main/App')
    const result = await RemoteListDir(props.sessionId, nextPath)
    state.path = result.path || nextPath
    state.pathDraft = state.path
    state.files = result.files ?? []
    state.selectedPath = ''
  } catch (e) {
    error.value = formatError(e)
  } finally {
    loading.value = false
  }
}

function goToDraftPath() {
  const next = currentState().pathDraft.trim()
  if (next) {
    load(next)
  }
}

function openFile(file: RemoteFile) {
  if (file.isDir) {
    load(file.path)
  }
}

function parentPath() {
  const path = currentState().path
  if (!path || path === '/') return '/'
  const trimmed = path.replace(/\/+$/, '')
  const index = trimmed.lastIndexOf('/')
  return index <= 0 ? '/' : trimmed.slice(0, index)
}

async function mkdir() {
  const name = window.prompt('Folder name')
  if (!name || !props.sessionId) return
  loading.value = true
  error.value = ''
  try {
    const { RemoteMkdir } = await import('../../../wailsjs/go/main/App')
    await RemoteMkdir(props.sessionId, currentState().path, name)
    await load()
  } catch (e) {
    error.value = formatError(e)
  } finally {
    loading.value = false
  }
}

async function upload() {
  if (!props.sessionId) return
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.onchange = () => {
    const selectedFiles = Array.from(input.files ?? [])
    selectedFiles.forEach(file => uploadFile(file))
  }
  input.click()
}

async function uploadFile(file: File, relativePath = file.name) {
  if (!props.sessionId) return
  const uploadPath = normalizeBrowserUploadPath(relativePath || file.name)
  const localId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
  upsertTransfer({
    id: localId,
    name: uploadPath,
    kind: 'upload',
    written: 0,
    total: file.size,
    percent: 0,
    status: 'queued',
    targetPath: `${currentState().path.replace(/\/$/, '')}/${uploadPath}`,
  })
  error.value = ''
  try {
    const appApi = await import('../../../wailsjs/go/main/App') as typeof import('../../../wailsjs/go/main/App') & {
      RemoteStartUploadPath?: (sessionId: string, remoteDir: string, relativePath: string, total: number) => Promise<{ transferId: string }>
    }
    if (typeof appApi.RemoteStartUpload !== 'function' || typeof appApi.RemoteWriteUploadChunk !== 'function') {
      throw new Error('Upload API is not loaded. Restart wails dev to refresh Wails bindings.')
    }
    const startUploadPath = appApi.RemoteStartUploadPath ?? (window as Window & {
      go?: { main?: { App?: { RemoteStartUploadPath?: (sessionId: string, remoteDir: string, relativePath: string, total: number) => Promise<{ transferId: string }> } } }
    }).go?.main?.App?.RemoteStartUploadPath
    if (!startUploadPath && uploadPath.includes('/')) {
      throw new Error('Folder upload API is not loaded. Restart wails dev to refresh Wails bindings.')
    }
    const result = startUploadPath
      ? await startUploadPath(props.sessionId, currentState().path, uploadPath, file.size)
      : await appApi.RemoteStartUpload(props.sessionId, currentState().path, file.name, file.size)
    replaceTransferId(localId, result.transferId)
    const chunkSize = 192 * 1024
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size))
      const encoded = await blobToBase64(chunk)
      await appApi.RemoteWriteUploadChunk(result.transferId, encoded, false)
    }
    await appApi.RemoteWriteUploadChunk(result.transferId, '', true)
  } catch (e) {
    const message = formatError(e)
    if (!message.toLowerCase().includes('canceled')) {
      error.value = message
      markTransferError(localId, message)
    }
  }
}

async function uploadLocalPath(path: string) {
  if (!props.sessionId) return
  error.value = ''
  try {
    const { RemoteUploadLocalFile } = await import('../../../wailsjs/go/main/App')
    await RemoteUploadLocalFile(props.sessionId, path, currentState().path)
  } catch (e) {
    const message = formatError(e)
    if (!message.toLowerCase().includes('canceled')) {
      error.value = message
    }
  }
}

async function download() {
  const file = selectedFile()
  if (!props.sessionId || !file || file.isDir) return
  await startDownload(file)
}

async function startDownload(file: RemoteFile) {
  if (!props.sessionId) return
  error.value = ''
  try {
    const appApi = await import('../../../wailsjs/go/main/App') as typeof import('../../../wailsjs/go/main/App') & {
      RemoteStartDownloadDir?: (sessionId: string, remotePath: string, name: string) => Promise<{ transferId: string }>
    }
    if (file.isDir) {
      const startDirDownload = appApi.RemoteStartDownloadDir ?? (window as Window & {
        go?: { main?: { App?: { RemoteStartDownloadDir?: (sessionId: string, remotePath: string, name: string) => Promise<{ transferId: string }> } } }
      }).go?.main?.App?.RemoteStartDownloadDir
      if (!startDirDownload) {
        throw new Error('Folder download API is not loaded. Restart wails dev to refresh Wails bindings.')
      }
      await startDirDownload(props.sessionId, file.path, file.name)
    } else {
      await appApi.RemoteStartDownload(props.sessionId, file.path, file.name, file.size)
    }
  } catch (e) {
    const message = formatError(e)
    if (!message.toLowerCase().includes('canceled')) {
      error.value = message
    }
  }
}

async function editSelected() {
  const file = selectedFile()
  if (!props.sessionId || !file || file.isDir) return
  error.value = ''
  try {
    const { RemoteReadTextFile } = await import('../../../wailsjs/go/main/App')
    if (typeof RemoteReadTextFile !== 'function') {
      throw new Error('Edit API is not loaded. Restart wails dev to refresh Wails bindings.')
    }
    const id = editorTabId(props.sessionId, file.path)
    const existing = editTabs.value.find(tab => tab.id === id)
    if (existing) {
      activeEditId.value = existing.id
      editOpen.value = true
      return
    }
    const content = await RemoteReadTextFile(props.sessionId, file.path)
    editTabs.value.push({
      id,
      sessionId: props.sessionId,
      name: file.name,
      path: file.path,
      content,
      dirty: false,
      saving: false,
    })
    activeEditId.value = id
    editOpen.value = true
  } catch (e) {
    error.value = formatError(e)
  }
}

function editorTabId(sessionId: string, path: string) {
  return `${sessionId}:${path}`
}

function activateEditorTab(id: string) {
  activeEditId.value = id
  editOpen.value = true
}

function closeEditorTab(id: string) {
  const index = editTabs.value.findIndex(tab => tab.id === id)
  if (index < 0) return
  const tab = editTabs.value[index]
  if (tab.dirty && !window.confirm(`Close ${tab.name} without saving?`)) return

  editTabs.value.splice(index, 1)
  if (activeEditId.value === id) {
    const next = editTabs.value[Math.min(index, editTabs.value.length - 1)]
    activeEditId.value = next?.id ?? ''
  }
  if (editTabs.value.length === 0) {
    editOpen.value = false
  }
}

function closeEditorWindow() {
  editOpen.value = false
}

function openContextMenu(event: MouseEvent, file: RemoteFile) {
  event.preventDefault()
  currentState().selectedPath = file.path
  menu.value = {
    open: true,
    x: event.clientX,
    y: event.clientY,
    file,
  }
}

function closeContextMenu() {
  menu.value.open = false
}

async function menuDownload() {
  const file = menu.value.file
  closeContextMenu()
  if (file) {
    await startDownload(file)
  }
}

async function menuEdit() {
  closeContextMenu()
  await editSelected()
}

async function menuRename() {
  const file = menu.value.file
  closeContextMenu()
  if (!props.sessionId || !file) return

  const newName = window.prompt('New name', file.name)
  if (!newName || newName === file.name) return
  error.value = ''
  try {
    const { RemoteRename } = await import('../../../wailsjs/go/main/App')
    await RemoteRename(props.sessionId, file.path, newName)
    await load()
  } catch (e) {
    error.value = formatError(e)
  }
}

async function menuDelete() {
  const file = menu.value.file
  closeContextMenu()
  if (!props.sessionId || !file) return
  if (!window.confirm(`Delete ${file.name}?`)) return

  error.value = ''
  try {
    const { RemoteDelete } = await import('../../../wailsjs/go/main/App')
    await RemoteDelete(props.sessionId, file.path)
    await load()
  } catch (e) {
    error.value = formatError(e)
  }
}

async function saveEdit(tab = activeEditor.value) {
  if (!tab) return
  tab.saving = true
  error.value = ''
  try {
    const { RemoteWriteTextFile } = await import('../../../wailsjs/go/main/App')
    await RemoteWriteTextFile(tab.sessionId, tab.path, tab.content)
    tab.dirty = false
    if (tab.sessionId === props.sessionId) {
      await load()
    }
  } catch (e) {
    error.value = formatError(e)
  } finally {
    tab.saving = false
  }
}

async function saveAllEdits() {
  for (const tab of editTabs.value.filter(tab => tab.dirty)) {
    await saveEdit(tab)
  }
}

async function onDrop(event: DragEvent) {
  dragging.value = false
  if ((event.dataTransfer?.files.length ?? 0) > 0) {
    return
  }
  const dropped = await collectBrowserUploadFiles(event)
  dropped.forEach(item => uploadFile(item.file, item.path))
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

function onRemoteDragStart(file: RemoteFile) {
  currentState().selectedPath = file.path
  if (!file.isDir) {
    startDownload(file)
  }
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatModified(seconds: number) {
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatError(e: unknown) {
  return e instanceof Error ? e.message : String(e)
}

function upsertTransfer(progress: TransferProgress) {
  const index = transfers.value.findIndex(t => t.id === progress.id)
  if (index >= 0) {
    transfers.value[index] = { ...transfers.value[index], ...progress }
  } else {
    transfers.value.unshift(progress)
  }
}

function replaceTransferId(oldId: string, newId: string) {
  const index = transfers.value.findIndex(t => t.id === oldId)
  if (index >= 0) {
    transfers.value[index] = { ...transfers.value[index], id: newId, status: 'running' }
  }
}

function markTransferError(id: string, message: string) {
  const index = transfers.value.findIndex(t => t.id === id)
  if (index >= 0) {
    transfers.value[index] = { ...transfers.value[index], status: 'error', error: message }
  }
}

function removeTransfer(id: string) {
  transfers.value = transfers.value.filter(transfer => transfer.id !== id)
}

function clearFinishedTransfers() {
  transfers.value = transfers.value.filter(transfer => transfer.status !== 'done' && transfer.status !== 'error')
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
  <aside
    ref="drawerEl"
    :class="['sftp-drawer', { dragging, resizing }]"
    :style="{ width: `${drawerWidth}px` }"
    aria-label="Remote file manager"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
    @click="closeContextMenu"
  >
    <div class="resize-handle" title="Drag to resize files panel" @mousedown.prevent="startResize" />
    <div class="drawer-head">
      <div>
        <div class="drawer-title wf-label">Files - {{ sessionName || 'session' }}</div>
        <div class="path-row">
          <input
            v-model="currentState().pathDraft"
            class="drawer-path-input"
            spellcheck="false"
            title="Remote path"
            @keydown.enter.prevent="goToDraftPath"
          />
          <button class="path-go" title="Open path" @click="goToDraftPath">Go</button>
        </div>
      </div>
      <button class="icon-btn" title="Close files" @click="$emit('close')">x</button>
    </div>

    <div class="drawer-actions">
      <button :disabled="loading || !sessionId" @click="load(parentPath())">Up Parent</button>
      <button :disabled="loading || !sessionId" @click="upload">Upload</button>
      <button :disabled="loading || !sessionId" @click="mkdir">Mkdir</button>
      <button :disabled="loading || !sessionId" @click="load()">Refresh</button>
    </div>

    <label v-if="sessionId" class="search-row">
      <span>Search</span>
      <input
        v-model="currentState().search"
        type="search"
        spellcheck="false"
        placeholder="Filter files and folders"
      />
      <button
        v-if="currentState().search"
        type="button"
        title="Clear search"
        @click="currentState().search = ''"
      >
        Clear
      </button>
    </label>

    <div v-if="error" class="drawer-error">{{ error }}</div>
    <div v-else-if="loading" class="drawer-state">Loading remote files...</div>
    <div v-else-if="!sessionId" class="drawer-state">Open a session to browse files.</div>

    <div v-else class="file-list">
      <button
        v-for="file in visibleFiles()"
        :key="file.path"
        :class="['file-row', { selected: currentState().selectedPath === file.path }]"
        :title="file.path"
        :draggable="!file.isDir"
        @click="currentState().selectedPath = file.path"
        @dblclick="openFile(file)"
        @contextmenu="openContextMenu($event, file)"
        @dragstart="onRemoteDragStart(file)"
      >
        <span :class="['file-icon', file.isDir ? 'folder' : 'file']">
          {{ file.isDir ? '[D]' : '[F]' }}
        </span>
        <span class="file-main">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-meta">{{ formatModified(file.modified) }}</span>
        </span>
        <span :class="['file-size', { folder: file.isDir }]">
          {{ file.isDir ? 'folder' : formatSize(file.size) }}
        </span>
      </button>
      <div v-if="currentState().files.length === 0" class="drawer-state">Directory is empty.</div>
      <div v-else-if="visibleFiles().length === 0" class="drawer-state">No files or folders match this search.</div>
    </div>

    <div class="drop-zone">
      Drop local files here to upload. Drag a remote file out or use Download to save it.
    </div>

    <div v-if="transfers.length > 0" class="transfer-list">
      <div class="transfer-head">
        <span class="wf-label">Transfers</span>
        <span class="transfer-head-actions">
          <button
            v-if="transfers.some(transfer => transfer.status === 'done' || transfer.status === 'error')"
            class="transfer-clear"
            title="Clear finished transfers"
            @click="clearFinishedTransfers"
          >
            Clear
          </button>
          <span>{{ transfers.length }}</span>
        </span>
      </div>
      <div v-for="transfer in transfers" :key="transfer.id" class="transfer-row">
        <div class="transfer-meta">
          <span>{{ transfer.kind === 'upload' ? 'Upload' : 'Download' }} {{ transfer.name }}</span>
          <span class="transfer-actions">
            <strong>{{ transfer.status === 'error' ? 'failed' : `${Math.round(transfer.percent || 0)}%` }}</strong>
            <button class="transfer-remove" title="Remove transfer record" @click="removeTransfer(transfer.id)">x</button>
          </span>
        </div>
        <div v-if="transfer.targetPath" class="transfer-target">{{ transfer.targetPath }}</div>
        <div class="progress"><i :style="{ width: `${transfer.status === 'done' ? 100 : transfer.percent || 0}%` }" /></div>
        <div v-if="transfer.error" class="transfer-error">{{ transfer.error }}</div>
      </div>
    </div>

    <div
      v-if="menu.open"
      class="context-menu"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      @click.stop
    >
      <button :disabled="menu.file?.isDir" @click="menuEdit">Edit</button>
      <button @click="menuDownload">Download</button>
      <button @click="menuRename">Rename</button>
      <button class="danger" @click="menuDelete">Delete</button>
    </div>

    <Teleport to="body">
      <div v-if="editOpen" class="editor-backdrop">
        <section class="editor-panel">
          <div class="editor-head">
            <div>
              <strong>Remote Editor</strong>
              <span>{{ activeEditor?.path }}</span>
            </div>
            <button class="icon-btn" title="Close editor" @click="closeEditorWindow">x</button>
          </div>
          <div class="editor-tabs">
            <button
              v-for="tab in editTabs"
              :key="tab.id"
              type="button"
              :class="['editor-tab', { active: tab.id === activeEditId, dirty: tab.dirty }]"
              :title="tab.path"
              @click="activateEditorTab(tab.id)"
            >
              <span>{{ tab.name }}</span>
              <i v-if="tab.dirty" aria-hidden="true" />
              <em
                role="button"
                title="Close file"
                @click.stop="closeEditorTab(tab.id)"
              >x</em>
            </button>
          </div>
          <CodeEditor
            v-if="activeEditor"
            v-model="activeEditContent"
            :file-path="activeEditor.path"
            @save="saveEdit()"
          />
          <div class="editor-actions">
            <button @click="closeEditorWindow">Hide</button>
            <button :disabled="!editTabs.some(tab => tab.dirty)" @click="saveAllEdits">Save All</button>
            <button :disabled="!activeEditor || activeEditor.saving" @click="saveEdit()">
              {{ activeEditor?.saving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </aside>
</template>

<style scoped>
.sftp-drawer {
  min-width: 360px;
  max-width: 72vw;
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--paper);
  border-left: 1.5px solid var(--ink);
  box-shadow: -12px 0 28px rgba(28, 27, 25, 0.18);
  color: var(--ink);
}
.sftp-drawer.resizing {
  user-select: none;
}
.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -4px;
  width: 8px;
  z-index: 12;
  cursor: ew-resize;
}
.resize-handle:hover::after,
.sftp-drawer.resizing .resize-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  width: 2px;
  background: var(--env-dev);
}
.sftp-drawer.dragging {
  outline: 2px dashed var(--env-dev);
  outline-offset: -8px;
}
.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: var(--paper-tabbar);
  border-bottom: 1.2px solid var(--faint);
}
.drawer-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
}
.drawer-path-input,
.file-size {
  font-family: 'JetBrains Mono', monospace;
}
.path-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}
.drawer-path-input {
  width: min(300px, 32vw);
  height: 22px;
  border: 1.1px dashed var(--pencil);
  border-radius: var(--radius);
  background: rgba(250, 248, 244, 0.58);
  padding: 0 7px;
  font-size: 11px;
  color: var(--pencil);
  outline: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drawer-path-input:focus {
  border-color: var(--ink);
  background: var(--paper);
  color: var(--ink);
}
.path-go {
  height: 22px;
  padding: 0 8px;
  border: 1.1px solid var(--ink);
  border-radius: var(--radius);
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  font-family: 'Caveat', cursive;
  font-weight: 700;
}
.icon-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--pencil);
  cursor: pointer;
  font-size: 18px;
}
.icon-btn:hover { background: var(--highlight); color: var(--ink); }
.drawer-actions {
  display: flex;
  gap: 6px;
  padding: 8px 14px;
  border-bottom: 1.2px solid var(--faint);
}
.drawer-actions button,
.search-row button {
  height: 26px;
  padding: 0 10px;
  border: 1.2px solid var(--ink);
  border-radius: 20px;
  background: transparent;
  color: var(--ink);
  font-family: 'Caveat', cursive;
  font-weight: 700;
  cursor: pointer;
}
.drawer-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
.drawer-error,
.drawer-state,
.drawer-note {
  padding: 14px;
  color: var(--pencil);
  font-family: 'Kalam', 'Caveat', cursive;
}
.drawer-error {
  color: var(--env-prod);
}
.file-list {
  flex: 1;
  overflow: auto;
  padding: 6px;
}
.file-row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 8px;
  border: 1.2px solid transparent;
  border-radius: var(--radius);
  background: transparent;
  color: var(--ink);
  cursor: default;
  text-align: left;
}
.file-row[draggable="true"] {
  cursor: grab;
}
.file-row[draggable="true"]:active {
  cursor: grabbing;
}
.file-row:hover {
  background: var(--highlight);
  border-color: var(--ink);
}
.file-row:has(.file-icon.folder) {
  background: rgba(66, 166, 116, 0.07);
}
.file-row:has(.file-icon.folder):hover {
  background: rgba(66, 166, 116, 0.14);
}
.file-row.selected {
  background: var(--highlight);
  border-color: var(--ink);
}
.file-icon {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  color: var(--pencil);
  font-size: 13px;
}
.file-icon.folder {
  background: rgba(66, 166, 116, 0.16);
  color: var(--remote-folder-color, var(--env-dev));
}
.file-icon.file {
  background: rgba(43, 42, 40, 0.06);
  color: var(--remote-file-color, var(--pencil));
}
.file-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.file-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Kalam', 'Caveat', cursive;
  font-size: 15px;
}
.file-row:has(.file-icon.folder) .file-name {
  font-weight: 700;
}
.file-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--pencil);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}
.file-size {
  color: var(--pencil);
  font-size: 11px;
}
.file-size.folder {
  color: var(--remote-folder-color, var(--env-dev));
  font-weight: 700;
}
.drop-zone,
.transfer-list {
  border-top: 1.2px solid var(--faint);
  background: var(--paper-tabbar);
}
.drop-zone {
  margin: 8px 12px;
  padding: 12px;
  border: 1.4px dashed var(--pencil);
  border-radius: var(--radius);
  text-align: center;
  color: var(--pencil);
  font-family: 'Kalam', 'Caveat', cursive;
  font-size: 13px;
}
.sftp-drawer.dragging .drop-zone {
  border-color: var(--env-dev);
  color: var(--ink);
  background: rgba(66, 166, 116, 0.12);
}
.transfer-list {
  padding: 9px 12px 12px;
  max-height: 180px;
  overflow: auto;
}
.transfer-head,
.transfer-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.transfer-head-actions,
.transfer-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}
.transfer-head {
  margin-bottom: 8px;
  color: var(--pencil);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.transfer-row {
  padding: 7px 0;
}
.transfer-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Kalam', 'Caveat', cursive;
  color: var(--ink);
}
.transfer-meta strong,
.transfer-error,
.transfer-target {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--pencil);
}
.transfer-clear,
.transfer-remove {
  height: 20px;
  padding: 0 6px;
  border: 1.1px solid var(--faint);
  border-radius: 4px;
  background: rgba(250, 248, 244, 0.72);
  color: var(--pencil);
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}
.transfer-clear:hover,
.transfer-remove:hover {
  border-color: var(--ink);
  color: var(--ink);
  background: var(--highlight);
}
.transfer-remove {
  width: 20px;
  padding: 0;
}
.transfer-target {
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.progress {
  height: 7px;
  margin-top: 5px;
  border: 1px solid var(--ink);
  border-radius: 6px;
  overflow: hidden;
  background: rgba(250, 248, 244, 0.72);
}
.progress i {
  display: block;
  height: 100%;
  background: var(--env-dev);
}
.transfer-error {
  margin-top: 4px;
  color: var(--env-prod);
  white-space: normal;
}
.context-menu {
  position: fixed;
  z-index: 20;
  width: 138px;
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
  padding: 0 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  font-family: 'Kalam', 'Caveat', cursive;
  font-size: 14px;
}
.context-menu button:hover:not(:disabled) {
  background: var(--highlight);
}
.context-menu button.danger {
  color: var(--env-prod);
}
.context-menu button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.editor-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: rgba(28, 27, 25, 0.22);
}
.editor-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  margin: 12px;
  border: 1.4px solid var(--ink);
  border-radius: var(--radius);
  background: var(--paper);
  overflow: hidden;
}
.editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 10px;
  border-bottom: 1.2px solid var(--faint);
}
.editor-head strong,
.editor-head span {
  display: block;
}
.editor-head strong {
  color: var(--ink);
  font-family: 'Caveat', cursive;
  font-size: 17px;
}
.editor-head span {
  max-width: min(72vw, 960px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--pencil);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}
.editor-tabs {
  min-height: 36px;
  display: flex;
  align-items: stretch;
  gap: 4px;
  padding: 5px 8px 0;
  border-bottom: 1.2px solid var(--faint);
  background: var(--paper-tabbar);
  overflow-x: auto;
}
.editor-tab {
  max-width: 220px;
  min-width: 96px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 7px 0 10px;
  border: 1.1px solid var(--faint);
  border-bottom: none;
  border-radius: var(--radius) var(--radius) 0 0;
  background: rgba(250, 248, 244, 0.58);
  color: var(--pencil);
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.editor-tab.active {
  background: #1c1b19;
  border-color: var(--ink);
  color: #faf8f4;
}
.editor-tab span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.editor-tab i {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--env-dev);
}
.editor-tab em {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: inherit;
  font-style: normal;
  line-height: 1;
}
.editor-tab em:hover {
  background: rgba(250, 248, 244, 0.14);
}
.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 9px 10px;
  border-top: 1.2px solid var(--faint);
}
.editor-actions button {
  height: 28px;
  padding: 0 12px;
  border: 1.2px solid var(--ink);
  border-radius: 20px;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  font-family: 'Caveat', cursive;
  font-weight: 700;
}
.editor-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .sftp-drawer {
    position: absolute;
    inset: 0 0 0 auto;
    width: min(88vw, 520px);
    min-width: 0;
    z-index: 4;
  }
}
</style>
