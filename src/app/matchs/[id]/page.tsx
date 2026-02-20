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
import AdminResultEntryForm from "../../../components/match/AdminResultEntryForm";
import {
  confirmMatchResultVoidAction,
  rejectMatchResultVoidAction,
  removeRegistrationByManagerVoidAction,
} from "@/app/matchs/actions";
import { generateGroupingPayload } from "@/lib/tournament";

const statusLabelMap = {
  registration: "报名中",
  ongoing: "进行中",
  finished: "已结束",
} as const;

function pairKey(idA: string, idB: string) {
  return [idA, idB].sort().join("::");
}

function extractScoreText(score: unknown) {
  if (typeof score === "object" && score && "text" in score) {
    return String((score as { text?: unknown }).text ?? "");
  }
  if (typeof score === "string") return score;
  return "";
}

function extractWinnerLoserSets(score: unknown) {
  if (typeof score === "object" && score) {
    const winnerScore = Number(
      (score as { winnerScore?: unknown }).winnerScore,
    );
    const loserScore = Number((score as { loserScore?: unknown }).loserScore);
    if (Number.isFinite(winnerScore) && Number.isFinite(loserScore)) {
      return { winnerScore, loserScore };
    }
  }
  return null;
}

type KnockoutRound = {
  name: string;
  matches: Array<{
    id: string;
    homeLabel: string;
    awayLabel: string;
    homeFilled?: boolean;
    awayFilled?: boolean;
    homePlayerId?: string | null;
    awayPlayerId?: string | null;
    homeSourceLabel?: string;
    awaySourceLabel?: string;
    homeOutcome?: "winner" | "loser";
    awayOutcome?: "winner" | "loser";
    homeScoreText?: string;
    awayScoreText?: string;
  }>;
};

type GroupPlayer = {
  id: string;
  nickname: string;
  points: number;
  eloRating: number;
};

type AdminEligibleMatchOption = {
  playerAId: string;
  playerANickname: string;
  playerBId: string;
  playerBNickname: string;
};

type AdminGroupBattleTable = {
  groupName: string;
  players: Array<{ id: string; nickname: string }>;
  cells: Record<
    string,
    {
      status: "confirmed" | "pending" | "todo";
      label: string;
      scoreText: string;
    }
  >;
};

type MatchResultLite = {
  winnerTeamIds: string[];
  loserTeamIds: string[];
  confirmed: boolean;
  score: unknown;
  createdAt: Date;
  resultVerifiedAt: Date | null;
};

function buildGroupStandings(
  players: GroupPlayer[],
  results: MatchResultLite[],
) {
  const standings = players.map((player) => ({
    id: player.id,
    nickname: player.nickname,
    wins: 0,
    losses: 0,
    setWins: 0,
    setLosses: 0,
    eloRating: player.eloRating,
  }));

  const byId = new Map(standings.map((item) => [item.id, item]));
  const playerIdSet = new Set(players.map((player) => player.id));

  for (const result of results) {
    if (!result.confirmed) continue;
    if (result.winnerTeamIds.length !== 1 || result.loserTeamIds.length !== 1)
      continue;

    const winnerId = result.winnerTeamIds[0];
    const loserId = result.loserTeamIds[0];
    if (!playerIdSet.has(winnerId) || !playerIdSet.has(loserId)) continue;

    const winner = byId.get(winnerId);
    const loser = byId.get(loserId);
    if (!winner || !loser) continue;

    winner.wins += 1;
    loser.losses += 1;

    const sets = extractWinnerLoserSets(result.score);
    if (sets) {
      winner.setWins += sets.winnerScore;
      winner.setLosses += sets.loserScore;
      loser.setWins += sets.loserScore;
      loser.setLosses += sets.winnerScore;
    }
  }

  return standings.sort((a, b) => {
    const winDiff = b.wins - a.wins;
    if (winDiff !== 0) return winDiff;
    const setDiff = b.setWins - b.setLosses - (a.setWins - a.setLosses);
    if (setDiff !== 0) return setDiff;
    const setWinDiff = b.setWins - a.setWins;
    if (setWinDiff !== 0) return setWinDiff;
    return b.eloRating - a.eloRating;
  });
}

