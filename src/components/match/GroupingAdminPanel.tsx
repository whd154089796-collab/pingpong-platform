"use client";

import { useActionState, useState } from "react";
import {
  confirmGroupingAction,
  type GroupingAdminState,
} from "@/app/matchs/actions";
import KnockoutBracket from "@/components/match/KnockoutBracket";

type GroupingPayload = {
  groups: Array<{
    name: string;
    averagePoints: number;
    players: Array<{
      id: string;
      nickname: string;
      points: number;
      eloRating: number;
    }>;
  }>;
  knockout?: {
    stage: string;
    bracketSize: number;
    rounds: Array<{
      name: string;
      matches: Array<{ id: string; homeLabel: string; awayLabel: string }>;
    }>;
  };
};

type Props = {
  matchId: string;
  initialPayloadJson?: string;
};

const initialState: GroupingAdminState = {};

function parsePayload(text?: string) {
  if (!text) return null;
  try {
    return JSON.parse(text) as GroupingPayload;
  } catch {
    return null;
  }
}

function recalculateGroupAverage(group: GroupingPayload["groups"][number]) {
  if (group.players.length === 0) return 0;
  const sum = group.players.reduce((acc, player) => acc + player.points, 0);
  return Math.round(sum / group.players.length);
}

export default function GroupingAdminPanel({
  matchId,
  initialPayloadJson,
}: Props) {
  const confirmAction = confirmGroupingAction.bind(null, matchId);

  const [confirmState, confirmFormAction, confirmPending] = useActionState(
    confirmAction,
    initialState,
  );
  const [editablePayload, setEditablePayload] =
    useState<GroupingPayload | null>(() => parsePayload(initialPayloadJson));
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});

  const payload = editablePayload;
  const handleMovePlayer = (playerId: string, sourceGroupName: string) => {
    if (!payload) return;
    const targetGroupName = moveTargets[playerId];
    if (!targetGroupName || targetGroupName === sourceGroupName) return;

    const sourceGroup = payload.groups.find(
      (group) => group.name === sourceGroupName,
    );
    if (!sourceGroup) return;

    const movingPlayer = sourceGroup.players.find(
      (player) => player.id === playerId,
    );
    if (!movingPlayer) return;

    const nextGroups = payload.groups.map((group) => {
      if (group.name === sourceGroup.name) {
        const players = group.players.filter(
          (player) => player.id !== playerId,
        );
        return {
          ...group,
          players,
          averagePoints: recalculateGroupAverage({ ...group, players }),
        };
      }

      if (group.name === targetGroupName) {
        const players = [...group.players, movingPlayer];
        return {
          ...group,
          players,
          averagePoints: recalculateGroupAverage({ ...group, players }),
        };
      }

      return group;
    });

    setEditablePayload({
      ...payload,
      groups: nextGroups,
    });

    setMoveTargets((prev) => ({
      ...prev,
      [playerId]: "",
    }));
  };

  return (
    <details className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-6">
      <summary className="cursor-pointer list-none text-lg font-semibold text-amber-100 marker:hidden">
        <span className="inline-flex items-center gap-2">
          分组与签位管理（发起人/管理员）
          <span className="text-xs font-normal text-amber-200/70">
            默认折叠，点击展开
          </span>
        </span>
      </summary>

      <div className="mt-5 space-y-5">
        {payload && (
          <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <p className="text-sm text-slate-300">
              当前编辑中的分组结果（确认后会发布给所有用户）
            </p>

            <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/40 p-3">
              <h4 className="text-sm font-semibold text-cyan-100">
                调整分组成员
              </h4>
              <p className="text-xs text-slate-300">
                直接在对应小组内为选手选择目标组并移动，无需全局搜索选手。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {payload.groups.map((group) => (
                <div
                  key={group.name}
                  className="rounded-lg border border-slate-700 p-3"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-cyan-100">
                      {group.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      组均积分 {group.averagePoints}
                    </span>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-200">
                    {group.players.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-md border border-slate-700 bg-slate-900/70 p-2"
                      >
                        <div className="flex justify-between">
                          <span>{p.nickname}</span>
                          <span className="text-slate-400">
                            {p.points} / ELO {p.eloRating}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <select
                            value={moveTargets[p.id] ?? ""}
                            onChange={(event) =>
                              setMoveTargets((prev) => ({
                                ...prev,
                                [p.id]: event.target.value,
                              }))
                            }
                            className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                          >
                            <option value="">选择目标组</option>
                            {payload.groups
                              .filter((target) => target.name !== group.name)
                              .map((target) => (
                                <option key={target.name} value={target.name}>
                                  {target.name}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleMovePlayer(p.id, group.name)}
                            className="rounded-md border border-cyan-400/40 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10"
                          >
                            移动
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {payload.knockout && (
              <div className="space-y-2">
                <h4 className="font-medium text-cyan-100">
                  {payload.knockout.stage}（仅展示，不支持在此调整签位）
                </h4>
                <KnockoutBracket rounds={payload.knockout.rounds} />
              </div>
            )}

            <form action={confirmFormAction}>
              <input type="hidden" name="csrfToken" value="" />
              <input
                type="hidden"
                name="previewJson"
                value={JSON.stringify(payload)}
              />
              <button
                disabled={confirmPending}
                className="rounded-lg bg-linear-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {confirmPending ? "发布中..." : "保存并发布分组结果"}
              </button>
            </form>
            {confirmState.error && (
              <p className="text-sm text-rose-300">{confirmState.error}</p>
            )}
            {confirmState.success && (
              <p className="text-sm text-emerald-300">{confirmState.success}</p>
            )}
          </div>
        )}

        {!payload && (
          <p className="text-sm text-slate-400">
            当前暂无可编辑分组数据，请先确认报名与分组条件。
          </p>
        )}
      </div>
    </details>
  );
}
