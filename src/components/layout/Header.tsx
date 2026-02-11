'use client'

import Link from 'next/link'
import { Trophy, Menu } from 'lucide-react'
import { useState } from 'react'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="bg-gray-800 sticky top-0 z-50 shadow-sm text-white">
      <nav className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-white">
            <Trophy className="text-cyan-400" />
            <span>乒乓球平台</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/matches" className="text-gray-300 hover:text-white transition">
              比赛大厅
            </Link>
            <Link href="/rankings" className="text-gray-300 hover:text-white transition">
              排行榜
            </Link>
            <Link href="/community" className="text-gray-300 hover:text-white transition">
              社区
            </Link>
          </div>

          {/* User Section */}
          <div className="hidden md:flex items-center gap-4">
            <Link 
              href="/profile"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition"
            >
              <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white">
                用
              </div>
              <span>我的主页</span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden"
            aria-label="打开菜单"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <Menu />
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 space-y-4 text-gray-300">
            <Link href="/matches" className="block hover:text-white transition">
              比赛大厅
            </Link>
            <Link href="/rankings" className="block hover:text-white transition">
              排行榜
            </Link>
            <Link href="/community" className="block hover:text-white transition">
              社区
            </Link>
            <Link href="/profile" className="block hover:text-white transition">
              我的主页
            </Link>
          </div>
        )}
      </nav>
    </header>
  )
}