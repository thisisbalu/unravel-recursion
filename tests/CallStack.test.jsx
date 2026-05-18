/**
 * Vitest + RTL tests for src/components/CallStack/CallStack.jsx
 *
 * Run: npx vitest run tests/CallStack.test.jsx
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useStore } from '../src/store/index.js'
import { EXAMPLES } from '../src/examples/index.js'
import CallStack from '../src/components/CallStack/CallStack.jsx'

// CallStack.css is imported inside the component. jsdom does not handle CSS
// but it won't error — Vite transforms css imports to empty modules in test mode.

function resetStore() {
  useStore.setState({
    pyodideStatus: 'ready',
    pyodideProgress: 100,
    pyodideStage: 'Ready!',
    code: EXAMPLES[0].code,
    selectedExample: EXAMPLES[0].id,
    frames: [],
    executionStatus: 'idle',
    executionError: null,
    currentFrameIndex: 0,
    isPlaying: false,
    playbackSpeed: 1,
    viewMode: 'simple',
  })
}

beforeEach(resetStore)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal frame object for store injection. */
function makeFrame({
  event = 'line',
  lineNo = 1,
  callStack = [],
  stdout = '',
  callTree = [],
  activeCallId = null,
} = {}) {
  return { event, lineNo, callStack, stdout, callTree, activeCallId }
}

function makeStackEntry({ funcName = 'foo', lineNo = 1, locals = {} } = {}) {
  return { funcName, lineNo, locals }
}

function setFrames(frames, status = 'complete') {
  useStore.getState().setFrames(frames, status)
}

function setFrameIndex(idx) {
  useStore.setState({ currentFrameIndex: idx })
}

// ---------------------------------------------------------------------------
// Empty / pre-execution state
// ---------------------------------------------------------------------------

