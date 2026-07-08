import Link from "next/link";

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
  calculateStaffingShortages,
  dayLabels,
  getMonthRange,
  type ShiftForShortageRow,
  type StaffingRequirementRow,
} from "@/lib/staffing-shortage";

type ShortagesPageProps = {
  searchParams: Promise<{
    month?: string;
    storeId?: string;
  }>;
};

type StoreRow = {
  id: string;
  name: string;
};

export default async function ShortagesPage({
  searchParams,
}: ShortagesPageProps) {
  const params = await searchParams;
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

  const { data: requirementsData } = selectedStoreId
    ? await supabase
        .from("staffing_requirements")
        .select(
          "id, name, day_of_week, start_time, end_time, required_staff_count, note, is_active"
        )
        .eq("store_id", selectedStoreId)
        .eq("is_active", true)
        .order("day_of_week", { ascending: true, nullsFirst: true })
        .order("start_time", { ascending: true })
    : { data: [] };

  const { data: shiftsData } = selectedStoreId
    ? await supabase
        .from("shifts")
        .select("id, staff_id, shift_date, start_time, end_time")
        .eq("store_id", selectedStoreId)
        .gte("shift_date", startDate)
        .lt("shift_date", endDate)
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true })
    : { data: [] };

  const requirements = (requirementsData ?? []) as StaffingRequirementRow[];
  const shifts = (shiftsData ?? []) as ShiftForShortageRow[];

  const allRows = calculateStaffingShortages({
    year,
    monthNumber,
    requirements,
    shifts,
  });

  const shortageRows = allRows.filter((row) => row.shortageCount > 0);

  const totalShortageCount = shortageRows.reduce(
    (sum, row) => sum + row.shortageCount,
    0
  );

  const shortageDateCount = new Set(shortageRows.map((row) => row.date)).size;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">不足チェック</h2>
        <p className="mt-1 text-sm text-slate-600">
          必要人数ルールと確定シフトを比較し、不足している日・時間帯を表示します。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">対象月</CardTitle>
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
            <p className="mt-1 text-sm text-slate-500">
              確定シフトをもとに判定します。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">不足日数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{shortageDateCount}日</p>
            <p className="mt-1 text-sm text-slate-500">
              不足がある日数です。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">不足人数合計</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalShortageCount}人</p>
            <p className="mt-1 text-sm text-slate-500">
              時間帯ごとの不足合計です。
            </p>
          </CardContent>
        </Card>
      </div>

      {requirements.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>必要人数ルールが未設定です</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              不足チェックを行うには、先に必要人数ルールを登録してください。
            </p>

            <Button asChild>
              <Link href="/admin/staffing-requirements">
                必要人数ルールを設定する
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{month} の不足一覧</CardTitle>
          </CardHeader>

          <CardContent>
            {shortageRows.length === 0 ? (
              <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                この月は、登録済みの必要人数ルールに対する不足はありません。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>日付</TableHead>
                      <TableHead>曜日</TableHead>
                      <TableHead>ルール</TableHead>
                      <TableHead>時間帯</TableHead>
                      <TableHead className="text-right">必要人数</TableHead>
                      <TableHead className="text-right">予定人数</TableHead>
                      <TableHead className="text-right">不足</TableHead>
                      <TableHead>メモ</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {shortageRows.map((row) => (
                      <TableRow
                        key={`${row.date}-${row.requirementId}-${row.startTime}`}
                      >
                        <TableCell className="font-medium">
                          {row.date}
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline">
                            {dayLabels[row.dayOfWeek]}
                          </Badge>
                        </TableCell>

                        <TableCell>{row.requirementName}</TableCell>

                        <TableCell>
                          {row.startTime} - {row.endTime}
                        </TableCell>

                        <TableCell className="text-right">
                          {row.requiredStaffCount}人
                        </TableCell>

                        <TableCell className="text-right">
                          {row.assignedStaffCount}人
                        </TableCell>

                        <TableCell className="text-right font-bold text-red-600">
                          {row.shortageCount}人
                        </TableCell>

                        <TableCell>{row.note ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}