import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import CsrfFormInjector from "@/components/security/CsrfFormInjector";
import { getCurrentUser } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "USTC TTA",
  description:
    "科大校学生乒乓球协会平台，用于科大校内比赛的乒乓球竞技平台，记录每一次精彩对决，见证你的成长",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="zh-CN">
      <body
        className={`${inter.className} min-h-screen bg-slate-950 text-slate-100`}
      >
        <CsrfFormInjector />
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-h-screen flex-1 flex-col">
            <Header isLoggedIn={Boolean(currentUser)} />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 lg:px-8">
              {children}
            </main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
