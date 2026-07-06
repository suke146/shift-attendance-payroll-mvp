import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function AttendanceListPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <Button asChild variant="outline">
          <Link href="/dashboard">ダッシュボードへ戻る</Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>勤怠一覧</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-700">
            次のStep以降で、自分の出勤・退勤履歴を表示します。
          </CardContent>
        </Card>
      </div>
    </main>
  );
}