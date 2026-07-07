import { updateStaffAction } from "./actions";

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

type StaffPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

type StaffRow = {
  id: string;
  store_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string;
  employment_type: string;
  hourly_wage: number;
  monthly_salary: number;
  is_active: boolean;
};

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

export default async function StaffManagementPage({
  searchParams,
}: StaffPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: currentProfile } = user
    ? await supabase
        .from("profiles")
        .select("id, store_id, role")
        .eq("id", user.id)
        .single()
    : { data: null };

  let staffQuery = supabase
    .from("profiles")
    .select(
      "id, store_id, full_name, email, role, employment_type, hourly_wage, monthly_salary, is_active"
    )
    .order("full_name", { ascending: true });

  if (currentProfile?.role !== "admin") {
    staffQuery = staffQuery.eq("store_id", currentProfile?.store_id ?? "");
  }

  const { data: staffData } = await staffQuery;

  const staffs = (staffData ?? []) as StaffRow[];

  const activeCount = staffs.filter((staff) => staff.is_active).length;
  const inactiveCount = staffs.length - activeCount;
  const partTimeCount = staffs.filter(
    (staff) => staff.employment_type === "part_time"
  ).length;

  const canSetAdmin = currentProfile?.role === "admin";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">スタッフ管理</h2>
        <p className="mt-1 text-sm text-slate-600">
          スタッフの名前、権限、雇用区分、時給、月給、有効状態を管理します。
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
            <CardTitle className="text-base">スタッフ数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{staffs.length}</p>
            <p className="mt-1 text-sm text-slate-500">
              表示対象のスタッフ数です。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">有効 / 無効</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {activeCount} / {inactiveCount}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              有効スタッフ / 無効スタッフ
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">バイト・パート</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{partTimeCount}</p>
            <p className="mt-1 text-sm text-slate-500">
              時給計算の対象になりやすいスタッフです。
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>スタッフ一覧</CardTitle>
        </CardHeader>

        <CardContent>
          {staffs.length === 0 ? (
            <p className="text-sm text-slate-600">
              スタッフがまだ登録されていません。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>名前</TableHead>
                    <TableHead>メール</TableHead>
                    <TableHead>権限</TableHead>
                    <TableHead>雇用区分</TableHead>
                    <TableHead className="text-right">時給</TableHead>
                    <TableHead className="text-right">月給</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {staffs.map((staff) => {
                    const formId = `staff-form-${staff.id}`;

                    return (
                      <TableRow key={staff.id}>
                        <TableCell>
                          <Input
                            form={formId}
                            name="fullName"
                            defaultValue={staff.full_name ?? ""}
                            placeholder="名前"
                            required
                          />
                        </TableCell>

                        <TableCell>
                          <div className="text-sm">{staff.email ?? "-"}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            ID: {staff.id.slice(0, 8)}...
                          </div>
                        </TableCell>

                        <TableCell>
                          <select
                            form={formId}
                            name="role"
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            defaultValue={staff.role}
                            required
                          >
                            <option value="staff">staff</option>
                            <option value="manager">manager</option>
                            {canSetAdmin ? (
                              <option value="admin">admin</option>
                            ) : null}
                          </select>
                        </TableCell>

                        <TableCell>
                          <select
                            form={formId}
                            name="employmentType"
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            defaultValue={staff.employment_type}
                            required
                          >
                            <option value="part_time">バイト・パート</option>
                            <option value="full_time">社員</option>
                            <option value="contract">契約</option>
                          </select>
                          <div className="mt-1 text-xs text-slate-500">
                            現在: {formatEmploymentType(staff.employment_type)}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Input
                            form={formId}
                            name="hourlyWage"
                            type="number"
                            min={0}
                            step={1}
                            defaultValue={staff.hourly_wage ?? 0}
                            className="text-right"
                          />
                        </TableCell>

                        <TableCell>
                          <Input
                            form={formId}
                            name="monthlySalary"
                            type="number"
                            min={0}
                            step={1}
                            defaultValue={staff.monthly_salary ?? 0}
                            className="text-right"
                          />
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <input
                              type="hidden"
                              form={formId}
                              name="isActive"
                              value="false"
                            />
                            <input
                              form={formId}
                              id={`isActive-${staff.id}`}
                              name="isActive"
                              type="checkbox"
                              value="true"
                              defaultChecked={staff.is_active}
                              className="h-4 w-4"
                            />
                            <label
                              htmlFor={`isActive-${staff.id}`}
                              className="text-sm"
                            >
                              有効
                            </label>
                          </div>

                          <div className="mt-2">
                            <Badge variant={staff.is_active ? "secondary" : "outline"}>
                              {staff.is_active ? "有効" : "無効"}
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <form id={formId} action={updateStaffAction}>
                            <input
                              type="hidden"
                              name="staffId"
                              value={staff.id}
                            />
                            <Button type="submit" size="sm">
                              保存
                            </Button>
                          </form>
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