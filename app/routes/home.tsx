import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Star } from "lucide-react";
import type { Route } from "./+types/home";
import { AppLayout } from "~/components/layout/app-layout";
import { SearchBar } from "~/components/festival/search-bar";
import { FestivalFilters } from "~/components/festival/festival-filters";
import { FestivalList } from "~/components/festival/festival-list";
import { FestivalDetailModal } from "~/components/festival/festival-detail-modal";
import { InterestRegionTicker } from "~/components/festival/interest-region-ticker";
import { InterestRegionModal } from "~/components/auth/interest-region-modal";
import { RegionMap } from "~/components/map/region-map";
import { Card } from "~/components/ui/card";
import { Tabs, type TabItem } from "~/components/ui/tabs";
import { useFestivalFilters } from "~/hooks/use-festival-filters";
import { useAuth } from "~/hooks/use-auth";
import { getMySubscriberSettings } from "~/lib/subscriber";
import { getMyFestivalPreferences, setFestivalPreference } from "~/lib/festival-preferences";
import type { FestivalPreference } from "~/lib/supabase/types";
import type { Festival } from "~/lib/data/festivals.mock";
import {
  countFestivalsByRegion,
  filterFestivals,
  getFestivalStatus,
  getFestivals,
  getSigunguOptions,
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

type PreferenceFilter = "all" | "favorite" | "not_interested";

const PREFERENCE_FILTER_ITEMS: TabItem<PreferenceFilter>[] = [
  { value: "all", label: "전체" },
  { value: "favorite", label: "즐겨찾기" },
  { value: "not_interested", label: "관심없음" },
];

export default function Home({ loaderData }: Route.ComponentProps) {
  const { filters, setQuery, setRegions, toggleRegion, clearRegions, setSigungu, setDate, setStatus } =
    useFestivalFilters();
  const { user, isAuthAvailable, signInWithKakao } = useAuth();
  const [selectedFestival, setSelectedFestival] = useState<Festival | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [myInterestRegions, setMyInterestRegions] = useState<string[]>([]);
  const [hasInterestRegionsSet, setHasInterestRegionsSet] = useState(false);
  const [preferences, setPreferences] = useState<Record<string, FestivalPreference>>({});
  const [preferenceFilter, setPreferenceFilter] = useState<PreferenceFilter>("all");
  const [interestRegionModalOpen, setInterestRegionModalOpen] = useState(false);

  const allFestivals = loaderData.festivals;

  // 로그인한 사용자의 관심지역/즐겨찾기·관심없음 정보를 불러온다.
  useEffect(() => {
    if (!user) {
      setMyInterestRegions([]);
      setHasInterestRegionsSet(false);
      setPreferences({});
      return;
    }
    getMySubscriberSettings().then((settings) => {
      setMyInterestRegions(settings.regions);
      setHasInterestRegionsSet(settings.regions.length > 0);
    });
    getMyFestivalPreferences().then(setPreferences);
  }, [user]);

  // 메인화면 기본값: region 파라미터가 아예 없으면(=사용자가 아직 지역을 고른 적 없으면)
  // 관심지역이 있는 로그인 사용자는 관심지역을, 그 외(비로그인/관심지역 없음)는 전국을 보여준다.
  // region=(빈 문자열)로 명시적으로 "전체 지역"을 고른 경우는 건드리지 않는다.
  useEffect(() => {
    if (searchParams.get("region") !== null) return;
    if (hasInterestRegionsSet && myInterestRegions.length > 0) {
      setRegions(myInterestRegions);
    }
  }, [hasInterestRegionsSet, myInterestRegions, searchParams, setRegions]);

  // 공유된 링크(?festival=id)로 들어오면 해당 축제 상세를 자동으로 연다.
  useEffect(() => {
    const festivalId = searchParams.get("festival");
    if (!festivalId) return;
    const found = allFestivals.find((f) => f.id === festivalId);
    if (found) setSelectedFestival(found);
  }, [searchParams, allFestivals]);

  // ?openInterestRegion=1로 들어오면(안내 배너 클릭 등) 관심지역 관리 모달을 바로 연다.
  useEffect(() => {
    if (searchParams.get("openInterestRegion") && user) {
      setInterestRegionModalOpen(true);
    }
  }, [searchParams, user]);

  function openFestivalDetail(festival: Festival) {
    setSelectedFestival(festival);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("festival", festival.id);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  function closeFestivalDetail() {
    setSelectedFestival(null);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("festival");
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  function closeInterestRegionModal() {
    setInterestRegionModalOpen(false);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("openInterestRegion");
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
    // 모달에서 저장했을 수 있으니 관심지역을 다시 불러온다.
    if (user) {
      getMySubscriberSettings().then((settings) => {
        setMyInterestRegions(settings.regions);
        setHasInterestRegionsSet(settings.regions.length > 0);
      });
    }
  }

  const handleTogglePreference = useCallback(
    (festival: Festival, next: FestivalPreference | null) => {
      if (!user) return;
      const prevPreferences = preferences;
      setPreferences((current) => {
        const updated = { ...current };
        if (next) updated[festival.id] = next;
        else delete updated[festival.id];
        return updated;
      });
      setFestivalPreference(user.id, festival.id, next).catch(() => {
        setPreferences(prevPreferences); // 실패하면 되돌림
      });
    },
    [user, preferences],
  );

  const ongoingFestivals = useMemo(
    () => allFestivals.filter((f) => getFestivalStatus(f) === "ongoing"),
    [allFestivals],
  );

  // 관심지역이 설정돼 있으면 그 지역들의 진행중 축제만, 아니면 전체 진행중 축제 중
  // 곧 끝나는 순으로 상위 10개를 보여준다("인기" 대체 - 방문자수 데이터가 아직 없음).
  const ongoingForTicker = useMemo(
    () =>
      hasInterestRegionsSet
        ? ongoingFestivals.filter((f) => myInterestRegions.includes(f.regionCode))
        : ongoingFestivals,
    [ongoingFestivals, hasInterestRegionsSet, myInterestRegions],
  );
  const popularOngoingFestivals = useMemo(
    () => [...ongoingForTicker].sort((a, b) => a.endDate.localeCompare(b.endDate)).slice(0, 10),
    [ongoingForTicker],
  );
  const tickerDurationSeconds = Math.max(30, popularOngoingFestivals.length * 5);
  const showInterestRegionPrompt = isAuthAvailable && !hasInterestRegionsSet;

  const filteredFestivals = useMemo(() => {
    const base = filterFestivals(allFestivals, filters);
    if (!user) return base;
    if (preferenceFilter === "favorite") {
      return base.filter((f) => preferences[f.id] === "favorite");
    }
    if (preferenceFilter === "not_interested") {
      return base.filter((f) => preferences[f.id] === "not_interested");
    }
    // "전체"에서는 관심없음으로 표시한 축제는 기본적으로 숨긴다.
    return base.filter((f) => preferences[f.id] !== "not_interested");
  }, [allFestivals, filters, user, preferenceFilter, preferences]);

  const regionCounts = useMemo(
    () => countFestivalsByRegion(filteredFestivals),
    [filteredFestivals],
  );

  const sigunguOptions = useMemo(
    () => getSigunguOptions(allFestivals, filters.regionCodes),
    [allFestivals, filters.regionCodes],
  );

  function handleInterestRegionPromptClick() {
    if (!user) {
      signInWithKakao();
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("openInterestRegion", "1");
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {showInterestRegionPrompt ? (
          <Card className="flex flex-wrap items-center justify-between gap-2 border-season-primary/30 bg-season-primary/5 px-4 py-2.5">
            <span className="flex items-center gap-1.5 text-sm text-season-surface-foreground">
              <Star className="h-4 w-4 shrink-0 text-season-primary" />
              관심지역을 추가하면 그 지역 축제만 골라서 볼 수 있어요.
            </span>
            <a
              href="?openInterestRegion=1"
              onClick={(e) => {
                e.preventDefault();
                handleInterestRegionPromptClick();
              }}
              className="optical-center shrink-0 text-sm font-medium text-season-primary hover:underline"
            >
              {user ? "관심지역을 추가해주세요 →" : "로그인하고 추가하기 →"}
            </a>
          </Card>
        ) : (
          <InterestRegionTicker
            festivals={popularOngoingFestivals}
            durationSeconds={tickerDurationSeconds}
            onSelectFestival={openFestivalDetail}
          />
        )}

        <SearchBar
          query={filters.query}
          onQueryChange={setQuery}
          regionCodes={filters.regionCodes}
          onToggleRegion={toggleRegion}
          onClearRegions={clearRegions}
          myInterestRegions={hasInterestRegionsSet ? myInterestRegions : undefined}
          onApplyInterestRegions={() => setRegions(myInterestRegions)}
          showInterestRegionCta={showInterestRegionPrompt}
          isLoggedIn={!!user}
          onInterestRegionCtaClick={handleInterestRegionPromptClick}
          sigungu={filters.sigungu}
          onSigunguChange={(value) => setSigungu(value)}
          sigunguOptions={sigunguOptions}
          date={filters.date}
          onDateChange={setDate}
        />

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <Card className="flex min-w-0 flex-col gap-3 p-4 lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)]">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-season-surface-foreground">지역별 축제 지도</h2>
              {filters.regionCodes.length > 0 && (
                <button
                  type="button"
                  onClick={clearRegions}
                  className="text-xs text-season-muted hover:text-season-primary"
                >
                  선택 해제
                </button>
              )}
            </div>
            <div className="min-h-[320px] flex-1 lg:min-h-0">
              <RegionMap
                regionCounts={regionCounts}
                selectedRegions={filters.regionCodes}
                onToggleRegion={toggleRegion}
              />
            </div>
            <p className="text-center text-xs text-season-muted">
              지역을 클릭하면 여러 지역을 함께 선택할 수 있어요
            </p>
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <FestivalFilters value={filters.status} onChange={setStatus} />
              {user && (
                <Tabs items={PREFERENCE_FILTER_ITEMS} value={preferenceFilter} onChange={setPreferenceFilter} />
              )}
              <span className="ml-auto shrink-0 text-sm text-season-muted">
                {filteredFestivals.length}건
              </span>
            </div>
            <FestivalList
              festivals={filteredFestivals}
              selectedRegions={filters.regionCodes}
              selectedSigungu={filters.sigungu}
              onSelectRegion={(code, sigungu) => setRegions([code], sigungu)}
              onOpenDetail={openFestivalDetail}
              preferences={user ? preferences : undefined}
              onTogglePreference={user ? handleTogglePreference : undefined}
            />
          </div>
        </div>
      </div>

      <FestivalDetailModal
        festival={selectedFestival}
        onClose={closeFestivalDetail}
        preference={selectedFestival && user ? (preferences[selectedFestival.id] ?? null) : null}
        onTogglePreference={user ? handleTogglePreference : undefined}
      />
      <InterestRegionModal open={interestRegionModalOpen} onClose={closeInterestRegionModal} />
    </AppLayout>
  );
}
