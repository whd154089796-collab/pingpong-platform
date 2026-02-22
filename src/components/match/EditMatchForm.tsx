"use client";

import { useActionState, useState } from "react";
import { type MatchFormState, updateMatchAction } from "@/app/matchs/actions";

type Props = {
  matchId: string;
  initial: {
    title: string;
    description: string;
    location: string;
    date: string; // yyyy-MM-dd
    time: string; // HH:mm
    type: "single" | "double" | "team";
    format: "group_only" | "group_then_knockout";
    registrationDeadline: string; // yyyy-MM-ddTHH:mm or ISO
  };
};

const initialState: MatchFormState = {};

function parseInitialDeadline(value: string) {
  if (!value) return { date: "", time: "" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

export default function EditMatchForm({ matchId, initial }: Props) {
  const action = updateMatchAction.bind(null, matchId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const timezoneOffset = String(new Date().getTimezoneOffset());

  const [matchDate, setMatchDate] = useState(initial.date);
  const [matchTime, setMatchTime] = useState(initial.time);

  const dl = parseInitialDeadline(initial.registrationDeadline);
  const [deadlineDate, setDeadlineDate] = useState(dl.date);
  const [deadlineTime, setDeadlineTime] = useState(dl.time || initial.time);

  function toDateTime(date: string, time: string) {
    if (!date || !time) return null;
    return new Date(`${date}T${time}`);
  }

  const matchDateTime = toDateTime(matchDate, matchTime);
  const deadlineDateTime = toDateTime(deadlineDate, deadlineTime);

  const isTimeValid =
    matchDate !== "" &&
    deadlineDate !== "" &&
    matchDateTime !== null &&
    deadlineDateTime !== null &&
    deadlineDateTime < matchDateTime;

  const timeError =
    matchDate &&
    deadlineDate &&
    matchDateTime &&
    deadlineDateTime &&
    !isTimeValid
      ? "报名截止时间必须早于比赛开始时间。"
      : null;

  const registrationDeadlineValue = deadlineDateTime
    ? `${deadlineDate}T${deadlineTime}`
    : "";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="csrfToken" defaultValue="" />
      <input type="hidden" name="date" value={matchDate} />
      <input type="hidden" name="time" value={matchTime} />
      <input type="hidden" name="timezoneOffset" value={timezoneOffset} />
      <input
        type="hidden"
        name="registrationDeadline"
        value={registrationDeadlineValue}
      />

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

      {/* ===== 时间设置 ===== */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-cyan-200">
          时间设置
        </h2>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <p className="mb-3 text-sm font-medium text-slate-200">
              比赛开始时间 *
            </p>
            <div className="space-y-3">
              <input
                type="date"
                aria-label="比赛日期"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="native-picker h-10 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100 accent-cyan-500"
              />
              <input
                type="time"
                aria-label="比赛时间"
                value={matchTime}
                step={1800}
                onChange={(e) => setMatchTime(e.target.value)}
                className="native-picker h-10 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100 accent-cyan-500"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <p className="mb-3 text-sm font-medium text-slate-200">
              报名截止时间 *
            </p>
            <div className="space-y-3">
              <input
                type="date"
                aria-label="截止日期"
                value={deadlineDate}
                max={matchDate || undefined}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="native-picker h-10 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100 accent-cyan-500"
              />
              <input
                type="time"
                aria-label="截止时间"
                value={deadlineTime}
                step={1800}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="native-picker h-10 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100 accent-cyan-500"
              />
            </div>
          </div>
        </div>

        {timeError ? (
          <p className="mt-2 text-sm text-rose-300">{timeError}</p>
        ) : null}
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
      {state.error && <p className="text-sm text-rose-300">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-emerald-300">{state.success}</p>
      )}

      <button
        disabled={pending || !isTimeValid}
        className="w-full rounded-lg bg-linear-to-r from-cyan-500 to-blue-500 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "保存中..." : "保存比赛修改"}
      </button>
    </form>
  );
}
