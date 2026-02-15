'use client'

import { useActionState } from 'react'
import { type MatchFormState, updateMatchAction } from '@/app/matchs/actions'

type Props = {
  matchId: string
  initial: {
    title: string
    description: string
    location: string
    date: string
    time: string
    type: 'single' | 'double' | 'team'
    format: 'group_only' | 'group_then_knockout'
    maxParticipants: number
    registrationDeadline: string
  }
}

const initialState: MatchFormState = {}

export default function EditMatchForm({ matchId, initial }: Props) {
  const action = updateMatchAction.bind(null, matchId)
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label className="mb-1 block text-sm text-slate-300">比赛名称 *</label>
        <input name="title" defaultValue={initial.title} required className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100" />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-300">比赛描述</label>
        <textarea name="description" rows={4} defaultValue={initial.description} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-slate-300">日期 *</label>
          <input name="date" type="date" defaultValue={initial.date} required className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">时间 *</label>
          <input name="time" type="time" defaultValue={initial.time} required className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-300">地点 *</label>
        <input name="location" defaultValue={initial.location} required className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-slate-300">比赛类型</label>
          <select name="type" defaultValue={initial.type} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100">
            <option value="single">单打</option>
            <option value="double">双打</option>
            <option value="team">团体</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">赛制</label>
          <select name="format" defaultValue={initial.format} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100">
            <option value="group_only">分组比赛（≤256）</option>
            <option value="group_then_knockout">前期分组后期淘汰（≤64）</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">最大人数</label>
          <input name="maxParticipants" type="number" defaultValue={initial.maxParticipants} min={2} max={256} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-300">报名截止时间</label>
        <input name="registrationDeadline" type="datetime-local" defaultValue={initial.registrationDeadline} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100" />
      </div>

      {state.error && <p className="text-sm text-rose-300">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-300">{state.success}</p>}

      <button disabled={pending} className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 py-3 font-semibold text-white disabled:opacity-60">
        {pending ? '保存中...' : '保存比赛修改'}
      </button>
    </form>
  )
}
