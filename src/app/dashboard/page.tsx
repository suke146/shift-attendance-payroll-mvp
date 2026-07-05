import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Download,
  FileSpreadsheet,
  LogOut,
  Users,
} from "lucide-react";

import { signOutAction } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, hourly_wage, store_id")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "staff";
  const isManager = role === "manager" || role === "admin";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">シフト・勤怠・給与集計補助システム</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              ダッシュボード
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>{profile?.full_name ?? user.email}</span>
              <Badge variant="secondary">{role}</Badge>
              <span>時給：{profile?.hourly_wage ?? 0}円</span>
            </div>
          </div>

          <form action={signOutAction}>
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
              <LogOut className="mr-2 h-4 w-4" />
              ログアウト
            </Button>
          </form>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MenuCard
            href="/attendance/clock"
            title="出勤・退勤打刻"
            description="スタッフが出勤・退勤を記録します。"
            icon={<Clock className="h-5 w-5" />}
          />

          <MenuCard
            href="/attendance"
            title="勤怠一覧"
            description="自分の勤怠履歴を確認します。"
            icon={<CalendarDays className="h-5 w-5" />}
          />

          {isManager ? (
            <>
              <MenuCard
                href="/admin/staff"
                title="スタッフ管理"
                description="スタッフ情報、ロール、時給を管理します。"
                icon={<Users className="h-5 w-5" />}
              />

              <MenuCard
                href="/admin/monthly"
                title="月次集計"
                description="スタッフ別の勤務時間と給与目安を確認します。"
                icon={<FileSpreadsheet className="h-5 w-5" />}
              />

              <MenuCard
                href="/admin/export"
                title="Excel出力"
                description="勤怠データや月次集計をExcelで出力します。"
                icon={<Download className="h-5 w-5" />}
              />
            </>
          ) : null}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>現在の実装状況</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>ログイン、ログアウト、ロール確認まで完了しています。</p>
            <p>
              次のStepで、実際に出勤・退勤を保存する打刻機能を実装します。
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function MenuCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="rounded-lg bg-slate-100 p-2 text-slate-700">{icon}</div>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}