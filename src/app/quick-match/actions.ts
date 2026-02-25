'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { validateCsrfToken } from '@/lib/csrf'

export type QuickMatchFormState = {
  error?: string
  success?: string
}

const QUICK_MATCH_TITLE_PREFIX = '[快速比赛]'
const QUICK_MATCH_TIMEOUT_MS = 24 * 60 * 60 * 1000

function isQuickMatchTitle(title: string) {
  return title.startsWith(QUICK_MATCH_TITLE_PREFIX)
}

function isExpired(createdAt: Date) {
  return Date.now() - createdAt.getTime() > QUICK_MATCH_TIMEOUT_MS
}

async function deleteQuickResultAndMatch(resultId: string, matchId: string) {
  await prisma.$transaction([
    prisma.matchResult.delete({ where: { id: resultId } }),
    prisma.match.delete({ where: { id: matchId } }),
  ])
}

export async function reportQuickMatchResultAction(
  _: QuickMatchFormState,
  formData: FormData,
): Promise<QuickMatchFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const opponentId = String(formData.get('opponentId') ?? '').trim()
  const winnerId = String(formData.get('winnerId') ?? '').trim()
  const scoreText = String(formData.get('scoreText') ?? '').trim()

  if (!opponentId || opponentId === currentUser.id) {
    return { error: '请选择有效对手。' }
  }

  if (!scoreText) {
    return { error: '请填写比分。' }
  }

  if (scoreText.length > 40) {
    return { error: '比分长度不能超过 40 个字符。' }
  }

  const opponent = await prisma.user.findUnique({
    where: { id: opponentId },
    select: { id: true, nickname: true, isBanned: true },
  })

  if (!opponent || opponent.isBanned) {
    return { error: '对手不存在或不可用。' }
  }

  if (winnerId !== currentUser.id && winnerId !== opponentId) {
    return { error: '获胜者必须是你或所选对手。' }
  }

  const loserId = winnerId === currentUser.id ? opponentId : currentUser.id

  await prisma.$transaction(async (tx) => {
    const now = new Date()
    const createdMatch = await tx.match.create({
      data: {
        title: `${QUICK_MATCH_TITLE_PREFIX} ${currentUser.nickname} vs ${opponent.nickname}`,
        description: '由快速比赛功能创建',
        type: 'single',
        format: 'group_only',
        status: 'finished',
        dateTime: now,
        registrationDeadline: now,
        maxParticipants: 2,
        location: '快速比赛',
        createdBy: currentUser.id,
      },
      select: { id: true },
    })

    await tx.registration.createMany({
      data: [
        {
          matchId: createdMatch.id,
          userId: currentUser.id,
          role: 'player',
          status: 'registered',
        },
        {
          matchId: createdMatch.id,
          userId: opponentId,
          role: 'player',
          status: 'registered',
        },
      ],
      skipDuplicates: true,
    })

    await tx.matchResult.create({
      data: {
        matchId: createdMatch.id,
        winnerId,
        loserId,
        winnerTeamIds: [winnerId],
        loserTeamIds: [loserId],
        score: { text: scoreText },
        reportedBy: currentUser.id,
        confirmed: false,
      },
    })
  })

  revalidatePath('/quick-match')
  return { success: '已登记快速比赛结果，等待对手确认（24 小时内）。' }
}

export async function confirmQuickMatchResultAction(
  resultId: string,
  formData: FormData,
): Promise<QuickMatchFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const result = await prisma.matchResult.findUnique({
    where: { id: resultId },
    include: { match: true },
  })

  if (!result) return { error: '赛果不存在。' }
  if (!isQuickMatchTitle(result.match.title)) return { error: '不是快速比赛赛果。' }

  if (result.confirmed) {
    return { success: '该赛果已确认。' }
  }

  if (isExpired(result.createdAt)) {
    await deleteQuickResultAndMatch(result.id, result.matchId)
    revalidatePath('/quick-match')
    return { error: '该赛果已超过 24 小时未确认，已作废。' }
  }

  const isOpponent =
    (result.winnerTeamIds.includes(currentUser.id) || result.loserTeamIds.includes(currentUser.id)) &&
    currentUser.id !== result.reportedBy
  const isAdmin = currentUser.role === 'admin'

  if (!isOpponent && !isAdmin) {
    return { error: '仅对手或管理员可确认。' }
  }

  await prisma.matchResult.update({
    where: { id: result.id },
    data: {
      confirmed: true,
      resultVerifiedAt: new Date(),
      verifierId: currentUser.id,
    },
  })

  revalidatePath('/quick-match')
  return { success: '已确认该快速比赛结果。' }
}

export async function rejectQuickMatchResultAction(
  resultId: string,
  formData: FormData,
): Promise<QuickMatchFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '请先登录。' }

  const result = await prisma.matchResult.findUnique({
    where: { id: resultId },
    include: { match: true },
  })

  if (!result) return { error: '赛果不存在。' }
  if (!isQuickMatchTitle(result.match.title)) return { error: '不是快速比赛赛果。' }
  if (result.confirmed) return { error: '已确认赛果不可拒绝。' }

  const isOpponent =
    (result.winnerTeamIds.includes(currentUser.id) || result.loserTeamIds.includes(currentUser.id)) &&
    currentUser.id !== result.reportedBy
  const isAdmin = currentUser.role === 'admin'

  if (!isOpponent && !isAdmin) {
    return { error: '仅对手或管理员可拒绝。' }
  }

  await deleteQuickResultAndMatch(result.id, result.matchId)

  revalidatePath('/quick-match')
  return { success: '已拒绝该赛果，结果已作废。' }
}

export async function cleanupExpiredQuickResultsForUser(userId: string) {
  const expired = await prisma.matchResult.findMany({
    where: {
      confirmed: false,
      createdAt: {
        lt: new Date(Date.now() - QUICK_MATCH_TIMEOUT_MS),
      },
      OR: [{ winnerTeamIds: { has: userId } }, { loserTeamIds: { has: userId } }],
      match: {
        title: {
          startsWith: QUICK_MATCH_TITLE_PREFIX,
        },
      },
    },
    select: {
      id: true,
      matchId: true,
    },
  })

  for (const item of expired) {
    await deleteQuickResultAndMatch(item.id, item.matchId)
  }
}
