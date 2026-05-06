<script setup lang="ts">
import { ref } from 'vue'
import type { Connection } from '../../stores/connections'

const props = defineProps<{ connection: Connection }>()
const emit = defineEmits<{
  (e: 'connect', c: Connection): void
  (e: 'edit', c: Connection): void
  (e: 'delete', c: Connection): void
}>()

const envColors: Record<string, string> = {
  prod: 'var(--env-prod)',
  stg:  'var(--env-stg)',
  dev:  'var(--env-dev)',
}

const menu = ref({ open: false, x: 0, y: 0 })

function openMenu(event: MouseEvent) {
  event.preventDefault()
  menu.value = { open: true, x: event.clientX, y: event.clientY }
}

function closeMenu() {
  menu.value.open = false
}

function chooseEdit() {
  closeMenu()
  emit('edit', props.connection)
}

function chooseDelete() {
  closeMenu()
  emit('delete', props.connection)
}

function connectionAddress() {
  if (props.connection.kind === 'local') {
    return 'local shell'
  }
  if (props.connection.kind === 'wsl' || props.connection.wslDistro) {
    return `${props.connection.user}@${props.connection.wslDistro || props.connection.host}`
  }
  return `${props.connection.user}@${props.connection.host}`
}
</script>

<template>
  <div class="conn-wrap" @click="closeMenu">
    <button
      class="conn-item"
      :title="`${connectionAddress()} - double-click to connect`"
      @dblclick="emit('connect', connection)"
      @contextmenu="openMenu"
    >
      <span class="env-dot" :style="{ background: envColors[connection.env] ?? 'var(--pencil)' }" />
      <span class="conn-name">{{ connection.name }}</span>
      <span class="conn-host">{{ connectionAddress() }}</span>
    </button>
    <div
      v-if="menu.open"
      class="conn-menu"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      @click.stop
    >
      <button @click="chooseEdit">Edit config</button>
      <button class="danger" @click="chooseDelete">Delete</button>
    </div>
  </div>
</template>

<style scoped>
.conn-wrap {
  position: relative;
}
.conn-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 10px;
  border: none;
  border: 1.3px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  border-radius: var(--radius);
  color: inherit;
  margin-bottom: 2px;
}
.conn-menu {
  position: fixed;
  z-index: 30;
  width: 132px;
  padding: 5px;
  border: 1.2px solid var(--ink);
  border-radius: var(--radius);
  background: var(--paper);
  box-shadow: 0 10px 24px rgba(28, 27, 25, 0.2);
}
.conn-menu button {
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
.conn-menu button:hover {
  background: var(--highlight);
}
.conn-menu button.danger {
  color: var(--env-prod);
}
.conn-item:hover {
  background: var(--highlight);
  border-color: var(--ink);
}
.env-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.conn-name {
  font-size: 15px;
  color: var(--ink);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Kalam', 'Caveat', cursive;
}
.conn-host {
  font-size: 11px;
  color: var(--pencil);
  white-space: nowrap;
  font-family: 'JetBrains Mono', monospace;
}
</style>
