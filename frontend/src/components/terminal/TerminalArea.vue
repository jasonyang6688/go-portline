<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { sessions, activeSessionId, closeSession, renameSession, sessionDisplayName } from '../../stores/sessions'
import TerminalTab from './TerminalTab.vue'
import XTerminal from './XTerminal.vue'
import QuickCommandBar from '../commands/QuickCommandBar.vue'
import SftpDrawer from './SftpDrawer.vue'
import MonitorPanel from './MonitorPanel.vue'
import { terminalStyle } from '../../stores/uiSettings'
import { filePathRequest, monitorOpen, openFiles, openMonitor, sftpOpen } from '../../stores/workspace'
import { sendCommandToSession } from '../../stores/terminalBridge'

const props = defineProps<{ activePanel?: string }>()

const activeSession = computed(() =>
  sessions.value.find(s => s.id === activeSessionId.value) ?? null
)

const splitMode = ref(false)
const commandDraft = ref('')
const quickPanelHeight = ref(116)
const monitorMode = computed(() => props.activePanel === 'monitor')

const visibleSessionIds = computed(() => {
  if (!splitMode.value || sessions.value.length <= 1) {
    return activeSessionId.value ? [activeSessionId.value] : []
  }
  const active = activeSessionId.value ?? sessions.value[0]?.id
  const secondary = sessions.value.find(s => s.id !== active)?.id
  return [active, secondary].filter(Boolean) as string[]
})

watch(() => props.activePanel, (panel) => {
  if (panel === 'files') {
    openFiles()
  }
  if (panel === 'monitor') {
    openMonitor()
  }
})

function submitCommandDraft() {
  const command = commandDraft.value.trim()
  if (!command || !activeSession.value?.connected) return
  if (sendCommandToSession(activeSession.value.id, command, true)) {
    commandDraft.value = ''
  }
}

function startQuickPanelResize(event: PointerEvent) {
  event.preventDefault()
  const startY = event.clientY
  const startHeight = quickPanelHeight.value

  function resize(moveEvent: PointerEvent) {
    const delta = startY - moveEvent.clientY
    quickPanelHeight.value = Math.min(260, Math.max(82, startHeight + delta))
  }

  function stopResize() {
    window.removeEventListener('pointermove', resize)
    window.removeEventListener('pointerup', stopResize)
  }

  window.addEventListener('pointermove', resize)
  window.addEventListener('pointerup', stopResize)
}

function resetQuickPanelHeight() {
  quickPanelHeight.value = 116
}
</script>

