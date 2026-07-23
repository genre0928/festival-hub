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
      sigungu: searchParams.get("sigungu"),
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

  const setRegionCode = useCallback(
    // sigungu를 함께 넘기면(카드/리스트에서 특정 시/군/구를 바로 선택하는 경우) 같이 반영하고,
    // 생략하면(지역 드롭다운/지도 클릭 등 지역만 바꾸는 경우) 이전 지역의 시/군/구 선택은
    // 더 이상 유효하지 않으므로 함께 지운다.
    (value: string | null, sigungu?: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set("region", value);
          } else {
            next.delete("region");
          }
          if (sigungu) {
            next.set("sigungu", sigungu);
          } else {
            next.delete("sigungu");
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
    setRegionCode,
    setSigungu: (value: string | null) => updateParam("sigungu", value),
    setDate: (value: string | null) => updateParam("date", value),
    setStatus: (value: StatusParam) => updateParam("status", value === "all" ? null : value),
  };
}
