"use client";

import { useActionState, useMemo, useState } from "react";
import { type MatchFormState, createMatchAction } from "@/app/matchs/actions";

const initialState: MatchFormState = {};

export default function CreateMatchForm() {
  const [state, formAction, pending] = useActionState(
    createMatchAction,
    initialState,
  );
  const [format, setFormat] = useState<"group_only" | "group_then_knockout">(
    "group_only",
  );

  const formatTips = useMemo(() => {
    if (format === "group_then_knockout") {
      return "先按积分均衡分组，再进入淘汰赛。报名截止后由发起人/管理员手动配置组数与晋级人数并确认发布。";
    }
    return "仅进行分组赛。报名截止后由发起人/管理员手动配置组数并确认发布。";
  }, [format]);

  return (
    <form action={formAction} className="space-y-8">
      <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-cyan-200">
          基础信息
        </h2>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="mb-1 block text-sm text-slate-300"
            >
              比赛名称 *
            </label>
            <input
              id="title"
              name="title"
              required
              placeholder="例如：校内春季积分赛"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-sm text-slate-300"
            >
              比赛描述
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              placeholder="简要说明比赛规则、奖项和注意事项"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <div>
            <label
              htmlFor="location"
              className="mb-1 block text-sm text-slate-300"
            >
              地点 *
            </label>
            <input
              id="location"
              name="location"
              required
              placeholder="例如：西区体育馆二楼"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-cyan-200">
          时间设置
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="date" className="mb-1 block text-sm text-slate-300">
              比赛日期 *
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="time" className="mb-1 block text-sm text-slate-300">
              比赛时间 *
            </label>
            <input
              id="time"
              name="time"
              type="time"
              required
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-slate-100"
            />
          </div>
        </div>
        <div className="mt-4">
          <label
            htmlFor="registrationDeadline"
            className="mb-1 block text-sm text-slate-300"
          >
            报名截止时间 *
          </label>
          <input
            id="registrationDeadline"
            name="registrationDeadline"
            type="datetime-local"
            required
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-slate-100"
          />
          <p className="mt-1 text-xs text-slate-400">
            截止后将无法继续报名，并由管理员手动生成分组。
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-cyan-200">
          赛制
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="type" className="mb-1 block text-sm text-slate-300">
              比赛类型
            </label>
            <select
              id="type"
              name="type"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-slate-100"
            >
              <option value="single">单打</option>
              <option value="double">双打</option>
              <option value="team">团体</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="format"
              className="mb-1 block text-sm text-slate-300"
            >
              赛制 *
            </label>
            <select
              id="format"
              name="format"
              value={format}
              onChange={(event) =>
                setFormat(
                  event.target.value as "group_only" | "group_then_knockout",
                )
              }
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-slate-100"
            >
              <option value="group_only">分组比赛</option>
              <option value="group_then_knockout">前期分组后期淘汰</option>
            </select>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          {formatTips}
        </div>
      </section>

      {state.error && <p className="text-sm text-rose-300">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-emerald-300">{state.success}</p>
      )}

      <button
        disabled={pending}
        className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "发布中..." : "发布比赛"}
      </button>
    </form>
  );
}
