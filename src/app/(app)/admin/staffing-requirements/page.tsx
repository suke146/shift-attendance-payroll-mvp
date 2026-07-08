import Link from "next/link";

import {
  createStaffingRequirementAction,
  deleteStaffingRequirementAction,
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
import { dayLabels } from "@/lib/staffing-shortage";

type StaffingRequirementsPageProps = {
  searchParams: Promise<{
    storeId?: string;
    message?: string;
  }>;
};

type StoreRow = {
  id: string;
  name: string;
};

type StaffingRequirementRow = {
  id: string;
  store_id: string;
  name: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  required_staff_count: number;
  note: string | null;
  is_active: boolean;
};

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatDayOfWeek(value: number | null) {
  if (value === null) {
    return "毎日";
  }

  return `${dayLabels[value]}曜日`;
}

export default async function StaffingRequirementsPage({
  searchParams,
}: StaffingRequirementsPageProps) {
  const params = await searchParams;
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
          "id, store_id, name, day_of_week, start_time, end_time, required_staff_count, note, is_active"
        )
        .eq("store_id", selectedStoreId)
        .order("day_of_week", { ascending: true, nullsFirst: true })
        .order("start_time", { ascending: true })
    : { data: [] };

  const requirements = (requirementsData ?? []) as StaffingRequirementRow[];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">必要人数ルール</h2>
        <p className="mt-1 text-sm text-slate-600">
          曜日・時間帯ごとに必要な人数を設定します。不足チェックで確定シフトと比較します。
        </p>
      </div>

      {params.message ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {params.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">対象店舗</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {selectedStore?.name ?? "店舗未選択"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              manager は自店舗のみ設定できます。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">登録ルール数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{requirements.length}</p>
            <p className="mt-1 text-sm text-slate-500">
              有効な必要人数ルールです。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">不足チェック</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/admin/shortages">不足チェックを見る</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>店舗切り替え</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3 sm:flex-row">
              <select
                name="storeId"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={selectedStoreId}
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>

              <Button type="submit" variant="outline">
                表示する
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>必要人数ルールを追加</CardTitle>
        </CardHeader>

        <CardContent>
          <form
            action={createStaffingRequirementAction}
            className="grid gap-4 md:grid-cols-2"
          >
            <input type="hidden" name="storeId" value={selectedStoreId} />

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="name" className="text-sm font-medium">
                ルール名
              </label>
              <Input
                id="name"
                name="name"
                placeholder="例：平日昼 / 土日夜 / 毎日オープン"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="dayOfWeek" className="text-sm font-medium">
                曜日
              </label>
              <select
                id="dayOfWeek"
                name="dayOfWeek"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="all"
              >
                <option value="all">毎日</option>
                <option value="0">日曜日</option>
                <option value="1">月曜日</option>
                <option value="2">火曜日</option>
                <option value="3">水曜日</option>
                <option value="4">木曜日</option>
                <option value="5">金曜日</option>
                <option value="6">土曜日</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="requiredStaffCount" className="text-sm font-medium">
                必要人数
              </label>
              <Input
                id="requiredStaffCount"
                name="requiredStaffCount"
                type="number"
                min={1}
                step={1}
                defaultValue={2}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="startTime" className="text-sm font-medium">
                開始時刻
              </label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                defaultValue="09:00"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="endTime" className="text-sm font-medium">
                終了時刻
              </label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                defaultValue="17:00"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="note" className="text-sm font-medium">
                メモ
              </label>
              <Input
                id="note"
                name="note"
                placeholder="例：イベント日は別途増員 / 社員1名必須 など"
              />
            </div>

            <div className="md:col-span-2">
              <Button type="submit">必要人数ルールを追加する</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>登録済みルール</CardTitle>
        </CardHeader>

        <CardContent>
          {requirements.length === 0 ? (
            <p className="text-sm text-slate-600">
              必要人数ルールはまだ登録されていません。
            </p>
          ) : (
            <div className="space-y-3">
              {requirements.map((requirement) => (
                <div
                  key={requirement.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{requirement.name}</p>
                      <Badge variant="secondary">
                        {formatDayOfWeek(requirement.day_of_week)}
                      </Badge>
                      <Badge variant="outline">
                        {requirement.required_staff_count}人必要
                      </Badge>
                    </div>

                    <p className="mt-1 text-sm text-slate-600">
                      {formatTime(requirement.start_time)} -{" "}
                      {formatTime(requirement.end_time)}
                    </p>

                    {requirement.note ? (
                      <p className="mt-1 text-sm text-slate-500">
                        {requirement.note}
                      </p>
                    ) : null}
                  </div>

                  <form action={deleteStaffingRequirementAction}>
                    <input
                      type="hidden"
                      name="requirementId"
                      value={requirement.id}
                    />
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