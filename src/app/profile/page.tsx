import Link from 'next/link'
import { Settings, Calendar, BarChart3 } from 'lucide-react'

export default function ProfilePage() {
  // 模拟当前登录用户
  const currentUser = {
    nickname: '张三',
    eloRating: 1680,
    points: 1250,
    myMatches: [
      { id: '1', title: '春季乒乓球联赛', role: '参赛者', status: '报名中' },
      { id: '2', title: '周末友谊赛', role: '组织者', status: '进行中' },
    ],
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-white">个人中心</h1>

      {/* 快捷导航 */}
      <div className="grid md:grid-cols-3 gap-6">
        <Link
          href="/users/1"
          className="flex items-center gap-4 p-6 bg-gray-700 border border-gray-600 rounded-lg hover:shadow-lg transition text-white"
        >
          <BarChart3 className="w-8 h-8 text-cyan-400" />
          <div>
            <p className="font-semibold">我的主页</p>
            <p className="text-sm text-gray-300">查看公开个人资料</p>
          </div>
        </Link>
        <Link
          href="/matchs"
          className="flex items-center gap-4 p-6 bg-gray-700 border border-gray-600 rounded-lg hover:shadow-lg transition text-white"
        >
          <Calendar className="w-8 h-8 text-green-400" />
          <div>
            <p className="font-semibold">我的比赛</p>
            <p className="text-sm text-gray-300">{currentUser.myMatches.length} 场进行中</p>
          </div>
        </Link>
        <Link
          href="#"
          className="flex items-center gap-4 p-6 bg-gray-700 border border-gray-600 rounded-lg hover:shadow-lg transition text-white"
        >
          <Settings className="w-8 h-8 text-gray-400" />
          <div>
            <p className="font-semibold">账号设置</p>
            <p className="text-sm text-gray-300">头像、昵称、密码</p>
          </div>
        </Link>
      </div>

      {/* 我的比赛 */}
      <div className="bg-gray-700 border border-gray-600 rounded-lg p-8">
        <h2 className="text-xl font-bold mb-4 text-white">我的比赛</h2>
        <div className="space-y-3">
          {currentUser.myMatches.map((match) => (
            <Link
              key={match.id}
              href={`/matchs/${match.id}`}
              className="flex items-center justify-between p-4 rounded-lg bg-gray-600 hover:bg-gray-500 transition text-white"
            >
              <div>
                <p className="font-medium">{match.title}</p>
                <p className="text-sm text-gray-300">{match.role}</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  match.status === '报名中'
                    ? 'bg-green-600 text-white'
                    : match.status === '进行中'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-600 text-white'
                }`}
              >
                {match.status}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}