"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Calculator,
  ClipboardList,
  FileSpreadsheet,
  Home,
  Inbox,
  Send,
  Shield,
  Store,
  Users,
} from "lucide-react";

type Role = "staff" | "manager" | "admin" | string;

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const staffNavItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "ホーム",
    icon: Home,
  },
  {
    href: "/shifts/submit",
    label: "希望シフト提出",
    icon: Send,
  },
  {
    href: "/shifts/requests",
    label: "提出済み希望シフト",
    icon: ClipboardList,
  },
  {
    href: "/shifts",
    label: "確定シフト",
    icon: CalendarCheck,
  },
  {
    href: "/calendar",
    label: "カレンダー表示",
    icon: CalendarDays,
  },
  {
    href: "/payroll",
    label: "給料計算",
    icon: Calculator,
  },
];

const managerNavItems: NavItem[] = [
  {
    href: "/admin/shift-requests",
    label: "希望シフト一覧",
    icon: Inbox,
  },
  {
    href: "/admin/shifts/create",
    label: "シフト制作",
    icon: CalendarPlus,
  },
  {
    href: "/admin/shifts",
    label: "シフト管理",
    icon: CalendarDays,
  },
  {
    href: "/admin/shifts/export",
    label: "Excel出力",
    icon: FileSpreadsheet,
  },
  {
    href: "/admin/staff",
    label: "スタッフ管理",
    icon: Users,
  },
  {
    href: "/admin/store",
    label: "店舗登録",
    icon: Store,
  },
];

const systemNavItems: NavItem[] = [
  {
    href: "/system/stores",
    label: "全店舗管理",
    icon: Building2,
  },
  {
    href: "/system/users",
    label: "全ユーザー管理",
    icon: Shield,
  },
];

function canManage(role: Role) {
  return role === "manager" || role === "admin";
}

function isSystemAdmin(role: Role) {
  return role === "admin";
}

function isActivePath(pathname: string, href: string) {
  if (pathname === href) {
    return true;
  }

  // 親URLが他メニューを巻き込まないようにする
  if (href === "/dashboard" || href === "/shifts" || href === "/admin/shifts") {
    return false;
  }

  return pathname.startsWith(`${href}/`);
}

function NavSection({
  title,
  items,
}: {
  title: string;
  items: NavItem[];
}) {
  const pathname = usePathname();

  return (
    <div>
      <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-slate-400">
        {title}
      </p>

      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function SidebarNav({ role }: { role: Role }) {
  return (
    <nav className="space-y-6">
      <NavSection title="STAFF" items={staffNavItems} />

      {canManage(role) ? (
        <NavSection title="MANAGER" items={managerNavItems} />
      ) : null}

      {isSystemAdmin(role) ? (
        <NavSection title="SYSTEM ADMIN" items={systemNavItems} />
      ) : null}
    </nav>
  );
}