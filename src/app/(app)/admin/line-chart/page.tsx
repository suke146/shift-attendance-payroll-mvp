import { Fragment } from "react";

import {
  createLineSheetEventAction,
  deleteLineSheetEventAction,
} from "./actions";

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
import {
  calculateStaffingShortages,
  type ShiftForShortageRow,
  type StaffingRequirementRow,
} from "@/lib/staffing-shortage";
import {
  buildLineChartDays,
  buildLineChartRows,
  dayLabels,
  getMonthRange,
  type LineChartMode,
  type LineChartRequestRow,
  type LineChartShiftRow,
  type LineChartStaffRow,
} from "@/lib/line-chart";

type LineChartPageProps = {
  searchParams: Promise<{
    month?: string;
    mode?: string;
    storeId?: string;
    message?: string;
  }>;
};

type StoreRow = {
  id: string;
  name: string;
};

type LineSheetEventRow = {
  id: string;
  event_date: string;
  title: string;
  color_type: string;
  note: string | null;
};

function getMode(value?: string | null): LineChartMode {
  if (value === "confirmed") {
    return "confirmed";
  }

  return "requests";
}

function getModeLabel(mode: LineChartMode) {
  return mode === "confirmed" ? "確定シフト" : "希望シフト";
}

function groupEventsByDate(events: LineSheetEventRow[]) {
  const map = new Map<string, LineSheetEventRow[]>();

  for (const event of events) {
    const list = map.get(event.event_date) ?? [];
    list.push(event);
    map.set(event.event_date, list);
  }

  return map;
}

function getEventClass(colorType: string) {
  if (colorType === "green") {
    return "bg-green-100 text-green-800 border-green-200";
  }

  if (colorType === "yellow") {
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  }

  if (colorType === "red") {
    return "bg-red-100 text-red-800 border-red-200";
  }

  if (colorType === "purple") {
    return "bg-purple-100 text-purple-800 border-purple-200";
  }

  if (colorType === "gray") {
    return "bg-slate-100 text-slate-800 border-slate-200";
  }

  return "bg-blue-100 text-blue-800 border-blue-200";
}

function getCellClass(type: "work" | "off" | "none") {
  if (type === "work") {
    return "bg-blue-50 text-blue-900";
  }

  if (type === "off") {
    return "bg-slate-100 text-slate-500";
  }

  return "bg-white text-slate-300";
}

