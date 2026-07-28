import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigation, useSearchParams } from "react-router";
import { Hotel, LayoutGrid, Landmark, Loader2, MapPin, Search, Utensils, X } from "lucide-react";
import type { Route } from "./+types/places";
import { AppLayout } from "~/components/layout/app-layout";
import { PlaceCard } from "~/components/places/place-card";
import { PlaceMap } from "~/components/places/place-map";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Tabs, type TabItem } from "~/components/ui/tabs";
import { getRegionByCode } from "~/components/map/region-data";
import { cn } from "~/lib/utils";
import {
  getPlaceSigunguOptions,
  getPlaces,
  filterPlaces,
  searchPlaceLocations,
  sortPlacesByDistance,
  type LocationMatch,
  type PlaceCategory,
  type PlaceFilters,
} from "~/lib/places";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "지역 정보 | 축제 허브" },
    {
      name: "description",
      content: "지역별 관광지, 숙소, 음식점 정보를 한눈에 모아보는 지역 정보 페이지",
    },
  ];
}

// 전체 places는 수천 건이라, URL의 region 파라미터로 그 지역 하나만 서버(Supabase)에
// 쿼리해서 가져온다. region이 바뀌면(setSearchParams) React Router가 이 로더를 다시
// 실행해 자동으로 재조회한다.
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const regionCode = new URL(request.url).searchParams.get("region");
  const places = await getPlaces(regionCode);
  return { places, regionCode };
}

type CategoryFilter = PlaceCategory | "all";

const ALL_SIGUNGU_VALUE = "all";
const LOCATION_SEARCH_DEBOUNCE_MS = 500;

