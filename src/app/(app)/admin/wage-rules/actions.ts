"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type WageRuleType = "weekday" | "holiday" | "time_range" | "night";
type IncreaseType = "amount" | "rate";

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

  return numberValue;
}

function redirectToWageRules(message: string): never {
  redirect(`/admin/wage-rules?message=${encodeURIComponent(message)}`);
}

function isValidWageRuleType(value: string): value is WageRuleType {
  return (
    value === "weekday" ||
    value === "holiday" ||
    value === "time_range" ||
    value === "night"
  );
}

function isValidIncreaseType(value: string): value is IncreaseType {
  return value === "amount" || value === "rate";
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
    redirectToWageRules("プロフィール情報が見つかりません");
  }

  if (!profile.is_active) {
    redirectToWageRules("このユーザーは無効化されています");
  }

  if (profile.role !== "manager" && profile.role !== "admin") {
    redirect("/dashboard");
  }

  if (!profile.store_id && profile.role !== "admin") {
    redirectToWageRules("店舗情報が未設定です");
  }

  return {
    supabase,
    profile,
  };
}

export async function createWageRuleAction(formData: FormData) {
  const { supabase, profile } = await getManagerProfile();

  const name = getFormValue(formData, "name");
  const ruleType = getFormValue(formData, "ruleType");
  const dayOfWeekText = getFormValue(formData, "dayOfWeek");
  const startTime = getFormValue(formData, "startTime");
  const endTime = getFormValue(formData, "endTime");
  const increaseType = getFormValue(formData, "increaseType");
  const increaseAmount = Math.floor(getFormNumber(formData, "increaseAmount"));
  const increaseRate = getFormNumber(formData, "increaseRate");
  const priority = Math.floor(getFormNumber(formData, "priority")) || 100;

  if (!name) {
    redirectToWageRules("ルール名を入力してください");
  }

  if (!isValidWageRuleType(ruleType)) {
    redirectToWageRules("ルール種別が不正です");
  }

  if (!isValidIncreaseType(increaseType)) {
    redirectToWageRules("加算方法が不正です");
  }

  if (increaseType === "amount" && increaseAmount <= 0) {
    redirectToWageRules("金額加算の場合は加算額を1円以上で入力してください");
  }

  if (increaseType === "rate" && increaseRate < 1) {
    redirectToWageRules("倍率加算の場合は1.0以上で入力してください");
  }

  let dayOfWeek: number | null = null;
  let normalizedStartTime: string | null = null;
  let normalizedEndTime: string | null = null;

  if (ruleType === "weekday") {
    dayOfWeek = Number(dayOfWeekText);

    if (Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      redirectToWageRules("曜日を選択してください");
    }
  }

  if (ruleType === "time_range" || ruleType === "night") {
    if (!startTime || !endTime) {
      redirectToWageRules("時間帯ルールの場合は開始時刻と終了時刻を入力してください");
    }

    normalizedStartTime = startTime;
    normalizedEndTime = endTime;
  }

  const storeId = profile.store_id;

  if (!storeId) {
    redirectToWageRules("店舗情報が見つかりません");
  }

  const { error } = await supabase.from("wage_rules").insert({
    store_id: storeId,
    name,
    rule_type: ruleType,
    day_of_week: dayOfWeek,
    start_time: normalizedStartTime,
    end_time: normalizedEndTime,
    increase_type: increaseType,
    increase_amount: increaseType === "amount" ? increaseAmount : 0,
    increase_rate: increaseType === "rate" ? increaseRate : 1,
    priority,
    is_active: true,
  });

  if (error) {
    console.error("createWageRuleAction error:", error);
    redirectToWageRules("給与ルールの登録に失敗しました");
  }

  revalidatePath("/admin/wage-rules");
  revalidatePath("/payroll");

  redirectToWageRules("給与ルールを登録しました");
}

export async function deleteWageRuleAction(formData: FormData) {
  const { supabase, profile } = await getManagerProfile();

  const wageRuleId = getFormValue(formData, "wageRuleId");

  if (!wageRuleId) {
    redirectToWageRules("削除対象の給与ルールが見つかりません");
  }

  let query = supabase.from("wage_rules").delete().eq("id", wageRuleId);

  if (profile.role !== "admin") {
    query = query.eq("store_id", profile.store_id);
  }

  const { error } = await query;

  if (error) {
    console.error("deleteWageRuleAction error:", error);
    redirectToWageRules("給与ルールの削除に失敗しました");
  }

  revalidatePath("/admin/wage-rules");
  revalidatePath("/payroll");

  redirectToWageRules("給与ルールを削除しました");
}

export async function createStoreHolidayAction(formData: FormData) {
  const { supabase, profile } = await getManagerProfile();

  const holidayDate = getFormValue(formData, "holidayDate");
  const name = getFormValue(formData, "name");

  if (!holidayDate) {
    redirectToWageRules("日付を入力してください");
  }

  const storeId = profile.store_id;

  if (!storeId) {
    redirectToWageRules("店舗情報が見つかりません");
  }

  const { error } = await supabase.from("store_holidays").insert({
    store_id: storeId,
    holiday_date: holidayDate,
    name: name || "祝日・特別日",
    is_active: true,
  });

  if (error) {
    console.error("createStoreHolidayAction error:", error);

    if (error.code === "23505") {
      redirectToWageRules("その日はすでに祝日・特別日として登録されています");
    }

    redirectToWageRules("祝日・特別日の登録に失敗しました");
  }

  revalidatePath("/admin/wage-rules");
  revalidatePath("/payroll");

  redirectToWageRules("祝日・特別日を登録しました");
}

export async function deleteStoreHolidayAction(formData: FormData) {
  const { supabase, profile } = await getManagerProfile();

  const holidayId = getFormValue(formData, "holidayId");

  if (!holidayId) {
    redirectToWageRules("削除対象の祝日・特別日が見つかりません");
  }

  let query = supabase.from("store_holidays").delete().eq("id", holidayId);

  if (profile.role !== "admin") {
    query = query.eq("store_id", profile.store_id);
  }

  const { error } = await query;

  if (error) {
    console.error("deleteStoreHolidayAction error:", error);
    redirectToWageRules("祝日・特別日の削除に失敗しました");
  }

  revalidatePath("/admin/wage-rules");
  revalidatePath("/payroll");

  redirectToWageRules("祝日・特別日を削除しました");
}