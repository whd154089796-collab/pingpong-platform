'use client'

import { useMemo, useRef, useState } from 'react'

type BracketRound = {
  name: string
  matches: Array<{
    id: string
    homeLabel: string
    awayLabel: string
  }>
}

type MatchNode = {
  id: string
  roundIndex: number
  matchIndex: number
  x: number
  y: number
  data: {
    id: string
    homeLabel: string
    awayLabel: string
  }
}

const CARD_W = 220
const CARD_H = 84
const COL_GAP = 56
const ROW_GAP = 28
const PAD = 36
const CENTER_GAP = 70

function splitSideRounds(rounds: BracketRound[]) {
  const preFinalRounds = rounds.slice(0, -1)

  const leftRounds = preFinalRounds.map((round) => ({
    name: round.name,
    matches: round.matches.slice(0, Math.floor(round.matches.length / 2)),
  }))

  const rightRounds = preFinalRounds.map((round) => ({
    name: round.name,
    matches: round.matches.slice(Math.floor(round.matches.length / 2)),
  }))

  return { leftRounds, rightRounds }
}

function buildYByRounds(matchCounts: number[]) {
  if (matchCounts.length === 0) return [] as number[][]

  const yRounds: number[][] = []
  yRounds[0] = Array.from({ length: matchCounts[0] }, (_, i) => PAD + i * (CARD_H + ROW_GAP))

  for (let r = 1; r < matchCounts.length; r += 1) {
    const prev = yRounds[r - 1]
    const current = Array.from({ length: matchCounts[r] }, (_, i) => {
      const top = prev[i * 2]
      const bottom = prev[i * 2 + 1]
      return (top + bottom) / 2
    })
    yRounds[r] = current
  }

  return yRounds
}