function resolveFilledKnockoutRounds(params: {
  knockoutRounds: KnockoutRound[];
  groups: Array<{ name: string; players: GroupPlayer[] }>;
  qualifiersPerGroup: number;
  results: MatchResultLite[];
  groupingGeneratedAt: Date | null;
}) {
  const {
    knockoutRounds,
    groups,
    qualifiersPerGroup,
    results,
    groupingGeneratedAt,
  } = params;

  const qualifierLabelToPlayer = new Map<
    string,
    { id: string; nickname: string }
  >();

  const confirmedSingles = results.filter(
    (result) =>
      result.confirmed &&
      result.winnerTeamIds.length === 1 &&
      result.loserTeamIds.length === 1,
  );

  for (const group of groups) {
    const standings = buildGroupStandings(group.players, confirmedSingles);
    const groupPlayerIdSet = new Set(group.players.map((player) => player.id));
    const groupConfirmedCount = confirmedSingles.filter((result) => {
      const winnerId = result.winnerTeamIds[0];
      const loserId = result.loserTeamIds[0];
      return groupPlayerIdSet.has(winnerId) && groupPlayerIdSet.has(loserId);
    }).length;
    const totalGroupMatches =
      group.players.length > 1
        ? (group.players.length * (group.players.length - 1)) / 2
        : 0;
    const groupCompleted =
      totalGroupMatches > 0 && groupConfirmedCount >= totalGroupMatches;

    if (!groupCompleted) continue;

    standings
      .slice(0, Math.min(qualifiersPerGroup, standings.length))
      .forEach((item, index) => {
        qualifierLabelToPlayer.set(`${group.name}第 ${index + 1} 名`, {
          id: item.id,
          nickname: item.nickname,
        });
      });
  }

  const winnerByMatchId = new Map<string, { id: string; nickname: string }>();

  const getHeadToHeadResult = (idA: string, idB: string) => {
    const candidates = confirmedSingles.filter(
      (result) =>
        result.confirmed &&
        result.winnerTeamIds.length === 1 &&
        result.loserTeamIds.length === 1 &&
        (!groupingGeneratedAt || result.createdAt >= groupingGeneratedAt) &&
        ((result.winnerTeamIds[0] === idA && result.loserTeamIds[0] === idB) ||
          (result.winnerTeamIds[0] === idB && result.loserTeamIds[0] === idA)),
    );

    if (candidates.length === 0) return null;

    return [...candidates].sort((a, b) => {
      const ta = (a.resultVerifiedAt ?? a.createdAt).getTime();
      const tb = (b.resultVerifiedAt ?? b.createdAt).getTime();
      return tb - ta;
    })[0];
  };

  const resolveLabel = (label: string) => {
    const fromQualifier = qualifierLabelToPlayer.get(label);
    if (fromQualifier) {
      return {
        displayLabel: fromQualifier.nickname,
        playerId: fromQualifier.id,
        filled: true,
        sourceLabel: label,
      };
    }

    const matchWinnerRef = label.match(/^胜者\s+(.+)$/);
    if (matchWinnerRef) {
      const fromWinner = winnerByMatchId.get(matchWinnerRef[1]);
      if (fromWinner) {
        return {
          displayLabel: fromWinner.nickname,
          playerId: fromWinner.id,
          filled: true,
          sourceLabel: label,
        };
      }
    }

    return {
      displayLabel: label,
      playerId: null,
      filled: false,
      sourceLabel: label,
    };
  };

  return knockoutRounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => {
      const home = resolveLabel(match.homeLabel);
      const away = resolveLabel(match.awayLabel);

      if (home.playerId && away.playerId) {
        const matchResult = getHeadToHeadResult(home.playerId, away.playerId);
        if (matchResult) {
          const winnerId = matchResult.winnerTeamIds[0];
          const winnerLabel =
            winnerId === home.playerId ? home.displayLabel : away.displayLabel;
          winnerByMatchId.set(match.id, {
            id: winnerId,
            nickname: winnerLabel,
          });

          const sets = extractWinnerLoserSets(matchResult.score);
          const winnerScore = sets?.winnerScore ?? null;
          const loserScore = sets?.loserScore ?? null;
          const homeIsWinner = winnerId === home.playerId;

          return {
            ...match,
            homeLabel: home.displayLabel,
            awayLabel: away.displayLabel,
            homeFilled: home.filled,
            awayFilled: away.filled,
            homePlayerId: home.playerId,
            awayPlayerId: away.playerId,
            homeSourceLabel: home.sourceLabel,
            awaySourceLabel: away.sourceLabel,
            homeOutcome: homeIsWinner ? "winner" : "loser",
            awayOutcome: homeIsWinner ? "loser" : "winner",
            homeScoreText:
              winnerScore !== null && loserScore !== null
                ? homeIsWinner
                  ? `${winnerScore}:${loserScore}`
                  : `${loserScore}:${winnerScore}`
                : "",
            awayScoreText:
              winnerScore !== null && loserScore !== null
                ? homeIsWinner
                  ? `${loserScore}:${winnerScore}`
                  : `${winnerScore}:${loserScore}`
                : "",
          };
        }
      }

      return {
        ...match,
        homeLabel: home.displayLabel,
        awayLabel: away.displayLabel,
        homeFilled: home.filled,
        awayFilled: away.filled,
        homePlayerId: home.playerId,
        awayPlayerId: away.playerId,
        homeSourceLabel: home.sourceLabel,
        awaySourceLabel: away.sourceLabel,
      };
    }),
  }));
}

