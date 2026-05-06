<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ensureQuickCommandsLoaded, quickCommands, reorderQuickCommands } from '../../stores/quickCommands'
import type { QuickCommand } from '../../stores/quickCommands'
import type { Session } from '../../stores/sessions'
import { sessionDisplayName } from '../../stores/sessions'
import { sendCommandToSession } from '../../stores/terminalBridge'
import { preferences } from '../../stores/uiSettings'
import { requestCommandCreate } from '../../stores/workspace'

const props = defineProps<{ activeSession: Session | null }>()
const draggingCommandId = ref<number | null>(null)
const dragOverCommandId = ref<number | null>(null)
const didDrag = ref(false)
const pointerStart = ref<{ commandId: number; pointerId: number; x: number; y: number } | null>(null)
const pointerDragging = ref(false)

onMounted(ensureQuickCommandsLoaded)

const visibleCommands = computed(() => quickCommands.value
  .filter(cmd => cmd.connectionId == null || cmd.connectionId === props.activeSession?.connectionId)
  .slice()
  .sort((a, b) => a.sortOrder - b.sortOrder)
)

function runCommand(cmd: string) {
  if (didDrag.value) {
    didDrag.value = false
    return
  }
  if (!props.activeSession?.connected) return
  if (preferences.value.dangerousCommandConfirm && isDangerousCommand(cmd) && !window.confirm(`Run "${cmd}"?`)) {
    return
  }
  sendCommandToSession(props.activeSession?.id, cmd, preferences.value.commandRunMode === 'run')
}

function isDangerousCommand(command: string) {
  return /\b(rm\s+-rf|mkfs|shutdown|reboot|poweroff|dd\s+if=|chmod\s+-R\s+777)\b/.test(command) ||
    command.includes(':(){:')
}

function addCommand() {
  if (!props.activeSession) return
  requestCommandCreate(props.activeSession.connectionId)
}

function commandAtPoint(x: number, y: number) {
  const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-command-id]')
  if (!target?.dataset.commandId) return null
  const commandId = Number(target.dataset.commandId)
  return visibleCommands.value.find(command => command.id === commandId) ?? null
}

function startPointerDrag(event: PointerEvent, command: QuickCommand) {
  if (event.button !== 0 || !props.activeSession?.connected) return
  pointerStart.value = { commandId: command.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  draggingCommandId.value = command.id
  dragOverCommandId.value = command.id
  window.addEventListener('pointermove', movePointerDrag)
  window.addEventListener('pointerup', endPointerDrag)
  window.addEventListener('pointercancel', cancelPointerDrag)
}

function movePointerDrag(event: PointerEvent) {
  const start = pointerStart.value
  if (!start || event.pointerId !== start.pointerId) return

  const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
  if (!pointerDragging.value && distance < 4) return

  event.preventDefault()
  didDrag.value = true
  pointerDragging.value = true
  const target = commandAtPoint(event.clientX, event.clientY)
  if (target && target.id !== start.commandId) {
    dragOverCommandId.value = target.id
  }
}

async function endPointerDrag(event: PointerEvent) {
  const start = pointerStart.value
  if (!start || event.pointerId !== start.pointerId) return

  const moved = pointerDragging.value
  const target = commandAtPoint(event.clientX, event.clientY)
  const targetId = target?.id ?? dragOverCommandId.value
  clearPointerDrag()
  if (!moved || targetId == null || targetId === start.commandId) {
    window.setTimeout(() => {
      didDrag.value = false
    }, 0)
    return
  }

  await moveCommand(start.commandId, targetId)
}

function cancelPointerDrag() {
  clearPointerDrag()
  window.setTimeout(() => {
    didDrag.value = false
  }, 0)
}

function clearPointerDrag() {
  pointerStart.value = null
  pointerDragging.value = false
  draggingCommandId.value = null
  dragOverCommandId.value = null
  window.removeEventListener('pointermove', movePointerDrag)
  window.removeEventListener('pointerup', endPointerDrag)
  window.removeEventListener('pointercancel', cancelPointerDrag)
}

async function moveCommand(sourceId: number, targetId: number) {
  if (sourceId === targetId) return
  const next = visibleCommands.value.slice()
  const sourceIndex = next.findIndex(command => command.id === sourceId)
  const targetIndex = next.findIndex(command => command.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0) {
    window.setTimeout(() => {
      didDrag.value = false
    }, 0)
    return
  }

  const [moved] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, moved)
  await reorderQuickCommands(next)
  window.setTimeout(() => {
    didDrag.value = false
  }, 0)
}

onUnmounted(clearPointerDrag)
</script>

<template>
  <div class="cmd-bar" v-if="visibleCommands.length > 0">
    <div class="bar-header">
      <span class="bar-label wf-label">Quick commands</span>
      <span v-if="activeSession" class="bar-context wf-label">· {{ sessionDisplayName(activeSession) }}</span>
      <div class="bar-spacer" />
      <button class="gear-btn" title="Manage commands">⚙</button>
    </div>
    <div class="pills-row">
      <button
        v-for="cmd in visibleCommands"
        :key="cmd.id"
        :class="[
          'pill',
          'command-pill',
          {
            primary: cmd.sortOrder === 0,
            dragging: draggingCommandId === cmd.id,
            'drag-over': dragOverCommandId === cmd.id && draggingCommandId !== cmd.id,
          },
        ]"
        :title="cmd.command"
        :data-command-id="cmd.id"
        :disabled="!activeSession?.connected"
        @pointerdown="startPointerDrag($event, cmd)"
        @click="runCommand(cmd.command)"
      >
        {{ cmd.label }}
      </button>
      <button
        class="pill pill-add"
        title="Add command for this server"
        :disabled="!activeSession?.connected"
        @click="addCommand"
      >
        + add
      </button>
    </div>
  </div>
</template>

<style scoped>
.cmd-bar {
  background: var(--paper-tabbar);
  border-top: 1.2px solid var(--faint);
  padding: 8px 14px 10px;
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.bar-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}
.bar-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--pencil);
}
.bar-context {
  font-size: 13px;
  color: var(--pencil);
  font-family: 'Kalam', 'Caveat', cursive;
}
.bar-spacer { flex: 1; }
.gear-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--pencil);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}
.gear-btn:hover { background: rgba(43,42,40,0.08); color: var(--ink); }
.pills-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pill {
  padding: 4px 14px;
  border: 1.2px solid var(--ink);
  border-radius: 100px;
  background: transparent;
  color: var(--ink);
  font-family: 'Caveat', cursive;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.1s, border-color 0.1s;
}
.command-pill {
  cursor: grab;
}
.command-pill.dragging {
  opacity: 0.48;
  cursor: grabbing;
}
.pill.drag-over {
  background: var(--highlight);
  outline: 2px dashed var(--ink);
  outline-offset: 2px;
}
.pill:hover {
  background: var(--highlight);
  border-color: var(--ink);
}
.pill:disabled {
  opacity: 0.46;
  cursor: not-allowed;
}
.pill.primary {
  background: var(--env-prod);
  color: var(--paper);
}
.pill-add {
  border-style: dashed;
  color: var(--pencil);
  border-color: var(--pencil);
  font-weight: 400;
}
.pill-add:hover {
  color: var(--ink);
  border-color: var(--ink);
  background: var(--highlight);
}
</style>
