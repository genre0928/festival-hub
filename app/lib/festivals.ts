import { FESTIVALS, type Festival, type FestivalCategory } from "~/lib/data/festivals.mock";
import { supabase } from "~/lib/supabase/client";
import type { FestivalRow } from "~/lib/supabase/types";

export type FestivalStatus = "ongoing" | "upcoming" | "ended";

export const STATUS_LABELS: Record<FestivalStatus, string> = {
  ongoing: "진행중",
  upcoming: "진행예정",
  ended: "종료",
};

const VALID_CATEGORIES = new Set<string>(["전통", "음악", "음식", "자연", "불꽃", "예술", "기타"]);

function normalizeCategory(value: string): FestivalCategory {
  return VALID_CATEGORIES.has(value) ? (value as FestivalCategory) : "기타";
}

function mapRowToFestival(row: FestivalRow): Festival {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    regionCode: row.region_code,
    sigungu: row.sigungu,
    address: row.address,
    startDate: row.start_date,
    endDate: row.end_date,
    category: normalizeCategory(row.category),
    tags: row.tags ?? [],
    imageUrl: row.image_url ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
  };
}

/**
 * 데이터 접근 seam. Supabase가 설정돼 있으면 실제 DB를 조회하고,
 * 설정이 없거나 조회에 실패하면 mock 데이터로 대체한다.
 */
export async function getFestivals(): Promise<Festival[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("festivals")
      .select("*")
      .order("start_date", { ascending: true });

    if (error) {
      console.error("Supabase festivals 조회 실패, mock 데이터로 대체합니다:", error.message);
    } else if (data) {
      return data.map(mapRowToFestival);
    }
  }

  return FESTIVALS;
}

export function getFestivalStatus(
  festival: Pick<Festival, "startDate" | "endDate">,
  referenceDate: Date = new Date(),
): FestivalStatus {
  const today = toDateOnly(referenceDate);
  const start = toDateOnly(new Date(festival.startDate));
  const end = toDateOnly(new Date(festival.endDate));

  if (today < start) return "upcoming";
  if (today > end) return "ended";
  return "ongoing";
}

function toDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export interface FestivalFilters {
  status: FestivalStatus | "all";
  /** 복수 선택 가능. 빈 배열이면 전체 지역. */
  regionCodes: string[];
  /** regionCodes가 정확히 1개일 때만 의미가 있는 시/군/구. 복수 지역이면 항상 무시(validation). */
  sigungu: string | null;
  query: string;
  /** YYYY-MM-DD. 지정 시 해당 날짜에 열리는 축제만 남김 */
  date: string | null;
}

export function filterFestivals(
  festivals: Festival[],
  filters: FestivalFilters,
  referenceDate: Date = new Date(),
): Festival[] {
  const query = filters.query.trim().toLowerCase();
  // 시/군/구는 지역이 정확히 하나 선택된 경우에만 유효하다 - 복수 지역이면 상세지역 필터는 적용하지 않는다.
  const effectiveSigungu = filters.regionCodes.length === 1 ? filters.sigungu : null;

  return festivals.filter((festival) => {
    if (filters.status !== "all") {
      if (getFestivalStatus(festival, referenceDate) !== filters.status) return false;
    }

    if (filters.regionCodes.length > 0 && !filters.regionCodes.includes(festival.regionCode)) {
      return false;
    }

    if (effectiveSigungu && festival.sigungu !== effectiveSigungu) {
      return false;
    }

    if (filters.date) {
      if (festival.startDate > filters.date || festival.endDate < filters.date) {
        return false;
      }
    }

    if (query) {
      const haystack = [festival.name, festival.address, ...festival.tags]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

/** 지역이 정확히 하나 선택됐을 때 그 안에 존재하는 시/군/구 목록(가나다순)을 돌려준다. */
export function getSigunguOptions(festivals: Festival[], regionCodes: string[]): string[] {
  if (regionCodes.length !== 1) return [];
  const [regionCode] = regionCodes;
  const values = new Set<string>();
  for (const festival of festivals) {
    if (festival.regionCode === regionCode && festival.sigungu) {
      values.add(festival.sigungu);
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b, "ko"));
}

export function countFestivalsByRegion(festivals: Festival[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const festival of festivals) {
    counts[festival.regionCode] = (counts[festival.regionCode] ?? 0) + 1;
  }
  return counts;
}
