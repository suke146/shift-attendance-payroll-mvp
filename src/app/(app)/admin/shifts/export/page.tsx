import { FileSpreadsheet, Table2 } from "lucide-react";

import { exportShiftsToGoogleSheetsAction } from "./actions";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { getMonthRange } from "@/lib/shift-export";

type ExportPageProps = {
  searchParams: Promise<{
    month?: string;
    message?: string;
  }>;
};

export default async function ShiftExportPage({
  searchParams,
}: ExportPageProps) {
  const params = await searchParams;
  const { month, startDate, endDate } = getMonthRange(params.month);

  const supabase = await createClient();

  const { count } = await supabase
    .from("shifts")
    .select("id", { count: "exact", head: true })
    .gte("shift_date", startDate)
    .lt("shift_date", endDate);

  const googleEnvReady =
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) &&
    Boolean(process.env.GOOGLE_PRIVATE_KEY);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">出力</h2>
        <p className="mt-1 text-sm text-slate-600">
          確定シフトをExcelまたはGoogleスプレッドシートへ出力します。
        </p>
      </div>

      {params.message ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {params.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>対象月</CardTitle>
          </CardHeader>

          <CardContent>
            <form className="space-y-4">
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

              <Button type="submit" variant="outline">
                表示月を変更
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>出力対象</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-sm text-slate-500">対象月</p>
              <p className="mt-1 text-2xl font-bold">{month}</p>
            </div>

            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-sm text-slate-500">確定シフト数</p>
              <p className="mt-1 text-2xl font-bold">{count ?? 0}件</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Excelファイルで出力</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              .xlsx形式でダウンロードします。「月間シフト一覧」と「集計」の2シートを作成します。
            </p>

            <Button asChild>
              <a href={`/api/admin/shifts/export?month=${month}`}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excelをダウンロード
              </a>
            </Button>

            <p className="text-xs text-slate-500">
              Google設定なしで利用できます。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Googleスプレッドシートへ出力</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              指定したGoogleスプレッドシートに、シフト一覧と集計を出力します。
            </p>

            {!googleEnvReady ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Google連携の環境変数が未設定です。Excel出力は利用できます。
              </div>
            ) : null}

            <form action={exportShiftsToGoogleSheetsAction} className="space-y-4">
              <input type="hidden" name="month" value={month} />

              <div className="space-y-2">
                <label htmlFor="spreadsheetId" className="text-sm font-medium">
                  スプレッドシートID または URL
                </label>
                <Input
                  id="spreadsheetId"
                  name="spreadsheetId"
                  placeholder="GoogleスプレッドシートのURLまたはID"
                  required
                />
                <p className="text-xs text-slate-500">
                  出力先スプレッドシートを、サービスアカウントのメールアドレスに編集者として共有してください。
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="sheetNamePrefix" className="text-sm font-medium">
                  シート名の接頭辞
                </label>
                <Input
                  id="sheetNamePrefix"
                  name="sheetNamePrefix"
                  defaultValue="シフト表"
                />
                <p className="text-xs text-slate-500">
                  例：シフト表_2026-07_一覧、シフト表_2026-07_集計
                </p>
              </div>

              <Button type="submit" disabled={!googleEnvReady}>
                <Table2 className="mr-2 h-4 w-4" />
                Googleスプレッドシートへ出力
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}