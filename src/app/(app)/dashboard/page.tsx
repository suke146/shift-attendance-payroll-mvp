import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  store_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string;
  employment_type: string | null;
  hourly_wage: number | null;
  monthly_salary: number | null;
};

type StoreRow = {
  id: string;
  name: string;
};

type ShiftRow = {
  id: string;
  staff_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  note: string | null;
};

type ShiftRequestRow = {
  id: string;
  request_date: string;
  request_type: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
};

function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const monthNumber = now.getMonth() + 1;
  const month = `${year}-${String(monthNumber).padStart(2, "0")}`;

  const startDate = `${month}-01`;
  const nextMonthDate = new Date(Date.UTC(year, monthNumber, 1));
  const endDate = nextMonthDate.toISOString().slice(0, 10);

  return {
    month,
    startDate,
    endDate,
  };
}

function formatTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return value.slice(0, 5);
}

function calculateWorkMinutes(
  startTime: string,
  endTime: string,
  breakMinutes: number
) {
  const [startHour, startMinute] = startTime.slice(0, 5).split(":").map(Number);
  const [endHour, endMinute] = endTime.slice(0, 5).split(":").map(Number);

  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;

  return Math.max(end - start - breakMinutes, 0);
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours}時間${mins}分`;
}

function formatCurrency(value: number) {
  return `${Math.floor(value).toLocaleString()}円`;
}

function formatEmploymentType(value: string | null) {
  if (value === "part_time") {
    return "バイト・パート";
  }

  if (value === "full_time") {
    return "社員";
  }

  if (value === "contract") {
    return "契約";
  }

  return "未設定";
}

function getTodayText() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { month, startDate, endDate } = getCurrentMonthRange();
  const today = getTodayText();

  const { data: profileData } = user
    ? await supabase
        .from("profiles")
        .select(
          "id, store_id, full_name, email, role, employment_type, hourly_wage, monthly_salary"
        )
        .eq("id", user.id)
        .single()
    : { data: null };

  const profile = profileData as ProfileRow | null;

  const { data: storeData } = profile?.store_id
    ? await supabase
        .from("stores")
        .select("id, name")
        .eq("id", profile.store_id)
        .single()
    : { data: null };

  const store = storeData as StoreRow | null;

  const isManager = profile?.role === "manager" || profile?.role === "admin";

  let myShiftsQuery = supabase
    .from("shifts")
    .select("id, staff_id, shift_date, start_time, end_time, break_minutes, note")
    .gte("shift_date", startDate)
    .lt("shift_date", endDate)
    .order("shift_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (profile?.id) {
    myShiftsQuery = myShiftsQuery.eq("staff_id", profile.id);
  }

  const { data: myShiftsData } = await myShiftsQuery;
  const myShifts = (myShiftsData ?? []) as ShiftRow[];

  const nextShift =
    myShifts.find((shift) => shift.shift_date >= today) ?? null;

  const myWorkMinutes = myShifts.reduce((sum, shift) => {
    return (
      sum +
      calculateWorkMinutes(
        shift.start_time,
        shift.end_time,
        shift.break_minutes
      )
    );
  }, 0);

  const { data: myRequestsData } = profile?.id
    ? await supabase
        .from("shift_requests")
        .select("id, request_date, request_type, start_time, end_time, status")
        .eq("staff_id", profile.id)
        .gte("request_date", startDate)
        .lt("request_date", endDate)
        .order("request_date", { ascending: true })
    : { data: [] };

  const myRequests = (myRequestsData ?? []) as ShiftRequestRow[];

  const { count: storeShiftCount } =
    isManager && profile?.store_id
      ? await supabase
          .from("shifts")
          .select("id", { count: "exact", head: true })
          .eq("store_id", profile.store_id)
          .gte("shift_date", startDate)
          .lt("shift_date", endDate)
      : { count: null };

  const { count: submittedRequestCount } =
    isManager && profile?.store_id
      ? await supabase
          .from("shift_requests")
          .select("id", { count: "exact", head: true })
          .eq("store_id", profile.store_id)
          .eq("status", "submitted")
          .gte("request_date", startDate)
          .lt("request_date", endDate)
      : { count: null };

  const { count: activeStaffCount } =
    isManager && profile?.store_id
      ? await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("store_id", profile.store_id)
          .eq("is_active", true)
      : { count: null };

  const estimatedBasePay =
    profile?.employment_type === "full_time"
      ? profile.monthly_salary ?? 0
      : Math.floor((myWorkMinutes / 60) * (profile?.hourly_wage ?? 0));

  const quickLinks = [
    {
      href: "/shifts/submit",
      label: "希望シフト提出",
      description: "勤務希望・休み希望を提出します。",
      icon: ClipboardList,
    },
    {
      href: "/shifts",
      label: "確定シフト",
      description: "自分の確定シフトを確認します。",
      icon: CalendarDays,
    },
    {
      href: "/calendar",
      label: "カレンダー表示",
      description: "月間カレンダーでシフトを確認します。",
      icon: CalendarDays,
    },
    {
      href: "/payroll",
      label: "給料計算",
      description: "確定シフトから給与目安を確認します。",
      icon: Wallet,
    },
  ];

  const managerLinks = [
    {
      href: "/admin/shift-requests",
      label: "希望シフト一覧",
      description: "スタッフの希望シフトを確認します。",
      icon: ClipboardList,
    },
    {
      href: "/admin/shifts/create",
      label: "シフト制作",
      description: "希望シフトから確定シフトを作成します。",
      icon: CalendarDays,
    },
    {
      href: "/admin/shifts/export",
      label: "Excel / スプレッドシート出力",
      description: "確定シフトを外部ファイルに出力します。",
      icon: FileSpreadsheet,
    },
    {
      href: "/admin/staff",
      label: "スタッフ管理",
      description: "スタッフ情報・時給・雇用区分を管理します。",
      icon: Users,
    },
    {
      href: "/admin/wage-rules",
      label: "給与ルール設定",
      description: "土日祝・時間帯アップを設定します。",
      icon: Settings,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">ようこそ</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {profile?.full_name ?? profile?.email ?? "ユーザー"} さん
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {store?.name ?? "店舗未設定"} / {month} の状況を表示しています。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">role: {profile?.role ?? "unknown"}</Badge>
            <Badge variant="outline">
              {formatEmploymentType(profile?.employment_type ?? null)}
            </Badge>
            {profile?.employment_type === "full_time" ? (
              <Badge variant="outline">
                月給 {formatCurrency(profile.monthly_salary ?? 0)}
              </Badge>
            ) : (
              <Badge variant="outline">
                時給 {formatCurrency(profile?.hourly_wage ?? 0)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">自分の確定シフト</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{myShifts.length}件</p>
            <p className="mt-1 text-sm text-slate-500">{month} の件数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">勤務予定時間</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatMinutes(myWorkMinutes)}</p>
            <p className="mt-1 text-sm text-slate-500">休憩控除後の目安</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">希望提出数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{myRequests.length}件</p>
            <p className="mt-1 text-sm text-slate-500">自分の提出済み希望</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">給与目安</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(estimatedBasePay)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              詳細は給料計算画面で確認
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>次回シフト</CardTitle>
          </CardHeader>

          <CardContent>
            {nextShift ? (
              <div className="space-y-3">
                <div className="rounded-lg border bg-blue-50 p-4">
                  <p className="text-sm text-slate-500">日付</p>
                  <p className="mt-1 text-xl font-bold">
                    {nextShift.shift_date}
                  </p>
                </div>

                <div className="rounded-lg border bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">時間</p>
                  <p className="mt-1 text-xl font-bold">
                    {formatTime(nextShift.start_time)} -{" "}
                    {formatTime(nextShift.end_time)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    休憩 {nextShift.break_minutes}分
                  </p>
                </div>

                {nextShift.note ? (
                  <p className="text-sm text-slate-600">{nextShift.note}</p>
                ) : null}

                <Button asChild className="w-full">
                  <Link href="/shifts">確定シフトを見る</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  今日以降の確定シフトはまだありません。
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/shifts/submit">希望シフトを提出する</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>よく使う機能</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {quickLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg border p-4 transition hover:bg-slate-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-slate-100 p-2">
                        <Icon className="h-5 w-5 text-slate-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {isManager ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">有効スタッフ数</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{activeStaffCount ?? 0}人</p>
                <p className="mt-1 text-sm text-slate-500">
                  自店舗の有効スタッフ
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">店舗シフト数</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{storeShiftCount ?? 0}件</p>
                <p className="mt-1 text-sm text-slate-500">
                  {month} の確定シフト
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">未処理の希望</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {submittedRequestCount ?? 0}件
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  status=submitted の希望
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>管理者メニュー</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {managerLinks.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-lg border p-4 transition hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-md bg-slate-100 p-2">
                          <Icon className="h-5 w-5 text-slate-700" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.label}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}