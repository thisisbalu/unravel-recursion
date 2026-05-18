/**
 * Vitest unit tests for src/engine/pyodide.js
 *
 * Pyodide is never actually loaded — the CDN script injection and
 * window.loadPyodide are fully mocked.
 *
 * Run: npx vitest run tests/pyodide-engine.test.js
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Module-level mocks
//
// pyodide.js is an ES module that calls document.createElement and
// window.loadPyodide at runtime. We mock those on the global object so
// we can import the module under test without side-effects.
// ---------------------------------------------------------------------------

// Mock tracer source — the ?raw import is handled by Vite's transform.
// In the test environment we need to tell Vitest how to resolve it.
vi.mock('../src/engine/tracer.py?raw', () => ({ default: '# mock tracer source' }))

// Capture the script tag injected into document.head so we can fire onload/onerror.
let _injectedScript = null

function setupDomMocks() {
  // Stub document.createElement to intercept <script> creation
  const originalCreate = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    const el = originalCreate(tag)
    if (tag === 'script') {
      _injectedScript = el
      // Stub appendChild so onload fires synchronously when head.appendChild is called
      vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
        if (node === _injectedScript && node.onload) {
          // Simulate successful CDN script load
          setTimeout(() => node.onload(), 0)
        }
        return node
      })
    }
    return el
  })
}

function makeMockPyodide(runPythonAsyncImpl) {
  const globals = {
    _store: {},
    set(k, v) { this._store[k] = v },
    get(k) { return this._store[k] },
  }
  return {
    globals,
    runPythonAsync: runPythonAsyncImpl ?? vi.fn().mockResolvedValue(undefined),
  }
}

// ---------------------------------------------------------------------------
// Re-import with module reset between tests
// ---------------------------------------------------------------------------

// We use vi.doMock + dynamic import to get a fresh module instance per test
// so that the module-level `pyodideInstance` and `tracerReady` are reset.

async function freshModule() {
  // Force vitest to reload the module between calls
  vi.resetModules()
  vi.mock('../src/engine/tracer.py?raw', () => ({ default: '# mock tracer source' }))
  const mod = await import('../src/engine/pyodide.js')
  return mod
}

beforeEach(() => {
  _injectedScript = null
  vi.clearAllMocks()
  setupDomMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// loadPyodide
// ---------------------------------------------------------------------------

describe('loadPyodide', () => {
  it('resolves and returns a pyodide-like instance', async () => {
    const mockPy = makeMockPyodide()
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide } = await freshModule()
    const onProgress = vi.fn()
    const result = await loadPyodide(onProgress)

    expect(result).toBe(mockPy)
  })

  it('calls onProgress with Downloading stage first', async () => {
    const mockPy = makeMockPyodide()
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide } = await freshModule()
    const onProgress = vi.fn()
    await loadPyodide(onProgress)

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'Downloading Python...', percent: 5 })
    )
  })

  it('calls onProgress with Ready! at 100% at the end', async () => {
    const mockPy = makeMockPyodide()
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide } = await freshModule()
    const onProgress = vi.fn()
    await loadPyodide(onProgress)

    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0]
    expect(lastCall).toMatchObject({ stage: 'Ready!', percent: 100 })
  })

  it('calls onProgress at least 3 times (Downloading, Initializing, Loading stdlib, Ready)', async () => {
    const mockPy = makeMockPyodide()
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide } = await freshModule()
    const onProgress = vi.fn()
    await loadPyodide(onProgress)

    expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('injects a script tag into document.head', async () => {
    const mockPy = makeMockPyodide()
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide } = await freshModule()
    await loadPyodide(vi.fn())

    // document.head.appendChild should have been called with a script element
    expect(document.head.appendChild).toHaveBeenCalled()
  })

  it('sets crossOrigin to anonymous on the injected script', async () => {
    let capturedScript = null
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreate(tag)
      if (tag === 'script') {
        capturedScript = el
        vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
          if (node === capturedScript && node.onload) {
            setTimeout(() => node.onload(), 0)
          }
          return node
        })
      }
      return el
    })

    const mockPy = makeMockPyodide()
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide } = await freshModule()
    await loadPyodide(vi.fn())

    // This is the regression test for the COEP bug fix
    expect(capturedScript).not.toBeNull()
    expect(capturedScript.crossOrigin).toBe('anonymous')
  })

  it('sets script src to the correct Pyodide CDN URL', async () => {
    let capturedScript = null
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreate(tag)
      if (tag === 'script') {
        capturedScript = el
        vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
          if (node === capturedScript && node.onload) {
            setTimeout(() => node.onload(), 0)
          }
          return node
        })
      }
      return el
    })

    const mockPy = makeMockPyodide()
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide } = await freshModule()
    await loadPyodide(vi.fn())

    expect(capturedScript.src).toContain('cdn.jsdelivr.net/pyodide')
    expect(capturedScript.src).toContain('pyodide.js')
  })

  it('executes the tracer source via runPythonAsync', async () => {
    const runPythonAsync = vi.fn().mockResolvedValue(undefined)
    const mockPy = makeMockPyodide(runPythonAsync)
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide } = await freshModule()
    await loadPyodide(vi.fn())

    expect(runPythonAsync).toHaveBeenCalledWith(expect.stringContaining('mock tracer source'))
  })

  it('rejects when the CDN script fails to load', async () => {
    // Make appendChild fire onerror instead of onload
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreate(tag)
      if (tag === 'script') {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
          setTimeout(() => node.onerror(new Error('Network error')), 0)
          return node
        })
      }
      return el
    })

    const { loadPyodide } = await freshModule()
    await expect(loadPyodide(vi.fn())).rejects.toBeInstanceOf(Error)
  })

  it('returns the same instance on a second call (singleton)', async () => {
    const mockPy = makeMockPyodide()
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide } = await freshModule()
    const onProgress = vi.fn()
    const first = await loadPyodide(onProgress)
    const callCount = window.loadPyodide.mock.calls.length

    // Second call should not hit window.loadPyodide again
    const second = await loadPyodide(onProgress)
    expect(second).toBe(first)
    expect(window.loadPyodide.mock.calls.length).toBe(callCount)
  })
})

// ---------------------------------------------------------------------------
// runCode
// ---------------------------------------------------------------------------

describe('runCode', () => {
  it('throws if pyodide is not loaded yet', async () => {
    const { runCode } = await freshModule()
    await expect(runCode('x = 1')).rejects.toThrow('Pyodide not loaded')
  })

  it('sets _user_code global before running', async () => {
    const globals = {
      _store: {},
      set: vi.fn(function(k, v) { this._store[k] = v }),
      get: vi.fn(function(k) { return this._store[k] }),
    }
    const runPythonAsync = vi.fn()
      .mockResolvedValueOnce(undefined) // tracer setup call
      .mockResolvedValueOnce(JSON.stringify([{ event: 'line', lineNo: 1 }])) // user code call
    const mockPy = { globals, runPythonAsync }
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide, runCode } = await freshModule()
    await loadPyodide(vi.fn())
    await runCode('x = 42')

    expect(globals.set).toHaveBeenCalledWith('_user_code', 'x = 42')
  })

  it('calls collect_frames(_user_code) via runPythonAsync', async () => {
    const globals = {
      _store: {},
      set: vi.fn(function(k, v) { this._store[k] = v }),
      get: vi.fn(function(k) { return this._store[k] }),
    }
    const runPythonAsync = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(JSON.stringify([]))
    const mockPy = { globals, runPythonAsync }
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide, runCode } = await freshModule()
    await loadPyodide(vi.fn())
    await runCode('x = 1')

    expect(runPythonAsync).toHaveBeenCalledWith('collect_frames(_user_code)')
  })

  it('returns parsed JSON array of frames', async () => {
    const mockFrames = [
      { event: 'call', lineNo: 1, callStack: [], stdout: '', callTree: [], activeCallId: null },
      { event: 'return', lineNo: 1, callStack: [], stdout: '', callTree: [], activeCallId: null },
    ]
    const globals = {
      _store: {},
      set: vi.fn(function(k, v) { this._store[k] = v }),
      get: vi.fn(function(k) { return this._store[k] }),
    }
    const runPythonAsync = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(JSON.stringify(mockFrames))
    const mockPy = { globals, runPythonAsync }
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide, runCode } = await freshModule()
    await loadPyodide(vi.fn())
    const result = await runCode('x = 1')

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result[0].event).toBe('call')
    expect(result[1].event).toBe('return')
  })

  it('propagates errors thrown by runPythonAsync', async () => {
    const globals = {
      _store: {},
      set: vi.fn(function(k, v) { this._store[k] = v }),
      get: vi.fn(function(k) { return this._store[k] }),
    }
    const runPythonAsync = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('PythonError: something broke'))
    const mockPy = { globals, runPythonAsync }
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide, runCode } = await freshModule()
    await loadPyodide(vi.fn())
    await expect(runCode('raise ValueError("oops")')).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// loadPyodide progress callback sequence
// ---------------------------------------------------------------------------

describe('loadPyodide — progress sequence', () => {
  it('calls onProgress with Initializing Python runtime at ~30%', async () => {
    const mockPy = makeMockPyodide()
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide } = await freshModule()
    const onProgress = vi.fn()
    await loadPyodide(onProgress)

    const calls = onProgress.mock.calls.map(c => c[0])
    const initCall = calls.find(c => c.stage === 'Initializing Python runtime...')
    expect(initCall).toBeDefined()
    expect(initCall.percent).toBe(30)
  })

  it('calls onProgress with Loading standard library at ~75%', async () => {
    const mockPy = makeMockPyodide()
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide } = await freshModule()
    const onProgress = vi.fn()
    await loadPyodide(onProgress)

    const calls = onProgress.mock.calls.map(c => c[0])
    const stdlibCall = calls.find(c => c.stage === 'Loading standard library...')
    expect(stdlibCall).toBeDefined()
    expect(stdlibCall.percent).toBe(75)
  })

  it('progress percent values are non-decreasing across calls', async () => {
    const mockPy = makeMockPyodide()
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide } = await freshModule()
    const onProgress = vi.fn()
    await loadPyodide(onProgress)

    const percents = onProgress.mock.calls.map(c => c[0].percent)
    for (let i = 1; i < percents.length; i++) {
      expect(percents[i]).toBeGreaterThanOrEqual(percents[i - 1])
    }
  })
})

// ---------------------------------------------------------------------------
// runCode — frame structure validation
// ---------------------------------------------------------------------------

describe('runCode — frame structure', () => {
  it('returns frames with all required keys', async () => {
    const mockFrames = [{
      event: 'call',
      lineNo: 1,
      callStack: [{ funcName: '<module>', lineNo: 1, locals: {} }],
      stdout: '',
      callTree: [],
      activeCallId: null,
    }]
    const globals = {
      _store: {},
      set: vi.fn(function(k, v) { this._store[k] = v }),
      get: vi.fn(function(k) { return this._store[k] }),
    }
    const runPythonAsync = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(JSON.stringify(mockFrames))
    const mockPy = { globals, runPythonAsync }
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide, runCode } = await freshModule()
    await loadPyodide(vi.fn())
    const result = await runCode('x = 1')

    const frame = result[0]
    expect(frame).toHaveProperty('event')
    expect(frame).toHaveProperty('lineNo')
    expect(frame).toHaveProperty('callStack')
    expect(frame).toHaveProperty('stdout')
    expect(frame).toHaveProperty('callTree')
    expect(frame).toHaveProperty('activeCallId')
  })

  it('returns an empty array for code with no traceable events', async () => {
    const globals = {
      _store: {},
      set: vi.fn(function(k, v) { this._store[k] = v }),
      get: vi.fn(function(k) { return this._store[k] }),
    }
    const runPythonAsync = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(JSON.stringify([]))
    const mockPy = { globals, runPythonAsync }
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide, runCode } = await freshModule()
    await loadPyodide(vi.fn())
    const result = await runCode('')

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
  })

  it('passes multiline code through globals.set intact', async () => {
    const multiline = 'def f():\n    return 1\nf()'
    const globals = {
      _store: {},
      set: vi.fn(function(k, v) { this._store[k] = v }),
      get: vi.fn(function(k) { return this._store[k] }),
    }
    const runPythonAsync = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(JSON.stringify([]))
    const mockPy = { globals, runPythonAsync }
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide, runCode } = await freshModule()
    await loadPyodide(vi.fn())
    await runCode(multiline)

    expect(globals.set).toHaveBeenCalledWith('_user_code', multiline)
  })
})

// ---------------------------------------------------------------------------
// loadPyodide — window.loadPyodide called with correct indexURL
// ---------------------------------------------------------------------------

describe('loadPyodide — window.loadPyodide options', () => {
  it('passes the correct Pyodide CDN indexURL to window.loadPyodide', async () => {
    const mockPy = makeMockPyodide()
    window.loadPyodide = vi.fn().mockResolvedValue(mockPy)

    const { loadPyodide } = await freshModule()
    await loadPyodide(vi.fn())

    expect(window.loadPyodide).toHaveBeenCalledWith(
      expect.objectContaining({
        indexURL: expect.stringContaining('cdn.jsdelivr.net/pyodide'),
      })
    )
  })
})
