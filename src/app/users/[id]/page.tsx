import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy, Target, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { toClubId } from "@/lib/club-id";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      nickname: true,
      bio: true,
      avatarUrl: true,
      points: true,
      eloRating: true,
      wins: true,
      losses: true,
      matchesPlayed: true,
    },
  });

  if (!user) {
    notFound();
  }

  const winRate =
    user.matchesPlayed === 0
      ? 0
      : Math.round((user.wins / user.matchesPlayed) * 100);
  const clubId = toClubId(user.id);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link
        href="/rankings"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        返回排行榜
      </Link>

      <div className="rounded-lg bg-linear-to-r from-blue-500 to-blue-700 p-8 text-white">
        <div className="flex items-center gap-6">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-white/20 text-4xl font-bold">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.nickname}
                className="h-full w-full object-cover"
              />
            ) : (
              user.nickname[0]
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{user.nickname}</h1>
            <p className="mt-1 text-sm text-blue-100/90">用户ID：{clubId}</p>
            <p className="mt-1 text-blue-100">{user.bio || "乒乓球爱好者"}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold">{user.eloRating}</p>
            <p className="text-sm text-blue-200">ELO 评分</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{user.points}</p>
            <p className="text-sm text-blue-200">积分</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{winRate}%</p>
            <p className="text-sm text-blue-200">胜率</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-lg border border-slate-700 bg-slate-900 p-6">
          <div className="rounded-lg bg-green-500/20 p-3">
            <Trophy className="h-6 w-6 text-green-300" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-300">{user.wins}</p>
            <p className="text-sm text-slate-400">胜场</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-slate-700 bg-slate-900 p-6">
          <div className="rounded-lg bg-rose-500/20 p-3">
            <Target className="h-6 w-6 text-rose-300" />
          </div>
          <div>
            <p className="text-2xl font-bold text-rose-300">{user.losses}</p>
            <p className="text-sm text-slate-400">负场</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-slate-700 bg-slate-900 p-6">
          <div className="rounded-lg bg-cyan-500/20 p-3">
            <TrendingUp className="h-6 w-6 text-cyan-300" />
          </div>
          <div>
            <p className="text-2xl font-bold">{user.matchesPlayed}</p>
            <p className="text-sm text-slate-400">总场次</p>
          </div>
        </div>
      </div>
    </div>
  );
}
