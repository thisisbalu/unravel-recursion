/**
 * Vitest + RTL tests for src/components/Controls/Controls.jsx
 *
 * Run: npx vitest run tests/Controls.test.jsx
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { useStore } from '../src/store/index.js'
import { EXAMPLES } from '../src/examples/index.js'
import Controls from '../src/components/Controls/Controls.jsx'

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

function makeFrames(n) {
  return Array.from({ length: n }, (_, i) => ({ event: 'line', lineNo: i + 1 }))
}

function setFrames(n, status = 'complete') {
  useStore.getState().setFrames(makeFrames(n), status)
}

beforeEach(() => {
  resetStore()
  // Freeze real timers — Controls uses setInterval for playback
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Rendering — no frames
// ---------------------------------------------------------------------------

describe('Controls — empty state (no frames)', () => {
  it('renders without crashing', () => {
    render(<Controls />)
  })

  it('shows the rewind button', () => {
    render(<Controls />)
    expect(screen.getByTitle(/rewind/i)).toBeInTheDocument()
  })

  it('shows the play button', () => {
    render(<Controls />)
    expect(screen.getByTitle(/play \/ pause/i)).toBeInTheDocument()
  })

  it('disables rewind button when no frames', () => {
    render(<Controls />)
    expect(screen.getByTitle(/rewind/i)).toBeDisabled()
  })

  it('disables step-back button when no frames', () => {
    render(<Controls />)
    expect(screen.getByTitle(/step back/i)).toBeDisabled()
  })

  it('disables play button when no frames', () => {
    render(<Controls />)
    expect(screen.getByTitle(/play \/ pause/i)).toBeDisabled()
  })

  it('disables step-forward button when no frames', () => {
    render(<Controls />)
    expect(screen.getByTitle(/step forward/i)).toBeDisabled()
  })

  it('does not render the scrubber when no frames', () => {
    render(<Controls />)
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('shows keyboard hints', () => {
    render(<Controls />)
    expect(screen.getByText(/space/i)).toBeInTheDocument()
  })

  it('shows all 4 speed buttons', () => {
    render(<Controls />)
    expect(screen.getByText('0.5x')).toBeInTheDocument()
    expect(screen.getByText('1x')).toBeInTheDocument()
    expect(screen.getByText('2x')).toBeInTheDocument()
    expect(screen.getByText('4x')).toBeInTheDocument()
  })

  it('highlights the default speed (1x) as active', () => {
    render(<Controls />)
    const btn = screen.getByText('1x')
    expect(btn.className).toContain('active')
  })
})

// ---------------------------------------------------------------------------
// Rendering — with frames
// ---------------------------------------------------------------------------

describe('Controls — with frames', () => {
  beforeEach(() => {
    setFrames(5)
  })

  it('enables rewind button when at non-zero index', () => {
    useStore.setState({ currentFrameIndex: 2 })
    render(<Controls />)
    expect(screen.getByTitle(/rewind/i)).not.toBeDisabled()
  })

  it('disables rewind button when at index 0', () => {
    useStore.setState({ currentFrameIndex: 0 })
    render(<Controls />)
    expect(screen.getByTitle(/rewind/i)).toBeDisabled()
  })

  it('enables step-back when not at frame 0', () => {
    useStore.setState({ currentFrameIndex: 1 })
    render(<Controls />)
    expect(screen.getByTitle(/step back/i)).not.toBeDisabled()
  })

  it('disables step-forward when at last frame', () => {
    useStore.setState({ currentFrameIndex: 4 }) // last of 5 frames
    render(<Controls />)
    expect(screen.getByTitle(/step forward/i)).toBeDisabled()
  })

  it('enables step-forward when not at last frame', () => {
    useStore.setState({ currentFrameIndex: 0 })
    render(<Controls />)
    expect(screen.getByTitle(/step forward/i)).not.toBeDisabled()
  })

  it('shows the scrubber input', () => {
    render(<Controls />)
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })

  it('scrubber has correct max value', () => {
    render(<Controls />)
    const slider = screen.getByRole('slider')
    expect(Number(slider.getAttribute('max'))).toBe(4) // frames.length - 1
  })

  it('scrubber value matches currentFrameIndex', () => {
    useStore.setState({ currentFrameIndex: 2 })
    render(<Controls />)
    const slider = screen.getByRole('slider')
    expect(Number(slider.value)).toBe(2)
  })

  it('shows frame counter label', () => {
    useStore.setState({ currentFrameIndex: 0 })
    render(<Controls />)
    expect(screen.getByText('1 / 5')).toBeInTheDocument()
  })

  it('shows play icon when not playing', () => {
    render(<Controls />)
    expect(screen.getByTitle(/play \/ pause/i).textContent).toContain('▶')
  })

  it('shows pause icon when playing', () => {
    useStore.setState({ isPlaying: true })
    render(<Controls />)
    expect(screen.getByTitle(/play \/ pause/i).textContent).toContain('⏸')
  })
})

// ---------------------------------------------------------------------------
// User interactions
// ---------------------------------------------------------------------------

describe('Controls — button interactions', () => {
  beforeEach(() => {
    setFrames(5)
    useStore.setState({ currentFrameIndex: 2 })
  })

  it('clicking step-forward increments frame index', () => {
    render(<Controls />)
    fireEvent.click(screen.getByTitle(/step forward/i))
    expect(useStore.getState().currentFrameIndex).toBe(3)
  })

  it('clicking step-back decrements frame index', () => {
    render(<Controls />)
    fireEvent.click(screen.getByTitle(/step back/i))
    expect(useStore.getState().currentFrameIndex).toBe(1)
  })

  it('clicking rewind resets to frame 0', () => {
    render(<Controls />)
    fireEvent.click(screen.getByTitle(/rewind/i))
    expect(useStore.getState().currentFrameIndex).toBe(0)
  })

  it('clicking play sets isPlaying to true', () => {
    render(<Controls />)
    fireEvent.click(screen.getByTitle(/play \/ pause/i))
    expect(useStore.getState().isPlaying).toBe(true)
  })

  it('clicking play then pause sets isPlaying to false', () => {
    render(<Controls />)
    fireEvent.click(screen.getByTitle(/play \/ pause/i)) // play
    fireEvent.click(screen.getByTitle(/play \/ pause/i)) // pause
    expect(useStore.getState().isPlaying).toBe(false)
  })

  it('scrubbing sets currentFrameIndex', () => {
    render(<Controls />)
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '4' } })
    expect(useStore.getState().currentFrameIndex).toBe(4)
  })

  it('clicking a speed button changes playbackSpeed', () => {
    render(<Controls />)
    fireEvent.click(screen.getByText('2x'))
    expect(useStore.getState().playbackSpeed).toBe(2)
  })

  it('the active speed button has class active', () => {
    render(<Controls />)
    fireEvent.click(screen.getByText('4x'))
    // Re-render is driven by store update
    expect(screen.getByText('4x').className).toContain('active')
  })
})

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

describe('Controls — keyboard shortcuts', () => {
  beforeEach(() => {
    setFrames(5)
    useStore.setState({ currentFrameIndex: 2 })
    render(<Controls />)
  })

  it('ArrowRight steps forward', () => {
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(useStore.getState().currentFrameIndex).toBe(3)
  })

  it('ArrowLeft steps backward', () => {
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(useStore.getState().currentFrameIndex).toBe(1)
  })

  it('Space toggles play/pause', () => {
    expect(useStore.getState().isPlaying).toBe(false)
    fireEvent.keyDown(window, { key: ' ' })
    expect(useStore.getState().isPlaying).toBe(true)
    fireEvent.keyDown(window, { key: ' ' })
    expect(useStore.getState().isPlaying).toBe(false)
  })

  it('keyboard events on INPUT elements are ignored', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireEvent.keyDown(input, { key: 'ArrowRight', bubbles: true })
    // currentFrameIndex should remain 2 — the handler checks e.target.tagName === 'INPUT'
    expect(useStore.getState().currentFrameIndex).toBe(2)
    document.body.removeChild(input)
  })
})

// ---------------------------------------------------------------------------
// Autoplay with fake timers
// ---------------------------------------------------------------------------

describe('Controls — autoplay', () => {
  it('autoplay advances frame index over time', () => {
    setFrames(5)
    useStore.setState({ currentFrameIndex: 0 })
    render(<Controls />)
    act(() => { useStore.getState().setIsPlaying(true) })
    // Advance timer by 1 second (default speed = 1, interval = 1000ms)
    vi.advanceTimersByTime(1100)
    expect(useStore.getState().currentFrameIndex).toBeGreaterThan(0)
  })

  it('autoplay stops when it reaches the last frame', () => {
    setFrames(3)
    useStore.setState({ currentFrameIndex: 0 })
    render(<Controls />)
    act(() => { useStore.getState().setIsPlaying(true) })
    // Advance enough to exhaust all frames
    vi.advanceTimersByTime(5000)
    expect(useStore.getState().isPlaying).toBe(false)
    expect(useStore.getState().currentFrameIndex).toBe(2) // last frame
  })

  it('faster speed advances frames more quickly', () => {
    setFrames(10)
    useStore.setState({ currentFrameIndex: 0, playbackSpeed: 4 })
    render(<Controls />)
    act(() => { useStore.getState().setIsPlaying(true) })
    // At 4x speed the interval is 250ms — 4 frames should advance in 1.1s
    vi.advanceTimersByTime(1100)
    expect(useStore.getState().currentFrameIndex).toBeGreaterThanOrEqual(4)
  })
})

// ---------------------------------------------------------------------------
// Stack overflow notice
// ---------------------------------------------------------------------------

describe('Controls — overflow notice', () => {
  it('shows overflow notice when executionStatus is overflow', () => {
    setFrames(5, 'overflow')
    render(<Controls />)
    expect(screen.getByText(/stack overflow/i)).toBeInTheDocument()
    expect(screen.getByText(/infinite recursion/i)).toBeInTheDocument()
  })

  it('does not show overflow notice when executionStatus is complete', () => {
    setFrames(5, 'complete')
    render(<Controls />)
    expect(screen.queryByText(/infinite recursion/i)).not.toBeInTheDocument()
  })

  it('does not show overflow notice when idle', () => {
    render(<Controls />)
    expect(screen.queryByText(/infinite recursion/i)).not.toBeInTheDocument()
  })
})
