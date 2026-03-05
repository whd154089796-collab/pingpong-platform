"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";

const ADMIN_MODE_COOKIE = "ustc_tta_admin_mode";
const ADMIN_MODE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type AdminMode = "admin" | "user";

function writeCookie(name: string, value: string, options: { maxAge: number }) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  parts.push(`Path=/`);
  parts.push(`Max-Age=${options.maxAge}`);
  parts.push(`SameSite=Lax`);
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    parts.push("Secure");
  }
  document.cookie = parts.join("; ");
}

export default function AdminModeToggle({
  initialMode,
}: {
  initialMode: AdminMode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const nextMode = useMemo<AdminMode>(
    () => (initialMode === "admin" ? "user" : "admin"),
    [initialMode],
  );

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          writeCookie(ADMIN_MODE_COOKIE, nextMode, {
            maxAge: ADMIN_MODE_COOKIE_MAX_AGE_SECONDS,
          });
          router.refresh();
        });
      }}
      className="mt-4 w-full rounded-xl border border-slate-700/60 bg-slate-950/30 px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-60"
      aria-label={
        initialMode === "admin" ? "切换到普通视图" : "切换到管理员视图"
      }
    >
      <p className="text-[11px] text-slate-400">工作模式</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">
        {initialMode === "admin" ? "管理员视图" : "普通视图"}
        <span className="ml-2 text-xs font-normal text-cyan-200">
          {pending
            ? "切换中..."
            : initialMode === "admin"
              ? "点击切换"
              : "点击切换"}
        </span>
      </p>
    </button>
  );
}
