import Link from 'next/link'
import { CalendarDays, MapPin, Users } from 'lucide-react'

interface MatchCardProps {
  id: string
  title: string
  date: string
  location: string
  participants: number
  maxParticipants: number
  status: '报名中' | '进行中' | '已结束'
}

export default function MatchCard({
  id,
  title,
  date,
  location,
  participants,
  maxParticipants,
  status
}: MatchCardProps) {
  const statusStyles = {
    '报名中': {
      badge: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40',
      glow: 'hover:shadow-emerald-500/15'
    },
    '进行中': {
      badge: 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40',
      glow: 'hover:shadow-sky-500/15'
    },
    '已结束': {
      badge: 'bg-slate-500/25 text-slate-300 ring-1 ring-slate-300/30',
      glow: 'hover:shadow-slate-500/10'
    }
  }

  const participationRate = Math.min((participants / maxParticipants) * 100, 100)

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-600/70 bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 p-6 text-white shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/45 ${statusStyles[status].glow}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.15),transparent_55%)] opacity-70" />

      <div className="relative">
        <div className="mb-5 flex items-start justify-between gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${statusStyles[status].badge}`}
          >
            {status}
          </span>
          <div className="flex items-center gap-1.5 text-sm text-slate-300">
            <CalendarDays className="h-4 w-4 text-cyan-300" />
            <span>{date}</span>
          </div>
        </div>

        <h3 className="mb-5 text-xl font-bold leading-tight text-white/95">{title}</h3>

        <div className="mb-6 space-y-3 text-slate-200">
          <div className="flex items-center gap-2.5">
            <MapPin className="h-4 w-4 text-cyan-300" />
            <span className="text-sm md:text-base">{location}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-cyan-300" />
            <span className="text-sm md:text-base">{participants}/{maxParticipants} 人</span>
          </div>
          <div className="pt-1">
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-300">
              <span>报名进度</span>
              <span>{Math.round(participationRate)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-700/90">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                style={{ width: `${participationRate}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2.5">
          <Link
            href={`/matches/${id}`}
            className="flex-1 rounded-lg border border-slate-500/80 py-2.5 text-center text-sm font-medium text-slate-100 transition hover:border-cyan-400/70 hover:bg-cyan-500/10"
          >
            查看详情
          </Link>
          {status === '报名中' && (
            <button className="flex-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-900/40 transition hover:brightness-110">
              立即报名
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
