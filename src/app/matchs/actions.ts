'use server'

import { CompetitionFormat, MatchStatus, MatchType, type Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { generateGroupingPayload } from '@/lib/tournament'
import { settleSinglesElo, settleTeamElo } from '@/lib/elo'
import { validateCsrfToken } from '@/lib/csrf'
import {
  registerDoublesTeamByUser,
  removeRegisteredDoublesTeamByMember,
  unregisterDoublesTeamByUser,
} from '@/lib/doubles'

const UNLIMITED_MAX_PARTICIPANTS = 2147483647

export type MatchFormState = {
  error?: string
  success?: string
}

export type GroupingAdminState = {
  error?: string
  success?: string
  previewJson?: string
}

function parseDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`)
}

function parseBestOf(raw: FormDataEntryValue | null) {
  const value = Number(raw ?? 0)
  if (![3, 5, 7].includes(value)) return null
  return value as 3 | 5 | 7
}

function validateSingleScore(bestOf: 3 | 5 | 7, myScore: number, opponentScore: number, didWin: boolean) {
  const winsNeeded = Math.floor(bestOf / 2) + 1

  if (!Number.isInteger(myScore) || !Number.isInteger(opponentScore)) {
    return { ok: false as const, error: '比分必须为整数。' }
  }

  if (myScore < 0 || opponentScore < 0 || myScore > winsNeeded || opponentScore > winsNeeded) {
    return { ok: false as const, error: '比分超出可选范围。' }
  }

  if (myScore === winsNeeded && opponentScore === winsNeeded) {
    return { ok: false as const, error: '双方不能同时达到胜场。' }
  }

  if (myScore !== winsNeeded && opponentScore !== winsNeeded) {
    return { ok: false as const, error: `必须有一方达到 ${winsNeeded} 胜。` }
  }

  const myActuallyWon = myScore > opponentScore
  if (myActuallyWon !== didWin) {
    return { ok: false as const, error: '“本场结果”与比分不一致，请检查。' }
  }

  const scoreText = `${myScore}:${opponentScore}（${bestOf}局${winsNeeded}胜）`
  return { ok: true as const, scoreText }
}

function extractWinnerLoserSets(score: unknown) {
  if (typeof score === 'object' && score) {
    const winnerScore = Number((score as { winnerScore?: unknown }).winnerScore)
    const loserScore = Number((score as { loserScore?: unknown }).loserScore)
    if (Number.isFinite(winnerScore) && Number.isFinite(loserScore)) {
      return { winnerScore, loserScore }
    }
  }
  return null
}

function buildGroupStandingsForKnockout(
  players: Array<{ id: string; nickname: string; eloRating: number }>,
  results: Array<{ winnerTeamIds: string[]; loserTeamIds: string[]; confirmed: boolean; score: unknown }>,
) {
  const standings = players.map((player) => ({
    id: player.id,
    nickname: player.nickname,
    wins: 0,
    losses: 0,
    setWins: 0,
    setLosses: 0,
    eloRating: player.eloRating,
  }))

  const byId = new Map(standings.map((item) => [item.id, item]))
  const playerIdSet = new Set(players.map((player) => player.id))

  for (const result of results) {
    if (!result.confirmed) continue
    if (result.winnerTeamIds.length !== 1 || result.loserTeamIds.length !== 1) continue

    const winnerId = result.winnerTeamIds[0]
    const loserId = result.loserTeamIds[0]
    if (!playerIdSet.has(winnerId) || !playerIdSet.has(loserId)) continue

    const winner = byId.get(winnerId)
    const loser = byId.get(loserId)
    if (!winner || !loser) continue

    winner.wins += 1
    loser.losses += 1

    const sets = extractWinnerLoserSets(result.score)
    if (sets) {
      winner.setWins += sets.winnerScore
      winner.setLosses += sets.loserScore
      loser.setWins += sets.loserScore
      loser.setLosses += sets.winnerScore
    }
  }

  return standings.sort((a, b) => {
    const winDiff = b.wins - a.wins
    if (winDiff !== 0) return winDiff
    const setDiff = (b.setWins - b.setLosses) - (a.setWins - a.setLosses)
    if (setDiff !== 0) return setDiff
    const setWinDiff = b.setWins - a.setWins
    if (setWinDiff !== 0) return setWinDiff
    return b.eloRating - a.eloRating
  })
}

function resolveCurrentKnockoutOpponent(params: {
  currentUserId: string
  groupingGeneratedAt: Date | null
  qualifiersPerGroup: number
  groups: Array<{ name: string; players: Array<{ id: string; nickname: string; eloRating: number }> }>
  knockoutRounds: Array<{ matches: Array<{ id: string; homeLabel: string; awayLabel: string }> }>
  results: Array<{ winnerTeamIds: string[]; loserTeamIds: string[]; confirmed: boolean; score: unknown; createdAt: Date; resultVerifiedAt: Date | null }>
}) {
  const {
    currentUserId,
    groupingGeneratedAt,
    qualifiersPerGroup,
    groups,
    knockoutRounds,
    results,
  } = params

  const confirmedSingles = results.filter(
    (result) =>
      result.confirmed &&
      result.winnerTeamIds.length === 1 &&
      result.loserTeamIds.length === 1,
  )

  const qualifierMap = new Map<string, { id: string; nickname: string }>()
  for (const group of groups) {
    const standings = buildGroupStandingsForKnockout(group.players, confirmedSingles)
    const groupPlayerIdSet = new Set(group.players.map((player) => player.id))
    const groupConfirmedCount = confirmedSingles.filter((result) => {
      const winnerId = result.winnerTeamIds[0]
      const loserId = result.loserTeamIds[0]
      return groupPlayerIdSet.has(winnerId) && groupPlayerIdSet.has(loserId)
    }).length
    const totalGroupMatches =
      group.players.length > 1 ? (group.players.length * (group.players.length - 1)) / 2 : 0

    if (!(totalGroupMatches > 0 && groupConfirmedCount >= totalGroupMatches)) continue

    standings.slice(0, Math.min(qualifiersPerGroup, standings.length)).forEach((item, index) => {
      qualifierMap.set(`${group.name}第 ${index + 1} 名`, { id: item.id, nickname: item.nickname })
    })
  }

  const winnerByMatchId = new Map<string, { id: string; nickname: string }>()

  const getHeadToHeadResult = (idA: string, idB: string) => {
    const candidates = confirmedSingles.filter(
      (result) =>
        (!groupingGeneratedAt || result.createdAt >= groupingGeneratedAt) &&
        ((result.winnerTeamIds[0] === idA && result.loserTeamIds[0] === idB) ||
          (result.winnerTeamIds[0] === idB && result.loserTeamIds[0] === idA)),
    )

    if (candidates.length === 0) return null
    return [...candidates].sort((a, b) => {
      const ta = (a.resultVerifiedAt ?? a.createdAt).getTime()
      const tb = (b.resultVerifiedAt ?? b.createdAt).getTime()
      return tb - ta
    })[0]
  }

  const resolveLabel = (label: string) => {
    const qualifier = qualifierMap.get(label)
    if (qualifier) return { id: qualifier.id, nickname: qualifier.nickname }
    const winnerRef = label.match(/^胜者\s+(.+)$/)
    if (winnerRef) return winnerByMatchId.get(winnerRef[1]) ?? null
    return null
  }

  for (const round of knockoutRounds) {
    for (const match of round.matches) {
      const home = resolveLabel(match.homeLabel)
      const away = resolveLabel(match.awayLabel)

      if (home && away) {
        const result = getHeadToHeadResult(home.id, away.id)
        if (result) {
          const winnerId = result.winnerTeamIds[0]
          winnerByMatchId.set(match.id, winnerId === home.id ? home : away)
          continue
        }

        if (home.id === currentUserId) return away.id
        if (away.id === currentUserId) return home.id
      }
    }
  }

  return null
}

function resolveFilledKnockoutRoundsForValidation(params: {
  groupingGeneratedAt: Date | null
  qualifiersPerGroup: number
  groups: Array<{ name: string; players: Array<{ id: string; nickname: string; eloRating: number }> }>
  knockoutRounds: Array<{ name: string; matches: Array<{ id: string; homeLabel: string; awayLabel: string }> }>
  results: Array<{ winnerTeamIds: string[]; loserTeamIds: string[]; confirmed: boolean; score: unknown; createdAt: Date; resultVerifiedAt: Date | null }>
}) {
  const {
    groupingGeneratedAt,
    qualifiersPerGroup,
    groups,
    knockoutRounds,
    results,
  } = params

  const confirmedSingles = results.filter(
    (result) =>
      result.confirmed &&
      result.winnerTeamIds.length === 1 &&
      result.loserTeamIds.length === 1,
  )

  const qualifierMap = new Map<string, { id: string; nickname: string }>()
  for (const group of groups) {
    const standings = buildGroupStandingsForKnockout(group.players, confirmedSingles)
    const groupPlayerIdSet = new Set(group.players.map((player) => player.id))
    const groupConfirmedCount = confirmedSingles.filter((result) => {
      const winnerId = result.winnerTeamIds[0]
      const loserId = result.loserTeamIds[0]
      return groupPlayerIdSet.has(winnerId) && groupPlayerIdSet.has(loserId)
    }).length
    const totalGroupMatches = group.players.length > 1 ? (group.players.length * (group.players.length - 1)) / 2 : 0
    const groupCompleted = totalGroupMatches > 0 && groupConfirmedCount >= totalGroupMatches
    if (!groupCompleted) continue

    standings
      .slice(0, Math.min(qualifiersPerGroup, standings.length))
      .forEach((item, index) => {
        qualifierMap.set(`${group.name}第 ${index + 1} 名`, {
          id: item.id,
          nickname: item.nickname,
        })
      })
  }

  const winnerByMatchId = new Map<string, { id: string; nickname: string }>()

  const getHeadToHeadResult = (idA: string, idB: string) => {
    const candidates = confirmedSingles.filter(
      (result) =>
        (!groupingGeneratedAt || result.createdAt >= groupingGeneratedAt) &&
        ((result.winnerTeamIds[0] === idA && result.loserTeamIds[0] === idB) ||
          (result.winnerTeamIds[0] === idB && result.loserTeamIds[0] === idA)),
    )

    if (candidates.length === 0) return null

    return [...candidates].sort((a, b) => {
      const ta = (a.resultVerifiedAt ?? a.createdAt).getTime()
      const tb = (b.resultVerifiedAt ?? b.createdAt).getTime()
      return tb - ta
    })[0]
  }

  const resolveLabel = (label: string) => {
    const qualifier = qualifierMap.get(label)
    if (qualifier) {
      return { id: qualifier.id, nickname: qualifier.nickname }
    }

    const winnerRef = label.match(/^胜者\s+(.+)$/)
    if (winnerRef) {
      return winnerByMatchId.get(winnerRef[1]) ?? null
    }

    return null
  }

  return knockoutRounds.map((round) => ({
    name: round.name,
    matches: round.matches.map((match) => {
      const home = resolveLabel(match.homeLabel)
      const away = resolveLabel(match.awayLabel)

      if (home && away) {
        const result = getHeadToHeadResult(home.id, away.id)
        if (result) {
          const winnerId = result.winnerTeamIds[0]
          winnerByMatchId.set(match.id, winnerId === home.id ? home : away)
          return {
            id: match.id,
            homePlayerId: home.id,
            awayPlayerId: away.id,
            decided: true,
          }
        }

        return {
          id: match.id,
          homePlayerId: home.id,
          awayPlayerId: away.id,
          decided: false,
        }
      }

      return {
        id: match.id,
        homePlayerId: null,
        awayPlayerId: null,
        decided: false,
      }
    }),
  }))
}

function canManageGrouping(currentUser: Awaited<ReturnType<typeof getCurrentUser>>, createdBy: string) {
  if (!currentUser) return false
  return currentUser.id === createdBy || currentUser.role === 'admin'
}


async function applyConfirmedResult(tx: Prisma.TransactionClient, payload: {
  matchId: string
  winnerTeamIds: string[]
  loserTeamIds: string[]
}) {
  const allParticipantIds = [...payload.winnerTeamIds, ...payload.loserTeamIds]
  const users = await tx.user.findMany({
    where: { id: { in: allParticipantIds } },
    select: { id: true, eloRating: true, matchesPlayed: true, wins: true, losses: true },
  })

  if (users.length !== allParticipantIds.length) {
    throw new Error('存在无效选手，无法结算 ELO。')
  }

  const userMap = new Map(users.map((u) => [u.id, u]))
  const winnerTeam = payload.winnerTeamIds.map((id) => ({ userId: id, eloRating: userMap.get(id)!.eloRating, matchesPlayed: userMap.get(id)!.matchesPlayed }))
  const loserTeam = payload.loserTeamIds.map((id) => ({ userId: id, eloRating: userMap.get(id)!.eloRating, matchesPlayed: userMap.get(id)!.matchesPlayed }))

  const deltas = winnerTeam.length === 1 && loserTeam.length === 1
    ? settleSinglesElo(winnerTeam[0], loserTeam[0])
    : settleTeamElo(winnerTeam, loserTeam)

  for (const delta of deltas) {
    const base = userMap.get(delta.userId)
    if (!base) continue

    await tx.user.update({
      where: { id: delta.userId },
      data: {
        eloRating: delta.after,
        matchesPlayed: base.matchesPlayed + 1,
        wins: payload.winnerTeamIds.includes(delta.userId) ? base.wins + 1 : base.wins,
        losses: payload.loserTeamIds.includes(delta.userId) ? base.losses + 1 : base.losses,
      },
    })

    await tx.eloHistory.create({
      data: {
        userId: delta.userId,
        matchId: payload.matchId,
        eloBefore: delta.before,
        eloAfter: delta.after,
        delta: delta.delta,
      },
    })
  }
}

export async function createMatchAction(_: MatchFormState, formData: FormData): Promise<MatchFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录后再发布比赛。' }

  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const location = String(formData.get('location') ?? '').trim()
  const date = String(formData.get('date') ?? '')
  const time = String(formData.get('time') ?? '')
  const registrationDeadline = String(formData.get('registrationDeadline') ?? '')
  const type = String(formData.get('type') ?? 'single') as MatchType
  const format = String(formData.get('format') ?? 'group_only') as CompetitionFormat

  if (!title || !location || !date || !time || !registrationDeadline) {
    return { error: '请完整填写必填项。' }
  }

  const matchDate = parseDateTime(date, time)
  const deadline = new Date(registrationDeadline)

  if (Number.isNaN(matchDate.getTime()) || Number.isNaN(deadline.getTime())) {
    return { error: '时间格式无效。' }
  }

  if (deadline >= matchDate) {
    return { error: '报名截止时间必须早于比赛开始时间。' }
  }

  const created = await prisma.match.create({
    data: {
      title,
      description: description || null,
      dateTime: matchDate,
      registrationDeadline: deadline,
      location,
      type,
      format,
      maxParticipants: UNLIMITED_MAX_PARTICIPANTS,
      status: MatchStatus.registration,
      createdBy: currentUser.id,
      rule: {
        note: format === 'group_only' ? '分组循环赛' : '先分组后淘汰赛',
      },
    },
  })

  await prisma.registration.deleteMany({ where: { matchId: created.id, userId: currentUser.id } })

  revalidatePath('/matchs')
  redirect(`/matchs/${created.id}`)
}

export async function registerMatchAction(matchId: string, _: MatchFormState, formData: FormData): Promise<MatchFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录后报名。' }

  const match = await prisma.match.findUnique({ where: { id: matchId } })

  if (!match) return { error: '比赛不存在。' }
  if (match.status !== MatchStatus.registration) return { error: '当前比赛不在报名阶段。' }
  if (new Date() >= match.registrationDeadline) return { error: '报名已截止。' }

  if (match.type === 'double') {
    const result = await registerDoublesTeamByUser(matchId, currentUser.id)
    if (!result.ok) return { error: result.error }

    revalidatePath('/matchs')
    revalidatePath('/team-invites')
    revalidatePath(`/matchs/${matchId}`)
    return { success: '双打小队报名成功！' }
  }

  try {
    await prisma.registration.create({
      data: { matchId, userId: currentUser.id },
    })
  } catch {
    return { error: '你已报名该比赛。' }
  }

  revalidatePath('/matchs')
  revalidatePath(`/matchs/${matchId}`)
  return { success: '报名成功！' }
}

export async function updateMatchFormatAction(matchId: string, _: MatchFormState, formData: FormData): Promise<MatchFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return { error: '比赛不存在。' }
  if (match.createdBy !== currentUser.id) return { error: '仅发起人可修改赛制。' }
  if (new Date() >= match.registrationDeadline) return { error: '报名截止后不可修改赛制。' }

  const format = String(formData.get('format') ?? match.format) as CompetitionFormat
  const deadlineInput = String(formData.get('registrationDeadline') ?? '')

  const nextDeadline = deadlineInput ? new Date(deadlineInput) : match.registrationDeadline
  if (Number.isNaN(nextDeadline.getTime())) return { error: '截止时间格式错误。' }
  if (nextDeadline >= match.dateTime) return { error: '截止时间必须早于比赛开始时间。' }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      format,
      registrationDeadline: nextDeadline,
      groupingGeneratedAt: null,
      status: MatchStatus.registration,
    },
  })
  await prisma.matchGrouping.deleteMany({ where: { matchId } })

  revalidatePath(`/matchs/${matchId}`)
  revalidatePath('/matchs')
  return { success: '赛制设置已更新。' }
}

export async function unregisterMatchAction(matchId: string, _: MatchFormState, formData: FormData): Promise<MatchFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return { error: '比赛不存在。' }
  if (new Date() >= match.registrationDeadline) return { error: '报名截止后不可退出。' }

  if (match.type === 'double') {
    const result = await unregisterDoublesTeamByUser(matchId, currentUser.id)
    if (!result.ok) return { error: result.error }

    revalidatePath('/team-invites')
    revalidatePath('/matchs')
    revalidatePath(`/matchs/${matchId}`)
    return { success: '已退出双打小队报名。' }
  }

  const deleted = await prisma.registration.deleteMany({
    where: { matchId, userId: currentUser.id },
  })

  if (deleted.count === 0) {
    return { error: '你尚未报名该比赛。' }
  }

  revalidatePath('/matchs')
  revalidatePath(`/matchs/${matchId}`)
  return { success: '已退出报名。' }
}

export async function updateMatchAction(matchId: string, _: MatchFormState, formData: FormData): Promise<MatchFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return { error: '比赛不存在。' }
  if (match.createdBy !== currentUser.id) return { error: '仅发起人可修改比赛。' }
  if (new Date() >= match.registrationDeadline) return { error: '报名截止后不可修改。' }

  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const location = String(formData.get('location') ?? '').trim()
  const date = String(formData.get('date') ?? '')
  const time = String(formData.get('time') ?? '')
  const type = String(formData.get('type') ?? 'single') as MatchType
  const format = String(formData.get('format') ?? match.format) as CompetitionFormat
  const deadlineInput = String(formData.get('registrationDeadline') ?? '')

  if (!title || !location || !date || !time) return { error: '请完整填写必填项。' }

  const matchDate = parseDateTime(date, time)
  if (Number.isNaN(matchDate.getTime())) return { error: '比赛时间格式无效。' }

  const deadline = deadlineInput ? new Date(deadlineInput) : match.registrationDeadline
  if (Number.isNaN(deadline.getTime())) return { error: '截止时间格式错误。' }
  if (deadline >= matchDate) return { error: '截止时间必须早于比赛开始时间。' }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      title,
      description: description || null,
      location,
      dateTime: matchDate,
      type,
      format,
      registrationDeadline: deadline,
      groupingGeneratedAt: null,
      status: MatchStatus.registration,
      rule: {
        note: format === 'group_only' ? '分组循环赛' : '先分组后淘汰赛',
      },
    },
  })

  await prisma.matchGrouping.deleteMany({ where: { matchId } })

  revalidatePath('/matchs')
  revalidatePath(`/matchs/${matchId}`)
  redirect(`/matchs/${matchId}`)
}

export async function previewGroupingAction(matchId: string, _: GroupingAdminState, formData: FormData): Promise<GroupingAdminState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      registrations: {
        include: {
          user: {
            select: { id: true, nickname: true, points: true, eloRating: true },
          },
        },
      },
    },
  })

  if (!match) return { error: '比赛不存在。' }
  if (!canManageGrouping(currentUser, match.createdBy)) return { error: '仅发起人或管理员可生成分组。' }
  if (new Date() < match.registrationDeadline) return { error: '报名截止后才可生成分组。' }

  const groupCount = Number(formData.get('groupCount') ?? 0)
  const qualifiersPerGroup = Number(formData.get('qualifiersPerGroup') ?? 1)
  const participants = match.registrations.map((r) => r.user)

  if (participants.length < 2) return { error: '报名人数不足，无法分组。' }
  if (!Number.isFinite(groupCount) || groupCount < 1) return { error: '组数必须为正整数。' }
  if (groupCount > participants.length) return { error: '组数不能超过报名人数。' }

  try {
    const payload = generateGroupingPayload(match.format, participants, {
      groupCount,
      qualifiersPerGroup: match.format === 'group_then_knockout' ? qualifiersPerGroup : undefined,
    })

    return {
      success: '已生成分组预览，请确认发布。',
      previewJson: JSON.stringify(payload),
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : '生成分组失败。' }
  }
}

export async function confirmGroupingAction(matchId: string, _: GroupingAdminState, formData: FormData): Promise<GroupingAdminState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  const previewJson = String(formData.get('previewJson') ?? '')

  if (!previewJson) return { error: '请先生成分组预览。' }

  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { groupingResult: true } })
  if (!match) return { error: '比赛不存在。' }
  if (!canManageGrouping(currentUser, match.createdBy)) return { error: '仅发起人或管理员可确认分组。' }
  if (new Date() < match.registrationDeadline) return { error: '报名截止后才可确认分组。' }

  let payload: unknown
  try {
    payload = JSON.parse(previewJson)
  } catch {
    return { error: '预览数据无效，请重新生成。' }
  }

  await prisma.$transaction([
    prisma.matchGrouping.upsert({
      where: { matchId },
      create: { matchId, payload: payload as object },
      update: { payload: payload as object, createdAt: new Date() },
    }),
    prisma.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.ongoing, groupingGeneratedAt: new Date() },
    }),
  ])

  revalidatePath('/matchs')
  revalidatePath(`/matchs/${matchId}`)

  return { success: '分组结果已确认并发布到所有用户页面。' }
}


export async function submitGroupMatchResultAction(matchId: string, _: MatchFormState, formData: FormData): Promise<MatchFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const opponentId = String(formData.get('opponentId') ?? '').trim()
  const didWin = String(formData.get('didWin') ?? 'true') === 'true'
  const bestOf = parseBestOf(formData.get('bestOf'))
  const myScore = Number(formData.get('myScore') ?? -1)
  const opponentScore = Number(formData.get('opponentScore') ?? -1)

  if (!opponentId || opponentId === currentUser.id) return { error: '请选择有效对手。' }
  if (!bestOf) return { error: '请选择合法的局制（3/5/7局）。' }

  const scoreValidation = validateSingleScore(bestOf, myScore, opponentScore, didWin)
  if (!scoreValidation.ok) return { error: scoreValidation.error }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      registrations: { select: { userId: true } },
      groupingResult: true,
    },
  })

  if (!match) return { error: '比赛不存在。' }
  if (match.type !== 'single') return { error: '当前仅支持单打在站内流程化登记。' }
  if (!match.groupingResult) return { error: '尚未生成分组，无法登记结果。' }

  const registrationSet = new Set(match.registrations.map((r) => r.userId))
  if (!registrationSet.has(currentUser.id) || !registrationSet.has(opponentId)) {
    return { error: '你或对手未报名该比赛。' }
  }

  const payload = match.groupingResult.payload as { groups?: Array<{ players: Array<{ id: string }> }> }
  const inSameGroup = Boolean(payload.groups?.some((g) => {
    const ids = g.players.map((p) => p.id)
    return ids.includes(currentUser.id) && ids.includes(opponentId)
  }))
  if (!inSameGroup) return { error: '当前阶段只能登记与你同组对手的比赛。' }

  const exists = await prisma.matchResult.findFirst({
    where: {
      matchId,
      confirmed: false,
      OR: [
        { winnerTeamIds: { equals: [currentUser.id] }, loserTeamIds: { equals: [opponentId] } },
        { winnerTeamIds: { equals: [opponentId] }, loserTeamIds: { equals: [currentUser.id] } },
      ],
    },
  })
  if (exists) return { error: '该对局已有待确认登记。' }

  const winnerTeamIds = didWin ? [currentUser.id] : [opponentId]
  const loserTeamIds = didWin ? [opponentId] : [currentUser.id]

  await prisma.matchResult.create({
    data: {
      matchId,
      winnerId: winnerTeamIds[0],
      loserId: loserTeamIds[0],
      winnerTeamIds,
      loserTeamIds,
      score: {
        text: scoreValidation.scoreText,
        bestOf,
        myScore,
        opponentScore,
        winnerScore: didWin ? myScore : opponentScore,
        loserScore: didWin ? opponentScore : myScore,
      },
      reportedBy: currentUser.id,
      confirmed: false,
    },
  })

  revalidatePath(`/matchs/${matchId}`)
  return { success: '已登记，等待对手或管理员确认。' }
}

export async function submitKnockoutMatchResultAction(matchId: string, _: MatchFormState, formData: FormData): Promise<MatchFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const opponentId = String(formData.get('opponentId') ?? '').trim()
  const didWin = String(formData.get('didWin') ?? 'true') === 'true'
  const bestOf = parseBestOf(formData.get('bestOf'))
  const myScore = Number(formData.get('myScore') ?? -1)
  const opponentScore = Number(formData.get('opponentScore') ?? -1)

  if (!opponentId || opponentId === currentUser.id) return { error: '请选择有效对手。' }
  if (!bestOf) return { error: '请选择合法的局制（3/5/7局）。' }

  const scoreValidation = validateSingleScore(bestOf, myScore, opponentScore, didWin)
  if (!scoreValidation.ok) return { error: scoreValidation.error }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      registrations: { select: { userId: true } },
      groupingResult: true,
      results: {
        select: {
          winnerTeamIds: true,
          loserTeamIds: true,
          confirmed: true,
          score: true,
          createdAt: true,
          resultVerifiedAt: true,
        },
      },
    },
  })

  if (!match) return { error: '比赛不存在。' }
  if (match.type !== 'single') return { error: '当前仅支持单打在站内流程化登记。' }
  if (!match.groupingResult) return { error: '尚未生成分组，无法登记淘汰赛结果。' }

  const registrationSet = new Set(match.registrations.map((r) => r.userId))
  if (!registrationSet.has(currentUser.id) || !registrationSet.has(opponentId)) {
    return { error: '你或对手未报名该比赛。' }
  }

  const payload = match.groupingResult.payload as {
    config?: { qualifiersPerGroup?: number }
    groups?: Array<{ name: string; players: Array<{ id: string; nickname: string; eloRating: number }> }>
    knockout?: { rounds: Array<{ matches: Array<{ id: string; homeLabel: string; awayLabel: string }> }> }
  }

  if (!payload.groups || !payload.knockout) {
    return { error: '当前未配置淘汰赛签表。' }
  }

  const expectedOpponentId = resolveCurrentKnockoutOpponent({
    currentUserId: currentUser.id,
    groupingGeneratedAt: match.groupingGeneratedAt ?? null,
    qualifiersPerGroup: payload.config?.qualifiersPerGroup ?? 1,
    groups: payload.groups,
    knockoutRounds: payload.knockout.rounds,
    results: match.results,
  })

  if (!expectedOpponentId) {
    return { error: '当前你的淘汰赛对手尚未产生或本轮已结束。' }
  }

  if (expectedOpponentId !== opponentId) {
    return { error: '当前仅可登记你本轮已产生对手的淘汰赛结果。' }
  }

  const exists = await prisma.matchResult.findFirst({
    where: {
      matchId,
      confirmed: false,
      OR: [
        { winnerTeamIds: { equals: [currentUser.id] }, loserTeamIds: { equals: [opponentId] } },
        { winnerTeamIds: { equals: [opponentId] }, loserTeamIds: { equals: [currentUser.id] } },
      ],
    },
  })
  if (exists) return { error: '该对局已有待确认登记。' }

  const winnerTeamIds = didWin ? [currentUser.id] : [opponentId]
  const loserTeamIds = didWin ? [opponentId] : [currentUser.id]

  await prisma.matchResult.create({
    data: {
      matchId,
      winnerId: winnerTeamIds[0],
      loserId: loserTeamIds[0],
      winnerTeamIds,
      loserTeamIds,
      score: {
        text: scoreValidation.scoreText,
        bestOf,
        myScore,
        opponentScore,
        winnerScore: didWin ? myScore : opponentScore,
        loserScore: didWin ? opponentScore : myScore,
      },
      reportedBy: currentUser.id,
      confirmed: false,
    },
  })

  revalidatePath(`/matchs/${matchId}`)
  return { success: '已登记淘汰赛结果，等待对手或管理员确认。' }
}

export async function confirmMatchResultAction(matchId: string, resultId: string, formData: FormData): Promise<MatchFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const result = await prisma.matchResult.findUnique({
    where: { id: resultId },
    include: { match: true },
  })

  if (!result || result.matchId !== matchId) return { error: '赛果不存在。' }
  if (result.confirmed) return { success: '该赛果已确认。' }

  const isOpponent = result.winnerTeamIds.includes(currentUser.id) || result.loserTeamIds.includes(currentUser.id)
  const isManager = result.match.createdBy === currentUser.id || currentUser.role === 'admin'
  if (!isOpponent && !isManager) return { error: '仅对阵双方或管理员可确认。' }
  if (result.reportedBy === currentUser.id && !isManager) return { error: '登记方需由对手确认，或由管理员确认。' }

  try {
    await prisma.$transaction(async (tx) => {
      const latest = await tx.matchResult.findUnique({ where: { id: resultId } })
      if (!latest) throw new Error('赛果不存在。')
      if (latest.confirmed) return

      await applyConfirmedResult(tx, {
        matchId,
        winnerTeamIds: latest.winnerTeamIds,
        loserTeamIds: latest.loserTeamIds,
      })

      await tx.matchResult.update({
        where: { id: resultId },
        data: {
          confirmed: true,
          resultVerifiedAt: new Date(),
          verifierId: currentUser.id,
        },
      })
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : '确认失败。' }
  }

  revalidatePath('/rankings')
  revalidatePath('/profile')
  revalidatePath(`/matchs/${matchId}`)
  return { success: '确认成功，结果已生效并更新积分。' }
}

export async function confirmMatchResultVoidAction(matchId: string, resultId: string, formData: FormData): Promise<void> {
  await confirmMatchResultAction(matchId, resultId, formData)
}

export async function removeRegistrationByManagerAction(matchId: string, userId: string, formData: FormData): Promise<MatchFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      groupingResult: true,
      registrations: {
        where: { userId },
        select: { id: true },
      },
      results: {
        where: {
          OR: [
            { winnerTeamIds: { has: userId } },
            { loserTeamIds: { has: userId } },
          ],
        },
        select: { id: true },
      },
    },
  })

  if (!match) return { error: '比赛不存在。' }

  const isManager = currentUser.id === match.createdBy || currentUser.role === 'admin'
  if (!isManager) return { error: '仅发起人或管理员可移除参赛者。' }

  if (match.registrations.length === 0) {
    return { error: '该用户不在参赛名单中。' }
  }

  if (match.groupingResult) {
    return { error: '已生成分组后不可移除参赛者。' }
  }

  if (match.results.length > 0) {
    return { error: '该选手已有赛果记录，不可移除。' }
  }

  if (match.type === 'double') {
    const removeResult = await removeRegisteredDoublesTeamByMember(matchId, userId)
    if (!removeResult.ok) {
      return { error: removeResult.error }
    }

    revalidatePath('/matchs')
    revalidatePath('/team-invites')
    revalidatePath(`/matchs/${matchId}`)
    return { success: '已移除该双打小队。' }
  }

  await prisma.registration.deleteMany({ where: { matchId, userId } })

  revalidatePath('/matchs')
  revalidatePath(`/matchs/${matchId}`)
  return { success: '已移除该参赛者。' }
}

export async function removeRegistrationByManagerVoidAction(matchId: string, userId: string, formData: FormData): Promise<void> {
  await removeRegistrationByManagerAction(matchId, userId, formData)
}

export async function rejectMatchResultAction(matchId: string, resultId: string, formData: FormData): Promise<MatchFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const result = await prisma.matchResult.findUnique({
    where: { id: resultId },
    include: { match: true },
  })

  if (!result || result.matchId !== matchId) return { error: '赛果不存在。' }
  if (result.confirmed) return { error: '已确认赛果不可否决。' }

  const isManager = result.match.createdBy === currentUser.id || currentUser.role === 'admin'
  if (!isManager) return { error: '仅发起人或管理员可否决。' }

  await prisma.matchResult.delete({ where: { id: resultId } })

  revalidatePath(`/matchs/${matchId}`)
  return { success: '已否决并移除该待确认赛果。' }
}

export async function rejectMatchResultVoidAction(matchId: string, resultId: string, formData: FormData): Promise<void> {
  await rejectMatchResultAction(matchId, resultId, formData)
}


function parseTeamIds(raw: FormDataEntryValue | null) {
  const text = String(raw ?? '').trim()
  return Array.from(new Set(text.split(/[\s,，]+/).map((id) => id.trim()).filter(Boolean)))
}

export async function reportMatchResultAction(matchId: string, _: MatchFormState, formData: FormData): Promise<MatchFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      registrations: {
        select: { userId: true },
      },
      groupingResult: true,
      results: {
        select: {
          winnerTeamIds: true,
          loserTeamIds: true,
          confirmed: true,
          score: true,
          createdAt: true,
          resultVerifiedAt: true,
        },
      },
    },
  })

  if (!match) return { error: '比赛不存在。' }

  const isManager = currentUser.id === match.createdBy || currentUser.role === 'admin'
  if (!isManager) return { error: '仅发起人或管理员可录入赛果。' }

  const phase = String(formData.get('phase') ?? 'group')
  const groupName = String(formData.get('groupName') ?? '').trim()
  const knockoutRound = String(formData.get('knockoutRound') ?? '').trim()
  const winnerTeamIds = parseTeamIds(formData.get('winnerTeamIds'))
  const loserTeamIds = parseTeamIds(formData.get('loserTeamIds'))
  const bestOf = parseBestOf(formData.get('bestOf'))
  const loserScore = Number(formData.get('loserScore') ?? -1)

  if (winnerTeamIds.length === 0 || loserTeamIds.length === 0) {
    return { error: '请填写胜方与负方成员。' }
  }

  if (!bestOf) return { error: '请选择合法的局制（3/5/7局）。' }

  const winsNeeded = Math.floor(bestOf / 2) + 1
  if (!Number.isInteger(loserScore) || loserScore < 0 || loserScore >= winsNeeded) {
    return { error: '负方局分不合法。' }
  }

  const idSet = new Set([...winnerTeamIds, ...loserTeamIds])
  if (idSet.size !== winnerTeamIds.length + loserTeamIds.length) {
    return { error: '同一名选手不能同时出现在胜负双方。' }
  }

  if (match.type === 'single' && (winnerTeamIds.length !== 1 || loserTeamIds.length !== 1)) {
    return { error: '单打赛果必须是一对一。' }
  }

  if (match.type === 'double' && (winnerTeamIds.length !== 2 || loserTeamIds.length !== 2)) {
    return { error: '双打赛果必须是 2v2。' }
  }

  const registrationSet = new Set(match.registrations.map((r) => r.userId))
  const allParticipantIds = [...winnerTeamIds, ...loserTeamIds]
  if (allParticipantIds.some((id) => !registrationSet.has(id))) {
    return { error: '赛果中存在未报名选手。' }
  }

  const users = await prisma.user.findMany({
    where: { id: { in: allParticipantIds } },
    select: { id: true },
  })

  if (users.length !== allParticipantIds.length) {
    return { error: '存在无效选手 ID，请检查后重试。' }
  }

  if (!match.groupingResult) {
    return { error: '尚未生成分组，无法按阶段录入赛果。' }
  }

  const payload = match.groupingResult.payload as {
    config?: { qualifiersPerGroup?: number }
    groups?: Array<{ name: string; players: Array<{ id: string; nickname?: string; eloRating?: number }> }>
    knockout?: { rounds: Array<{ name: string; matches: Array<{ id: string; homeLabel: string; awayLabel: string }> }> }
  }

  if (phase === 'group') {
    if (!groupName) return { error: '请选择小组。' }
    const selectedGroup = payload.groups?.find((group) => group.name === groupName)
    if (!selectedGroup) return { error: '所选小组不存在。' }

    const selectedIds = new Set(selectedGroup.players.map((player) => player.id))
    if (![...winnerTeamIds, ...loserTeamIds].every((id) => selectedIds.has(id))) {
      return { error: '小组赛录入时，双方选手必须都属于所选小组。' }
    }

    const [winnerId] = winnerTeamIds
    const [loserId] = loserTeamIds
    const pairExists = match.results.some((result) =>
      result.winnerTeamIds.length === 1 &&
      result.loserTeamIds.length === 1 &&
      ((result.winnerTeamIds[0] === winnerId && result.loserTeamIds[0] === loserId) ||
        (result.winnerTeamIds[0] === loserId && result.loserTeamIds[0] === winnerId)),
    )
    if (pairExists) {
      return { error: '该小组对局已有赛果（待确认或已确认），不可重复录入。' }
    }
  } else if (phase === 'knockout') {
    if (!knockoutRound) return { error: '请选择淘汰赛轮次。' }
    const roundExists = payload.knockout?.rounds.some((round) => round.name === knockoutRound)
    if (!roundExists) return { error: '所选淘汰赛轮次不存在。' }

    if (!payload.groups || !payload.knockout) return { error: '当前未配置淘汰赛结构。' }

    const resolvedRounds = resolveFilledKnockoutRoundsForValidation({
      groupingGeneratedAt: match.groupingGeneratedAt ?? null,
      qualifiersPerGroup: payload.config?.qualifiersPerGroup ?? 1,
      groups: payload.groups.map((group) => ({
        name: group.name,
        players: group.players.map((player) => ({
          id: player.id,
          nickname: player.nickname ?? player.id,
          eloRating: player.eloRating ?? 0,
        })),
      })),
      knockoutRounds: payload.knockout.rounds,
      results: match.results,
    })

    const targetRound = resolvedRounds.find((round) => round.name === knockoutRound)
    if (!targetRound) return { error: '所选淘汰赛轮次不存在。' }

    const [winnerId] = winnerTeamIds
    const [loserId] = loserTeamIds

    const hasEligibleMatchInRound = targetRound.matches.some((item) =>
      item.homePlayerId &&
      item.awayPlayerId &&
      !item.decided &&
      ((item.homePlayerId === winnerId && item.awayPlayerId === loserId) ||
        (item.homePlayerId === loserId && item.awayPlayerId === winnerId)),
    )

    if (!hasEligibleMatchInRound) {
      return { error: '当前轮次仅允许录入已出现对手且尚未完成的对局。' }
    }

    const pairExists = match.results.some((result) =>
      result.winnerTeamIds.length === 1 &&
      result.loserTeamIds.length === 1 &&
      (!match.groupingGeneratedAt || result.createdAt >= match.groupingGeneratedAt) &&
      ((result.winnerTeamIds[0] === winnerId && result.loserTeamIds[0] === loserId) ||
        (result.winnerTeamIds[0] === loserId && result.loserTeamIds[0] === winnerId)),
    )

    if (pairExists) {
      return { error: '该淘汰赛对局已有赛果（待确认或已确认），不可重复录入。' }
    }
  } else {
    return { error: '无效阶段类型。' }
  }

  const scoreText = `${winsNeeded}:${loserScore}（${bestOf}局${winsNeeded}胜）`
  const score = {
    text: scoreText,
    bestOf,
    winnerScore: winsNeeded,
    loserScore,
    phase,
    groupName: phase === 'group' ? groupName : undefined,
    knockoutRound: phase === 'knockout' ? knockoutRound : undefined,
    adminSubmitted: true,
  }
  const winnerAnchorId = winnerTeamIds[0] ?? null
  const loserAnchorId = loserTeamIds[0] ?? null

  const exists = await prisma.matchResult.findFirst({
    where: {
      matchId,
      confirmed: false,
      OR: [
        { winnerTeamIds: { equals: winnerTeamIds }, loserTeamIds: { equals: loserTeamIds } },
        { winnerTeamIds: { equals: loserTeamIds }, loserTeamIds: { equals: winnerTeamIds } },
      ],
    },
  })

  if (exists) return { error: '该对局已有待确认赛果。' }

  await prisma.matchResult.create({
    data: {
      matchId,
      winnerId: winnerAnchorId,
      loserId: loserAnchorId,
      winnerTeamIds,
      loserTeamIds,
      score,
      reportedBy: currentUser.id,
      confirmed: false,
    },
  })

  revalidatePath(`/matchs/${matchId}`)
  revalidatePath('/rankings')
  revalidatePath('/profile')

  return { success: '管理员录入成功，已进入待确认列表。' }
}
