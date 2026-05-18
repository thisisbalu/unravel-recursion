/**
 * Vitest + RTL tests for src/components/Editor/Editor.jsx
 *
 * CodeMirror is mocked at the module level — it requires DOM APIs
 * (contenteditable, MutationObserver, ResizeObserver, getComputedStyle)
 * that jsdom only partially supports. We replace the entire
 * CodeMirror/editor setup with a simple <textarea> stub so we can
 * focus on testing Editor's React logic: the Run button, status badge,
 * keyboard shortcut, runCode integration, and store wiring.
 *
 * The ?raw import for tracer.py is also mocked so Vite's raw-loader
 * never fires in the test environment.
 *
 * Run: npx vitest run tests/Editor.test.jsx
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { useStore } from '../src/store/index.js'
import { EXAMPLES } from '../src/examples/index.js'

// ---------------------------------------------------------------------------
// Mock CodeMirror packages — they try to measure DOM elements that jsdom
// does not support, causing cryptic failures unrelated to our logic.
// ---------------------------------------------------------------------------

vi.mock('codemirror', () => ({
  basicSetup: [],
}))

vi.mock('@codemirror/view', () => ({
  EditorView: class EditorView {
    constructor({ parent } = {}) {
      // Attach a minimal textarea so viewRef.current is truthy
      if (parent) {
        this._el = document.createElement('textarea')
        this._el.className = 'cm-editor'
        parent.appendChild(this._el)
      }
      this.state = { doc: { toString: () => '', lines: 0 } }
    }
    dispatch() {}
    destroy() { this._el?.remove() }
    static theme() { return {} }
    static updateListener = { of: () => [] }
    static decorations = { from: () => [] }
  },
  Decoration: {
    none: null,
    set: () => null,
    line: () => ({ range: () => ({}) }),
    widget: () => ({ range: () => ({}) }),
  },
  WidgetType: class WidgetType {
    toDOM() { return document.createElement('span') }
    eq() { return false }
    ignoreEvent() { return true }
  },
}))

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: () => ({ doc: { toString: () => '' } }),
  },
  StateField: {
    define: () => ({}),
  },
  StateEffect: {
    define: () => ({ of: (v) => ({ value: v, is: () => true }) }),
  },
}))

vi.mock('@codemirror/lang-python', () => ({
  python: () => [],
}))

// ---------------------------------------------------------------------------
// Mock runCode — never loads real Pyodide in unit tests
// ---------------------------------------------------------------------------

vi.mock('../src/engine/pyodide.js', () => ({
  runCode: vi.fn(),
}))

// Re-import after mocks are applied
import { runCode } from '../src/engine/pyodide.js'
import Editor from '../src/components/Editor/Editor.jsx'

// ---------------------------------------------------------------------------
// Store reset helper
// ---------------------------------------------------------------------------

function resetStore(overrides = {}) {
  useStore.setState({
    pyodideStatus: 'ready',
    code: EXAMPLES[0].code,
    selectedExample: EXAMPLES[0].id,
    frames: [],
    executionStatus: 'idle',
    executionError: null,
    currentFrameIndex: 0,
    isPlaying: false,
    playbackSpeed: 1,
    viewMode: 'simple',
    ...overrides,
  })
}

function makeFrames(n, event = 'line') {
  return Array.from({ length: n }, (_, i) => ({
    event,
    lineNo: i + 1,
    callStack: [],
    stdout: '',
    callTree: [],
    activeCallId: null,
  }))
}

beforeEach(() => {
  resetStore()
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('Editor — rendering', () => {
  it('renders without crashing', () => {
    render(<Editor />)
  })

  it('shows the Run button', () => {
    render(<Editor />)
    expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
  })

  it('Run button is enabled when pyodideStatus is ready and not running', () => {
    resetStore({ pyodideStatus: 'ready', executionStatus: 'idle' })
    render(<Editor />)
    expect(screen.getByRole('button', { name: /run/i })).not.toBeDisabled()
  })

  it('Run button is disabled when pyodideStatus is loading', () => {
    resetStore({ pyodideStatus: 'loading' })
    render(<Editor />)
    expect(screen.getByRole('button', { name: /run/i })).toBeDisabled()
  })

  it('Run button is disabled when executionStatus is running', () => {
    resetStore({ executionStatus: 'running' })
    render(<Editor />)
    expect(screen.getByRole('button', { name: /run/i })).toBeDisabled()
  })

  it('shows the keyboard hint', () => {
    render(<Editor />)
    expect(screen.getByText(/⌘↵/)).toBeInTheDocument()
  })

  it('does not show a status badge when idle', () => {
    resetStore({ executionStatus: 'idle' })
    render(<Editor />)
    expect(screen.queryByText(/steps/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/running/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/overflow/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Status badge variants
// ---------------------------------------------------------------------------

describe('Editor — status badge', () => {
  it('shows "Running..." badge while running', () => {
    resetStore({ executionStatus: 'running' })
    render(<Editor />)
    // The button itself says "Running…" and there's also a badge
    expect(screen.getAllByText(/running/i).length).toBeGreaterThan(0)
  })

  it('shows frame count badge when complete', () => {
    useStore.getState().setFrames(makeFrames(7), 'complete')
    render(<Editor />)
    expect(screen.getByText('7 steps')).toBeInTheDocument()
  })

  it('shows "Error in code" badge on error', () => {
    resetStore({ executionStatus: 'error' })
    render(<Editor />)
    expect(screen.getByText('Error in code')).toBeInTheDocument()
  })

  it('shows "Stack overflow!" badge on overflow', () => {
    resetStore({ executionStatus: 'overflow' })
    render(<Editor />)
    expect(screen.getByText('Stack overflow!')).toBeInTheDocument()
  })

  it('Run button text changes to "Running…" while running', () => {
    resetStore({ executionStatus: 'running' })
    render(<Editor />)
    expect(screen.getByRole('button', { name: /running/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Run button click — happy path
// ---------------------------------------------------------------------------

describe('Editor — run button click (success)', () => {
  it('calls runCode with the current code', async () => {
    const frames = makeFrames(3)
    runCode.mockResolvedValue(frames)
    resetStore({ code: 'x = 1' })

    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: /run/i }))

    await waitFor(() => expect(runCode).toHaveBeenCalledWith('x = 1'))
  })

  it('sets executionStatus to complete after a successful run', async () => {
    const frames = makeFrames(5)
    runCode.mockResolvedValue(frames)

    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: /run/i }))

    await waitFor(() =>
      expect(useStore.getState().executionStatus).toBe('complete')
    )
  })

  it('stores frames in the store after a successful run', async () => {
    const frames = makeFrames(4)
    runCode.mockResolvedValue(frames)

    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: /run/i }))

    await waitFor(() => expect(useStore.getState().frames.length).toBe(4))
  })

  it('sets executionStatus to running immediately while waiting', async () => {
    // runCode never resolves so we can observe the intermediate state
    let resolveRun
    runCode.mockReturnValue(new Promise(r => { resolveRun = r }))

    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: /run/i }))

    expect(useStore.getState().executionStatus).toBe('running')

    // Clean up the dangling promise
    resolveRun(makeFrames(1))
    await waitFor(() => expect(useStore.getState().executionStatus).toBe('complete'))
  })
})

// ---------------------------------------------------------------------------
// Run button click — overflow path
// ---------------------------------------------------------------------------

describe('Editor — run result with overflow', () => {
  it('sets executionStatus to overflow when any frame has event overflow', async () => {
    const frames = [
      ...makeFrames(3),
      { event: 'overflow', lineNo: 4, callStack: [], stdout: '', callTree: [], activeCallId: null },
    ]
    runCode.mockResolvedValue(frames)

    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: /run/i }))

    await waitFor(() =>
      expect(useStore.getState().executionStatus).toBe('overflow')
    )
  })
})

// ---------------------------------------------------------------------------
// Run button click — exception path
// ---------------------------------------------------------------------------

describe('Editor — run result with exception frame', () => {
  it('sets executionStatus to error when any frame has event exception', async () => {
    const frames = [
      ...makeFrames(2),
      { event: 'exception', lineNo: 3, callStack: [], stdout: '', callTree: [], activeCallId: null, error: 'ValueError' },
    ]
    runCode.mockResolvedValue(frames)

    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: /run/i }))

    await waitFor(() =>
      expect(useStore.getState().executionStatus).toBe('error')
    )
  })
})

// ---------------------------------------------------------------------------
// Run button click — runCode itself throws
// ---------------------------------------------------------------------------

describe('Editor — runCode throws', () => {
  it('sets executionStatus to error when runCode rejects', async () => {
    runCode.mockRejectedValue(new Error('Pyodide not loaded'))

    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: /run/i }))

    await waitFor(() =>
      expect(useStore.getState().executionStatus).toBe('error')
    )
  })

  it('stores the error message in executionError', async () => {
    runCode.mockRejectedValue(new Error('Something exploded'))

    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: /run/i }))

    await waitFor(() =>
      expect(useStore.getState().executionError).toBe('Something exploded')
    )
  })
})

// ---------------------------------------------------------------------------
// pyodideStatus guard
// ---------------------------------------------------------------------------

describe('Editor — pyodideStatus guard', () => {
  it('does not call runCode when pyodideStatus is not ready', async () => {
    resetStore({ pyodideStatus: 'loading' })
    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: /run/i }))
    // Give any async work a tick
    await new Promise(r => setTimeout(r, 0))
    expect(runCode).not.toHaveBeenCalled()
  })

  it('does not call runCode when pyodideStatus is error', async () => {
    resetStore({ pyodideStatus: 'error' })
    // Re-enable the button manually to simulate a bad state
    // (In practice the button is disabled; here we fire the click anyway
    //  and check that handleRun guards correctly.)
    render(<Editor />)
    // Button is disabled so we trigger the handler by keyboard shortcut
    fireEvent.keyDown(window, { key: 'Enter', metaKey: true })
    await new Promise(r => setTimeout(r, 0))
    expect(runCode).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Keyboard shortcut Cmd/Ctrl+Enter
// ---------------------------------------------------------------------------

describe('Editor — keyboard shortcut', () => {
  it('Cmd+Enter triggers a run', async () => {
    const frames = makeFrames(2)
    runCode.mockResolvedValue(frames)
    resetStore({ pyodideStatus: 'ready', code: 'x = 1' })

    render(<Editor />)
    fireEvent.keyDown(window, { key: 'Enter', metaKey: true })

    await waitFor(() => expect(runCode).toHaveBeenCalledWith('x = 1'))
  })

  it('Ctrl+Enter triggers a run', async () => {
    const frames = makeFrames(2)
    runCode.mockResolvedValue(frames)
    resetStore({ pyodideStatus: 'ready', code: 'y = 2' })

    render(<Editor />)
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })

    await waitFor(() => expect(runCode).toHaveBeenCalledWith('y = 2'))
  })

  it('Enter without modifier does not trigger a run', async () => {
    render(<Editor />)
    fireEvent.keyDown(window, { key: 'Enter' })
    await new Promise(r => setTimeout(r, 0))
    expect(runCode).not.toHaveBeenCalled()
  })
})
