import Link from "next/link";

import { signInAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>ログイン</CardTitle>
          <CardDescription>
            シフト・勤怠・給与集計補助システムにログインします。
          </CardDescription>
        </CardHeader>

        <CardContent>
          {params.message ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {params.message}
            </div>
          ) : null}

          <form action={signInAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="example@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="password"
                required
              />
            </div>

            <Button type="submit" className="w-full">
              ログイン
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-600">
            アカウントがない場合は{" "}
            <Link href="/auth/signup" className="font-medium underline">
              新規登録
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}