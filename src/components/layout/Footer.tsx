import Link from 'next/link'
import { Trophy } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* 品牌区 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-white font-bold text-xl">
              <Trophy className="text-cyan-400" />
              <span>乒乓球平台</span>
            </div>
            <p className="text-sm">
              记录每一次精彩对决，见证你的成长。
              专业的乒乓球比赛管理和竞技数据平台。
            </p>
          </div>

          {/* 快速链接 */}
          <div>
            <h3 className="text-white font-semibold mb-4">快速链接</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/matches" className="hover:text-white transition">
                  比赛大厅
                </Link>
              </li>
              <li>
                <Link href="/rankings" className="hover:text-white transition">
                  排行榜
                </Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-white transition">
                  球员社区
                </Link>
              </li>
            </ul>
          </div>

          {/* 帮助 */}
          <div>
            <h3 className="text-white font-semibold mb-4">帮助与支持</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:text-white transition">
                  关于我们
                </Link>
              </li>
              <li>
                <Link href="/rules" className="hover:text-white transition">
                  比赛规则
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-white transition">
                  常见问题
                </Link>
              </li>
            </ul>
          </div>

          {/* 联系方式 */}
          <div>
            <h3 className="text-white font-semibold mb-4">联系我们</h3>
            <ul className="space-y-2 text-sm">
              <li>📧 contact@pingpong.com</li>
              <li>📱 关注微信公众号</li>
              <li>💬 加入QQ群交流</li>
            </ul>
          </div>
        </div>

        {/* 底部版权 */}
        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm">
          <p>© {new Date().getFullYear()} 乒乓球竞技平台. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}