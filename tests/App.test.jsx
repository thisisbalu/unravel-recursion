/**
 * Vitest + RTL integration tests for src/App.jsx
 *
 * App is the root component that orchestrates LoadingScreen, Editor,
 * CallStack, CallTree, Controls, and ExamplesPanel. It calls loadPyodide
 * on mount — we mock that to avoid real network requests.
 *
 * Three rendering paths are tested:
 *   1. pyodideStatus === 'loading'  → LoadingScreen is shown
 *   2. pyodideStatus === 'error'    → error message is shown
 *   3. pyodideStatus === 'ready'    → full app layout is shown
 *
 * Run: npx vitest run tests/App.test.jsx
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { useStore } from '../src/store/index.js'
import { EXAMPLES } from '../src/examples/index.js'

// ---------------------------------------------------------------------------
// Mock heavy dependencies that App.jsx pulls in transitively
// ---------------------------------------------------------------------------

// Prevent real Pyodide CDN load
vi.mock('../src/engine/pyodide.js', () => ({
  loadPyodide: vi.fn(() => new Promise(() => {})), // never resolves by default
  runCode: vi.fn(),
}))

// Mock CodeMirror so Editor doesn't crash in jsdom
vi.mock('codemirror', () => ({ basicSetup: [] }))

vi.mock('@codemirror/view', () => ({
  EditorView: class EditorView {
    constructor({ parent } = {}) {
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
  EditorState: { create: () => ({ doc: { toString: () => '' } }) },
  StateField: { define: () => ({}) },
  StateEffect: { define: () => ({ of: (v) => ({ value: v, is: () => true }) }) },
}))

vi.mock('@codemirror/lang-python', () => ({ python: () => [] }))

import { loadPyodide } from '../src/engine/pyodide.js'
import App from '../src/App.jsx'

// ---------------------------------------------------------------------------
// Store reset helper
// ---------------------------------------------------------------------------

function resetStore(overrides = {}) {
  useStore.setState({
    pyodideStatus: 'loading',
    pyodideProgress: 0,
    pyodideStage: 'Initializing...',
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

beforeEach(() => {
  resetStore()
  vi.clearAllMocks()
  // Default: loadPyodide never resolves (keeps app in loading state)
  loadPyodide.mockReturnValue(new Promise(() => {}))
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('App — loading state', () => {
  it('renders the LoadingScreen when pyodideStatus is loading', () => {
    resetStore({ pyodideStatus: 'loading', pyodideProgress: 0, pyodideStage: 'Initializing...' })
    render(<App />)
    // LoadingScreen shows the tagline
    expect(screen.getByText(/see inside your code/i)).toBeInTheDocument()
  })

  it('does not render the editor while loading', () => {
    resetStore({ pyodideStatus: 'loading' })
    render(<App />)
    expect(screen.queryByRole('button', { name: /run/i })).not.toBeInTheDocument()
  })

  it('does not render the controls bar while loading', () => {
    resetStore({ pyodideStatus: 'loading' })
    render(<App />)
    expect(screen.queryByTitle(/play \/ pause/i)).not.toBeInTheDocument()
  })

  it('shows the initial progress values in LoadingScreen', () => {
    resetStore({ pyodideStatus: 'loading', pyodideProgress: 5, pyodideStage: 'Downloading Python...' })
    render(<App />)
    expect(screen.getByText('Downloading Python...')).toBeInTheDocument()
    expect(screen.getByText('5%')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe('App — error state', () => {
  it('shows error message when pyodideStatus is error', () => {
    resetStore({ pyodideStatus: 'error' })
    render(<App />)
    expect(screen.getByText(/failed to load python runtime/i)).toBeInTheDocument()
  })

  it('suggests refreshing the page on error', () => {
    resetStore({ pyodideStatus: 'error' })
    render(<App />)
    expect(screen.getByText(/refresh the page/i)).toBeInTheDocument()
  })

  it('does not render the full app layout on error', () => {
    resetStore({ pyodideStatus: 'error' })
    render(<App />)
    expect(screen.queryByRole('button', { name: /run/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Ready state — full app layout
// ---------------------------------------------------------------------------

describe('App — ready state', () => {
  beforeEach(() => {
    resetStore({ pyodideStatus: 'ready' })
  })

  it('renders the full app without crashing', () => {
    render(<App />)
  })

  it('shows the logo text', () => {
    render(<App />)
    expect(screen.getByText('Unravel')).toBeInTheDocument()
  })

  it('shows the ExamplesPanel with the dropdown', () => {
    render(<App />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('shows all 5 example options', () => {
    render(<App />)
    const options = screen.getAllByRole('option')
    expect(options.length).toBe(EXAMPLES.length)
  })

  it('shows the Run button in the editor', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
  })

  it('shows the Controls bar (rewind button)', () => {
    render(<App />)
    expect(screen.getByTitle(/rewind/i)).toBeInTheDocument()
  })

  it('shows the play button', () => {
    render(<App />)
    expect(screen.getByTitle(/play \/ pause/i)).toBeInTheDocument()
  })

  it('shows the speed buttons', () => {
    render(<App />)
    expect(screen.getByText('1x')).toBeInTheDocument()
  })

  it('shows the CallStack panel header in simple mode', () => {
    render(<App />)
    expect(screen.getByText('Current calls')).toBeInTheDocument()
  })

  it('shows the CallTree panel header in simple mode', () => {
    render(<App />)
    expect(screen.getByText('Call picture')).toBeInTheDocument()
  })

  it('shows the view-toggle button', () => {
    render(<App />)
    expect(screen.getByText('Simple view')).toBeInTheDocument()
  })

  it('shows the run-code empty-state prompt in CallStack', () => {
    render(<App />)
    expect(screen.getByText(/run your code to see the call stack/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// loadPyodide is called on mount
// ---------------------------------------------------------------------------

describe('App — Pyodide initialization', () => {
  it('calls loadPyodide on mount', () => {
    resetStore({ pyodideStatus: 'loading' })
    render(<App />)
    expect(loadPyodide).toHaveBeenCalledTimes(1)
  })

  it('transitions to ready state after loadPyodide resolves', async () => {
    resetStore({ pyodideStatus: 'loading' })

    // Resolve loadPyodide after the component mounts
    loadPyodide.mockImplementation((onProgress) => {
      onProgress({ stage: 'Ready!', percent: 100 })
      return Promise.resolve({})
    })

    render(<App />)

    await waitFor(() =>
      expect(useStore.getState().pyodideStatus).toBe('ready')
    )
  })

  it('transitions to error state when loadPyodide rejects', async () => {
    resetStore({ pyodideStatus: 'loading' })

    loadPyodide.mockRejectedValue(new Error('Network error'))

    render(<App />)

    await waitFor(() =>
      expect(useStore.getState().pyodideStatus).toBe('error')
    )
  })

  it('does not call loadPyodide a second time on re-render', () => {
    resetStore({ pyodideStatus: 'loading' })
    const { rerender } = render(<App />)
    rerender(<App />)
    expect(loadPyodide).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// viewMode toggle in full app
// ---------------------------------------------------------------------------

describe('App — viewMode toggle integration', () => {
  it('toggles from simple to technical when the button is clicked', () => {
    resetStore({ pyodideStatus: 'ready' })
    render(<App />)

    fireEvent.click(screen.getByText('Simple view'))

    expect(useStore.getState().viewMode).toBe('technical')
    expect(screen.getByText('Technical view')).toBeInTheDocument()
  })

  it('updates CallStack label to "Call stack" in technical mode', () => {
    resetStore({ pyodideStatus: 'ready' })
    render(<App />)

    fireEvent.click(screen.getByText('Simple view'))

    expect(screen.getByText('Call stack')).toBeInTheDocument()
  })

  it('updates CallTree title to "Call tree" in technical mode', () => {
    resetStore({ pyodideStatus: 'ready' })
    render(<App />)

    fireEvent.click(screen.getByText('Simple view'))

    expect(screen.getByText('Call tree')).toBeInTheDocument()
  })
})
