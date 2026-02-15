'use server'

import { CompetitionFormat, MatchStatus, MatchType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { generateGroupingPayload } from '@/lib/tournament'

export type MatchFormState = {
  error?: string
  success?: string
}

function parseDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`)
}

function maxLimitByFormat(format: CompetitionFormat) {
  return format === 'group_then_knockout' ? 64 : 256
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

  const limit = maxLimitByFormat(format)
  if (!Number.isFinite(maxParticipants) || maxParticipants < 2 || maxParticipants > limit) {
    return { error: `该赛制最多支持 ${limit} 人。` }
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

  const limit = maxLimitByFormat(format)
  if (maxParticipants < match._count.registrations || maxParticipants > limit) {
    return { error: `人数需 >= 已报名人数且 <= ${limit}。` }
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

  const limit = maxLimitByFormat(format)
  if (!Number.isFinite(maxParticipants) || maxParticipants < match._count.registrations || maxParticipants > limit) {
    return { error: `人数需 >= 已报名人数且 <= ${limit}。` }
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

export async function ensureGroupingGenerated(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      registrations: {
        include: { user: { select: { id: true, nickname: true, eloRating: true, points: true } } },
      },
      groupingResult: true,
    },
  })

  if (!match) return
  if (match.groupingResult) return
  if (new Date() < match.registrationDeadline) return

  const maxAllowed = match.format === CompetitionFormat.group_then_knockout ? 64 : 256
  const participants = match.registrations.slice(0, maxAllowed).map((r) => r.user)
  if (participants.length < 2) return

  const payload = generateGroupingPayload(match.format, participants)

  await prisma.$transaction([
    prisma.matchGrouping.create({ data: { matchId: match.id, payload } }),
    prisma.match.update({
      where: { id: match.id },
      data: { groupingGeneratedAt: new Date(), status: MatchStatus.ongoing },
    }),
  ])

  revalidatePath('/matchs')
  revalidatePath(`/matchs/${match.id}`)
}
