<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { Session } from '../../stores/sessions'
import { sessionDisplayName } from '../../stores/sessions'

const props = defineProps<{ session: Session; active: boolean }>()
const emit = defineEmits<{
  (e: 'activate'): void
  (e: 'close'): void
  (e: 'rename', label: string): void
}>()

const editing = ref(false)
const draftLabel = ref('')
const labelInput = ref<HTMLInputElement | null>(null)

const envColors: Record<string, string> = {
  prod: 'var(--env-prod)',
  stg:  'var(--env-stg)',
  dev:  'var(--env-dev)',
}

watch(() => props.session.label, () => {
  if (!editing.value) {
    draftLabel.value = sessionDisplayName(props.session)
  }
})

function startRename() {
  editing.value = true
  draftLabel.value = sessionDisplayName(props.session)
  nextTick(() => {
    labelInput.value?.focus()
    labelInput.value?.select()
  })
}

function commitRename() {
  if (!editing.value) return
  editing.value = false
  emit('rename', draftLabel.value)
}

function cancelRename() {
  editing.value = false
  draftLabel.value = sessionDisplayName(props.session)
}

function activateFromKeyboard(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  emit('activate')
}
</script>

<template>
  <div
    :class="['tab', { active }]"
    role="tab"
    :aria-selected="active"
    tabindex="0"
    @click="emit('activate')"
    @keydown="activateFromKeyboard"
  >
    <span class="tab-dot" :style="{ background: envColors[session.env] ?? 'var(--pencil)' }" />
    <input
      v-if="editing"
      ref="labelInput"
      v-model="draftLabel"
      class="tab-name-input"
      spellcheck="false"
      @click.stop
      @keydown.enter.prevent="commitRename"
      @keydown.esc.prevent="cancelRename"
      @blur="commitRename"
    />
    <span
      v-else
      class="tab-name"
      :title="session.connectionName === sessionDisplayName(session) ? 'Double-click to rename tab' : `${session.connectionName} · double-click to rename tab`"
      @dblclick.stop="startRename"
    >
      {{ sessionDisplayName(session) }}
    </span>
    <span v-if="!session.connected" class="tab-state">closed</span>
    <button class="tab-close" type="button" title="Close session" @click.stop="emit('close')">×</button>
  </div>
</template>

<style scoped>
.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: var(--tab-h);
  border: none;
  border-right: 1.2px solid var(--faint);
  border-bottom: 1.2px solid var(--faint);
  background: transparent;
  color: var(--pencil);
  cursor: pointer;
  white-space: nowrap;
  font-family: 'Caveat', cursive;
  font-size: 15px;
  transition: background 0.1s;
  margin-bottom: -1px;
  border-radius: 6px 6px 0 0;
  max-width: 220px;
  min-width: 0;
}
.tab:hover { background: rgba(43,42,40,0.05); color: var(--ink); }
.tab.active {
  background: var(--paper);
  color: var(--ink);
  border: 1.2px solid var(--ink);
  border-bottom: 2px solid var(--paper);
  font-weight: 600;
}
.tab-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.tab-name-input {
  width: 112px;
  min-width: 72px;
  max-width: 150px;
  padding: 2px 4px;
  border: 1px solid var(--ink);
  border-radius: 4px;
  outline: none;
  background: var(--paper);
  color: var(--ink);
  font: inherit;
}
.tab-close {
  margin-left: 4px;
  opacity: 0.35;
  font-size: 16px;
  line-height: 1;
  font-family: 'JetBrains Mono', monospace;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
}
.tab-state {
  color: var(--env-prod);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  text-transform: uppercase;
}
.tab-close:hover { opacity: 1; }
</style>
