'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const MOCK_RANKINGS = [
  { id: '3', nickname: '王五', eloRating: 1750, wins: 28, losses: 7, trend: 'up' as const },
  { id: '8', nickname: '郑十', eloRating: 1710, wins: 25, losses: 9, trend: 'up' as const },
  { id: '1', nickname: '张三', eloRating: 1680, wins: 22, losses: 10, trend: 'same' as const },
  { id: '5', nickname: '陈七', eloRating: 1600, wins: 20, losses: 14, trend: 'down' as const },
  { id: '6', nickname: '周八', eloRating: 1560, wins: 18, losses: 13, trend: 'up' as const },
  { id: '2', nickname: '李四', eloRating: 1520, wins: 15, losses: 15, trend: 'down' as const },
  { id: '7', nickname: '吴九', eloRating: 1490, wins: 13, losses: 16, trend: 'same' as const },
  { id: '4', nickname: '赵六', eloRating: 1430, wins: 10, losses: 18, trend: 'down' as const },
]

export default function RankingsPage() {
  const [tab, setTab] = useState<'elo' | 'points' | 'honors'>('elo')

  const trendIcon = (trend: 'up' | 'down' | 'same') => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  const rankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-2xl">🥇</span>
    if (rank === 2) return <span className="text-2xl">🥈</span>
    if (rank === 3) return <span className="text-2xl">🥉</span>
    return <span className="text-gray-500 font-mono text-lg w-8 text-center">{rank}</span>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Trophy className="w-8 h-8 text-yellow-500" />
        <h1 className="text-3xl font-bold">排行榜</h1>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 border-b">
        {[
          { key: 'elo', label: 'ELO 排名' },
          { key: 'points', label: '积分排名' },
          { key: 'honors', label: '荣誉榜' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as 'elo' | 'points' | 'honors')}
            className={`px-6 py-3 font-medium transition border-b-2 -mb-px ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 排名表格 */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-sm text-gray-500">
              <th className="text-left px-6 py-4 w-16">排名</th>
              <th className="text-left px-6 py-4">选手</th>
              <th className="text-center px-6 py-4">ELO</th>
              <th className="text-center px-6 py-4">胜/负</th>
              <th className="text-center px-6 py-4">胜率</th>
              <th className="text-center px-6 py-4 w-16">趋势</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {MOCK_RANKINGS.map((player, index) => {
              const winRate = Math.round(
                (player.wins / (player.wins + player.losses)) * 100
              )
              return (
                <tr key={player.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">{rankBadge(index + 1)}</td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/users/${player.id}`}
                      className="flex items-center gap-3 hover:text-blue-600"
                    >
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                        {player.nickname[0]}
                      </div>
                      <span className="font-medium">{player.nickname}</span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-center font-bold">
                    {player.eloRating}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-green-600">{player.wins}胜</span>
                    {' / '}
                    <span className="text-red-500">{player.losses}负</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <progress
                        className="w-20 h-2"
                        value={winRate}
                        max={100}
                        aria-label="胜率"
                      />
                      <span className="text-sm text-gray-600">{winRate}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 flex justify-center">
                    {trendIcon(player.trend)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}