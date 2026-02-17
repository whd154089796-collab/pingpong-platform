'use client'

import { useActionState } from 'react'
import { type MatchFormState, updateMatchFormatAction } from '@/app/matchs/actions'

type Props = {
  matchId: string
  format: 'group_only' | 'group_then_knockout'
  maxParticipants: number
  registrationDeadline: string
}

const initialState: MatchFormState = {}

export default function MatchSettingsForm({ matchId, format, maxParticipants, registrationDeadline }: Props) {
  const action = updateMatchFormatAction.bind(null, matchId)
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-slate-300">赛制</label>
          <select name="format" defaultValue={format} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100">
            <option value="group_only">分组比赛</option>
            <option value="group_then_knockout">前期分组后期淘汰</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">最大人数</label>
          <input name="maxParticipants" type="number" min={2} defaultValue={maxParticipants} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">报名截止时间</label>
          <input name="registrationDeadline" type="datetime-local" defaultValue={registrationDeadline} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100" />
        </div>
      </div>
      {state.error && <p className="text-sm text-rose-300">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-300">{state.success}</p>}
      <button disabled={pending} className="rounded-lg border border-cyan-400/50 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-500/10 disabled:opacity-60">
        {pending ? '保存中...' : '保存赛制设置'}
      </button>
    </form>
  )
}