function buildAdminEligibleOptions(params: {
  groupingPayload: {
    groups: Array<{ name: string; players: GroupPlayer[] }>;
    knockout?: { rounds: KnockoutRound[] };
  };
  filledKnockoutRounds: Array<{
    name: string;
    matches: Array<{
      homeLabel: string;
      awayLabel: string;
      homePlayerId?: string | null;
      awayPlayerId?: string | null;
      homeOutcome?: string;
      awayOutcome?: string;
    }>;
  }> | null;
  results: Array<{
    winnerTeamIds: string[];
    loserTeamIds: string[];
    createdAt: Date;
  }>;
  groupingGeneratedAt: Date | null;
}) {
  const {
    groupingPayload,
    filledKnockoutRounds,
    results,
    groupingGeneratedAt,
  } = params;

  const allSinglePairKeys = new Set(
    results
      .filter(
        (result) =>
          result.winnerTeamIds.length === 1 && result.loserTeamIds.length === 1,
      )
      .map((result) =>
        pairKey(result.winnerTeamIds[0], result.loserTeamIds[0]),
      ),
  );

  const knockoutPairKeys = new Set(
    results
      .filter(
        (result) =>
          result.winnerTeamIds.length === 1 &&
          result.loserTeamIds.length === 1 &&
          (!groupingGeneratedAt || result.createdAt >= groupingGeneratedAt),
      )
      .map((result) =>
        pairKey(result.winnerTeamIds[0], result.loserTeamIds[0]),
      ),
  );

  const groupMatchOptions = groupingPayload.groups.flatMap((group) => {
    const items: Array<
      AdminEligibleMatchOption & {
        groupName: string;
      }
    > = [];

    for (let i = 0; i < group.players.length; i += 1) {
      for (let j = i + 1; j < group.players.length; j += 1) {
        const playerA = group.players[i];
        const playerB = group.players[j];
        const key = pairKey(playerA.id, playerB.id);
        if (allSinglePairKeys.has(key)) continue;

        items.push({
          groupName: group.name,
          playerAId: playerA.id,
          playerANickname: playerA.nickname,
          playerBId: playerB.id,
          playerBNickname: playerB.nickname,
        });
      }
    }

    return items;
  });

  const knockoutMatchOptions = (filledKnockoutRounds ?? []).flatMap((round) =>
    round.matches.flatMap((match) => {
      if (!match.homePlayerId || !match.awayPlayerId) return [];
      if (match.homeOutcome || match.awayOutcome) return [];

      const key = pairKey(match.homePlayerId, match.awayPlayerId);
      if (knockoutPairKeys.has(key)) return [];

      return [
        {
          roundName: round.name,
          playerAId: match.homePlayerId,
          playerANickname: match.homeLabel,
          playerBId: match.awayPlayerId,
          playerBNickname: match.awayLabel,
        },
      ];
    }),
  );

  return { groupMatchOptions, knockoutMatchOptions };
}

