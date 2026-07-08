"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getFormNumber(formData: FormData, key: string): number {
  const value = getFormValue(formData, key);
  const numberValue = Number(value);

  if (Number.isNaN(numberValue) || numberValue < 0) {
    return 0;
  }

  return Math.floor(numberValue);
}

function redirectToRequirements(message: string): never {
  redirect(
    `/admin/staffing-requirements?message=${encodeURIComponent(message)}`
  );
}

function isValidTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

async function getManagerProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, store_id, role, is_active")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirectToRequirements("プロフィール情報が見つかりません");
  }

  if (!profile.is_active) {
    redirectToRequirements("このユーザーは無効化されています");
  }

  if (profile.role !== "manager" && profile.role !== "admin") {
    redirect("/dashboard");
  }

  return {
    supabase,
    profile,
  };
}

export async function createStaffingRequirementAction(formData: FormData) {
  const { supabase, profile } = await getManagerProfile();

  const name = getFormValue(formData, "name");
  const dayOfWeekText = getFormValue(formData, "dayOfWeek");
  const startTime = getFormValue(formData, "startTime");
  const endTime = getFormValue(formData, "endTime");
  const requiredStaffCount = getFormNumber(formData, "requiredStaffCount");
  const note = getFormValue(formData, "note");
  const requestedStoreId = getFormValue(formData, "storeId");

  const storeId =
    profile.role === "admin" ? requestedStoreId : profile.store_id ?? "";

  if (!storeId) {
    redirectToRequirements("店舗を選択してください");
  }

  if (!name) {
    redirectToRequirements("ルール名を入力してください");
  }

  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    redirectToRequirements("開始時刻と終了時刻を正しく入力してください");
  }

  if (startTime >= endTime) {
    redirectToRequirements("終了時刻は開始時刻より後にしてください");
  }

  if (requiredStaffCount < 1) {
    redirectToRequirements("必要人数は1人以上で入力してください");
  }

  let dayOfWeek: number | null = null;

  if (dayOfWeekText !== "all") {
    const parsedDay = Number(dayOfWeekText);

    if (Number.isNaN(parsedDay) || parsedDay < 0 || parsedDay > 6) {
      redirectToRequirements("曜日を正しく選択してください");
    }

    dayOfWeek = parsedDay;
  }

  const { error } = await supabase.from("staffing_requirements").insert({
    store_id: storeId,
    name,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    required_staff_count: requiredStaffCount,
    note: note || null,
    is_active: true,
    created_by: profile.id,
    updated_by: profile.id,
  });

  if (error) {
    console.error("createStaffingRequirementAction error:", error);
    redirectToRequirements("必要人数ルールの登録に失敗しました");
  }

  revalidatePath("/admin/staffing-requirements");
  revalidatePath("/admin/shortages");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");

  redirectToRequirements("必要人数ルールを登録しました");
}

export async function deleteStaffingRequirementAction(formData: FormData) {
  const { supabase, profile } = await getManagerProfile();

  const requirementId = getFormValue(formData, "requirementId");

  if (!requirementId) {
    redirectToRequirements("削除対象が見つかりません");
  }

  let query = supabase
    .from("staffing_requirements")
    .delete()
    .eq("id", requirementId);

  if (profile.role !== "admin") {
    query = query.eq("store_id", profile.store_id);
  }

  const { error } = await query;

  if (error) {
    console.error("deleteStaffingRequirementAction error:", error);
    redirectToRequirements("必要人数ルールの削除に失敗しました");
  }

  revalidatePath("/admin/staffing-requirements");
  revalidatePath("/admin/shortages");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");

  redirectToRequirements("必要人数ルールを削除しました");
}