type BracketRound = {
  name: string
  matches: Array<{
    id: string
    homeLabel: string
    awayLabel: string
  }>
}

type SideRound = {
  name: string
  matches: Array<{
    id: string
    homeLabel: string
    awayLabel: string
  }>
}

function splitSideRounds(rounds: BracketRound[]) {
  const preFinalRounds = rounds.slice(0, -1)

  const leftRounds: SideRound[] = preFinalRounds.map((round) => ({
    name: round.name,
    matches: round.matches.slice(0, Math.floor(round.matches.length / 2)),
  }))

  const rightRounds: SideRound[] = preFinalRounds.map((round) => ({
    name: round.name,
    matches: round.matches.slice(Math.floor(round.matches.length / 2)),
  }))

  return { leftRounds, rightRounds }
}

function SideColumn({ round, alignRight }: { round: SideRound; alignRight?: boolean }) {
  return (
    <div className="space-y-3">
      <p className={`text-xs font-semibold tracking-wide text-cyan-200 ${alignRight ? 'text-right' : 'text-left'}`}>
        {round.name}
      </p>
      <div className="space-y-3">
        {round.matches.map((match) => (
          <div key={match.id} className="rounded-lg border border-slate-700 bg-slate-800/80 p-3">
            <p className="mb-2 text-xs text-slate-400">{match.id}</p>
            <div className="space-y-1 text-sm text-slate-100">
              <div className="rounded bg-slate-700/70 px-2 py-1">{match.homeLabel}</div>
              <div className="rounded bg-slate-700/70 px-2 py-1">{match.awayLabel}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function KnockoutBracket({ rounds }: { rounds: BracketRound[] }) {
  if (rounds.length === 0) return null

  if (rounds.length === 1) {
    const finalRound = rounds[0]
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
        <p className="mb-3 text-center text-xs font-semibold tracking-wide text-cyan-200">{finalRound.name}</p>
        <div className="mx-auto max-w-sm space-y-3">
          {finalRound.matches.map((match) => (
            <div key={match.id} className="rounded-lg border border-slate-700 bg-slate-800/80 p-3">
              <p className="mb-2 text-xs text-slate-400">{match.id}</p>
              <div className="space-y-1 text-sm text-slate-100">
                <div className="rounded bg-slate-700/70 px-2 py-1">{match.homeLabel}</div>
                <div className="rounded bg-slate-700/70 px-2 py-1">{match.awayLabel}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const finalRound = rounds[rounds.length - 1]
  const { leftRounds, rightRounds } = splitSideRounds(rounds)

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <div
        className="grid min-w-[1200px] items-start gap-6"
        style={{ gridTemplateColumns: `repeat(${leftRounds.length}, minmax(180px, 1fr)) 220px repeat(${rightRounds.length}, minmax(180px, 1fr))` }}
      >
        {leftRounds.map((round) => (
          <SideColumn key={`left-${round.name}`} round={round} />
        ))}

        <div className="space-y-3">
          <p className="text-center text-xs font-semibold tracking-wide text-cyan-200">{finalRound.name}</p>
          {finalRound.matches.map((match) => (
            <div key={match.id} className="rounded-lg border border-cyan-400/35 bg-cyan-500/10 p-3 shadow-lg shadow-cyan-900/20">
              <p className="mb-2 text-center text-xs text-cyan-200">{match.id}</p>
              <div className="space-y-1 text-sm text-slate-100">
                <div className="rounded bg-slate-700/70 px-2 py-1">{match.homeLabel}</div>
                <div className="rounded bg-slate-700/70 px-2 py-1">{match.awayLabel}</div>
              </div>
            </div>
          ))}
        </div>

        {[...rightRounds].reverse().map((round) => (
          <SideColumn key={`right-${round.name}`} round={round} alignRight />
        ))}
      </div>
    </div>
  )
}
