"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  type ProfileFormState,
  updateProfileActionForm,
} from "@/app/profile/actions";

type Props = {
  nickname: string;
  bio: string;
  avatarUrl: string;
};

const initialState: ProfileFormState = {};

export default function ProfileEditorForm({ nickname, bio, avatarUrl }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateProfileActionForm,
    initialState,
  );

  useEffect(() => {
    if (!state.success) return;
    router.refresh();
  }, [state.success, router]);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="space-y-4"
    >
      <input type="hidden" name="csrfToken" defaultValue="" />
      <div>
        <label htmlFor="nickname" className="mb-1 block text-sm text-slate-300">
          昵称
        </label>
        <input
          id="nickname"
          name="nickname"
          defaultValue={nickname}
          className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400/40 focus:ring"
        />
      </div>

      <div>
        <label htmlFor="avatar" className="mb-1 block text-sm text-slate-300">
          上传头像（图片）
        </label>
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/*"
          className="block w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-cyan-100"
        />
        <p className="mt-1 text-xs text-slate-400">
          支持 PNG/JPG/WEBP/GIF，最大 2MB。
        </p>
      </div>

      {avatarUrl && (
        <div className="space-y-2">
          <p className="text-sm text-slate-300">当前头像</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt="当前头像"
            className="h-16 w-16 rounded-full object-cover ring-1 ring-cyan-400/30"
          />
        </div>
      )}

      <div>
        <label htmlFor="bio" className="mb-1 block text-sm text-slate-300">
          个人描述
        </label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={bio}
          rows={4}
          className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400/40 focus:ring"
        />
      </div>
      {state.error && <p className="text-sm text-rose-300">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-emerald-300">{state.success}</p>
      )}
      <button
        disabled={pending}
        className="rounded-xl bg-linear-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "保存中..." : "保存资料"}
      </button>
    </form>
  );
}
