# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Unravel Recursion

A Python execution visualizer for students hosted on GitHub Pages. The core goal is making recursion click — specifically visualizing the call stack growing/shrinking, the call tree, and return values flowing back up. Zero hosting cost, runs entirely in the browser.

## Commands

```bash
npm run dev      # start dev server at localhost:5173/projects/unravel-recursion/ (port may vary)
npm run build    # build to /dist, deployed to blog repo by CI
```

## Tech Stack

- **React + Vite** — UI framework and build tooling
- **CodeMirror 6** (`codemirror`, `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-python`) — in-browser code editor
- **D3.js** — animated call tree visualization
- **Pyodide** — CPython compiled to WebAssembly, runs Python entirely in the browser via `sys.settrace()`
- **Zustand** — app state management
- **GitHub Actions** — auto-deploys `/dist` to GitHub Pages on every push to main

## Architecture

### Execution Flow
1. Pyodide loads on app mount (loaded from CDN, progress shown on loading screen)
2. `src/engine/tracer.py` is embedded as a raw string via Vite's `?raw` import and executed in Pyodide to define `collect_frames()`
3. When student hits Run, `src/engine/pyodide.js:runCode()` passes user code to `collect_frames()` via `pyodide.globals.set('_user_code', code)`
4. The tracer uses `sys.settrace()` to collect one frame per line/call/return event, building the call tree incrementally
5. All frames returned as JSON upfront (eager collection) — the frontend scrubs through them like a timeline

### Data Model
Each frame contains: `{ event, lineNo, callStack: [{funcName, lineNo, locals}], stdout, callTree: [...nodes], activeCallId }`

Each call tree node: `{ id, funcName, args, returnValue, status: 'active'|'completed'|'overflow', children, depth }`

### State (Zustand store at `src/store/index.js`)
Key state: `pyodideStatus`, `code`, `frames[]`, `currentFrameIndex`, `isPlaying`, `playbackSpeed`, `viewMode` ('simple'|'technical'), `theme` ('light'|'dark'), `selectedCallNodeId`

## File Structure

```
unravel-recursion/
├── src/
│   ├── engine/
│   │   ├── tracer.py        # Python tracer — defines collect_frames(), imported as ?raw
│   │   └── pyodide.js       # Pyodide CDN loader + runCode() executor
│   ├── store/index.js       # Zustand store with all app state + actions
│   ├── examples/index.js    # 12 pre-built programs (see Examples section below)
│   ├── components/
│   │   ├── LoadingScreen/   # Pyodide download progress bar
│   │   ├── Editor/          # CodeMirror 6 with line highlight, inline values, dimming via StateField
│   │   ├── CallStack/       # Stack frames panel with simple/technical mode + click-to-inspect
│   │   ├── CallTree/        # D3.js animated top-down call tree, click nodes to inspect
│   │   ├── Controls/        # Playback bar: play/pause/rewind, speed, scrubber, keyboard shortcuts
│   │   └── ExamplesPanel/   # Example selector + simple/technical toggle + light/dark theme toggle
│   ├── App.jsx              # Root layout: header / left editor / right panels / bottom controls
│   └── App.css              # Full-viewport layout with CSS custom properties for theming
├── .github/workflows/deploy.yml  # GitHub Actions: push to main → build → gh-pages
└── vite.config.js           # base: '/projects/unravel-recursion/', pyodide excluded from optimizeDeps
```

## Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ 🧶 Unravel Recursion  [Example dropdown]  [Simple/Technical] [☀/🌙] │
├─────────────────────┬──╂──┬──────────────╂──┬─────────────────────┤
│                     │  ┃  │  CALL STACK  ┃  │  CALL TREE          │
│   CODE EDITOR       │  ┃  │  (frames,    ┃  │  (D3.js animated)   │
│   (CodeMirror 6)    │  ┃  │   locals)    ┃  │                     │
│   line highlight    │drag│              │drag│                     │
│   inline values     │    │              │    │                     │
│   dimming           │    │              │    │                     │
├─────────────────────┴────┴──────────────┴────┴─────────────────────┤
│  ⏮ ⏪ ▶ ⏩   ───scrubber───   Speed: 0.5x 1x 2x 4x                │
└────────────────────────────────────────────────────────────────────┘
```

3 resizable panes side by side, separated by drag handles. Default widths: Editor 380px, Call Stack 280px, Call Tree fills remaining space. Min widths: 180px (editor), 160px (call stack).

## Key Features

- **Call tree**: Top-down D3 tree, edges light up on call/dim on return, completed nodes stay visible but grayed out (shows fibonacci redundancy), stack overflow nodes marked with ∞
- **Click-to-inspect**: Clicking any call tree node switches the Call Stack panel to inspect mode showing that node's function name, args, return value, status, and depth. Back button returns to live stack view.
- **Light/dark theme**: Toggle button (☀/🌙) in the header. Defaults to light. CSS custom properties drive all component colors; D3 SVG colors use a `THEME_COLORS` JS object keyed by theme since SVG attrs can't use CSS variables.
- **Editor decorations**: Active line highlighted with left border, inactive lines dimmed, local variables shown as ghost text inline
- **Playback**: Eager frame collection → scrub like a timeline; Space = play/pause, ← → = step
- **Stack overflow teaching moment**: Execution stops, last frame marked 'overflow', red badge shown, explanation in controls bar
- **Simple vs Technical mode**: Toggles label language across all panels ("current calls" vs "call stack", "stored values" vs "local variables")

## Examples (12 total)

| ID | Label | What it teaches |
|----|-------|-----------------|
| `factorial` | Factorial | Basic linear recursion |
| `fibonacci` | Fibonacci | Exponential branching, redundant calls |
| `binary_search` | Binary Search | Recursive divide-and-conquer |
| `hanoi` | Tower of Hanoi | Multi-branch recursion with side effects |
| `merge_sort` | Merge Sort | Divide, recurse, merge pattern |
| `gcd` | GCD (Euclid) | Why swapping args + remainder converges |
| `fib_memo` | Fibonacci + Memo | Memoization collapsing exponential tree to a chain |
| `permutations` | Permutations | Fan-out branching (n! leaves) |
| `mutual_recursion` | Mutual Recursion | Two functions calling each other alternately |
| `fast_power` | Fast Power | O(log n) via halving — only ~5 calls for 2^10 |
| `tree_traversal` | Tree Traversal | Recursion on a data tree — call tree mirrors the data structure |
| `backtracking` | Backtracking | Grid path finding — branches explored, dead ends unwound via pop |

## Theming Implementation

- All colors defined as CSS custom properties in `App.css` under `:root` (light, default) and `[data-theme="dark"]` (dark override)
- `App.jsx` syncs `document.documentElement.setAttribute('data-theme', theme)` via `useEffect`
- CodeMirror theme uses `var(--*)` strings — browser resolves them at paint time, no re-init needed
- D3 SVG attributes (set via `.attr()`) cannot use CSS variables — `CallTree.jsx` maintains a `THEME_COLORS` object with explicit hex values for both themes; `theme` is in the useEffect dependency array so D3 re-renders on toggle
- `--dim-opacity` is `0.35` (light) and `0.22` (dark) to keep dimmed lines readable on both backgrounds

## Deployment

GitHub Actions workflow (`.github/workflows/deploy.yml`) triggers on push to `main`:
1. Builds the Vite app (`npm ci && npm run build`)
2. Checks out `thisisbalu/thisisbalu.github.io` using `BLOG_DEPLOY_TOKEN` secret
3. Copies `/dist` into `projects/unravel-recursion/` in the blog repo
4. Commits and pushes — triggers the blog's own Jekyll deploy workflow

Live URL: `www.balasubramanyamlanka.com/projects/unravel-recursion/`

**Pyodide note:** Pyodide is loaded from CDN (`cdn.jsdelivr.net/pyodide/v0.25.1/full/`) — not bundled. The `optimizeDeps.exclude: ['pyodide']` in vite.config.js prevents Vite from trying to pre-bundle it.

## Future Language Support

The tracer is isolated in `src/engine/`. Adding JavaScript would require AST instrumentation (transform code before running to inject state snapshots) rather than `sys.settrace()`.
