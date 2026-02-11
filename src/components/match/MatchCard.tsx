import Link from 'next/link'
import { MapPin, Users } from 'lucide-react'

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
  const statusColors = {
    '报名中': 'bg-green-600 text-white',
    '进行中': 'bg-blue-600 text-white',
    '已结束': 'bg-gray-600 text-white'
  }

  return (
    <div className="bg-gray-700 border border-gray-600 rounded-lg p-6 hover:shadow-lg transition-shadow text-white">
      <div className="flex justify-between items-start mb-4">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[status]}`}>
          {status}
        </span>
        <span className="text-gray-300 text-sm">{date}</span>
      </div>

      <h3 className="text-xl font-bold mb-4 text-white">{title}</h3>

      <div className="space-y-2 mb-6 text-gray-200">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          <span>{location}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span>{participants}/{maxParticipants} 人</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Link 
          href={`/matches/${id}`}
          className="flex-1 text-center py-2 border border-gray-600 rounded text-white hover:bg-gray-600 transition"
        >
          查看详情
        </Link>
        {status === '报名中' && (
          <button className="flex-1 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition">
            立即报名
          </button>
        )}
      </div>
    </div>
  )
}