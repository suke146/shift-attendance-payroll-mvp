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

function redirectToCreate(message: string): never {
  redirect(`/admin/shifts/create?message=${encodeURIComponent(message)}`);
}

function redirectToManage(message: string): never {
  redirect(`/admin/shifts?message=${encodeURIComponent(message)}`);
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
    redirectToManage("プロフィール情報が見つかりません");
  }

  if (!profile.is_active) {
    redirectToManage("このユーザーは無効化されています");
  }

  if (profile.role !== "manager" && profile.role !== "admin") {
    redirect("/dashboard");
  }

  if (!profile.store_id && profile.role !== "admin") {
    redirectToManage("店舗情報が未設定です");
  }

  return {
    supabase,
    user,
    profile,
  };
}

export async function createShiftFromRequestAction(formData: FormData) {
  const { supabase, user, profile } = await getManagerProfile();

  const shiftRequestId = getFormValue(formData, "shiftRequestId");

  if (!shiftRequestId) {
    redirectToCreate("希望シフトが選択されていません");
  }

  const { data: request, error: requestError } = await supabase
    .from("shift_requests")
    .select(
      "id, store_id, staff_id, request_date, request_type, start_time, end_time, break_minutes, staff_note, status"
    )
    .eq("id", shiftRequestId)
    .single();

  if (requestError || !request) {
    redirectToCreate("希望シフトが見つかりません");
  }

  if (profile.role !== "admin" && request.store_id !== profile.store_id) {
    redirectToCreate("別店舗の希望シフトは確定できません");
  }

  if (request.request_type !== "work") {
    redirectToCreate("休み希望は確定シフトにできません");
  }

  if (!request.start_time || !request.end_time) {
    redirectToCreate("開始時刻または終了時刻が未設定です");
  }

  const { error: insertError } = await supabase.from("shifts").insert({
    store_id: request.store_id,
    staff_id: request.staff_id,
    shift_date: request.request_date,
    start_time: request.start_time,
    end_time: request.end_time,
    break_minutes: request.break_minutes,
    note: request.staff_note,
    created_by: user.id,
  });

  if (insertError) {
    console.error("createShiftFromRequestAction insert error:", insertError);
    redirectToCreate("確定シフトの作成に失敗しました");
  }

  await supabase
    .from("shift_requests")
    .update({
      status: "converted",
    })
    .eq("id", request.id);

  revalidatePath("/admin/shifts/create");
  revalidatePath("/admin/shift-requests");
  revalidatePath("/admin/shifts");
  revalidatePath("/shifts");

  redirectToCreate("希望シフトから確定シフトを作成しました");
}

export async function createManualShiftAction(formData: FormData) {
  const { supabase, user, profile } = await getManagerProfile();

  const staffId = getFormValue(formData, "staffId");
  const shiftDate = getFormValue(formData, "shiftDate");
  const startTime = getFormValue(formData, "startTime");
  const endTime = getFormValue(formData, "endTime");
  const breakMinutes = getFormNumber(formData, "breakMinutes");
  const note = getFormValue(formData, "note");

  if (!staffId || !shiftDate || !startTime || !endTime) {
    redirectToCreate("スタッフ、日付、開始時刻、終了時刻を入力してください");
  }

  if (startTime >= endTime) {
    redirectToCreate("終了時刻は開始時刻より後にしてください");
  }

  const { data: targetStaff, error: staffError } = await supabase
    .from("profiles")
    .select("id, store_id, is_active")
    .eq("id", staffId)
    .single();

  if (staffError || !targetStaff) {
    redirectToCreate("スタッフ情報が見つかりません");
  }

  if (!targetStaff.is_active) {
    redirectToCreate("無効化されているスタッフにはシフトを作成できません");
  }

  if (profile.role !== "admin" && targetStaff.store_id !== profile.store_id) {
    redirectToCreate("別店舗のスタッフにはシフトを作成できません");
  }

  const storeId =
    profile.role === "admin" ? targetStaff.store_id : profile.store_id;

  if (!storeId) {
    redirectToCreate("店舗情報が見つかりません");
  }

  const { error } = await supabase.from("shifts").insert({
    store_id: storeId,
    staff_id: staffId,
    shift_date: shiftDate,
    start_time: startTime,
    end_time: endTime,
    break_minutes: breakMinutes,
    note: note || null,
    created_by: user.id,
  });

  if (error) {
    console.error("createManualShiftAction error:", error);
    redirectToCreate("手動シフトの作成に失敗しました");
  }

  revalidatePath("/admin/shifts/create");
  revalidatePath("/admin/shifts");
  revalidatePath("/shifts");

  redirectToCreate("手動で確定シフトを作成しました");
}

