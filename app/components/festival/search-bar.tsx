import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MapPinned, Search, Star, X } from "lucide-react";
import { REGIONS, getRegionByCode } from "~/components/map/region-data";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { DatePicker } from "~/components/ui/date-picker";
import { cn } from "~/lib/utils";

const ALL_SIGUNGU_VALUE = "all";

interface SearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  regionCodes: string[];
  onToggleRegion: (code: string) => void;
  onClearRegions: () => void;
  /** 로그인 + 관심지역 설정이 있을 때만 넘겨주면 "관심지역으로 보기" 버튼이 뜨고, 목록 최상단에 관심지역이 정렬된다 */
  myInterestRegions?: string[];
  onApplyInterestRegions?: () => void;
  /** 관심지역이 없을 때(로그인 전/후 모두) 안내 CTA를 보여줄지 여부 */
  showInterestRegionCta?: boolean;
  isLoggedIn?: boolean;
  onInterestRegionCtaClick?: () => void;
  sigungu: string | null;
  onSigunguChange: (value: string | null) => void;
  sigunguOptions: string[];
  date: string | null;
  onDateChange: (value: string | null) => void;
}

const QUERY_DEBOUNCE_MS = 300;

export function SearchBar({
  query,
  onQueryChange,
  regionCodes,
  onToggleRegion,
  onClearRegions,
  myInterestRegions,
  onApplyInterestRegions,
  showInterestRegionCta,
  isLoggedIn,
  onInterestRegionCtaClick,
  sigungu,
  onSigunguChange,
  sigunguOptions,
  date,
  onDateChange,
}: SearchBarProps) {
  // 검색어는 부모(URL 쿼리 파라미터)로 즉시 반영하지 않고 로컬 state로만 다룬다.
  // 매 입력마다 URL을 갱신하면 리렌더 타이밍에 한글 조합(IME)이 깨져
  // "벚꽃"이 "ㅂㅓㅈㄲㅗㅊ"처럼 분리 입력되는 문제가 생기기 때문.
  const [localQuery, setLocalQuery] = useState(query);
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hasActiveFilters = localQuery || regionCodes.length > 0 || sigungu || date;
  // 지역이 정확히 1개일 때만 시/군/구 선택이 의미가 있다(복수 선택이면 상세지역 검색 불가 - validation).
  const canPickSigungu = regionCodes.length === 1 && sigunguOptions.length > 0;

  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  function handleQueryInput(value: string) {
    setLocalQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onQueryChange(value), QUERY_DEBOUNCE_MS);
  }

  function resetQuery() {
    clearTimeout(debounceRef.current);
    setLocalQuery("");
    onQueryChange("");
  }

  const regionTriggerLabel =
    regionCodes.length === 0
      ? "전체 지역"
      : regionCodes.length === 1
        ? (getRegionByCode(regionCodes[0])?.name ?? "지역 1개")
        : `지역 ${regionCodes.length}개`;

  // 관심지역이 있으면 목록 최상단에 오도록 정렬한다(나머지는 원래 순서 유지).
  const sortedRegions = useMemo(() => {
    if (!myInterestRegions || myInterestRegions.length === 0) return REGIONS;
    const interestSet = new Set(myInterestRegions);
    return [...REGIONS].sort((a, b) => {
      const aInterest = interestSet.has(a.code) ? 0 : 1;
      const bInterest = interestSet.has(b.code) ? 0 : 1;
      return aInterest - bInterest;
    });
  }, [myInterestRegions]);
  const hasInterestRegions = !!myInterestRegions && myInterestRegions.length > 0;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-season-muted" />
        <Input
          value={localQuery}
          onChange={(e) => handleQueryInput(e.target.value)}
          placeholder="축제명, 지역, 태그로 검색"
          className="pl-9"
        />
      </div>

      <Popover open={regionMenuOpen} onOpenChange={setRegionMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="optical-center relative flex h-10 items-center gap-2 rounded-xl border border-season-border bg-season-surface pl-9 pr-3 text-sm text-season-surface-foreground hover:bg-season-secondary sm:w-44"
          >
            <MapPinned className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-season-muted" />
            <span className="truncate">{regionTriggerLabel}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-80 w-56 overflow-y-auto p-1.5">
          {hasInterestRegions && onApplyInterestRegions ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onApplyInterestRegions();
                  setRegionMenuOpen(false);
                }}
                className="optical-center flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-medium text-season-primary hover:bg-season-secondary"
              >
                <Star className="h-4 w-4 shrink-0" />내 관심지역으로 보기
              </button>
              <div className="my-1 border-t border-season-border" />
            </>
          ) : (
            showInterestRegionCta &&
            onInterestRegionCtaClick && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onInterestRegionCtaClick();
                    setRegionMenuOpen(false);
                  }}
                  className="optical-center flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-medium text-season-primary hover:bg-season-secondary"
                >
                  <Star className="h-4 w-4 shrink-0" />
                  {isLoggedIn ? "관심지역 추가하기" : "로그인하고 관심지역 추가하기"}
                </button>
                <div className="my-1 border-t border-season-border" />
              </>
            )
          )}
          <button
            type="button"
            onClick={() => {
              onClearRegions();
              setRegionMenuOpen(false);
            }}
            className={cn(
              "optical-center flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-season-secondary",
              regionCodes.length === 0
                ? "font-medium text-season-primary"
                : "text-season-surface-foreground",
            )}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {regionCodes.length === 0 && <Check className="h-4 w-4" />}
            </span>
            전체 지역
          </button>
          {sortedRegions.map((region, index) => {
            const active = regionCodes.includes(region.code);
            const isInterest = hasInterestRegions && myInterestRegions!.includes(region.code);
            const isFirstNonInterest =
              hasInterestRegions && !isInterest && index > 0 && sortedRegions[index - 1] &&
              myInterestRegions!.includes(sortedRegions[index - 1].code);
            return (
              <div key={region.code}>
                {isFirstNonInterest && <div className="my-1 border-t border-season-border" />}
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggleRegion(region.code)}
                  className={cn(
                    "optical-center flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-season-secondary",
                    active ? "font-medium text-season-primary" : "text-season-surface-foreground",
                  )}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {active && <Check className="h-4 w-4" />}
                  </span>
                  {region.name}
                  {isInterest && <Star className="ml-auto h-3 w-3 shrink-0 text-season-primary" />}
                </button>
              </div>
            );
          })}
        </PopoverContent>
      </Popover>

      {/*
        지역 선택에 따라 이 영역을 통째로 붙였다 뗐다 하면 뒤따르는 날짜/초기화 버튼의
        위치가 매번 바뀌어서, 시간차를 두고 클릭하면 다른 버튼을 누르는 미스클릭이 났다.
        그래서 항상 같은 자리에 렌더링하고, 선택 불가능할 때는 비활성화만 시킨다.
      */}
      <div className="sm:w-36">
        <Select
          value={sigungu ?? ALL_SIGUNGU_VALUE}
          onValueChange={(value) => onSigunguChange(value === ALL_SIGUNGU_VALUE ? null : value)}
          disabled={!canPickSigungu}
        >
          <SelectTrigger>
            <SelectValue placeholder="상세지역" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SIGUNGU_VALUE}>전체 시/군/구</SelectItem>
            {sigunguOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DatePicker value={date} onChange={onDateChange} placeholder="날짜 선택" className="sm:w-44" />

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            resetQuery();
            onClearRegions();
            onSigunguChange(null);
            onDateChange(null);
          }}
        >
          <X className="h-3.5 w-3.5" />
          초기화
        </Button>
      )}
    </div>
  );
}
