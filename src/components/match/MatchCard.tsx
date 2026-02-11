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
    '报名中': 'bg-green-100 text-green-800',
    '进行中': 'bg-blue-100 text-blue-800',
    '已结束': 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[status]}`}>
          {status}
        </span>
        <span className="text-gray-500 text-sm">{date}</span>
      </div>

      <h3 className="text-xl font-bold mb-4">{title}</h3>

      <div className="space-y-2 mb-6 text-gray-600">
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
          className="flex-1 text-center py-2 border rounded hover:bg-gray-50"
        >
          查看详情
        </Link>
        {status === '报名中' && (
          <button className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            立即报名
          </button>
        )}
      </div>
    </div>
  )
}