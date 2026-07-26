import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { FestivalFilters, FestivalStatus } from "~/lib/festivals";

type StatusParam = FestivalStatus | "all";

const STATUS_VALUES: StatusParam[] = ["all", "ongoing", "upcoming", "ended"];

/**
 * 필터 상태를 URL 쿼리 파라미터(q, region, sigungu, date, status)와 동기화 - 공유 가능한
 * 검색 결과 링크 지원. region은 쉼표로 구분한 복수 지역 코드(예: "seoul,busan")를 담는다.
 * sigungu는 지역이 정확히 1개 선택된 경우에만 의미가 있다(복수 선택 시 항상 지워짐).
 */
export function useFestivalFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: FestivalFilters = useMemo(() => {
    // status 파라미터가 아예 없으면(처음 들어왔을 때) "오늘 진행중"을 기본값으로 보여준다.
    // "전체"를 명시적으로 고르면 setStatus가 status=all을 URL에 그대로 써서 구분한다.
    const rawStatus = searchParams.get("status");
    const regionParam = searchParams.get("region");
    const regionCodes = regionParam ? regionParam.split(",").filter(Boolean) : [];
    return {
      query: searchParams.get("q") ?? "",
      regionCodes,
      sigungu: searchParams.get("sigungu"),
      date: searchParams.get("date"),
      status:
        rawStatus && STATUS_VALUES.includes(rawStatus as StatusParam)
          ? (rawStatus as StatusParam)
          : "ongoing",
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

  /**
   * 선택 지역 목록을 통째로 교체한다. 지역이 정확히 1개일 때만 sigungu를 같이 반영, 그 외엔 지운다.
   * 비어 있어도 region 파라미터를 지우지 않고 빈 문자열로 명시적으로 남긴다 - "아직 아무 선택도
   * 안 한 상태"(파라미터 자체가 없음, 관심지역 기본값 적용 대상)와 "사용자가 명시적으로 전체 지역을
   * 골랐음"을 구분하기 위해서다.
   */
  const setRegions = useCallback(
    (codes: string[], sigungu?: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("region", codes.join(","));
          if (codes.length === 1 && sigungu) {
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

  /** 지역 목록에서 하나를 토글로 추가/제거한다(다중 선택 UI용). */
  const toggleRegion = useCallback(
    (code: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const current = (next.get("region") ?? "").split(",").filter(Boolean);
          const updated = current.includes(code)
            ? current.filter((c) => c !== code)
            : [...current, code];

          next.set("region", updated.join(","));
          // 지역이 정확히 1개가 아니게 되면 시/군/구 선택은 더 이상 유효하지 않다.
          if (updated.length !== 1) next.delete("sigungu");
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );

  const clearRegions = useCallback(() => setRegions([]), [setRegions]);

  return {
    filters,
    setQuery: (value: string) => updateParam("q", value),
    setRegions,
    toggleRegion,
    clearRegions,
    setSigungu: (value: string | null) => updateParam("sigungu", value),
    setDate: (value: string | null) => updateParam("date", value),
    // "전체"도 status=all로 명시적으로 남겨서, 파라미터가 아예 없는 "아직 선택 안 함"(기본값
    // "진행중" 적용 대상)과 구분한다.
    setStatus: (value: StatusParam) => updateParam("status", value),
  };
}
