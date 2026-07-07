import Link from "next/link";

import { signUpAction } from "@/app/auth/actions";
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

type SignUpPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>新規登録</CardTitle>
          <CardDescription>
            スタッフ用アカウントを作成します。
          </CardDescription>
        </CardHeader>

        <CardContent>
          {params.message ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {params.message}
            </div>
          ) : null}

          <form action={signUpAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">名前</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="山田 太郎"
                required
              />
            </div>

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
                placeholder="6文字以上"
                minLength={6}
                required
              />
            </div>

            <Button type="submit" className="w-full">
              登録する
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-600">
            すでにアカウントがある場合は{" "}
            <Link href="/auth/login" className="font-medium underline">
              ログイン
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}