import { supabase } from "~/lib/supabase/client";

export interface NearbyPlace {
  contentId: string;
  title: string;
  address: string;
  imageUrl: string | null;
  tel: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
}

export interface NearbyInfo {
  attractions: NearbyPlace[];
  restaurants: NearbyPlace[];
  lodgings: NearbyPlace[];
}

const EMPTY_NEARBY_INFO: NearbyInfo = { attractions: [], restaurants: [], lodgings: [] };

/** mapX(경도)/mapY(위도) 기준 주변 관광지/음식점/숙박 정보를 nearby-info Edge Function에서 가져온다. */
export async function getNearbyInfo(mapX: number, mapY: number): Promise<NearbyInfo> {
  if (!supabase) return EMPTY_NEARBY_INFO;

  const { data, error } = await supabase.functions.invoke<NearbyInfo>("nearby-info", {
    body: { mapX, mapY },
  });

  if (error) throw error;
  return data ?? EMPTY_NEARBY_INFO;
}
