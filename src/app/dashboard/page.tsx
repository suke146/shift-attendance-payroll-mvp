import { redirect } from "next/navigation";

import { signOutAction } from "@/app/auth/actions";
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">ダッシュボード</h1>
            <p className="text-sm text-slate-600">
              ログイン状態の確認画面です。
            </p>
          </div>

          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              ログアウト
            </Button>
          </form>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ログインユーザー情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">User ID：</span>
              {user.id}
            </p>
            <p>
              <span className="font-medium">メール：</span>
              {user.email}
            </p>
            <p>
              <span className="font-medium">名前：</span>
              {profile?.full_name ?? "未登録"}
            </p>
            <p>
              <span className="font-medium">ロール：</span>
              {profile?.role ?? "未登録"}
            </p>
            <p>
              <span className="font-medium">時給：</span>
              {profile?.hourly_wage ?? 0} 円
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>次に実装する機能</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
              <li>スタッフ管理</li>
              <li>出勤・退勤打刻</li>
              <li>勤怠一覧</li>
              <li>月次集計</li>
              <li>Excel出力</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}