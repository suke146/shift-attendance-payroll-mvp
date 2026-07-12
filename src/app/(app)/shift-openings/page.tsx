import { applyToOpeningAction, withdrawOpeningApplicationAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ message?: string }> };
type Application = { id: string; opening_id: string; status: string };

export default async function ShiftOpeningsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("store_id").eq("id", user!.id).single();
  const today = new Date().toISOString().slice(0, 10);
  const { data: openings } = profile?.store_id ? await supabase.from("shift_openings").select("id, shift_date, start_time, end_time, required_count, note, status").eq("store_id", profile.store_id).gte("shift_date", today).order("shift_date") : { data: [] };
  const ids = (openings ?? []).map((item) => item.id);
  const { data: applicationsData } = ids.length ? await supabase.from("shift_opening_applications").select("id, opening_id, status").eq("staff_id", user!.id).in("opening_id", ids) : { data: [] };
  const applications = new Map(((applicationsData ?? []) as Application[]).map((item) => [item.opening_id, item]));

  return <div className="mx-auto max-w-5xl space-y-6">
    <div><h2 className="text-2xl font-bold">不足募集</h2><p className="mt-1 text-sm text-slate-600">勤務できる募集枠に応募できます。</p></div>
    {params.message ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{params.message}</div> : null}
    {(openings ?? []).length === 0 ? <Card><CardContent className="pt-6 text-sm text-slate-600">現在募集中のシフトはありません。</CardContent></Card> : (openings ?? []).map((opening) => {
      const application = applications.get(opening.id);
      return <Card key={opening.id}><CardHeader><CardTitle className="flex flex-wrap items-center gap-2 text-lg">{opening.shift_date}　{opening.start_time.slice(0,5)} - {opening.end_time.slice(0,5)} <Badge variant={opening.status === "open" ? "secondary" : "outline"}>{opening.status === "open" ? "募集中" : "募集終了"}</Badge></CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm">募集人数：{opening.required_count}人</p>{opening.note ? <p className="text-sm text-slate-600">{opening.note}</p> : null}{application ? <div className="flex items-center gap-3"><Badge>{application.status === "pending" ? "応募済み" : application.status === "approved" ? "承認済み" : "不承認"}</Badge>{application.status === "pending" ? <form action={withdrawOpeningApplicationAction}><input type="hidden" name="applicationId" value={application.id}/><Button size="sm" variant="outline">応募を取り消す</Button></form> : null}</div> : opening.status === "open" ? <form action={applyToOpeningAction} className="flex flex-col gap-3 sm:flex-row"><input type="hidden" name="openingId" value={opening.id}/><Input name="staffNote" placeholder="店長へのメモ（任意）"/><Button>応募する</Button></form> : null}</CardContent></Card>;
    })}
  </div>;
}
