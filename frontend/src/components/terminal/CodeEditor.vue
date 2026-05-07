<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { basicSetup } from 'codemirror'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { StreamLanguage } from '@codemirror/language'
import { openSearchPanel } from '@codemirror/search'
import { oneDark } from '@codemirror/theme-one-dark'
import { css } from '@codemirror/lang-css'
import { go } from '@codemirror/lang-go'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { c, cpp, csharp, java, kotlin } from '@codemirror/legacy-modes/mode/clike'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'
import { rust } from '@codemirror/legacy-modes/mode/rust'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { toml } from '@codemirror/legacy-modes/mode/toml'

const props = defineProps<{
  modelValue: string
  filePath?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'save'): void
}>()

const editorHost = ref<HTMLElement | null>(null)
const lineWrap = ref(false)
const languageSlot = new Compartment()
const wrapSlot = new Compartment()
let view: EditorView | null = null
let applyingExternalUpdate = false

const languageName = computed(() => languageForPath(props.filePath).name)

onMounted(() => {
  if (!editorHost.value) return

  view = new EditorView({
    parent: editorHost.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: editorExtensions(),
    }),
  })
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

watch(() => props.modelValue, value => {
  if (!view || applyingExternalUpdate || value === view.state.doc.toString()) return
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: value },
  })
})

watch(() => props.filePath, () => {
  if (!view) return
  view.dispatch({
    effects: languageSlot.reconfigure(languageForPath(props.filePath).extension),
  })
})

watch(lineWrap, enabled => {
  if (!view) return
  view.dispatch({
    effects: wrapSlot.reconfigure(enabled ? EditorView.lineWrapping : []),
  })
})

function editorExtensions(): Extension[] {
  return [
    basicSetup,
    oneDark,
    editorTheme,
    keymap.of([
      {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          emit('save')
          return true
        },
      },
      indentWithTab,
    ]),
    EditorView.updateListener.of(update => {
      if (!update.docChanged) return
      applyingExternalUpdate = true
      emit('update:modelValue', update.state.doc.toString())
      queueMicrotask(() => {
        applyingExternalUpdate = false
      })
    }),
    languageSlot.of(languageForPath(props.filePath).extension),
    wrapSlot.of(lineWrap.value ? EditorView.lineWrapping : []),
  ]
}

function openSearch() {
  if (view) {
    openSearchPanel(view)
    view.focus()
  }
}

