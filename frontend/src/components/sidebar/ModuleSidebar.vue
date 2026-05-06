<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { quickCommands, ensureQuickCommandsLoaded } from '../../stores/quickCommands'
import { groupedConnections, loading as connectionsLoading } from '../../stores/connections'
import type { Connection } from '../../stores/connections'
import { activeSessionId, openSession, sessions } from '../../stores/sessions'
import { selectedFileConnectionId, selectFileConnection, ensureConnectionsLoaded } from '../../stores/fileWorkbench'
import { commandScope, openMonitor, selectCommandScope, selectSettingsSection, settingsSection } from '../../stores/workspace'

const props = defineProps<{ panel: string }>()

ensureQuickCommandsLoaded()
onMounted(ensureConnectionsLoaded)

const globalCommandCount = computed(() => quickCommands.value.filter(cmd => cmd.connectionId == null).length)

function serverCommandCount(connectionId: number) {
  return quickCommands.value.filter(cmd => cmd.connectionId === connectionId).length
}

function sessionForConnection(connectionId: number) {
  return sessions.value.find(session => session.connectionId === connectionId)
}

async function observeConnection(conn: Connection) {
  const existing = sessionForConnection(conn.id)
  if (existing) {
    activeSessionId.value = existing.id
  } else {
    await openSession(conn)
  }
  openMonitor()
}

const settingsNav = [
  { id: 'appearance', label: 'Appearance', meta: 'theme, colors, background' },
  { id: 'terminal', label: 'Terminal', meta: 'scrollback, paste behavior' },
  { id: 'files', label: 'Files', meta: 'transfer defaults' },
  { id: 'commands', label: 'Commands', meta: 'execution and safety' },
  { id: 'security', label: 'SSH / Security', meta: 'keepalive, secrets' },
  { id: 'about', label: 'About', meta: 'version and data' },
]

function connectionMeta(conn: Connection) {
  if (conn.kind === 'local') {
    return 'local shell'
  }
  if (conn.kind === 'wsl') {
    return conn.wslDistro || 'WSL'
  }
  return `${conn.user}@${conn.host}`
}
</script>

<template>
  <div class="module-sidebar">
    <template v-if="panel === 'files'">
      <div class="files-panel">
        <div class="module-head">
          <h2 class="wf-label">File Servers</h2>
          <span class="live-dot">{{ connectionsLoading ? 'sync' : 'ready' }}</span>
        </div>

        <section
          v-for="(conns, group) in groupedConnections"
          :key="group"
          class="server-group"
        >
          <h3>{{ group }}</h3>
          <button
            v-for="conn in conns"
            :key="conn.id"
            :class="['server-card', { active: selectedFileConnectionId === conn.id }]"
            @click="selectFileConnection(conn)"
          >
            <span>
              <i :class="`env-dot env-${conn.env || 'dev'}`" />
              {{ conn.name }}
            </span>
            <small>{{ connectionMeta(conn) }}</small>
          </button>
        </section>

        <p class="hint">Choose a server here, then move files between the local pane and the remote pane in the main workspace.</p>
      </div>
    </template>

    <template v-else-if="panel === 'monitor'">
      <div class="module-head">
        <h2 class="wf-label">Observability</h2>
        <span class="live-dot">{{ connectionsLoading ? 'sync' : 'live' }}</span>
      </div>
      <section
        v-for="(conns, group) in groupedConnections"
        :key="group"
        class="server-group"
      >
        <h3>{{ group }}</h3>
        <button
          v-for="conn in conns"
          :key="conn.id"
          :class="['server-card', { active: sessionForConnection(conn.id)?.id === activeSessionId }]"
          @click="observeConnection(conn)"
        >
          <span>
            <i :class="`env-dot env-${conn.env || 'dev'}`" />
            {{ conn.name }}
          </span>
          <small>{{ sessionForConnection(conn.id) ? 'observing' : connectionMeta(conn) }}</small>
        </button>
      </section>
      <p class="hint">Select a server to open a session and show CPU, memory, process, disk and load telemetry in the workspace.</p>
    </template>

    <template v-else-if="panel === 'commands'">
      <div class="module-head">
        <h2 class="wf-label">Command Library</h2>
      </div>
      <button
        :class="['scope-card', { active: commandScope === 'global' }]"
        @click="selectCommandScope('global')"
      >
        <span>Global</span>
        <small>{{ globalCommandCount }} commands · every server</small>
      </button>
      <section
        v-for="(conns, group) in groupedConnections"
        :key="group"
        class="server-group"
      >
        <h3>{{ group }}</h3>
        <button
          v-for="conn in conns"
          :key="conn.id"
          :class="['server-card', { active: commandScope === conn.id }]"
          @click="selectCommandScope(conn.id)"
        >
          <span>
            <i :class="`env-dot env-${conn.env || 'dev'}`" />
            {{ conn.name }}
          </span>
          <small>{{ serverCommandCount(conn.id) }} server commands</small>
        </button>
      </section>
      <p class="hint">Global commands appear on every server. Server commands appear only when that server is active.</p>
    </template>

    <template v-else>
      <div class="module-head">
        <h2 class="wf-label">Settings</h2>
      </div>

      <button
        v-for="item in settingsNav"
        :key="item.id"
        :class="['scope-card', { active: settingsSection === item.id }]"
        @click="selectSettingsSection(item.id)"
      >
        <span>{{ item.label }}</span>
        <small>{{ item.meta }}</small>
      </button>
    </template>
  </div>
