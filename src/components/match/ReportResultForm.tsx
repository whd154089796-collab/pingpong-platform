'use client'

import { useActionState } from 'react'
import { reportMatchResultAction, type MatchFormState } from '@/app/matchs/actions'

const initialState: MatchFormState = {}

export default function ReportResultForm({ matchId, matchType }: { matchId: string; matchType: 'single' | 'double' | 'team' }) {
  const action = reportMatchResultAction.bind(null, matchId)
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
      <p className="text-sm text-slate-300">
        录入赛果后将立即按弹性 K 值更新 ELO。
        {matchType === 'double' ? '双打请按个人 ID 填写双方 2 人，采用个人积分结算。' : null}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-300">
          <span>胜方成员 ID（逗号分隔）</span>
          <input
            name="winnerTeamIds"
            required
            placeholder={matchType === 'single' ? 'user_id_1' : 'user_id_1,user_id_2'}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-300">
          <span>负方成员 ID（逗号分隔）</span>
          <input
            name="loserTeamIds"
            required
            placeholder={matchType === 'single' ? 'user_id_2' : 'user_id_3,user_id_4'}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
          />
        </label>
      </div>

      <label className="block space-y-1 text-sm text-slate-300">
        <span>比分（可选）</span>
        <input name="score" placeholder="例如：3:1" className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100" />
      </label>

      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? '提交中...' : '录入赛果并结算 ELO'}
      </button>
    </form>
  )
}
