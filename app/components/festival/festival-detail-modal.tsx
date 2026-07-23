import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Hotel,
  LayoutGrid,
  Landmark,
  Loader2,
  MapPin,
  Phone,
  Utensils,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Tabs, type TabItem } from "~/components/ui/tabs";
import { NearbyMap } from "~/components/festival/nearby-map";
import type { Festival } from "~/lib/data/festivals.mock";
import { getFestivalStatus, STATUS_LABELS, type FestivalStatus } from "~/lib/festivals";
import { getRegionByCode } from "~/components/map/region-data";
import {
  flattenNearbyInfo,
  getNearbyInfo,
  type NearbyCategory,
  type NearbyInfo,
  type NearbyPlaceWithCategory,
} from "~/lib/nearby";
import { formatDateRange, cn } from "~/lib/utils";

const STATUS_BADGE_VARIANT: Record<FestivalStatus, "solid" | "outline" | "soft"> = {
  ongoing: "solid",
  upcoming: "outline",
  ended: "soft",
};

const CATEGORY_ICONS: Record<NearbyCategory, typeof Landmark> = {
  attraction: Landmark,
  restaurant: Utensils,
  lodging: Hotel,
};

const CATEGORY_LABELS: Record<NearbyCategory, string> = {
  attraction: "관광지",
  restaurant: "음식점",
  lodging: "숙소",
};

const DEFAULT_RADIUS_METERS = 5000;

type CategoryFilter = "all" | NearbyCategory;

