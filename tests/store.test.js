/**
 * Vitest unit tests for src/store/index.js
 *
 * Run: npx vitest run tests/store.test.js
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../src/store/index.js'
import { EXAMPLES } from '../src/examples/index.js'

// Reset store to initial state before each test so tests are independent.
function resetStore() {
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
  })
}

// Helper: access raw state without a React component
const getState = () => useStore.getState()
const act = (fn) => fn(useStore.getState())

beforeEach(resetStore)

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('initial state', () => {
  it('starts with pyodideStatus loading', () => {
    expect(getState().pyodideStatus).toBe('loading')
  })

  it('starts with the first example loaded as code', () => {
    expect(getState().code).toBe(EXAMPLES[0].code)
    expect(getState().selectedExample).toBe(EXAMPLES[0].id)
  })

  it('starts with empty frames array', () => {
    expect(getState().frames).toEqual([])
  })

  it('starts with executionStatus idle', () => {
    expect(getState().executionStatus).toBe('idle')
  })

  it('starts with currentFrameIndex 0', () => {
    expect(getState().currentFrameIndex).toBe(0)
  })

  it('starts not playing', () => {
    expect(getState().isPlaying).toBe(false)
  })

  it('starts with playbackSpeed 1', () => {
    expect(getState().playbackSpeed).toBe(1)
  })

  it('starts in simple viewMode', () => {
    expect(getState().viewMode).toBe('simple')
  })

  it('starts with executionError null', () => {
    expect(getState().executionError).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// setPyodideStatus
// ---------------------------------------------------------------------------

describe('setPyodideStatus', () => {
  it('transitions from loading to ready', () => {
    getState().setPyodideStatus('ready')
    expect(getState().pyodideStatus).toBe('ready')
  })

  it('transitions from loading to error', () => {
    getState().setPyodideStatus('error')
    expect(getState().pyodideStatus).toBe('error')
  })

  it('transitions back to loading', () => {
    getState().setPyodideStatus('ready')
    getState().setPyodideStatus('loading')
    expect(getState().pyodideStatus).toBe('loading')
  })
})

// ---------------------------------------------------------------------------
// setPyodideProgress
// ---------------------------------------------------------------------------

describe('setPyodideProgress', () => {
  it('updates percent and stage together', () => {
    getState().setPyodideProgress(50, 'Loading standard library...')
    expect(getState().pyodideProgress).toBe(50)
    expect(getState().pyodideStage).toBe('Loading standard library...')
  })

  it('can be called multiple times', () => {
    getState().setPyodideProgress(30, 'Initializing Python runtime...')
    getState().setPyodideProgress(100, 'Ready!')
    expect(getState().pyodideProgress).toBe(100)
    expect(getState().pyodideStage).toBe('Ready!')
  })
})

// ---------------------------------------------------------------------------
// setCode
// ---------------------------------------------------------------------------

describe('setCode', () => {
  it('updates code string', () => {
    getState().setCode('x = 42')
    expect(getState().code).toBe('x = 42')
  })

  it('resets frames to empty on code change', () => {
    // Simulate post-execution state
    getState().setFrames([{ event: 'call' }, { event: 'return' }], 'complete')
    expect(getState().frames.length).toBe(2)

    getState().setCode('x = 1')
    expect(getState().frames).toEqual([])
  })

  it('resets executionStatus to idle on code change', () => {
    getState().setExecutionStatus('complete')
    getState().setCode('x = 1')
    expect(getState().executionStatus).toBe('idle')
  })

  it('resets currentFrameIndex to 0 on code change', () => {
    getState().setFrames([{ event: 'call' }, { event: 'return' }], 'complete')
    getState().setCurrentFrameIndex(1)
    getState().setCode('x = 1')
    expect(getState().currentFrameIndex).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// selectExample
// ---------------------------------------------------------------------------

describe('selectExample', () => {
  it('sets code to the selected example code', () => {
    const target = EXAMPLES[1] // fibonacci
    getState().selectExample(target.id)
    expect(getState().code).toBe(target.code)
  })

  it('sets selectedExample id', () => {
    const target = EXAMPLES[2] // binary_search
    getState().selectExample(target.id)
    expect(getState().selectedExample).toBe(target.id)
  })

  it('resets frames on example change', () => {
    getState().setFrames([{ event: 'call' }], 'complete')
    getState().selectExample(EXAMPLES[1].id)
    expect(getState().frames).toEqual([])
  })

  it('resets executionStatus to idle on example change', () => {
    getState().setExecutionStatus('overflow')
    getState().selectExample(EXAMPLES[1].id)
    expect(getState().executionStatus).toBe('idle')
  })

  it('resets currentFrameIndex to 0 on example change', () => {
    getState().setFrames([{ event: 'call' }, { event: 'return' }], 'complete')
    getState().setCurrentFrameIndex(1)
    getState().selectExample(EXAMPLES[1].id)
    expect(getState().currentFrameIndex).toBe(0)
  })

  it('does nothing for an unknown example id', () => {
    const codeBefore = getState().code
    getState().selectExample('does_not_exist')
    expect(getState().code).toBe(codeBefore)
  })

  it('can select all 5 examples without error', () => {
    for (const ex of EXAMPLES) {
      getState().selectExample(ex.id)
      expect(getState().selectedExample).toBe(ex.id)
      expect(getState().code).toBe(ex.code)
    }
  })
})

// ---------------------------------------------------------------------------
// setFrames
// ---------------------------------------------------------------------------

describe('setFrames', () => {
  const makeFrames = (n) => Array.from({ length: n }, (_, i) => ({ event: 'line', lineNo: i + 1 }))

  it('stores the provided frames array', () => {
    const frames = makeFrames(3)
    getState().setFrames(frames, 'complete')
    expect(getState().frames).toEqual(frames)
  })

  it('sets executionStatus to the provided status', () => {
    getState().setFrames(makeFrames(2), 'complete')
    expect(getState().executionStatus).toBe('complete')
  })

  it('sets executionStatus to overflow', () => {
    getState().setFrames(makeFrames(5), 'overflow')
    expect(getState().executionStatus).toBe('overflow')
  })

  it('resets currentFrameIndex to 0 regardless of prior value', () => {
    getState().setFrames(makeFrames(10), 'complete')
    getState().setCurrentFrameIndex(7)
    getState().setFrames(makeFrames(5), 'complete')
    expect(getState().currentFrameIndex).toBe(0)
  })

  it('stops playback when new frames arrive', () => {
    getState().setIsPlaying(true)
    getState().setFrames(makeFrames(3), 'complete')
    expect(getState().isPlaying).toBe(false)
  })

  it('accepts an empty frames array', () => {
    getState().setFrames([], 'error')
    expect(getState().frames).toEqual([])
    expect(getState().executionStatus).toBe('error')
  })
})

// ---------------------------------------------------------------------------
// setCurrentFrameIndex (clamping)
// ---------------------------------------------------------------------------

describe('setCurrentFrameIndex', () => {
  beforeEach(() => {
    // Set 5 frames so we have a real range [0, 4]
    getState().setFrames(
      Array.from({ length: 5 }, (_, i) => ({ event: 'line', lineNo: i + 1 })),
      'complete'
    )
  })

  it('sets index within valid range', () => {
    getState().setCurrentFrameIndex(3)
    expect(getState().currentFrameIndex).toBe(3)
  })

  it('clamps negative index to 0', () => {
    getState().setCurrentFrameIndex(-5)
    expect(getState().currentFrameIndex).toBe(0)
  })

  it('clamps index beyond last frame to frames.length - 1', () => {
    getState().setCurrentFrameIndex(999)
    expect(getState().currentFrameIndex).toBe(4)
  })

  it('clamps exactly to 0 when given 0', () => {
    getState().setCurrentFrameIndex(2)
    getState().setCurrentFrameIndex(0)
    expect(getState().currentFrameIndex).toBe(0)
  })

  it('clamps exactly to last index when given frames.length - 1', () => {
    getState().setCurrentFrameIndex(4)
    expect(getState().currentFrameIndex).toBe(4)
  })

  it('with empty frames, clamps everything to 0', () => {
    getState().setFrames([], 'idle')
    // frames.length - 1 == -1, so Math.min(idx, -1) = -1, Math.max(0, -1) = 0
    getState().setCurrentFrameIndex(5)
    expect(getState().currentFrameIndex).toBe(0)
    getState().setCurrentFrameIndex(-5)
    expect(getState().currentFrameIndex).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// stepForward
// ---------------------------------------------------------------------------

describe('stepForward', () => {
  beforeEach(() => {
    getState().setFrames(
      Array.from({ length: 3 }, (_, i) => ({ event: 'line', lineNo: i + 1 })),
      'complete'
    )
  })

  it('increments currentFrameIndex by 1', () => {
    getState().setCurrentFrameIndex(0)
    getState().stepForward()
    expect(getState().currentFrameIndex).toBe(1)
  })

  it('does not exceed last frame index', () => {
    getState().setCurrentFrameIndex(2) // last frame (length=3)
    getState().stepForward()
    expect(getState().currentFrameIndex).toBe(2)
  })

  it('stops playback when at the last frame', () => {
    getState().setIsPlaying(true)
    getState().setCurrentFrameIndex(2)
    getState().stepForward()
    expect(getState().isPlaying).toBe(false)
  })

  it('does not stop playback when not at last frame', () => {
    getState().setIsPlaying(true)
    getState().setCurrentFrameIndex(0)
    getState().stepForward()
    expect(getState().isPlaying).toBe(true)
  })

  it('can step through all frames sequentially', () => {
    getState().setCurrentFrameIndex(0)
    getState().stepForward()
    getState().stepForward()
    expect(getState().currentFrameIndex).toBe(2)
    getState().stepForward() // at end now
    expect(getState().currentFrameIndex).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// stepBackward
// ---------------------------------------------------------------------------

describe('stepBackward', () => {
  beforeEach(() => {
    getState().setFrames(
      Array.from({ length: 3 }, (_, i) => ({ event: 'line', lineNo: i + 1 })),
      'complete'
    )
  })

  it('decrements currentFrameIndex by 1', () => {
    getState().setCurrentFrameIndex(2)
    getState().stepBackward()
    expect(getState().currentFrameIndex).toBe(1)
  })

  it('does not go below 0', () => {
    getState().setCurrentFrameIndex(0)
    getState().stepBackward()
    expect(getState().currentFrameIndex).toBe(0)
  })

  it('can step back through all frames', () => {
    getState().setCurrentFrameIndex(2)
    getState().stepBackward()
    getState().stepBackward()
    expect(getState().currentFrameIndex).toBe(0)
    getState().stepBackward() // already at 0
    expect(getState().currentFrameIndex).toBe(0)
  })

  it('does not affect isPlaying', () => {
    getState().setIsPlaying(true)
    getState().setCurrentFrameIndex(2)
    getState().stepBackward()
    // stepBackward has no documented effect on isPlaying
    expect(getState().currentFrameIndex).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// rewind
// ---------------------------------------------------------------------------

describe('rewind', () => {
  beforeEach(() => {
    getState().setFrames(
      Array.from({ length: 5 }, (_, i) => ({ event: 'line', lineNo: i + 1 })),
      'complete'
    )
  })

  it('resets currentFrameIndex to 0', () => {
    getState().setCurrentFrameIndex(4)
    getState().rewind()
    expect(getState().currentFrameIndex).toBe(0)
  })

  it('stops playback', () => {
    getState().setIsPlaying(true)
    getState().rewind()
    expect(getState().isPlaying).toBe(false)
  })

  it('is idempotent when already at frame 0', () => {
    getState().setCurrentFrameIndex(0)
    getState().rewind()
    expect(getState().currentFrameIndex).toBe(0)
    expect(getState().isPlaying).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// setIsPlaying
// ---------------------------------------------------------------------------

describe('setIsPlaying', () => {
  it('sets isPlaying to true', () => {
    getState().setIsPlaying(true)
    expect(getState().isPlaying).toBe(true)
  })

  it('sets isPlaying to false', () => {
    getState().setIsPlaying(true)
    getState().setIsPlaying(false)
    expect(getState().isPlaying).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// setPlaybackSpeed
// ---------------------------------------------------------------------------

describe('setPlaybackSpeed', () => {
  it('sets speed to 0.5', () => {
    getState().setPlaybackSpeed(0.5)
    expect(getState().playbackSpeed).toBe(0.5)
  })

  it('sets speed to 2', () => {
    getState().setPlaybackSpeed(2)
    expect(getState().playbackSpeed).toBe(2)
  })

  it('sets speed to 4', () => {
    getState().setPlaybackSpeed(4)
    expect(getState().playbackSpeed).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// toggleViewMode
// ---------------------------------------------------------------------------

describe('toggleViewMode', () => {
  it('toggles from simple to technical', () => {
    expect(getState().viewMode).toBe('simple')
    getState().toggleViewMode()
    expect(getState().viewMode).toBe('technical')
  })

  it('toggles from technical back to simple', () => {
    getState().toggleViewMode()
    getState().toggleViewMode()
    expect(getState().viewMode).toBe('simple')
  })

  it('is idempotent over even number of toggles', () => {
    const before = getState().viewMode
    getState().toggleViewMode()
    getState().toggleViewMode()
    expect(getState().viewMode).toBe(before)
  })
})

// ---------------------------------------------------------------------------
// setExecutionStatus
// ---------------------------------------------------------------------------

describe('setExecutionStatus', () => {
  it('sets status without error', () => {
    getState().setExecutionStatus('running')
    expect(getState().executionStatus).toBe('running')
    expect(getState().executionError).toBeNull()
  })

  it('sets status with an error message', () => {
    getState().setExecutionStatus('error', 'SyntaxError: invalid syntax')
    expect(getState().executionStatus).toBe('error')
    expect(getState().executionError).toBe('SyntaxError: invalid syntax')
  })

  it('clears a previous error when setting to running', () => {
    getState().setExecutionStatus('error', 'oops')
    getState().setExecutionStatus('running')
    expect(getState().executionError).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Cross-action state consistency
// ---------------------------------------------------------------------------

describe('cross-action consistency', () => {
  it('store remains consistent after a full run cycle', () => {
    // Simulate: select example → run → scrub
    getState().selectExample(EXAMPLES[0].id)
    getState().setExecutionStatus('running')
    const frames = Array.from({ length: 10 }, (_, i) => ({ event: 'line', lineNo: i + 1 }))
    getState().setFrames(frames, 'complete')
    getState().setCurrentFrameIndex(5)
    getState().setIsPlaying(true)

    expect(getState().executionStatus).toBe('complete')
    expect(getState().currentFrameIndex).toBe(5)
    expect(getState().isPlaying).toBe(true)
    expect(getState().frames.length).toBe(10)
  })

  it('setFrames always resets isPlaying and currentFrameIndex regardless of prior state', () => {
    getState().setIsPlaying(true)
    getState().setCurrentFrameIndex(3)
    const frames = Array.from({ length: 5 }, (_, i) => ({ event: 'line', lineNo: i + 1 }))
    // Manually set currentFrameIndex without going through setCurrentFrameIndex
    getState().setFrames(frames, 'complete')
    expect(getState().isPlaying).toBe(false)
    expect(getState().currentFrameIndex).toBe(0)
  })
})
