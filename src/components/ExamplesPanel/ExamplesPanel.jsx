import { useStore } from '../../store'
import { EXAMPLES } from '../../examples'
import './ExamplesPanel.css'

export default function ExamplesPanel() {
  const { selectedExample, selectExample, viewMode, toggleViewMode, theme, toggleTheme } = useStore()

  return (
    <div className="examples-panel">
      <div className="examples-left">
        <span className="examples-label">Example:</span>
        <select
          className="examples-select"
          value={selectedExample || ''}
          onChange={(e) => selectExample(e.target.value)}
        >
          {EXAMPLES.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.label}
            </option>
          ))}
        </select>
      </div>

      <div className="examples-right">
        <button
          className={`view-toggle ${viewMode === 'technical' ? 'active' : ''}`}
          onClick={toggleViewMode}
          title="Toggle between simple and technical labels"
        >
          {viewMode === 'simple' ? 'Technical view ›' : 'Simple view ‹'}
        </button>

        <button
          className="theme-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
      </div>
    </div>
  )
}
