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

export interface LocationMatch {
  regionCode: string;
  sigungu: string | null;
  latitude: number;
  longitude: number;
  matchedName: string;
}

/**
 * 지역명/지명(장소명)으로 검색해서 지역(+시군구)과 기준 좌표를 찾는다. 지도 클릭 대신 이
 * 검색으로 지역을 정한다. geocode-address Edge Function이 네이버 지역 검색으로 지오코딩한다.
 * 네이버 지역 검색은 업체/장소 위주 데이터라 "구미시", "구미시청"처럼 지역명이나 장소명은
 * 잘 찾지만, 상호 없이 순수 도로명 주소(예: "신시로10길 71")만 검색하면 못 찾을 수 있다 -
 * 그런 경우 지역명이나 근처 장소명으로 다시 검색하도록 안내한다.
 */
export async function searchPlaceLocation(query: string): Promise<LocationMatch | null> {
  const trimmed = query.trim();
  if (!supabase || !trimmed) return null;

  const { data, error } = await supabase.functions.invoke<{
    regionCode: string;
    sigungu: string | null;
    latitude: number;
    longitude: number;
    matchedName: string;
  }>("geocode-address", { body: { query: trimmed } });

  if (error || !data) return null;

  return {
    regionCode: data.regionCode,
    sigungu: data.sigungu,
    latitude: data.latitude,
    longitude: data.longitude,
    matchedName: data.matchedName,
  };
}

/** 두 좌표 사이의 대략적인 거리(m). 정렬용이라 지구를 완전한 구로 가정하는 하버사인 공식이면 충분하다. */
export function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** 기준 좌표가 있으면 거리순으로, 없으면 원래 순서(이름순) 그대로 돌려준다. */
export function sortPlacesByDistance(
  places: Place[],
  referencePoint: { lat: number; lng: number } | null,
): (Place & { distanceMeters?: number })[] {
  if (!referencePoint) return places;

  return places
    .map((place) => ({
      ...place,
      distanceMeters:
        place.latitude != null && place.longitude != null
          ? haversineDistanceMeters(referencePoint.lat, referencePoint.lng, place.latitude, place.longitude)
          : undefined,
    }))
    .sort((a, b) => {
      if (a.distanceMeters == null) return 1;
      if (b.distanceMeters == null) return -1;
      return a.distanceMeters - b.distanceMeters;
    });
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
