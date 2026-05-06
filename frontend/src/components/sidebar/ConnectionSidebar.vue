<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ConnectionItem from './ConnectionItem.vue'
import { addConnection, detectedHosts, ensureConnectionsLoaded, groupedConnections, loading, removeConnection } from '../../stores/connections'
import type { Connection } from '../../stores/connections'

onMounted(ensureConnectionsLoaded)

const emit = defineEmits<{ (e: 'connect', c: Connection): void }>()
const search = ref('')
const showCreate = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const editingKind = ref('ssh')
const editingWSLDistro = ref('')
const addingDetected = ref('')
const selectingKey = ref(false)
const error = ref('')
const draft = ref({
  name: '',
  host: '',
  port: 22,
  user: '',
  password: '',
  keyPath: '',
  env: 'dev',
  groupName: 'Default',
})

const filteredGroups = computed(() => {
  const query = search.value.trim().toLowerCase()
  const groups: Record<string, Connection[]> = {}

  for (const [group, conns] of Object.entries(groupedConnections.value)) {
    const matches = conns.filter(c => {
      if (!query) return true
      return [c.name, c.host, c.user, c.env, c.groupName]
        .some(value => String(value ?? '').toLowerCase().includes(query))
    })

    if (matches.length > 0) {
      groups[group] = matches
    }
  }

  return groups
})

const groupOptions = computed(() =>
  Object.keys(groupedConnections.value).sort((a, b) => a.localeCompare(b))
)
const isLocalDraft = computed(() => editingKind.value === 'local')

function resetDraft() {
  draft.value = {
    name: '',
    host: '',
    port: 22,
    user: '',
    password: '',
    keyPath: '',
    env: 'dev',
    groupName: 'Default',
  }
  error.value = ''
  editingId.value = null
  editingKind.value = 'ssh'
  editingWSLDistro.value = ''
}

function openCreate() {
  resetDraft()
  showCreate.value = true
}

function openEdit(c: Connection) {
  editingId.value = c.id
  editingKind.value = c.kind || 'ssh'
  editingWSLDistro.value = c.wslDistro || ''
  draft.value = {
    name: c.name || '',
    host: c.host || '',
    port: Number(c.port) || 22,
    user: c.user || '',
    password: c.password || '',
    keyPath: c.keyPath || '',
    env: c.env || 'dev',
    groupName: c.groupName || 'Default',
  }
  error.value = ''
  showCreate.value = true
}

function closeCreate() {
  showCreate.value = false
  resetDraft()
}

