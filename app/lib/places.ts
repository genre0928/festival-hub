import { supabase } from "~/lib/supabase/client";
import type { PlaceCategory, PlaceRow } from "~/lib/supabase/types";

export type { PlaceCategory };

export interface Place {
  id: string;
  name: string;
  description: string;
  category: PlaceCategory;
  regionCode: string;
  sigungu: string | null;
  address: string;
  tel: string | null;
  tags: string[];
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  sourceUrl?: string;
}

export const PLACE_CATEGORY_LABELS: Record<PlaceCategory, string> = {
  attraction: "관광지",
  lodging: "숙소",
  restaurant: "음식점",
};

function mapRowToPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    regionCode: row.region_code,
    sigungu: row.sigungu,
    address: row.address,
    tel: row.tel,
    tags: row.tags ?? [],
    imageUrl: row.image_url ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    sourceUrl: row.source_url ?? undefined,
  };
}

/**
 * 지역 하나를 기준으로만 조회한다(전국을 한 번에 다 불러오지 않음). 전체 places는
 * 수천 건이라 PostgREST 기본 행 제한(1000)에 걸려 일부만 조회되는 문제가 있었고,
 * 애초에 한 지역(최대 몇백 건) 단위로만 보여주는 페이지라 이 방식이 더 맞다.
 * regionCode가 없으면(아직 지역을 안 골랐으면) 빈 배열을 돌려준다.
 */
export async function getPlaces(regionCode: string | null): Promise<Place[]> {
  if (!supabase || !regionCode) return [];

  const { data, error } = await supabase
    .from("places")
    .select("*")
    .eq("region_code", regionCode)
    .order("name", { ascending: true });

  if (error) {
    console.error("Supabase places 조회 실패:", error.message);
    return [];
  }

  return (data ?? []).map(mapRowToPlace);
}

export interface PlaceFilters {
  category: PlaceCategory | "all";
  /** 단일 지역 기준(축제 목록과 달리 복수 선택은 지원하지 않음). null이면 전국. */
  regionCode: string | null;
  /** regionCode가 있을 때만 유효 */
  sigungu: string | null;
  query: string;
}

export function filterPlaces(places: Place[], filters: PlaceFilters): Place[] {
  const query = filters.query.trim().toLowerCase();
  const effectiveSigungu = filters.regionCode ? filters.sigungu : null;

  return places.filter((place) => {
    if (filters.category !== "all" && place.category !== filters.category) return false;
    if (filters.regionCode && place.regionCode !== filters.regionCode) return false;
    if (effectiveSigungu && place.sigungu !== effectiveSigungu) return false;

    if (query) {
      const haystack = [place.name, place.address, ...place.tags].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

/** 지역이 선택됐을 때 그 안에 존재하는 시/군/구 목록(가나다순)을 돌려준다. */
export function getPlaceSigunguOptions(places: Place[], regionCode: string | null): string[] {
  if (!regionCode) return [];
  const values = new Set<string>();
  for (const place of places) {
    if (place.regionCode === regionCode && place.sigungu) {
      values.add(place.sigungu);
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b, "ko"));
}

export function countPlacesByCategory(places: Place[]): Record<PlaceCategory, number> {
  const counts: Record<PlaceCategory, number> = { attraction: 0, lodging: 0, restaurant: 0 };
  for (const place of places) {
    counts[place.category] += 1;
  }
  return counts;
}
