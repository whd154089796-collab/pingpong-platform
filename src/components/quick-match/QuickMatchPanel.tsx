"use client";

import { useActionState } from "react";
import {
  confirmQuickMatchResultAction,
  rejectQuickMatchResultAction,
  reportQuickMatchResultAction,
} from "@/app/quick-match/actions";

const initialState: QuickMatchFormState = {};

type QuickMatchFormState = {
  error?: string;
  success?: string;
};

type OpponentOption = {
  id: string;
  nickname: string;
  email: string;
};

type PendingItem = {
  id: string;
  reportedBy: string;
  reportedByNickname: string;
  winnerNickname: string;
  loserNickname: string;
  scoreText: string;
  createdAtText: string;
  expiresAtText: string;
  canReview: boolean;
};

function ConfirmQuickButton({ resultId }: { resultId: string }) {
  const action = async (_: QuickMatchFormState, formData: FormData) =>
    confirmQuickMatchResultAction(resultId, formData);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="csrfToken" defaultValue="" />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-emerald-500/40 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-60"
      >
        {pending ? "确认中..." : "确认结果"}
      </button>
      {state.error ? (
        <p className="text-xs text-rose-300">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-xs text-emerald-300">{state.success}</p>
      ) : null}
    </form>
  );
}

function RejectQuickButton({ resultId }: { resultId: string }) {
  const action = async (_: QuickMatchFormState, formData: FormData) =>
    rejectQuickMatchResultAction(resultId, formData);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="csrfToken" defaultValue="" />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-rose-500/40 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-60"
      >
        {pending ? "处理中..." : "拒绝（作废）"}
      </button>
      {state.error ? (
        <p className="text-xs text-rose-300">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-xs text-emerald-300">{state.success}</p>
      ) : null}
    </form>
  );
}

export default function QuickMatchPanel({
  currentUserId,
  opponents,
  pendingItems,
  timeoutHours,
}: {
  currentUserId: string;
  opponents: OpponentOption[];
  pendingItems: PendingItem[];
  timeoutHours: number;
}) {
  const [state, formAction, pending] = useActionState(
    reportQuickMatchResultAction,
    initialState,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
        <h2 className="text-lg font-semibold text-white">登记快速比赛结果</h2>
        <p className="mt-1 text-sm text-slate-300">
          选择对手、获胜者与比分后提交。对手需在 {timeoutHours}{" "}
          小时内确认，否则赛果自动作废。
        </p>

        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="csrfToken" defaultValue="" />

          <label className="block space-y-1 text-sm text-slate-300">
            <span>对手</span>
            <select
              name="opponentId"
              required
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            >
              <option value="">请选择</option>
              {opponents.map((opponent) => (
                <option key={opponent.id} value={opponent.id}>
                  {opponent.nickname}（{opponent.email}）
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm text-slate-300">
            <span>获胜者</span>
            <select
              name="winnerId"
              required
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            >
              <option value={currentUserId}>我获胜</option>
              {opponents.map((opponent) => (
                <option key={`winner-${opponent.id}`} value={opponent.id}>
                  {opponent.nickname} 获胜
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm text-slate-300">
            <span>比分</span>
            <input
              name="scoreText"
              required
              maxLength={40}
              placeholder="例如：3:1"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>

          {state.error ? (
            <p className="text-sm text-rose-300">{state.error}</p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-emerald-300">{state.success}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
          >
            {pending ? "提交中..." : "提交快速比赛结果"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
        <h2 className="text-lg font-semibold text-white">待确认结果</h2>
        <p className="mt-1 text-sm text-slate-300">
          可确认或拒绝与你相关的赛果。拒绝或超时未确认，赛果将作废。
        </p>

        <div className="mt-4 space-y-3">
          {pendingItems.length === 0 ? (
            <p className="text-sm text-slate-400">暂无待确认快速比赛结果。</p>
          ) : (
            pendingItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-700 bg-slate-800/60 p-4"
              >
                <p className="text-sm text-slate-100">
                  {item.winnerNickname} 胜 {item.loserNickname}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  登记人：{item.reportedByNickname} · 比分：{item.scoreText}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  提交时间：{item.createdAtText} · 截止时间：
                  {item.expiresAtText}
                </p>

                {item.canReview ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ConfirmQuickButton resultId={item.id} />
                    <RejectQuickButton resultId={item.id} />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-300">等待对手确认</p>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
