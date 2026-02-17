'use client'

import { useActionState, useMemo } from 'react'
import { confirmMatchResultAction, submitGroupMatchResultAction, type MatchFormState } from '@/app/matchs/actions'

const initialState: MatchFormState = {}

type PendingResult = {
  id: string
  reporterId: string
  reporterName: string
  winnerLabel: string
  loserLabel: string
  scoreText: string
}

export default function ReportResultForm({
  matchId,
  opponents,
  pendingResults,
}: {
  matchId: string
  opponents: Array<{ id: string; nickname: string; played: boolean }>
  pendingResults: PendingResult[]
}) {
  const [submitState, submitAction, submitPending] = useActionState(submitGroupMatchResultAction.bind(null, matchId), initialState)

  const unplayedOpponents = useMemo(() => opponents.filter((o) => !o.played), [opponents])

  return (
    <div className="space-y-6">
      <form action={submitAction} className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <p className="text-sm text-slate-300">系统会根据你当前小组中尚未对战的对手自动筛选可登记对象。提交后需由对手或管理员确认。</p>

        <label className="block space-y-1 text-sm text-slate-300">
          <span>选择对手</span>
          <select name="opponentId" required className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100">
            <option value="">请选择</option>
            {unplayedOpponents.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nickname}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-sm text-slate-300">
          <span>本场结果</span>
          <select name="didWin" className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100">
            <option value="true">我获胜</option>
            <option value="false">我失利</option>
          </select>
        </label>

        <label className="block space-y-1 text-sm text-slate-300">
          <span>比分（可选）</span>
          <input name="score" placeholder="例如：3:1" className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100" />
        </label>

        {submitState.error ? <p className="text-sm text-rose-300">{submitState.error}</p> : null}
        {submitState.success ? <p className="text-sm text-emerald-300">{submitState.success}</p> : null}

        <button
          type="submit"
          disabled={submitPending || unplayedOpponents.length === 0}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitPending ? '提交中...' : unplayedOpponents.length === 0 ? '当前无可登记对手' : '提交登记，等待确认'}
        </button>
      </form>

      <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <h3 className="text-sm font-semibold text-slate-100">待确认赛果</h3>
        {pendingResults.length === 0 ? (
          <p className="text-sm text-slate-400">当前没有待确认赛果。</p>
        ) : (
          pendingResults.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <p className="text-sm text-slate-200">{item.winnerLabel} 胜 {item.loserLabel}</p>
              <p className="mt-1 text-xs text-slate-400">登记人：{item.reporterName} {item.scoreText ? `· 比分 ${item.scoreText}` : ''}</p>
              <form action={confirmMatchResultAction.bind(null, matchId, item.id)} className="mt-2">
                <button type="submit" className="rounded-md border border-emerald-500/40 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10">
                  我确认该结果
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
