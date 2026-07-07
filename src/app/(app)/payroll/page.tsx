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
import {
  calculateShiftRequestEstimate,
  type WageRule,
} from "@/lib/wage";

type PayrollPageProps = {
  searchParams: Promise<{
    month?: string;
  }>;
};

type ProfileRow = {
  id: string;
  store_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string;
  employment_type: string;
  hourly_wage: number | null;
  monthly_salary: number | null;
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

type NormalizedShiftRow = Omit<ShiftRow, "profiles"> & {
  profiles: ProfileRow | null;
};

type RawWageRule = {
  store_id: string;
  rule_type: "weekday" | "holiday" | "time_range" | "night" | string;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  increase_type: "amount" | "rate" | string;
  increase_amount: number | null;
  increase_rate: number | string | null;
  priority: number | null;
};

type StoreHolidayRow = {
  store_id: string;
  holiday_date: string;
};

type PayrollDetailRow = {
  shiftId: string;
  storeId: string;
  staffId: string;
  staffName: string;
  email: string;
  employmentType: string;
  hourlyWage: number;
  monthlySalary: number;
  shiftDate: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workMinutes: number;
  isPayTarget: boolean;
  estimatedPay: number;
  note: string;
  calculationNote: string;
};

type PayrollSummaryRow = {
  staffId: string;
  staffName: string;
  email: string;
  employmentType: string;
  hourlyWage: number;
  monthlySalary: number;
  shiftCount: number;
  workMinutes: number;
  estimatedPayTotal: number;
  payrollAmount: number;
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

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours}時間${mins}分`;
}

function formatCurrency(value: number) {
  return `${Math.floor(value).toLocaleString()}円`;
}

function formatEmploymentType(value: string) {
  if (value === "part_time") {
    return "バイト・パート";
  }

  if (value === "full_time") {
    return "社員";
  }

  if (value === "contract") {
    return "契約";
  }

  return value;
}

function normalizeWageRule(rule: RawWageRule): WageRule {
  return {
    rule_type: rule.rule_type,
    day_of_week: rule.day_of_week,
    start_time: rule.start_time,
    end_time: rule.end_time,
    increase_type: rule.increase_type,
    increase_amount: rule.increase_amount ?? 0,
    increase_rate: Number(rule.increase_rate ?? 1),
    priority: rule.priority ?? 100,
  };
}

function buildRuleMap(rules: RawWageRule[]) {
  const map = new Map<string, WageRule[]>();

  for (const rule of rules) {
    const current = map.get(rule.store_id) ?? [];
    current.push(normalizeWageRule(rule));
    map.set(rule.store_id, current);
  }

  return map;
}

function buildHolidaySet(holidays: StoreHolidayRow[]) {
  const set = new Set<string>();

  for (const holiday of holidays) {
    set.add(`${holiday.store_id}:${holiday.holiday_date}`);
  }

  return set;
}

function buildPayrollSummaries(rows: PayrollDetailRow[]) {
  const map = new Map<string, PayrollSummaryRow>();

  for (const row of rows) {
    const current = map.get(row.staffId) ?? {
      staffId: row.staffId,
      staffName: row.staffName,
      email: row.email,
      employmentType: row.employmentType,
      hourlyWage: row.hourlyWage,
      monthlySalary: row.monthlySalary,
      shiftCount: 0,
      workMinutes: 0,
      estimatedPayTotal: 0,
      payrollAmount: 0,
    };

    current.shiftCount += 1;
    current.workMinutes += row.workMinutes;

    if (row.isPayTarget) {
      current.estimatedPayTotal += row.estimatedPay;
    }

    current.payrollAmount =
      current.employmentType === "full_time"
        ? current.monthlySalary
        : current.estimatedPayTotal;

    map.set(row.staffId, current);
  }

  return Array.from(map.values()).sort((a, b) =>
    a.staffName.localeCompare(b.staffName, "ja")
  );
}

export default async function PayrollPage({ searchParams }: PayrollPageProps) {
  const params = await searchParams;
  const { month, startDate, endDate } = getMonthRange(params.month);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: currentProfileData } = user
    ? await supabase
        .from("profiles")
        .select(
          "id, store_id, full_name, email, role, employment_type, hourly_wage, monthly_salary"
        )
        .eq("id", user.id)
        .single()
    : { data: null };

  const currentProfile = currentProfileData as ProfileRow | null;

  let shiftsQuery = supabase
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
        id,
        store_id,
        full_name,
        email,
        role,
        employment_type,
        hourly_wage,
        monthly_salary
      )
    `
    )
    .gte("shift_date", startDate)
    .lt("shift_date", endDate)
    .order("shift_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (currentProfile?.role === "staff") {
    shiftsQuery = shiftsQuery.eq("staff_id", currentProfile.id);
  }

  if (currentProfile?.role === "manager") {
    shiftsQuery = shiftsQuery.eq("store_id", currentProfile.store_id ?? "");
  }

  const { data: shiftsData } = await shiftsQuery;

  const shifts: NormalizedShiftRow[] = (
    (shiftsData ?? []) as unknown as ShiftRow[]
  ).map((shift) => ({
    ...shift,
    profiles: normalizeProfile(shift.profiles),
  }));

  const storeIds = Array.from(new Set(shifts.map((shift) => shift.store_id)));

  const { data: wageRulesData } =
    storeIds.length > 0
      ? await supabase
          .from("wage_rules")
          .select(
            "store_id, rule_type, day_of_week, start_time, end_time, increase_type, increase_amount, increase_rate, priority"
          )
          .in("store_id", storeIds)
          .eq("is_active", true)
          .order("priority", { ascending: true })
      : { data: [] };

  const { data: holidaysData } =
    storeIds.length > 0
      ? await supabase
          .from("store_holidays")
          .select("store_id, holiday_date")
          .in("store_id", storeIds)
          .gte("holiday_date", startDate)
          .lt("holiday_date", endDate)
          .eq("is_active", true)
      : { data: [] };

  const wageRuleMap = buildRuleMap((wageRulesData ?? []) as RawWageRule[]);
  const holidaySet = buildHolidaySet((holidaysData ?? []) as StoreHolidayRow[]);

  const payrollRows: PayrollDetailRow[] = shifts.map((shift) => {
    const profile =
      shift.profiles ??
      (currentProfile?.id === shift.staff_id ? currentProfile : null);

    const staffName = profile?.full_name ?? profile?.email ?? "不明";
    const email = profile?.email ?? "";
    const employmentType = profile?.employment_type ?? "part_time";
    const hourlyWage = profile?.hourly_wage ?? 0;
    const monthlySalary = profile?.monthly_salary ?? 0;

    const estimate = calculateShiftRequestEstimate({
      requestType: "work",
      requestDate: shift.shift_date,
      startTime: shift.start_time,
      endTime: shift.end_time,
      breakMinutes: shift.break_minutes,
      employmentType,
      hourlyWage,
      isHoliday: holidaySet.has(`${shift.store_id}:${shift.shift_date}`),
      wageRules: wageRuleMap.get(shift.store_id) ?? [],
    });

    return {
      shiftId: shift.id,
      storeId: shift.store_id,
      staffId: shift.staff_id,
      staffName,
      email,
      employmentType,
      hourlyWage,
      monthlySalary,
      shiftDate: shift.shift_date,
      startTime: shift.start_time,
      endTime: shift.end_time,
      breakMinutes: shift.break_minutes,
      workMinutes: estimate.estimatedWorkMinutes,
      isPayTarget: estimate.isPayTarget,
      estimatedPay: estimate.estimatedPay,
      note: shift.note ?? "",
      calculationNote: estimate.calculationNote,
    };
  });

  const summaries = buildPayrollSummaries(payrollRows);
  const totalPayrollAmount = summaries.reduce(
    (sum, summary) => sum + summary.payrollAmount,
    0
  );
  const totalWorkMinutes = summaries.reduce(
    (sum, summary) => sum + summary.workMinutes,
    0
  );

  const isManagerView =
    currentProfile?.role === "manager" || currentProfile?.role === "admin";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">給料計算</h2>
        <p className="mt-1 text-sm text-slate-600">
          確定シフト、スタッフの時給・月給、給与ルールをもとに概算給与を計算します。
        </p>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        この金額は概算です。正式な給与計算では、勤怠実績、休憩、残業、深夜、法定休日などの確認が必要です。
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">対象月</CardTitle>
          </CardHeader>

          <CardContent>
            <form className="space-y-3">
              <Input name="month" type="month" defaultValue={month} />
              <Button type="submit" variant="outline" className="w-full">
                表示する
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">表示範囲</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-2xl font-bold">
              {isManagerView ? "店舗全体" : "自分のみ"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              role: {currentProfile?.role ?? "unknown"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">勤務予定合計</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-2xl font-bold">
              {formatMinutes(totalWorkMinutes)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              確定シフトベースです。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">概算給与合計</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(totalPayrollAmount)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              月給制は月給を合計に含めます。
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{month} のスタッフ別集計</CardTitle>
        </CardHeader>

        <CardContent>
          {summaries.length === 0 ? (
            <p className="text-sm text-slate-600">
              この月の確定シフトがないため、給与目安はまだありません。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>スタッフ</TableHead>
                    <TableHead>雇用区分</TableHead>
                    <TableHead className="text-right">時給</TableHead>
                    <TableHead className="text-right">月給</TableHead>
                    <TableHead className="text-right">シフト数</TableHead>
                    <TableHead className="text-right">勤務予定</TableHead>
                    <TableHead className="text-right">時給計算分</TableHead>
                    <TableHead className="text-right">概算給与</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {summaries.map((summary) => (
                    <TableRow key={summary.staffId}>
                      <TableCell>
                        <div className="font-medium">{summary.staffName}</div>
                        <div className="text-xs text-slate-500">
                          {summary.email || "-"}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="secondary">
                          {formatEmploymentType(summary.employmentType)}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        {formatCurrency(summary.hourlyWage)}
                      </TableCell>

                      <TableCell className="text-right">
                        {formatCurrency(summary.monthlySalary)}
                      </TableCell>

                      <TableCell className="text-right">
                        {summary.shiftCount}件
                      </TableCell>

                      <TableCell className="text-right">
                        {formatMinutes(summary.workMinutes)}
                      </TableCell>

                      <TableCell className="text-right">
                        {formatCurrency(summary.estimatedPayTotal)}
                      </TableCell>

                      <TableCell className="text-right font-bold">
                        {formatCurrency(summary.payrollAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{month} のシフト別明細</CardTitle>
        </CardHeader>

        <CardContent>
          {payrollRows.length === 0 ? (
            <p className="text-sm text-slate-600">
              この月の給与計算対象シフトはありません。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>日付</TableHead>
                    <TableHead>スタッフ</TableHead>
                    <TableHead>雇用区分</TableHead>
                    <TableHead>時間</TableHead>
                    <TableHead className="text-right">休憩</TableHead>
                    <TableHead className="text-right">勤務予定</TableHead>
                    <TableHead className="text-right">時給</TableHead>
                    <TableHead className="text-right">概算収入</TableHead>
                    <TableHead>メモ</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {payrollRows.map((row) => (
                    <TableRow key={row.shiftId}>
                      <TableCell>{row.shiftDate}</TableCell>

                      <TableCell>
                        <div className="font-medium">{row.staffName}</div>
                        <div className="text-xs text-slate-500">
                          {row.email || "-"}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="secondary">
                          {formatEmploymentType(row.employmentType)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {formatTime(row.startTime)} - {formatTime(row.endTime)}
                      </TableCell>

                      <TableCell className="text-right">
                        {row.breakMinutes}分
                      </TableCell>

                      <TableCell className="text-right">
                        {formatMinutes(row.workMinutes)}
                      </TableCell>

                      <TableCell className="text-right">
                        {formatCurrency(row.hourlyWage)}
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        {row.isPayTarget
                          ? formatCurrency(row.estimatedPay)
                          : "月給制対象外"}
                      </TableCell>

                      <TableCell>{row.note || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500">
            土日祝・時間帯アップは wage_rules と store_holidays に登録されたルールを使って計算します。未登録の場合は基本時給のみで計算されます。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}