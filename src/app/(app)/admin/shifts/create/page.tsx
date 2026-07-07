import {
    createManualShiftAction,
    createShiftFromRequestAction,
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
  
  type ShiftCreatePageProps = {
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
    profiles: RawProfileJoin;
  };
  
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
  
  function formatRequestType(type: "work" | "off") {
    return type === "work" ? "勤務希望" : "休み希望";
  }
  
  export default async function ShiftCreatePage({
    searchParams,
  }: ShiftCreatePageProps) {
    const params = await searchParams;
    const { month, startDate, endDate } = getMonthRange(params.month);
  
    const supabase = await createClient();
  
    const {
      data: { user },
    } = await supabase.auth.getUser();
  
    const { data: managerProfile } = user
      ? await supabase
          .from("profiles")
          .select("id, store_id, role")
          .eq("id", user.id)
          .single()
      : { data: null };
  
    const storeId = managerProfile?.store_id;
  
    const { data: staffData } = storeId
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("store_id", storeId)
          .eq("is_active", true)
          .order("full_name", { ascending: true })
      : { data: [] };
  
    const staffs = (staffData ?? []) as ProfileRow[];
  
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
          id,
          full_name,
          email
        )
      `
      )
      .gte("request_date", startDate)
      .lt("request_date", endDate)
      .order("request_date", { ascending: true })
      .order("start_time", { ascending: true });
  
    const shiftRequests = ((requestsData ?? []) as unknown as ShiftRequestRow[]).map(
      (request) => ({
        ...request,
        profiles: normalizeProfile(request.profiles),
      })
    );
  
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
  
    const confirmedShifts = ((shiftsData ?? []) as unknown as ShiftRow[]).map(
      (shift) => ({
        ...shift,
        profiles: normalizeProfile(shift.profiles),
      })
    );
  
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">シフト制作</h2>
          <p className="mt-1 text-sm text-slate-600">
            希望シフトを確認しながら、確定シフトを作成します。
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
                <Label htmlFor="month">対象月</Label>
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
            <CardTitle>手動で確定シフトを作成</CardTitle>
          </CardHeader>
  
          <CardContent>
            <form
              action={createManualShiftAction}
              className="grid gap-4 md:grid-cols-2"
            >
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="staffId">スタッフ</Label>
                <select
                  id="staffId"
                  name="staffId"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">選択してください</option>
                  {staffs.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name ?? staff.email ?? "名前未設定"}
                    </option>
                  ))}
                </select>
              </div>
  
              <div className="space-y-2">
                <Label htmlFor="shiftDate">日付</Label>
                <Input id="shiftDate" name="shiftDate" type="date" required />
              </div>
  
              <div className="space-y-2">
                <Label htmlFor="breakMinutes">休憩 分</Label>
                <Input
                  id="breakMinutes"
                  name="breakMinutes"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={0}
                />
              </div>
  
              <div className="space-y-2">
                <Label htmlFor="startTime">開始時刻</Label>
                <Input id="startTime" name="startTime" type="time" required />
              </div>
  
              <div className="space-y-2">
                <Label htmlFor="endTime">終了時刻</Label>
                <Input id="endTime" name="endTime" type="time" required />
              </div>
  
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="note">メモ</Label>
                <Textarea
                  id="note"
                  name="note"
                  placeholder="例：混雑予想のため早めに出勤 など"
                />
              </div>
  
              <div className="md:col-span-2">
                <Button type="submit" className="w-full">
                  確定シフトを作成する
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
  
        <Card>
          <CardHeader>
            <CardTitle>{month} の希望シフト</CardTitle>
          </CardHeader>
  
          <CardContent>
            {shiftRequests.length === 0 ? (
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
                      <TableHead>メモ</TableHead>
                      <TableHead>状態</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
  
                  <TableBody>
                    {shiftRequests.map((request) => {
                      const profile = normalizeProfile(request.profiles);
  
                      return (
                        <TableRow key={request.id}>
                          <TableCell>{request.request_date}</TableCell>
  
                          <TableCell>
                            <div className="font-medium">
                              {profile?.full_name ?? "不明"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {profile?.email ?? "-"}
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
  
                          <TableCell>{request.staff_note ?? "-"}</TableCell>
  
                          <TableCell>
                            <Badge variant="secondary">{request.status}</Badge>
                          </TableCell>
  
                          <TableCell className="text-right">
                            {request.request_type === "work" &&
                            request.status === "submitted" ? (
                              <form action={createShiftFromRequestAction}>
                                <input
                                  type="hidden"
                                  name="shiftRequestId"
                                  value={request.id}
                                />
                                <Button type="submit" size="sm">
                                  確定にする
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
  
        <Card>
          <CardHeader>
            <CardTitle>{month} の確定シフト</CardTitle>
          </CardHeader>
  
          <CardContent>
            {confirmedShifts.length === 0 ? (
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
                      <TableHead>メモ</TableHead>
                    </TableRow>
                  </TableHeader>
  
                  <TableBody>
                    {confirmedShifts.map((shift) => {
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
                          <TableCell>{shift.note ?? "-"}</TableCell>
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