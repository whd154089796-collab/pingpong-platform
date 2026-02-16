'use client'

import { useActionState } from 'react'
import { type MatchFormState, createMatchAction } from '@/app/matchs/actions'

const initialState: MatchFormState = {}

export default function CreateMatchForm() {
  const [state, formAction, pending] = useActionState(createMatchAction, initialState)

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label htmlFor="title" className="mb-1 block text-sm text-slate-300">比赛名称 *</label>
        <input id="title" name="title" required className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100" />
      </div>
      <div>
        <label htmlFor="description" className="mb-1 block text-sm text-slate-300">比赛描述</label>
        <textarea id="description" name="description" rows={4} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="date" className="mb-1 block text-sm text-slate-300">日期 *</label>
          <input id="date" name="date" type="date" required className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100" />
        </div>
        <div>
          <label htmlFor="time" className="mb-1 block text-sm text-slate-300">时间 *</label>
          <input id="time" name="time" type="time" required className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100" />
        </div>
      </div>

      <div>
        <label htmlFor="registrationDeadline" className="mb-1 block text-sm text-slate-300">报名截止时间 *</label>
        <input id="registrationDeadline" name="registrationDeadline" type="datetime-local" required className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100" />
      </div>

      <div>
        <label htmlFor="location" className="mb-1 block text-sm text-slate-300">地点 *</label>
        <input id="location" name="location" required className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="type" className="mb-1 block text-sm text-slate-300">比赛类型</label>
          <select id="type" name="type" className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100">
            <option value="single">单打</option>
            <option value="double">双打</option>
            <option value="team">团体</option>
          </select>
        </div>
        <div>
          <label htmlFor="format" className="mb-1 block text-sm text-slate-300">赛制 *</label>
          <select id="format" name="format" className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100">
            <option value="group_only">分组比赛</option>
            <option value="group_then_knockout">前期分组后期淘汰</option>
          </select>
        </div>
        <div>
          <label htmlFor="maxParticipants" className="mb-1 block text-sm text-slate-300">最大人数 *</label>
          <input id="maxParticipants" name="maxParticipants" type="number" min={2} defaultValue={16} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100" />
        </div>
      </div>

      {state.error && <p className="text-sm text-rose-300">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-300">{state.success}</p>}

      <button disabled={pending} className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 py-3 font-semibold text-white disabled:opacity-60">
        {pending ? '发布中...' : '发布比赛'}
      </button>
    </form>
  )
}
