import Link from 'next/link'
import { CalendarRange, Medal, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { MatchStatus } from '@prisma/client'
import MatchCard from '@/components/match/MatchCard'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

const quickActions = [
  { href: '/matchs', label: '进入比赛大厅', desc: '查看全部赛事', icon: CalendarRange },
  { href: '/rankings', label: '查看排行榜', desc: '追踪 ELO 与积分', icon: Medal },
  { href: '/matchs/create', label: '发布新比赛', desc: '快速创建赛事', icon: Sparkles },
]

const statusLabelMap: Record<MatchStatus, '报名中' | '进行中' | '已结束'> = {
  registration: '报名中',
  ongoing: '进行中',
  finished: '已结束',
}

function buildSparkline(values: number[], width = 360, height = 88) {
  if (values.length <= 1) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)

  const points = values.map((v, index) => {
    const x = (index / (values.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  })

  return `M ${points.join(' L ')}`
}

function stageLabel(input: {
  status: MatchStatus
  format: 'group_only' | 'group_then_knockout'
  groupingPayload: { groups?: Array<{ players: Array<{ id: string }> }> } | null
  userId: string
  userConfirmedResults: Array<{ winnerTeamIds: string[]; loserTeamIds: string[] }>
}) {
  const { status, format, groupingPayload, userId, userConfirmedResults } = input

  if (status === 'registration') return '报名中（等待开赛）'
  if (status === 'finished') return '比赛已结束'
  if (!groupingPayload?.groups) return '分组待发布'

  const group = groupingPayload.groups.find((item) => item.players.some((player) => player.id === userId))
  if (!group) return '等待编排赛程'

  const opponents = group.players.filter((player) => player.id !== userId)
  const done = opponents.filter((opponent) =>
    userConfirmedResults.some((result) => {
      const ids = [...result.winnerTeamIds, ...result.loserTeamIds]
      return ids.includes(userId) && ids.includes(opponent.id)
    }),
  ).length

  if (done >= opponents.length && format === 'group_then_knockout') {
    return `小组赛 ${done}/${opponents.length}（已完成，等待淘汰赛）`
  }

  return `小组赛 ${done}/${opponents.length}`
}

export default async function Home() {
  const [latestMatches, currentUser] = await Promise.all([
    prisma.match.findMany({
      orderBy: [{ dateTime: 'asc' }, { createdAt: 'desc' }],
      take: 6,
      include: {
        _count: { select: { registrations: true } },
        groupingResult: { select: { id: true } },
      },
    }),
    getCurrentUser(),
  ])

  let myRegistrations: Array<{
    id: string
    createdAt: Date
    match: {
      id: string
      title: string
      dateTime: Date
      format: 'group_only' | 'group_then_knockout'
      status: MatchStatus
      groupingResult: { payload: unknown } | null
      results: Array<{ winnerTeamIds: string[]; loserTeamIds: string[] }>
    }
  }> = []
  let eloSeries: number[] = []
  let eloDelta7d = 0

  if (currentUser) {
    const [registrations, histories] = await Promise.all([
      prisma.registration.findMany({
        where: { userId: currentUser.id },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          match: {
            select: {
              id: true,
              title: true,
              dateTime: true,
              format: true,
              status: true,
              groupingResult: { select: { payload: true } },
              results: {
                where: {
                  confirmed: true,
                  OR: [{ winnerTeamIds: { has: currentUser.id } }, { loserTeamIds: { has: currentUser.id } }],
                },
                select: { winnerTeamIds: true, loserTeamIds: true },
              },
            },
          },
        },
      }),
      prisma.eloHistory.findMany({
        where: { userId: currentUser.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { eloAfter: true, createdAt: true },
      }),
    ])

    myRegistrations = registrations

    const asc = [...histories].reverse()
    eloSeries = asc.map((item) => item.eloAfter)
    if (eloSeries.length > 1) {
      const baseline = eloSeries[Math.max(0, eloSeries.length - 8)]
      eloDelta7d = eloSeries[eloSeries.length - 1] - baseline
    }
  }

  const sparkPath = buildSparkline(eloSeries)

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-700/70 bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 p-8 shadow-xl shadow-black/20 md:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.18),transparent_48%)]" />
        <div className="relative space-y-8">
          {currentUser ? (
            <div className="rounded-2xl border border-cyan-400/30 bg-slate-900/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs tracking-[0.2em] text-cyan-300">我的数据总览</p>
                  <h2 className="mt-1 text-2xl font-bold text-white">{currentUser.nickname}</h2>
                  <p className="mt-1 text-sm text-slate-300">本周 ELO 变化：<span className={eloDelta7d >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{eloDelta7d >= 0 ? '+' : ''}{eloDelta7d}</span></p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-center">
                    <p className="text-xs text-slate-400">ELO</p>
                    <p className="mt-1 text-xl font-bold text-cyan-100">{currentUser.eloRating}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-center">
                    <p className="text-xs text-slate-400">积分</p>
                    <p className="mt-1 text-xl font-bold text-cyan-100">{currentUser.points}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-center">
                    <p className="text-xs text-slate-400">战绩</p>
                    <p className="mt-1 text-xl font-bold text-cyan-100">{currentUser.wins} / {currentUser.losses}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />最近 ELO 走势</span>
                  <span>{eloSeries.length > 0 ? `最新 ${eloSeries[eloSeries.length - 1]}` : '暂无数据'}</span>
                </div>
                <svg viewBox="0 0 360 88" className="h-24 w-full" role="img" aria-label="最近 ELO 走势">
                  <path d="M0 87 H360" stroke="rgba(148,163,184,0.25)" strokeWidth="1" fill="none" />
                  {sparkPath ? <path d={sparkPath} stroke="rgb(34,211,238)" strokeWidth="3" fill="none" strokeLinecap="round" /> : null}
                </svg>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 text-sm text-slate-300">
              当前处于待登录状态。登录后可查看你的 ELO 走势、报名进度和个人比赛阶段。
              <Link href="/auth" className="ml-2 text-cyan-300 hover:text-cyan-200">去登录</Link>
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
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
        </div>
      </section>

      {currentUser && (
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">我报名的比赛</h2>
            <Link href="/matchs" className="text-sm text-cyan-300 hover:text-cyan-200">
              查看全部 →
            </Link>
          </div>

          {myRegistrations.length === 0 ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-8 text-center text-slate-300">你还没有报名比赛。</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {myRegistrations.map((registration) => {
                const payload = (registration.match.groupingResult?.payload ?? null) as { groups?: Array<{ players: Array<{ id: string }> }> } | null
                const phase = stageLabel({
                  status: registration.match.status,
                  format: registration.match.format,
                  groupingPayload: payload,
                  userId: currentUser.id,
                  userConfirmedResults: registration.match.results,
                })

                return (
                  <Link key={registration.id} href={`/matchs/${registration.match.id}`} className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5 text-slate-100 transition hover:border-cyan-400/45">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold">{registration.match.title}</h3>
                      <span className="rounded-full bg-cyan-500/15 px-2.5 py-1 text-xs text-cyan-200">{statusLabelMap[registration.match.status]}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">比赛时间：{registration.match.dateTime.toLocaleString('zh-CN')}</p>
                    <p className="mt-3 text-sm text-slate-300">当前阶段：<span className="font-medium text-cyan-100">{phase}</span></p>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      )}

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

        {latestMatches.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-8 text-center text-slate-300">
            暂无比赛，快去发布第一场比赛吧。
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {latestMatches.map((match) => (
              <MatchCard
                key={match.id}
                id={match.id}
                title={match.title}
                date={match.dateTime.toLocaleDateString('zh-CN')}
                location={match.location ?? '待定'}
                participants={match._count.registrations}
                maxParticipants={match.maxParticipants}
                status={statusLabelMap[match.status]}
                hasGrouping={Boolean(match.groupingResult)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
