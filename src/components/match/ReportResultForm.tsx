"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  confirmMatchResultVoidAction,
  submitKnockoutMatchResultAction,
  submitGroupMatchResultAction,
  type MatchFormState,
} from "@/app/matchs/actions";

const initialState: MatchFormState = {};

type PendingResult = {
  id: string;
  reporterId: string;
  reporterName: string;
  winnerLabel: string;
  loserLabel: string;
  scoreText: string;
};

export default function ReportResultForm({
  matchId,
  currentUserId,
  mode = "group",
  opponents = [],
  knockoutOpponent,
  pendingResults,
}: {
  matchId: string;
  currentUserId: string;
  mode?: "group" | "knockout";
  opponents?: Array<{ id: string; nickname: string; played: boolean }>;
  knockoutOpponent?: { id: string; nickname: string } | null;
  pendingResults: PendingResult[];
}) {
  const [bestOf, setBestOf] = useState<3 | 5 | 7>(5);
  const submitActionHandler =
    mode === "knockout"
      ? submitKnockoutMatchResultAction.bind(null, matchId)
      : submitGroupMatchResultAction.bind(null, matchId);
  const [submitState, submitAction, submitPending] = useActionState(
    submitActionHandler,
    initialState,
  );

  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const [myScore, setMyScore] = useState(winsNeeded);
  const [opponentScore, setOpponentScore] = useState(
    Math.max(0, winsNeeded - 1),
  );

  useEffect(() => {
    setMyScore(winsNeeded);
    setOpponentScore(Math.max(0, winsNeeded - 1));
  }, [winsNeeded]);

  const scoreOptions = Array.from(
    { length: winsNeeded + 1 },
    (_, index) => index,
  );

  const unplayedOpponents = useMemo(
    () => opponents.filter((o) => !o.played),
    [opponents],
  );

  return (
    <div className="space-y-6">
      <form
        action={submitAction}
        className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4"
      >
        <input type="hidden" name="csrfToken" defaultValue="" />
        <p className="text-sm text-slate-300">
          {mode === "knockout"
            ? "当前为淘汰赛阶段，请登记本轮对局结果。提交后需由对手或管理员确认。"
            : "系统会根据你当前小组中尚未对战的对手自动筛选可登记对象。提交后需由对手或管理员确认。"}
        </p>

        {mode === "knockout" ? (
          <label className="block space-y-1 text-sm text-slate-300">
            <span>本轮对手</span>
            <input
              readOnly
              value={knockoutOpponent?.nickname ?? "待定"}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            />
            <input
              type="hidden"
              name="opponentId"
              value={knockoutOpponent?.id ?? ""}
            />
          </label>
        ) : (
          <label className="block space-y-1 text-sm text-slate-300">
            <span>选择对手</span>
            <select
              name="opponentId"
              required
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            >
              <option value="">请选择</option>
              {unplayedOpponents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nickname}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block space-y-1 text-sm text-slate-300">
          <span>本场结果</span>
          <select
            name="didWin"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
          >
            <option value="true">我获胜</option>
            <option value="false">我失利</option>
          </select>
        </label>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="block space-y-1 text-sm text-slate-300">
            <span>局制（必选）</span>
            <select
              name="bestOf"
              required
              value={bestOf}
              onChange={(event) =>
                setBestOf(Number(event.target.value) as 3 | 5 | 7)
              }
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            >
              <option value={3}>3局2胜</option>
              <option value={5}>5局3胜</option>
              <option value={7}>7局4胜</option>
            </select>
          </label>

          <label className="block space-y-1 text-sm text-slate-300">
            <span>我方局分（必选）</span>
            <select
              name="myScore"
              required
              value={myScore}
              onChange={(event) => setMyScore(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            >
              {scoreOptions.map((score) => (
                <option key={`my-${bestOf}-${score}`} value={score}>
                  {score}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm text-slate-300">
            <span>对手局分（必选）</span>
            <select
              name="opponentScore"
              required
              value={opponentScore}
              onChange={(event) => setOpponentScore(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            >
              {scoreOptions.map((score) => (
                <option key={`opp-${bestOf}-${score}`} value={score}>
                  {score}
                </option>
              ))}
            </select>
          </label>
        </div>

        {submitState.error ? (
          <p className="text-sm text-rose-300">{submitState.error}</p>
        ) : null}
        {submitState.success ? (
          <p className="text-sm text-emerald-300">{submitState.success}</p>
        ) : null}

        <button
          type="submit"
          disabled={
            submitPending ||
            (mode === "group"
              ? unplayedOpponents.length === 0
              : !knockoutOpponent?.id)
          }
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitPending
            ? "提交中..."
            : mode === "group"
              ? unplayedOpponents.length === 0
                ? "当前无可登记对手"
                : "提交登记，等待确认"
              : !knockoutOpponent?.id
                ? "对手尚未产生"
                : "提交登记，等待确认"}
        </button>
      </form>

      <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <h3 className="text-sm font-semibold text-slate-100">待确认赛果</h3>
        {pendingResults.length === 0 ? (
          <p className="text-sm text-slate-400">当前没有待确认赛果。</p>
        ) : (
          pendingResults.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-700 bg-slate-900/70 p-3"
            >
              <p className="text-sm text-slate-200">
                {item.winnerLabel} 胜 {item.loserLabel}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                登记人：{item.reporterName}{" "}
                {item.scoreText ? `· 比分 ${item.scoreText}` : ""}
              </p>
              {item.reporterId === currentUserId ? (
                <p className="mt-2 text-xs text-amber-300">等待对方确认中</p>
              ) : (
                <form
                  action={confirmMatchResultVoidAction.bind(
                    null,
                    matchId,
                    item.id,
                  )}
                  className="mt-2"
                >
                  <input type="hidden" name="csrfToken" defaultValue="" />
                  <button
                    type="submit"
                    className="rounded-md border border-emerald-500/40 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                  >
                    我确认该结果
                  </button>
                </form>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
