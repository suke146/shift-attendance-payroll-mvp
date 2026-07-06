import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, hourly_wage")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/auth/login?message=プロフィール情報が見つかりません");
  }

  return (
    <AppShell
      profile={{
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        hourly_wage: profile.hourly_wage,
      }}
      userEmail={user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}