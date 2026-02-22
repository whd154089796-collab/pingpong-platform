"use client";

import { useActionState } from "react";
import { type MatchFormState, updateMatchAction } from "@/app/matchs/actions";

type Props = {
  matchId: string;
  initial: {
    title: string;
    description: string;
    location: string;
    date: string;
    time: string;
    type: "single" | "double" | "team";
    format: "group_only" | "group_then_knockout";
    registrationDeadline: string;
  };
};

const initialState: MatchFormState = {};

export default function EditMatchForm({ matchId, initial }: Props) {
  const action = updateMatchAction.bind(null, matchId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="csrfToken" value="" />
      <div>
        <label
          htmlFor="edit-title"
          className="mb-1 block text-sm text-slate-300"
        >
          比赛名称 *
        </label>
        <input
          id="edit-title"
          name="title"
          defaultValue={initial.title}
          required
          title="比赛名称"
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100"
        />
      </div>
      <div>
        <label
          htmlFor="edit-description"
          className="mb-1 block text-sm text-slate-300"
        >
          比赛描述
        </label>
        <textarea
          id="edit-description"
          name="description"
          rows={4}
          defaultValue={initial.description}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="edit-date"
            className="mb-1 block text-sm text-slate-300"
          >
            日期 *
          </label>
          <input
            id="edit-date"
            name="date"
            type="date"
            defaultValue={initial.date}
            required
            title="比赛日期"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="edit-time"
            className="mb-1 block text-sm text-slate-300"
          >
            时间 *
          </label>
          <input
            id="edit-time"
            name="time"
            type="time"
            defaultValue={initial.time}
            required
            title="比赛时间"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100"
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="edit-location"
          className="mb-1 block text-sm text-slate-300"
        >
          地点 *
        </label>
        <input
          id="edit-location"
          name="location"
          defaultValue={initial.location}
          required
          title="比赛地点"
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="edit-type"
            className="mb-1 block text-sm text-slate-300"
          >
            比赛类型
          </label>
          <select
            id="edit-type"
            name="type"
            defaultValue={initial.type}
            title="比赛类型"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100"
          >
            <option value="single">单打</option>
            <option value="double">双打</option>
            <option value="team">团体</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="edit-format"
            className="mb-1 block text-sm text-slate-300"
          >
            赛制
          </label>
          <select
            id="edit-format"
            name="format"
            defaultValue={initial.format}
            title="比赛赛制"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100"
          >
            <option value="group_only">分组比赛</option>
            <option value="group_then_knockout">前期分组后期淘汰</option>
          </select>
        </div>
      </div>
      <div>
        <label
          htmlFor="edit-registration-deadline"
          className="mb-1 block text-sm text-slate-300"
        >
          报名截止时间
        </label>
        <input
          id="edit-registration-deadline"
          name="registrationDeadline"
          type="datetime-local"
          defaultValue={initial.registrationDeadline}
          title="报名截止时间"
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100"
        />
      </div>

      {state.error && <p className="text-sm text-rose-300">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-emerald-300">{state.success}</p>
      )}

      <button
        disabled={pending}
        className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "保存中..." : "保存比赛修改"}
      </button>
    </form>
  );
}