export default async function AdminLineChartPage({
  searchParams,
}: LineChartPageProps) {
  const params = await searchParams;
  const mode = getMode(params.mode);

  const { month, year, monthNumber, startDate, endDate } = getMonthRange(
    params.month
  );

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("id, store_id, role")
        .eq("id", user.id)
        .single()
    : { data: null };

  const isAdmin = profile?.role === "admin";

  const { data: storesData } = isAdmin
    ? await supabase
        .from("stores")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: true })
    : profile?.store_id
      ? await supabase
          .from("stores")
          .select("id, name")
          .eq("id", profile.store_id)
      : { data: [] };

  const stores = (storesData ?? []) as StoreRow[];

  const selectedStoreId =
    isAdmin && params.storeId
      ? params.storeId
      : profile?.store_id ?? stores[0]?.id ?? "";

  const selectedStore = stores.find((store) => store.id === selectedStoreId);

  const days = buildLineChartDays(year, monthNumber);

  const { data: staffData } = selectedStoreId
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("store_id", selectedStoreId)
        .eq("is_active", true)
        .order("full_name", { ascending: true })
    : { data: [] };

  const staffs = (staffData ?? []) as LineChartStaffRow[];

  const { data: requestsData } =
    mode === "requests" && selectedStoreId
      ? await supabase
          .from("shift_requests")
          .select(
            "id, staff_id, request_date, request_type, start_time, end_time, status"
          )
          .eq("store_id", selectedStoreId)
          .gte("request_date", startDate)
          .lt("request_date", endDate)
          .order("request_date", { ascending: true })
      : { data: [] };

  const { data: shiftsData } = selectedStoreId
    ? await supabase
        .from("shifts")
        .select("id, staff_id, shift_date, start_time, end_time")
        .eq("store_id", selectedStoreId)
        .gte("shift_date", startDate)
        .lt("shift_date", endDate)
        .order("shift_date", { ascending: true })
    : { data: [] };

  const requests = (requestsData ?? []) as LineChartRequestRow[];
  const shifts = (shiftsData ?? []) as LineChartShiftRow[];

  const { data: eventsData } = selectedStoreId
    ? await supabase
        .from("line_sheet_events")
        .select("id, event_date, title, color_type, note")
        .eq("store_id", selectedStoreId)
        .gte("event_date", startDate)
        .lt("event_date", endDate)
        .order("event_date", { ascending: true })
    : { data: [] };

  const events = (eventsData ?? []) as LineSheetEventRow[];
  const eventsByDate = groupEventsByDate(events);

  const rows = buildLineChartRows({
    mode,
    staffs,
    days,
    requests,
    shifts,
  });

  const { data: requirementsData } = selectedStoreId
    ? await supabase
        .from("staffing_requirements")
        .select(
          "id, name, day_of_week, start_time, end_time, required_staff_count, note, is_active"
        )
        .eq("store_id", selectedStoreId)
        .eq("is_active", true)
    : { data: [] };

  const requirements = (requirementsData ?? []) as StaffingRequirementRow[];

  const shortageSourceShifts: ShiftForShortageRow[] =
    mode === "confirmed"
      ? shifts.map((shift) => ({
          id: shift.id,
          staff_id: shift.staff_id,
          shift_date: shift.shift_date,
          start_time: shift.start_time,
          end_time: shift.end_time,
        }))
      : requests
          .filter(
            (request) =>
              request.request_type === "work" &&
              Boolean(request.start_time) &&
              Boolean(request.end_time)
          )
          .map((request) => ({
            id: request.id,
            staff_id: request.staff_id,
            shift_date: request.request_date,
            start_time: request.start_time ?? "",
            end_time: request.end_time ?? "",
          }));

  const shortageRows = calculateStaffingShortages({
    year,
    monthNumber,
    requirements,
    shifts: shortageSourceShifts,
  }).filter((row) => row.shortageCount > 0);

  const totalShortageCount = shortageRows.reduce(
    (sum, row) => sum + row.shortageCount,
    0
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">ライン表作成</h2>
        <p className="mt-1 text-sm text-slate-600">
          希望シフトまたは確定シフトから、店舗用ライン表を自動作成します。
        </p>
      </div>

      {params.message ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {params.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">表示条件</CardTitle>
          </CardHeader>

          <CardContent>
            <form className="space-y-3">
              {isAdmin ? (
                <select
                  name="storeId"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={selectedStoreId}
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              ) : null}

              <Input name="month" type="month" defaultValue={month} />

              <select
                name="mode"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={mode}
              >
                <option value="requests">希望シフトから作成</option>
                <option value="confirmed">確定シフトから作成</option>
              </select>

              <Button type="submit" variant="outline" className="w-full">
                表示する
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">対象店舗</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-xl font-bold">
              {selectedStore?.name ?? "店舗未選択"}
            </p>
            <p className="mt-1 text-sm text-slate-500">{month}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">作成元</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-xl font-bold">{getModeLabel(mode)}</p>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "requests"
                ? "希望シフトを仮ライン表として表示します。"
                : "確定シフトを正式ライン表として表示します。"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">不足人数</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              {totalShortageCount}人
            </p>
            <p className="mt-1 text-sm text-slate-500">
              必要人数ルールとの差分です。
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>イベント・催事を追加</CardTitle>
        </CardHeader>

        <CardContent>
          <form
            action={createLineSheetEventAction}
            className="grid gap-4 md:grid-cols-5"
          >
            <input type="hidden" name="storeId" value={selectedStoreId} />

            <div className="space-y-2">
              <label htmlFor="eventDate" className="text-sm font-medium">
                日付
              </label>
              <Input id="eventDate" name="eventDate" type="date" required />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="title" className="text-sm font-medium">
                イベント名
              </label>
              <Input
                id="title"
                name="title"
                placeholder="例：催事 / 応援 / アンテナ / セール"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="colorType" className="text-sm font-medium">
                色
              </label>
              <select
                id="colorType"
                name="colorType"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="blue"
              >
                <option value="blue">青</option>
                <option value="green">緑</option>
                <option value="yellow">黄</option>
                <option value="red">赤</option>
                <option value="purple">紫</option>
                <option value="gray">灰</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="note" className="text-sm font-medium">
                メモ
              </label>
              <Input id="note" name="note" placeholder="任意" />
            </div>

            <div className="md:col-span-5">
              <Button type="submit">イベントを追加する</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {month} ライン表（{getModeLabel(mode)}）
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-max border-collapse text-xs">
              <thead>
                <tr>
                  <th
                    rowSpan={3}
                    className="sticky left-0 z-20 min-w-40 border bg-slate-100 p-2 text-left"
                  >
                    氏名
                  </th>

                  {days.map((day) => (
                    <th
                      key={day.date}
                      colSpan={2}
                      className={[
                        "border p-2 text-center font-semibold",
                        day.dayOfWeek === 0 ? "bg-red-50 text-red-700" : "",
                        day.dayOfWeek === 6 ? "bg-blue-50 text-blue-700" : "",
                        day.dayOfWeek !== 0 && day.dayOfWeek !== 6
                          ? "bg-slate-50"
                          : "",
                      ].join(" ")}
                    >
                      {day.day}日（{dayLabels[day.dayOfWeek]}）
                    </th>
                  ))}

                  <th
                    rowSpan={3}
                    className="sticky right-0 z-20 min-w-40 border bg-slate-100 p-2 text-left"
                  >
                    氏名
                  </th>
                </tr>

                <tr>
                  {days.map((day) => {
                    const dayEvents = eventsByDate.get(day.date) ?? [];

                    return (
                      <th
                        key={`event-${day.date}`}
                        colSpan={2}
                        className="h-12 border bg-white p-1 text-center"
                      >
                        {dayEvents.length === 0 ? (
                          <span className="text-slate-300">-</span>
                        ) : (
                          <div className="space-y-1">
                            {dayEvents.map((event) => (
                              <div
                                key={event.id}
                                className={[
                                  "rounded border px-1 py-0.5 text-[11px]",
                                  getEventClass(event.color_type),
                                ].join(" ")}
                              >
                                {event.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>

                <tr>
                  {days.map((day) => (
                    <Fragment key={day.date}>
                      <th className="min-w-16 border bg-slate-50 p-1 text-center">
                        開始
                      </th>
                      <th className="min-w-16 border bg-slate-50 p-1 text-center">
                        終了
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={row.staffId}>
                    <th className="sticky left-0 z-10 border bg-white p-2 text-left font-medium">
                      <div>{row.staffName}</div>
                      <div className="text-[10px] text-slate-400">
                        {row.email}
                      </div>
                    </th>

                    {days.map((day) => {
                      const cell = row.cells[day.date];

                      return (
                        <Fragment key={`${row.staffId}-${day.date}`}>
                          <td
                            className={[
                              "border p-1 text-center",
                              getCellClass(cell.type),
                            ].join(" ")}
                          >
                            {cell.startText || "-"}
                          </td>

                          <td
                            className={[
                              "border p-1 text-center",
                              getCellClass(cell.type),
                            ].join(" ")}
                          >
                            {cell.endText || "-"}
                          </td>
                        </Fragment>
                      );
                    })}

                    <th className="sticky right-0 z-10 border bg-white p-2 text-left font-medium">
                      {row.staffName}
                    </th>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            青：勤務あり / 灰色：休み希望 / 空欄：未提出またはシフトなし
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>不足一覧</CardTitle>
        </CardHeader>

        <CardContent>
          {requirements.length === 0 ? (
            <p className="text-sm text-slate-600">
              必要人数ルールが未設定です。先に必要人数設定を登録してください。
            </p>
          ) : shortageRows.length === 0 ? (
            <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              この表示条件では不足はありません。
            </div>
          ) : (
            <div className="space-y-2">
              {shortageRows.slice(0, 20).map((row) => (
                <div
                  key={`${row.date}-${row.requirementId}-${row.startTime}`}
                  className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <span className="font-semibold">{row.date}</span>{" "}
                    <Badge variant="outline">{dayLabels[row.dayOfWeek]}</Badge>{" "}
                    {row.requirementName} / {row.startTime} - {row.endTime}
                  </div>

                  <div className="font-bold text-red-700">
                    必要 {row.requiredStaffCount}人 / 予定{" "}
                    {row.assignedStaffCount}人 / 不足 {row.shortageCount}人
                  </div>
                </div>
              ))}

              {shortageRows.length > 20 ? (
                <p className="text-xs text-slate-500">
                  他 {shortageRows.length - 20} 件の不足があります。不足チェック画面で確認してください。
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>登録済みイベント</CardTitle>
        </CardHeader>

        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-slate-600">
              この月のイベントはまだ登録されていません。
            </p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{event.event_date}</p>
                      <Badge className={getEventClass(event.color_type)}>
                        {event.title}
                      </Badge>
                    </div>

                    {event.note ? (
                      <p className="mt-1 text-sm text-slate-500">
                        {event.note}
                      </p>
                    ) : null}
                  </div>

                  <form action={deleteLineSheetEventAction}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <Button type="submit" variant="destructive" size="sm">
                      削除
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}