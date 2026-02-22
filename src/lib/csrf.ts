import { timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { CSRF_COOKIE_NAME, CSRF_FORM_FIELD } from '@/lib/csrf-constants'

export async function validateCsrfToken(formData: FormData): Promise<string | null> {
  const submittedToken = String(formData.get(CSRF_FORM_FIELD) ?? '')
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value ?? ''

  if (!submittedToken || !cookieToken) {
    return '安全校验失败，请刷新页面后重试。'
  }

  const submittedBuffer = Buffer.from(submittedToken)
  const cookieBuffer = Buffer.from(cookieToken)

  if (submittedBuffer.length !== cookieBuffer.length) {
    return '安全校验失败，请刷新页面后重试。'
  }

  if (!timingSafeEqual(submittedBuffer, cookieBuffer)) {
    return '安全校验失败，请刷新页面后重试。'
  }

  return null
}