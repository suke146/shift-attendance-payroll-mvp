"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function redirectWithMessage(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

export async function signInAction(formData: FormData) {
  const supabase = await createClient();

  const email = getFormValue(formData, "email");
  const password = getFormValue(formData, "password");

  if (!email || !password) {
    redirectWithMessage("/auth/login", "メールアドレスとパスワードを入力してください");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Supabase signIn error:", {
      message: error.message,
      status: error.status,
      name: error.name,
    });

    redirectWithMessage(
      "/auth/login",
      `ログインに失敗しました: ${error.message}`
    );
  }

  redirect("/dashboard");
}

export async function signUpAction(formData: FormData) {
  const supabase = await createClient();

  const fullName = getFormValue(formData, "fullName");
  const email = getFormValue(formData, "email");
  const password = getFormValue(formData, "password");

  if (!fullName || !email || !password) {
    redirectWithMessage("/auth/signup", "名前、メールアドレス、パスワードを入力してください");
  }

  if (password.length < 6) {
    redirectWithMessage("/auth/signup", "パスワードは6文字以上で入力してください");
  }

  const headersList = await headers();
  const origin = headersList.get("origin");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
    },
  });

  if (error) {
    console.error("Supabase signUp error:", {
      message: error.message,
      status: error.status,
      name: error.name,
    });

    redirectWithMessage(
      "/auth/signup",
      `新規登録に失敗しました: ${error.message}`
    );
  }

  if (!data.session) {
    redirectWithMessage(
      "/auth/login",
      "新規登録しました。メール確認が必要な設定の場合は、確認後にログインしてください。"
    );
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/auth/login");
}