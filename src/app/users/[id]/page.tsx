import Link from 'next/link'
import { ArrowLeft, Trophy, Target, TrendingUp } from 'lucide-react'

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // 模拟数据
  const user = {
    id,
    nickname: '张三',
    avatar: null,
    points: 1250,
    eloRating: 1680,
    wins: 22,
    losses: 10,
    matchesPlayed: 32,
    badges: ['🏆 春季联赛冠军', '🔥 五连胜', '⭐ 月度之星'],
    recentMatches: [
      { id: '1', opponent: '李四', result: 'win', score: '3:1', date: '2026-02-05' },
      { id: '2', opponent: '王五', result: 'loss', score: '1:3', date: '2026-01-28' },
      { id: '3', opponent: '赵六', result: 'win', score: '3:0', date: '2026-01-20' },
      { id: '4', opponent: '陈七', result: 'win', score: '3:2', date: '2026-01-15' },
      { id: '5', opponent: '周八', result: 'win', score: '3:1', date: '2026-01-10' },
    ],
  }

  const winRate = Math.round((user.wins / user.matchesPlayed) * 100)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link
        href="/rankings"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        返回排行榜
      </Link>

      {/* 用户头卡 */}
      <div className="bg-linear-to-r from-blue-500 to-blue-700 rounded-lg p-8 text-white">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center text-4xl font-bold">
            {user.nickname[0]}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{user.nickname}</h1>
            <p className="text-blue-100 mt-1">乒乓球爱好者</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mt-8">
          <div className="text-center">
            <p className="text-3xl font-bold">{user.eloRating}</p>
            <p className="text-blue-200 text-sm">ELO 评分</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{user.points}</p>
            <p className="text-blue-200 text-sm">积分</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{winRate}%</p>
            <p className="text-blue-200 text-sm">胜率</p>
          </div>
        </div>
      </div>

      {/* 数据统计 */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white border rounded-lg p-6 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <Trophy className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{user.wins}</p>
            <p className="text-gray-500 text-sm">胜场</p>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-6 flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-lg">
            <Target className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{user.losses}</p>
            <p className="text-gray-500 text-sm">负场</p>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-6 flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{user.matchesPlayed}</p>
            <p className="text-gray-500 text-sm">总场次</p>
          </div>
        </div>
      </div>

      {/* 荣誉徽章 */}
      <div className="bg-white border rounded-lg p-8">
        <h2 className="text-xl font-bold mb-4">荣誉墙</h2>
        <div className="flex flex-wrap gap-3">
          {user.badges.map((badge, index) => (
            <span
              key={index}
              className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-full text-sm"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* 最近比赛记录 */}
      <div className="bg-white border rounded-lg p-8">
        <h2 className="text-xl font-bold mb-4">最近战绩</h2>
        <div className="space-y-3">
          {user.recentMatches.map((match) => (
            <div
              key={match.id}
              className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
            >
              <div className="flex items-center gap-4">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-bold ${
                    match.result === 'win'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {match.result === 'win' ? '胜' : '负'}
                </span>
                <span className="font-medium">vs {match.opponent}</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="font-mono text-lg font-bold">
                  {match.score}
                </span>
                <span className="text-sm text-gray-500">{match.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}