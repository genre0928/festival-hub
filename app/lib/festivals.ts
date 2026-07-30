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

/** 한 번이라도 신규로 감지된 축제에 붙는 태그. 검색창에서 "신규"로 찾을 수 있게 tags에 포함시킨다. */
export const NEW_FESTIVAL_TAG = "신규";

/**
 * 이 날짜(로컬 기준) 이전에 기록된 감지는 "신규" 태그 대상에서 제외한다. NEW 라벨 기능을
 * 붙이면서 festival_new_detections 읽기 권한을 새로 열었더니, 그 전까지 쌓여있던 감지
 * 기록(초기 동기화 백로그 등)이 한꺼번에 다 "신규" 태그를 달게 되는 문제가 있어 도입한
 * 컷오프 - 이 날짜 이후 새로 감지된 축제부터만 태그가 붙는다.
 */
const NEW_TAG_CUTOFF_DATE = new Date(2026, 6, 30);

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
      return attachNewDetections(data.map(mapRowToFestival));
    }
  }

  return FESTIVALS;
}

/**
 * festival_new_detections를 조회해 각 축제에 최초 감지 시각(newDetectedAt)을 붙이고,
 * 한 번이라도 신규로 감지된 적 있는 축제엔 NEW_FESTIVAL_TAG를 tags에 추가한다(검색용).
 * 조회에 실패해도 신규 표시만 빠질 뿐이라 festivals 자체는 그대로 돌려준다.
 */
async function attachNewDetections(festivals: Festival[]): Promise<Festival[]> {
  if (!supabase) return festivals;

  const { data, error } = await supabase.from("festival_new_detections").select("festival_id, detected_at");
  if (error) {
    console.error("신규 축제 감지 정보 조회 실패:", error.message);
    return festivals;
  }
  if (!data || data.length === 0) return festivals;

  const firstDetectedAtByFestivalId = new Map<string, string>();
  for (const row of data) {
    const existing = firstDetectedAtByFestivalId.get(row.festival_id);
    if (!existing || row.detected_at < existing) {
      firstDetectedAtByFestivalId.set(row.festival_id, row.detected_at);
    }
  }

  return festivals.map((festival) => {
    const detectedAt = firstDetectedAtByFestivalId.get(festival.id);
    if (!detectedAt) return festival;

    const withDetection = { ...festival, newDetectedAt: detectedAt };
    if (toDateOnly(new Date(detectedAt)) < toDateOnly(NEW_TAG_CUTOFF_DATE)) return withDetection;

    return {
      ...withDetection,
      tags: festival.tags.includes(NEW_FESTIVAL_TAG) ? festival.tags : [...festival.tags, NEW_FESTIVAL_TAG],
    };
  });
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

/** NEW 라벨 표시 여부 - 신규로 감지된 당일에만 true (트래킹 db 생성일 기준). */
export function isFestivalNewToday(
  festival: Pick<Festival, "newDetectedAt">,
  referenceDate: Date = new Date(),
): boolean {
  if (!festival.newDetectedAt) return false;
  return toDateOnly(new Date(festival.newDetectedAt)) === toDateOnly(referenceDate);
}

/** "이번달 신규 모아보기"용 - referenceDate와 같은 연/월에 신규로 감지됐으면 true. */
export function isFestivalNewThisMonth(
  festival: Pick<Festival, "newDetectedAt">,
  referenceDate: Date = new Date(),
): boolean {
  if (!festival.newDetectedAt) return false;
  const detected = new Date(festival.newDetectedAt);
  return (
    detected.getFullYear() === referenceDate.getFullYear() && detected.getMonth() === referenceDate.getMonth()
  );
}

/**
 * 오늘 신규로 감지된 축제를 축제상태와 무관하게 목록 최상단으로 끌어올린다.
 * Array.sort는 안정 정렬이라 신규/비신규 그룹 내부의 기존 순서는 그대로 유지된다.
 */
export function sortNewFirst<T extends Pick<Festival, "newDetectedAt">>(
  festivals: T[],
  referenceDate: Date = new Date(),
): T[] {
  return [...festivals].sort((a, b) => {
    const aNew = isFestivalNewToday(a, referenceDate) ? 1 : 0;
    const bNew = isFestivalNewToday(b, referenceDate) ? 1 : 0;
    return bNew - aNew;
  });
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
  /** true면 "이번달 신규 모아보기" - status와 무관하게 이번 달 신규 감지 축제만 남긴다. */
  newOnly: boolean;
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
    if (filters.newOnly) {
      // 이번달 신규 모아보기는 축제상태와 무관하게 보여준다 - status 필터는 건너뛴다.
      if (!isFestivalNewThisMonth(festival, referenceDate)) return false;
    } else if (filters.status !== "all") {
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
