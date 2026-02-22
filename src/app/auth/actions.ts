'use server'

import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { validateCsrfToken } from '@/lib/csrf'
import { hashPassword, verifyPassword } from '@/lib/password'
import { hitRateLimit } from '@/lib/rate-limit'
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  shouldUseSecureCookies,
} from '@/lib/session'

const EMAIL_VERIFY_TTL_MS = 1000 * 60 * 30

export type AuthFormState = {
  error?: string
  success?: string
}

const AUTH_WINDOW_MS = 15 * 60 * 1000
const AUTH_MAX_ATTEMPTS = 8
const RESEND_WINDOW_MS = 15 * 60 * 1000
const RESEND_MAX_ATTEMPTS = 3

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function getBaseUrl() {
  return process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

async function getClientIp() {
  const headerStore = await headers()
  const forwardedFor = headerStore.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }

  return headerStore.get('x-real-ip') ?? 'unknown'
}

async function checkAuthRateLimit(action: 'register' | 'login' | 'resend', email: string) {
  const ip = await getClientIp()
  const normalizedEmail = email.trim().toLowerCase() || 'unknown'

  const key = `${action}:${ip}:${normalizedEmail}`
  const overLimit = hitRateLimit(key, {
    maxHits: action === 'resend' ? RESEND_MAX_ATTEMPTS : AUTH_MAX_ATTEMPTS,
    windowMs: action === 'resend' ? RESEND_WINDOW_MS : AUTH_WINDOW_MS,
  })

  if (overLimit) {
    return '操作过于频繁，请稍后再试。'
  }

  return null
}

async function sendVerificationEmail(email: string, nickname: string, token: string) {
  const resendApiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!resendApiKey || !from) {
    throw new Error('邮件服务未配置：请设置 RESEND_API_KEY 与 RESEND_FROM_EMAIL')
  }

  const verifyUrl = `${getBaseUrl()}/auth/verify?token=${encodeURIComponent(token)}`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: 'USTC TTA 邮箱验证',
      html: `
        <div style="font-family: Arial, sans-serif;line-height:1.7;">
          <h2>你好，${nickname}</h2>
          <p>请点击下方按钮完成 USTC TTA 账号邮箱验证：</p>
          <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#06b6d4;color:#fff;text-decoration:none;border-radius:8px;">验证邮箱并激活账号</a></p>
          <p>如果按钮不可用，请复制以下链接到浏览器打开：</p>
          <p>${verifyUrl}</p>
          <p>此链接 30 分钟内有效。</p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    console.error('sendVerificationEmail failed', {
      status: response.status,
      detail,
    })
    throw new Error('邮件发送失败，请稍后重试。')
  }
}

async function issueVerificationEmail(userId: string, email: string, nickname: string) {
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS)

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  })

  await sendVerificationEmail(email, nickname, rawToken)
}

export async function registerAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const nickname = String(formData.get('nickname') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  const rateLimited = await checkAuthRateLimit('register', email)
  if (rateLimited) {
    return { error: rateLimited }
  }

  if (!nickname || !email || !password) {
    return { error: '请完整填写昵称、邮箱和密码。' }
  }

  // 临时关闭 USTC 邮箱后缀限制（测试账号阶段）
  // if (!email.endsWith(USTC_MAIL_SUFFIX)) {
  //   return { error: '仅支持 @mail.ustc.edu.cn 邮箱注册。' }
  // }

  if (password.length < 6) {
    return { error: '密码至少需要 6 位。' }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { error: '该邮箱已注册，请直接登录。' }
  }

  const user = await prisma.user.create({
    data: {
      nickname,
      email,
      hashedPassword: hashPassword(password),
      emailVerifiedAt: null,
    },
  })

  try {
    await issueVerificationEmail(user.id, user.email, user.nickname)
  } catch (error) {
    console.error('registerAction issueVerificationEmail failed', error)
    await prisma.user.delete({ where: { id: user.id } })
    return { error: '邮件发送失败，请稍后重试。' }
  }

  return { success: '注册成功！请前往邮箱点击验证链接后再登录。' }
}

export async function loginAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  const rateLimited = await checkAuthRateLimit('login', email)
  if (rateLimited) {
    return { error: rateLimited }
  }

  if (!email || !password) {
    return { error: '请输入邮箱和密码。' }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user?.hashedPassword) {
    return { error: '邮箱或密码错误。' }
  }

  const verifyResult = verifyPassword(password, user.hashedPassword)
  if (!verifyResult.ok) {
    return { error: '邮箱或密码错误。' }
  }

  if (verifyResult.needsRehash) {
    await prisma.user.update({
      where: { id: user.id },
      data: { hashedPassword: hashPassword(password) },
    })
  }

  if (!user.emailVerifiedAt) {
    return { error: '邮箱尚未验证，请先点击邮件中的验证链接。' }
  }

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })

  redirect('/profile')
}

export async function resendVerifyEmailAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) return { error: csrfError }

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  const rateLimited = await checkAuthRateLimit('resend', email)
  if (rateLimited) {
    return { error: rateLimited }
  }

  if (!email || !password) {
    return { error: '请输入邮箱和密码后再重发验证邮件。' }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user?.hashedPassword) {
    return { error: '邮箱或密码错误。' }
  }

  const verifyResult = verifyPassword(password, user.hashedPassword)
  if (!verifyResult.ok) {
    return { error: '邮箱或密码错误。' }
  }

  if (verifyResult.needsRehash) {
    await prisma.user.update({
      where: { id: user.id },
      data: { hashedPassword: hashPassword(password) },
    })
  }

  if (user.emailVerifiedAt) {
    return { success: '邮箱已完成验证，请直接登录。' }
  }

  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, consumedAt: null } })

  try {
    await issueVerificationEmail(user.id, user.email, user.nickname)
  } catch (error) {
    console.error('resendVerifyEmailAction issueVerificationEmail failed', error)
    return { error: '重发失败，请稍后重试。' }
  }

  return { success: '验证邮件已重发，请检查收件箱。' }
}

export async function verifyEmailTokenAction(token: string) {
  const tokenHash = hashToken(token)
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!record || record.consumedAt || record.expiresAt.getTime() < Date.now()) {
    return { error: '验证链接无效或已过期，请重新发送验证邮件。' }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
  ])

  return { success: '邮箱验证成功，请返回登录页登录。' }
}

export async function logoutAction(formData: FormData) {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) {
    redirect('/auth')
  }

  const cookieStore = await cookies()
  cookieStore.delete({
    name: SESSION_COOKIE_NAME,
    path: '/',
  })
  redirect('/auth')
}
