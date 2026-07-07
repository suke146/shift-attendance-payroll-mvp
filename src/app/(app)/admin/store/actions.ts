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

function redirectToStore(message: string): never {
  redirect(`/admin/store?message=${encodeURIComponent(message)}`);
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
    redirectToStore("プロフィール情報が見つかりません");
  }

  if (!profile.is_active) {
    redirectToStore("このユーザーは無効化されています");
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

export async function createStoreAction(formData: FormData) {
  const { supabase, profile } = await getManagerProfile();

  const name = getFormValue(formData, "name");
  const address = getFormValue(formData, "address");
  const phone = getFormValue(formData, "phone");
  const googleSpreadsheetId = getFormValue(formData, "googleSpreadsheetId");

  if (!name) {
    redirectToStore("店舗名を入力してください");
  }

  if (profile.role !== "admin" && profile.store_id) {
    redirectToStore("manager はすでに所属店舗があるため、新規店舗を作成できません");
  }

  const { data: store, error } = await supabase
    .from("stores")
    .insert({
      name,
      address: address || null,
      phone: phone || null,
      google_spreadsheet_id: googleSpreadsheetId || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !store) {
    console.error("createStoreAction error:", error);
    redirectToStore("店舗の作成に失敗しました");
  }

  // manager が初めて店舗を作成した場合、自分をその店舗に所属させる
  if (profile.role === "manager" && !profile.store_id) {
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        store_id: store.id,
      })
      .eq("id", profile.id);

    if (profileUpdateError) {
      console.error("createStoreAction profile update error:", profileUpdateError);
      redirectToStore("店舗は作成されましたが、所属店舗の設定に失敗しました");
    }
  }

  revalidatePath("/admin/store");
  revalidatePath("/dashboard");

  redirectToStore("店舗を作成しました");
}

export async function updateStoreAction(formData: FormData) {
  const { supabase, profile } = await getManagerProfile();

  const storeId = getFormValue(formData, "storeId");
  const name = getFormValue(formData, "name");
  const address = getFormValue(formData, "address");
  const phone = getFormValue(formData, "phone");
  const googleSpreadsheetId = getFormValue(formData, "googleSpreadsheetId");
  const isActive = getFormValue(formData, "isActive") === "true";

  if (!storeId) {
    redirectToStore("更新対象の店舗が見つかりません");
  }

  if (!name) {
    redirectToStore("店舗名を入力してください");
  }

  if (profile.role !== "admin" && storeId !== profile.store_id) {
    redirectToStore("別店舗の情報は更新できません");
  }

  const updatePayload =
    profile.role === "admin"
      ? {
          name,
          address: address || null,
          phone: phone || null,
          google_spreadsheet_id: googleSpreadsheetId || null,
          is_active: isActive,
        }
      : {
          name,
          address: address || null,
          phone: phone || null,
          google_spreadsheet_id: googleSpreadsheetId || null,
        };

  const { error } = await supabase
    .from("stores")
    .update(updatePayload)
    .eq("id", storeId);

  if (error) {
    console.error("updateStoreAction error:", error);
    redirectToStore("店舗情報の更新に失敗しました");
  }

  revalidatePath("/admin/store");
  revalidatePath("/dashboard");

  redirectToStore("店舗情報を更新しました");
}