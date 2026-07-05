"use server";

import { revalidatePath } from "next/cache";
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
  const email = getFormValue(formData, "email");
  const password = getFormValue(formData, "password");

  if (!email || !password) {
    redirectWithMessage(
      "/auth/login",
      "メールアドレスとパスワードを入力してください"
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
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

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUpAction(formData: FormData) {
  const fullName = getFormValue(formData, "fullName");
  const email = getFormValue(formData, "email");
  const password = getFormValue(formData, "password");

  if (!fullName || !email || !password) {
    redirectWithMessage(
      "/auth/signup",
      "名前、メールアドレス、パスワードを入力してください"
    );
  }

  if (password.length < 6) {
    redirectWithMessage(
      "/auth/signup",
      "パスワードは6文字以上にしてください"
    );
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

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
    redirectWithMessage(
      "/auth/signup",
      "新規登録に失敗しました。別のメールアドレスで試してください。"
    );
  }

  if (!data.session) {
    redirectWithMessage(
      "/auth/login",
      "登録しました。確認メールが届いている場合は、メール内のリンクを開いてからログインしてください。"
    );
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/auth/login");
}