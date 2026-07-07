import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";

type CalendarPageProps = {
  searchParams: Promise<{
    month?: string;
  }>;
};

type ProfileRow = {
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

type CalendarDay = {
  date: string;
  day: number;
  dayOfWeek: number;
  isToday: boolean;
};

const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

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
    year,
    monthNumber,
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

function formatWorkMinutes(
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

function buildCalendarDays(year: number, monthNumber: number): Array<CalendarDay | null> {
  const todayText = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(year, monthNumber - 1, 1).getDay();
  const daysInMonth = new Date(year, monthNumber, 0).getDate();

  const days: Array<CalendarDay | null> = [];

  for (let i = 0; i < firstDay; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(monthNumber).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;

    days.push({
      date,
      day,
      dayOfWeek: new Date(year, monthNumber - 1, day).getDay(),
      isToday: date === todayText,
    });
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function groupShiftsByDate(shifts: ShiftRow[]) {
  const map = new Map<string, ShiftRow[]>();

  for (const shift of shifts) {
    const list = map.get(shift.shift_date) ?? [];
    list.push(shift);
    map.set(shift.shift_date, list);
  }

  return map;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const { month, year, monthNumber, startDate, endDate } = getMonthRange(
    params.month
  );

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const calendarDays = buildCalendarDays(year, monthNumber);
  const shiftsByDate = groupShiftsByDate(shifts);

  const totalShiftCount = shifts.length;
  const myShiftCount = shifts.filter((shift) => shift.staff_id === user?.id).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">カレンダー表示</h2>
        <p className="mt-1 text-sm text-slate-600">
          確定シフトを月間カレンダー形式で確認できます。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">表示月</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3">
              <Input name="month" type="month" defaultValue={month} />
              <Button type="submit">表示する</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">確定シフト数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalShiftCount}</p>
            <p className="mt-1 text-sm text-slate-500">
              この月に登録されている確定シフト数です。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">自分のシフト数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{myShiftCount}</p>
            <p className="mt-1 text-sm text-slate-500">
              ログイン中ユーザーの確定シフト数です。
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{month} のシフトカレンダー</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-7 border-l border-t text-sm">
            {dayLabels.map((label, index) => (
              <div
                key={label}
                className={[
                  "border-b border-r bg-slate-50 p-2 text-center font-semibold",
                  index === 0 ? "text-red-600" : "",
                  index === 6 ? "text-blue-600" : "",
                ].join(" ")}
              >
                {label}
              </div>
            ))}

            {calendarDays.map((day, index) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="min-h-32 border-b border-r bg-slate-50 p-2"
                  />
                );
              }

              const dayShifts = shiftsByDate.get(day.date) ?? [];
              const isSunday = day.dayOfWeek === 0;
              const isSaturday = day.dayOfWeek === 6;

              return (
                <div
                  key={day.date}
                  className={[
                    "min-h-32 border-b border-r bg-white p-2 align-top",
                    day.isToday ? "bg-amber-50" : "",
                  ].join(" ")}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={[
                        "font-semibold",
                        isSunday ? "text-red-600" : "",
                        isSaturday ? "text-blue-600" : "",
                      ].join(" ")}
                    >
                      {day.day}
                    </span>

                    {day.isToday ? (
                      <Badge variant="secondary" className="text-[10px]">
                        今日
                      </Badge>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    {dayShifts.length === 0 ? (
                      <p className="text-xs text-slate-400">シフトなし</p>
                    ) : (
                      dayShifts.map((shift) => {
                        const profile = normalizeProfile(shift.profiles);
                        const isMine = shift.staff_id === user?.id;

                        return (
                          <div
                            key={shift.id}
                            className={[
                              "rounded-md border p-2 text-xs",
                              isMine
                                ? "border-blue-200 bg-blue-50"
                                : "border-slate-200 bg-slate-50",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate font-semibold">
                                {profile?.full_name ?? "不明"}
                              </p>

                              {isMine ? (
                                <Badge className="text-[10px]">自分</Badge>
                              ) : null}
                            </div>

                            <p className="mt-1 text-slate-700">
                              {formatTime(shift.start_time)} -{" "}
                              {formatTime(shift.end_time)}
                            </p>

                            <p className="mt-1 text-slate-500">
                              {formatWorkMinutes(
                                shift.start_time,
                                shift.end_time,
                                shift.break_minutes
                              )}
                            </p>

                            {shift.note ? (
                              <p className="mt-1 line-clamp-2 text-slate-500">
                                {shift.note}
                              </p>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}