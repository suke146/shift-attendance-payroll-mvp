import {
    createShiftRequestAction,
    deleteShiftRequestAction,
  } from "../actions";
  import { Badge } from "@/components/ui/badge";
  import { Button } from "@/components/ui/button";
  import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { SubmissionDeadlineCard } from "@/components/shifts/submission-deadline-card";
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
  import { Textarea } from "@/components/ui/textarea";
  import { createClient } from "@/lib/supabase/server";
  
  type ShiftSubmitPageProps = {
    searchParams: Promise<{
      message?: string;
    }>;
  };
  
  type ShiftRequest = {
    id: string;
    request_date: string;
    request_type: "work" | "off";
    start_time: string | null;
    end_time: string | null;
    break_minutes: number;
    staff_note: string | null;
    status: string;
  };
  
  type ShiftEstimate = {
    shift_request_id: string;
    employment_type_snapshot: string;
    is_pay_target: boolean;
    estimated_work_minutes: number;
    hourly_wage_snapshot: number;
    estimated_pay: number;
    calculation_note: string | null;
  };
  
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
      return "-";
    }
  
    if (!estimate.is_pay_target) {
      return "月給制のため対象外";
    }
  
    return `${estimate.estimated_pay.toLocaleString()}円`;
  }
  
  export default async function ShiftSubmitPage({
    searchParams,
  }: ShiftSubmitPageProps) {
    const params = await searchParams;
    const supabase = await createClient();
  
    const {
      data: { user },
    } = await supabase.auth.getUser();
  
    const { data: myRequestsData } = user
      ? await supabase
          .from("shift_requests")
          .select(
            "id, request_date, request_type, start_time, end_time, break_minutes, staff_note, status"
          )
          .eq("staff_id", user.id)
          .order("request_date", { ascending: false })
          .limit(30)
      : { data: [] };
  
    const myRequests = (myRequestsData ?? []) as ShiftRequest[];
    const requestIds = myRequests.map((request) => request.id);
  
    const { data: estimatesData } =
      requestIds.length > 0
        ? await supabase
            .from("shift_request_estimates")
            .select(
              "shift_request_id, employment_type_snapshot, is_pay_target, estimated_work_minutes, hourly_wage_snapshot, estimated_pay, calculation_note"
            )
            .in("shift_request_id", requestIds)
        : { data: [] };
  
    const estimateMap = new Map(
      ((estimatesData ?? []) as ShiftEstimate[]).map((estimate) => [
        estimate.shift_request_id,
        estimate,
      ])
    );
  
    const totalEstimatedPay = ((estimatesData ?? []) as ShiftEstimate[])
      .filter((estimate) => estimate.is_pay_target)
      .reduce((sum, estimate) => sum + estimate.estimated_pay, 0);
  
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">希望シフト提出</h2>
          <p className="mt-1 text-sm text-slate-600">
            勤務希望または休み希望を日ごとに提出します。勤務希望の場合は、提出時点の時給と給与ルールから概算収入を計算します。
          </p>
        </div>

        <SubmissionDeadlineCard />
  
        {params.message ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {params.message}
          </div>
        ) : null}
  
        <Card>
          <CardHeader>
            <CardTitle>希望シフトを提出</CardTitle>
          </CardHeader>
  
          <CardContent>
            <form
              action={createShiftRequestAction}
              className="grid gap-4 md:grid-cols-2"
            >
              <div className="space-y-2">
                <Label htmlFor="requestDate">希望日</Label>
                <Input id="requestDate" name="requestDate" type="date" required />
              </div>
  
              <div className="space-y-2">
                <Label htmlFor="requestType">希望区分</Label>
                <select
                  id="requestType"
                  name="requestType"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="work"
                  required
                >
                  <option value="work">勤務希望</option>
                  <option value="off">休み希望</option>
                </select>
              </div>
  
              <div className="space-y-2">
                <Label htmlFor="startTime">開始時刻</Label>
                <Input id="startTime" name="startTime" type="time" />
                <p className="text-xs text-slate-500">
                  休み希望の場合は空欄でOKです。
                </p>
              </div>
  
              <div className="space-y-2">
                <Label htmlFor="endTime">終了時刻</Label>
                <Input id="endTime" name="endTime" type="time" />
                <p className="text-xs text-slate-500">
                  休み希望の場合は空欄でOKです。
                </p>
              </div>
  
              <div className="space-y-2">
                <Label htmlFor="breakMinutes">休憩時間 分</Label>
                <Input
                  id="breakMinutes"
                  name="breakMinutes"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={0}
                />
              </div>
  
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="staffNote">メモ</Label>
                <Textarea
                  id="staffNote"
                  name="staffNote"
                  placeholder="例：17時以降なら入れます / テスト期間のため短時間希望 など"
                />
              </div>
  
              <div className="md:col-span-2">
                <Button type="submit" className="w-full">
                  希望シフトを提出する
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
  
        <Card>
          <CardHeader>
            <CardTitle>自分の提出済み希望シフト</CardTitle>
          </CardHeader>
  
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                表示中の概算収入合計
              </p>
              <p className="mt-1 text-2xl font-bold">
                {totalEstimatedPay.toLocaleString()}円
              </p>
              <p className="mt-1 text-xs text-slate-500">
                月給制スタッフの希望は合計対象外です。正式な給与計算ではなく、希望シフトベースの目安です。
              </p>
            </div>
  
            {myRequests.length === 0 ? (
              <p className="text-sm text-slate-600">
                まだ希望シフトを提出していません。
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>希望日</TableHead>
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
                    {myRequests.map((request) => {
                      const estimate = estimateMap.get(request.id);
  
                      return (
                        <TableRow key={request.id}>
                          <TableCell>{request.request_date}</TableCell>
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
                            {request.status === "submitted" ? (
                              <form action={deleteShiftRequestAction}>
                                <input
                                  type="hidden"
                                  name="shiftRequestId"
                                  value={request.id}
                                />
                                <input
                                  type="hidden"
                                  name="returnTo"
                                  value="/shifts/submit"
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
                              <span className="text-xs text-slate-500">不可</span>
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