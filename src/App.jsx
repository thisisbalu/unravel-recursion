import { useEffect, useState, useCallback } from 'react'
import { useStore } from './store'
import { loadPyodide } from './engine/pyodide'
import LoadingScreen from './components/LoadingScreen/LoadingScreen'
import ExamplesPanel from './components/ExamplesPanel/ExamplesPanel'
import Editor from './components/Editor/Editor'
import CallStack from './components/CallStack/CallStack'
import CallTree from './components/CallTree/CallTree'
import Controls from './components/Controls/Controls'
import './App.css'

function Resizer({ onMouseDown }) {
  return <div className="resizer" onMouseDown={onMouseDown} />
}

function useDragResize(initialPx, minPx, maxFn) {
  const [size, setSize] = useState(initialPx)

  const startDrag = useCallback((e) => {
    const startX = e.clientX
    const startSize = size
    const onMove = (mv) => {
      const delta = mv.clientX - startX
      setSize(Math.max(minPx, Math.min(maxFn(), startSize + delta)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    e.preventDefault()
  }, [size, minPx, maxFn])

  return [size, startDrag]
}

export default function App() {
  const { pyodideStatus, setPyodideStatus, setPyodideProgress, theme } = useStore()

  const [editorW, startEditorResize]     = useDragResize(380, 180, () => window.innerWidth * 0.55)
  const [callstackW, startCallstackResize] = useDragResize(280, 160, () => window.innerWidth * 0.4)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    loadPyodide(({ stage, percent }) => {
      setPyodideProgress(percent, stage)
      if (percent === 100) setPyodideStatus('ready')
    }).catch(() => setPyodideStatus('error'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (pyodideStatus === 'loading') return <LoadingScreen />

  if (pyodideStatus === 'error') {
    return (
      <div className="error-screen">
        <p>Failed to load Python runtime. Please refresh the page.</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">🧶</span>
          <span className="logo-text">Unravel Recursion</span>
        </div>
        <ExamplesPanel />
      </header>

      <main className="app-main">
        <div className="pane-editor" style={{ width: editorW }}>
          <Editor />
        </div>

        <Resizer onMouseDown={startEditorResize} />

        <div className="pane-callstack" style={{ width: callstackW }}>
          <CallStack />
        </div>

        <Resizer onMouseDown={startCallstackResize} />

        <div className="pane-calltree">
          <CallTree />
        </div>
      </main>

      <Controls />
    </div>
  )
}
