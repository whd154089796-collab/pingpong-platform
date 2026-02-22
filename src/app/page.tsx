import Link from "next/link";
import Image from "next/image";
import { TrendingUp } from "lucide-react";
import { MatchStatus } from "@prisma/client";
import MatchCard from "@/components/match/MatchCard";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const statusLabelMap: Record<MatchStatus, "报名中" | "进行中" | "已结束"> = {
  registration: "报名中",
  ongoing: "进行中",
  finished: "已结束",
};

function buildSparkline(values: number[], width = 360, height = 88) {
  if (values.length <= 1) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const points = values.map((v, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  return `M ${points.join(" L ")}`;
}

function stageLabel(input: {
  status: MatchStatus;
  format: "group_only" | "group_then_knockout";
  groupingPayload: {
    groups?: Array<{ players: Array<{ id: string }> }>;
  } | null;
  userId: string;
  userConfirmedResults: Array<{
    winnerTeamIds: string[];
    loserTeamIds: string[];
  }>;
}) {
  const { status, format, groupingPayload, userId, userConfirmedResults } =
    input;

  if (status === "registration") return "报名中（等待开赛）";
  if (status === "finished") return "比赛已结束";
  if (!groupingPayload?.groups) return "分组待发布";

  const group = groupingPayload.groups.find((item) =>
    item.players.some((player) => player.id === userId),
  );
  if (!group) return "等待编排赛程";

  const opponents = group.players.filter((player) => player.id !== userId);
  const done = opponents.filter((opponent) =>
    userConfirmedResults.some((result) => {
      const ids = [...result.winnerTeamIds, ...result.loserTeamIds];
      return ids.includes(userId) && ids.includes(opponent.id);
    }),
  ).length;

  if (done >= opponents.length && format === "group_then_knockout") {
    return `小组赛 ${done}/${opponents.length}（已完成，等待淘汰赛）`;
  }

  return `小组赛 ${done}/${opponents.length}`;
}

export default async function Home() {
  const [latestMatches, currentUser] = await Promise.all([
    prisma.match.findMany({
      orderBy: [{ dateTime: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: {
        _count: { select: { registrations: true } },
        groupingResult: { select: { id: true } },
      },
    }),
    getCurrentUser(),
  ]);

  let myRegistrations: Array<{
    id: string;
    createdAt: Date;
    match: {
      id: string;
      title: string;
      dateTime: Date;
      format: "group_only" | "group_then_knockout";
      status: MatchStatus;
      groupingResult: { payload: unknown } | null;
      results: Array<{ winnerTeamIds: string[]; loserTeamIds: string[] }>;
    };
  }> = [];
  let eloSeries: number[] = [];
  let eloDelta7d = 0;

  if (currentUser) {
    const [registrations, histories] = await Promise.all([
      prisma.registration.findMany({
        where: { userId: currentUser.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          match: {
            select: {
              id: true,
              title: true,
              dateTime: true,
              format: true,
              status: true,
              groupingResult: { select: { payload: true } },
              results: {
                where: {
                  confirmed: true,
                  OR: [
                    { winnerTeamIds: { has: currentUser.id } },
                    { loserTeamIds: { has: currentUser.id } },
                  ],
                },
                select: { winnerTeamIds: true, loserTeamIds: true },
              },
            },
          },
        },
      }),
      prisma.eloHistory.findMany({
        where: { userId: currentUser.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { eloAfter: true, createdAt: true },
      }),
    ]);

    myRegistrations = registrations;

    const asc = [...histories].reverse();
    eloSeries = asc.map((item) => item.eloAfter);
    if (eloSeries.length > 1) {
      const baseline = eloSeries[Math.max(0, eloSeries.length - 8)];
      eloDelta7d = eloSeries[eloSeries.length - 1] - baseline;
    }
  }

  const sparkPath = buildSparkline(eloSeries);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-700/70 bg-linear-to-br from-slate-800 via-slate-800 to-slate-900 p-8 shadow-xl shadow-black/20 md:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_48%)]" />
        <div className="relative space-y-8">
          <div className="rounded-2xl border border-cyan-400/30 bg-slate-900/60 p-5 md:p-6">
            <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
              <Image
                src="/SVG/乒协徽章.svg"
                alt="中国科学技术大学校乒乓球协会徽章"
                width={120}
                height={120}
                className="h-20 w-20 md:h-40 md:w-40 object-contain"
              />

              <div>
                <Image
                  src="/SVG/乒协文字.svg"
                  alt="中国科学技术大学校乒乓球协会文字标识"
                  width={420}
                  height={72}
                  className="block w-full h-auto"
                />
                <p className="mt-4 max-w-4xl text-slate-300">
                  <span className="font-medium">
                    协会赛事与成员成长平台：统一管理比赛发布、报名编排、结果上报与排名更新，让每一位选手都拥有清晰可追踪的参赛记录。
                  </span>
                </p>
              </div>
            </div>
          </div>

          {currentUser ? (
            <div className="rounded-2xl border border-cyan-400/30 bg-slate-900/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 overflow-hidden rounded-full border border-slate-600 bg-slate-800">
                    {currentUser.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentUser.avatarUrl}
                        alt={currentUser.nickname}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-2xl font-semibold text-slate-200">
                        {currentUser.nickname[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs tracking-[0.2em] text-cyan-300">
                      我的数据总览
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-white">
                      {currentUser.nickname}
                    </h2>
                    <p className="mt-1 text-sm text-slate-300">
                      本周 ELO 变化：
                      <span
                        className={
                          eloDelta7d >= 0 ? "text-emerald-300" : "text-rose-300"
                        }
                      >
                        {eloDelta7d >= 0 ? "+" : ""}
                        {eloDelta7d}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-center">
                    <p className="text-xs text-slate-400">ELO</p>
                    <p className="mt-1 text-xl font-bold text-cyan-100">
                      {currentUser.eloRating}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-center">
                    <p className="text-xs text-slate-400">积分</p>
                    <p className="mt-1 text-xl font-bold text-cyan-100">
                      {currentUser.points}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-center">
                    <p className="text-xs text-slate-400">战绩</p>
                    <p className="mt-1 text-xl font-bold text-cyan-100">
                      {currentUser.wins} / {currentUser.losses}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    最近 ELO 走势
                  </span>
                  <span>
                    {eloSeries.length > 0
                      ? `最新 ${eloSeries[eloSeries.length - 1]}`
                      : "暂无数据"}
                  </span>
                </div>
                <svg
                  viewBox="0 0 360 88"
                  className="h-24 w-full"
                  role="img"
                  aria-label="最近 ELO 走势"
                >
                  <path
                    d="M0 87 H360"
                    stroke="rgba(148,163,184,0.25)"
                    strokeWidth="1"
                    fill="none"
                  />
                  {sparkPath ? (
                    <path
                      d={sparkPath}
                      stroke="rgb(34,211,238)"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                    />
                  ) : null}
                </svg>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 text-sm text-slate-300">
              当前处于待登录状态。登录后可查看你的 ELO
              走势、报名进度和个人比赛阶段。
              <Link
                href="/auth"
                className="ml-2 text-cyan-300 hover:text-cyan-200"
              >
                去登录
              </Link>
            </div>
          )}
        </div>
      </section>

      {currentUser && (
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">我报名的比赛</h2>
            <Link
              href="/matchs"
              className="text-sm text-cyan-300 hover:text-cyan-200"
            >
              查看全部 →
            </Link>
          </div>

          {myRegistrations.length === 0 ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-8 text-center text-slate-300">
              你还没有报名比赛。
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {myRegistrations.map((registration) => {
                const payload = (registration.match.groupingResult?.payload ??
                  null) as {
                  groups?: Array<{ players: Array<{ id: string }> }>;
                } | null;
                const phase = stageLabel({
                  status: registration.match.status,
                  format: registration.match.format,
                  groupingPayload: payload,
                  userId: currentUser.id,
                  userConfirmedResults: registration.match.results,
                });

                return (
                  <Link
                    key={registration.id}
                    href={`/matchs/${registration.match.id}`}
                    className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5 text-slate-100 transition hover:border-cyan-400/45"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold">
                        {registration.match.title}
                      </h3>
                      <span className="rounded-full bg-cyan-500/15 px-2.5 py-1 text-xs text-cyan-200">
                        {statusLabelMap[registration.match.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      比赛时间：
                      {registration.match.dateTime.toLocaleString("zh-CN")}
                    </p>
                    <p className="mt-3 text-sm text-slate-300">
                      当前阶段：
                      <span className="font-medium text-cyan-100">{phase}</span>
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">近期比赛</h2>
          <Link
            href="/matchs"
            className="text-sm text-cyan-300 hover:text-cyan-200"
          >
            查看全部 →
          </Link>
        </div>

        {latestMatches.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-8 text-center text-slate-300">
            暂无比赛，快去发布第一场比赛吧。
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
            {latestMatches.map((match) => (
              <MatchCard
                key={match.id}
                id={match.id}
                title={match.title}
                type={match.type}
                matchTime={match.dateTime.toISOString()}
                registrationDeadline={match.registrationDeadline.toISOString()}
                location={match.location ?? "待定"}
                participants={match._count.registrations}
                status={statusLabelMap[match.status]}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
