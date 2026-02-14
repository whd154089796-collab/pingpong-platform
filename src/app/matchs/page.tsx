import Link from 'next/link'
import MatchCard from '@/components/match/MatchCard'
import { prisma } from '@/lib/prisma'
import { ensureGroupingGenerated } from '@/app/matchs/actions'

const statusLabelMap = {
  registration: '报名中',
  ongoing: '进行中',
  finished: '已结束',
} as const

export default async function MatchesPage() {
  const matches = await prisma.match.findMany({
    include: {
      _count: { select: { registrations: true } },
      groupingResult: true,
    },
    orderBy: { dateTime: 'asc' },
  })

  await Promise.all(matches.map((m) => ensureGroupingGenerated(m.id)))

  const refreshed = await prisma.match.findMany({
    include: {
      _count: { select: { registrations: true } },
      groupingResult: true,
    },
    orderBy: { dateTime: 'asc' },
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-3xl font-bold text-white">比赛大厅</h1>
        <Link href="/matchs/create" className="inline-block rounded-lg bg-cyan-600 px-6 py-2 text-center text-white transition hover:bg-cyan-700">
          + 发布比赛
        </Link>
      </div>

      {refreshed.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {refreshed.map((match) => (
            <MatchCard
              key={match.id}
              id={match.id}
              title={match.title}
              date={new Date(match.dateTime).toLocaleDateString('zh-CN')}
              location={match.location ?? '待定'}
              participants={match._count.registrations}
              maxParticipants={match.maxParticipants}
              status={statusLabelMap[match.status]}
              hasGrouping={Boolean(match.groupingResult)}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-slate-400">
          <p className="mb-2 text-xl">当前还没有比赛</p>
          <p>快去创建第一场比赛吧</p>
        </div>
      )}
    </div>
  )
}
