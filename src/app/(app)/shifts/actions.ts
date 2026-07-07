"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  calculateShiftRequestEstimate,
  type WageRule,
} from "@/lib/wage";
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

function redirectToSubmit(message: string): never {
  redirect(`/shifts/submit?message=${encodeURIComponent(message)}`);
}

function redirectToRequests(message: string): never {
  redirect(`/shifts/requests?message=${encodeURIComponent(message)}`);
}

function getTargetMonthFromDate(dateText: string): string {
  return `${dateText.slice(0, 7)}-01`;
}

function getSafeReturnPath(value: string): "/shifts/submit" | "/shifts/requests" {
  if (value === "/shifts/requests") {
    return "/shifts/requests";
  }

  return "/shifts/submit";
}

export async function createShiftRequestAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const requestDate = getFormValue(formData, "requestDate");
  const requestType = getFormValue(formData, "requestType");
  const staffNote = getFormValue(formData, "staffNote");

  let startTime = getFormValue(formData, "startTime");
  let endTime = getFormValue(formData, "endTime");
  let breakMinutes = getFormNumber(formData, "breakMinutes");

  if (!requestDate) {
    redirectToSubmit("希望日を入力してください");
  }

  if (requestType !== "work" && requestType !== "off") {
    redirectToSubmit("希望区分を選択してください");
  }

  if (requestType === "work") {
    if (!startTime || !endTime) {
      redirectToSubmit("勤務希望の場合は開始時刻と終了時刻を入力してください");
    }

    if (startTime >= endTime) {
      redirectToSubmit("終了時刻は開始時刻より後にしてください");
    }
  }

  if (requestType === "off") {
    startTime = "";
    endTime = "";
    breakMinutes = 0;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, store_id, is_active, employment_type, hourly_wage, monthly_salary"
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirectToSubmit("プロフィール情報が見つかりません");
  }

  if (!profile.store_id) {
    redirectToSubmit("店舗情報が未設定です。管理者に確認してください");
  }

  if (!profile.is_active) {
    redirectToSubmit("このユーザーは無効化されています");
  }

  const { data: existingRequest } = await supabase
    .from("shift_requests")
    .select("id")
    .eq("staff_id", user.id)
    .eq("request_date", requestDate)
    .maybeSingle();

  if (existingRequest) {
    redirectToSubmit(
      "その日はすでに希望シフトを提出済みです。削除してから再提出してください"
    );
  }

  const { data: wageRulesData } = await supabase
    .from("wage_rules")
    .select(
      "rule_type, day_of_week, start_time, end_time, increase_type, increase_amount, increase_rate, priority"
    )
    .eq("store_id", profile.store_id)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  const { data: holidayData } = await supabase
    .from("store_holidays")
    .select("id")
    .eq("store_id", profile.store_id)
    .eq("holiday_date", requestDate)
    .eq("is_active", true)
    .maybeSingle();

  const estimate = calculateShiftRequestEstimate({
    requestType,
    requestDate,
    startTime: requestType === "work" ? startTime : null,
    endTime: requestType === "work" ? endTime : null,
    breakMinutes,
    employmentType: profile.employment_type,
    hourlyWage: profile.hourly_wage ?? 0,
    isHoliday: Boolean(holidayData),
    wageRules: (wageRulesData ?? []) as WageRule[],
  });

  const { data: createdRequest, error: requestError } = await supabase
    .from("shift_requests")
    .insert({
      store_id: profile.store_id,
      staff_id: user.id,
      target_month: getTargetMonthFromDate(requestDate),
      request_date: requestDate,
      request_type: requestType,
      start_time: requestType === "work" ? startTime : null,
      end_time: requestType === "work" ? endTime : null,
      break_minutes: breakMinutes,
      staff_note: staffNote || null,
      status: "submitted",
    })
    .select("id")
    .single();

  if (requestError || !createdRequest) {
    console.error("createShiftRequestAction request error:", requestError);

    if (requestError?.code === "23505") {
      redirectToSubmit("その日はすでに希望シフトを提出済みです");
    }

    redirectToSubmit("希望シフトの提出に失敗しました");
  }

  const { error: estimateError } = await supabase
    .from("shift_request_estimates")
    .insert({
      shift_request_id: createdRequest.id,
      store_id: profile.store_id,
      staff_id: user.id,
      employment_type_snapshot: profile.employment_type,
      is_pay_target: estimate.isPayTarget,
      estimated_work_minutes: estimate.estimatedWorkMinutes,
      hourly_wage_snapshot: estimate.hourlyWageSnapshot,
      estimated_pay: estimate.estimatedPay,
      calculation_note: estimate.calculationNote,
    });

  if (estimateError) {
    console.error("createShiftRequestAction estimate error:", estimateError);

    await supabase
      .from("shift_requests")
      .delete()
      .eq("id", createdRequest.id)
      .eq("staff_id", user.id);

    redirectToSubmit("予想収入の計算保存に失敗しました");
  }

  revalidatePath("/shifts/submit");
  revalidatePath("/shifts/requests");

  redirectToSubmit("希望シフトを提出しました");
}

export async function deleteShiftRequestAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const shiftRequestId = getFormValue(formData, "shiftRequestId");
  const returnTo = getSafeReturnPath(getFormValue(formData, "returnTo"));

  if (!shiftRequestId) {
    if (returnTo === "/shifts/requests") {
      redirectToRequests("削除対象が見つかりません");
    }

    redirectToSubmit("削除対象が見つかりません");
  }

  const { error } = await supabase
    .from("shift_requests")
    .delete()
    .eq("id", shiftRequestId)
    .eq("staff_id", user.id);

  if (error) {
    console.error("deleteShiftRequestAction error:", error);

    if (returnTo === "/shifts/requests") {
      redirectToRequests("希望シフトの削除に失敗しました");
    }

    redirectToSubmit("希望シフトの削除に失敗しました");
  }

  revalidatePath("/shifts/submit");
  revalidatePath("/shifts/requests");

  if (returnTo === "/shifts/requests") {
    redirectToRequests("希望シフトを削除しました");
  }

  redirectToSubmit("希望シフトを削除しました");
}