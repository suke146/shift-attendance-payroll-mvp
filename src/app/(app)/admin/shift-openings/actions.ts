"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const go = (message: string): never => redirect(`/admin/shift-openings?message=${encodeURIComponent(message)}`);

async function manager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: profile } = await supabase.from("profiles").select("id, store_id, role, is_active").eq("id", user.id).single();
  if (!profile?.is_active || !["manager", "admin"].includes(profile.role)) redirect("/dashboard");
  return { supabase, profile };
}

export async function createOpeningAction(formData: FormData) {
  const { supabase, profile } = await manager();
  const storeId = profile.role === "admin" ? value(formData, "storeId") : profile.store_id;
  const shiftDate = value(formData, "shiftDate"), startTime = value(formData, "startTime"), endTime = value(formData, "endTime");
  const requiredCount = Number(value(formData, "requiredCount"));
  if (!storeId || !shiftDate || !startTime || !endTime || startTime >= endTime || !Number.isInteger(requiredCount) || requiredCount < 1) go("入力内容を確認してください");
  const { error } = await supabase.from("shift_openings").insert({ store_id: storeId, shift_date: shiftDate, start_time: startTime, end_time: endTime, break_minutes: Number(value(formData, "breakMinutes")) || 0, required_count: requiredCount, note: value(formData, "note") || null, created_by: profile.id });
  if (error) go("不足募集の作成に失敗しました");
  revalidatePath("/admin/shift-openings"); revalidatePath("/shift-openings");
  go("不足募集を作成しました");
}

export async function reviewApplicationAction(formData: FormData) {
  const { supabase, profile } = await manager();
  const applicationId = value(formData, "applicationId");
  const decision = value(formData, "decision");
  if (!["approved", "rejected"].includes(decision)) go("処理内容が不正です");
  const { data: application } = await supabase.from("shift_opening_applications").select("id, staff_id, status, opening_id, shift_openings!inner(id, store_id, shift_date, start_time, end_time, break_minutes, note)").eq("id", applicationId).single();
  if (!application || application.status !== "pending") go("応募が見つからないか、処理済みです");
  const currentApplication = application!;
  const raw = currentApplication.shift_openings as unknown;
  const opening = (Array.isArray(raw) ? raw[0] : raw) as { id:string; store_id:string; shift_date:string; start_time:string; end_time:string; break_minutes:number; note:string|null };
  if (profile.role !== "admin" && opening.store_id !== profile.store_id) go("別店舗の応募は処理できません");
  const { data: reviewed, error: reviewError } = await supabase.from("shift_opening_applications").update({ status: decision, reviewed_by: profile.id, reviewed_at: new Date().toISOString() }).eq("id", applicationId).eq("status", "pending").select("id").maybeSingle();
  if (reviewError || !reviewed) go("応募がすでに処理された可能性があります");
  if (decision === "approved") {
    const { error: shiftError } = await supabase.from("shifts").insert({ store_id: opening.store_id, staff_id: currentApplication.staff_id, shift_date: opening.shift_date, start_time: opening.start_time, end_time: opening.end_time, break_minutes: opening.break_minutes, note: opening.note ? `不足募集：${opening.note}` : "不足募集から追加", created_by: profile.id });
    if (shiftError) {
      await supabase.from("shift_opening_applications").update({ status: "pending", reviewed_by: null, reviewed_at: null }).eq("id", applicationId);
      go("確定シフトへの反映に失敗しました");
    }
  }
  revalidatePath("/admin/shift-openings"); revalidatePath("/shift-openings"); revalidatePath("/admin/shifts"); revalidatePath("/shifts");
  go(decision === "approved" ? "応募を承認し、確定シフトへ反映しました" : "応募を却下しました");
}

export async function closeOpeningAction(formData: FormData) {
  const { supabase, profile } = await manager();
  let query = supabase.from("shift_openings").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", value(formData, "openingId"));
  if (profile.role !== "admin") query = query.eq("store_id", profile.store_id);
  const { error } = await query;
  if (error) go("募集終了処理に失敗しました");
  revalidatePath("/admin/shift-openings"); revalidatePath("/shift-openings");
  go("募集を終了しました");
}
