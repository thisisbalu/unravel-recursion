import { useEffect, useRef } from 'react'
import { useStore } from '../../store'
import './Controls.css'

const SPEEDS = [0.5, 1, 2, 4]

export default function Controls() {
  const {
    frames, currentFrameIndex, isPlaying, playbackSpeed,
    setCurrentFrameIndex, stepForward, stepBackward, rewind,
    setIsPlaying, setPlaybackSpeed, executionStatus,
  } = useStore()

  const intervalRef = useRef(null)

  // Auto-play ticker
  useEffect(() => {
    if (!isPlaying) {
      clearInterval(intervalRef.current)
      return
    }
    const ms = 1000 / playbackSpeed
    intervalRef.current = setInterval(() => {
      const { currentFrameIndex: idx, frames: fs, setIsPlaying: stop } = useStore.getState()
      if (idx >= fs.length - 1) {
        stop(false)
      } else {
        useStore.getState().stepForward()
      }
    }, ms)
    return () => clearInterval(intervalRef.current)
  }, [isPlaying, playbackSpeed])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.closest?.('.cm-editor')) return
      if (e.key === ' ') {
        e.preventDefault()
        setIsPlaying(!isPlaying)
      }
      if (e.key === 'ArrowRight') { e.preventDefault(); stepForward() }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); stepBackward() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isPlaying, setIsPlaying, stepForward, stepBackward])

  const hasFrames = frames.length > 0
  const atEnd = currentFrameIndex >= frames.length - 1

  return (
    <div className="controls-bar">
      <div className="playback-buttons">
        <button
          className="ctrl-btn"
          onClick={rewind}
          disabled={!hasFrames || currentFrameIndex === 0}
          title="Rewind (go to start)"
        >⏮</button>

        <button
          className="ctrl-btn"
          onClick={stepBackward}
          disabled={!hasFrames || currentFrameIndex === 0}
          title="Step back (←)"
        >⏪</button>

        <button
          className="ctrl-btn play-btn"
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={!hasFrames || (atEnd && !isPlaying)}
          title="Play / Pause (Space)"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          className="ctrl-btn"
          onClick={stepForward}
          disabled={!hasFrames || atEnd}
          title="Step forward (→)"
        >⏩</button>
      </div>

      {hasFrames && (
        <div className="scrubber-container">
          <input
            type="range"
            className="scrubber"
            min={0}
            max={frames.length - 1}
            value={currentFrameIndex}
            onChange={(e) => setCurrentFrameIndex(Number(e.target.value))}
          />
          <span className="scrubber-label">
            {currentFrameIndex + 1} / {frames.length}
          </span>
        </div>
      )}

      <div className="speed-buttons">
        <span className="speed-label">Speed:</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`speed-btn ${playbackSpeed === s ? 'active' : ''}`}
            onClick={() => setPlaybackSpeed(s)}
          >
            {s}x
          </button>
        ))}
      </div>

      {executionStatus === 'overflow' && (
        <div className="overflow-notice">
          Stack overflow — the call stack grew until Python stopped it. This is what infinite recursion looks like.
        </div>
      )}

      <div className="keyboard-hints">
        <span><kbd className="key-hint">Space</kbd> play/pause</span>
        <span><kbd className="key-hint">← →</kbd> step</span>
      </div>
    </div>
  )
}