<template>
  <div class="term-area" :style="terminalStyle">
    <!-- Tab bar -->
    <div class="tab-bar">
      <TerminalTab
        v-for="s in sessions"
        :key="s.id"
        :session="s"
        :active="s.id === activeSessionId"
        @activate="activeSessionId = s.id"
        @close="closeSession(s.id)"
        @rename="renameSession(s.id, $event)"
      />
      <div v-if="sessions.length === 0" class="tab-hint wf-label">
        Double-click a connection to open a session
      </div>
      <div class="tab-spacer" />
      <!-- Right-side tab bar actions -->
      <div class="tab-actions">
        <button
          :class="['tab-action-btn', { active: splitMode }]"
          title="Split terminals"
          :disabled="sessions.length < 2"
          @click="splitMode = !splitMode"
        >
          ||
        </button>
        <button
          :class="['tab-action-btn', { active: sftpOpen }]"
          title="Remote files"
          @click="sftpOpen = !sftpOpen"
        >
          Files
        </button>
        <button
          :class="['tab-action-btn', { active: monitorOpen }]"
          title="Remote monitor"
          @click="monitorOpen = !monitorOpen"
        >
          CPU
        </button>
      </div>
    </div>

    <div class="workspace">
      <MonitorPanel
        v-if="monitorMode"
        mode="dashboard"
        :session-id="activeSession?.id ?? null"
        :session-name="activeSession ? sessionDisplayName(activeSession) : undefined"
      />
      <!-- Terminal panels (mounted, shown/hidden) -->
      <div
        v-show="!monitorMode"
        :class="['terminal-wrap', { split: splitMode && visibleSessionIds.length > 1 }]"
      >
        <XTerminal
          v-for="s in sessions"
          v-show="visibleSessionIds.includes(s.id)"
          :key="s.id"
          class="terminal-pane"
          :session-id="s.id"
        />
        <div v-if="sessions.length === 0" class="empty-terminal">
          <div class="empty-inner">
            <div class="empty-icon">[]</div>
            <div class="wf-label" style="font-size:18px;font-weight:600;color:rgba(250,248,244,0.4)">
              Welcome to TermFlow
            </div>
            <div class="wf-label" style="font-size:13px;margin-top:8px;color:rgba(250,248,244,0.2)">
              Select a connection from the sidebar to begin
            </div>
          </div>
        </div>
      </div>
      <SftpDrawer
        v-if="sftpOpen"
        :session-id="activeSession?.id ?? null"
        :session-name="activeSession ? sessionDisplayName(activeSession) : undefined"
        :path-request="filePathRequest"
        @close="sftpOpen = false"
      />
      <MonitorPanel
        v-if="monitorOpen && !monitorMode"
        :session-id="activeSession?.id ?? null"
        :session-name="activeSession ? sessionDisplayName(activeSession) : undefined"
        @close="monitorOpen = false"
      />
    </div>

    <!-- Quick command pills -->
    <section
      v-if="!monitorMode"
      class="quick-panel"
      :style="{ height: `${quickPanelHeight}px` }"
    >
      <div
        class="quick-panel-resizer"
        title="Drag to resize quick commands"
        @pointerdown="startQuickPanelResize"
        @dblclick="resetQuickPanelHeight"
      >
        <span />
      </div>
      <form v-if="activeSession" class="command-entry" @submit.prevent="submitCommandDraft">
        <span class="entry-prefix">{{ sessionDisplayName(activeSession) }}</span>
        <input
          v-model="commandDraft"
          :disabled="!activeSession.connected"
          spellcheck="false"
          autocomplete="off"
          :placeholder="activeSession.connected ? 'Paste or type a command, edit it, then press Enter' : 'Session is closed'"
        />
        <button type="submit" :disabled="!activeSession.connected || !commandDraft.trim()">Run</button>
      </form>
      <QuickCommandBar :active-session="activeSession" />
    </section>

    <!-- Status bar -->
    <div class="status-bar">
      <template v-if="activeSession">
        <span class="env-dot" :class="`env-${activeSession.env}`" />
        <span class="status-text">{{ activeSession.connected ? 'connected' : 'disconnected' }}</span>
        <span class="status-sep">/</span>
        <span class="status-text">{{ sessionDisplayName(activeSession) }}</span>
        <div class="status-spacer" />
        <span class="status-text">heartbeat 60s</span>
        <span class="status-sep">/</span>
        <span class="status-text">utf-8</span>
      </template>
      <template v-else>
        <span class="status-text">TermFlow</span>
        <div class="status-spacer" />
        <span class="status-text">{{ sessions.length }} session{{ sessions.length !== 1 ? 's' : '' }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.term-area {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.tab-bar {
  display: flex;
  height: var(--tab-h);
  background: var(--paper-tabbar);
  border-bottom: 1.2px solid var(--faint);
  overflow-x: auto;
  flex-shrink: 0;
  align-items: stretch;
}
.tab-hint {
  display: flex;
  align-items: center;
  padding: 0 16px;
  color: var(--pencil);
  font-size: 13px;
}
.tab-spacer { flex: 1; }
.tab-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  flex-shrink: 0;
}
.tab-action-btn {
  min-width: 26px;
  height: 26px;
  padding: 0 7px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  font-size: 11px;
  color: var(--pencil);
  display: flex;
  align-items: center;
  justify-content: center;
}
.tab-action-btn:hover {
  background: rgba(43,42,40,0.06);
  color: var(--ink);
}
.tab-action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.tab-action-btn.active {
  background: var(--highlight);
  color: var(--ink);
  border: 1.2px solid var(--ink);
}
.workspace {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
  overflow: hidden;
}
.terminal-wrap {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--terminal-bg);
}
.terminal-wrap.split {
  flex-direction: row;
  gap: 1px;
  background: var(--faint);
}
.terminal-wrap.split .terminal-pane {
  min-width: 0;
  flex: 1;
  background: var(--terminal-bg);
}
.empty-terminal {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.empty-icon {
  font-size: 48px;
  color: rgba(250,248,244,0.08);
  margin-bottom: 8px;
}
.quick-panel {
  display: flex;
  flex-direction: column;
  min-height: 82px;
  max-height: 260px;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--paper-tabbar);
  border-top: 1.2px solid var(--faint);
}
.quick-panel-resizer {
  height: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ns-resize;
  flex-shrink: 0;
}
.quick-panel-resizer span {
  width: 48px;
  height: 3px;
  border-radius: 6px;
  background: var(--faint);
}
.quick-panel-resizer:hover span {
  background: var(--pencil);
}
.command-entry {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: none;
  background: var(--paper-tabbar);
  flex-shrink: 0;
}
.entry-prefix {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--pencil);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.command-entry input {
  min-width: 0;
  height: 30px;
  border: 1.2px dashed var(--pencil);
  border-radius: var(--radius);
  background: rgba(250, 248, 244, 0.62);
  color: var(--ink);
  outline: none;
  padding: 0 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}
.command-entry input:focus {
  border-color: var(--ink);
  background: var(--paper);
}
.command-entry button {
  height: 30px;
  padding: 0 12px;
  border: 1.2px solid var(--ink);
  border-radius: var(--radius);
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  font-family: 'Caveat', cursive;
  font-weight: 700;
}
.command-entry button:hover:not(:disabled) {
  background: var(--highlight);
}
.command-entry button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.status-bar {
  height: var(--status-h);
  background: var(--paper-status);
  border-top: 1.2px solid var(--faint);
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  flex-shrink: 0;
}
.env-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.env-prod { background: var(--env-prod); }
.env-stg  { background: var(--env-stg); }
.env-dev  { background: var(--env-dev); }
.status-text {
  font-family: 'Caveat', cursive;
  font-size: 13px;
  color: var(--pencil);
}
.status-sep {
  font-family: 'Caveat', cursive;
  font-size: 13px;
  color: var(--faint);
}
.status-spacer { flex: 1; }
</style>
