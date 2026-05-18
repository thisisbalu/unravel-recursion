/**
 * Vitest + RTL tests for src/components/ExamplesPanel/ExamplesPanel.jsx
 *
 * Run: npx vitest run tests/ExamplesPanel.test.jsx
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useStore } from '../src/store/index.js'
import { EXAMPLES } from '../src/examples/index.js'
import ExamplesPanel from '../src/components/ExamplesPanel/ExamplesPanel.jsx'

function resetStore() {
  useStore.setState({
    selectedExample: EXAMPLES[0].id,
    viewMode: 'simple',
    code: EXAMPLES[0].code,
    frames: [],
    executionStatus: 'idle',
    currentFrameIndex: 0,
  })
}

beforeEach(resetStore)

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('ExamplesPanel — rendering', () => {
  it('renders without crashing', () => {
    render(<ExamplesPanel />)
  })

  it('renders the Example: label', () => {
    render(<ExamplesPanel />)
    expect(screen.getByText('Example:')).toBeInTheDocument()
  })

  it('renders a select element for choosing examples', () => {
    render(<ExamplesPanel />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders all 5 example options', () => {
    render(<ExamplesPanel />)
    const options = screen.getAllByRole('option')
    expect(options.length).toBe(EXAMPLES.length)
  })

  it('renders each example label as an option', () => {
    render(<ExamplesPanel />)
    for (const ex of EXAMPLES) {
      expect(screen.getByRole('option', { name: ex.label })).toBeInTheDocument()
    }
  })

  it('renders the view-toggle button', () => {
    render(<ExamplesPanel />)
    // In simple mode the button text is "Simple view"
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Simple viewMode
// ---------------------------------------------------------------------------

describe('ExamplesPanel — simple viewMode', () => {
  beforeEach(() => {
    useStore.setState({ viewMode: 'simple' })
  })

  it('shows "Simple view" button text in simple mode', () => {
    render(<ExamplesPanel />)
    expect(screen.getByRole('button').textContent).toBe('Simple view')
  })

  it('toggle button does not have active class in simple mode', () => {
    render(<ExamplesPanel />)
    const btn = screen.getByRole('button')
    expect(btn.className).not.toContain('active')
  })

  it('selected example matches the store selectedExample', () => {
    useStore.setState({ selectedExample: EXAMPLES[0].id })
    render(<ExamplesPanel />)
    const select = screen.getByRole('combobox')
    expect(select.value).toBe(EXAMPLES[0].id)
  })
})

// ---------------------------------------------------------------------------
// Technical viewMode
// ---------------------------------------------------------------------------

describe('ExamplesPanel — technical viewMode', () => {
  beforeEach(() => {
    useStore.setState({ viewMode: 'technical' })
  })

  it('shows "Technical view" button text in technical mode', () => {
    render(<ExamplesPanel />)
    expect(screen.getByRole('button').textContent).toBe('Technical view')
  })

  it('toggle button has active class in technical mode', () => {
    render(<ExamplesPanel />)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('active')
  })
})

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

describe('ExamplesPanel — interactions', () => {
  it('clicking the toggle button switches from simple to technical', () => {
    useStore.setState({ viewMode: 'simple' })
    render(<ExamplesPanel />)
    fireEvent.click(screen.getByRole('button'))
    expect(useStore.getState().viewMode).toBe('technical')
  })

  it('clicking the toggle button twice returns to simple', () => {
    useStore.setState({ viewMode: 'simple' })
    render(<ExamplesPanel />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(useStore.getState().viewMode).toBe('simple')
  })

  it('selecting a different example updates the store code', () => {
    render(<ExamplesPanel />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: EXAMPLES[1].id } })
    expect(useStore.getState().code).toBe(EXAMPLES[1].code)
  })

  it('selecting an example updates selectedExample id in store', () => {
    render(<ExamplesPanel />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: EXAMPLES[2].id } })
    expect(useStore.getState().selectedExample).toBe(EXAMPLES[2].id)
  })

  it('selecting an example resets frames', () => {
    useStore.getState().setFrames([{ event: 'line', lineNo: 1 }], 'complete')
    render(<ExamplesPanel />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: EXAMPLES[1].id } })
    expect(useStore.getState().frames).toEqual([])
  })

  it('can select every example through the dropdown', () => {
    render(<ExamplesPanel />)
    const select = screen.getByRole('combobox')
    for (const ex of EXAMPLES) {
      fireEvent.change(select, { target: { value: ex.id } })
      expect(useStore.getState().selectedExample).toBe(ex.id)
    }
  })
})
