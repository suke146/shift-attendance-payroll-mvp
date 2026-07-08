import {
    deleteShiftDeadlineAction,
    upsertShiftDeadlineAction,
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
  import { getCurrentTargetMonth } from "@/lib/shift-submission-deadlines";
  
  type ShiftDeadlinesPageProps = {
    searchParams: Promise<{
      storeId?: string;
      message?: string;
    }>;
  };
  
  type StoreRow = {
    id: string;
    name: string;
  };
  
  type DeadlineRow = {
    id: string;
    store_id: string;
    target_month: string;
    deadline_date: string;
    deadline_time: string;
    note: string | null;
    is_active: boolean;
    created_at: string;
  };
  
  function formatTime(value: string) {
    return value.slice(0, 5);
  }
  
  export default async function ShiftDeadlinesPage({
    searchParams,
  }: ShiftDeadlinesPageProps) {
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
  
    const { data: deadlinesData } = selectedStoreId
      ? await supabase
          .from("shift_submission_deadlines")
          .select(
            "id, store_id, target_month, deadline_date, deadline_time, note, is_active, created_at"
          )
          .eq("store_id", selectedStoreId)
          .order("target_month", { ascending: false })
      : { data: [] };
  
    const deadlines = (deadlinesData ?? []) as DeadlineRow[];
  
    const currentMonth = getCurrentTargetMonth();
  
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">シフト提出期限</h2>
          <p className="mt-1 text-sm text-slate-600">
            月ごとに希望シフトの提出期限を設定します。
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
              <CardTitle className="text-base">登録済み期限</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{deadlines.length}</p>
              <p className="mt-1 text-sm text-slate-500">月ごとの設定数</p>
            </CardContent>
          </Card>
  
          <Card>
            <CardHeader>
              <CardTitle className="text-base">現在月</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{currentMonth}</p>
              <p className="mt-1 text-sm text-slate-500">
                初期値として利用します。
              </p>
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
            <CardTitle>提出期限を登録・更新</CardTitle>
          </CardHeader>
  
          <CardContent>
            <form
              action={upsertShiftDeadlineAction}
              className="grid gap-4 md:grid-cols-2"
            >
              <input type="hidden" name="storeId" value={selectedStoreId} />
  
              <div className="space-y-2">
                <label htmlFor="targetMonth" className="text-sm font-medium">
                  対象月
                </label>
                <Input
                  id="targetMonth"
                  name="targetMonth"
                  type="month"
                  defaultValue={currentMonth}
                  required
                />
              </div>
  
              <div className="space-y-2">
                <label htmlFor="deadlineDate" className="text-sm font-medium">
                  提出期限日
                </label>
                <Input
                  id="deadlineDate"
                  name="deadlineDate"
                  type="date"
                  required
                />
              </div>
  
              <div className="space-y-2">
                <label htmlFor="deadlineTime" className="text-sm font-medium">
                  提出期限時刻
                </label>
                <Input
                  id="deadlineTime"
                  name="deadlineTime"
                  type="time"
                  defaultValue="23:59"
                  required
                />
              </div>
  
              <div className="space-y-2">
                <label htmlFor="note" className="text-sm font-medium">
                  メモ
                </label>
                <Input
                  id="note"
                  name="note"
                  placeholder="例：翌月分は毎月20日まで"
                />
              </div>
  
              <div className="md:col-span-2">
                <Button type="submit">提出期限を保存する</Button>
              </div>
            </form>
          </CardContent>
        </Card>
  
        <Card>
          <CardHeader>
            <CardTitle>登録済み提出期限</CardTitle>
          </CardHeader>
  
          <CardContent>
            {deadlines.length === 0 ? (
              <p className="text-sm text-slate-600">
                提出期限はまだ登録されていません。
              </p>
            ) : (
              <div className="space-y-3">
                {deadlines.map((deadline) => (
                  <div
                    key={deadline.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">
                          {deadline.target_month}
                        </p>
                        <Badge
                          variant={deadline.is_active ? "secondary" : "outline"}
                        >
                          {deadline.is_active ? "有効" : "無効"}
                        </Badge>
                      </div>
  
                      <p className="mt-1 text-sm text-slate-600">
                        締切：{deadline.deadline_date}{" "}
                        {formatTime(deadline.deadline_time)}
                      </p>
  
                      {deadline.note ? (
                        <p className="mt-1 text-sm text-slate-500">
                          {deadline.note}
                        </p>
                      ) : null}
                    </div>
  
                    <form action={deleteShiftDeadlineAction}>
                      <input
                        type="hidden"
                        name="deadlineId"
                        value={deadline.id}
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