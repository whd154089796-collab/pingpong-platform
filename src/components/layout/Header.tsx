'use client'

import Link from 'next/link'
import { Menu, Trophy } from 'lucide-react'
import { useState } from 'react'

const mobileNav = [
  { href: '/', label: '首页' },
  { href: '/matchs', label: '比赛大厅' },
  { href: '/matchs/create', label: '发布比赛' },
  { href: '/rankings', label: '排行榜' },
  { href: '/profile', label: '个人中心' },
]

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700/70 bg-slate-900/90 backdrop-blur-xl lg:hidden">
      <nav className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-white">
            <Trophy className="text-cyan-300" />
            <span>USTC TTA</span>
          </Link>

          <button
            type="button"
            className="rounded-lg border border-slate-600 p-2 text-slate-200"
            aria-label="打开菜单"
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {isMenuOpen && (
          <div className="space-y-2 pb-4">
            {mobileNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <a
              href="/25周年徽章.pdf"
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
            >
              查看 25 周年徽章
            </a>
          </div>
        )}
      </nav>
    </header>
  )
}
