import Link from 'next/link'
import { CalendarRange, ChevronRight, Home, Medal, PlusSquare, UserRound } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/matchs', label: '比赛大厅', icon: CalendarRange },
  { href: '/matchs/create', label: '发布比赛', icon: PlusSquare },
  { href: '/rankings', label: '排行榜', icon: Medal },
  { href: '/profile', label: '个人中心', icon: UserRound },
]

export default async function Sidebar() {
  const currentUser = await getCurrentUser()
  const avatarFallback = (currentUser?.nickname?.trim()?.[0] ?? '?').toUpperCase()

  return (
    <aside className="hidden lg:flex lg:w-72 lg:shrink-0">
      <div className="sticky top-0 h-screen w-full border-r border-slate-700/70 bg-slate-900/90 px-5 py-6 backdrop-blur-xl">
        <section className="rounded-2xl border border-slate-700/70 bg-slate-950/20 p-4">
          {currentUser ? (
            <Link
              href="/profile"
              className="group flex items-center gap-3 rounded-xl border border-transparent p-2 transition hover:border-cyan-400/30 hover:bg-slate-800/40"
              aria-label="查看个人中心"
            >
              <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-cyan-500/15 text-sm font-semibold text-cyan-100 ring-1 ring-cyan-400/25">
                {currentUser.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentUser.avatarUrl} alt={currentUser.nickname} className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden="true">{avatarFallback}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-50">{currentUser.nickname}</p>
                <p className="mt-0.5 text-xs text-slate-400">我的主页</p>
              </div>

              <ChevronRight className="h-4 w-4 text-slate-500 transition group-hover:text-slate-200" />
            </Link>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-600 bg-slate-800/40 p-3">
              <p className="text-sm font-semibold text-slate-100">当前状态：待登录</p>
              <p className="mt-1 text-xs text-slate-400">登录后可报名、发布比赛和编辑个人资料。</p>
              <Link href="/auth" className="mt-3 inline-block rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/30">
                去登录 / 注册
              </Link>
            </div>
          )}

          {currentUser && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-700/60 bg-slate-950/30 px-3 py-2">
                <p className="text-[11px] text-slate-400">ELO</p>
                <p className="mt-1 text-base font-bold tabular-nums text-slate-100">{currentUser.eloRating}</p>
              </div>
              <div className="rounded-xl border border-slate-700/60 bg-slate-950/30 px-3 py-2">
                <p className="text-[11px] text-slate-400">积分</p>
                <p className="mt-1 text-base font-bold tabular-nums text-slate-100">{currentUser.points}</p>
              </div>
            </div>
          )}
        </section>

        <nav className="mt-6 space-y-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-slate-200 transition hover:border-cyan-400/40 hover:bg-slate-800/70 hover:text-white"
            >
              <Icon className="h-4 w-4 text-cyan-300 transition group-hover:scale-105" />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  )
}
