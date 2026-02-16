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
