'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export type ProfileFormState = {
  error?: string
  success?: string
}

export async function updateProfileAction(_: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: '请先登录后再修改资料。' }
  }

  const nickname = String(formData.get('nickname') ?? '').trim()
  const avatarUrl = String(formData.get('avatarUrl') ?? '').trim()
  const bio = String(formData.get('bio') ?? '').trim()

  if (!nickname) {
    return { error: '昵称不能为空。' }
  }

  if (nickname.length > 24) {
    return { error: '昵称不能超过 24 个字符。' }
  }

  if (bio.length > 160) {
    return { error: '个人描述不能超过 160 个字符。' }
  }

  await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      nickname,
      avatarUrl: avatarUrl || null,
      bio: bio || null,
    },
  })

  revalidatePath('/profile')
  revalidatePath(`/users/${currentUser.id}`)

  return { success: '资料已更新。' }
}
