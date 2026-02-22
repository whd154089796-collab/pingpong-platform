import Link from "next/link";
import { CalendarDays, Clock3, MapPin, Users } from "lucide-react";

interface MatchCardProps {
  id: string;
  title: string;
  type: "single" | "double" | "team";
  matchTime: string;
  registrationDeadline: string;
  location: string;
  participants: number;
  status: "报名中" | "进行中" | "已结束";
}

function formatMatchDateParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      dateText: value,
      weekText: "周-",
      timeText: "--:--",
      fullText: value,
    };
  }

  const weekMap = ["日", "一", "二", "三", "四", "五", "六"];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const week = weekMap[date.getDay()];
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return {
    dateText: `${year}年${month}月${day}日`,
    weekText: `周${week}`,
    timeText: `${hour}:${minute}`,
    fullText: `${year}年${month}月${day}日（周${week}） ${hour}:${minute}`,
  };
}

export default function MatchCard({
  id,
  title,
  type,
  matchTime,
  registrationDeadline,
  location,
  participants,
  status,
}: MatchCardProps) {
  const matchTimeParts = formatMatchDateParts(matchTime);
  const deadlineParts = formatMatchDateParts(registrationDeadline);

  const statusStyles = {
    报名中: {
      badge: "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/50",
      glow: "hover:shadow-emerald-500/15",
    },
    进行中: {
      badge: "bg-sky-500/25 text-sky-200 ring-1 ring-sky-400/50",
      glow: "hover:shadow-sky-500/15",
    },
    已结束: {
      badge: "bg-slate-500/30 text-slate-200 ring-1 ring-slate-300/40",
      glow: "hover:shadow-slate-500/10",
    },
  };

  const typeLabelMap = {
    single: "单打",
    double: "双打",
    team: "团体",
  } as const;

  return (
    <Link
      href={`/matchs/${id}`}
      className={`group relative overflow-hidden rounded-2xl border border-slate-600/70 bg-linear-to-br from-slate-800 via-slate-800 to-slate-900 p-6 text-white shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/45 ${statusStyles[status].glow}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.15),transparent_55%)] opacity-70" />

      <div className="relative">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${statusStyles[status].badge}`}
            >
              {status}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-500/60 bg-slate-800/80 px-3 py-1 text-xs font-semibold tracking-wide text-slate-200">
              {typeLabelMap[type]}
            </span>
          </div>
          <span className="text-xs text-slate-400">查看详情</span>
        </div>

        <h3 className="mb-5 text-xl font-bold leading-tight text-white/95">
          {title}
        </h3>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-700/80 bg-slate-900/45 p-3">
            <div className="mb-2 flex items-center gap-2 text-slate-300">
              <CalendarDays className="h-4 w-4 text-cyan-300" />
              <span className="text-xs tracking-wide">比赛时间</span>
            </div>
            <div className="space-y-2" title={matchTimeParts.fullText}>
              <p className="text-sm text-slate-100">
                {matchTimeParts.dateText}
              </p>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-md border border-slate-600 bg-slate-800/80 px-2 text-xs text-slate-200">
                  {matchTimeParts.weekText}
                </span>
                <span className="inline-flex h-6 items-center rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2 font-mono text-xs tabular-nums text-cyan-200">
                  {matchTimeParts.timeText}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/80 bg-slate-900/45 p-3">
            <div className="mb-2 flex items-center gap-2 text-slate-300">
              <Clock3 className="h-4 w-4 text-cyan-300" />
              <span className="text-xs tracking-wide">报名截止</span>
            </div>
            <div className="space-y-2" title={deadlineParts.fullText}>
              <p className="text-sm text-slate-100">{deadlineParts.dateText}</p>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-md border border-slate-600 bg-slate-800/80 px-2 text-xs text-slate-200">
                  {deadlineParts.weekText}
                </span>
                <span className="inline-flex h-6 items-center rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2 font-mono text-xs tabular-nums text-cyan-200">
                  {deadlineParts.timeText}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/80 bg-slate-900/45 p-3">
            <div className="mb-2 flex items-center gap-2 text-slate-300">
              <MapPin className="h-4 w-4 text-cyan-300" />
              <span className="text-xs tracking-wide">比赛地点</span>
            </div>
            <p className="truncate text-sm text-slate-100" title={location}>
              {location}
            </p>
          </div>

          <div className="rounded-xl border border-slate-700/80 bg-slate-900/45 p-3">
            <div className="mb-2 flex items-center gap-2 text-slate-300">
              <Users className="h-4 w-4 text-cyan-300" />
              <span className="text-xs tracking-wide">
                {type === "double" ? "目前组数" : "报名人数"}
              </span>
            </div>
            <p className="text-sm text-slate-100">
              {type === "double"
                ? `${Math.floor(participants / 2)} 组`
                : `${participants} 人`}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
