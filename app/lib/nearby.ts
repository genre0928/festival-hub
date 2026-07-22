import { supabase } from "~/lib/supabase/client";

export type NearbyCategory = "attraction" | "restaurant" | "lodging";

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

export interface NearbyCategoryResult {
  places: NearbyPlace[];
  /** 실제로 결과를 찾는 데 쓰인 반경(m). 기본(5km)보다 크면 더 넓혀 찾은 것 */
  radiusMeters: number;
}

export interface NearbyInfo {
  attractions: NearbyCategoryResult;
  restaurants: NearbyCategoryResult;
  lodgings: NearbyCategoryResult;
}

export interface NearbyPlaceWithCategory extends NearbyPlace {
  category: NearbyCategory;
}

const EMPTY_CATEGORY: NearbyCategoryResult = { places: [], radiusMeters: 0 };
const EMPTY_NEARBY_INFO: NearbyInfo = {
  attractions: EMPTY_CATEGORY,
  restaurants: EMPTY_CATEGORY,
  lodgings: EMPTY_CATEGORY,
};

/** mapX(경도)/mapY(위도) 기준 주변 관광지/음식점/숙박 정보를 nearby-info Edge Function에서 가져온다. */
export async function getNearbyInfo(mapX: number, mapY: number): Promise<NearbyInfo> {
  if (!supabase) return EMPTY_NEARBY_INFO;

  const { data, error } = await supabase.functions.invoke<NearbyInfo>("nearby-info", {
    body: { mapX, mapY },
  });

  if (error) throw error;
  return data ?? EMPTY_NEARBY_INFO;
}

/** 지도/리스트에서 같이 다루기 쉽게 카테고리 표시가 붙은 단일 배열로 합친다. */
export function flattenNearbyInfo(info: NearbyInfo): NearbyPlaceWithCategory[] {
  return [
    ...info.attractions.places.map((p) => ({ ...p, category: "attraction" as const })),
    ...info.restaurants.places.map((p) => ({ ...p, category: "restaurant" as const })),
    ...info.lodgings.places.map((p) => ({ ...p, category: "lodging" as const })),
  ];
}
