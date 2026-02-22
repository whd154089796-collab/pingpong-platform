"use client";

import { useActionState, useMemo, useState } from "react";
import {
  adminDashboardAction,
  type AdminDashboardState,
} from "@/app/admin/actions";

const initialAdminDashboardState: AdminDashboardState = {
  unlocked: false,
  users: [],
  matches: [],
};

const USERS_PER_PAGE = 20;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN");
}

export default function AdminDashboardClient() {
  const [state, formAction, pending] = useActionState(
    adminDashboardAction,
    initialAdminDashboardState,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sortBy, setSortBy] = useState<
    "lastActivityDesc" | "lastActivityAsc" | "nicknameAsc" | "nicknameDesc"
  >("lastActivityDesc");

  const filteredAndSortedUsers = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    const filtered = keyword
      ? state.users.filter((user) => {
          const nickname = user.nickname.toLowerCase();
          const email = user.email.toLowerCase();
          return nickname.includes(keyword) || email.includes(keyword);
        })
      : state.users;

    return [...filtered].sort((a, b) => {
      if (sortBy === "lastActivityDesc") {
        return (
          new Date(b.lastActivityAt).getTime() -
          new Date(a.lastActivityAt).getTime()
        );
      }
      if (sortBy === "lastActivityAsc") {
        return (
          new Date(a.lastActivityAt).getTime() -
          new Date(b.lastActivityAt).getTime()
        );
      }
      if (sortBy === "nicknameAsc") {
        return a.nickname.localeCompare(b.nickname, "zh-CN");
      }

      return b.nickname.localeCompare(a.nickname, "zh-CN");
    });
  }, [searchKeyword, sortBy, state.users]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedUsers.length / USERS_PER_PAGE),
  );
  const safePage = Math.min(currentPage, totalPages);
  const allUserIdSet = useMemo(
    () => new Set(state.users.map((user) => user.id)),
    [state.users],
  );
  const validSelectedUserIds = useMemo(
    () => selectedUserIds.filter((id) => allUserIdSet.has(id)),
    [selectedUserIds, allUserIdSet],
  );

  const pagedUsers = useMemo(() => {
    const start = (safePage - 1) * USERS_PER_PAGE;
    return filteredAndSortedUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredAndSortedUsers, safePage]);

  const selectedUserIdSet = useMemo(
    () => new Set(validSelectedUserIds),
    [validSelectedUserIds],
  );

  const allCurrentPageSelected =
    pagedUsers.length > 0 &&
    pagedUsers.every((user) => selectedUserIdSet.has(user.id));

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const toggleCurrentPage = () => {
    if (allCurrentPageSelected) {
      const removeSet = new Set(pagedUsers.map((user) => user.id));
      setSelectedUserIds((prev) => prev.filter((id) => !removeSet.has(id)));
      return;
    }

    const nextSet = new Set(selectedUserIds);
    pagedUsers.forEach((user) => nextSet.add(user.id));
    setSelectedUserIds(Array.from(nextSet));
  };

  if (!state.unlocked) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-700 bg-slate-900/80 p-8">
        <h1 className="text-2xl font-bold text-white">管理员控制台</h1>
        <p className="mt-3 text-sm text-slate-300">
          出于安全要求，每次进入管理员页都需要邮箱二次验证。
        </p>

        <form action={formAction} className="mt-6">
          <input type="hidden" name="csrfToken" value="" />
          <input type="hidden" name="intent" value="sendEmailChallenge" />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-cyan-500/40 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-60"
          >
            {pending ? "发送中..." : "发送邮箱验证码"}
          </button>
        </form>

        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="csrfToken" value="" />
          <input type="hidden" name="intent" value="reauth" />
          <label className="block space-y-1 text-sm text-slate-300">
            <span>邮箱验证码</span>
            <input
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              onInput={(event) => {
                const target = event.currentTarget;
                target.value = target.value.replace(/[^0-9]/g, "").slice(0, 6);
              }}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              placeholder="请输入 6 位验证码"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-cyan-500/40 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-60"
          >
            {pending ? "验证中..." : "验证并进入管理员控制台"}
          </button>
        </form>

        {state.success ? (
          <p className="mt-3 text-sm text-emerald-300">{state.success}</p>
        ) : null}
        {state.error ? (
          <p className="mt-3 text-sm text-rose-300">{state.error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
        <h1 className="text-2xl font-bold text-white">管理员控制台</h1>
        <p className="mt-2 text-sm text-slate-400">
          可管理用户封禁/删除/资料编辑，批量创建测试账号，并批量加入比赛。
        </p>
        {state.success ? (
          <p className="mt-3 text-sm text-emerald-300">{state.success}</p>
        ) : null}
        {state.error ? (
          <p className="mt-3 text-sm text-rose-300">{state.error}</p>
        ) : null}
      </section>

      <section className="grid gap-6">
        <form
          action={formAction}
          className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6"
        >
          <input type="hidden" name="csrfToken" value="" />
          <input type="hidden" name="intent" value="createTestAccounts" />
          <h2 className="text-lg font-semibold text-white">批量创建测试账号</h2>
          <div className="mt-4 grid gap-3">
            <label className="space-y-1 text-sm text-slate-300">
              <span>邮箱前缀</span>
              <input
                name="prefix"
                defaultValue="test"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-300">
              <span>数量（1-200）</span>
              <input
                type="number"
                name="count"
                min={1}
                max={200}
                defaultValue={20}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-300">
              <span>统一密码</span>
              <input
                type="password"
                name="password"
                required
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="mt-4 rounded-md border border-cyan-500/40 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-60"
          >
            {pending ? "创建中..." : "批量创建测试账号"}
          </button>

          {state.createdTestAccounts && state.createdTestAccounts.length > 0 ? (
            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/40 p-3">
              <p className="text-xs text-slate-400">最近创建账号（前 20 条）</p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-slate-200">
                {state.createdTestAccounts.slice(0, 20).map((email) => (
                  <li key={email}>{email}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </form>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
        <h2 className="text-lg font-semibold text-white">用户管理</h2>
        <p className="mt-1 text-xs text-slate-400">
          字段：邮箱、昵称、头像、最后活动时间。支持搜索、排序、分页浏览、多选、批量封禁、批量删除、修改昵称和头像。
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-300">
            <span>搜索用户（昵称或邮箱）</span>
            <input
              value={searchKeyword}
              onChange={(event) => {
                setCurrentPage(1);
                setSearchKeyword(event.target.value);
              }}
              placeholder="输入昵称或邮箱关键词"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-300">
            <span>排序方式</span>
            <select
              value={sortBy}
              onChange={(event) => {
                setCurrentPage(1);
                setSortBy(
                  event.target.value as
                    | "lastActivityDesc"
                    | "lastActivityAsc"
                    | "nicknameAsc"
                    | "nicknameDesc",
                );
              }}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
            >
              <option value="lastActivityDesc">最后活跃时间（最近优先）</option>
              <option value="lastActivityAsc">最后活跃时间（最早优先）</option>
              <option value="nicknameAsc">昵称（A-Z）</option>
              <option value="nicknameDesc">昵称（Z-A）</option>
            </select>
          </label>
        </div>

        <form
          action={formAction}
          className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4"
        >
          <input type="hidden" name="csrfToken" value="" />
          <input type="hidden" name="intent" value="bulkRegisterMatch" />
          <input
            type="hidden"
            name="selectedUserIds"
            value={validSelectedUserIds.join(",")}
          />
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="space-y-1 text-sm text-slate-300">
              <span>将已勾选用户批量加入比赛</span>
              <select
                name="matchId"
                required
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              >
                <option value="">请选择比赛</option>
                {state.matches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.title}（已报名 {match.currentParticipants} 人）
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={pending || validSelectedUserIds.length === 0}
              className="rounded-md border border-cyan-500/40 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-60"
            >
              {pending
                ? "加入中..."
                : `加入比赛（已选 ${validSelectedUserIds.length} 人）`}
            </button>
          </div>
        </form>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <form action={formAction}>
            <input type="hidden" name="csrfToken" value="" />
            <input type="hidden" name="intent" value="bulkToggleBan" />
            <input
              type="hidden"
              name="selectedUserIds"
              value={validSelectedUserIds.join(",")}
            />
            <input type="hidden" name="banned" value="true" />
            <button
              type="submit"
              disabled={pending || validSelectedUserIds.length === 0}
              className="w-full rounded-md border border-amber-500/40 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/10 disabled:opacity-60"
            >
              {pending
                ? "处理中..."
                : `批量封禁（已选 ${validSelectedUserIds.length} 人）`}
            </button>
          </form>

          <form action={formAction}>
            <input type="hidden" name="csrfToken" value="" />
            <input type="hidden" name="intent" value="bulkDeleteUsers" />
            <input
              type="hidden"
              name="selectedUserIds"
              value={validSelectedUserIds.join(",")}
            />
            <button
              type="submit"
              disabled={pending || validSelectedUserIds.length === 0}
              className="w-full rounded-md border border-rose-500/40 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/10 disabled:opacity-60"
            >
              {pending
                ? "处理中..."
                : `批量删除（已选 ${validSelectedUserIds.length} 人）`}
            </button>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-400">
            筛选结果 {filteredAndSortedUsers.length} / 总计 {state.users.length}{" "}
            位用户 · 第 {safePage}/{totalPages} 页
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleCurrentPage}
              className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700/40"
            >
              {allCurrentPageSelected ? "取消本页全选" : "全选本页"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedUserIds([])}
              className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700/40"
            >
              清空已选
            </button>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700/40 disabled:opacity-50"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700/40 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {pagedUsers.map((user) => (
            <div
              key={user.id}
              className="rounded-xl border border-slate-700 bg-slate-800/40 p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <label className="mr-1 flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedUserIdSet.has(user.id)}
                    onChange={() => toggleUser(user.id)}
                    className="h-4 w-4 rounded border-slate-500 bg-slate-900"
                  />
                  选择
                </label>
                <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-700">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatarUrl}
                      alt={user.nickname}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-slate-300">
                      {user.nickname[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                </div>

                <div className="min-w-65 flex-1">
                  <p className="text-sm font-medium text-slate-100">
                    {user.nickname}
                    <span className="ml-2 text-xs text-slate-400">
                      {user.role}
                    </span>
                    {user.isBanned ? (
                      <span className="ml-2 text-xs text-rose-300">已封禁</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-300">{user.email}</p>
                  <p className="text-xs text-slate-400">
                    最后活动：{formatDateTime(user.lastActivityAt)}
                  </p>
                </div>
              </div>

              <form
                action={formAction}
                className="mt-3 grid gap-3 md:grid-cols-3"
              >
                <input type="hidden" name="csrfToken" value="" />
                <input type="hidden" name="intent" value="updateUser" />
                <input type="hidden" name="userId" value={user.id} />
                <input
                  aria-label="昵称"
                  name="nickname"
                  defaultValue={user.nickname}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
                <input
                  name="avatarUrl"
                  defaultValue={user.avatarUrl ?? ""}
                  placeholder="头像 URL"
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md border border-cyan-500/40 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-60"
                >
                  保存资料
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
