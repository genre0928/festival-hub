import { useMemo, useState } from "react";
import { useNavigation, useSearchParams } from "react-router";
import { Hotel, LayoutGrid, Landmark, Loader2, Search, Utensils } from "lucide-react";
import type { Route } from "./+types/places";
import { AppLayout } from "~/components/layout/app-layout";
import { RegionMap } from "~/components/map/region-map";
import { PlaceCard } from "~/components/places/place-card";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Tabs, type TabItem } from "~/components/ui/tabs";
import { getRegionByCode } from "~/components/map/region-data";
import {
  getPlaceSigunguOptions,
  getPlaces,
  filterPlaces,
  type Place,
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
  const navigation = useNavigation();
  const isLoadingRegion = navigation.state === "loading";

  const regionCode = searchParams.get("region");
  const sigungu = searchParams.get("sigungu");
  const category = (searchParams.get("category") as CategoryFilter | null) ?? "all";
  const query = searchParams.get("q") ?? "";

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

  function selectRegion(code: string | null, nextSigungu?: string | null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (code) next.set("region", code);
        else next.delete("region");
        if (code && nextSigungu) next.set("sigungu", nextSigungu);
        else next.delete("sigungu");
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

  const region = regionCode ? getRegionByCode(regionCode) : null;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-season-surface-foreground">지역 정보</h1>
          <p className="mt-1 text-sm text-season-muted">
            지역을 선택하면 그 지역의 관광지·숙소·음식점 정보를 모아볼 수 있어요.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-season-muted" />
            <Input
              value={localQuery}
              onChange={(e) => {
                setLocalQuery(e.target.value);
                updateParam("q", e.target.value || null);
              }}
              placeholder="이름, 주소로 검색"
              className="pl-9"
            />
          </div>

          <div className="sm:w-40">
            <Select
              value={sigungu ?? ALL_SIGUNGU_VALUE}
              onValueChange={(value) => updateParam("sigungu", value === ALL_SIGUNGU_VALUE ? null : value)}
              disabled={!regionCode || sigunguOptions.length === 0}
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

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <Card className="flex min-w-0 flex-col gap-3 p-4 lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)]">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-season-surface-foreground">
                {region ? `${region.name}${sigungu ? ` ${sigungu}` : ""}` : "지역을 선택해주세요"}
              </h2>
              {regionCode && (
                <button
                  type="button"
                  onClick={() => selectRegion(null)}
                  className="text-xs text-season-muted hover:text-season-primary"
                >
                  선택 해제
                </button>
              )}
            </div>
            <div className="min-h-[320px] flex-1 lg:min-h-0">
              <RegionMap selectedRegion={regionCode} onSelectRegion={(code) => selectRegion(code)} />
            </div>
            <p className="text-center text-xs text-season-muted">지역을 클릭해서 그 지역 정보만 볼 수 있어요</p>
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Tabs
                items={CATEGORY_ITEMS}
                value={category}
                onChange={(value) => updateParam("category", value === "all" ? null : value)}
              />
              <span className="ml-auto flex shrink-0 items-center gap-1.5 text-sm text-season-muted">
                {isLoadingRegion && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {filteredPlaces.length}건
              </span>
            </div>

            {!regionCode ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-season-border py-16 text-center text-season-muted">
                <p className="text-sm">지도에서 지역을 선택하면 정보를 볼 수 있어요.</p>
              </div>
            ) : filteredPlaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-season-border py-16 text-center text-season-muted">
                <p className="text-sm">조건에 맞는 정보가 없어요. 필터를 조정해보세요.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredPlaces.map((place: Place) => (
                  <PlaceCard key={place.id} place={place} onSelectRegion={selectRegion} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
