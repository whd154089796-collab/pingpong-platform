type ResendConfig = {
  apiKey: string
  from: string
}

function isAscii(value: string) {
  return /^[\x00-\x7F]*$/.test(value)
}

function sanitizeFromAddress(rawFrom: string) {
  const trimmed = rawFrom.trim()
  if (trimmed && isAscii(trimmed)) {
    return trimmed
  }

  const match = trimmed.match(/<([^>]+)>/)
  const email = match ? match[1].trim() : trimmed
  return isAscii(email) ? email : email.replace(/[^\x00-\x7F]/g, '')
}

export function getResendConfig(): ResendConfig {
  const apiKey = process.env.RESEND_API_KEY
  const rawFrom = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !rawFrom) {
    throw new Error('邮件服务未配置：请设置 RESEND_API_KEY 与 RESEND_FROM_EMAIL')
  }

  return {
    apiKey,
    from: sanitizeFromAddress(rawFrom),
  }
}

function isDomainVerificationError(status: number, detail: string) {
  return (
    status === 403 &&
    detail.includes('validation_error') &&
    detail.includes('verify a domain')
  )
}

export async function assertResendResponseOk(
  response: Response,
  context: string,
  fallbackMessage: string,
) {
  if (response.ok) return

  const detail = await response.text()
  console.error(`${context} failed`, {
    status: response.status,
    detail,
  })

  if (isDomainVerificationError(response.status, detail)) {
    throw new Error('邮件发送失败：请在 Resend 验证域名并使用该域名的发件人地址。')
  }

  throw new Error(fallbackMessage)
}
