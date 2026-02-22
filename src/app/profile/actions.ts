'use server'

import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { validateCsrfToken } from '@/lib/csrf'

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

function hasImageMagicBytes(type: string, buffer: Buffer) {
  if (type === 'image/png') {
    if (buffer.length < 8) return false
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    )
  }

  if (type === 'image/jpeg') {
    if (buffer.length < 3) return false
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }

  if (type === 'image/gif') {
    if (buffer.length < 6) return false
    const signature = buffer.subarray(0, 6).toString('ascii')
    return signature === 'GIF87a' || signature === 'GIF89a'
  }

  if (type === 'image/webp') {
    if (buffer.length < 12) return false
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    )
  }

  return false
}

export async function updateProfileAction(_: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const csrfError = await validateCsrfToken(formData)
  if (csrfError) {
    return { error: csrfError }
  }

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
    const extension = extensionFromMimeType(avatarFile.type)
    if (!extension) {
      return { error: '头像文件必须是图片格式。' }
    }
    if (avatarFile.size > MAX_AVATAR_BYTES) {
      return { error: '头像大小不能超过 2MB。' }
    }

    const buffer = Buffer.from(await avatarFile.arrayBuffer())
    if (!hasImageMagicBytes(avatarFile.type, buffer)) {
      return { error: '头像文件内容与格式不匹配，请重新选择图片。' }
    }

    const filename = `${currentUser.id}-${randomUUID()}${extension}`
    const avatarFolder = join(process.cwd(), 'public', 'uploads', 'avatars')
    await mkdir(avatarFolder, { recursive: true })

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
