export type EmploymentType = "part_time" | "full_time" | "contract" | string;

export type WageRule = {
  rule_type: "weekday" | "holiday" | "time_range" | "night" | string;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  increase_type: "amount" | "rate" | string;
  increase_amount: number | null;
  increase_rate: number | null;
  priority: number | null;
};

type CalculateShiftRequestEstimateInput = {
  requestType: "work" | "off";
  requestDate: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  employmentType: EmploymentType;
  hourlyWage: number;
  isHoliday: boolean;
  wageRules: WageRule[];
};

type CalculateShiftRequestEstimateResult = {
  isPayTarget: boolean;
  estimatedWorkMinutes: number;
  hourlyWageSnapshot: number;
  estimatedPay: number;
  calculationNote: string;
};

function parseTimeToMinute(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const [hourText, minuteText] = value.slice(0, 5).split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

function getDayOfWeek(dateText: string): number {
  const [yearText, monthText, dayText] = dateText.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function isMinuteInRange(
  minute: number,
  startMinute: number,
  endMinute: number
): boolean {
  if (startMinute === endMinute) {
    return false;
  }

  if (startMinute < endMinute) {
    return minute >= startMinute && minute < endMinute;
  }

  // 22:00 - 05:00 のように日付をまたぐルール
  return minute >= startMinute || minute < endMinute;
}

function doesRuleApplyToMinute({
  rule,
  minute,
  dayOfWeek,
  isHoliday,
}: {
  rule: WageRule;
  minute: number;
  dayOfWeek: number;
  isHoliday: boolean;
}): boolean {
  if (rule.rule_type === "weekday") {
    return rule.day_of_week === dayOfWeek;
  }

  if (rule.rule_type === "holiday") {
    return isHoliday;
  }

  if (rule.rule_type === "time_range" || rule.rule_type === "night") {
    const startMinute = parseTimeToMinute(rule.start_time);
    const endMinute = parseTimeToMinute(rule.end_time);

    if (startMinute === null || endMinute === null) {
      return false;
    }

    return isMinuteInRange(minute, startMinute, endMinute);
  }

  return false;
}

export function calculateShiftRequestEstimate(
  input: CalculateShiftRequestEstimateInput
): CalculateShiftRequestEstimateResult {
  if (input.requestType === "off") {
    return {
      isPayTarget: input.employmentType !== "full_time",
      estimatedWorkMinutes: 0,
      hourlyWageSnapshot: input.hourlyWage,
      estimatedPay: 0,
      calculationNote: "休み希望のため勤務予定時間は0分です。",
    };
  }

  const startMinute = parseTimeToMinute(input.startTime);
  const endMinute = parseTimeToMinute(input.endTime);

  if (startMinute === null || endMinute === null || endMinute <= startMinute) {
    return {
      isPayTarget: input.employmentType !== "full_time",
      estimatedWorkMinutes: 0,
      hourlyWageSnapshot: input.hourlyWage,
      estimatedPay: 0,
      calculationNote: "勤務時間が不正なため概算できません。",
    };
  }

  const rawWorkMinutes = endMinute - startMinute;
  const estimatedWorkMinutes = Math.max(rawWorkMinutes - input.breakMinutes, 0);

  if (input.employmentType === "full_time") {
    return {
      isPayTarget: false,
      estimatedWorkMinutes,
      hourlyWageSnapshot: input.hourlyWage,
      estimatedPay: 0,
      calculationNote: "月給制のため、希望シフト単位の概算収入は対象外です。",
    };
  }

  if (input.hourlyWage <= 0 || estimatedWorkMinutes <= 0) {
    return {
      isPayTarget: true,
      estimatedWorkMinutes,
      hourlyWageSnapshot: input.hourlyWage,
      estimatedPay: 0,
      calculationNote: "時給または勤務予定時間が0のため、概算収入は0円です。",
    };
  }

  const dayOfWeek = getDayOfWeek(input.requestDate);

  const sortedRules = [...input.wageRules].sort(
    (a, b) => (a.priority ?? 100) - (b.priority ?? 100)
  );

  const paidMinutes = Array.from(
    { length: rawWorkMinutes },
    (_, index) => startMinute + index
  ).slice(0, estimatedWorkMinutes);

  let totalPay = 0;

  for (const absoluteMinute of paidMinutes) {
    const minuteOfDay = absoluteMinute % (24 * 60);

    let amountBonus = 0;
    let rateMultiplier = 1;

    for (const rule of sortedRules) {
      const applies = doesRuleApplyToMinute({
        rule,
        minute: minuteOfDay,
        dayOfWeek,
        isHoliday: input.isHoliday,
      });

      if (!applies) {
        continue;
      }

      if (rule.increase_type === "amount") {
        amountBonus += rule.increase_amount ?? 0;
      }

      if (rule.increase_type === "rate") {
        rateMultiplier *= rule.increase_rate ?? 1;
      }
    }

    const minuteWage = ((input.hourlyWage + amountBonus) * rateMultiplier) / 60;
    totalPay += minuteWage;
  }

  return {
    isPayTarget: true,
    estimatedWorkMinutes,
    hourlyWageSnapshot: input.hourlyWage,
    estimatedPay: Math.floor(totalPay),
    calculationNote:
      "基本時給、曜日・祝日・時間帯ルールをもとに概算しています。休憩時間はMVPでは勤務時間の末尾から控除して計算します。",
  };
}