export default function KnockoutBracket({ rounds }: { rounds: BracketRound[] }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragOriginRef = useRef({ x: 0, y: 0 })
  const offsetOriginRef = useRef({ x: 0, y: 0 })

  const scene = useMemo(() => {
    if (rounds.length === 0) return null

    if (rounds.length === 1) {
      const only = rounds[0]
      const x = PAD
      const y = PAD
      const width = CARD_W + PAD * 2
      const height = CARD_H + PAD * 2
      return {
        width,
        height,
        leftRounds: [] as BracketRound[],
        rightRounds: [] as BracketRound[],
        leftNodes: [] as MatchNode[],
        rightNodes: [] as MatchNode[],
        finalNode: { id: only.matches[0].id, roundIndex: 0, matchIndex: 0, x, y, data: only.matches[0] } as MatchNode,
      }
    }

    const finalRound = rounds[rounds.length - 1]
    const { leftRounds, rightRounds } = splitSideRounds(rounds)

    const leftCounts = leftRounds.map((r) => r.matches.length)
    const rightCounts = rightRounds.map((r) => r.matches.length)

    const leftY = buildYByRounds(leftCounts)
    const rightY = buildYByRounds(rightCounts)

    const preFinalCols = leftRounds.length
    const colStep = CARD_W + COL_GAP
    const finalX = PAD + preFinalCols * colStep + CENTER_GAP

    const leftNodes: MatchNode[] = []
    leftRounds.forEach((round, rIdx) => {
      round.matches.forEach((match, mIdx) => {
        leftNodes.push({
          id: match.id,
          roundIndex: rIdx,
          matchIndex: mIdx,
          x: PAD + rIdx * colStep,
          y: leftY[rIdx][mIdx],
          data: match,
        })
      })
    })

    const rightNodes: MatchNode[] = []
    rightRounds.forEach((round, rIdx) => {
      round.matches.forEach((match, mIdx) => {
        rightNodes.push({
          id: match.id,
          roundIndex: rIdx,
          matchIndex: mIdx,
          x: finalX + CARD_W + CENTER_GAP + (preFinalCols - 1 - rIdx) * colStep,
          y: rightY[rIdx][mIdx],
          data: match,
        })
      })
    })

    const maxY = Math.max(
      ...leftNodes.map((n) => n.y + CARD_H),
      ...rightNodes.map((n) => n.y + CARD_H),
      PAD + CARD_H,
    )

    const finalNode: MatchNode = {
      id: finalRound.matches[0].id,
      roundIndex: rounds.length - 1,
      matchIndex: 0,
      x: finalX,
      y: maxY / 2 - CARD_H / 2,
      data: finalRound.matches[0],
    }

    const width = finalX + CARD_W + CENTER_GAP + preFinalCols * colStep + PAD
    const height = Math.max(maxY + PAD, finalNode.y + CARD_H + PAD)

    return { width, height, leftRounds, rightRounds, leftNodes, rightNodes, finalNode }
  }, [rounds])

  if (!scene) return null

  const zoomTo = (next: number) => {
    setScale(Math.max(0.55, Math.min(1.8, next)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">支持拖拽平移与缩放（滚轮缩放 / 触控板滚动平移）</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => zoomTo(scale - 0.1)} className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200">-</button>
          <span className="text-xs text-slate-300">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => zoomTo(scale + 0.1)} className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200">+</button>
          <button
            type="button"
            onClick={() => {
              setScale(1)
              setOffset({ x: 0, y: 0 })
            }}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200"
          >
            重置
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative h-[70vh] overflow-hidden rounded-xl border border-slate-700 bg-slate-950/70"
        onWheel={(event) => {
          event.preventDefault()
          if (event.ctrlKey || event.metaKey) {
            const delta = event.deltaY > 0 ? -0.08 : 0.08
            zoomTo(scale + delta)
            return
          }
          setOffset((prev) => ({ x: prev.x - event.deltaX * 0.9, y: prev.y - event.deltaY * 0.9 }))
        }}
        onPointerDown={(event) => {
          setDragging(true)
          dragOriginRef.current = { x: event.clientX, y: event.clientY }
          offsetOriginRef.current = offset
        }}
        onPointerMove={(event) => {
          if (!dragging) return
          const dx = event.clientX - dragOriginRef.current.x
          const dy = event.clientY - dragOriginRef.current.y
          setOffset({ x: offsetOriginRef.current.x + dx, y: offsetOriginRef.current.y + dy })
        }}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: scene.width,
            height: scene.height,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: dragging ? 'none' : 'transform 140ms ease-out',
          }}
        >
          <svg width={scene.width} height={scene.height} className="absolute left-0 top-0 pointer-events-none">
            {scene.leftNodes.map((node) => {
              const next = scene.leftNodes.find((n) => n.roundIndex === node.roundIndex + 1 && n.matchIndex === Math.floor(node.matchIndex / 2))
              if (!next) return null
              const x1 = node.x + CARD_W
              const y1 = node.y + CARD_H / 2
              const x2 = next.x
              const y2 = next.y + CARD_H / 2
              const xm = (x1 + x2) / 2
              return <path key={`${node.id}->${next.id}`} d={`M ${x1} ${y1} H ${xm} V ${y2} H ${x2}`} stroke="rgba(148,163,184,0.65)" fill="none" strokeWidth="1.5" />
            })}

            {scene.rightNodes.map((node) => {
              const next = scene.rightNodes.find((n) => n.roundIndex === node.roundIndex + 1 && n.matchIndex === Math.floor(node.matchIndex / 2))
              if (!next) return null
              const x1 = node.x
              const y1 = node.y + CARD_H / 2
              const x2 = next.x + CARD_W
              const y2 = next.y + CARD_H / 2
              const xm = (x1 + x2) / 2
              return <path key={`${node.id}->${next.id}`} d={`M ${x1} ${y1} H ${xm} V ${y2} H ${x2}`} stroke="rgba(148,163,184,0.65)" fill="none" strokeWidth="1.5" />
            })}

            {scene.leftRounds.length > 0 && (() => {
              const leftFinal = scene.leftNodes.find((n) => n.roundIndex === scene.leftRounds.length - 1 && n.matchIndex === 0)
              if (!leftFinal) return null
              const x1 = leftFinal.x + CARD_W
              const y1 = leftFinal.y + CARD_H / 2
              const x2 = scene.finalNode.x
              const y2 = scene.finalNode.y + CARD_H / 2
              const xm = (x1 + x2) / 2
              return <path d={`M ${x1} ${y1} H ${xm} V ${y2} H ${x2}`} stroke="rgba(34,211,238,0.75)" fill="none" strokeWidth="2" />
            })()}

            {scene.rightRounds.length > 0 && (() => {
              const rightFinal = scene.rightNodes.find((n) => n.roundIndex === scene.rightRounds.length - 1 && n.matchIndex === 0)
              if (!rightFinal) return null
              const x1 = rightFinal.x
              const y1 = rightFinal.y + CARD_H / 2
              const x2 = scene.finalNode.x + CARD_W
              const y2 = scene.finalNode.y + CARD_H / 2
              const xm = (x1 + x2) / 2
              return <path d={`M ${x1} ${y1} H ${xm} V ${y2} H ${x2}`} stroke="rgba(34,211,238,0.75)" fill="none" strokeWidth="2" />
            })()}
          </svg>

          {scene.leftNodes.map((node) => (
            <div key={node.id} className="absolute rounded-lg border border-slate-700 bg-slate-800/85 p-2.5 shadow" style={{ left: node.x, top: node.y, width: CARD_W, height: CARD_H }}>
              <p className="mb-1 text-[11px] text-slate-400">{node.data.id}</p>
              <div className="space-y-1 text-xs text-slate-100">
                <div className="rounded bg-slate-700/70 px-2 py-1">{node.data.homeLabel}</div>
                <div className="rounded bg-slate-700/70 px-2 py-1">{node.data.awayLabel}</div>
              </div>
            </div>
          ))}

          {scene.rightNodes.map((node) => (
            <div key={node.id} className="absolute rounded-lg border border-slate-700 bg-slate-800/85 p-2.5 shadow" style={{ left: node.x, top: node.y, width: CARD_W, height: CARD_H }}>
              <p className="mb-1 text-[11px] text-slate-400">{node.data.id}</p>
              <div className="space-y-1 text-xs text-slate-100">
                <div className="rounded bg-slate-700/70 px-2 py-1">{node.data.homeLabel}</div>
                <div className="rounded bg-slate-700/70 px-2 py-1">{node.data.awayLabel}</div>
              </div>
            </div>
          ))}

          <div
            className="absolute rounded-lg border border-cyan-400/45 bg-cyan-500/10 p-2.5 shadow-lg shadow-cyan-900/20"
            style={{ left: scene.finalNode.x, top: scene.finalNode.y, width: CARD_W, height: CARD_H }}
          >
            <p className="mb-1 text-center text-[11px] text-cyan-200">{scene.finalNode.data.id}</p>
            <div className="space-y-1 text-xs text-slate-100">
              <div className="rounded bg-slate-700/70 px-2 py-1">{scene.finalNode.data.homeLabel}</div>
              <div className="rounded bg-slate-700/70 px-2 py-1">{scene.finalNode.data.awayLabel}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
