import '@testing-library/jest-dom'

// Stub CSS imports — jsdom doesn't process stylesheets but Vite transforms
// them to empty modules in the test environment. Nothing to do here, but
// keeping this comment documents why we don't crash on `.css` imports.

// Stub ResizeObserver — not available in jsdom but used by some components
// indirectly (CodeMirror uses it internally).
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Stub requestAnimationFrame — used by D3 and CodeMirror animations.
// jsdom provides a basic one but it never fires; this synchronous version
// keeps D3 effects from hanging in tests.
global.requestAnimationFrame = (cb) => setTimeout(cb, 0)
global.cancelAnimationFrame = (id) => clearTimeout(id)
