# 🧶 Unravel Recursion

> *Watch recursion unravel, one call at a time.*

---

## The Story

Recursion broke my brain the first time I encountered it.

Not because it was hard to read — the code was always short, almost elegant. But every time I tried to follow it, I'd lose the thread. Where are we in the call stack right now? What value is coming back from where? How does the tree actually grow?

I'd draw it on paper. I'd trace through it line by line. I'd search for visualizers online, find something half-built or outdated, and give up. The mental model just wouldn't click.

For a long time I told myself I'd build something better. A tool that would let you *watch* recursion happen — not just read about it, not just step through a debugger, but actually see the call tree grow node by node and the return values flow back up like water finding its way home.

I finally built it.

---

## What It Does

**Unravel Recursion** runs Python code entirely in your browser and visualizes every step of execution in real time. No server. No setup. No install.

You pick an example (or write your own), hit Run, and watch:

- The **call stack** grow and shrink as functions call each other
- The **call tree** expand node by node, edges lighting up on each call
- **Return values** appear on nodes as they resolve — flowing back up the tree
- **Local variables** update inline next to the code as each line executes

Scrub forward and backward through execution like a timeline. Pause on any frame. Click any node in the call tree to inspect that function call in detail.

---

## Features

- **Step-by-step playback** — scrub through execution one line at a time or let it play at 0.5×, 1×, 2×, 4× speed
- **Live call tree** — D3-animated top-down tree; completed nodes stay visible so you can see redundancy (Fibonacci is a great example)
- **Click-to-inspect** — click any call tree node to see its arguments, return value, status, and depth
- **Inline variable values** — ghost text next to each line shows what's in scope right now
- **Stack overflow detection** — execution stops gracefully, the overflowing node is marked ∞, and an explanation is shown
- **Simple / Technical mode** — friendlier language for beginners, precise terminology for those who want it
- **Light / Dark theme** — your eyes, your choice
- **Runs entirely in the browser** — Python via WebAssembly (Pyodide), no backend needed

---

## Examples Included

| Example | What it reveals |
|---------|----------------|
| Factorial | The simplest linear recursion — one call leads to one call leads to one call |
| Fibonacci | Exponential branching — the same subproblems computed over and over |
| Binary Search | Divide and conquer — the search space halves with every step |
| Tower of Hanoi | Multi-branch recursion with side effects — harder than it looks |
| Merge Sort | Split down, merge up — two recursive halves rejoining |
| GCD (Euclid) | Why swapping args and taking remainders converges to the answer |
| Fibonacci + Memo | Same tree as Fibonacci, but memoization collapses it into a chain |
| Permutations | Branching factor shrinks each level — 3 characters, 6 leaves, 16 calls |
| Mutual Recursion | Two functions calling each other — the stack alternates between them |
| Fast Power | O(log n) via halving — 2^10 in ~5 calls instead of 10 |
| Tree Traversal | Recursion on a data tree — the call tree mirrors the data structure exactly |
| Backtracking | Paths explored then abandoned — the call tree grows deep, hits dead ends, unwinds |

---

## Running Locally

```bash
git clone https://github.com/thisisbalu/unravel-recursion.git
cd unravel-recursion
npm install
npm run dev
```

Open `http://localhost:5173/projects/unravel-recursion/` in your browser (Vite picks the next available port if 5173 is in use).

> The first load fetches Pyodide (Python runtime) from CDN — about 10MB. After that it's cached and instant.

---

## Tech Stack

- **React + Vite** — UI and build tooling
- **Pyodide** — CPython compiled to WebAssembly; runs Python in the browser via `sys.settrace()`
- **D3.js** — animated call tree
- **CodeMirror 6** — in-browser code editor with syntax highlighting
- **Zustand** — state management

---

*Built because recursion deserved a better explanation.*