</template>

<style scoped>
.module-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 12px;
  overflow: auto;
}
.files-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.module-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}
.mini-pill,
.wide-action,
.path-jump button,
.shortcut-grid button,
.server-card,
.scope-card,
.command-group button,
.upload-bg {
  border: 1.2px solid var(--ink);
  border-radius: var(--radius);
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  font-family: 'Caveat', cursive;
}
.mini-pill,
.wide-action,
.upload-bg {
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  font-weight: 700;
}
.wide-action {
  width: 100%;
  height: 32px;
}
.upload-bg input {
  display: none;
}
.active-session-card,
.server-group,
.setting-card,
.setting-row,
.command-group,
.swatches {
  border: 1.2px solid var(--faint);
  border-radius: var(--radius);
  background: rgba(250, 248, 244, 0.56);
  padding: 10px;
}
.active-session-card span,
.setting-card span,
.setting-row span,
.swatches span {
  color: var(--pencil);
}
.active-session-card strong,
.active-session-card strong {
  display: block;
  margin-top: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}
.path-jump {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
}
.path-jump input {
  min-width: 0;
  border: 1.2px dashed var(--pencil);
  border-radius: var(--radius);
  padding: 7px 9px;
  background: transparent;
  color: var(--ink);
  outline: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.path-jump button {
  min-width: 42px;
  font-weight: 700;
}
.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}
.shortcut-grid button {
  min-width: 0;
  padding: 8px;
  text-align: left;
}
.shortcut-grid button span,
.shortcut-grid button small {
  display: block;
}
.shortcut-grid button span {
  color: var(--ink);
  font-weight: 700;
}
.shortcut-grid button small {
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--pencil);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}
.wide-action:disabled,
.path-jump input:disabled,
.path-jump button:disabled,
.shortcut-grid button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.server-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.server-group h3 {
  margin: 0;
  color: var(--pencil);
  font-family: 'Caveat', cursive;
  font-size: 16px;
}
.server-card {
  width: 100%;
  padding: 8px;
  text-align: left;
}
.scope-card {
  width: 100%;
  padding: 9px 10px;
  text-align: left;
}
.server-card.active,
.scope-card.active {
  background: var(--highlight);
  border-color: var(--ink);
}
.server-card span,
.server-card small,
.scope-card span,
.scope-card small {
  display: block;
}
.server-card span,
.scope-card span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink);
  font-weight: 700;
}
.server-card small,
.scope-card small {
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--pencil);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}
.env-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 5px;
  border-radius: 50%;
}
.env-prod { background: var(--env-prod); }
.env-stg { background: var(--env-stg); }
.env-dev { background: var(--env-dev); }
.hint {
  color: var(--pencil);
  font-family: 'Kalam', 'Caveat', cursive;
  line-height: 1.45;
}
.live-dot {
  color: var(--env-dev);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.command-group h3 {
  margin: 0 0 8px;
  color: var(--pencil);
  font-family: 'Caveat', cursive;
  font-size: 16px;
}
.command-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.command-group button {
  padding: 6px 8px;
  text-align: left;
}
.command-group button span,
.command-group button small {
  display: block;
}
.command-group button span {
  color: var(--ink);
  font-size: 15px;
}
.command-group button small {
  margin-top: 2px;
  color: var(--command-color, var(--accent));
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}
.command-group button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.setting-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.setting-row {
  display: grid;
  gap: 8px;
  font-family: 'Kalam', 'Caveat', cursive;
}
.setting-row input {
  width: 100%;
}
.swatches {
  display: grid;
  gap: 8px;
}
.swatches label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-family: 'Kalam', 'Caveat', cursive;
}
.swatches input {
  width: 42px;
  height: 26px;
  border: 1px solid var(--faint);
  border-radius: var(--radius);
}
</style>
