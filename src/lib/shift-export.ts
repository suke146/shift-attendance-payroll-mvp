import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  full_name: string | null;
  email: string | null;
};

type RawProfileJoin = ProfileRow | ProfileRow[] | null;

type ShiftRow = {
  id: string;
  store_id: string;
  staff_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  note: string | null;
  profiles: RawProfileJoin;
};

export type ShiftExportRow = {
  shiftDate: string;
  day: string;
  staffName: string;
  email: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workTime: string;
  workMinutes: number;
  note: string;
};

export type ShiftSummaryRow = {
  staffName: string;
  email: string;
  shiftCount: number;
  workTime: string;
  workMinutes: number;
};

export type ShiftExportData = {
  month: string;
  startDate: string;
  endDate: string;
  rows: ShiftExportRow[];
  summaries: ShiftSummaryRow[];
};

export class ShiftExportError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ShiftExportError";
    this.status = status;
  }
}

const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function getMonthRange(monthText?: string | null) {
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
    return "";
  }

  return value.slice(0, 5);
}

function getDayLabel(dateText: string) {
  const [yearText, monthText, dayText] = dateText.split("-");
  const date = new Date(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText)
  );

  return dayLabels[date.getDay()];
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

function formatWorkTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours}時間${mins}分`;
}

export function buildSheetValues(data: ShiftExportData) {
  const shiftValues = [
    [
      "日付",
      "曜日",
      "スタッフ名",
      "メール",
      "開始",
      "終了",
      "休憩(分)",
      "勤務予定",
      "勤務予定(分)",
      "メモ",
    ],
    ...data.rows.map((row) => [
      row.shiftDate,
      row.day,
      row.staffName,
      row.email,
      row.startTime,
      row.endTime,
      row.breakMinutes,
      row.workTime,
      row.workMinutes,
      row.note,
    ]),
  ];

  const summaryValues = [
    ["スタッフ名", "メール", "シフト数", "勤務予定合計", "勤務予定合計(分)"],
    ...data.summaries.map((summary) => [
      summary.staffName,
      summary.email,
      summary.shiftCount,
      summary.workTime,
      summary.workMinutes,
    ]),
  ];

  return {
    shiftValues,
    summaryValues,
  };
}

export async function getShiftExportDataForCurrentUser(
  monthText?: string | null
): Promise<ShiftExportData> {
  const { month, startDate, endDate } = getMonthRange(monthText);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ShiftExportError("ログインが必要です", 401);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, store_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "manager" && profile.role !== "admin")) {
    throw new ShiftExportError("権限がありません", 403);
  }

  let query = supabase
    .from("shifts")
    .select(
      `
      id,
      store_id,
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

  if (profile.role !== "admin") {
    query = query.eq("store_id", profile.store_id);
  }

  const { data: shiftsData, error } = await query;

  if (error) {
    console.error("getShiftExportDataForCurrentUser error:", error);
    throw new ShiftExportError("シフト取得に失敗しました", 500);
  }

  const shifts = ((shiftsData ?? []) as unknown as ShiftRow[]).map((shift) => ({
    ...shift,
    profiles: normalizeProfile(shift.profiles),
  }));

  const rows: ShiftExportRow[] = shifts.map((shift) => {
    const profileRow = normalizeProfile(shift.profiles);
    const workMinutes = calculateWorkMinutes(
      shift.start_time,
      shift.end_time,
      shift.break_minutes
    );

    return {
      shiftDate: shift.shift_date,
      day: getDayLabel(shift.shift_date),
      staffName: profileRow?.full_name ?? "不明",
      email: profileRow?.email ?? "",
      startTime: formatTime(shift.start_time),
      endTime: formatTime(shift.end_time),
      breakMinutes: shift.break_minutes,
      workTime: formatWorkTime(workMinutes),
      workMinutes,
      note: shift.note ?? "",
    };
  });

  const summaryMap = new Map<
    string,
    {
      staffName: string;
      email: string;
      shiftCount: number;
      workMinutes: number;
    }
  >();

  for (const shift of shifts) {
    const profileRow = normalizeProfile(shift.profiles);
    const key = shift.staff_id;

    const current = summaryMap.get(key) ?? {
      staffName: profileRow?.full_name ?? "不明",
      email: profileRow?.email ?? "",
      shiftCount: 0,
      workMinutes: 0,
    };

    current.shiftCount += 1;
    current.workMinutes += calculateWorkMinutes(
      shift.start_time,
      shift.end_time,
      shift.break_minutes
    );

    summaryMap.set(key, current);
  }

  const summaries: ShiftSummaryRow[] = Array.from(summaryMap.values()).map(
    (summary) => ({
      ...summary,
      workTime: formatWorkTime(summary.workMinutes),
    })
  );

  return {
    month,
    startDate,
    endDate,
    rows,
    summaries,
  };
}