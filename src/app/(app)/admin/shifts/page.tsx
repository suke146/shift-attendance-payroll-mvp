import Link from "next/link";

import { deleteShiftAction } from "./actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

type AdminShiftsPageProps = {
  searchParams: Promise<{
    month?: string;
    message?: string;
  }>;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type RawProfileJoin = ProfileRow | ProfileRow[] | null;

type ShiftRow = {
  id: string;
  staff_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  note: string | null;
  profiles: RawProfileJoin;
};

function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getMonthRange(monthText?: string) {
  const month = /^\d{4}-\d{2}$/.test(monthText ?? "")
    ? monthText!
    : getCurrentMonth();

  const [yearText, monthNumberText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthNumberText);

  const startDate = `${month}-01`;
  const nextMonthDate = new Date(Date.UTC(year, monthNumber, 1));
  const endDate = nextMonthDate.toISOString().slice(0, 10);

  return {
    month,
    startDate,
    endDate,
  };
}

function normalizeProfile(profile: RawProfileJoin): ProfileRow | null {
  if (Array.isArray(profile)) {
    return profile[0] ?? null;
  }

  return profile;
}

function formatTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return value.slice(0, 5);
}

function formatWorkTime(
  startTime: string,
  endTime: string,
  breakMinutes: number
) {
  const [startHour, startMinute] = startTime.slice(0, 5).split(":").map(Number);
  const [endHour, endMinute] = endTime.slice(0, 5).split(":").map(Number);

  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const total = Math.max(end - start - breakMinutes, 0);

  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  return `${hours}時間${minutes}分`;
}

export default async function AdminShiftsPage({
  searchParams,
}: AdminShiftsPageProps) {
  const params = await searchParams;
  const { month, startDate, endDate } = getMonthRange(params.month);

  const supabase = await createClient();

  const { data: shiftsData } = await supabase
    .from("shifts")
    .select(
      `
      id,
      staff_id,
      shift_date,
      start_time,
      end_time,
      break_minutes,
      note,
      profiles:staff_id (
        id,
        full_name,
        email
      )
    `
    )
    .gte("shift_date", startDate)
    .lt("shift_date", endDate)
    .order("shift_date", { ascending: true })
    .order("start_time", { ascending: true });

  const shifts = ((shiftsData ?? []) as unknown as ShiftRow[]).map((shift) => ({
    ...shift,
    profiles: normalizeProfile(shift.profiles),
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">シフト管理</h2>
        <p className="mt-1 text-sm text-slate-600">
          確定シフトの確認・編集・削除を行います。
        </p>
      </div>

      {params.message ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {params.message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>表示月</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <label htmlFor="month" className="text-sm font-medium">
                対象月
              </label>
              <Input
                id="month"
                name="month"
                type="month"
                defaultValue={month}
              />
            </div>

            <Button type="submit">表示する</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{month} の確定シフト</CardTitle>
        </CardHeader>

        <CardContent>
          {shifts.length === 0 ? (
            <p className="text-sm text-slate-600">
              この月の確定シフトはまだありません。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日付</TableHead>
                    <TableHead>スタッフ</TableHead>
                    <TableHead>時間</TableHead>
                    <TableHead className="text-right">休憩</TableHead>
                    <TableHead className="text-right">勤務予定</TableHead>
                    <TableHead>メモ</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {shifts.map((shift) => {
                    const profile = normalizeProfile(shift.profiles);

                    return (
                      <TableRow key={shift.id}>
                        <TableCell>{shift.shift_date}</TableCell>

                        <TableCell>
                          <div className="font-medium">
                            {profile?.full_name ?? "不明"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {profile?.email ?? "-"}
                          </div>
                        </TableCell>

                        <TableCell>
                          {formatTime(shift.start_time)} -{" "}
                          {formatTime(shift.end_time)}
                        </TableCell>

                        <TableCell className="text-right">
                          {shift.break_minutes}分
                        </TableCell>

                        <TableCell className="text-right">
                          {formatWorkTime(
                            shift.start_time,
                            shift.end_time,
                            shift.break_minutes
                          )}
                        </TableCell>

                        <TableCell>{shift.note ?? "-"}</TableCell>

                        <TableCell>
                          <Badge variant="secondary">確定</Badge>
                        </TableCell>

                        <TableCell className="space-y-2 text-right">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/admin/shifts/${shift.id}/edit`}>
                              編集
                            </Link>
                          </Button>

                          <form action={deleteShiftAction}>
                            <input
                              type="hidden"
                              name="shiftId"
                              value={shift.id}
                            />
                            <Button
                              type="submit"
                              variant="destructive"
                              size="sm"
                            >
                              削除
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}