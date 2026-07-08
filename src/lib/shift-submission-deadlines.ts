import type { SupabaseClient } from "@supabase/supabase-js";

export type ShiftSubmissionDeadlineStatus = {
  targetMonth: string;
  isConfigured: boolean;
  isOpen: boolean;
  deadlineDate: string | null;
  deadlineTime: string | null;
  message: string;
};

type DeadlineRow = {
  target_month: string;
  deadline_date: string;
  deadline_time: string;
  note: string | null;
  is_active: boolean;
};

export function getCurrentTargetMonth() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";

  return `${year}-${month}`;
}

export function getTargetMonthFromDate(dateText: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return dateText.slice(0, 7);
  }

  return getCurrentTargetMonth();
}

function getJapanNowDateTimeText() {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
  };
}

function formatDeadlineText(deadlineDate: string, deadlineTime: string) {
  return `${deadlineDate} ${deadlineTime.slice(0, 5)}まで`;
}

export async function getShiftSubmissionDeadlineStatus({
  supabase,
  storeId,
  targetMonth,
}: {
  supabase: SupabaseClient;
  storeId: string | null | undefined;
  targetMonth?: string | null;
}): Promise<ShiftSubmissionDeadlineStatus> {
  const normalizedTargetMonth =
    /^\d{4}-\d{2}$/.test(targetMonth ?? "")
      ? targetMonth!
      : getCurrentTargetMonth();

  if (!storeId) {
    return {
      targetMonth: normalizedTargetMonth,
      isConfigured: false,
      isOpen: false,
      deadlineDate: null,
      deadlineTime: null,
      message: "店舗情報が未設定のため、提出期限を確認できません。",
    };
  }

  const { data, error } = await supabase
    .from("shift_submission_deadlines")
    .select("target_month, deadline_date, deadline_time, note, is_active")
    .eq("store_id", storeId)
    .eq("target_month", normalizedTargetMonth)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("getShiftSubmissionDeadlineStatus error:", error);

    return {
      targetMonth: normalizedTargetMonth,
      isConfigured: false,
      isOpen: false,
      deadlineDate: null,
      deadlineTime: null,
      message: "提出期限の確認に失敗しました。",
    };
  }

  if (!data) {
    return {
      targetMonth: normalizedTargetMonth,
      isConfigured: false,
      isOpen: true,
      deadlineDate: null,
      deadlineTime: null,
      message: "この月の提出期限は未設定です。",
    };
  }

  const deadline = data as DeadlineRow;
  const now = getJapanNowDateTimeText();

  const deadlineDate = deadline.deadline_date;
  const deadlineTime = deadline.deadline_time.slice(0, 5);

  const isBeforeDeadlineDate = now.date < deadlineDate;
  const isSameDeadlineDate = now.date === deadlineDate;
  const isBeforeOrSameDeadlineTime = now.time <= deadlineTime;

  const isOpen =
    isBeforeDeadlineDate || (isSameDeadlineDate && isBeforeOrSameDeadlineTime);

  return {
    targetMonth: normalizedTargetMonth,
    isConfigured: true,
    isOpen,
    deadlineDate,
    deadlineTime,
    message: isOpen
      ? `提出期限内です。${formatDeadlineText(deadlineDate, deadlineTime)}`
      : `提出期限を過ぎています。締切：${formatDeadlineText(
          deadlineDate,
          deadlineTime
        )}`,
  };
}