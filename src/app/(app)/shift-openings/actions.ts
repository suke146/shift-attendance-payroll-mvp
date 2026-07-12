"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const go = (message: string): never => redirect(`/shift-openings?message=${encodeURIComponent(message)}`);

export async function applyToOpeningAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const openingId = value(formData, "openingId");
  const staffNote = value(formData, "staffNote");
  const { data: profile } = await supabase.from("profiles").select("id, store_id, is_active").eq("id", user.id).single();
  const { data: opening } = await supabase.from("shift_openings").select("id, store_id, shift_date, status").eq("id", openingId).single();
  if (!profile?.is_active || !opening || opening.store_id !== profile.store_id || opening.status !== "open") go("この募集には応募できません");
  if (opening!.shift_date < new Date().toISOString().slice(0, 10)) go("終了した募集には応募できません");

  const { error } = await supabase.from("shift_opening_applications").insert({ opening_id: openingId, staff_id: user.id, staff_note: staffNote || null });
  if (error) go(error.code === "23505" ? "この募集には応募済みです" : "応募に失敗しました");
  revalidatePath("/shift-openings");
  revalidatePath("/admin/shift-openings");
  go("不足募集に応募しました");
}

export async function withdrawOpeningApplicationAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const id = value(formData, "applicationId");
  const { error } = await supabase.from("shift_opening_applications").delete().eq("id", id).eq("staff_id", user.id).eq("status", "pending");
  if (error) go("応募の取り消しに失敗しました");
  revalidatePath("/shift-openings");
  revalidatePath("/admin/shift-openings");
  go("応募を取り消しました");
}
