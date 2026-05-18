import tracerSource from './tracer.py?raw'

let pyodideInstance = null
let tracerReady = false

export async function loadPyodide(onProgress) {
  if (pyodideInstance) return pyodideInstance

  onProgress({ stage: 'Downloading Python...', percent: 5 })

  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js'
    script.crossOrigin = 'anonymous'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })

  onProgress({ stage: 'Initializing Python runtime...', percent: 30 })

  pyodideInstance = await window.loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/',
  })

  onProgress({ stage: 'Loading standard library...', percent: 75 })

  await pyodideInstance.runPythonAsync(tracerSource)
  tracerReady = true

  onProgress({ stage: 'Ready!', percent: 100 })

  return pyodideInstance
}

export async function runCode(code) {
  if (!pyodideInstance || !tracerReady) throw new Error('Pyodide not loaded')

  // Store code in Python namespace to avoid any escaping issues
  pyodideInstance.globals.set('_user_code', code)
  const result = await pyodideInstance.runPythonAsync('collect_frames(_user_code)')
  return JSON.parse(result)
}
