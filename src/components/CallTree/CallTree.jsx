import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useStore } from '../../store'
import './CallTree.css'

const NODE_W = 140
const NODE_H = 56
const V_GAP  = 56
const H_GAP  = 16
const MIN_SCALE = 0.45

function flattenTree(nodes, result = []) {
  if (!nodes) return result
  for (const n of nodes) {
    result.push(n)
    flattenTree(n.children, result)
  }
  return result
}

function isPhantomNode(d) {
  return d.data.funcName === 'program' || d.data.funcName === '<module>'
}

const THEME_COLORS = {
  dark: {
    nodePendingBg:   '#141926',
    nodeActiveBg:    '#1e1b4b',
    nodeCompletedBg: '#0d1520',
    nodeOverflowBg:  '#1a0a0a',
    borderDefault:   '#1e2d45',
    borderActive:    '#6366f1',
    borderCompleted: '#1e3d6f',
    borderOverflow:  '#7f1d1d',
    nameActive:      '#a5b4fc',
    nameOverflow:    '#fca5a5',
    nameCompleted:   '#64748b',
    namePending:     '#cbd5e1',
    subReturn:       '#4ade80',
    subActive:       '#818cf8',
    subDefault:      '#475569',
    linkDefault:     '#1e2d45',
    linkActive:      '#6366f1',
    linkCompleted:   '#1e3d6f',
    linkOverflow:    '#7f1d1d',
    selectionRing:   '#e2e8f0',
  },
  light: {
    nodePendingBg:   '#f1f5f9',
    nodeActiveBg:    '#eef2ff',
    nodeCompletedBg: '#f8fafc',
    nodeOverflowBg:  '#fff1f2',
    borderDefault:   '#e2e8f0',
    borderActive:    '#6366f1',
    borderCompleted: '#bfdbfe',
    borderOverflow:  '#fca5a5',
    nameActive:      '#4338ca',
    nameOverflow:    '#dc2626',
    nameCompleted:   '#94a3b8',
    namePending:     '#1e293b',
    subReturn:       '#16a34a',
    subActive:       '#6366f1',
    subDefault:      '#64748b',
    linkDefault:     '#e2e8f0',
    linkActive:      '#6366f1',
    linkCompleted:   '#bfdbfe',
    linkOverflow:    '#fca5a5',
    selectionRing:   '#0f172a',
  },
}