const FILTER_ITEMS: TabItem<CategoryFilter>[] = [
  { value: "all", label: "전체", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { value: "attraction", label: "관광지", icon: <Landmark className="h-3.5 w-3.5" /> },
  { value: "restaurant", label: "음식점", icon: <Utensils className="h-3.5 w-3.5" /> },
  { value: "lodging", label: "숙소", icon: <Hotel className="h-3.5 w-3.5" /> },
];

interface FestivalDetailModalProps {
  festival: Festival | null;
  onClose: () => void;
}

export function FestivalDetailModal({ festival, onClose }: FestivalDetailModalProps) {
  const [nearby, setNearby] = useState<NearbyInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const listItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setCategoryFilter("all");
    setSelectedPlaceId(null);

    if (!festival || festival.latitude == null || festival.longitude == null) {
      setNearby(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setNearby(null);

    const region = getRegionByCode(festival.regionCode);
    const regionQuery = [region?.name, festival.sigungu].filter(Boolean).join(" ");

    getNearbyInfo(festival.longitude, festival.latitude, regionQuery)
      .then((data) => {
        if (!cancelled) setNearby(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "주변 정보를 불러오지 못했어요.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [festival]);

  const allPlaces = useMemo(() => (nearby ? flattenNearbyInfo(nearby) : []), [nearby]);
  const filteredPlaces = useMemo(
    () => (categoryFilter === "all" ? allPlaces : allPlaces.filter((p) => p.category === categoryFilter)),
    [allPlaces, categoryFilter],
  );

  const expandedRadiusNotes = useMemo(() => {
    if (!nearby) return [];
    return (Object.entries(nearby) as [keyof NearbyInfo, NearbyInfo[keyof NearbyInfo]][])
      .filter(([, result]) => result.radiusMeters > DEFAULT_RADIUS_METERS && result.places.length > 0)
      .map(([key, result]) => {
        const category: NearbyCategory =
          key === "attractions" ? "attraction" : key === "restaurants" ? "restaurant" : "lodging";
        return `${CATEGORY_LABELS[category]}은 주변에 적어 반경 ${(result.radiusMeters / 1000).toFixed(0)}km까지 찾았어요`;
      });
  }, [nearby]);

  function handleSelectPlace(contentId: string) {
    setSelectedPlaceId(contentId);
    listItemRefs.current[contentId]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const status = festival ? getFestivalStatus(festival) : null;
  const region = festival ? getRegionByCode(festival.regionCode) : null;
  const hasCoords = festival?.latitude != null && festival?.longitude != null;

  return (
    <Dialog open={!!festival} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
        {festival && (
          <div className="max-h-[85vh] overflow-y-auto p-6">
            <DialogTitle className="pr-8 text-lg font-bold text-season-surface-foreground">
              {festival.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {festival.name} 축제 상세 정보 및 주변 관광지·음식점·숙소 정보
            </DialogDescription>

            {/* 상단: 행사 상세 정보 */}
            {festival.imageUrl && (
              <div className="mt-4 w-full overflow-hidden rounded-xl bg-season-secondary">
                <img
                  src={festival.imageUrl}
                  alt=""
                  className="max-h-64 w-full object-contain"
                />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {status && (
                <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
              )}
              <Badge variant="soft">{festival.category}</Badge>
            </div>

            {festival.description && (
              <p className="mt-3 text-sm text-season-muted">{festival.description}</p>
            )}

            <div className="mt-4 space-y-1.5 text-sm">
              <p className="flex items-start gap-1.5 text-season-surface-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-season-muted" />
                {region && !festival.address.startsWith(region.name) ? `${region.name} ` : ""}
                {festival.address}
              </p>
              <p className="text-season-muted">{formatDateRange(festival.startDate, festival.endDate)}</p>
            </div>

            {festival.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {festival.tags.map((tag) => (
                  <Badge key={tag} variant="soft" className="text-[11px]">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* 하단: 주변 정보 */}
            <div className="mt-6 border-t border-season-border pt-5">
              {!hasCoords ? (
                <p className="py-4 text-center text-sm text-season-muted">
                  이 축제는 좌표 정보가 없어 주변 정보를 보여드릴 수 없어요.
                </p>
              ) : loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-season-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  주변 정보를 불러오는 중...
                </div>
              ) : error ? (
                <p className="py-4 text-center text-sm text-season-muted">{error}</p>
              ) : nearby && festival.latitude != null && festival.longitude != null ? (
                allPlaces.length === 0 ? (
                  <p className="py-4 text-center text-sm text-season-muted">
                    주변 20km 이내에서 관광지·음식점·숙소 정보를 찾지 못했어요.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-semibold text-season-surface-foreground">주변 정보</h3>
                      <Tabs
                        items={FILTER_ITEMS}
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        className="w-full sm:w-auto"
                      />
                    </div>

                    {expandedRadiusNotes.length > 0 && (
                      <p className="mt-2 text-[11px] text-season-muted">{expandedRadiusNotes.join(" · ")}</p>
                    )}

                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <NearbyMap
                        festivalLat={festival.latitude}
                        festivalLng={festival.longitude}
                        places={filteredPlaces}
                        selectedPlaceId={selectedPlaceId}
                        onSelectPlace={handleSelectPlace}
                        className="aspect-square w-full"
                      />

                      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1 sm:max-h-none">
                        {filteredPlaces.length === 0 ? (
                          <p className="py-6 text-center text-xs text-season-muted">
                            이 카테고리에는 주변 정보가 없어요.
                          </p>
                        ) : (
                          filteredPlaces.map((place) => (
                            <NearbyListItem
                              key={place.contentId}
                              place={place}
                              selected={place.contentId === selectedPlaceId}
                              onSelect={() => handleSelectPlace(place.contentId)}
                              itemRef={(el) => {
                                listItemRefs.current[place.contentId] = el;
                              }}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NearbyListItem({
  place,
  selected,
  onSelect,
  itemRef,
}: {
  place: NearbyPlaceWithCategory;
  selected: boolean;
  onSelect: () => void;
  itemRef: (el: HTMLDivElement | null) => void;
}) {
  const Icon = CATEGORY_ICONS[place.category];

  return (
    <div
      ref={itemRef}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border border-season-border bg-season-surface p-2 transition-colors",
        selected && "ring-2 ring-season-ring",
      )}
    >
      {place.imageUrl ? (
        <img src={place.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-season-secondary text-season-muted">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[11px] text-season-muted">
          <Icon className="h-3 w-3 shrink-0" />
          {CATEGORY_LABELS[place.category]}
        </div>
        <p className="truncate text-sm font-medium text-season-surface-foreground">{place.title}</p>
        <div className="flex items-center gap-2 text-[11px] text-season-muted">
          {place.distanceMeters != null && <span>{(place.distanceMeters / 1000).toFixed(1)}km</span>}
          {place.tel && (
            <span className="flex min-w-0 items-center gap-0.5 truncate">
              <Phone className="h-2.5 w-2.5 shrink-0" />
              {place.tel}
            </span>
          )}
        </div>
      </div>
      {place.link && (
        <a
          href={place.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex shrink-0 items-center gap-1 rounded-full border border-season-border px-2 py-1 text-[11px] font-medium text-season-primary hover:bg-season-secondary"
        >
          <ExternalLink className="h-3 w-3" />
          네이버
        </a>
      )}
    </div>
  );
}
