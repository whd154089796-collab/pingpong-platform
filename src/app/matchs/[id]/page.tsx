import { ArrowLeft, Calendar, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import RegisterMatchButton from "@/components/match/RegisterMatchButton";
import UnregisterMatchButton from "@/components/match/UnregisterMatchButton";
import MatchSettingsForm from "@/components/match/MatchSettingsForm";
import GroupingAdminPanel from "@/components/match/GroupingAdminPanel";
import KnockoutBracket from "@/components/match/KnockoutBracket";
import ReportResultForm from "@/components/match/ReportResultForm";

const statusLabelMap = {
  registration: "报名中",
  ongoing: "进行中",
  finished: "已结束",
} as const;

export default async function MatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?:
    | {
        playersPage?: string | string[];
        groupsPage?: string | string[];
      }
    | Promise<{
        playersPage?: string | string[];
        groupsPage?: string | string[];
      }>;
}) {
  const { id } = await params;

  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : undefined;
  const rawPlayersPage = Array.isArray(resolvedSearchParams?.playersPage)
    ? resolvedSearchParams.playersPage[0]
    : resolvedSearchParams?.playersPage;
  const rawGroupsPage = Array.isArray(resolvedSearchParams?.groupsPage)
    ? resolvedSearchParams.groupsPage[0]
    : resolvedSearchParams?.groupsPage;

  const [match, currentUser] = await Promise.all([
    prisma.match.findUnique({
      where: { id },
      include: {
        registrations: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                eloRating: true,
                points: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        groupingResult: true,
        results: {
          include: {
            reporter: { select: { id: true, nickname: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    getCurrentUser(),
  ]);

  if (!match) notFound();

  const now = new Date();
  const isCreator = currentUser?.id === match.createdBy;
  const isAdmin = currentUser?.role === "admin";
  const canEditSettings = isCreator && now < match.registrationDeadline;
  const canManageGrouping = Boolean(
    currentUser && (isCreator || isAdmin) && now >= match.registrationDeadline,
  );
  const canRegister =
    Boolean(currentUser) &&
    match.status === "registration" &&
    now < match.registrationDeadline;
  const alreadyRegistered = Boolean(
    currentUser && match.registrations.some((r) => r.userId === currentUser.id),
  );

  const groupingPayload = (match.groupingResult?.payload ?? null) as {
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
  } | null;

  const participantsPerPage = 12;
  const totalParticipantsPages = Math.max(
    1,
    Math.ceil(match.registrations.length / participantsPerPage),
  );
  const parsedParticipantsPage = Number(rawPlayersPage);
  const currentParticipantsPage =
    Number.isFinite(parsedParticipantsPage) && parsedParticipantsPage > 0
      ? Math.min(parsedParticipantsPage, totalParticipantsPages)
      : 1;
  const participantsStartIndex =
    (currentParticipantsPage - 1) * participantsPerPage;
  const pagedRegistrations = match.registrations.slice(
    participantsStartIndex,
    participantsStartIndex + participantsPerPage,
  );
  const participantsPages = Array.from(
    { length: totalParticipantsPages },
    (_, index) => index + 1,
  );
  const shouldOpenParticipants = Boolean(rawPlayersPage);
  const preservedPlayersPage = shouldOpenParticipants
    ? currentParticipantsPage
    : undefined;

  const currentUserId = currentUser?.id ?? null;
  const myGroup =
    currentUserId && groupingPayload
      ? groupingPayload.groups.find((group) =>
          group.players.some((player) => player.id === currentUserId),
        )
      : null;

  const groupsPerPage = 6;
  const totalGroupsPages = Math.max(
    1,
    Math.ceil((groupingPayload?.groups.length ?? 0) / groupsPerPage),
  );
  const parsedGroupsPage = Number(rawGroupsPage);
  const currentGroupsPage =
    Number.isFinite(parsedGroupsPage) && parsedGroupsPage > 0
      ? Math.min(parsedGroupsPage, totalGroupsPages)
      : 1;
  const groupsStartIndex = (currentGroupsPage - 1) * groupsPerPage;
  const pagedGroups = (groupingPayload?.groups ?? []).slice(
    groupsStartIndex,
    groupsStartIndex + groupsPerPage,
  );
  const groupsPages = Array.from(
    { length: totalGroupsPages },
    (_, index) => index + 1,
  );
  const shouldOpenGroups = Boolean(rawGroupsPage);
  const preservedGroupsPage = shouldOpenGroups ? currentGroupsPage : undefined;

  const buildMatchHref = (options?: {
    playersPage?: number;
    groupsPage?: number;
    hash?: string;
  }) => {
    const params = new URLSearchParams();
    const nextPlayersPage = options?.playersPage;
    const nextGroupsPage = options?.groupsPage;

    if (nextPlayersPage && nextPlayersPage > 0) {
      params.set("playersPage", String(nextPlayersPage));
    }
    if (nextGroupsPage && nextGroupsPage > 0) {
      params.set("groupsPage", String(nextGroupsPage));
    }

    const queryString = params.toString();
    return `/matchs/${match.id}${queryString ? `?${queryString}` : ""}${options?.hash ?? ""}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link
        href="/matchs"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        返回比赛列表
      </Link>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-sm font-medium text-cyan-100">
              {statusLabelMap[match.status]}
            </span>
            <h1 className="mt-3 text-3xl font-bold text-white">
              {match.title}
            </h1>
            <p className="mt-2 text-slate-300">
              {match.description || "暂无描述"}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              赛制：
              {match.format === "group_only"
                ? "分组比赛"
                : "前期分组后期淘汰赛"}
            </p>
            <p className="text-sm text-slate-400">
              报名截止：{match.registrationDeadline.toLocaleString("zh-CN")}
            </p>
            {isCreator && now < match.registrationDeadline && (
              <Link
                href={`/matchs/${match.id}/edit`}
                className="mt-3 inline-block rounded-lg border border-cyan-400/40 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/10"
              >
                修改比赛
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-4 text-slate-200 md:grid-cols-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-cyan-300" />
            <div>
              <p className="text-xs text-slate-400">时间</p>
              <p>{match.dateTime.toLocaleString("zh-CN")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-cyan-300" />
            <div>
              <p className="text-xs text-slate-400">地点</p>
              <p>{match.location ?? "待定"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-300" />
            <div>
              <p className="text-xs text-slate-400">参赛人数</p>
              <p>
                {match.registrations.length}/{match.maxParticipants} 人
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          {!currentUser ? (
            <p className="text-sm text-slate-300">请先登录后报名。</p>
          ) : isCreator && !alreadyRegistered ? (
            <p className="text-sm text-slate-300">
              你是比赛发起人，当前尚未报名，可手动点击报名加入参赛名单。
            </p>
          ) : null}

          {currentUser &&
            (alreadyRegistered ? (
              <UnregisterMatchButton matchId={match.id} />
            ) : (
              <RegisterMatchButton
                matchId={match.id}
                disabled={!canRegister}
                disabledText={
                  now >= match.registrationDeadline
                    ? "报名已截止"
                    : "当前不可报名"
                }
              />
            ))}
        </div>
      </div>

      {canEditSettings && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-8">
          <h2 className="mb-4 text-xl font-bold text-white">
            赛制设置（发起人）
          </h2>
          <MatchSettingsForm
            matchId={match.id}
            format={match.format}
            maxParticipants={match.maxParticipants}
            registrationDeadline={new Date(
              match.registrationDeadline.getTime() -
                match.registrationDeadline.getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16)}
          />
        </div>
      )}

      {Boolean(
        currentUser && match.status !== "registration" && groupingPayload,
      ) &&
        (() => {
          if (!currentUser || !groupingPayload) return null;

          const currentUserId = currentUser.id;
          const myGroup = groupingPayload.groups.find((group) =>
            group.players.some((player) => player.id === currentUserId),
          );
          const opponents = (myGroup?.players ?? [])
            .filter((player) => player.id !== currentUserId)
            .map((player) => {
              const played = match.results.some((result) => {
                if (!result.confirmed) return false;
                const ids = [...result.winnerTeamIds, ...result.loserTeamIds];
                return ids.includes(currentUserId) && ids.includes(player.id);
              });
              return { id: player.id, nickname: player.nickname, played };
            });

          const pendingResults = match.results
            .filter((result) => {
              if (result.confirmed) return false;
              const ids = [...result.winnerTeamIds, ...result.loserTeamIds];
              return Boolean(
                ids.includes(currentUserId) || isAdmin || isCreator,
              );
            })
            .map((result) => {
              const winnerLabel = result.winnerTeamIds
                .map(
                  (id) =>
                    match.registrations.find((r) => r.userId === id)?.user
                      .nickname ?? id,
                )
                .join(" / ");
              const loserLabel = result.loserTeamIds
                .map(
                  (id) =>
                    match.registrations.find((r) => r.userId === id)?.user
                      .nickname ?? id,
                )
                .join(" / ");

              return {
                id: result.id,
                reporterId: result.reporter.id,
                reporterName: result.reporter.nickname,
                winnerLabel,
                loserLabel,
                scoreText:
                  typeof result.score === "object" &&
                  result.score &&
                  "text" in result.score
                    ? String(result.score.text ?? "")
                    : "",
              };
            });

          const completedCount = opponents.filter((o) => o.played).length;

          return (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-8">
              <h2 className="mb-2 text-xl font-bold text-white">
                我的比赛进程
              </h2>
              <p className="mb-4 text-sm text-slate-400">
                当前进度：已完成 {completedCount}/{opponents.length}{" "}
                场组内对局。每场需由对手或管理员确认后生效并推进进程。
              </p>
              {match.type !== "single" ? (
                <p className="text-sm text-amber-300">
                  当前流程化登记先支持单打。双打/团体请由管理员使用赛果录入接口。
                </p>
              ) : myGroup ? (
                <ReportResultForm
                  matchId={match.id}
                  opponents={opponents}
                  pendingResults={pendingResults}
                />
              ) : (
                <p className="text-sm text-slate-400">
                  你当前不在任何分组中，暂无法登记组内赛果。
                </p>
              )}
            </div>
          );
        })()}

      {canManageGrouping && !groupingPayload && (
        <GroupingAdminPanel
          matchId={match.id}
          format={match.format}
          defaultGroupCount={Math.max(
            1,
            Math.min(
              8,
              Math.ceil(
                match.registrations.length /
                  (match.format === "group_only" ? 6 : 4),
              ),
            ),
          )}
        />
      )}

      {(!groupingPayload || (currentUser && alreadyRegistered)) && (
        <div
          id="grouping"
          className="rounded-2xl border border-slate-700 bg-slate-900/80 p-8"
        >
          <h2 className="mb-4 text-xl font-bold text-white">分组结果</h2>
          {!groupingPayload ? (
            <p className="text-slate-400">
              报名截止后由发起人或管理员手动生成并确认分组结果。
            </p>
          ) : (
            <div className="space-y-6">
              {myGroup ? (
                <div className="rounded-xl border border-slate-700 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold text-cyan-100">
                      {myGroup.name}
                    </h3>
                    <span className="text-xs text-slate-400">
                      组均积分 {myGroup.averagePoints}
                    </span>
                  </div>
                  <ul className="space-y-1 text-sm text-slate-200">
                    {myGroup.players.map((player) => (
                      <li key={player.id} className="flex justify-between">
                        <span>{player.nickname}</span>
                        <span className="text-slate-400">
                          {player.points} 分 / ELO {player.eloRating}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-slate-400">你已报名，当前尚未分配到小组。</p>
              )}

              {groupingPayload.knockout && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-cyan-100">
                    {groupingPayload.knockout.stage}（淘汰赛签表）
                  </h3>
                  <p className="text-xs text-slate-400">
                    当前展示为签位示意，待小组赛结束后将按晋级结果填充具体选手。
                  </p>
                  <KnockoutBracket rounds={groupingPayload.knockout.rounds} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {groupingPayload && (
        <details
          id="all-groups"
          className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6"
          open={shouldOpenGroups}
        >
          <summary className="cursor-pointer list-none text-xl font-bold text-white marker:hidden">
            <span className="inline-flex items-center gap-2">
              全部小组查看（{groupingPayload.groups.length}）
              <span className="text-sm font-normal text-slate-400">
                点击展开/收起
              </span>
            </span>
          </summary>

          <div className="mt-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              {pagedGroups.map((group) => (
                <div
                  key={group.name}
                  className="rounded-xl border border-slate-700 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold text-cyan-100">
                      {group.name}
                    </h3>
                    <span className="text-xs text-slate-400">
                      组均积分 {group.averagePoints}
                    </span>
                  </div>
                  <ul className="space-y-1 text-sm text-slate-200">
                    {group.players.map((player) => (
                      <li key={player.id} className="flex justify-between">
                        <span>{player.nickname}</span>
                        <span className="text-slate-400">
                          {player.points} 分 / ELO {player.eloRating}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {totalGroupsPages > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                {groupsPages.map((page) => (
                  <Link
                    key={page}
                    href={buildMatchHref({
                      playersPage: preservedPlayersPage,
                      groupsPage: page,
                      hash: "#all-groups",
                    })}
                    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition ${
                      page === currentGroupsPage
                        ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                        : "border-slate-700 text-slate-300 hover:border-cyan-400/40"
                    }`}
                  >
                    {page}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </details>
      )}

      <details
        id="registered-players"
        className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6"
        open={shouldOpenParticipants}
      >
        <summary className="cursor-pointer list-none text-xl font-bold text-white marker:hidden">
          <span className="inline-flex items-center gap-2">
            已报名选手（{match.registrations.length}）
            <span className="text-sm font-normal text-slate-400">
              点击展开/收起
            </span>
          </span>
        </summary>

        <div className="mt-5 space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            {pagedRegistrations.map((item, index) => (
              <Link
                key={item.id}
                href={`/users/${item.user.id}`}
                className="flex items-center gap-4 rounded-lg border border-slate-700 p-3 hover:border-cyan-400/40"
              >
                <span className="w-6 font-mono text-slate-400">
                  {participantsStartIndex + index + 1}
                </span>
                <div className="grid h-10 w-10 place-items-center rounded-full bg-cyan-500/20 text-cyan-100">
                  {item.user.nickname[0]}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-100">
                    {item.user.nickname}
                  </p>
                  <p className="text-sm text-slate-400">
                    积分 {item.user.points} · ELO {item.user.eloRating}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {totalParticipantsPages > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {participantsPages.map((page) => (
                <Link
                  key={page}
                  href={buildMatchHref({
                    playersPage: page,
                    groupsPage: preservedGroupsPage,
                    hash: "#registered-players",
                  })}
                  className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition ${
                    page === currentParticipantsPage
                      ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                      : "border-slate-700 text-slate-300 hover:border-cyan-400/40"
                  }`}
                >
                  {page}
                </Link>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
