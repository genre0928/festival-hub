import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { FestivalFilters, FestivalStatus } from "~/lib/festivals";

type StatusParam = FestivalStatus | "all";

const STATUS_VALUES: StatusParam[] = ["all", "ongoing", "upcoming", "ended"];

/** 필터 상태를 URL 쿼리 파라미터(q, region, date, status)와 동기화 - 공유 가능한 검색 결과 링크 지원 */
export function useFestivalFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: FestivalFilters = useMemo(() => {
    const rawStatus = searchParams.get("status") ?? "all";
    return {
      query: searchParams.get("q") ?? "",
      regionCode: searchParams.get("region"),
      date: searchParams.get("date"),
      status: STATUS_VALUES.includes(rawStatus as StatusParam)
        ? (rawStatus as StatusParam)
        : "all",
    };
  }, [searchParams]);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );

  return {
    filters,
    setQuery: (value: string) => updateParam("q", value),
    setRegionCode: (value: string | null) => updateParam("region", value),
    setDate: (value: string | null) => updateParam("date", value),
    setStatus: (value: StatusParam) => updateParam("status", value === "all" ? null : value),
  };
}
