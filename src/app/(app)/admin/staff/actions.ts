"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type Role = "staff" | "manager" | "admin";
type EmploymentType = "part_time" | "full_time" | "contract";

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

function getFormBoolean(formData: FormData, key: string): boolean {
  return getFormValue(formData, key) === "true";
}

function redirectToStaff(message: string): never {
  redirect(`/admin/staff?message=${encodeURIComponent(message)}`);
}

function isValidRole(value: string): value is Role {
  return value === "staff" || value === "manager" || value === "admin";
}

function isValidEmploymentType(value: string): value is EmploymentType {
  return (
    value === "part_time" || value === "full_time" || value === "contract"
  );
}

export async function updateStaffAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: managerProfile, error: managerError } = await supabase
    .from("profiles")
    .select("id, store_id, role, is_active")
    .eq("id", user.id)
    .single();

  if (managerError || !managerProfile) {
    redirectToStaff("プロフィール情報が見つかりません");
  }

  if (!managerProfile.is_active) {
    redirectToStaff("このユーザーは無効化されています");
  }

  if (managerProfile.role !== "manager" && managerProfile.role !== "admin") {
    redirect("/dashboard");
  }

  const staffId = getFormValue(formData, "staffId");
  const fullName = getFormValue(formData, "fullName");
  const role = getFormValue(formData, "role");
  const employmentType = getFormValue(formData, "employmentType");
  const hourlyWage = getFormNumber(formData, "hourlyWage");
  const monthlySalary = getFormNumber(formData, "monthlySalary");
  const isActive = getFormBoolean(formData, "isActive");

  if (!staffId) {
    redirectToStaff("更新対象のスタッフが見つかりません");
  }

  if (!fullName) {
    redirectToStaff("スタッフ名を入力してください");
  }

  if (!isValidRole(role)) {
    redirectToStaff("権限の値が不正です");
  }

  if (!isValidEmploymentType(employmentType)) {
    redirectToStaff("雇用区分の値が不正です");
  }

  if (managerProfile.role !== "admin" && role === "admin") {
    redirectToStaff("manager は admin 権限を設定できません");
  }

  const { data: targetStaff, error: staffError } = await supabase
    .from("profiles")
    .select("id, store_id, role")
    .eq("id", staffId)
    .single();

  if (staffError || !targetStaff) {
    redirectToStaff("スタッフ情報が見つかりません");
  }

  if (
    managerProfile.role !== "admin" &&
    targetStaff.store_id !== managerProfile.store_id
  ) {
    redirectToStaff("別店舗のスタッフは更新できません");
  }

  if (managerProfile.role !== "admin" && targetStaff.role === "admin") {
    redirectToStaff("admin ユーザーは更新できません");
  }

  if (
    managerProfile.role !== "admin" &&
    targetStaff.id === managerProfile.id &&
    (role !== managerProfile.role || !isActive)
  ) {
    redirectToStaff(
      "自分自身の権限変更または無効化はできません。別の管理者に依頼してください"
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      role,
      employment_type: employmentType,
      hourly_wage: hourlyWage,
      monthly_salary: monthlySalary,
      is_active: isActive,
    })
    .eq("id", staffId);

  if (error) {
    console.error("updateStaffAction error:", error);
    redirectToStaff("スタッフ情報の更新に失敗しました");
  }

  revalidatePath("/admin/staff");
  revalidatePath("/dashboard");

  redirectToStaff("スタッフ情報を更新しました");
}