describe('CallStack — empty state (no frames)', () => {
  it('renders without crashing', () => {
    render(<CallStack />)
  })

  it('shows prompt to run code when frames is empty', () => {
    render(<CallStack />)
    expect(screen.getByText(/run your code to see the call stack/i)).toBeInTheDocument()
  })

  it('does not show the step counter when frames is empty', () => {
    render(<CallStack />)
    expect(screen.queryByText(/step \d+ \//i)).not.toBeInTheDocument()
  })

  it('does not show the overflow badge when status is idle', () => {
    render(<CallStack />)
    expect(screen.queryByText(/stack overflow/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// With frames — simple view
// ---------------------------------------------------------------------------

describe('CallStack — simple viewMode', () => {
  beforeEach(() => {
    useStore.setState({ viewMode: 'simple' })
  })

  it('shows the label "Current calls" in simple mode', () => {
    setFrames([makeFrame({ callStack: [makeStackEntry({ funcName: '<module>' })] })])
    render(<CallStack />)
    expect(screen.getByText('Current calls')).toBeInTheDocument()
  })

  it('renders <module> as "main code" in simple mode', () => {
    setFrames([
      makeFrame({ callStack: [makeStackEntry({ funcName: '<module>', lineNo: 1 })] }),
    ])
    render(<CallStack />)
    expect(screen.getByText('main code')).toBeInTheDocument()
  })

  it('renders a named function with () suffix', () => {
    setFrames([
      makeFrame({
        callStack: [
          makeStackEntry({ funcName: '<module>' }),
          makeStackEntry({ funcName: 'factorial' }),
        ],
      }),
    ])
    render(<CallStack />)
    expect(screen.getByText('factorial()')).toBeInTheDocument()
  })

  it('shows "Stored values" label in simple mode', () => {
    setFrames([
      makeFrame({
        callStack: [
          makeStackEntry({ funcName: 'factorial', locals: { n: '3' } }),
        ],
      }),
    ])
    render(<CallStack />)
    expect(screen.getByText('Stored values')).toBeInTheDocument()
  })

  it('shows step counter', () => {
    setFrames([makeFrame(), makeFrame(), makeFrame()])
    render(<CallStack />)
    expect(screen.getByText(/step 1 \/ 3/i)).toBeInTheDocument()
  })

  it('shows "No active calls" when frame exists but callStack is empty', () => {
    setFrames([makeFrame({ callStack: [] })])
    render(<CallStack />)
    expect(screen.getByText('No active calls')).toBeInTheDocument()
  })

  it('renders local variable key and value', () => {
    setFrames([
      makeFrame({
        callStack: [
          makeStackEntry({ funcName: 'factorial', locals: { n: '5' } }),
        ],
      }),
    ])
    render(<CallStack />)
    expect(screen.getByText('n')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('filters out locals starting with underscore', () => {
    setFrames([
      makeFrame({
        callStack: [
          makeStackEntry({ funcName: 'foo', locals: { _private: '1', visible: '2' } }),
        ],
      }),
    ])
    render(<CallStack />)
    expect(screen.queryByText('_private')).not.toBeInTheDocument()
    expect(screen.getByText('visible')).toBeInTheDocument()
  })

  it('filters out __builtins__ from locals display', () => {
    setFrames([
      makeFrame({
        callStack: [
          makeStackEntry({ funcName: 'foo', locals: { __builtins__: '<builtins>', x: '1' } }),
        ],
      }),
    ])
    render(<CallStack />)
    expect(screen.queryByText('__builtins__')).not.toBeInTheDocument()
    expect(screen.getByText('x')).toBeInTheDocument()
  })

  it('shows stdout section when frame has stdout', () => {
    setFrames([makeFrame({ stdout: 'hello world\n' })])
    render(<CallStack />)
    expect(screen.getByText('Output')).toBeInTheDocument()
    expect(screen.getByText(/hello world/)).toBeInTheDocument()
  })

  it('does not show stdout section when stdout is empty', () => {
    setFrames([makeFrame({ stdout: '' })])
    render(<CallStack />)
    expect(screen.queryByText('Output')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Technical viewMode
// ---------------------------------------------------------------------------

describe('CallStack — technical viewMode', () => {
  beforeEach(() => {
    useStore.setState({ viewMode: 'technical' })
  })

  it('shows "Call stack" label in technical mode', () => {
    setFrames([makeFrame({ callStack: [makeStackEntry({ funcName: '<module>' })] })])
    render(<CallStack />)
    expect(screen.getByText('Call stack')).toBeInTheDocument()
  })

  it('renders <module> as <module> in technical mode', () => {
    setFrames([
      makeFrame({ callStack: [makeStackEntry({ funcName: '<module>', lineNo: 1 })] }),
    ])
    render(<CallStack />)
    expect(screen.getByText('<module>')).toBeInTheDocument()
  })

  it('shows "Local variables" label in technical mode', () => {
    setFrames([
      makeFrame({
        callStack: [
          makeStackEntry({ funcName: 'foo', locals: { x: '1' } }),
        ],
      }),
    ])
    render(<CallStack />)
    expect(screen.getByText('Local variables')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Stack overflow state
// ---------------------------------------------------------------------------

describe('CallStack — overflow state', () => {
  it('shows overflow badge when executionStatus is overflow', () => {
    setFrames([makeFrame()], 'overflow')
    render(<CallStack />)
    expect(screen.getByText('Stack overflow')).toBeInTheDocument()
  })

  it('does not show overflow badge when executionStatus is complete', () => {
    setFrames([makeFrame()], 'complete')
    render(<CallStack />)
    expect(screen.queryByText('Stack overflow')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Multi-frame scrubbing
// ---------------------------------------------------------------------------

describe('CallStack — multi-frame navigation', () => {
  it('displays the frame at currentFrameIndex', () => {
    setFrames([
      makeFrame({ callStack: [makeStackEntry({ funcName: 'foo', locals: { n: '3' } })] }),
      makeFrame({ callStack: [makeStackEntry({ funcName: 'foo', locals: { n: '2' } })] }),
    ])
    setFrameIndex(0)
    render(<CallStack />)
    // n=3 is in frame 0
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows correct step counter for frame 2 of 3', () => {
    setFrames([makeFrame(), makeFrame(), makeFrame()])
    setFrameIndex(1)
    render(<CallStack />)
    expect(screen.getByText(/step 2 \/ 3/i)).toBeInTheDocument()
  })

  it('the active frame (top of reversed stack) gets frame-active class', () => {
    setFrames([
      makeFrame({
        callStack: [
          makeStackEntry({ funcName: '<module>' }),
          makeStackEntry({ funcName: 'factorial' }),
        ],
      }),
    ])
    render(<CallStack />)
    const activeFrames = document.querySelectorAll('.frame-active')
    expect(activeFrames.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Deep stack renders all frames in order
// ---------------------------------------------------------------------------

describe('CallStack — deep call stack rendering', () => {
  it('renders all stack entries for a 3-deep call', () => {
    setFrames([
      makeFrame({
        callStack: [
          makeStackEntry({ funcName: '<module>' }),
          makeStackEntry({ funcName: 'outer' }),
          makeStackEntry({ funcName: 'inner' }),
        ],
      }),
    ])
    render(<CallStack />)
    expect(screen.getByText('outer()')).toBeInTheDocument()
    expect(screen.getByText('inner()')).toBeInTheDocument()
  })

  it('renders frames in reverse (top-of-stack first)', () => {
    setFrames([
      makeFrame({
        callStack: [
          makeStackEntry({ funcName: '<module>' }),
          makeStackEntry({ funcName: 'outer' }),
          makeStackEntry({ funcName: 'inner' }),
        ],
      }),
    ])
    render(<CallStack />)
    const frames = document.querySelectorAll('.stack-frame')
    // First rendered frame should be inner() (it's the top of stack, rendered first)
    expect(frames[0].textContent).toContain('inner()')
  })
})
