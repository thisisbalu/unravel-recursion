import { useStore } from '../../store'
import './LoadingScreen.css'

export default function LoadingScreen() {
  const { pyodideProgress, pyodideStage } = useStore()

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <span className="logo-icon">🧶</span>
          <h1>Unravel Recursion</h1>
          <p className="tagline">see inside your code</p>
        </div>

        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${pyodideProgress}%` }}
            />
          </div>
          <div className="progress-info">
            <span className="stage-label">{pyodideStage}</span>
            <span className="percent-label">{pyodideProgress}%</span>
          </div>
        </div>

        {pyodideProgress < 100 && (
          <p className="once-notice">This only happens once — we're loading Python into your browser.</p>
        )}
      </div>
    </div>
  )
}
