"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, PencilLine, ShieldCheck, Trophy } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type EloPoint = {
  eloAfter: number;
  createdAt: string;
};

type RecentResult = {
  id: string;
  matchId: string;
  matchTitle: string;
  matchDate: string;
  isWin: boolean;
  scoreText: string;
};

type BadgeItem = {
  id: string;
  title: string;
  description: string | null;
  iconUrl: string | null;
  awardedAt: string;
};

type Props = {
  user: {
    id: string;
    nickname: string;
    bio: string | null;
    avatarUrl: string | null;
    points: number;
    eloRating: number;
    wins: number;
    losses: number;
  };
  clubId: string;
  eloPoints: EloPoint[];
  recentResults: RecentResult[];
  badges: BadgeItem[];
};

export default function ProfileOverview({
  user,
  clubId,
  eloPoints,
  recentResults,
  badges,
}: Props) {
  const [xAxisMode, setXAxisMode] = useState<"date" | "nth">("date");
  const [copied, setCopied] = useState(false);

  const chartData = useMemo(
    () =>
      eloPoints.map((item, index) => ({
        elo: item.eloAfter,
        date: new Date(item.createdAt).toLocaleDateString("zh-CN", {
          month: "2-digit",
          day: "2-digit",
        }),
        nth: `第${index + 1}场`,
      })),
    [eloPoints],
  );

  const latestElo =
    chartData.length > 0 ? chartData[chartData.length - 1].elo : user.eloRating;

  return (
    <section className="space-y-6 rounded-2xl border border-slate-700/70 bg-slate-900/75 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-slate-700 text-3xl font-bold text-cyan-100">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={`${user.nickname}头像`}
                className="h-full w-full object-cover"
              />
            ) : (
              user.nickname[0]
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{user.nickname}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold tracking-wider text-cyan-100">
                Club ID: {clubId}
              </span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(clubId);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  } catch {
                    setCopied(false);
                  }
                }}
                className="rounded-md border border-slate-600 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                {copied ? "已复制" : "复制"}
              </button>
            </div>
            <p className="mt-1 max-w-xl text-sm text-slate-300">
              {user.bio || "这个人很神秘，还没有留下个人描述。"}
            </p>
          </div>
        </div>

        <Link
          href="/profile/edit"
          className="relative z-10 inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-linear-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white"
        >
          <PencilLine className="h-4 w-4" />
          编辑资料
        </Link>
      </div>

      <>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-center">
            <p className="text-xs text-slate-400">ELO</p>
            <p className="mt-1 text-xl font-bold text-cyan-100">
              {user.eloRating}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-center">
            <p className="text-xs text-slate-400">积分</p>
            <p className="mt-1 text-xl font-bold text-cyan-100">
              {user.points}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-center">
            <p className="text-xs text-slate-400">胜场数</p>
            <p className="mt-1 text-xl font-bold text-emerald-300">
              {user.wins}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-center">
            <p className="text-xs text-slate-400">败场数</p>
            <p className="mt-1 text-xl font-bold text-rose-300">
              {user.losses}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                ELO 曲线
              </span>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-700 bg-slate-800/70 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setXAxisMode("date")}
                    className={`rounded-md px-2 py-1 transition ${
                      xAxisMode === "date"
                        ? "bg-cyan-500/20 text-cyan-200"
                        : "text-slate-300 hover:text-slate-100"
                    }`}
                  >
                    日期
                  </button>
                  <button
                    type="button"
                    onClick={() => setXAxisMode("nth")}
                    className={`rounded-md px-2 py-1 transition ${
                      xAxisMode === "nth"
                        ? "bg-cyan-500/20 text-cyan-200"
                        : "text-slate-300 hover:text-slate-100"
                    }`}
                  >
                    第N场
                  </button>
                </div>
                <span>当前 ELO：{latestElo}</span>
              </div>
            </div>
            <div className="h-52 w-full">
              {chartData.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-slate-400">
                  暂无曲线数据
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid
                      stroke="rgba(148,163,184,0.2)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey={xAxisMode === "date" ? "date" : "nth"}
                      tick={{ fill: "rgb(148 163 184)", fontSize: 11 }}
                      axisLine={{ stroke: "rgba(148,163,184,0.35)" }}
                      tickLine={{ stroke: "rgba(148,163,184,0.35)" }}
                      minTickGap={18}
                    />
                    <YAxis
                      width={42}
                      tick={{ fill: "rgb(148 163 184)", fontSize: 11 }}
                      axisLine={{ stroke: "rgba(148,163,184,0.35)" }}
                      tickLine={{ stroke: "rgba(148,163,184,0.35)" }}
                      tickFormatter={(value: number) => `${value}`}
                      domain={[
                        (dataMin: number) =>
                          Math.floor((dataMin - 10) / 10) * 10,
                        (dataMax: number) =>
                          Math.ceil((dataMax + 10) / 10) * 10,
                      ]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgb(15 23 42)",
                        border: "1px solid rgb(51 65 85)",
                        borderRadius: "0.75rem",
                        color: "rgb(226 232 240)",
                      }}
                      labelStyle={{ color: "rgb(148 163 184)" }}
                      labelFormatter={(value) =>
                        xAxisMode === "date" ? `日期：${value}` : `${value}`
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="elo"
                      name="ELO"
                      stroke="rgb(34,211,238)"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "rgb(34,211,238)" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-white">
              <Trophy className="h-4 w-4 text-amber-300" />
              最近比赛成绩
            </h3>
            <div className="space-y-2">
              {recentResults.length === 0 ? (
                <p className="text-sm text-slate-400">暂无已确认比赛成绩。</p>
              ) : (
                recentResults.map((result) => (
                  <Link
                    key={result.id}
                    href={`/matchs/${result.matchId}`}
                    className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 hover:border-cyan-400/45"
                  >
                    <div>
                      <p className="font-medium">{result.matchTitle}</p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(result.matchDate).toLocaleDateString("zh-CN")}
                      </p>
                      {result.scoreText ? (
                        <p className="mt-0.5 text-xs text-slate-400">
                          比分：{result.scoreText}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={
                        result.isWin ? "text-emerald-300" : "text-rose-300"
                      }
                    >
                      {result.isWin ? "胜" : "负"}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">徽章</h3>
          {badges.length === 0 ? (
            <p className="text-sm text-slate-400">
              暂无徽章，继续参加比赛和活动来解锁。
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2"
                >
                  <p className="text-sm font-medium text-amber-200">
                    {badge.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {badge.description || "荣誉徽章"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    </section>
  );
}
