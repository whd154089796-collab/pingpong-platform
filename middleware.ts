import { NextResponse, type NextRequest } from 'next/server'
import { CSRF_COOKIE_NAME } from '@/lib/csrf-constants'

function generateToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function buildCsp() {
  const isDev = process.env.NODE_ENV !== 'production'

  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-eval'"
    : "script-src 'self'"
  const connectSrc = isDev
    ? "connect-src 'self' ws: wss: https://api.resend.com"
    : "connect-src 'self' https://api.resend.com"

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    connectSrc,
    "frame-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  response.headers.set('Content-Security-Policy', buildCsp())
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  const token = request.cookies.get(CSRF_COOKIE_NAME)?.value
  if (!token) {
    response.cookies.set(CSRF_COOKIE_NAME, generateToken(), {
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}