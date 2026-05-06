import { ref, computed } from 'vue'
import { store } from '../../wailsjs/go/models'

export type Connection = store.Connection & {
  kind?: string
  wslDistro?: string
}

const connections = ref<Connection[]>([])
const detectedHosts = ref<Connection[]>([])
const loading = ref(false)
let localId = -1
let loaded = false
let loadingPromise: Promise<void> | null = null

export async function fetchConnections(options: { force?: boolean } = {}) {
  if (loadingPromise && !options.force) {
    return loadingPromise
  }

  if (loaded && !options.force) {
    return
  }

  loadingPromise = loadConnections()
  await loadingPromise
}

export async function ensureConnectionsLoaded() {
  await fetchConnections()
}

async function loadConnections() {
  loading.value = true
  try {
    const { DetectLocalHosts, ListConnections } = await import('../../wailsjs/go/main/App')
    const [result, detected] = await Promise.all([
      ListConnections(),
      DetectLocalHosts().catch(() => []),
    ])
    connections.value = result ?? []
    detectedHosts.value = filterUnsavedDetectedHosts(detected ?? [], connections.value)
    loaded = true
  } catch (e) {
    console.warn('fetchConnections failed (dev mode?):', e)
    connections.value = [
      {
        id: localId--,
        name: 'Local Terminal',
        host: 'localhost',
        port: 0,
        user: 'local',
        password: '',
        keyPath: '',
        kind: 'local',
        wslDistro: '',
        env: 'dev',
        groupName: 'Local',
      },
    ]
    detectedHosts.value = [
      {
        id: 0,
        name: 'WSL Local',
        host: '127.0.0.1',
        port: 22,
        user: 'wsl-user',
        password: '',
        keyPath: '',
        kind: 'wsl',
        wslDistro: 'Ubuntu',
        env: 'dev',
        groupName: 'Local',
      },
    ]
    loaded = true
  } finally {
    loading.value = false
    loadingPromise = null
  }
}

export async function addConnection(c: Connection) {
  try {
    const { SaveConnection } = await import('../../wailsjs/go/main/App')
    await SaveConnection(c)
    await fetchConnections({ force: true })
  } catch (e) {
    console.warn('addConnection failed (dev mode?):', e)
    connections.value = [
      ...connections.value,
      {
        ...c,
        id: localId--,
        port: Number(c.port) || 22,
        env: c.env || 'dev',
        groupName: c.groupName || 'Default',
        keyPath: c.keyPath || '',
        kind: c.kind || 'ssh',
        wslDistro: c.wslDistro || '',
      },
    ]
  }
}

export async function removeConnection(id: number) {
  const { DeleteConnection } = await import('../../wailsjs/go/main/App')
  await DeleteConnection(id)
  connections.value = connections.value.filter(c => c.id !== id)
}

export const groupedConnections = computed(() => {
  const groups: Record<string, Connection[]> = {}
  for (const c of connections.value) {
    const g = c.groupName || 'Default'
    if (!groups[g]) groups[g] = []
    groups[g].push(c)
  }
  return groups
})

function filterUnsavedDetectedHosts(detected: Connection[], saved: Connection[]) {
  return detected.filter(host => !saved.some(conn =>
    conn.host === host.host &&
    conn.port === host.port &&
    conn.user === host.user &&
    conn.name === host.name
  ))
}

export { connections, detectedHosts, loading }