function buildAdminGroupBattleTables(params: {
  groups: Array<{ name: string; players: GroupPlayer[] }>;
  results: Array<{
    winnerTeamIds: string[];
    loserTeamIds: string[];
    confirmed: boolean;
    score: unknown;
  }>;
}) {
  const { groups, results } = params;

  return groups.map<AdminGroupBattleTable>((group) => {
    const playerIds = new Set(group.players.map((player) => player.id));
    const confirmedByPair = new Map<
      string,
      { winnerId: string; scoreText: string }
    >();
    const pendingByPair = new Map<string, { scoreText: string }>();

    for (const result of results) {
      if (result.winnerTeamIds.length !== 1 || result.loserTeamIds.length !== 1)
        continue;

      const winnerId = result.winnerTeamIds[0];
      const loserId = result.loserTeamIds[0];
      if (!playerIds.has(winnerId) || !playerIds.has(loserId)) continue;

      const key = pairKey(winnerId, loserId);
      const scoreText = extractScoreText(result.score);

      if (result.confirmed) {
        if (!confirmedByPair.has(key)) {
          confirmedByPair.set(key, { winnerId, scoreText });
        }
      } else if (!pendingByPair.has(key)) {
        pendingByPair.set(key, { scoreText });
      }
    }

    const cells: AdminGroupBattleTable["cells"] = {};

    for (const rowPlayer of group.players) {
      for (const colPlayer of group.players) {
        if (rowPlayer.id === colPlayer.id) continue;

        const key = pairKey(rowPlayer.id, colPlayer.id);
        const confirmed = confirmedByPair.get(key);
        const pending = pendingByPair.get(key);

        if (confirmed) {
          cells[`${rowPlayer.id}::${colPlayer.id}`] = {
            status: "confirmed",
            label: confirmed.winnerId === rowPlayer.id ? "胜" : "负",
            scoreText: confirmed.scoreText,
          };
        } else if (pending) {
          cells[`${rowPlayer.id}::${colPlayer.id}`] = {
            status: "pending",
            label: "待确认",
            scoreText: pending.scoreText,
          };
        } else {
          cells[`${rowPlayer.id}::${colPlayer.id}`] = {
            status: "todo",
            label: "未进行",
            scoreText: "",
          };
        }
      }
    }

    return {
      groupName: group.name,
      players: group.players.map((player) => ({
        id: player.id,
        nickname: player.nickname,
      })),
      cells,
    };
  });
}

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
  const canManageGrouping = Boolean(currentUser && (isCreator || isAdmin));
  const canRegister =
    Boolean(currentUser) &&
    match.status === "registration" &&
    now < match.registrationDeadline;
  const alreadyRegistered = Boolean(
    currentUser && match.registrations.some((r) => r.userId === currentUser.id),
  );

  const groupingPayload = (match.groupingResult?.payload ?? null) as {
    config?: {
      groupCount?: number;
      qualifiersPerGroup?: number;
    };
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

  const defaultGroupCount = Math.max(
    1,
    Math.min(
      8,
      Math.ceil(
        match.registrations.length / (match.format === "group_only" ? 6 : 4),
      ),
    ),
  );

  const fallbackGroupingPayload =
    canManageGrouping &&
    !groupingPayload &&
    now >= match.registrationDeadline &&
    match.registrations.length >= 2
      ? (() => {
          try {
            return generateGroupingPayload(
              match.format,
              match.registrations.map((item) => ({
                id: item.user.id,
                nickname: item.user.nickname,
                points: item.user.points,
                eloRating: item.user.eloRating,
              })),
              {
                groupCount: defaultGroupCount,
                qualifiersPerGroup:
                  match.format === "group_then_knockout" ? 2 : undefined,
              },
            );
          } catch {
            return null;
          }
        })()
      : null;

  const filledKnockoutRounds = groupingPayload?.knockout
    ? resolveFilledKnockoutRounds({
        knockoutRounds: groupingPayload.knockout.rounds,
        groups: groupingPayload.groups,
        qualifiersPerGroup: groupingPayload.config?.qualifiersPerGroup ?? 1,
        results: match.results,
        groupingGeneratedAt: match.groupingGeneratedAt ?? null,
      })
    : null;

  const adminEligibleOptions =
    groupingPayload && match.type === "single"
      ? buildAdminEligibleOptions({
          groupingPayload,
          filledKnockoutRounds,
          results: match.results,
          groupingGeneratedAt: match.groupingGeneratedAt ?? null,
        })
      : null;

  const adminGroupBattleTables = groupingPayload
    ? buildAdminGroupBattleTables({
        groups: groupingPayload.groups,
        results: match.results,
      })
    : [];

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

  const adminPendingResults = match.results
    .filter((result) => !result.confirmed)
    .map((result) => {
      const winnerLabel = result.winnerTeamIds
        .map(
          (uid) =>
            match.registrations.find((r) => r.userId === uid)?.user.nickname ??
            uid,
        )
        .join(" / ");
      const loserLabel = result.loserTeamIds
        .map(
          (uid) =>
            match.registrations.find((r) => r.userId === uid)?.user.nickname ??
            uid,
        )
        .join(" / ");

      return {
        id: result.id,
        reporterName: result.reporter.nickname,
        winnerLabel,
        loserLabel,
        scoreText:
          typeof result.score === "object" &&
          result.score &&
          "text" in result.score
            ? String(result.score.text ?? "")
            : "",
        phaseLabel:
          typeof result.score === "object" &&
          result.score &&
          "phase" in result.score
            ? String(result.score.phase ?? "")
            : "",
        groupName:
          typeof result.score === "object" &&
          result.score &&
          "groupName" in result.score
            ? String(result.score.groupName ?? "")
            : "",
        knockoutRound:
          typeof result.score === "object" &&
          result.score &&
          "knockoutRound" in result.score
            ? String(result.score.knockoutRound ?? "")
            : "",
      };
    });

  const latestAdminResultContext =
    currentUser &&
    (currentUser.role === "admin" || currentUser.id === match.createdBy)
      ? match.results.find((result) => {
          if (result.reporter.id !== currentUser.id) return false;
          const score = result.score;
          return (
            typeof score === "object" && score !== null && "phase" in score
          );
        })
      : null;

  const initialAdminPhase =
    latestAdminResultContext &&
    typeof latestAdminResultContext.score === "object" &&
    latestAdminResultContext.score &&
    "phase" in latestAdminResultContext.score
      ? (String(latestAdminResultContext.score.phase ?? "") as
          | "group"
          | "knockout")
      : undefined;

  const initialAdminGroupName =
    latestAdminResultContext &&
    typeof latestAdminResultContext.score === "object" &&
    latestAdminResultContext.score &&
    "groupName" in latestAdminResultContext.score
      ? String(latestAdminResultContext.score.groupName ?? "")
      : undefined;

  const initialAdminRoundName =
    latestAdminResultContext &&
    typeof latestAdminResultContext.score === "object" &&
    latestAdminResultContext.score &&
    "knockoutRound" in latestAdminResultContext.score
      ? String(latestAdminResultContext.score.knockoutRound ?? "")
      : undefined;

  const initialAdminWinnerId = latestAdminResultContext?.winnerTeamIds?.[0];
  const initialAdminLoserId = latestAdminResultContext?.loserTeamIds?.[0];

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
              now < match.registrationDeadline ? (
                <UnregisterMatchButton matchId={match.id} />
              ) : null
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
        currentUser &&
        alreadyRegistered &&
        match.status !== "registration" &&
        groupingPayload,
      ) &&
        (() => {
          if (!currentUser || !groupingPayload) return null;

          const currentUserId = currentUser.id;
          const myGroup = groupingPayload.groups.find((group) =>
            group.players.some((player) => player.id === currentUserId),
          );
          const groupPlayerIds = new Set(
            (myGroup?.players ?? []).map((player) => player.id),
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

          const isGroupSingleResult = (
            winnerTeamIds: string[],
            loserTeamIds: string[],
          ) => {
            if (winnerTeamIds.length !== 1 || loserTeamIds.length !== 1)
              return false;
            const winnerId = winnerTeamIds[0];
            const loserId = loserTeamIds[0];
            return groupPlayerIds.has(winnerId) && groupPlayerIds.has(loserId);
          };

          const confirmedGroupResultByPair = new Map<
            string,
            {
              winnerId: string;
              loserId: string;
              scoreText: string;
              winnerScore: number | null;
              loserScore: number | null;
            }
          >();

          for (const result of match.results) {
            if (!isGroupSingleResult(result.winnerTeamIds, result.loserTeamIds))
              continue;

            const winnerId = result.winnerTeamIds[0];
            const loserId = result.loserTeamIds[0];
            const key = pairKey(winnerId, loserId);
            const scoreText = extractScoreText(result.score);

            if (result.confirmed) {
              if (confirmedGroupResultByPair.has(key)) continue;
              const sets = extractWinnerLoserSets(result.score);
              confirmedGroupResultByPair.set(key, {
                winnerId,
                loserId,
                scoreText,
                winnerScore: sets?.winnerScore ?? null,
                loserScore: sets?.loserScore ?? null,
              });
            }
          }

          const groupPlayers = myGroup?.players ?? [];

          const groupStandings = (myGroup?.players ?? []).map((player) => ({
            id: player.id,
            nickname: player.nickname,
            wins: 0,
            losses: 0,
            setWins: 0,
            setLosses: 0,
            points: player.points,
            eloRating: player.eloRating,
          }));

          const standingById = new Map(
            groupStandings.map((item) => [item.id, item]),
          );

          for (const result of confirmedGroupResultByPair.values()) {
            const winner = standingById.get(result.winnerId);
            const loser = standingById.get(result.loserId);
            if (!winner || !loser) continue;

            winner.wins += 1;
            loser.losses += 1;

            if (result.winnerScore !== null && result.loserScore !== null) {
              winner.setWins += result.winnerScore;
              winner.setLosses += result.loserScore;
              loser.setWins += result.loserScore;
              loser.setLosses += result.winnerScore;
            }
          }

          const sortedStandings = [...groupStandings].sort((a, b) => {
            const winDiff = b.wins - a.wins;
            if (winDiff !== 0) return winDiff;
            const setDiff = b.setWins - b.setLosses - (a.setWins - a.setLosses);
            if (setDiff !== 0) return setDiff;
            const setWinDiff = b.setWins - a.setWins;
            if (setWinDiff !== 0) return setWinDiff;
            return b.eloRating - a.eloRating;
          });

          const totalGroupMatches =
            myGroup && myGroup.players.length > 1
              ? (myGroup.players.length * (myGroup.players.length - 1)) / 2
              : 0;
          const confirmedGroupMatches = confirmedGroupResultByPair.size;
          const groupCompleted =
            totalGroupMatches > 0 &&
            confirmedGroupMatches === totalGroupMatches;
          const qualifiersPerGroup =
            groupingPayload.config?.qualifiersPerGroup ?? 1;
          const qualifiedPlayers = groupCompleted
            ? sortedStandings.slice(
                0,
                Math.min(qualifiersPerGroup, sortedStandings.length),
              )
            : [];

          const parseGroupNameFromQualifierLabel = (label?: string) => {
            if (!label) return null;
            const matched = label.match(/^(第\s*\d+\s*组)第\s*\d+\s*名$/);
            return matched ? matched[1] : null;
          };

          let knockoutState:
            | "group"
            | "ready"
            | "waiting"
            | "eliminated"
            | "finished" = "group";
          let knockoutOpponent: { id: string; nickname: string } | null = null;
          let waitingReason = "";
          let unresolvedOpponentGroupName: string | null = null;

          if (groupCompleted && filledKnockoutRounds) {
            knockoutState = "finished";

            outer: for (const round of filledKnockoutRounds) {
              for (const matchRound of round.matches) {
                const isHome = matchRound.homePlayerId === currentUserId;
                const isAway = matchRound.awayPlayerId === currentUserId;
                if (!isHome && !isAway) continue;

                const myOutcome = isHome
                  ? matchRound.homeOutcome
                  : matchRound.awayOutcome;

                if (myOutcome === "loser") {
                  knockoutState = "eliminated";
                  waitingReason = "你在淘汰赛中已被淘汰。";
                  break outer;
                }

                if (myOutcome === "winner") {
                  knockoutState = "finished";
                  continue;
                }

                const opponentId = isHome
                  ? matchRound.awayPlayerId
                  : matchRound.homePlayerId;
                const opponentLabel = isHome
                  ? matchRound.awayLabel
                  : matchRound.homeLabel;
                const opponentSource = isHome
                  ? matchRound.awaySourceLabel
                  : matchRound.homeSourceLabel;

                if (opponentId) {
                  knockoutState = "ready";
                  knockoutOpponent = {
                    id: opponentId,
                    nickname: opponentLabel,
                  };
                } else {
                  knockoutState = "waiting";
                  waitingReason =
                    "当前淘汰赛对手尚未产生，请等待相关对局完成。";
                  unresolvedOpponentGroupName =
                    parseGroupNameFromQualifierLabel(opponentSource);
                }

                break outer;
              }
            }
          }

          const pendingResults = match.results
            .filter((result) => {
              if (result.confirmed) return false;
              const ids = [...result.winnerTeamIds, ...result.loserTeamIds];
              return Boolean(ids.includes(currentUserId));
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

          const buildGroupBattleMatrix = (
            players: Array<{ id: string; nickname: string }>,
          ) => {
            const playerIds = new Set(players.map((player) => player.id));
            const confirmedByPair = new Map<
              string,
              { winnerId: string; scoreText: string }
            >();
            const pendingByPair = new Map<string, { scoreText: string }>();

            for (const result of match.results) {
              if (
                result.winnerTeamIds.length !== 1 ||
                result.loserTeamIds.length !== 1
              )
                continue;

              const winnerId = result.winnerTeamIds[0];
              const loserId = result.loserTeamIds[0];
              if (!playerIds.has(winnerId) || !playerIds.has(loserId)) continue;

              const key = pairKey(winnerId, loserId);
              const scoreText = extractScoreText(result.score);

              if (result.confirmed) {
                if (!confirmedByPair.has(key)) {
                  confirmedByPair.set(key, { winnerId, scoreText });
                }
              } else if (!pendingByPair.has(key)) {
                pendingByPair.set(key, { scoreText });
              }
            }

            const getCell = (rowId: string, colId: string) => {
              const key = pairKey(rowId, colId);
              const confirmed = confirmedByPair.get(key);
              if (confirmed) {
                return {
                  status: "confirmed" as const,
                  label: confirmed.winnerId === rowId ? "胜" : "负",
                  scoreText: confirmed.scoreText,
                };
              }

              const pending = pendingByPair.get(key);
              if (pending) {
                return {
                  status: "pending" as const,
                  label: "待确认",
                  scoreText: pending.scoreText,
                };
              }

              return {
                status: "todo" as const,
                label: "未进行",
                scoreText: "",
              };
            };

            return { players, getCell };
          };

          const myGroupMatrix = buildGroupBattleMatrix(groupPlayers);
          const unresolvedOpponentGroup = unresolvedOpponentGroupName
            ? groupingPayload.groups.find(
                (group) => group.name === unresolvedOpponentGroupName,
              )
            : null;
          const unresolvedOpponentGroupMatrix = unresolvedOpponentGroup
            ? buildGroupBattleMatrix(unresolvedOpponentGroup.players)
            : null;

          const completedCount = confirmedGroupMatches;

          return (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-8">
              <h2 className="mb-2 text-xl font-bold text-white">
                我的比赛进程
              </h2>
              <p className="mb-4 text-sm text-slate-400">
                当前进度：已完成 {completedCount}/{totalGroupMatches}{" "}
                场组内对局。每场需由对手或管理员确认后生效并推进进程。
              </p>
              {match.type !== "single" ? (
                <p className="text-sm text-amber-300">
                  当前流程化登记先支持单打。双打/团体请由管理员使用赛果录入接口。
                </p>
              ) : myGroup ? (
                <div className="space-y-6">
                  {!groupCompleted ? (
                    <>
                      <ReportResultForm
                        matchId={match.id}
                        currentUserId={currentUser.id}
                        mode="group"
                        opponents={opponents}
                        pendingResults={pendingResults}
                      />

                      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-slate-100">
                            小组对战表
                          </h3>
                          <p className="text-xs text-slate-400">
                            记分口径：行选手对列选手，比分格式为“行方局数:列方局数”。
                          </p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-130 text-sm">
                            <thead>
                              <tr className="text-left text-slate-400">
                                <th className="min-w-24 px-2 py-2">选手</th>
                                {myGroupMatrix.players.map((player) => (
                                  <th
                                    key={`head-${player.id}`}
                                    className="min-w-24 px-2 py-2 text-center"
                                  >
                                    {player.nickname}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {myGroupMatrix.players.map((rowPlayer) => (
                                <tr
                                  key={`row-${rowPlayer.id}`}
                                  className="border-t border-slate-700/80 text-slate-200"
                                >
                                  <td className="px-2 py-2 font-medium text-slate-100">
                                    {rowPlayer.nickname}
                                  </td>
                                  {myGroupMatrix.players.map((colPlayer) => {
                                    if (rowPlayer.id === colPlayer.id) {
                                      return (
                                        <td
                                          key={`${rowPlayer.id}-${colPlayer.id}`}
                                          className="px-2 py-2"
                                        >
                                          <div className="relative h-12 rounded border border-slate-700/80 bg-[linear-gradient(135deg,transparent_49%,rgba(148,163,184,0.5)_50%,transparent_51%)]" />
                                        </td>
                                      );
                                    }

                                    const cell = myGroupMatrix.getCell(
                                      rowPlayer.id,
                                      colPlayer.id,
                                    );
                                    return (
                                      <td
                                        key={`${rowPlayer.id}-${colPlayer.id}`}
                                        className="px-2 py-2 text-center"
                                      >
                                        <div className="rounded border border-slate-700/80 bg-slate-900/70 px-2 py-1.5">
                                          <p
                                            className={`text-sm font-medium ${
                                              cell.status === "confirmed"
                                                ? cell.label === "胜"
                                                  ? "text-emerald-300"
                                                  : "text-rose-300"
                                                : cell.status === "pending"
                                                  ? "text-amber-300"
                                                  : "text-slate-400"
                                            }`}
                                          >
                                            {cell.label} {cell.scoreText || "-"}
                                          </p>
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-cyan-500/35 bg-cyan-500/5 p-4">
                      <h3 className="mb-3 text-sm font-semibold text-cyan-200">
                        淘汰赛进程
                      </h3>
                      {knockoutState === "ready" && knockoutOpponent ? (
                        <ReportResultForm
                          matchId={match.id}
                          currentUserId={currentUser.id}
                          mode="knockout"
                          knockoutOpponent={knockoutOpponent}
                          pendingResults={pendingResults}
                        />
                      ) : knockoutState === "waiting" ? (
                        <div className="space-y-3">
                          <p className="text-sm text-slate-300">
                            {waitingReason}
                          </p>
                          {unresolvedOpponentGroupMatrix ? (
                            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                              <p className="mb-2 text-xs text-slate-400">
                                对手来源小组：{unresolvedOpponentGroup?.name}
                                （对战表）
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-130 text-sm">
                                  <thead>
                                    <tr className="text-left text-slate-400">
                                      <th className="min-w-24 px-2 py-2">
                                        选手
                                      </th>
                                      {unresolvedOpponentGroupMatrix.players.map(
                                        (player) => (
                                          <th
                                            key={`op-head-${player.id}`}
                                            className="min-w-24 px-2 py-2 text-center"
                                          >
                                            {player.nickname}
                                          </th>
                                        ),
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {unresolvedOpponentGroupMatrix.players.map(
                                      (rowPlayer) => (
                                        <tr
                                          key={`op-row-${rowPlayer.id}`}
                                          className="border-t border-slate-700/80 text-slate-200"
                                        >
                                          <td className="px-2 py-2 font-medium text-slate-100">
                                            {rowPlayer.nickname}
                                          </td>
                                          {unresolvedOpponentGroupMatrix.players.map(
                                            (colPlayer) => {
                                              if (
                                                rowPlayer.id === colPlayer.id
                                              ) {
                                                return (
                                                  <td
                                                    key={`op-${rowPlayer.id}-${colPlayer.id}`}
                                                    className="px-2 py-2"
                                                  >
                                                    <div className="relative h-12 rounded border border-slate-700/80 bg-[linear-gradient(135deg,transparent_49%,rgba(148,163,184,0.5)_50%,transparent_51%)]" />
                                                  </td>
                                                );
                                              }

                                              const cell =
                                                unresolvedOpponentGroupMatrix.getCell(
                                                  rowPlayer.id,
                                                  colPlayer.id,
                                                );
                                              return (
                                                <td
                                                  key={`op-${rowPlayer.id}-${colPlayer.id}`}
                                                  className="px-2 py-2 text-center"
                                                >
                                                  <div className="rounded border border-slate-700/80 bg-slate-900/70 px-2 py-1.5">
                                                    <p
                                                      className={`text-sm font-medium ${
                                                        cell.status ===
                                                        "confirmed"
                                                          ? cell.label === "胜"
                                                            ? "text-emerald-300"
                                                            : "text-rose-300"
                                                          : cell.status ===
                                                              "pending"
                                                            ? "text-amber-300"
                                                            : "text-slate-400"
                                                      }`}
                                                    >
                                                      {cell.label}{" "}
                                                      {cell.scoreText || "-"}
                                                    </p>
                                                  </div>
                                                </td>
                                              );
                                            },
                                          )}
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : knockoutState === "eliminated" ? (
                        <p className="text-sm text-rose-300">{waitingReason}</p>
                      ) : (
                        <p className="text-sm text-emerald-300">
                          你已完成当前淘汰赛轮次，请等待下一轮生成。
                        </p>
                      )}
                    </div>
                  )}

                  {groupCompleted && (
                    <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/5 p-4">
                      <h3 className="mb-3 text-sm font-semibold text-emerald-200">
                        小组排名与晋级
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-130 text-sm">
                          <thead>
                            <tr className="text-left text-slate-300">
                              <th className="px-2 py-2">排名</th>
                              <th className="px-2 py-2">选手</th>
                              <th className="px-2 py-2">胜/负</th>
                              <th className="px-2 py-2">局分</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedStandings.map((item, index) => {
                              const qualified = qualifiedPlayers.some(
                                (q) => q.id === item.id,
                              );
                              return (
                                <tr
                                  key={item.id}
                                  className="border-t border-slate-700/70 text-slate-100"
                                >
                                  <td className="px-2 py-2">#{index + 1}</td>
                                  <td className="px-2 py-2">
                                    {item.nickname}
                                    {qualified ? (
                                      <span className="ml-2 text-xs text-emerald-300">
                                        晋级
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="px-2 py-2">
                                    {item.wins}/{item.losses}
                                  </td>
                                  <td className="px-2 py-2">
                                    {item.setWins}:{item.setLosses}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  你当前不在任何分组中，暂无法登记组内赛果。
                </p>
              )}
            </div>
          );
        })()}

      {isAdmin && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-8">
          {match.type === "single" ? (
            groupingPayload ? (
              <div className="mb-6">
                <AdminResultEntryForm
                  matchId={match.id}
                  players={match.registrations.map((item) => ({
                    id: item.user.id,
                    nickname: item.user.nickname,
                  }))}
                  groupMatchOptions={
                    adminEligibleOptions?.groupMatchOptions ?? []
                  }
                  knockoutMatchOptions={
                    adminEligibleOptions?.knockoutMatchOptions ?? []
                  }
                  groupBattleTables={adminGroupBattleTables}
                  initialPhase={
                    initialAdminPhase === "group" ||
                    initialAdminPhase === "knockout"
                      ? initialAdminPhase
                      : "group"
                  }
                  initialGroupName={initialAdminGroupName}
                  initialRoundName={initialAdminRoundName}
                  initialWinnerId={initialAdminWinnerId}
                  initialLoserId={initialAdminLoserId}
                />
              </div>
            ) : (
              <p className="mb-6 text-sm text-slate-400">
                请先生成并发布分组后，再录入小组/淘汰赛待确认赛果。
              </p>
            )
          ) : (
            <p className="mb-6 text-sm text-slate-400">
              管理员流程化录入目前仅支持单打。
            </p>
          )}

          <h2 className="mb-2 text-xl font-bold text-white">
            管理员待确认赛果
          </h2>
          <p className="mb-4 text-sm text-slate-400">
            可在此查看并确认本比赛全部待确认赛果。
          </p>
          <div className="space-y-3">
            {adminPendingResults.length === 0 ? (
              <p className="text-sm text-slate-400">当前没有待确认赛果。</p>
            ) : (
              adminPendingResults.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-700 bg-slate-800/50 p-3"
                >
                  <p className="text-sm text-slate-200">
                    {item.winnerLabel} 胜 {item.loserLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    登记人：{item.reporterName}
                    {item.phaseLabel === "group" && item.groupName
                      ? ` · 小组 ${item.groupName}`
                      : ""}
                    {item.phaseLabel === "knockout" && item.knockoutRound
                      ? ` · 淘汰赛 ${item.knockoutRound}`
                      : ""}
                    {item.scoreText ? ` · 比分 ${item.scoreText}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <form
                      action={confirmMatchResultVoidAction.bind(
                        null,
                        match.id,
                        item.id,
                      )}
                    >
                      <button
                        type="submit"
                        className="rounded-md border border-emerald-500/40 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                      >
                        管理员确认该结果
                      </button>
                    </form>
                    <form
                      action={rejectMatchResultVoidAction.bind(
                        null,
                        match.id,
                        item.id,
                      )}
                    >
                      <button
                        type="submit"
                        className="rounded-md border border-rose-500/40 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                      >
                        否决
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {canManageGrouping && (
        <GroupingAdminPanel
          matchId={match.id}
          initialPayloadJson={
            groupingPayload
              ? JSON.stringify(groupingPayload)
              : fallbackGroupingPayload
                ? JSON.stringify(fallbackGroupingPayload)
                : undefined
          }
        />
      )}

      {(!groupingPayload ||
        alreadyRegistered ||
        Boolean(groupingPayload?.knockout)) && (
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
              {alreadyRegistered ? (
                myGroup ? (
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
                  <p className="text-slate-400">
                    你已报名，当前尚未分配到小组。
                  </p>
                )
              ) : (
                <p className="text-slate-400">
                  你未报名该比赛，当前不展示你的比赛进程；可查看淘汰赛签表。
                </p>
              )}

              {groupingPayload.knockout && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-cyan-100">
                    {groupingPayload.knockout.stage}（淘汰赛签表）
                  </h3>
                  <p className="text-xs text-slate-400">
                    当前展示为签位示意，待小组赛结束后将按晋级结果填充具体选手。
                  </p>
                  <KnockoutBracket
                    rounds={
                      filledKnockoutRounds ?? groupingPayload.knockout.rounds
                    }
                  />
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
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-lg border border-slate-700 p-3 hover:border-cyan-400/40"
              >
                <span className="w-6 font-mono text-slate-400">
                  {participantsStartIndex + index + 1}
                </span>
                <div className="grid h-10 w-10 place-items-center rounded-full bg-cyan-500/20 text-cyan-100">
                  {item.user.nickname[0]}
                </div>
                <Link href={`/users/${item.user.id}`} className="flex-1">
                  <p className="font-medium text-slate-100">
                    {item.user.nickname}
                  </p>
                  <p className="text-sm text-slate-400">
                    积分 {item.user.points} · ELO {item.user.eloRating}
                  </p>
                </Link>
                {isAdmin && !groupingPayload && match.results.length === 0 ? (
                  <form
                    action={removeRegistrationByManagerVoidAction.bind(
                      null,
                      match.id,
                      item.user.id,
                    )}
                  >
                    <button
                      type="submit"
                      className="rounded-md border border-rose-500/40 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                    >
                      移除
                    </button>
                  </form>
                ) : null}
              </div>
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
