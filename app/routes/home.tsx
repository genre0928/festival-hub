import { useMemo } from "react";
import { PlayCircle } from "lucide-react";
import type { Route } from "./+types/home";
import { AppLayout } from "~/components/layout/app-layout";
import { SearchBar } from "~/components/festival/search-bar";
import { FestivalFilters } from "~/components/festival/festival-filters";
import { FestivalList } from "~/components/festival/festival-list";
import { DotMap } from "~/components/map/dot-map";
import { Card } from "~/components/ui/card";
import { Marquee } from "~/components/magicui/marquee";
import { Badge } from "~/components/ui/badge";
import { getRegionByCode } from "~/components/map/region-data";
import { useFestivalFilters } from "~/hooks/use-festival-filters";
import {
  countFestivalsByRegion,
  filterFestivals,
  getFestivalStatus,
  getFestivals,
} from "~/lib/festivals";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "축제 허브 | 국내 축제 정보 모아보기" },
    {
      name: "description",
      content: "전국 축제 정보를 지역과 기간별로 한눈에 모아보는 축제 정보 사이트",
    },
  ];
}

export async function clientLoader() {
  const festivals = await getFestivals();
  return { festivals };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { filters, setQuery, setRegionCode, setDate, setStatus } = useFestivalFilters();

  const allFestivals = loaderData.festivals;

  const ongoingFestivals = useMemo(
    () => allFestivals.filter((f) => getFestivalStatus(f) === "ongoing"),
    [allFestivals],
  );

  const filteredFestivals = useMemo(
    () => filterFestivals(allFestivals, filters),
    [allFestivals, filters],
  );

  const regionCounts = useMemo(
    () => countFestivalsByRegion(filteredFestivals),
    [filteredFestivals],
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {ongoingFestivals.length > 0 && (
          <Card className="flex items-center gap-3 px-4 py-2.5">
            <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-season-primary">
              <PlayCircle className="h-4 w-4" />
              지금 진행중
            </span>
            <Marquee className="flex-1" durationSeconds={22}>
              {ongoingFestivals.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setRegionCode(f.regionCode)}
                  className="shrink-0"
                >
                  <Badge variant="soft">
                    {getRegionByCode(f.regionCode)?.name} · {f.name}
                  </Badge>
                </button>
              ))}
            </Marquee>
          </Card>
        )}

        <SearchBar
          query={filters.query}
          onQueryChange={setQuery}
          regionCode={filters.regionCode}
          onRegionChange={setRegionCode}
          date={filters.date}
          onDateChange={setDate}
        />

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <Card className="flex min-w-0 flex-col gap-3 p-4 lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)]">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-season-surface-foreground">지역별 축제 지도</h2>
              {filters.regionCode && (
                <button
                  type="button"
                  onClick={() => setRegionCode(null)}
                  className="text-xs text-season-muted hover:text-season-primary"
                >
                  선택 해제
                </button>
              )}
            </div>
            <div className="min-h-[320px] flex-1 lg:min-h-0">
              <DotMap
                regionCounts={regionCounts}
                selectedRegion={filters.regionCode}
                onSelectRegion={setRegionCode}
              />
            </div>
            <p className="text-center text-xs text-season-muted">
              도트를 클릭하면 해당 지역의 축제만 볼 수 있어요
            </p>
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <FestivalFilters value={filters.status} onChange={setStatus} />
              <span className="shrink-0 text-sm text-season-muted">
                {filteredFestivals.length}건
              </span>
            </div>
            <FestivalList
              festivals={filteredFestivals}
              selectedRegion={filters.regionCode}
              onSelectRegion={setRegionCode}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
