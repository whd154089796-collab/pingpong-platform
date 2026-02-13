'use server'

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE_NAME } from '@/lib/auth'

const USTC_MAIL_SUFFIX = '@mail.ustc.edu.cn'

export type AuthFormState = {
  error?: string
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false

  const hashedBuffer = scryptSync(password, salt, 64)
  const sourceBuffer = Buffer.from(hash, 'hex')

  if (hashedBuffer.length !== sourceBuffer.length) return false
  return timingSafeEqual(hashedBuffer, sourceBuffer)
}

export async function registerAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const nickname = String(formData.get('nickname') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!nickname || !email || !password) {
    return { error: '请完整填写昵称、邮箱和密码。' }
  }

  if (!email.endsWith(USTC_MAIL_SUFFIX)) {
    return { error: '仅支持 @mail.ustc.edu.cn 邮箱注册。' }
  }

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
      emailVerifiedAt: new Date(),
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, user.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  redirect('/profile')
}

export async function loginAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: '请输入邮箱和密码。' }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user?.hashedPassword || !verifyPassword(password, user.hashedPassword)) {
    return { error: '邮箱或密码错误。' }
  }

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, user.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  redirect('/profile')
}

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  redirect('/auth')
}
