import { useEffect, useRef, useCallback } from 'react'
import { EditorView, Decoration, WidgetType } from '@codemirror/view'
import { EditorState, StateField, StateEffect } from '@codemirror/state'
import { python } from '@codemirror/lang-python'
import { basicSetup } from 'codemirror'
import { useStore } from '../../store'
import { runCode } from '../../engine/pyodide'
import './Editor.css'

// ── StateEffect to push new decoration state ──────────────────────────────────
const setExecDecos = StateEffect.define()

class InlineWidget extends WidgetType {
  constructor(text) {
    super()
    this.text = text
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'cm-inline-values'
    el.textContent = this.text
    return el
  }
  eq(other) { return other.text === this.text }
  ignoreEvent() { return true }
}

const execDecoField = StateField.define({
  create: () => Decoration.none,
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(setExecDecos)) return e.value
    }
    return decos.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f),
})

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px', background: 'var(--bg-base)' },
  '.cm-scroller': { fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace", overflow: 'auto' },
  '.cm-content': { padding: '1rem 0', caretColor: 'var(--accent)' },
  '.cm-gutters': { background: 'var(--bg-base)', borderRight: '1px solid var(--border)', color: 'var(--text-5)' },
  '.cm-lineNumbers .cm-gutterElement': { paddingRight: '12px' },
  '.cm-activeLine': { background: 'transparent' },
  '.cm-activeLineGutter': { background: 'transparent' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    background: 'var(--bg-selection) !important',
  },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '.cm-exec-line': { background: 'var(--bg-exec-line)', borderLeft: '3px solid var(--accent)', paddingLeft: '4px', boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.12)' },
  '.cm-dim-line': { opacity: 'var(--dim-opacity)' },
  '.cm-inline-values': {
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    fontSize: '11.5px',
    paddingLeft: '1rem',
    pointerEvents: 'none',
    userSelect: 'none',
  },
})

function buildDecorations(view, activeLine, locals) {
  if (!activeLine) return Decoration.none

  const decos = []
  const lineCount = view.state.doc.lines

  for (let i = 1; i <= lineCount; i++) {
    try {
      const line = view.state.doc.line(i)
      if (i === activeLine) {
        decos.push(Decoration.line({ class: 'cm-exec-line' }).range(line.from))
        if (locals && Object.keys(locals).length > 0) {
          const text = '   // ' + Object.entries(locals)
            .filter(([k, v]) => !k.startsWith('_') && !String(v).startsWith('<function') && !String(v).startsWith('<built'))
            .map(([k, v]) => `${k} = ${v}`)
            .join('  ·  ')
          decos.push(
            Decoration.widget({ widget: new InlineWidget(text), side: 1 }).range(line.to)
          )
        }
      } else {
        decos.push(Decoration.line({ class: 'cm-dim-line' }).range(line.from))
      }
    } catch (_) { /* line out of range */ }
  }

  return Decoration.set(decos, true)
}

export default function Editor() {
  const editorRef = useRef(null)
  const viewRef = useRef(null)

  const {
    code, setCode,
    currentFrameIndex, frames,
    executionStatus, setFrames, setExecutionStatus,
    pyodideStatus,
  } = useStore()

  const currentFrame = frames[currentFrameIndex]
  const activeLine = currentFrame?.lineNo ?? null
  const locals = currentFrame?.callStack?.at(-1)?.locals ?? null

  // Initialize editor once
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: code,
        extensions: [
          basicSetup,
          python(),
          editorTheme,
          execDecoField,
          EditorView.updateListener.of((upd) => {
            if (upd.docChanged) setCode(upd.state.doc.toString())
          }),
        ],
      }),
      parent: editorRef.current,
    })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync code when example changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const cur = view.state.doc.toString()
    if (cur !== code) {
      view.dispatch({ changes: { from: 0, to: cur.length, insert: code } })
    }
  }, [code])

  // Update decorations when frame changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const decos = buildDecorations(view, activeLine, locals)
    view.dispatch({ effects: setExecDecos.of(decos) })
  }, [activeLine, locals])

  const handleRun = useCallback(async () => {
    if (pyodideStatus !== 'ready') return
    setExecutionStatus('running')
    try {
      const result = await runCode(code)
      const hasOverflow = result.some((f) => f.event === 'overflow')
      const hasError = result.some((f) => f.event === 'exception')
      setFrames(result, hasOverflow ? 'overflow' : hasError ? 'error' : 'complete')
    } catch (e) {
      setExecutionStatus('error', e.message)
    }
  }, [code, pyodideStatus, setExecutionStatus, setFrames])

  // Cmd/Ctrl+Enter to run
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleRun() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleRun])

  const statusLabel = {
    running: 'Running...',
    complete: `${frames.length} steps`,
    error: 'Error in code',
    overflow: 'Stack overflow!',
  }[executionStatus]

  return (
    <div className="editor-wrapper">
      <div className="editor-toolbar">
        <button
          className="run-btn"
          onClick={handleRun}
          disabled={pyodideStatus !== 'ready' || executionStatus === 'running'}
        >
          {executionStatus === 'running' ? 'Running…' : '▶  Run'}
        </button>
        {statusLabel && (
          <span className={`status-badge status-${executionStatus}`}>{statusLabel}</span>
        )}
        <span className="hint">⌘↵ to run</span>
      </div>
      <div className="editor-container" ref={editorRef} />
    </div>
  )
}
