import { useEffect, useMemo, useState } from "react";
import { useNavigation, useSearchParams } from "react-router";
import { Hotel, LayoutGrid, Landmark, Loader2, MapPin, Search, Utensils, X } from "lucide-react";
import type { Route } from "./+types/places";
import { AppLayout } from "~/components/layout/app-layout";
import { PlaceCard } from "~/components/places/place-card";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Tabs, type TabItem } from "~/components/ui/tabs";
import { getRegionByCode } from "~/components/map/region-data";
import {
  getPlaceSigunguOptions,
  getPlaces,
  filterPlaces,
  searchPlaceLocation,
  sortPlacesByDistance,
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
  const navigation = useNavigation();
  const isLoadingRegion = navigation.state === "loading";

  const regionCode = searchParams.get("region");
  const sigungu = searchParams.get("sigungu");
  const category = (searchParams.get("category") as CategoryFilter | null) ?? "all";
  const query = searchParams.get("q") ?? "";
  const refLat = searchParams.get("lat");
  const refLng = searchParams.get("lng");
  const referencePoint = refLat && refLng ? { lat: Number(refLat), lng: Number(refLng) } : null;

  useEffect(() => {
    setLocalQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

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

  function clearRegion() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of ["region", "sigungu", "lat", "lng", "category", "q"]) next.delete(key);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
    setLocationQuery("");
    setLocationError(null);
  }

  async function handleLocationSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = locationQuery.trim();
    if (!trimmed) return;

    setLocationSearching(true);
    setLocationError(null);
    try {
      const match = await searchPlaceLocation(trimmed);
      if (!match) {
        setLocationError(
          "일치하는 위치를 찾지 못했어요. 지역명(예: 구미시)이나 근처 장소명(예: 구미시청)으로 다시 시도해보세요.",
        );
        return;
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("region", match.regionCode);
          if (match.sigungu) next.set("sigungu", match.sigungu);
          else next.delete("sigungu");
          next.set("lat", String(match.latitude));
          next.set("lng", String(match.longitude));
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    } finally {
      setLocationSearching(false);
    }
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

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-season-surface-foreground">지역 정보</h1>
          <p className="mt-1 text-sm text-season-muted">
            지역명이나 장소명으로 검색하면 그 지역의 관광지·숙소·음식점을 가까운 순으로 모아볼 수 있어요.
          </p>
        </div>

        {!regionCode ? (
          <Card className="p-4">
            <form onSubmit={handleLocationSearch} className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-season-muted" />
                <Input
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="지역명, 장소명으로 검색 (예: 구미시, 구미시청)"
                  className="pl-9"
                />
              </div>
              <Button type="submit" disabled={locationSearching || !locationQuery.trim()}>
                {locationSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "검색"}
              </Button>
            </form>
            {locationError && <p className="mt-2 text-xs text-red-500">{locationError}</p>}
          </Card>
        ) : (
          <Card className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <span className="flex items-center gap-1.5 text-sm text-season-surface-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-season-primary" />
              {region?.name}
              {sigungu ? ` ${sigungu}` : ""}
            </span>
            <button
              type="button"
              onClick={clearRegion}
              className="flex shrink-0 items-center gap-1 text-xs text-season-muted hover:text-season-primary"
            >
              <X className="h-3.5 w-3.5" />
              다른 지역 검색
            </button>
          </Card>
        )}

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
              <div className="flex flex-col gap-3">
                {sortedPlaces.map((place) => (
                  <PlaceCard key={place.id} place={place} distanceMeters={place.distanceMeters} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