const CATEGORY_ITEMS: TabItem<CategoryFilter>[] = [
  { value: "all", label: "전체", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { value: "attraction", label: "관광지", icon: <Landmark className="h-3.5 w-3.5" /> },
  { value: "lodging", label: "숙소", icon: <Hotel className="h-3.5 w-3.5" /> },
  { value: "restaurant", label: "음식점", icon: <Utensils className="h-3.5 w-3.5" /> },
];

export default function Places({ loaderData }: Route.ComponentProps) {
  const places = loaderData.places;
  const [searchParams, setSearchParams] = useSearchParams();
  const [localQuery, setLocalQuery] = useState(searchParams.get("q") ?? "");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<LocationMatch[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const navigation = useNavigation();
  const isLoadingRegion = navigation.state === "loading";
  const listItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const regionCode = searchParams.get("region");
  const sigungu = searchParams.get("sigungu");
  const category = (searchParams.get("category") as CategoryFilter | null) ?? "all";
  const query = searchParams.get("q") ?? "";
  const refLat = searchParams.get("lat");
  const refLng = searchParams.get("lng");
  const referencePoint = refLat && refLng ? { lat: Number(refLat), lng: Number(refLng) } : null;

  function applyLocation(match: LocationMatch) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("region", match.regionCode);
        if (match.sigungu) next.set("sigungu", match.sigungu);
        else next.delete("sigungu");
        next.set("lat", String(match.latitude));
        next.set("lng", String(match.longitude));
        next.delete("q"); // 이전 지역 안에서 검색하던 이름/주소 검색어는 새 지역엔 안 맞으니 지운다
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
    setLocationQuery("");
    setLocalQuery("");
    setCandidates([]);
    setLocationError(null);
    setSelectedPlaceId(null);
  }

  function resetAll() {
    setSearchParams(new URLSearchParams(), { replace: true, preventScrollReset: true });
    setLocationQuery("");
    setLocalQuery("");
    setCandidates([]);
    setLocationError(null);
  }

  // 검색 버튼 없이, 입력이 잠시 멈추면(디바운스) 자동으로 찾는다 - 매 타이핑마다 API를
  // 부르면 요청 수가 너무 많아지니 일정 시간 입력이 없을 때만 실행한다.
  // 결과는 개수와 상관없이(1개여도) 드롭다운으로 보여주고, 화살표 키/클릭/Enter로
  // 직접 골라야 지역이 바뀐다 - 검색만 했는데 바로 지역이 전환돼버리는 걸 막기 위함.
  useEffect(() => {
    const trimmed = locationQuery.trim();
    if (!trimmed) {
      setCandidates([]);
      setLocationError(null);
      return;
    }

    setLocationSearching(true);
    const timer = setTimeout(async () => {
      setLocationError(null);
      setCandidates([]);
      setHighlightedIndex(0);
      try {
        const matches = await searchPlaceLocations(trimmed);
        if (matches.length === 0) {
          setLocationError(
            "일치하는 위치를 찾지 못했어요. 지역명(예: 구미시)이나 근처 장소명(예: 구미시청)으로 다시 시도해보세요.",
          );
          return;
        }
        setCandidates(matches);
      } finally {
        setLocationSearching(false);
      }
    }, LOCATION_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      setLocationSearching(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationQuery]);

  function handleLocationKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (candidates.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % candidates.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i - 1 + candidates.length) % candidates.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const match = candidates[highlightedIndex] ?? candidates[0];
      if (match) applyLocation(match);
    } else if (e.key === "Escape") {
      setCandidates([]);
    }
  }

  function updateParam(key: string, value: string | null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  const filters: PlaceFilters = useMemo(
    () => ({ category, regionCode, sigungu, query }),
    [category, regionCode, sigungu, query],
  );

  const sigunguOptions = useMemo(() => getPlaceSigunguOptions(places, regionCode), [places, regionCode]);
  const filteredPlaces = useMemo(() => filterPlaces(places, filters), [places, filters]);
  const sortedPlaces = useMemo(
    () => sortPlacesByDistance(filteredPlaces, referencePoint),
    [filteredPlaces, referencePoint],
  );

  const region = regionCode ? getRegionByCode(regionCode) : null;

  function handleSelectPlace(id: string) {
    setSelectedPlaceId(id);
    listItemRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-season-surface-foreground">지역 정보</h1>
          <p className="mt-1 text-sm text-season-muted">
            지역명이나 장소명으로 검색하면 그 지역의 관광지·숙소·음식점을 가까운 순으로 모아볼 수 있어요.
          </p>
        </div>

        {/* 지역을 이미 골랐어도 항상 열려 있어서, 새 검색어를 입력하면 바로 새 지역으로 바뀐다.
            버튼 없이 입력이 멈추면(디바운스) 자동으로 검색해서 아래에 결과/후보를 보여준다. */}
        <Card className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-season-muted" />
            <Input
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              onKeyDown={handleLocationKeyDown}
              placeholder="지역명, 장소명으로 검색 (예: 구미시, 구미시청)"
              className="pl-9 pr-9"
              role="combobox"
              aria-expanded={candidates.length > 0}
              aria-activedescendant={candidates.length > 0 ? `location-candidate-${highlightedIndex}` : undefined}
            />
            {locationSearching && (
              <Loader2 className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-season-muted" />
            )}
          </div>

          {locationError && <p className="mt-2 text-xs text-red-500">{locationError}</p>}

          {/* 결과가 1개여도 바로 지역이 바뀌지 않고 여기 드롭다운으로 뜬다 - 화살표
              위/아래 + Enter로 고르거나 마우스로 클릭해서 선택해야 지역이 적용된다. */}
          {candidates.length > 0 && (
            <div className="mt-3 flex flex-col gap-1 border-t border-season-border pt-3" role="listbox">
              {candidates.length > 1 && (
                <p className="text-xs text-season-muted">
                  같은 이름의 장소가 여러 지역에 있어요. 화살표 키와 Enter로 고르거나 클릭해서 선택하세요.
                </p>
              )}
              {candidates.map((candidate, index) => {
                const candidateRegion = getRegionByCode(candidate.regionCode);
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={`${candidate.regionCode}-${candidate.sigungu}`}
                    id={`location-candidate-${index}`}
                    role="option"
                    aria-selected={isHighlighted}
                    type="button"
                    onClick={() => applyLocation(candidate)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "optical-center flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
                      isHighlighted ? "bg-season-secondary" : "hover:bg-season-secondary",
                    )}
                  >
                    <span className="font-medium text-season-surface-foreground">
                      {candidateRegion?.name}
                      {candidate.sigungu ? ` ${candidate.sigungu}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {regionCode && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-season-border pt-3">
              <span className="flex items-center gap-1.5 text-sm text-season-surface-foreground">
                <MapPin className="h-4 w-4 shrink-0 text-season-primary" />
                {region?.name}
                {sigungu ? ` ${sigungu}` : ""}
              </span>
              <button
                type="button"
                onClick={resetAll}
                className="flex shrink-0 items-center gap-1 text-xs text-season-muted hover:text-season-primary"
              >
                <X className="h-3.5 w-3.5" />
                초기화
              </button>
            </div>
          )}
        </Card>

        {regionCode && (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-season-muted" />
                <Input
                  value={localQuery}
                  onChange={(e) => {
                    setLocalQuery(e.target.value);
                    updateParam("q", e.target.value || null);
                  }}
                  placeholder="이 지역 안에서 이름, 주소로 검색"
                  className="pl-9"
                />
              </div>

              <div className="sm:w-40">
                <Select
                  value={sigungu ?? ALL_SIGUNGU_VALUE}
                  onValueChange={(value) => updateParam("sigungu", value === ALL_SIGUNGU_VALUE ? null : value)}
                  disabled={sigunguOptions.length === 0}
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
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Tabs
                items={CATEGORY_ITEMS}
                value={category}
                onChange={(value) => updateParam("category", value === "all" ? null : value)}
              />
              <span className="ml-auto flex shrink-0 items-center gap-1.5 text-sm text-season-muted">
                {isLoadingRegion && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {sortedPlaces.length}건
              </span>
            </div>

            {sortedPlaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-season-border py-16 text-center text-season-muted">
                <p className="text-sm">조건에 맞는 정보가 없어요. 필터를 조정해보세요.</p>
              </div>
            ) : (
              <div className="grid min-w-0 gap-6 lg:grid-cols-2">
                <Card className="flex min-w-0 flex-col gap-2 p-4 lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)]">
                  <h2 className="text-sm font-semibold text-season-surface-foreground">지도로 보기</h2>
                  <div className="min-h-[280px] flex-1 lg:min-h-0">
                    {referencePoint ? (
                      <PlaceMap
                        centerLat={referencePoint.lat}
                        centerLng={referencePoint.lng}
                        places={sortedPlaces}
                        selectedPlaceId={selectedPlaceId}
                        onSelectPlace={handleSelectPlace}
                        className="h-full w-full"
                      />
                    ) : (
                      <p className="flex h-full items-center justify-center text-center text-xs text-season-muted">
                        검색 위치 좌표가 없어 지도를 표시할 수 없어요.
                      </p>
                    )}
                  </div>
                </Card>

                <div className="flex min-w-0 flex-col gap-3">
                  {sortedPlaces.map((place) => (
                    <div
                      key={place.id}
                      ref={(el) => {
                        listItemRefs.current[place.id] = el;
                      }}
                      onClick={() => setSelectedPlaceId(place.id)}
                      className={
                        place.id === selectedPlaceId ? "rounded-2xl ring-2 ring-season-ring" : "rounded-2xl"
                      }
                    >
                      <PlaceCard place={place} distanceMeters={place.distanceMeters} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
