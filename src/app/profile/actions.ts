'use server'

import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export type ProfileFormState = {
  error?: string
  success?: string
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024

function extensionFromMimeType(type: string) {
  if (type === 'image/png') return '.png'
  if (type === 'image/jpeg') return '.jpg'
  if (type === 'image/webp') return '.webp'
  if (type === 'image/gif') return '.gif'
  return ''
}

export async function updateProfileAction(_: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: '请先登录后再修改资料。' }
  }

  const nickname = String(formData.get('nickname') ?? '').trim()
  const bio = String(formData.get('bio') ?? '').trim()
  const removeAvatar = String(formData.get('removeAvatar') ?? '') === 'on'
  const avatarFile = formData.get('avatar')

  if (!nickname) {
    return { error: '昵称不能为空。' }
  }

  if (nickname.length > 24) {
    return { error: '昵称不能超过 24 个字符。' }
  }

  if (bio.length > 160) {
    return { error: '个人描述不能超过 160 个字符。' }
  }

  let nextAvatarUrl: string | null | undefined

  if (removeAvatar) {
    nextAvatarUrl = null
  }

  if (avatarFile instanceof File && avatarFile.size > 0) {
    if (!avatarFile.type.startsWith('image/')) {
      return { error: '头像文件必须是图片格式。' }
    }
    if (avatarFile.size > MAX_AVATAR_BYTES) {
      return { error: '头像大小不能超过 2MB。' }
    }

    const extension = extensionFromMimeType(avatarFile.type) || extname(avatarFile.name) || '.png'
    const filename = `${currentUser.id}-${randomUUID()}${extension}`
    const avatarFolder = join(process.cwd(), 'public', 'uploads', 'avatars')
    await mkdir(avatarFolder, { recursive: true })

    const buffer = Buffer.from(await avatarFile.arrayBuffer())
    await writeFile(join(avatarFolder, filename), buffer)
    nextAvatarUrl = `/uploads/avatars/${filename}`
  }

  await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      nickname,
      avatarUrl: nextAvatarUrl,
      bio: bio || null,
    },
  })

  revalidatePath('/profile')
  revalidatePath(`/users/${currentUser.id}`)

  return { success: '资料已更新。' }
}
