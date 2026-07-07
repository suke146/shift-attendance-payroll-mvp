import { deleteShiftRequestAction } from "../actions";

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

type ShiftRequestsPageProps = {
  searchParams: Promise<{
    month?: string;
    message?: string;
  }>;
};

type ProfileRow = {
  full_name: string | null;
  email: string | null;
};

type ShiftRequestRow = {
  id: string;
  staff_id: string;
  request_date: string;
  request_type: "work" | "off";
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  staff_note: string | null;
  status: string;
  profiles: ProfileRow | null;
};

type RawShiftRequestRow = Omit<ShiftRequestRow, "profiles"> & {
  profiles: ProfileRow | ProfileRow[] | null;
};

type ShiftEstimate = {
  shift_request_id: string;
  is_pay_target: boolean;
  estimated_work_minutes: number;
  estimated_pay: number;
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

function normalizeProfile(
  profile: ProfileRow | ProfileRow[] | null
): ProfileRow | null {
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

function formatRequestType(type: "work" | "off") {
  return type === "work" ? "勤務希望" : "休み希望";
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours}時間${mins}分`;
}

function formatPay(estimate?: ShiftEstimate) {
  if (!estimate) {
    return "非表示";
  }

  if (!estimate.is_pay_target) {
    return "月給制対象外";
  }

  return `${estimate.estimated_pay.toLocaleString()}円`;
}

export default async function ShiftRequestsPage({
  searchParams,
}: ShiftRequestsPageProps) {
  const params = await searchParams;
  const { month, startDate, endDate } = getMonthRange(params.month);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: requestsData } = await supabase
    .from("shift_requests")
    .select(
      `
      id,
      staff_id,
      request_date,
      request_type,
      start_time,
      end_time,
      break_minutes,
      staff_note,
      status,
      profiles:staff_id (
        full_name,
        email
      )
    `
    )
    .gte("request_date", startDate)
    .lt("request_date", endDate)
    .order("request_date", { ascending: true })
    .order("start_time", { ascending: true });

  const rawRequests = (requestsData ?? []) as unknown as RawShiftRequestRow[];

  const requests: ShiftRequestRow[] = rawRequests.map((request) => ({
    ...request,
    profiles: normalizeProfile(request.profiles),
  }));

  const requestIds = requests.map((request) => request.id);

  const { data: estimatesData } =
    requestIds.length > 0
      ? await supabase
          .from("shift_request_estimates")
          .select(
            "shift_request_id, is_pay_target, estimated_work_minutes, estimated_pay"
          )
          .in("shift_request_id", requestIds)
      : { data: [] };

  const estimates = (estimatesData ?? []) as unknown as ShiftEstimate[];

  const estimateMap = new Map(
    estimates.map((estimate) => [estimate.shift_request_id, estimate])
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          提出済み希望シフト
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          同じ店舗のスタッフ全員が提出した希望シフトを確認できます。
          給与目安は本人または管理者のみ表示されます。
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
          <CardTitle>{month} の希望シフト一覧</CardTitle>
        </CardHeader>

        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-slate-600">
              この月の希望シフトはまだ提出されていません。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>希望日</TableHead>
                    <TableHead>スタッフ</TableHead>
                    <TableHead>区分</TableHead>
                    <TableHead>時間</TableHead>
                    <TableHead className="text-right">休憩</TableHead>
                    <TableHead className="text-right">予定勤務</TableHead>
                    <TableHead className="text-right">概算収入</TableHead>
                    <TableHead>メモ</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {requests.map((request) => {
                    const estimate = estimateMap.get(request.id);

                    return (
                      <TableRow key={request.id}>
                        <TableCell>{request.request_date}</TableCell>

                        <TableCell>
                          <div className="font-medium">
                            {request.profiles?.full_name ?? "不明"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {request.profiles?.email ?? "-"}
                          </div>
                        </TableCell>

                        <TableCell>
                          {formatRequestType(request.request_type)}
                        </TableCell>

                        <TableCell>
                          {request.request_type === "off"
                            ? "-"
                            : `${formatTime(request.start_time)} - ${formatTime(
                                request.end_time
                              )}`}
                        </TableCell>

                        <TableCell className="text-right">
                          {request.break_minutes}分
                        </TableCell>

                        <TableCell className="text-right">
                          {estimate
                            ? formatMinutes(estimate.estimated_work_minutes)
                            : "-"}
                        </TableCell>

                        <TableCell className="text-right">
                          {formatPay(estimate)}
                        </TableCell>

                        <TableCell>{request.staff_note ?? "-"}</TableCell>

                        <TableCell>
                          <Badge variant="secondary">{request.status}</Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          {user?.id === request.staff_id &&
                          request.status === "submitted" ? (
                            <form action={deleteShiftRequestAction}>
                              <input
                                type="hidden"
                                name="shiftRequestId"
                                value={request.id}
                              />
                              <input
                                type="hidden"
                                name="returnTo"
                                value="/shifts/requests"
                              />
                              <Button
                                type="submit"
                                variant="destructive"
                                size="sm"
                              >
                                削除
                              </Button>
                            </form>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
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