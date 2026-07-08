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

function redirectToLineChart(message: string): never {
  redirect(`/admin/line-chart?message=${encodeURIComponent(message)}`);
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidColor(value: string) {
  return ["blue", "green", "yellow", "red", "purple", "gray"].includes(value);
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
    redirectToLineChart("プロフィール情報が見つかりません");
  }

  if (!profile.is_active) {
    redirectToLineChart("このユーザーは無効化されています");
  }

  if (profile.role !== "manager" && profile.role !== "admin") {
    redirect("/dashboard");
  }

  return {
    supabase,
    profile,
  };
}

export async function createLineSheetEventAction(formData: FormData) {
  const { supabase, profile } = await getManagerProfile();

  const eventDate = getFormValue(formData, "eventDate");
  const title = getFormValue(formData, "title");
  const colorType = getFormValue(formData, "colorType") || "blue";
  const note = getFormValue(formData, "note");
  const requestedStoreId = getFormValue(formData, "storeId");

  const storeId =
    profile.role === "admin" ? requestedStoreId : profile.store_id ?? "";

  if (!storeId) {
    redirectToLineChart("店舗を選択してください");
  }

  if (!isValidDate(eventDate)) {
    redirectToLineChart("イベント日を正しく入力してください");
  }

  if (!title) {
    redirectToLineChart("イベント名を入力してください");
  }

  if (!isValidColor(colorType)) {
    redirectToLineChart("色の指定が不正です");
  }

  const { error } = await supabase.from("line_sheet_events").insert({
    store_id: storeId,
    event_date: eventDate,
    title,
    color_type: colorType,
    note: note || null,
    created_by: profile.id,
    updated_by: profile.id,
  });

  if (error) {
    console.error("createLineSheetEventAction error:", error);
    redirectToLineChart("イベントの登録に失敗しました");
  }

  revalidatePath("/admin/line-chart");

  redirectToLineChart("ライン表イベントを登録しました");
}

export async function deleteLineSheetEventAction(formData: FormData) {
  const { supabase, profile } = await getManagerProfile();

  const eventId = getFormValue(formData, "eventId");

  if (!eventId) {
    redirectToLineChart("削除対象が見つかりません");
  }

  let query = supabase.from("line_sheet_events").delete().eq("id", eventId);

  if (profile.role !== "admin") {
    query = query.eq("store_id", profile.store_id);
  }

  const { error } = await query;

  if (error) {
    console.error("deleteLineSheetEventAction error:", error);
    redirectToLineChart("イベントの削除に失敗しました");
  }

  revalidatePath("/admin/line-chart");

  redirectToLineChart("ライン表イベントを削除しました");
}