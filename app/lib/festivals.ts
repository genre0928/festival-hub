import { FESTIVALS, type Festival } from "~/lib/data/festivals.mock";

export type FestivalStatus = "ongoing" | "upcoming" | "ended";

export const STATUS_LABELS: Record<FestivalStatus, string> = {
  ongoing: "진행중",
  upcoming: "진행예정",
  ended: "종료",
};

/** 데이터 접근 seam. 지금은 mock 배열을 반환하지만, 추후 Supabase 쿼리로 교체될 지점. */
export function getFestivals(): Festival[] {
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
  regionCode: string | null;
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

  return festivals.filter((festival) => {
    if (filters.status !== "all") {
      if (getFestivalStatus(festival, referenceDate) !== filters.status) return false;
    }

    if (filters.regionCode && festival.regionCode !== filters.regionCode) {
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

export function countFestivalsByRegion(festivals: Festival[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const festival of festivals) {
    counts[festival.regionCode] = (counts[festival.regionCode] ?? 0) + 1;
  }
  return counts;
}
