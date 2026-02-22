'use server'

import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { validateCsrfToken } from '@/lib/csrf'

const ADMIN_REAUTH_COOKIE = 'ustc_tta_admin_reauth'
const ADMIN_EMAIL_CHALLENGE_COOKIE = 'ustc_tta_admin_email_challenge'
const ADMIN_REAUTH_TTL_SECONDS = 60 * 30
const ADMIN_EMAIL_CHALLENGE_TTL_SECONDS = 60 * 10
const USTC_MAIL_SUFFIX = '@mail.ustc.edu.cn'

export type AdminDashboardUser = {
  id: string
  email: string
  nickname: string
  avatarUrl: string | null
  role: 'user' | 'admin'
  isBanned: boolean
  createdAt: string
  lastActivityAt: string
}

export type AdminDashboardMatch = {
  id: string
  title: string
  status: string
  dateTime: string
  registrationDeadline: string
  currentParticipants: number
}

export type AdminDashboardState = {
  unlocked: boolean
  error?: string
  success?: string
  users: AdminDashboardUser[]
  matches: AdminDashboardMatch[]
  createdTestAccounts?: string[]
}

const INITIAL_ADMIN_DASHBOARD_STATE: AdminDashboardState = {
  unlocked: false,
  users: [],
  matches: [],
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function getBaseUrl() {
  return process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

async function sendAdminReauthEmail(email: string, nickname: string, code: string) {
  const resendApiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!resendApiKey || !from) {
    throw new Error('邮件服务未配置：请设置 RESEND_API_KEY 与 RESEND_FROM_EMAIL')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: 'USTC TTA 管理员二次验证',
      html: `
        <div style="font-family: Arial, sans-serif;line-height:1.7;">
          <h2>你好，${nickname}</h2>
          <p>你正在进行 USTC TTA 管理员控制台二次验证。</p>
          <p>验证码为：</p>
          <p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p>
          <p>验证码 ${Math.floor(ADMIN_EMAIL_CHALLENGE_TTL_SECONDS / 60)} 分钟内有效，请勿泄露给他人。</p>
          <p>若非本人操作，请忽略此邮件并尽快修改账号密码。</p>
          <p style="color:#64748b;font-size:12px;">来源：${getBaseUrl()}</p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`管理员验证邮件发送失败：${detail}`)
  }
}

function getReauthSecret() {
  return process.env.ADMIN_REAUTH_SECRET ?? process.env.AUTH_SECRET ?? 'ustc-tta-admin-reauth-fallback'
}

function signReauthValue(userId: string, expiresAtMs: number) {
  const payload = `${userId}.${expiresAtMs}`
  const sig = createHmac('sha256', getReauthSecret()).update(payload).digest('hex')
  return `${payload}.${sig}`
}

function signEmailChallengeValue(userId: string, codeHash: string, expiresAtMs: number) {
  const payload = `${userId}.${codeHash}.${expiresAtMs}`
  const sig = createHmac('sha256', getReauthSecret()).update(payload).digest('hex')
  return `${payload}.${sig}`
}

function verifyReauthValue(rawValue: string, userId: string) {
  const [cookieUserId, expiresAtRaw, sig] = rawValue.split('.')
  if (!cookieUserId || !expiresAtRaw || !sig) return false
  if (cookieUserId !== userId) return false

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false

  const payload = `${cookieUserId}.${expiresAt}`
  const expectedSig = createHmac('sha256', getReauthSecret()).update(payload).digest('hex')

  return timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
}

function parseEmailChallengeValue(rawValue: string, userId: string) {
  const [cookieUserId, codeHash, expiresAtRaw, sig] = rawValue.split('.')
  if (!cookieUserId || !codeHash || !expiresAtRaw || !sig) return null
  if (cookieUserId !== userId) return null

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null

  const payload = `${cookieUserId}.${codeHash}.${expiresAt}`
  const expectedSig = createHmac('sha256', getReauthSecret()).update(payload).digest('hex')
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null

  return {
    codeHash,
    expiresAt,
  }
}

async function getAdminIdentity() {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== 'admin') {
    return { ok: false as const, error: '仅管理员可访问该页面。' }
  }
  return { ok: true as const, userId: currentUser.id }
}

async function isAdminReauthed(userId: string) {
  const cookieStore = await cookies()
  const raw = cookieStore.get(ADMIN_REAUTH_COOKIE)?.value
  if (!raw) return false
  return verifyReauthValue(raw, userId)
}

async function issueAdminReauth(userId: string) {
  const cookieStore = await cookies()
  const expiresAt = Date.now() + ADMIN_REAUTH_TTL_SECONDS * 1000
  cookieStore.set(ADMIN_REAUTH_COOKIE, signReauthValue(userId, expiresAt), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/admin',
    maxAge: ADMIN_REAUTH_TTL_SECONDS,
  })
}

async function clearAdminEmailChallengeCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_EMAIL_CHALLENGE_COOKIE)
}

async function issueAdminEmailChallenge(user: { id: string; email: string; nickname: string }) {
  const code = String(randomInt(100000, 1000000))
  const codeHash = hashToken(code)
  const expiresAt = Date.now() + ADMIN_EMAIL_CHALLENGE_TTL_SECONDS * 1000

  const cookieStore = await cookies()
  cookieStore.set(
    ADMIN_EMAIL_CHALLENGE_COOKIE,
    signEmailChallengeValue(user.id, codeHash, expiresAt),
    {
      httpOnly: true,
      sameSite: 'lax',
      path: '/admin',
      maxAge: ADMIN_EMAIL_CHALLENGE_TTL_SECONDS,
    },
  )

  await sendAdminReauthEmail(user.email, user.nickname, code)
}

async function fetchAdminDashboardData() {
  const [users, matches] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        role: true,
        isBanned: true,
        createdAt: true,
        updatedAt: true,
        registrations: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        },
        reportedResults: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        },
        createdMatches: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        },
      },
    }),
    prisma.match.findMany({
      orderBy: { dateTime: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        dateTime: true,
        registrationDeadline: true,
        _count: {
          select: { registrations: true },
        },
      },
      take: 200,
    }),
  ])

  const mappedUsers: AdminDashboardUser[] = users.map((user) => {
    const lastActivityCandidates = [
      user.updatedAt,
      user.registrations[0]?.createdAt,
      user.reportedResults[0]?.createdAt,
      user.createdMatches[0]?.createdAt,
    ].filter((value): value is Date => Boolean(value))

    const lastActivityAt = new Date(
      Math.max(...lastActivityCandidates.map((date) => date.getTime())),
    )

    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isBanned: user.isBanned,
      createdAt: user.createdAt.toISOString(),
      lastActivityAt: lastActivityAt.toISOString(),
    }
  })

  const mappedMatches: AdminDashboardMatch[] = matches.map((match) => ({
    id: match.id,
    title: match.title,
    status: match.status,
    dateTime: match.dateTime.toISOString(),
    registrationDeadline: match.registrationDeadline.toISOString(),
    currentParticipants: match._count.registrations,
  }))

  return {
    users: mappedUsers,
    matches: mappedMatches,
  }
}

function splitEmails(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[\s,;\n\r]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

function splitSelectedUserIds(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

export async function adminDashboardAction(
  prev: AdminDashboardState,
  formData: FormData,
): Promise<AdminDashboardState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) {
    return {
      ...INITIAL_ADMIN_DASHBOARD_STATE,
      error: csrfError,
    }
  }

  const admin = await getAdminIdentity()
  if (!admin.ok) {
    return {
      ...INITIAL_ADMIN_DASHBOARD_STATE,
      error: admin.error,
    }
  }

  const intent = String(formData.get('intent') ?? '')

  if (intent === 'sendEmailChallenge') {
    const adminRecord = await prisma.user.findUnique({
      where: { id: admin.userId },
      select: {
        id: true,
        email: true,
        nickname: true,
        emailVerifiedAt: true,
      },
    })

    if (!adminRecord) {
      return {
        ...prev,
        unlocked: false,
        error: '管理员账号不存在，请重新登录后重试。',
      }
    }

    if (!adminRecord.emailVerifiedAt) {
      return {
        ...prev,
        unlocked: false,
        error: '管理员账号邮箱未验证，无法进行邮箱二次验证。',
      }
    }

    try {
      await issueAdminEmailChallenge(adminRecord)
    } catch (error) {
      return {
        ...prev,
        unlocked: false,
        error: error instanceof Error ? error.message : '验证邮件发送失败，请稍后重试。',
      }
    }

    return {
      ...prev,
      unlocked: false,
      success: '验证码已发送至管理员邮箱，请输入 6 位验证码完成二次验证。',
      error: undefined,
    }
  }

  if (intent === 'reauth') {
    const code = String(formData.get('code') ?? '').trim()
    if (!/^\d{6}$/.test(code)) {
      return {
        ...prev,
        unlocked: false,
        error: '请输入 6 位邮箱验证码。',
      }
    }

    const cookieStore = await cookies()
    const rawChallenge = cookieStore.get(ADMIN_EMAIL_CHALLENGE_COOKIE)?.value
    if (!rawChallenge) {
      return {
        ...prev,
        unlocked: false,
        error: '邮箱验证码不存在或已过期，请先发送验证码。',
      }
    }

    const challenge = parseEmailChallengeValue(rawChallenge, admin.userId)
    if (!challenge) {
      await clearAdminEmailChallengeCookie()
      return {
        ...prev,
        unlocked: false,
        error: '邮箱验证码已失效，请重新发送。',
      }
    }

    const incomingHash = hashToken(code)
    if (!timingSafeEqual(Buffer.from(incomingHash), Buffer.from(challenge.codeHash))) {
      return {
        ...prev,
        unlocked: false,
        error: '邮箱验证码错误，请重试。',
      }
    }

    await issueAdminReauth(admin.userId)
    await clearAdminEmailChallengeCookie()
    const data = await fetchAdminDashboardData()

    return {
      unlocked: true,
      success: '邮箱二次认证通过，已解锁管理员能力。',
      users: data.users,
      matches: data.matches,
    }
  }

  const reauthed = await isAdminReauthed(admin.userId)
  if (!reauthed) {
    return {
      ...INITIAL_ADMIN_DASHBOARD_STATE,
      error: '管理员二次认证已失效，请重新验证后再操作。',
    }
  }

  try {
    if (intent === 'toggleBan') {
      const userId = String(formData.get('userId') ?? '')
      const banned = String(formData.get('banned') ?? '') === 'true'

      if (!userId) throw new Error('缺少用户 ID。')
      if (userId === admin.userId) throw new Error('不能封禁当前管理员自己。')

      await prisma.user.update({
        where: { id: userId },
        data: { isBanned: banned },
      })
    }

    if (intent === 'bulkToggleBan') {
      const selectedUserIdsRaw = String(formData.get('selectedUserIds') ?? '')
      const selectedUserIds = splitSelectedUserIds(selectedUserIdsRaw)
      const banned = String(formData.get('banned') ?? '') === 'true'

      if (selectedUserIds.length === 0) {
        throw new Error('请先选择要操作的用户。')
      }

      const targets = await prisma.user.findMany({
        where: {
          id: { in: selectedUserIds },
        },
        select: {
          id: true,
          role: true,
        },
      })

      const protectedIds = new Set<string>([admin.userId])
      targets.forEach((target) => {
        if (target.role === 'admin') {
          protectedIds.add(target.id)
        }
      })

      const editableIds = selectedUserIds.filter((id) => !protectedIds.has(id))
      if (editableIds.length === 0) {
        throw new Error('未找到可操作用户（管理员账号不可批量封禁）。')
      }

      await prisma.user.updateMany({
        where: {
          id: { in: editableIds },
        },
        data: {
          isBanned: banned,
        },
      })
    }

    if (intent === 'deleteUser') {
      const userId = String(formData.get('userId') ?? '')
      if (!userId) throw new Error('缺少用户 ID。')
      if (userId === admin.userId) throw new Error('不能删除当前管理员自己。')

      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })

      if (target?.role === 'admin') {
        throw new Error('不允许直接删除管理员账号。')
      }

      await prisma.user.delete({ where: { id: userId } })
    }

    if (intent === 'bulkDeleteUsers') {
      const selectedUserIdsRaw = String(formData.get('selectedUserIds') ?? '')
      const selectedUserIds = splitSelectedUserIds(selectedUserIdsRaw)

      if (selectedUserIds.length === 0) {
        throw new Error('请先选择要删除的用户。')
      }

      const targets = await prisma.user.findMany({
        where: {
          id: { in: selectedUserIds },
        },
        select: {
          id: true,
          role: true,
        },
      })

      const protectedIds = new Set<string>([admin.userId])
      targets.forEach((target) => {
        if (target.role === 'admin') {
          protectedIds.add(target.id)
        }
      })

      const deletableIds = selectedUserIds.filter((id) => !protectedIds.has(id))
      if (deletableIds.length === 0) {
        throw new Error('未找到可删除用户（管理员账号不可批量删除）。')
      }

      await prisma.user.deleteMany({
        where: {
          id: { in: deletableIds },
        },
      })
    }

    if (intent === 'updateUser') {
      const userId = String(formData.get('userId') ?? '')
      const nickname = String(formData.get('nickname') ?? '').trim()
      const avatarUrlRaw = String(formData.get('avatarUrl') ?? '').trim()

      if (!userId) throw new Error('缺少用户 ID。')
      if (!nickname) throw new Error('昵称不能为空。')

      await prisma.user.update({
        where: { id: userId },
        data: {
          nickname,
          avatarUrl: avatarUrlRaw || null,
        },
      })
    }

    let createdTestAccounts: string[] | undefined

    if (intent === 'createTestAccounts') {
      const prefixRaw = String(formData.get('prefix') ?? 'test').trim()
      const prefix = prefixRaw.replace(/[^a-zA-Z0-9_-]/g, '') || 'test'
      const count = Number(formData.get('count') ?? 0)
      const password = String(formData.get('password') ?? '')

      if (!Number.isInteger(count) || count < 1 || count > 200) {
        throw new Error('测试账号数量需为 1-200 的整数。')
      }
      if (password.length < 6) {
        throw new Error('测试账号密码至少 6 位。')
      }

      const created: string[] = []
      let seq = 1
      let attempts = 0

      while (created.length < count && attempts < count * 30) {
        attempts += 1
        const email = `${prefix}${seq}${USTC_MAIL_SUFFIX}`.toLowerCase()
        seq += 1

        const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
        if (existing) continue

        await prisma.user.create({
          data: {
            email,
            nickname: `${prefix}_${email.split('@')[0]}`,
            hashedPassword: hashPassword(password),
            emailVerifiedAt: new Date(),
          },
        })

        created.push(email)
      }

      if (created.length === 0) {
        throw new Error('未成功创建测试账号，请更换前缀或减少数量后重试。')
      }

      createdTestAccounts = created
    }

    if (intent === 'bulkRegisterMatch') {
      const matchId = String(formData.get('matchId') ?? '')
      const selectedUserIdsRaw = String(formData.get('selectedUserIds') ?? '')
      const selectedUserIds = splitSelectedUserIds(selectedUserIdsRaw)
      const emailsRaw = String(formData.get('emails') ?? '')
      const emails = splitEmails(emailsRaw)

      if (!matchId) throw new Error('请选择比赛。')
      if (selectedUserIds.length === 0 && emails.length === 0) {
        throw new Error('请至少选择一个用户。')
      }

      const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: {
          id: true,
          type: true,
          _count: { select: { registrations: true } },
        },
      })

      if (!match) throw new Error('比赛不存在。')
      if (match.type === 'double') {
        throw new Error('双打比赛请先完成组队邀请并由小队成员自行报名。')
      }

      const users = selectedUserIds.length > 0
        ? await prisma.user.findMany({
            where: {
              id: { in: selectedUserIds },
              isBanned: false,
            },
            select: { id: true },
          })
        : await prisma.user.findMany({
            where: {
              email: { in: emails },
              isBanned: false,
            },
            select: { id: true },
          })

      if (users.length === 0) {
        throw new Error('未找到可加入比赛的有效用户（可能不存在或已被封禁）。')
      }

      const toRegister = users

      await prisma.registration.createMany({
        data: toRegister.map((user) => ({
          matchId,
          userId: user.id,
          status: 'registered',
          role: 'player',
        })),
        skipDuplicates: true,
      })

      createdTestAccounts = undefined

      const data = await fetchAdminDashboardData()

      return {
        unlocked: true,
        success: `操作成功，已尝试将 ${toRegister.length} 个用户加入所选比赛。`,
        users: data.users,
        matches: data.matches,
      }
    }

    const data = await fetchAdminDashboardData()

    return {
      unlocked: true,
      success:
        intent === 'createTestAccounts'
          ? `操作成功，已创建 ${createdTestAccounts?.length ?? 0} 个测试账号。`
          : '操作成功。',
      users: data.users,
      matches: data.matches,
      createdTestAccounts,
    }
  } catch (error) {
    const data = await fetchAdminDashboardData()
    return {
      unlocked: true,
      error: error instanceof Error ? error.message : '管理员操作失败，请重试。',
      users: data.users,
      matches: data.matches,
    }
  }
}
