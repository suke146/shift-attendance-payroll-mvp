import { closeOpeningAction, createOpeningAction, reviewApplicationAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ message?: string; storeId?: string; date?: string; start?: string; end?: string; count?: string }> };
type Profile = { full_name: string | null; email: string | null };
type AppRow = { id:string; status:string; staff_note:string|null; profiles:Profile|Profile[]|null };

export default async function AdminShiftOpeningsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("store_id, role").eq("id", user!.id).single();
  const isAdmin = profile?.role === "admin";
  const { data: stores } = isAdmin ? await supabase.from("stores").select("id, name").eq("is_active", true).order("name") : await supabase.from("stores").select("id, name").eq("id", profile!.store_id);
  const storeId = isAdmin ? params.storeId ?? stores?.[0]?.id ?? "" : profile?.store_id ?? "";
  const { data: openings } = storeId ? await supabase.from("shift_openings").select("id, shift_date, start_time, end_time, break_minutes, required_count, note, status").eq("store_id", storeId).order("shift_date", { ascending: false }) : { data: [] };
  const ids = (openings ?? []).map((item) => item.id);
  const { data: rawApplications } = ids.length ? await supabase.from("shift_opening_applications").select("id, opening_id, status, staff_note, profiles:staff_id(full_name, email)").in("opening_id", ids).order("created_at") : { data: [] };
  const byOpening = new Map<string, AppRow[]>();
  for (const row of (rawApplications ?? []) as unknown as (AppRow & { opening_id:string })[]) byOpening.set(row.opening_id, [...(byOpening.get(row.opening_id) ?? []), row]);

  return <div className="mx-auto max-w-6xl space-y-6">
    <div><h2 className="text-2xl font-bold">不足募集管理</h2><p className="mt-1 text-sm text-slate-600">不足枠を募集し、応募を承認すると確定シフトへ反映します。</p></div>
    {params.message ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{params.message}</div> : null}
    {isAdmin ? <Card><CardHeader><CardTitle>店舗切り替え</CardTitle></CardHeader><CardContent><form className="flex gap-3"><select name="storeId" defaultValue={storeId} className="h-10 rounded-md border px-3 text-sm">{stores?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><Button variant="outline">表示する</Button></form></CardContent></Card> : null}
    <Card><CardHeader><CardTitle>不足募集を作成</CardTitle></CardHeader><CardContent><form action={createOpeningAction} className="grid gap-4 md:grid-cols-3"><input type="hidden" name="storeId" value={storeId}/><div><label className="text-sm font-medium">勤務日</label><Input name="shiftDate" type="date" defaultValue={params.date} required/></div><div><label className="text-sm font-medium">開始</label><Input name="startTime" type="time" defaultValue={params.start} required/></div><div><label className="text-sm font-medium">終了</label><Input name="endTime" type="time" defaultValue={params.end} required/></div><div><label className="text-sm font-medium">募集人数</label><Input name="requiredCount" type="number" min="1" defaultValue={params.count ?? "1"} required/></div><div><label className="text-sm font-medium">休憩（分）</label><Input name="breakMinutes" type="number" min="0" defaultValue="0"/></div><div><label className="text-sm font-medium">メモ</label><Input name="note" placeholder="担当業務など"/></div><div className="md:col-span-3"><Button>募集を作成する</Button></div></form></CardContent></Card>
    {(openings ?? []).length === 0 ? <Card><CardContent className="pt-6 text-sm text-slate-600">募集はまだありません。</CardContent></Card> : (openings ?? []).map(opening => { const apps = byOpening.get(opening.id) ?? []; return <Card key={opening.id}><CardHeader><CardTitle className="flex flex-wrap items-center gap-2 text-lg">{opening.shift_date}　{opening.start_time.slice(0,5)} - {opening.end_time.slice(0,5)} <Badge variant={opening.status === "open" ? "secondary" : "outline"}>{opening.status === "open" ? "募集中" : "終了"}</Badge></CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-4 text-sm"><span>募集 {opening.required_count}人</span><span>応募 {apps.length}人</span>{opening.note ? <span>{opening.note}</span> : null}</div>{apps.length === 0 ? <p className="text-sm text-slate-500">応募者はいません。</p> : apps.map(app => { const p = Array.isArray(app.profiles) ? app.profiles[0] : app.profiles; return <div key={app.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{p?.full_name ?? "不明"}</p><p className="text-xs text-slate-500">{p?.email ?? "-"}</p>{app.staff_note ? <p className="mt-1 text-sm">{app.staff_note}</p> : null}</div>{app.status === "pending" ? <div className="flex gap-2"><form action={reviewApplicationAction}><input type="hidden" name="applicationId" value={app.id}/><input type="hidden" name="decision" value="approved"/><Button size="sm">承認</Button></form><form action={reviewApplicationAction}><input type="hidden" name="applicationId" value={app.id}/><input type="hidden" name="decision" value="rejected"/><Button size="sm" variant="outline">却下</Button></form></div> : <Badge>{app.status === "approved" ? "承認済み" : "却下済み"}</Badge>}</div>})}{opening.status === "open" ? <form action={closeOpeningAction}><input type="hidden" name="openingId" value={opening.id}/><Button size="sm" variant="outline">募集を終了する</Button></form> : null}</CardContent></Card>; })}
  </div>;
}
