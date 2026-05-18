import { create } from 'zustand'
import { EXAMPLES } from '../examples'

const DEFAULT_CODE = EXAMPLES[0].code

export const useStore = create((set, get) => ({
  // Pyodide
  pyodideStatus: 'loading', // 'loading' | 'ready' | 'error'
  pyodideProgress: 0,
  pyodideStage: 'Initializing...',

  // Code
  code: DEFAULT_CODE,
  selectedExample: EXAMPLES[0].id,

  // Execution
  frames: [],
  executionStatus: 'idle', // 'idle' | 'running' | 'complete' | 'error' | 'overflow'
  executionError: null,

  // Playback
  currentFrameIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,

  // UI
  viewMode: 'simple', // 'simple' | 'technical'
  selectedCallNodeId: null,
  theme: 'light', // 'dark' | 'light'

  // Actions
  setPyodideStatus: (status) => set({ pyodideStatus: status }),
  setPyodideProgress: (percent, stage) =>
    set({ pyodideProgress: percent, pyodideStage: stage }),

  setCode: (code) => set({ code, frames: [], executionStatus: 'idle', currentFrameIndex: 0 }),
  selectExample: (id) => {
    const ex = EXAMPLES.find((e) => e.id === id)
    if (ex) set({ code: ex.code, selectedExample: id, frames: [], executionStatus: 'idle', currentFrameIndex: 0 })
  },

  setFrames: (frames, status) =>
    set({ frames, executionStatus: status, currentFrameIndex: 0, isPlaying: false, selectedCallNodeId: null }),

  setExecutionStatus: (status, error = null) =>
    set({ executionStatus: status, executionError: error }),

  setCurrentFrameIndex: (idx) => {
    const { frames } = get()
    const clamped = Math.max(0, Math.min(idx, frames.length - 1))
    set({ currentFrameIndex: clamped, selectedCallNodeId: null })
  },

  setSelectedCallNodeId: (id) => set({ selectedCallNodeId: id }),

  stepForward: () => {
    const { currentFrameIndex, frames } = get()
    if (currentFrameIndex < frames.length - 1)
      set({ currentFrameIndex: currentFrameIndex + 1, selectedCallNodeId: null })
    else
      set({ isPlaying: false })
  },

  stepBackward: () => {
    const { currentFrameIndex } = get()
    if (currentFrameIndex > 0)
      set({ currentFrameIndex: currentFrameIndex - 1, selectedCallNodeId: null })
  },

  rewind: () => set({ currentFrameIndex: 0, isPlaying: false, selectedCallNodeId: null }),

  setIsPlaying: (val) => set({ isPlaying: val }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  toggleViewMode: () =>
    set((s) => ({ viewMode: s.viewMode === 'simple' ? 'technical' : 'simple' })),
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
}))
