type BracketRound = {
  name: string
  matches: Array<{
    id: string
    homeLabel: string
    awayLabel: string
  }>
}

export default function KnockoutBracket({ rounds }: { rounds: BracketRound[] }) {
  if (rounds.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <div className="grid min-w-[900px] grid-flow-col gap-6">
        {rounds.map((round) => (
          <div key={round.name} className="space-y-3">
            <p className="text-center text-xs font-semibold tracking-wide text-cyan-200">{round.name}</p>
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
        ))}
      </div>
    </div>
  )
}