export async function updateShiftAction(formData: FormData) {
  const { supabase, profile } = await getManagerProfile();

  const shiftId = getFormValue(formData, "shiftId");
  const staffId = getFormValue(formData, "staffId");
  const shiftDate = getFormValue(formData, "shiftDate");
  const startTime = getFormValue(formData, "startTime");
  const endTime = getFormValue(formData, "endTime");
  const breakMinutes = getFormNumber(formData, "breakMinutes");
  const note = getFormValue(formData, "note");

  if (!shiftId || !staffId || !shiftDate || !startTime || !endTime) {
    redirectToManage("シフト情報が不足しています");
  }

  if (startTime >= endTime) {
    redirectToManage("終了時刻は開始時刻より後にしてください");
  }

  const { data: currentShift, error: shiftError } = await supabase
    .from("shifts")
    .select("id, store_id")
    .eq("id", shiftId)
    .single();

  if (shiftError || !currentShift) {
    redirectToManage("更新対象のシフトが見つかりません");
  }

  if (profile.role !== "admin" && currentShift.store_id !== profile.store_id) {
    redirectToManage("別店舗のシフトは更新できません");
  }

  const { data: targetStaff, error: staffError } = await supabase
    .from("profiles")
    .select("id, store_id, is_active")
    .eq("id", staffId)
    .single();

  if (staffError || !targetStaff) {
    redirectToManage("スタッフ情報が見つかりません");
  }

  if (!targetStaff.is_active) {
    redirectToManage("無効化されているスタッフには変更できません");
  }

  if (profile.role !== "admin" && targetStaff.store_id !== profile.store_id) {
    redirectToManage("別店舗のスタッフには変更できません");
  }

  const storeId =
    profile.role === "admin" ? targetStaff.store_id : profile.store_id;

  if (!storeId) {
    redirectToManage("店舗情報が見つかりません");
  }

  const { error } = await supabase
    .from("shifts")
    .update({
      store_id: storeId,
      staff_id: staffId,
      shift_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      break_minutes: breakMinutes,
      note: note || null,
    })
    .eq("id", shiftId);

  if (error) {
    console.error("updateShiftAction error:", error);
    redirectToManage("確定シフトの更新に失敗しました");
  }

  revalidatePath("/admin/shifts");
  revalidatePath("/admin/shifts/create");
  revalidatePath("/shifts");

  redirectToManage("確定シフトを更新しました");
}

export async function deleteShiftAction(formData: FormData) {
  const { supabase, profile } = await getManagerProfile();

  const shiftId = getFormValue(formData, "shiftId");

  if (!shiftId) {
    redirectToManage("削除対象のシフトが見つかりません");
  }

  const { data: currentShift, error: shiftError } = await supabase
    .from("shifts")
    .select("id, store_id")
    .eq("id", shiftId)
    .single();

  if (shiftError || !currentShift) {
    redirectToManage("削除対象のシフトが見つかりません");
  }

  if (profile.role !== "admin" && currentShift.store_id !== profile.store_id) {
    redirectToManage("別店舗のシフトは削除できません");
  }

  const { error } = await supabase.from("shifts").delete().eq("id", shiftId);

  if (error) {
    console.error("deleteShiftAction error:", error);
    redirectToManage("確定シフトの削除に失敗しました");
  }

  revalidatePath("/admin/shifts");
  revalidatePath("/admin/shifts/create");
  revalidatePath("/shifts");

  redirectToManage("確定シフトを削除しました");
}