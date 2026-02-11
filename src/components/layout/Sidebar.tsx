import Link from 'next/link'
import { CalendarRange, Home, Medal, PlusSquare, UserRound } from 'lucide-react'

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/matchs', label: '比赛大厅', icon: CalendarRange },
  { href: '/matchs/create', label: '发布比赛', icon: PlusSquare },
  { href: '/rankings', label: '排行榜', icon: Medal },
  { href: '/profile', label: '个人中心', icon: UserRound },
]

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:w-72 lg:shrink-0">
      <div className="sticky top-0 h-screen w-full border-r border-slate-700/70 bg-slate-900/90 px-5 py-6 backdrop-blur-xl">
        <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-slate-800 to-slate-900 p-4 shadow-lg shadow-cyan-950/20">
          <p className="text-xs tracking-[0.28em] text-cyan-300">USTC TTA</p>
          <h2 className="mt-2 text-xl font-bold text-white">乒乓球竞技平台</h2>
          <p className="mt-2 text-sm text-slate-300">统一赛事、积分与荣誉展示的数字化平台</p>
        </div>

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

        <div className="mt-8 space-y-3">
          <h3 className="text-xs font-semibold tracking-[0.22em] text-slate-400">荣誉徽章</h3>
          <a
            href="/25周年徽章.pdf"
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-amber-300/35 bg-gradient-to-r from-amber-500/20 to-orange-500/10 p-3 text-sm text-amber-100 transition hover:border-amber-300/60"
          >
            25周年纪念徽章
          </a>
          <a
            href="/乒协徽章.pdf"
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-cyan-300/35 bg-gradient-to-r from-cyan-500/20 to-blue-500/10 p-3 text-sm text-cyan-100 transition hover:border-cyan-300/60"
          >
            乒协荣誉徽章
          </a>
        </div>
      </div>
    </aside>
  )
}
