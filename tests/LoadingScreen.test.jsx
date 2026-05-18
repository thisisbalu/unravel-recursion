/**
 * Vitest + RTL tests for src/components/LoadingScreen/LoadingScreen.jsx
 *
 * Run: npx vitest run tests/LoadingScreen.test.jsx
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useStore } from '../src/store/index.js'
import LoadingScreen from '../src/components/LoadingScreen/LoadingScreen.jsx'

function resetStore(overrides = {}) {
  useStore.setState({
    pyodideProgress: 0,
    pyodideStage: 'Initializing...',
    ...overrides,
  })
}

beforeEach(() => resetStore())

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe('LoadingScreen — rendering', () => {
  it('renders without crashing', () => {
    render(<LoadingScreen />)
  })

  it('shows the Unravel logo text', () => {
    render(<LoadingScreen />)
    expect(screen.getByText('Unravel')).toBeInTheDocument()
  })

  it('shows the tagline', () => {
    render(<LoadingScreen />)
    expect(screen.getByText(/see inside your code/i)).toBeInTheDocument()
  })

  it('displays the current stage label from the store', () => {
    resetStore({ pyodideStage: 'Downloading Python...' })
    render(<LoadingScreen />)
    expect(screen.getByText('Downloading Python...')).toBeInTheDocument()
  })

  it('displays the current progress percentage from the store', () => {
    resetStore({ pyodideProgress: 42 })
    render(<LoadingScreen />)
    expect(screen.getByText('42%')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Progress bar width
// ---------------------------------------------------------------------------

describe('LoadingScreen — progress bar', () => {
  it('progress fill has width 0% when progress is 0', () => {
    resetStore({ pyodideProgress: 0 })
    render(<LoadingScreen />)
    const fill = document.querySelector('.progress-fill')
    expect(fill).not.toBeNull()
    expect(fill.style.width).toBe('0%')
  })

  it('progress fill reflects 30% progress', () => {
    resetStore({ pyodideProgress: 30 })
    render(<LoadingScreen />)
    const fill = document.querySelector('.progress-fill')
    expect(fill.style.width).toBe('30%')
  })

  it('progress fill reflects 75% progress', () => {
    resetStore({ pyodideProgress: 75 })
    render(<LoadingScreen />)
    const fill = document.querySelector('.progress-fill')
    expect(fill.style.width).toBe('75%')
  })

  it('progress fill is 100% when complete', () => {
    resetStore({ pyodideProgress: 100 })
    render(<LoadingScreen />)
    const fill = document.querySelector('.progress-fill')
    expect(fill.style.width).toBe('100%')
  })
})

// ---------------------------------------------------------------------------
// "This only happens once" notice
// ---------------------------------------------------------------------------

describe('LoadingScreen — one-time notice', () => {
  it('shows the notice when progress is below 100', () => {
    resetStore({ pyodideProgress: 50 })
    render(<LoadingScreen />)
    expect(screen.getByText(/this only happens once/i)).toBeInTheDocument()
  })

  it('shows the notice when progress is 0', () => {
    resetStore({ pyodideProgress: 0 })
    render(<LoadingScreen />)
    expect(screen.getByText(/this only happens once/i)).toBeInTheDocument()
  })

  it('hides the notice once progress reaches 100', () => {
    resetStore({ pyodideProgress: 100 })
    render(<LoadingScreen />)
    expect(screen.queryByText(/this only happens once/i)).not.toBeInTheDocument()
  })

  it('shows Ready! stage at 100% with no notice', () => {
    resetStore({ pyodideProgress: 100, pyodideStage: 'Ready!' })
    render(<LoadingScreen />)
    expect(screen.getByText('Ready!')).toBeInTheDocument()
    expect(screen.queryByText(/this only happens once/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Store reactivity — multiple progress values
// ---------------------------------------------------------------------------

describe('LoadingScreen — stage label updates', () => {
  it('shows "Initializing..." at start', () => {
    resetStore({ pyodideProgress: 0, pyodideStage: 'Initializing...' })
    render(<LoadingScreen />)
    expect(screen.getByText('Initializing...')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('shows "Loading standard library..." at 75%', () => {
    resetStore({ pyodideProgress: 75, pyodideStage: 'Loading standard library...' })
    render(<LoadingScreen />)
    expect(screen.getByText('Loading standard library...')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })
})