async function saveDraft() {
  const host = isLocalDraft.value ? 'localhost' : draft.value.host.trim()
  const user = isLocalDraft.value ? (draft.value.user.trim() || 'local') : draft.value.user.trim()
  const name = draft.value.name.trim() || host
  const port = isLocalDraft.value ? 0 : Number(draft.value.port) || 22

  if (!isLocalDraft.value && (!host || !user)) {
    error.value = 'Host and user are required.'
    return
  }

  saving.value = true
  error.value = ''
  try {
    await addConnection({
      id: editingId.value ?? 0,
      name,
      host,
      port,
      user,
      password: draft.value.password,
      keyPath: draft.value.keyPath.trim(),
      kind: editingKind.value,
      wslDistro: editingWSLDistro.value,
      env: draft.value.env,
      groupName: draft.value.groupName.trim() || 'Default',
    } as Connection)
    showCreate.value = false
    resetDraft()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

async function deleteConnection(c: Connection) {
  if (!window.confirm(`Delete ${c.name}?`)) return
  error.value = ''
  try {
    await removeConnection(c.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function addDetectedHost(host: Connection) {
  addingDetected.value = host.name
  error.value = ''
  try {
    await addConnection(host)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    addingDetected.value = ''
  }
}

async function selectKeyPath() {
  selectingKey.value = true
  error.value = ''
  try {
    const { SelectPrivateKeyPath } = await import('../../../wailsjs/go/main/App')
    const selected = await SelectPrivateKeyPath()
    if (selected) {
      draft.value.keyPath = selected
    }
  } catch (e) {
    error.value = 'Key picker is available in the Wails desktop app. In browser preview, paste the path manually.'
  } finally {
    selectingKey.value = false
  }
}

function connectionAddress(c: Connection) {
  if (c.kind === 'local') {
    return 'local shell'
  }
  if (c.kind === 'wsl' || c.wslDistro) {
    return `${c.user}@${c.wslDistro || c.host}`
  }
  return `${c.user}@${c.host}:${c.port}`
}
</script>

<template>
  <div class="sidebar-wrap">
    <div class="sidebar-header">
      <span class="wf-label" style="font-size:17px;font-weight:700;color:var(--ink)">Connections</span>
      <button class="add-btn" title="Add connection" @click="openCreate">+</button>
    </div>
    <form v-if="showCreate" class="create-panel" @submit.prevent="saveDraft">
      <div class="create-head">
        <span class="wf-label">{{ editingId ? 'Edit connection' : 'New connection' }}</span>
        <button type="button" class="close-btn" title="Cancel" @click="closeCreate">×</button>
      </div>
      <label>
        <span>Name</span>
        <input v-model="draft.name" placeholder="prod-api-01" />
      </label>
      <label>
        <span>Host</span>
        <input v-model="draft.host" :disabled="isLocalDraft" placeholder="10.0.1.24" :required="!isLocalDraft" />
      </label>
      <div class="inline-fields">
        <label>
          <span>User</span>
          <input v-model="draft.user" :disabled="isLocalDraft" placeholder="deploy" :required="!isLocalDraft" />
        </label>
        <label>
          <span>Port</span>
          <input v-model.number="draft.port" :disabled="isLocalDraft" type="number" min="1" max="65535" />
        </label>
      </div>
      <div class="inline-fields">
        <label>
          <span>Env</span>
          <select v-model="draft.env">
            <option value="prod">prod</option>
            <option value="stg">stg</option>
            <option value="dev">dev</option>
          </select>
        </label>
        <label>
          <span>Group</span>
          <input v-model="draft.groupName" list="connection-groups" placeholder="Production" />
          <datalist id="connection-groups">
            <option
              v-for="group in groupOptions"
              :key="group"
              :value="group"
            />
          </datalist>
        </label>
      </div>
      <label v-if="!isLocalDraft">
        <span>Password</span>
        <input v-model="draft.password" type="password" placeholder="optional" />
      </label>
      <label v-if="!isLocalDraft">
        <span>Key path</span>
        <div class="key-picker-row">
          <input v-model="draft.keyPath" placeholder="~/.ssh/id_ed25519" />
          <button
            type="button"
            class="pick-key-btn"
            :disabled="selectingKey"
            @click="selectKeyPath"
          >
            {{ selectingKey ? '...' : 'Choose' }}
          </button>
        </div>
      </label>
      <div v-if="error" class="form-error">{{ error }}</div>
      <div class="create-actions">
        <button type="button" class="secondary-btn" @click="closeCreate">Cancel</button>
        <button type="submit" class="primary-btn" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </form>
    <div v-if="detectedHosts.length > 0" class="detected-hosts">
      <div class="detected-title wf-label">Detected local hosts</div>
      <button
        v-for="host in detectedHosts"
        :key="`${host.name}-${host.user}-${host.port}`"
        class="detected-card"
        :disabled="addingDetected === host.name"
        :title="`Save ${connectionAddress(host)}`"
        @click="addDetectedHost(host)"
      >
        <span class="group-dot env-dev" />
        <span class="detected-main">{{ host.name }}</span>
        <span class="detected-meta">{{ connectionAddress(host) }}</span>
        <span class="detected-action">{{ addingDetected === host.name ? 'Adding...' : '+ Add' }}</span>
      </button>
      <div class="detected-note">Local terminals run inside TermFlow; WSL opens through wsl.exe; SSH hosts still use port 22.</div>
    </div>
    <div class="search-wrap">
      <span class="search-icon">⌕</span>
      <input
        v-model="search"
        class="search-input"
        placeholder="search servers…"
        type="search"
      />
    </div>
    <div class="groups-wrap">
      <div v-if="loading" class="status-msg wf-label">Loading…</div>
      <template v-else>
        <div
          v-for="(conns, group) in filteredGroups"
          :key="group"
          class="group"
        >
          <div class="group-header">
            <span class="group-dot" :class="`env-${conns[0]?.env ?? 'dev'}`" />
            <div class="group-label">{{ group }}</div>
          </div>
          <ConnectionItem
            v-for="c in conns"
            :key="c.id"
            :connection="c"
            @connect="emit('connect', $event)"
            @edit="openEdit"
            @delete="deleteConnection"
          />
        </div>
        <div v-if="Object.keys(filteredGroups).length === 0" class="status-msg wf-label">
          {{ search ? 'No matching servers.' : 'No connections yet.' }}<br/>
          {{ search ? 'Try host, user, env, or group.' : 'Click + to add one.' }}
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sidebar-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
}
.add-btn {
  width: 22px;
  height: 22px;
  border: 1.2px solid var(--faint);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: var(--pencil);
  display: flex;
  align-items: center;
  justify-content: center;
}
.add-btn:hover { background: var(--highlight); color: var(--ink); border-color: var(--ink); }
.create-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 10px 12px;
  padding: 10px;
  border: 1.3px solid var(--ink);
  border-radius: var(--radius);
  background: var(--paper);
  box-shadow: 0 10px 24px rgba(43, 42, 40, 0.08);
}
.create-head,
.create-actions,
.inline-fields {
  display: flex;
  align-items: center;
  gap: 8px;
}
.create-head {
  justify-content: space-between;
}
.create-head .wf-label {
  color: var(--ink);
  font-size: 16px;
  font-weight: 700;
}
.close-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--pencil);
  cursor: pointer;
  font-size: 18px;
}
.close-btn:hover { background: var(--highlight); color: var(--ink); }
.create-panel label {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  color: var(--pencil);
  font-family: 'Caveat', cursive;
  font-size: 14px;
}
.create-panel input,
.create-panel select {
  width: 100%;
  min-width: 0;
  height: 28px;
  border: 1.2px solid var(--faint);
  border-radius: var(--radius);
  background: var(--paper-sidebar);
  color: var(--ink);
  outline: none;
  padding: 0 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.key-picker-row {
  display: flex;
  gap: 6px;
}
.key-picker-row input {
  flex: 1;
}
.pick-key-btn {
  width: 58px;
  height: 28px;
  border: 1.2px solid var(--ink);
  border-radius: var(--radius);
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  font-family: 'Caveat', cursive;
  font-weight: 700;
}
.pick-key-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.pick-key-btn:hover:not(:disabled) {
  background: var(--highlight);
}
.create-panel input:focus,
.create-panel select:focus {
  border-color: var(--ink);
  background: var(--paper);
}
.form-error {
  color: var(--env-prod);
  font-family: 'Kalam', 'Caveat', cursive;
  font-size: 13px;
}
.create-actions {
  justify-content: flex-end;
}
.primary-btn,
.secondary-btn {
  height: 26px;
  padding: 0 10px;
  border-radius: 16px;
  cursor: pointer;
  font-family: 'Caveat', cursive;
  font-weight: 700;
}
.primary-btn {
  border: 1.2px solid var(--ink);
  background: var(--ink);
  color: var(--paper);
}
.primary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.secondary-btn {
  border: 1.2px solid var(--faint);
  background: transparent;
  color: var(--pencil);
}
.detected-hosts {
  margin: 0 10px 12px;
}
.detected-title {
  margin: 0 0 6px;
  color: var(--pencil);
  font-size: 14px;
  font-weight: 700;
}
.detected-card {
  display: grid;
  grid-template-columns: 9px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 7px 8px;
  border: 1.2px dashed var(--pencil);
  border-radius: var(--radius);
  background: rgba(250, 248, 244, 0.56);
  color: var(--ink);
  cursor: pointer;
  text-align: left;
}
.detected-card:hover:not(:disabled) {
  background: var(--highlight);
  border-color: var(--ink);
}
.detected-card:disabled {
  opacity: 0.62;
  cursor: progress;
}
.detected-main {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Kalam', 'Caveat', cursive;
  font-size: 14px;
}
.detected-meta {
  grid-column: 2 / 3;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--pencil);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}
.detected-action {
  grid-column: 3 / 4;
  grid-row: 1 / span 2;
  color: var(--ink);
  font-family: 'Caveat', cursive;
  font-weight: 700;
}
.detected-note {
  margin-top: 5px;
  color: var(--pencil);
  font-family: 'Kalam', 'Caveat', cursive;
  font-size: 12px;
}
.search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 10px 12px;
  border: 1.2px dashed var(--pencil);
  border-radius: var(--radius);
  padding: 4px 8px;
}
.search-icon {
  font-size: 13px;
  color: var(--pencil);
  flex-shrink: 0;
}
.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--ink);
  font-family: 'Kalam', 'Caveat', cursive;
  outline: none;
}
.search-input::placeholder {
  color: var(--pencil);
  font-family: 'Kalam', 'Caveat', cursive;
}
.groups-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 0 4px 8px;
}
.group {
  margin-bottom: 14px;
}
.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 6px;
}
.group-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.env-prod { background: var(--env-prod); }
.env-stg  { background: var(--env-stg); }
.env-dev  { background: var(--env-dev); }
.group-label {
  font-family: 'Caveat', cursive;
  font-size: 15px;
  font-weight: 700;
  color: var(--pencil);
  text-transform: capitalize;
}
.status-msg {
  padding: 20px 16px;
  text-align: center;
  line-height: 1.8;
  color: var(--pencil);
}
</style>
