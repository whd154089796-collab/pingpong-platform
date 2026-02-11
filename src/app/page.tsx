import Link from 'next/link'
import { Trophy, Calendar, Users } from 'lucide-react'
import MatchCard from '@/components/match/MatchCard'

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-12 bg-linear-to-r from-blue-500 to-green-500 rounded-lg text-white">
        <h1 className="text-5xl font-bold mb-4">乒乓球竞技平台</h1>
        <p className="text-xl mb-8">记录每一次精彩对决，见证你的成长</p>
        <div className="flex gap-4 justify-center">
          <Link 
            href="/matches/create"
            className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100"
          >
            发布比赛
          </Link>
          <Link 
            href="/matches"
            className="border-2 border-white px-6 py-3 rounded-lg font-semibold hover:bg-white/10"
          >
            浏览比赛
          </Link>
        </div>
      </section>

      {/* Quick Links */}
      <section className="grid md:grid-cols-3 gap-6">
        <QuickLinkCard
          icon={<Calendar className="w-8 h-8" />}
          title="比赛大厅"
          description="查看最新赛事，立即报名参赛"
          href="/matches"
        />
        <QuickLinkCard
          icon={<Trophy className="w-8 h-8" />}
          title="排行榜"
          description="查看积分和ELO排名"
          href="/rankings"
        />
        <QuickLinkCard
          icon={<Users className="w-8 h-8" />}
          title="球员社区"
          description="认识更多乒乓球爱好者"
          href="/community"
        />
      </section>

      {/* Latest Matches */}
      <section>
        <h2 className="text-3xl font-bold mb-6">最新比赛</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 这里后续会从API获取数据 */}
          <MatchCard
            id="1"
            title="春季联赛"
            date="2026-03-15"
            location="体育馆"
            participants={8}
            maxParticipants={16}
            status="报名中"
          />
          {/* 更多比赛卡片... */}
        </div>
      </section>
    </div>
  )
}

function QuickLinkCard({ icon, title, description, href }: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
}) {
  return (
    <Link href={href}>
      <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow cursor-pointer">
        <div className="text-blue-600 mb-4">{icon}</div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>
    </Link>
  )
}
