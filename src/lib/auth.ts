import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session'

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const rawSession = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!rawSession) {
    return null
  }

  const session = verifySessionToken(rawSession)
  if (!session) {
    return null
  }

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      nickname: true,
      bio: true,
      avatarUrl: true,
      points: true,
      eloRating: true,
      wins: true,
      losses: true,
      matchesPlayed: true,
      role: true,
    },
  })
}
