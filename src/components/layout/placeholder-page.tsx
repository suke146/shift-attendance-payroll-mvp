import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card";
  
  type PlaceholderPageProps = {
    title: string;
    description: string;
  };
  
  export function PlaceholderPage({
    title,
    description,
  }: PlaceholderPageProps) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
  
        <Card>
          <CardHeader>
            <CardTitle className="text-base">実装予定</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            この画面はこれから実装します。まずは左メニューと共通レイアウトを整えています。
          </CardContent>
        </Card>
      </div>
    );
  }