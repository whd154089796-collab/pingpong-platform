import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import QuickMatchPanel from "@/components/quick-match/QuickMatchPanel";
import { cleanupExpiredQuickResultsForUser } from "@/app/quick-match/actions";

const QUICK_MATCH_TITLE_PREFIX = "[快速比赛]";
const QUICK_MATCH_TIMEOUT_HOURS = 24;

export default async function QuickMatchPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/auth");
  }

  await cleanupExpiredQuickResultsForUser(currentUser.id);

  const [opponents, pending] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { not: currentUser.id },
        isBanned: false,
      },
      orderBy: [{ nickname: "asc" }],
      select: {
        id: true,
        nickname: true,
        email: true,
      },
      take: 200,
    }),
    prisma.matchResult.findMany({
      where: {
        confirmed: false,
        OR: [
          { winnerTeamIds: { has: currentUser.id } },
          { loserTeamIds: { has: currentUser.id } },
        ],
        match: {
          title: {
            startsWith: QUICK_MATCH_TITLE_PREFIX,
          },
        },
      },
      include: {
        reporter: {
          select: {
            id: true,
            nickname: true,
          },
        },
        winner: {
          select: {
            nickname: true,
          },
        },
        loser: {
          select: {
            nickname: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const pendingItems = pending.map((item) => {
    const expiresAt = new Date(
      item.createdAt.getTime() + QUICK_MATCH_TIMEOUT_HOURS * 60 * 60 * 1000,
    );
    const canReview = item.reportedBy !== currentUser.id;

    let scoreText = "未填写";
    if (typeof item.score === "string") {
      scoreText = item.score;
    } else if (
      typeof item.score === "object" &&
      item.score &&
      "text" in item.score
    ) {
      scoreText = String(item.score.text ?? "未填写");
    }

    return {
      id: item.id,
      reportedBy: item.reportedBy,
      reportedByNickname: item.reporter.nickname,
      winnerNickname: item.winner?.nickname ?? "未知",
      loserNickname: item.loser?.nickname ?? "未知",
      scoreText,
      createdAtText: item.createdAt.toLocaleString("zh-CN"),
      expiresAtText: expiresAt.toLocaleString("zh-CN"),
      canReview,
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
        <h1 className="text-2xl font-bold text-white">快速比赛</h1>
        <p className="mt-2 text-sm text-slate-300">
          快速录入对局结果，并由对手确认。若对手拒绝或{" "}
          {QUICK_MATCH_TIMEOUT_HOURS} 小时内未确认，赛果自动作废。
        </p>
      </section>

      <QuickMatchPanel
        currentUserId={currentUser.id}
        opponents={opponents}
        pendingItems={pendingItems}
        timeoutHours={QUICK_MATCH_TIMEOUT_HOURS}
      />
    </div>
  );
}
