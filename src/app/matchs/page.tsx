'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import MatchCard from '@/components/match/MatchCard'

const MOCK_MATCHES = [
  {
    id: '1',
    title: '春季乒乓球联赛',
    date: '2026-03-15',
    location: '市体育馆',
    participants: 8,
    maxParticipants: 16,
    status: '报名中' as const,
  },
  {
    id: '2',
    title: '周末友谊赛',
    date: '2026-02-14',
    location: '社区活动中心',
    participants: 6,
    maxParticipants: 8,
    status: '进行中' as const,
  },
  {
    id: '3',
    title: '新年杯挑战赛',
    date: '2026-01-20',
    location: '大学体育馆',
    participants: 16,
    maxParticipants: 16,
    status: '已结束' as const,
  },
  {
    id: '4',
    title: '公司内部赛',
    date: '2026-03-01',
    location: '公司活动室',
    participants: 4,
    maxParticipants: 12,
    status: '报名中' as const,
  },
]

export default function MatchesPage() {
  const [filter, setFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredMatches = MOCK_MATCHES.filter((match) => {
    const matchesFilter = filter === 'all' || match.status === filter
    const matchesSearch = match.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-white">比赛大厅</h1>
        <Link
          href="/matchs/create"
          className="inline-block bg-cyan-600 text-white px-6 py-2 rounded-lg hover:bg-cyan-700 transition text-center"
        >
          + 发布比赛
        </Link>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="搜索比赛..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <div className="flex gap-2">
          {['all', '报名中', '进行中', '已结束'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === status
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {status === 'all' ? '全部' : status}
            </button>
          ))}
        </div>
      </div>

      {/* 比赛列表 */}
      {filteredMatches.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMatches.map((match) => (
            <MatchCard key={match.id} {...match} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-xl mb-2">没有找到匹配的比赛</p>
          <p>试试调整筛选条件或搜索关键词</p>
        </div>
      )}
    </div>
  )
}
