'use server'

import { CompetitionFormat, MatchStatus, MatchType, type Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { generateGroupingPayload } from '@/lib/tournament'
import { settleSinglesElo, settleTeamElo } from '@/lib/elo'

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
  const maxParticipants = Number(formData.get('maxParticipants') ?? 0)

  if (!title || !location || !date || !time || !registrationDeadline) {
    return { error: '请完整填写必填项。' }
  }

  if (!Number.isFinite(maxParticipants) || maxParticipants < 2) {
    return { error: '最大人数至少为 2。' }
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
      maxParticipants,
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

export async function registerMatchAction(matchId: string): Promise<MatchFormState> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录后报名。' }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { _count: { select: { registrations: true } } },
  })

  if (!match) return { error: '比赛不存在。' }
  if (match.status !== MatchStatus.registration) return { error: '当前比赛不在报名阶段。' }
  if (new Date() >= match.registrationDeadline) return { error: '报名已截止。' }
  if (match._count.registrations >= match.maxParticipants) return { error: '名额已满。' }

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
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { _count: { select: { registrations: true } } },
  })
  if (!match) return { error: '比赛不存在。' }
  if (match.createdBy !== currentUser.id) return { error: '仅发起人可修改赛制。' }
  if (new Date() >= match.registrationDeadline) return { error: '报名截止后不可修改赛制。' }

  const format = String(formData.get('format') ?? match.format) as CompetitionFormat
  const deadlineInput = String(formData.get('registrationDeadline') ?? '')
  const maxParticipants = Number(formData.get('maxParticipants') ?? match.maxParticipants)

  if (!Number.isFinite(maxParticipants) || maxParticipants < match._count.registrations) {
    return { error: '人数需 >= 已报名人数。' }
  }

  const nextDeadline = deadlineInput ? new Date(deadlineInput) : match.registrationDeadline
  if (Number.isNaN(nextDeadline.getTime())) return { error: '截止时间格式错误。' }
  if (nextDeadline >= match.dateTime) return { error: '截止时间必须早于比赛开始时间。' }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      format,
      registrationDeadline: nextDeadline,
      maxParticipants,
      groupingGeneratedAt: null,
      status: MatchStatus.registration,
    },
  })
  await prisma.matchGrouping.deleteMany({ where: { matchId } })

  revalidatePath(`/matchs/${matchId}`)
  revalidatePath('/matchs')
  return { success: '赛制设置已更新。' }
}

export async function unregisterMatchAction(matchId: string): Promise<MatchFormState> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return { error: '比赛不存在。' }
  if (new Date() >= match.registrationDeadline) return { error: '报名截止后不可退出。' }

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
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { _count: { select: { registrations: true } } },
  })
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
  const maxParticipants = Number(formData.get('maxParticipants') ?? match.maxParticipants)
  const deadlineInput = String(formData.get('registrationDeadline') ?? '')

  if (!title || !location || !date || !time) return { error: '请完整填写必填项。' }

  if (!Number.isFinite(maxParticipants) || maxParticipants < match._count.registrations) {
    return { error: '人数需 >= 已报名人数。' }
  }

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
      maxParticipants,
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
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const opponentId = String(formData.get('opponentId') ?? '').trim()
  const didWin = String(formData.get('didWin') ?? 'true') === 'true'
  const scoreText = String(formData.get('score') ?? '').trim()

  if (!opponentId || opponentId === currentUser.id) return { error: '请选择有效对手。' }

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
      score: scoreText ? { text: scoreText } : { text: '' },
      reportedBy: currentUser.id,
      confirmed: false,
    },
  })

  revalidatePath(`/matchs/${matchId}`)
  return { success: '已登记，等待对手或管理员确认。' }
}

export async function confirmMatchResultAction(matchId: string, resultId: string): Promise<MatchFormState> {
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


function parseTeamIds(raw: FormDataEntryValue | null) {
  const text = String(raw ?? '').trim()
  return Array.from(new Set(text.split(/[\s,，]+/).map((id) => id.trim()).filter(Boolean)))
}

export async function reportMatchResultAction(matchId: string, _: MatchFormState, formData: FormData): Promise<MatchFormState> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      registrations: {
        select: { userId: true },
      },
    },
  })

  if (!match) return { error: '比赛不存在。' }

  const isManager = currentUser.id === match.createdBy || currentUser.role === 'admin'
  if (!isManager) return { error: '仅发起人或管理员可录入赛果。' }

  const winnerTeamIds = parseTeamIds(formData.get('winnerTeamIds'))
  const loserTeamIds = parseTeamIds(formData.get('loserTeamIds'))
  const scoreText = String(formData.get('score') ?? '').trim()

  if (winnerTeamIds.length === 0 || loserTeamIds.length === 0) {
    return { error: '请填写胜方与负方成员。' }
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

  const score = scoreText ? { text: scoreText } : { text: '' }
  const winnerAnchorId = winnerTeamIds[0] ?? null
  const loserAnchorId = loserTeamIds[0] ?? null

  await prisma.$transaction(async (tx) => {
    await tx.matchResult.create({
      data: {
        matchId,
        winnerId: winnerAnchorId,
        loserId: loserAnchorId,
        winnerTeamIds,
        loserTeamIds,
        score,
        reportedBy: currentUser.id,
        confirmed: true,
        resultVerifiedAt: new Date(),
        verifierId: currentUser.id,
      },
    })

    await applyConfirmedResult(tx, { matchId, winnerTeamIds, loserTeamIds })
  })

  revalidatePath('/rankings')
  revalidatePath(`/matchs/${matchId}`)
  revalidatePath('/profile')

  return { success: '赛果已记录，ELO 已按弹性 K 值更新。' }
}
