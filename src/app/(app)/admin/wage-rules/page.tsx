import {
    createStoreHolidayAction,
    createWageRuleAction,
    deleteStoreHolidayAction,
    deleteWageRuleAction,
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
  
  type WageRulesPageProps = {
    searchParams: Promise<{
      message?: string;
    }>;
  };
  
  type WageRuleRow = {
    id: string;
    name: string;
    rule_type: string;
    day_of_week: number | null;
    start_time: string | null;
    end_time: string | null;
    increase_type: string;
    increase_amount: number;
    increase_rate: number | string;
    priority: number;
    is_active: boolean;
  };
  
  type StoreHolidayRow = {
    id: string;
    holiday_date: string;
    name: string;
    is_active: boolean;
  };
  
  const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
  
  function formatTime(value: string | null) {
    if (!value) {
      return "-";
    }
  
    return value.slice(0, 5);
  }
  
  function formatRuleType(value: string) {
    if (value === "weekday") {
      return "曜日";
    }
  
    if (value === "holiday") {
      return "祝日・特別日";
    }
  
    if (value === "time_range") {
      return "時間帯";
    }
  
    if (value === "night") {
      return "深夜";
    }
  
    return value;
  }
  
  function formatIncrease(rule: WageRuleRow) {
    if (rule.increase_type === "amount") {
      return `+${rule.increase_amount.toLocaleString()}円`;
    }
  
    return `${Number(rule.increase_rate).toFixed(2)}倍`;
  }
  
  function formatCondition(rule: WageRuleRow) {
    if (rule.rule_type === "weekday") {
      return rule.day_of_week === null ? "-" : `${dayLabels[rule.day_of_week]}曜日`;
    }
  
    if (rule.rule_type === "holiday") {
      return "祝日・特別日";
    }
  
    if (rule.rule_type === "time_range" || rule.rule_type === "night") {
      return `${formatTime(rule.start_time)} - ${formatTime(rule.end_time)}`;
    }
  
    return "-";
  }
  
  export default async function WageRulesPage({
    searchParams,
  }: WageRulesPageProps) {
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
  
    const storeId = profile?.store_id;
  
    const { data: wageRulesData } = storeId
      ? await supabase
          .from("wage_rules")
          .select(
            "id, name, rule_type, day_of_week, start_time, end_time, increase_type, increase_amount, increase_rate, priority, is_active"
          )
          .eq("store_id", storeId)
          .order("priority", { ascending: true })
          .order("created_at", { ascending: true })
      : { data: [] };
  
    const { data: holidaysData } = storeId
      ? await supabase
          .from("store_holidays")
          .select("id, holiday_date, name, is_active")
          .eq("store_id", storeId)
          .order("holiday_date", { ascending: true })
      : { data: [] };
  
    const wageRules = (wageRulesData ?? []) as WageRuleRow[];
    const holidays = (holidaysData ?? []) as StoreHolidayRow[];
  
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">給与ルール設定</h2>
          <p className="mt-1 text-sm text-slate-600">
            土日祝アップ、時間帯アップ、深夜アップなどの概算給与ルールを設定します。
          </p>
        </div>
  
        {params.message ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {params.message}
          </div>
        ) : null}
  
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          この設定は「給料計算」画面の概算給与に反映されます。正式な給与計算では、勤怠実績・残業・深夜・法定休日などの確認が必要です。
        </div>
  
        <Card>
          <CardHeader>
            <CardTitle>給与ルールを追加</CardTitle>
          </CardHeader>
  
          <CardContent>
            <form action={createWageRuleAction} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="name" className="text-sm font-medium">
                  ルール名
                </label>
                <Input
                  id="name"
                  name="name"
                  placeholder="例：日曜時給アップ / 深夜25%アップ"
                  required
                />
              </div>
  
              <div className="space-y-2">
                <label htmlFor="ruleType" className="text-sm font-medium">
                  ルール種別
                </label>
                <select
                  id="ruleType"
                  name="ruleType"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="weekday"
                  required
                >
                  <option value="weekday">曜日アップ</option>
                  <option value="holiday">祝日・特別日アップ</option>
                  <option value="time_range">時間帯アップ</option>
                  <option value="night">深夜アップ</option>
                </select>
              </div>
  
              <div className="space-y-2">
                <label htmlFor="dayOfWeek" className="text-sm font-medium">
                  曜日
                </label>
                <select
                  id="dayOfWeek"
                  name="dayOfWeek"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="0"
                >
                  <option value="0">日曜日</option>
                  <option value="1">月曜日</option>
                  <option value="2">火曜日</option>
                  <option value="3">水曜日</option>
                  <option value="4">木曜日</option>
                  <option value="5">金曜日</option>
                  <option value="6">土曜日</option>
                </select>
                <p className="text-xs text-slate-500">
                  曜日アップの場合だけ使います。
                </p>
              </div>
  
              <div className="space-y-2">
                <label htmlFor="startTime" className="text-sm font-medium">
                  開始時刻
                </label>
                <Input id="startTime" name="startTime" type="time" />
                <p className="text-xs text-slate-500">
                  時間帯・深夜ルールの場合だけ使います。
                </p>
              </div>
  
              <div className="space-y-2">
                <label htmlFor="endTime" className="text-sm font-medium">
                  終了時刻
                </label>
                <Input id="endTime" name="endTime" type="time" />
                <p className="text-xs text-slate-500">
                  例：深夜なら 22:00 - 05:00
                </p>
              </div>
  
              <div className="space-y-2">
                <label htmlFor="increaseType" className="text-sm font-medium">
                  加算方法
                </label>
                <select
                  id="increaseType"
                  name="increaseType"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="amount"
                  required
                >
                  <option value="amount">金額加算</option>
                  <option value="rate">倍率</option>
                </select>
              </div>
  
              <div className="space-y-2">
                <label htmlFor="increaseAmount" className="text-sm font-medium">
                  加算額
                </label>
                <Input
                  id="increaseAmount"
                  name="increaseAmount"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={100}
                />
                <p className="text-xs text-slate-500">
                  例：+100円なら 100
                </p>
              </div>
  
              <div className="space-y-2">
                <label htmlFor="increaseRate" className="text-sm font-medium">
                  倍率
                </label>
                <Input
                  id="increaseRate"
                  name="increaseRate"
                  type="number"
                  min={1}
                  step={0.01}
                  defaultValue={1.25}
                />
                <p className="text-xs text-slate-500">
                  例：25%アップなら 1.25
                </p>
              </div>
  
              <div className="space-y-2">
                <label htmlFor="priority" className="text-sm font-medium">
                  優先度
                </label>
                <Input
                  id="priority"
                  name="priority"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={100}
                />
                <p className="text-xs text-slate-500">
                  小さい数字ほど先に計算します。
                </p>
              </div>
  
              <div className="md:col-span-2">
                <Button type="submit">給与ルールを追加する</Button>
              </div>
            </form>
          </CardContent>
        </Card>
  
        <Card>
          <CardHeader>
            <CardTitle>登録済み給与ルール</CardTitle>
          </CardHeader>
  
          <CardContent>
            {wageRules.length === 0 ? (
              <p className="text-sm text-slate-600">
                給与ルールはまだ登録されていません。未登録の場合は基本時給のみで計算されます。
              </p>
            ) : (
              <div className="space-y-3">
                {wageRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{rule.name}</p>
                        <Badge variant="secondary">
                          {formatRuleType(rule.rule_type)}
                        </Badge>
                        <Badge variant="outline">
                          {rule.is_active ? "有効" : "無効"}
                        </Badge>
                      </div>
  
                      <p className="mt-1 text-sm text-slate-600">
                        条件：{formatCondition(rule)} / 加算：{formatIncrease(rule)} / 優先度：
                        {rule.priority}
                      </p>
                    </div>
  
                    <form action={deleteWageRuleAction}>
                      <input type="hidden" name="wageRuleId" value={rule.id} />
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
  
        <Card>
          <CardHeader>
            <CardTitle>祝日・特別日を登録</CardTitle>
          </CardHeader>
  
          <CardContent>
            <form
              action={createStoreHolidayAction}
              className="grid gap-4 md:grid-cols-3"
            >
              <div className="space-y-2">
                <label htmlFor="holidayDate" className="text-sm font-medium">
                  日付
                </label>
                <Input id="holidayDate" name="holidayDate" type="date" required />
              </div>
  
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="holidayName" className="text-sm font-medium">
                  名称
                </label>
                <Input
                  id="holidayName"
                  name="name"
                  placeholder="例：祝日 / 年末特別日 / イベント日"
                  required
                />
              </div>
  
              <div className="md:col-span-3">
                <Button type="submit">祝日・特別日を追加する</Button>
              </div>
            </form>
          </CardContent>
        </Card>
  
        <Card>
          <CardHeader>
            <CardTitle>登録済み祝日・特別日</CardTitle>
          </CardHeader>
  
          <CardContent>
            {holidays.length === 0 ? (
              <p className="text-sm text-slate-600">
                祝日・特別日はまだ登録されていません。
              </p>
            ) : (
              <div className="space-y-3">
                {holidays.map((holiday) => (
                  <div
                    key={holiday.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{holiday.holiday_date}</p>
                      <p className="text-sm text-slate-600">{holiday.name}</p>
                    </div>
  
                    <form action={deleteStoreHolidayAction}>
                      <input type="hidden" name="holidayId" value={holiday.id} />
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