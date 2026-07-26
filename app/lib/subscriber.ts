import { supabase } from "~/lib/supabase/client";
import type { SubscriberFrequency } from "~/lib/supabase/types";

export interface MySubscriberSettings {
  regions: string[];
  frequencies: SubscriberFrequency[];
  isActive: boolean;
  kakaoConnected: boolean;
}

const DEFAULT_SETTINGS: MySubscriberSettings = {
  regions: [],
  frequencies: ["monthly"],
  isActive: true,
  kakaoConnected: false,
};

/** 로그인한 사용자 본인의 구독 설정을 가져온다. 아직 없으면 기본값을 반환한다. */
export async function getMySubscriberSettings(): Promise<MySubscriberSettings> {
  if (!supabase) return DEFAULT_SETTINGS;

  const { data, error } = await supabase
    .from("subscribers")
    .select("regions, frequencies, is_active, kakao_connected")
    .maybeSingle();

  if (error || !data) return DEFAULT_SETTINGS;

  return {
    regions: data.regions,
    frequencies: data.frequencies,
    isActive: data.is_active,
    kakaoConnected: data.kakao_connected,
  };
}

/** 관심 지역/알림 주기를 저장한다. 로그인한 사용자 본인 행만 RLS로 허용됨. */
export async function saveMySubscriberSettings(
  userId: string,
  settings: { regions: string[]; frequencies: SubscriberFrequency[]; isActive: boolean },
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from("subscribers").upsert(
    {
      user_id: userId,
      regions: settings.regions,
      frequencies: settings.frequencies,
      is_active: settings.isActive,
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}
