import Link from "next/link";
import { notFound } from "next/navigation";

import { updateShiftAction } from "../../actions";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";

type ShiftEditPageProps = {
  params: Promise<{
    shiftId: string;
  }>;
};

type StaffRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type ShiftRow = {
  id: string;
  store_id: string;
  staff_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  note: string | null;
};

function formatTime(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 5);
}

export default async function ShiftEditPage({ params }: ShiftEditPageProps) {
  const { shiftId } = await params;

  const supabase = await createClient();

  const { data: shiftData } = await supabase
    .from("shifts")
    .select(
      "id, store_id, staff_id, shift_date, start_time, end_time, break_minutes, note"
    )
    .eq("id", shiftId)
    .single();

  if (!shiftData) {
    notFound();
  }

  const shift = shiftData as ShiftRow;

  const { data: staffData } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("store_id", shift.store_id)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const staffs = (staffData ?? []) as StaffRow[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">シフト編集</h2>
        <p className="mt-1 text-sm text-slate-600">
          確定シフトの日付・スタッフ・時間・休憩・メモを編集します。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>編集内容</CardTitle>
        </CardHeader>

        <CardContent>
          <form action={updateShiftAction} className="grid gap-4">
            <input type="hidden" name="shiftId" value={shift.id} />

            <div className="space-y-2">
              <Label htmlFor="staffId">スタッフ</Label>
              <select
                id="staffId"
                name="staffId"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={shift.staff_id}
                required
              >
                {staffs.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.full_name ?? staff.email ?? "名前未設定"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shiftDate">日付</Label>
              <Input
                id="shiftDate"
                name="shiftDate"
                type="date"
                defaultValue={shift.shift_date}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startTime">開始時刻</Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="time"
                  defaultValue={formatTime(shift.start_time)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">終了時刻</Label>
                <Input
                  id="endTime"
                  name="endTime"
                  type="time"
                  defaultValue={formatTime(shift.end_time)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="breakMinutes">休憩時間 分</Label>
              <Input
                id="breakMinutes"
                name="breakMinutes"
                type="number"
                min={0}
                step={1}
                defaultValue={shift.break_minutes}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">メモ</Label>
              <Textarea
                id="note"
                name="note"
                defaultValue={shift.note ?? ""}
                placeholder="例：混雑予想のため早めに出勤 など"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" className="w-full sm:w-auto">
                編集内容を保存する
              </Button>

              <Button type="button" variant="outline" asChild>
                <Link href="/admin/shifts">戻る</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}