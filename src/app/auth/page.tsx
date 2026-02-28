import { redirect } from "next/navigation";
import AuthForms from "@/components/auth/AuthForms";
import { getCurrentUser } from "@/lib/auth";

export default async function AuthPage() {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect("/");
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden rounded-3xl border border-slate-700/70 bg-linear-to-br from-slate-800 via-slate-800 to-slate-900 p-8 shadow-xl shadow-black/20 lg:block">
        <h1 className="text-3xl font-bold text-white">登录 USTC TTA</h1>
        <p className="mt-4 text-slate-300">
          注册后将发送邮箱验证邮件，点击链接激活账号后方可登录。
        </p>
        <ul className="mt-6 space-y-3 text-sm text-slate-200">
          <li className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3">
            ✅ 发布与管理赛事
          </li>
          <li className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3">
            ✅ 查看完整个人战绩与 ELO 变化
          </li>
          <li className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3">
            ✅ 个性化编辑头像与个人描述
          </li>
        </ul>
      </section>

      <AuthForms />
    </div>
  );
}
