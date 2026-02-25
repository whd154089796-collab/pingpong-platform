"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function UserProfileBackLink() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }
        router.push("/rankings");
      }}
      className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200"
    >
      <ArrowLeft className="h-4 w-4" />
      返回上一页
    </button>
  );
}
