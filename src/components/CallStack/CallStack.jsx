import { useStore } from '../../store'
import './CallStack.css'

function findNode(nodes, id) {
  if (!nodes) return null
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

function formatArgs(args, isSimple) {
  const entries = Object.entries(args ?? {})
  if (entries.length === 0) return 'none'
  return isSimple
    ? entries.map(([, v]) => v).join(', ')
    : entries.map(([k, v]) => `${k} = ${v}`).join(', ')
}

function formatChildren(children, isSimple) {
  if (!children?.length) return '—'
  return children.map(c => {
    const argStr = formatArgs(c.args, isSimple)
    return `${c.funcName}(${argStr === 'none' ? '' : argStr})`
  }).join(',  ')
}

export default function CallStack() {
  const {
    frames, currentFrameIndex, viewMode, executionStatus,
    selectedCallNodeId, setSelectedCallNodeId,
  } = useStore()

  const frame = frames[currentFrameIndex]
  const stack = frame?.callStack ?? []
  const isSimple = viewMode === 'simple'
  const stackLabel   = isSimple ? 'Current calls' : 'Call stack'
  const localsLabel  = isSimple ? 'Stored values' : 'Local variables'

  // Inspect mode: find the selected node in the current frame's call tree
  const inspectedNode = selectedCallNodeId != null
    ? findNode(frame?.callTree ?? [], selectedCallNodeId)
    : null

  if (inspectedNode) {
    return (
      <div className="callstack-panel">
        <div className="panel-header inspect-header">
          <span className="panel-title">
            Inspecting: {inspectedNode.funcName}
          </span>
          <button
            className="back-btn"
            onClick={() => setSelectedCallNodeId(null)}
          >
            ✕ back
          </button>
        </div>

        <div className="inspect-body">
          <div className="inspect-row">
            <span className="inspect-label">Function</span>
            <span className="inspect-value mono">{inspectedNode.funcName}()</span>
          </div>

          <div className="inspect-row">
            <span className="inspect-label">{isSimple ? 'Called with' : 'Arguments'}</span>
            <span className="inspect-value mono">{formatArgs(inspectedNode.args, isSimple)}</span>
          </div>

          {inspectedNode.returnValue != null && (
            <div className="inspect-row">
              <span className="inspect-label">{isSimple ? 'Gave back' : 'Returned'}</span>
              <span className="inspect-value return-val">→ {inspectedNode.returnValue}</span>
            </div>
          )}

          <div className="inspect-row">
            <span className="inspect-label">{isSimple ? 'Level' : 'Call depth'}</span>
            <span className="inspect-value">
              {isSimple ? `level ${inspectedNode.depth + 1}` : `depth ${inspectedNode.depth}`}
            </span>
          </div>

          {inspectedNode.children?.length > 0 && (
            <div className="inspect-row inspect-row-col">
              <span className="inspect-label">{isSimple ? 'Then called' : 'Spawned'}</span>
              <span className="inspect-value mono">{formatChildren(inspectedNode.children, isSimple)}</span>
            </div>
          )}

          <div className="inspect-row">
            <span className="inspect-label">Status</span>
            <span className={`inspect-value status-${inspectedNode.status}`}>
              {inspectedNode.status}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="callstack-panel">
      <div className="panel-header">
        <span className="panel-title">{stackLabel}</span>
        {executionStatus === 'overflow' && (
          <span className="overflow-badge">Stack overflow</span>
        )}
        {frame && (
          <span className="frame-counter">
            step {currentFrameIndex + 1} / {frames.length}
          </span>
        )}
      </div>

      <div className="callstack-list">
        {stack.length === 0 && (
          <div className="empty-state">
            {frames.length === 0
              ? 'Hit Run to watch the call stack grow'
              : 'No active calls'}
          </div>
        )}

        {[...stack].reverse().map((f, i) => {
          const isTop = i === 0
          const visibleLocals = Object.entries(f.locals ?? {}).filter(
            ([k, v]) => !k.startsWith('_') && k !== '__builtins__' &&
              !String(v).startsWith('<function') && !String(v).startsWith('<built')
          )
          return (
            <div key={i} className={`stack-frame ${isTop ? 'frame-active' : ''}`}>
              <div className="frame-header">
                <span className="frame-name">
                  {f.funcName === '<module>'
                    ? (isSimple ? 'main code' : '<module>')
                    : f.funcName + '()'}
                </span>
                <span className="frame-line">line {f.lineNo}</span>
              </div>

              {visibleLocals.length > 0 && (
                <div className="frame-locals">
                  <div className="locals-label">{localsLabel}</div>
                  {visibleLocals.map(([k, v]) => (
                    <div key={k} className="local-row">
                      <span className="local-key">{k}</span>
                      <span className="local-eq">=</span>
                      <span className="local-val">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {frame?.stdout && (
        <div className="stdout-section">
          <div className="stdout-label">Output</div>
          <pre className="stdout-content">{frame.stdout}</pre>
        </div>
      )}
    </div>
  )
}
