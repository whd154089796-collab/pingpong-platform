'use client'

import { useActionState, useState } from 'react'
import { type AuthFormState, loginAction, registerAction, resendVerifyEmailAction } from '@/app/auth/actions'

const initialState: AuthFormState = {}

export default function AuthForms() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, initialState)
  const [registerState, registerFormAction, registerPending] = useActionState(registerAction, initialState)
  const [resendState, resendFormAction, resendPending] = useActionState(resendVerifyEmailAction, initialState)

  return (
    <div className="w-full rounded-2xl border border-slate-700/70 bg-slate-900/75 p-6 shadow-xl shadow-black/20">
      <div className="mb-6 grid grid-cols-2 rounded-xl border border-slate-700 bg-slate-800 p-1 text-sm">
        <button type="button" onClick={() => setTab('login')} className={`rounded-lg px-3 py-2 ${tab === 'login' ? 'bg-cyan-500/20 text-cyan-100' : 'text-slate-300'}`}>
          登录
        </button>
        <button type="button" onClick={() => setTab('register')} className={`rounded-lg px-3 py-2 ${tab === 'register' ? 'bg-cyan-500/20 text-cyan-100' : 'text-slate-300'}`}>
          注册
        </button>
      </div>

      {tab === 'login' ? (
        <>
          <form action={loginFormAction} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1 block text-sm text-slate-300">邮箱</label>
              <input id="login-email" name="email" type="email" className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400/40 focus:ring" />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1 block text-sm text-slate-300">密码</label>
              <input id="login-password" name="password" type="password" className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400/40 focus:ring" />
            </div>
            {loginState.error && <p className="text-sm text-rose-300">{loginState.error}</p>}
            {loginState.success && <p className="text-sm text-emerald-300">{loginState.success}</p>}
            <button disabled={loginPending} className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {loginPending ? '登录中...' : '登录'}
            </button>
          </form>

          <form action={resendFormAction} className="mt-4 space-y-3 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
            <p className="text-xs text-slate-300">未收到验证邮件？填写邮箱和密码后可重发验证链接。</p>
            <input name="email" type="email" placeholder="邮箱" className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400/40 focus:ring" />
            <input name="password" type="password" placeholder="密码" className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400/40 focus:ring" />
            {resendState.error && <p className="text-sm text-rose-300">{resendState.error}</p>}
            {resendState.success && <p className="text-sm text-emerald-300">{resendState.success}</p>}
            <button disabled={resendPending} className="w-full rounded-lg border border-cyan-300/40 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/10 disabled:opacity-60">
              {resendPending ? '发送中...' : '重发验证邮件'}
            </button>
          </form>
        </>
      ) : (
        <form action={registerFormAction} className="space-y-4">
          <div>
            <label htmlFor="register-nickname" className="mb-1 block text-sm text-slate-300">昵称</label>
            <input id="register-nickname" name="nickname" type="text" className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400/40 focus:ring" />
          </div>
          <div>
            <label htmlFor="register-email" className="mb-1 block text-sm text-slate-300">USTC 邮箱</label>
            <input id="register-email" name="email" type="email" placeholder="example@mail.ustc.edu.cn" className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400/40 focus:ring" />
          </div>
          <div>
            <label htmlFor="register-password" className="mb-1 block text-sm text-slate-300">密码</label>
            <input id="register-password" name="password" type="password" className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400/40 focus:ring" />
          </div>
          {registerState.error && <p className="text-sm text-rose-300">{registerState.error}</p>}
          {registerState.success && <p className="text-sm text-emerald-300">{registerState.success}</p>}
          <p className="text-xs text-slate-400">仅支持 @mail.ustc.edu.cn 邮箱。注册后需点击邮箱中的验证链接，才可登录。</p>
          <button disabled={registerPending} className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {registerPending ? '注册中...' : '注册并发送验证邮件'}
          </button>
        </form>
      )}
    </div>
  )
}
