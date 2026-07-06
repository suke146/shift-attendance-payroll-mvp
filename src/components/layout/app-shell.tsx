import type { ReactNode } from "react";
import { LogOut } from "lucide-react";

import { signOutAction } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/layout/sidebar-nav";

type AppShellProfile = {
  full_name: string | null;
  email: string | null;
  role: string;
  hourly_wage: number | null;
};

type AppShellProps = {
  children: ReactNode;
  profile: AppShellProfile;
  userEmail: string;
};

export function AppShell({ children, profile, userEmail }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r bg-white md:flex">
        <div className="border-b px-5 py-4">
          <p className="text-xs font-medium text-slate-500">
            Shift Manager MVP
          </p>
          <h1 className="mt-1 text-lg font-bold text-slate-900">
            シフト管理
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav role={profile.role} />
        </div>

        <div className="border-t p-4">
          <div className="mb-3 space-y-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {profile.full_name ?? userEmail}
            </p>
            <p className="truncate text-xs text-slate-500">
              {profile.email ?? userEmail}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{profile.role}</Badge>
              <span className="text-xs text-slate-500">
                時給 {profile.hourly_wage ?? 0}円
              </span>
            </div>
          </div>

          <form action={signOutAction}>
            <Button type="submit" variant="outline" className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              ログアウト
            </Button>
          </form>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 border-b bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">Shift Manager MVP</p>
              <p className="text-sm font-bold text-slate-900">
                {profile.full_name ?? userEmail}
              </p>
            </div>

            <Badge variant="secondary">{profile.role}</Badge>
          </div>

          <div className="max-h-[55vh] overflow-y-auto rounded-lg border bg-white p-2">
            <SidebarNav role={profile.role} />
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}