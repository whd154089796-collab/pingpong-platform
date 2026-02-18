import Link from 'next/link'
import { MatchStatus } from '@prisma/client'
import MatchCard from '@/components/match/MatchCard'
import { prisma } from '@/lib/prisma'

const statusLabelMap: Record<MatchStatus, '报名中' | '进行中' | '已结束'> = {
  registration: '报名中',
  ongoing: '进行中',
  finished: '已结束',
}

export default async function Home() {
  const latestMatches = await prisma.match.findMany({
    orderBy: [{ dateTime: 'asc' }, { createdAt: 'desc' }],
    take: 6,
    include: {
      _count: { select: { registrations: true } },
      groupingResult: { select: { id: true } },
    },
  })

  return (
    <div className="space-y-10">
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
