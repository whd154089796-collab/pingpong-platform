import Link from 'next/link'
import { CalendarRange, Medal, ShieldCheck, Sparkles } from 'lucide-react'
import MatchCard from '@/components/match/MatchCard'

const latestMatches = [
  {
    id: '1',
    title: '春季联赛',
    date: '2026-03-15',
    location: '体育馆',
    participants: 8,
    maxParticipants: 16,
    status: '报名中' as const,
  },
  {
    id: '2',
    title: '校友挑战赛',
    date: '2026-03-20',
    location: '东区球馆',
    participants: 12,
    maxParticipants: 16,
    status: '进行中' as const,
  },
]

const quickActions = [
  { href: '/matchs', label: '进入比赛大厅', desc: '查看全部赛事', icon: CalendarRange },
  { href: '/rankings', label: '查看排行榜', desc: '追踪 ELO 与积分', icon: Medal },
  { href: '/matchs/create', label: '发布新比赛', desc: '快速创建赛事', icon: Sparkles },
]

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-700/70 bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 p-8 shadow-xl shadow-black/20 md:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.18),transparent_48%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-cyan-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              USTC TTA 官方平台
            </p>
            <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">让每一场比赛都有专业舞台</h1>
            <p className="mt-4 max-w-2xl text-slate-300">
              我们将赛事发布、报名管理、积分排行与荣誉展示统一到一个平台，提升比赛组织效率，也让选手成长可被看见。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/matchs" className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-900/40 transition hover:brightness-110">
                进入比赛大厅
              </Link>
              <Link href="/matchs/create" className="rounded-xl border border-slate-500/80 px-5 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/70 hover:bg-cyan-500/10">
                发布比赛
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold tracking-[0.2em] text-slate-400">平台荣誉徽章</h2>
            <a href="/25周年徽章.pdf" target="_blank" rel="noreferrer" className="block rounded-2xl border border-amber-300/40 bg-gradient-to-r from-amber-500/20 to-orange-500/10 p-4 transition hover:border-amber-300/70">
              <p className="text-sm text-amber-100">25周年纪念徽章</p>
              <p className="mt-1 text-xs text-amber-200/80">校队历史荣誉，点击查看完整徽章</p>
            </a>
            <a href="/乒协徽章.pdf" target="_blank" rel="noreferrer" className="block rounded-2xl border border-cyan-300/35 bg-gradient-to-r from-cyan-500/20 to-blue-500/10 p-4 transition hover:border-cyan-300/60">
              <p className="text-sm text-cyan-100">乒协官方徽章</p>
              <p className="mt-1 text-xs text-cyan-200/80">协会认证视觉，点击查看完整徽章</p>
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {quickActions.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href} className="rounded-2xl border border-slate-700/70 bg-slate-800/80 p-5 text-slate-100 shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:border-cyan-400/45">
            <Icon className="mb-3 h-5 w-5 text-cyan-300" />
            <h3 className="font-semibold">{label}</h3>
            <p className="mt-1 text-sm text-slate-300">{desc}</p>
          </Link>
        ))}
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">近期比赛</h2>
          <Link href="/matchs" className="text-sm text-cyan-300 hover:text-cyan-200">
            查看全部 →
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {latestMatches.map((match) => (
            <MatchCard key={match.id} {...match} />
          ))}
        </div>
      </section>
    </div>
  )
}