function languageForPath(path = ''): { name: string; extension: Extension } {
  const cleanPath = path.split(/[?#]/)[0]
  const fileName = cleanPath.split('/').pop()?.toLowerCase() ?? ''
  const ext = fileName.includes('.') ? fileName.split('.').pop() ?? '' : ''

  if (['js', 'mjs', 'cjs', 'jsx'].includes(ext)) return { name: 'JavaScript', extension: javascript({ jsx: true }) }
  if (['ts', 'mts', 'cts', 'tsx'].includes(ext)) return { name: 'TypeScript', extension: javascript({ typescript: true, jsx: ext === 'tsx' }) }
  if (['vue', 'html', 'htm', 'svelte'].includes(ext)) return { name: ext === 'vue' ? 'Vue' : 'HTML', extension: html() }
  if (['css', 'scss', 'sass', 'less'].includes(ext)) return { name: 'CSS', extension: css() }
  if (ext === 'json' || fileName.endsWith('.jsonc')) return { name: 'JSON', extension: json() }
  if (['md', 'markdown'].includes(ext)) return { name: 'Markdown', extension: markdown() }
  if (['py', 'pyw'].includes(ext)) return { name: 'Python', extension: python() }
  if (ext === 'go') return { name: 'Go', extension: go() }
  if (['rs'].includes(ext)) return { name: 'Rust', extension: StreamLanguage.define(rust) }
  if (['rb', 'rake'].includes(ext) || fileName === 'gemfile') return { name: 'Ruby', extension: StreamLanguage.define(ruby) }
  if (['c', 'h'].includes(ext)) return { name: 'C', extension: StreamLanguage.define(c) }
  if (['cc', 'cpp', 'cxx', 'hpp', 'hh', 'hxx'].includes(ext)) return { name: 'C++', extension: StreamLanguage.define(cpp) }
  if (['cs'].includes(ext)) return { name: 'C#', extension: StreamLanguage.define(csharp) }
  if (['java'].includes(ext)) return { name: 'Java', extension: StreamLanguage.define(java) }
  if (['kt', 'kts'].includes(ext)) return { name: 'Kotlin', extension: StreamLanguage.define(kotlin) }
  if (['sql', 'pgsql', 'mysql'].includes(ext)) return { name: 'SQL', extension: sql() }
  if (['xml', 'svg'].includes(ext)) return { name: 'XML', extension: xml() }
  if (['yml', 'yaml'].includes(ext)) return { name: 'YAML', extension: yaml() }
  if (['sh', 'bash', 'zsh'].includes(ext) || ['bashrc', 'zshrc', 'profile'].includes(fileName)) {
    return { name: 'Shell', extension: StreamLanguage.define(shell) }
  }
  if (ext === 'toml') return { name: 'TOML', extension: StreamLanguage.define(toml) }
  if (['env', 'ini', 'conf', 'config', 'properties'].includes(ext)) {
    return { name: 'Properties', extension: StreamLanguage.define(properties) }
  }
  if (fileName === 'dockerfile' || fileName.endsWith('.dockerfile')) {
    return { name: 'Dockerfile', extension: StreamLanguage.define(dockerFile) }
  }
  if (['makefile', 'license'].includes(fileName) || ['log', 'txt'].includes(ext)) return { name: 'Plain Text', extension: [] }
  return { name: 'Plain Text', extension: [] }
}

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    minHeight: '0',
    backgroundColor: '#1c1b19',
    color: '#faf8f4',
    fontSize: '12px',
  },
  '.cm-scroller': {
    fontFamily: '"JetBrains Mono", monospace',
    lineHeight: '1.55',
  },
  '.cm-content': {
    padding: '10px 0',
  },
  '.cm-gutters': {
    backgroundColor: '#161513',
    borderRight: '1px solid rgba(250, 248, 244, 0.14)',
    color: 'rgba(250, 248, 244, 0.45)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(250, 248, 244, 0.08)',
    color: '#faf8f4',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(250, 248, 244, 0.05)',
  },
  '.cm-search': {
    backgroundColor: '#24221f',
    borderBottom: '1px solid rgba(250, 248, 244, 0.18)',
    color: '#faf8f4',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '11px',
  },
  '.cm-search input': {
    backgroundColor: '#1c1b19',
    border: '1px solid rgba(250, 248, 244, 0.26)',
    borderRadius: '4px',
    color: '#faf8f4',
    outline: 'none',
  },
  '.cm-search button': {
    backgroundColor: 'transparent',
    border: '1px solid rgba(250, 248, 244, 0.3)',
    borderRadius: '4px',
    color: '#faf8f4',
    cursor: 'pointer',
  },
})
</script>

<template>
  <div class="code-editor">
    <div class="code-editor-toolbar">
      <span>{{ languageName }}</span>
      <div class="code-editor-tools">
        <button type="button" title="Search in file" @click="openSearch">Search</button>
        <label title="Toggle line wrapping">
          <input v-model="lineWrap" type="checkbox" />
          Wrap
        </label>
      </div>
    </div>
    <div ref="editorHost" class="code-editor-host" />
  </div>
</template>

<style scoped>
.code-editor {
  flex: 1;
  min-height: 260px;
  display: flex;
  flex-direction: column;
  background: #1c1b19;
}

.code-editor-toolbar {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 10px;
  border-bottom: 1px solid rgba(250, 248, 244, 0.13);
  background: #24221f;
  color: rgba(250, 248, 244, 0.72);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.code-editor-tools {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.code-editor-tools button,
.code-editor-tools label {
  height: 24px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid rgba(250, 248, 244, 0.24);
  border-radius: 4px;
  background: transparent;
  color: #faf8f4;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.code-editor-tools button {
  padding: 0 8px;
}

.code-editor-tools label {
  padding: 0 7px;
}

.code-editor-tools input {
  margin: 0;
}

.code-editor-host {
  flex: 1;
  min-height: 0;
}

:deep(.cm-editor) {
  height: 100%;
}

:deep(.cm-focused) {
  outline: none;
}
</style>
