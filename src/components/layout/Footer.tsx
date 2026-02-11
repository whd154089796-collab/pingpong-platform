export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} USTC TTA · 乒乓球竞技平台</p>
        <div className="flex items-center gap-4">
          <a className="transition hover:text-slate-200" href="/乒协徽章.pdf" target="_blank" rel="noreferrer">
            乒协徽章
          </a>
          <a className="transition hover:text-slate-200" href="/25周年徽章.pdf" target="_blank" rel="noreferrer">
            25周年徽章
          </a>
        </div>
      </div>
    </footer>
  )
}
