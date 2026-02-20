import Link from "next/link";
import MatchCard from "@/components/match/MatchCard";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const statusLabelMap = {
  registration: "报名中",
  ongoing: "进行中",
  finished: "已结束",
} as const;

type MatchesPageProps = {
  searchParams?:
    | {
        q?: string | string[];
      }
    | Promise<{
        q?: string | string[];
      }>;
};

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const currentUser = await getCurrentUser();

  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : undefined;

  const rawQuery = Array.isArray(resolvedSearchParams?.q)
    ? resolvedSearchParams.q[0]
    : resolvedSearchParams?.q;
  const query = (rawQuery ?? "").trim();

  const matches = await prisma.match.findMany({
    where: query
      ? {
          title: {
            contains: query,
            mode: "insensitive",
          },
        }
      : undefined,
    include: {
      _count: { select: { registrations: true } },
      groupingResult: true,
    },
    orderBy: { dateTime: "asc" },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-3xl font-bold text-white">比赛大厅</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form
            action="/matchs"
            method="get"
            className="flex items-center gap-2"
          >
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="搜索比赛名称"
              className="h-9 w-52 appearance-none rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:bg-slate-900 focus:outline-none md:w-64"
            />
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white transition hover:bg-cyan-700"
            >
              搜索
            </button>
          </form>
          {currentUser?.role === "admin" ? (
            <Link
              href="/matchs/create"
              className="inline-flex h-9 items-center rounded-lg bg-cyan-600 px-5 text-center text-sm text-white transition hover:bg-cyan-700"
            >
              + 发布比赛
            </Link>
          ) : null}
        </div>
      </div>

      {matches.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              id={match.id}
              title={match.title}
              date={new Date(match.dateTime).toLocaleDateString("zh-CN")}
              location={match.location ?? "待定"}
              participants={match._count.registrations}
              maxParticipants={match.maxParticipants}
              status={statusLabelMap[match.status]}
              hasGrouping={Boolean(match.groupingResult)}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-slate-400">
          <p className="mb-2 text-xl">
            {query ? "未找到匹配的比赛" : "当前还没有比赛"}
          </p>
          <p>
            {query ? "试试更短的关键词或清空搜索条件" : "快去创建第一场比赛吧"}
          </p>
        </div>
      )}
    </div>
  );
}
