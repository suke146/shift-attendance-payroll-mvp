import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function AdminMonthlyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "manager" && profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <Button asChild variant="outline">
          <Link href="/dashboard">ダッシュボードへ戻る</Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>月次集計</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-700">
            次のStep以降で、月ごとの勤務時間と給与目安を集計します。
          </CardContent>
        </Card>
      </div>
    </main>
  );
}