import { createStoreAction, updateStoreAction } from "./actions";

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

type StorePageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

type StoreRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  google_spreadsheet_id: string | null;
  is_active: boolean;
  created_at: string;
};

export default async function StorePage({ searchParams }: StorePageProps) {
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

  let storesQuery = supabase
    .from("stores")
    .select(
      "id, name, address, phone, google_spreadsheet_id, is_active, created_at"
    )
    .order("created_at", { ascending: true });

  if (profile?.role !== "admin") {
    storesQuery = storesQuery.eq("id", profile?.store_id ?? "");
  }

  const { data: storesData } = await storesQuery;

  const stores = (storesData ?? []) as StoreRow[];
  const isAdmin = profile?.role === "admin";
  const canCreateStore = isAdmin || !profile?.store_id;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">店舗登録</h2>
        <p className="mt-1 text-sm text-slate-600">
          店舗名、住所、電話番号、Googleスプレッドシート出力先を管理します。
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
            <CardTitle className="text-base">表示店舗数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stores.length}</p>
            <p className="mt-1 text-sm text-slate-500">
              manager は自店舗のみ、admin は全店舗を表示します。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">権限</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{profile?.role ?? "unknown"}</Badge>
            <p className="mt-2 text-sm text-slate-500">
              店舗作成・編集範囲は権限によって変わります。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">スプレッドシート連携</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              店舗ごとにGoogleスプレッドシートIDを保存できます。
            </p>
          </CardContent>
        </Card>
      </div>

      {canCreateStore ? (
        <Card>
          <CardHeader>
            <CardTitle>店舗を新規作成</CardTitle>
          </CardHeader>

          <CardContent>
            <form action={createStoreAction} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="create-name" className="text-sm font-medium">
                  店舗名
                </label>
                <Input
                  id="create-name"
                  name="name"
                  placeholder="例：テスト店舗"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="create-phone" className="text-sm font-medium">
                  電話番号
                </label>
                <Input
                  id="create-phone"
                  name="phone"
                  placeholder="例：090-0000-0000"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="create-address" className="text-sm font-medium">
                  住所
                </label>
                <Input
                  id="create-address"
                  name="address"
                  placeholder="例：大阪府〇〇市〇〇町1-2-3"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label
                  htmlFor="create-googleSpreadsheetId"
                  className="text-sm font-medium"
                >
                  GoogleスプレッドシートID
                </label>
                <Input
                  id="create-googleSpreadsheetId"
                  name="googleSpreadsheetId"
                  placeholder="スプレッドシートURLまたはID"
                />
              </div>

              <div className="md:col-span-2">
                <Button type="submit">店舗を作成する</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>店舗一覧・編集</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {stores.length === 0 ? (
            <p className="text-sm text-slate-600">
              店舗情報がまだ登録されていません。
            </p>
          ) : (
            <div className="space-y-4">
              {stores.map((store) => {
                const formId = `store-form-${store.id}`;

                return (
                  <div key={store.id} className="rounded-lg border p-4">
                    <form id={formId} action={updateStoreAction} />

                    <input
                      form={formId}
                      type="hidden"
                      name="storeId"
                      value={store.id}
                    />

                    <input
                      form={formId}
                      type="hidden"
                      name="isActive"
                      value="false"
                    />

                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {store.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          ID: {store.id}
                        </p>
                      </div>

                      <Badge variant={store.is_active ? "secondary" : "outline"}>
                        {store.is_active ? "有効" : "無効"}
                      </Badge>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label
                          htmlFor={`name-${store.id}`}
                          className="text-sm font-medium"
                        >
                          店舗名
                        </label>
                        <Input
                          form={formId}
                          id={`name-${store.id}`}
                          name="name"
                          defaultValue={store.name}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor={`phone-${store.id}`}
                          className="text-sm font-medium"
                        >
                          電話番号
                        </label>
                        <Input
                          form={formId}
                          id={`phone-${store.id}`}
                          name="phone"
                          defaultValue={store.phone ?? ""}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label
                          htmlFor={`address-${store.id}`}
                          className="text-sm font-medium"
                        >
                          住所
                        </label>
                        <Input
                          form={formId}
                          id={`address-${store.id}`}
                          name="address"
                          defaultValue={store.address ?? ""}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label
                          htmlFor={`google-${store.id}`}
                          className="text-sm font-medium"
                        >
                          GoogleスプレッドシートID
                        </label>
                        <Input
                          form={formId}
                          id={`google-${store.id}`}
                          name="googleSpreadsheetId"
                          defaultValue={store.google_spreadsheet_id ?? ""}
                          placeholder="GoogleスプレッドシートURLまたはID"
                        />
                        <p className="text-xs text-slate-500">
                          Excel / スプレッドシート出力機能で利用できます。
                        </p>
                      </div>

                      {isAdmin ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">状態</p>
                          <div className="flex items-center gap-2">
                            <input
                              form={formId}
                              id={`active-${store.id}`}
                              name="isActive"
                              type="checkbox"
                              value="true"
                              defaultChecked={store.is_active}
                              className="h-4 w-4"
                            />
                            <label
                              htmlFor={`active-${store.id}`}
                              className="text-sm"
                            >
                              有効
                            </label>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4">
                      <Button form={formId} type="submit">
                        店舗情報を保存する
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}