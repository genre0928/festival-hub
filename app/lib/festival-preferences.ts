import { supabase } from "~/lib/supabase/client";
import type { FestivalPreference } from "~/lib/supabase/types";

export type { FestivalPreference };

/** 로그인한 사용자의 축제별 즐겨찾기/관심없음을 festival_id -> preference 맵으로 가져온다. */
export async function getMyFestivalPreferences(): Promise<Record<string, FestivalPreference>> {
  if (!supabase) return {};

  const { data, error } = await supabase.from("festival_preferences").select("festival_id, preference");
  if (error || !data) return {};

  const map: Record<string, FestivalPreference> = {};
  for (const row of data) {
    map[row.festival_id] = row.preference;
  }
  return map;
}

/** 즐겨찾기/관심없음을 설정한다. preference가 null이면 표시를 지운다(해제). */
export async function setFestivalPreference(
  userId: string,
  festivalId: string,
  preference: FestivalPreference | null,
): Promise<void> {
  if (!supabase) return;

  if (preference === null) {
    const { error } = await supabase
      .from("festival_preferences")
      .delete()
      .eq("user_id", userId)
      .eq("festival_id", festivalId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("festival_preferences")
    .upsert({ user_id: userId, festival_id: festivalId, preference }, { onConflict: "user_id,festival_id" });
  if (error) throw error;
}
