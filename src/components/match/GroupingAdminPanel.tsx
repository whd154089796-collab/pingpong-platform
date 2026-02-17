'use client'

import { useActionState } from 'react'
import { confirmGroupingAction, previewGroupingAction, type GroupingAdminState } from '@/app/matchs/actions'
import KnockoutBracket from '@/components/match/KnockoutBracket'

type Props = {
  matchId: string
  format: 'group_only' | 'group_then_knockout'
  defaultGroupCount: number
}

const initialState: GroupingAdminState = {}

export default function GroupingAdminPanel({ matchId, format, defaultGroupCount }: Props) {
  const previewAction = previewGroupingAction.bind(null, matchId)
  const confirmAction = confirmGroupingAction.bind(null, matchId)

  const [previewState, previewFormAction, previewPending] = useActionState(previewAction, initialState)
  const [confirmState, confirmFormAction, confirmPending] = useActionState(confirmAction, initialState)

  const payload = previewState.previewJson ? (JSON.parse(previewState.previewJson) as {
    groups: Array<{ name: string; averagePoints: number; players: Array<{ id: string; nickname: string; points: number; eloRating: number }> }>
    knockout?: { stage: string; bracketSize: number; rounds: Array<{ name: string; matches: Array<{ id: string; homeLabel: string; awayLabel: string }> }> }
  }) : null

  return (
    <div className="space-y-5 rounded-2xl border border-amber-400/30 bg-amber-500/5 p-6">
      <h3 className="text-lg font-semibold text-amber-100">手动生成分组（发起人/管理员）</h3>

      <form action={previewFormAction} className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-slate-300">组数</label>
          <input name="groupCount" type="number" min={1} defaultValue={defaultGroupCount} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100" />
        </div>

        {format === 'group_then_knockout' && (
          <div>
            <label className="mb-1 block text-sm text-slate-300">每组晋级人数</label>
            <input name="qualifiersPerGroup" type="number" min={1} defaultValue={2} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100" />
          </div>
        )}

        <div className="flex items-end">
          <button disabled={previewPending} className="w-full rounded-lg border border-amber-300/50 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/10 disabled:opacity-60">
            {previewPending ? '生成中...' : '生成分组预览'}
          </button>
        </div>
      </form>

      {previewState.error && <p className="text-sm text-rose-300">{previewState.error}</p>}
      {previewState.success && <p className="text-sm text-emerald-300">{previewState.success}</p>}

      {payload && (
        <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-sm text-slate-300">预览结果（确认后才会发布给所有用户）</p>
          <div className="grid gap-4 md:grid-cols-2">
            {payload.groups.map((group) => (
              <div key={group.name} className="rounded-lg border border-slate-700 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium text-cyan-100">{group.name}</span>
                  <span className="text-xs text-slate-400">组均积分 {group.averagePoints}</span>
                </div>
                <ul className="space-y-1 text-sm text-slate-200">
                  {group.players.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span>{p.nickname}</span>
                      <span className="text-slate-400">{p.points} / ELO {p.eloRating}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {payload.knockout && (
            <div className="space-y-2">
              <h4 className="font-medium text-cyan-100">{payload.knockout.stage}（晋级后按签位填充）</h4>
              <KnockoutBracket rounds={payload.knockout.rounds} />
            </div>
          )}

          <form action={confirmFormAction}>
            <input type="hidden" name="previewJson" value={previewState.previewJson} />
            <button disabled={confirmPending} className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {confirmPending ? '发布中...' : '确认并发布分组结果'}
            </button>
          </form>
          {confirmState.error && <p className="text-sm text-rose-300">{confirmState.error}</p>}
          {confirmState.success && <p className="text-sm text-emerald-300">{confirmState.success}</p>}
        </div>
      )}
    </div>
  )
}
