import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const SESSION_COOKIE_NAME = 'ustc_tta_session'

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const sessionUserId = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionUserId) {
    return null
  }

  return prisma.user.findUnique({
    where: { id: sessionUserId },
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
    },
  })
}
