import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">ホーム</h2>
        <p className="mt-1 text-sm text-slate-600">
          左のメニューから、希望シフト提出・確定シフト確認・管理機能を開けます。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">スタッフ機能</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            希望シフト提出、提出済み希望シフト、確定シフト、カレンダー、給料計算を利用できます。
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">マネージャー機能</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            希望シフト一覧、シフト制作、シフト管理、Excel出力、スタッフ管理、店舗登録を利用できます。
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">次の実装</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            次は「希望シフト提出」機能を作ります。
          </CardContent>
        </Card>
      </div>
    </div>
  );
}