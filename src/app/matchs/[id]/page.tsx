import { Calendar, MapPin, Users, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // 模拟数据，后续替换为 API 调用
  const match = {
    id,
    title: '春季乒乓球联赛',
    description:
      '面向所有乒乓球爱好者的春季联赛，采用单淘汰制，欢迎各水平选手参加！',
    date: '2026-03-15',
    time: '14:00 - 18:00',
    location: '市体育馆 3号厅',
    type: '单打',
    status: '报名中',
    maxParticipants: 16,
    participants: [
      { id: '1', nickname: '张三', eloRating: 1680 },
      { id: '2', nickname: '李四', eloRating: 1520 },
      { id: '3', nickname: '王五', eloRating: 1750 },
      { id: '4', nickname: '赵六', eloRating: 1430 },
      { id: '5', nickname: '陈七', eloRating: 1600 },
      { id: '6', nickname: '周八', eloRating: 1560 },
      { id: '7', nickname: '吴九', eloRating: 1490 },
      { id: '8', nickname: '郑十', eloRating: 1710 },
    ],
    rules: [
      '每场比赛采用五局三胜制',
      '每局 11 分制',
      '发球每 2 分轮换',
      '迟到 15 分钟视为弃权',
    ],
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* 返回按钮 */}
      <Link
        href="/matchs"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        返回比赛列表
      </Link>

      {/* 头部信息 */}
      <div className="bg-white border rounded-lg p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              {match.status}
            </span>
            <h1 className="text-3xl font-bold mt-3">{match.title}</h1>
            <p className="text-gray-600 mt-2">{match.description}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-400">时间</p>
              <p>{match.date} {match.time}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-400">地点</p>
              <p>{match.location}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-400">参赛人数</p>
              <p>{match.participants.length}/{match.maxParticipants} 人</p>
            </div>
          </div>
        </div>

        <button className="w-full mt-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
          立即报名
        </button>
      </div>

      {/* 比赛规则 */}
      <div className="bg-white border rounded-lg p-8">
        <h2 className="text-xl font-bold mb-4">比赛规则</h2>
        <ul className="space-y-2">
          {match.rules.map((rule, index) => (
            <li key={index} className="flex items-start gap-2 text-gray-600">
              <span className="text-blue-600 font-bold">{index + 1}.</span>
              {rule}
            </li>
          ))}
        </ul>
      </div>

      {/* 已报名选手 */}
      <div className="bg-white border rounded-lg p-8">
        <h2 className="text-xl font-bold mb-4">
          已报名选手（{match.participants.length}）
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {match.participants.map((player, index) => (
            <Link
              key={player.id}
              href={`/users/${player.id}`}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition"
            >
              <span className="text-gray-400 font-mono w-6">
                {index + 1}
              </span>
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                {player.nickname[0]}
              </div>
              <div className="flex-1">
                <p className="font-medium">{player.nickname}</p>
                <p className="text-sm text-gray-500">
                  ELO: {player.eloRating}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}