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

function redirectToDeadlines(message: string): never {
  redirect(`/admin/shift-deadlines?message=${encodeURIComponent(message)}`);
}

function isValidMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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
    redirectToDeadlines("プロフィール情報が見つかりません");
  }

  if (!profile.is_active) {
    redirectToDeadlines("このユーザーは無効化されています");
  }

  if (profile.role !== "manager" && profile.role !== "admin") {
    redirect("/dashboard");
  }

  return {
    supabase,
    user,
    profile,
  };
}

export async function upsertShiftDeadlineAction(formData: FormData) {
  const { supabase, profile } = await getManagerProfile();

  const targetMonth = getFormValue(formData, "targetMonth");
  const deadlineDate = getFormValue(formData, "deadlineDate");
  const deadlineTime = getFormValue(formData, "deadlineTime");
  const note = getFormValue(formData, "note");

  const requestedStoreId = getFormValue(formData, "storeId");
  const storeId =
    profile.role === "admin" ? requestedStoreId : profile.store_id ?? "";

  if (!storeId) {
    redirectToDeadlines("店舗を選択してください");
  }

  if (!isValidMonth(targetMonth)) {
    redirectToDeadlines("対象月を正しく入力してください");
  }

  if (!isValidDate(deadlineDate)) {
    redirectToDeadlines("提出期限の日付を正しく入力してください");
  }

  if (!isValidTime(deadlineTime)) {
    redirectToDeadlines("提出期限の時刻を正しく入力してください");
  }

  const { error } = await supabase.from("shift_submission_deadlines").upsert(
    {
      store_id: storeId,
      target_month: targetMonth,
      deadline_date: deadlineDate,
      deadline_time: deadlineTime,
      note: note || null,
      is_active: true,
      updated_by: profile.id,
      created_by: profile.id,
    },
    {
      onConflict: "store_id,target_month",
    }
  );

  if (error) {
    console.error("upsertShiftDeadlineAction error:", error);
    redirectToDeadlines("提出期限の保存に失敗しました");
  }

  revalidatePath("/admin/shift-deadlines");
  revalidatePath("/shifts/submit");

  redirectToDeadlines("提出期限を保存しました");
}

export async function deleteShiftDeadlineAction(formData: FormData) {
  const { supabase, profile } = await getManagerProfile();

  const deadlineId = getFormValue(formData, "deadlineId");

  if (!deadlineId) {
    redirectToDeadlines("削除対象が見つかりません");
  }

  let query = supabase
    .from("shift_submission_deadlines")
    .delete()
    .eq("id", deadlineId);

  if (profile.role !== "admin") {
    query = query.eq("store_id", profile.store_id);
  }

  const { error } = await query;

  if (error) {
    console.error("deleteShiftDeadlineAction error:", error);
    redirectToDeadlines("提出期限の削除に失敗しました");
  }

  revalidatePath("/admin/shift-deadlines");
  revalidatePath("/shifts/submit");

  redirectToDeadlines("提出期限を削除しました");
}