export default function CallTree() {
  const svgRef  = useRef(null)
  const zoomRef = useRef(null)
  const prevNodeCountRef = useRef(0)

  const { frames, currentFrameIndex, viewMode, selectedCallNodeId, setSelectedCallNodeId, theme } = useStore()
  const frame = frames[currentFrameIndex]
  const isSimple = viewMode === 'simple'

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)

    // Initialise zoom once
    if (!zoomRef.current) {
      zoomRef.current = d3.zoom()
        .scaleExtent([0.1, 5])
        .on('zoom', (event) => {
          svg.select('g.tree-group').attr('transform', event.transform)
        })
      svg.call(zoomRef.current)
      svg.on('dblclick.zoom', null)
    }

    const tree = frame?.callTree ?? []
    if (tree.length === 0) {
      svg.select('g.tree-group').selectAll('*').remove()
      prevNodeCountRef.current = 0
      return
    }

    const rootData = tree.length === 1
      ? tree[0]
      : { id: 0, funcName: 'program', args: {}, status: 'active', returnValue: null, children: tree, depth: -1 }

    function toHierarchy(node) {
      return {
        ...node,
        children: node.children?.length > 0 ? node.children.map(toHierarchy) : null,
      }
    }

    const root = d3.hierarchy(toHierarchy(rootData))
    const treeLayout = d3.tree()
      .nodeSize([NODE_W + H_GAP, NODE_H + V_GAP])
      .separation((a, b) => a.parent === b.parent ? 1 : 1.2)

    treeLayout(root)

    const allD3Nodes = root.descendants()
    const links = root.links()

    const xMin = d3.min(allD3Nodes, d => d.x) ?? 0
    const xMax = d3.max(allD3Nodes, d => d.x) ?? 0
    const yMax = d3.max(allD3Nodes, d => d.y) ?? 0

    const treeLeft   = xMin - NODE_W / 2
    const treeRight  = xMax + NODE_W / 2
    const treeTop    = 0
    const treeBottom = yMax + NODE_H
    const treeW = treeRight - treeLeft
    const treeH = treeBottom - treeTop

    const g = svg.select('g.tree-group').empty()
      ? svg.append('g').attr('class', 'tree-group')
      : svg.select('g.tree-group')

    const col = THEME_COLORS[theme] ?? THEME_COLORS.dark

    // ── Links ────────────────────────────────────────────────────────────────
    const linkSel = g.selectAll('.tree-link').data(links, d => d.target.data.id)
    const activeId = frame?.activeCallId

    const linkEnter = linkSel.enter()
      .append('path')
      .attr('class', 'tree-link')
      .attr('fill', 'none')
      .attr('d', d => linkPath(d))
      .attr('stroke-width', 1.5)
      .style('opacity', 0)

    linkEnter.transition().duration(220).style('opacity', 1)

    linkEnter.merge(linkSel)
      .attr('d', d => linkPath(d))
      .attr('stroke', d => {
        if (isPhantomNode(d.source)) return 'transparent'
        const tid = d.target.data.id
        if (tid === activeId)                     return col.linkActive
        if (d.target.data.status === 'completed') return col.linkCompleted
        if (d.target.data.status === 'overflow')  return col.linkOverflow
        return col.linkDefault
      })
      .attr('stroke-width', d => d.target.data.id === activeId ? 2.5 : 1.5)

    linkSel.exit().remove()

    // ── Nodes ────────────────────────────────────────────────────────────────
    const nodeSel = g.selectAll('.tree-node-g').data(allD3Nodes, d => d.data.id)

    const nodeEnter = nodeSel.enter()
      .append('g')
      .attr('class', 'tree-node-g')
      .attr('transform', d => `translate(${d.x - NODE_W / 2}, ${d.y})`)
      .style('opacity', 0)
      .style('cursor', d => isPhantomNode(d) ? 'default' : 'pointer')
      .on('click', (event, d) => {
        if (isPhantomNode(d)) return
        event.stopPropagation()
        setSelectedCallNodeId(selectedCallNodeId === d.data.id ? null : d.data.id)
      })

    nodeEnter.append('rect')
      .attr('class', 'node-bg')
      .attr('width', NODE_W)
      .attr('height', NODE_H)
      .attr('rx', 8)

    // Selection ring — sits behind text, toggled via opacity
    nodeEnter.append('rect')
      .attr('class', 'node-ring')
      .attr('x', -3).attr('y', -3)
      .attr('width', NODE_W + 6).attr('height', NODE_H + 6)
      .attr('rx', 10)
      .attr('fill', 'none')
      .attr('stroke-width', 2)
      .attr('opacity', 0)

    nodeEnter.append('text')
      .attr('class', 'node-name')
      .attr('x', NODE_W / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')

    nodeEnter.append('text')
      .attr('class', 'node-sub')
      .attr('x', NODE_W / 2)
      .attr('y', 38)
      .attr('text-anchor', 'middle')

    // Staggered fade-in for new nodes
    nodeEnter.transition()
      .duration(220)
      .delay((_, i) => i * 25)
      .style('opacity', 1)

    const nodeMerge = nodeEnter.merge(nodeSel)
    nodeMerge.attr('transform', d => `translate(${d.x - NODE_W / 2}, ${d.y})`)

    nodeMerge.select('rect.node-bg')
      .attr('fill', d => {
        if (isPhantomNode(d)) return 'transparent'
        if (d.data.id === activeId)          return col.nodeActiveBg
        if (d.data.status === 'overflow')    return col.nodeOverflowBg
        if (d.data.status === 'completed')   return col.nodeCompletedBg
        return col.nodePendingBg
      })
      .attr('stroke', d => {
        if (isPhantomNode(d)) return 'transparent'
        if (d.data.id === activeId)          return col.borderActive
        if (d.data.status === 'overflow')    return col.borderOverflow
        if (d.data.status === 'completed')   return col.borderCompleted
        return col.borderDefault
      })
      .attr('stroke-width', d => d.data.id === activeId ? 2 : 1)
      .attr('opacity', d => {
        if (isPhantomNode(d)) return 0
        return d.data.status === 'completed' ? 0.7 : 1
      })

    nodeMerge.select('rect.node-ring')
      .attr('stroke', col.selectionRing)
      .attr('opacity', d => (!isPhantomNode(d) && d.data.id === selectedCallNodeId) ? 0.55 : 0)

    nodeMerge.select('.node-name')
      .text(d => {
        if (isPhantomNode(d)) return ''
        if (d.data.status === 'overflow') return '∞ ' + d.data.funcName
        return d.data.funcName
      })
      .attr('fill', d => {
        if (d.data.id === activeId)          return col.nameActive
        if (d.data.status === 'overflow')    return col.nameOverflow
        if (d.data.status === 'completed')   return col.nameCompleted
        return col.namePending
      })

    nodeMerge.select('.node-sub')
      .text(d => {
        if (isPhantomNode(d)) return ''
        if (d.data.status === 'completed' && d.data.returnValue != null) {
          const rv = String(d.data.returnValue)
          return '→ ' + (rv.length > 15 ? rv.slice(0, 14) + '…' : rv)
        }
        const entries = Object.entries(d.data.args ?? {})
        if (entries.length === 0) return ''
        const argStr = entries.map(([k, v]) => isSimple ? v : `${k}=${v}`).join(', ')
        return argStr.length > 16 ? argStr.slice(0, 15) + '…' : argStr
      })
      .attr('fill', d => {
        if (d.data.status === 'completed' && d.data.returnValue != null) return col.subReturn
        if (d.data.id === activeId) return col.subActive
        return col.subDefault
      })

    nodeSel.exit().remove()

    // ── Auto-fit when tree grows ──────────────────────────────────────────────
    const nodeCount = flattenTree(tree).length
    if (nodeCount !== prevNodeCountRef.current && treeW > 0 && treeH > 0) {
      prevNodeCountRef.current = nodeCount
      const container = svgRef.current.parentElement
      const cW = container.clientWidth  || 400
      const cH = container.clientHeight || 300
      const margin = 20
      const rawScale = Math.min((cW - margin * 2) / treeW, (cH - margin * 2) / treeH, 1.4)
      const scale = Math.max(rawScale, MIN_SCALE)
      const tx = cW / 2 - ((treeLeft + treeRight) / 2) * scale
      const ty = margin - treeTop * scale
      svg.transition().duration(350).call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
      )
    }
  }, [frame, viewMode, selectedCallNodeId, setSelectedCallNodeId, theme])

  const hasTree = (frame?.callTree?.length ?? 0) > 0

  return (
    <div className="calltree-panel">
      <div className="panel-header">
        <span className="panel-title">
          {isSimple ? 'Recursion map' : 'Call tree'}
        </span>
        {hasTree && (
          <button
            className="fit-btn"
            title="Fit tree to view"
            onClick={() => {
              if (!svgRef.current || !zoomRef.current) return
              prevNodeCountRef.current = 0
              d3.select(svgRef.current)
                .transition().duration(300)
                .call(zoomRef.current.transform, d3.zoomIdentity)
            }}
          >
            ⊡ fit
          </button>
        )}
      </div>
      <div className="calltree-container">
        {!hasTree && (
          <div className="empty-state">
            {frames.length === 0 ? 'Hit Run to see the call tree build' : 'No calls yet'}
          </div>
        )}
        <svg ref={svgRef} className="calltree-svg" />
      </div>
    </div>
  )
}

function linkPath(d) {
  const sx = d.source.x
  const sy = d.source.y + NODE_H
  const tx = d.target.x
  const ty = d.target.y
  const my = (sy + ty) / 2
  return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`
}
