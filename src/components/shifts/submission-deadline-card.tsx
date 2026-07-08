import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentTargetMonth,
  getShiftSubmissionDeadlineStatus,
} from "@/lib/shift-submission-deadlines";

type SubmissionDeadlineCardProps = {
  targetMonth?: string;
};

type ProfileRow = {
  id: string;
  store_id: string | null;
  role: string;
};

export async function SubmissionDeadlineCard({
  targetMonth,
}: SubmissionDeadlineCardProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileData } = user
    ? await supabase
        .from("profiles")
        .select("id, store_id, role")
        .eq("id", user.id)
        .single()
    : { data: null };

  const profile = profileData as ProfileRow | null;

  const status = await getShiftSubmissionDeadlineStatus({
    supabase,
    storeId: profile?.store_id,
    targetMonth: targetMonth ?? getCurrentTargetMonth(),
  });

  return (
    <Card
      className={
        status.isOpen
          ? "border-blue-200 bg-blue-50"
          : "border-red-200 bg-red-50"
      }
    >
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          希望シフト提出期限
          <Badge variant={status.isOpen ? "secondary" : "destructive"}>
            {status.isOpen ? "提出可能" : "締切済み"}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-slate-700">{status.message}</p>

        <p className="mt-2 text-xs text-slate-500">
          対象月：{status.targetMonth}
          {status.isConfigured
            ? " / この月の希望シフトは提出期限で制御されます。"
            : " / 期限未設定の場合は提出可能として扱います。"}
        </p>
      </CardContent>
    </Card>
  );
}