import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  Check,
  EyeOff,
  ExternalLink,
  Hotel,
  LayoutGrid,
  Landmark,
  Link as LinkIcon,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  Star,
  Utensils,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { type TabItem } from "~/components/ui/tabs";
import { NearbyMap } from "~/components/festival/nearby-map";
import type { Festival } from "~/lib/data/festivals.mock";
import { getFestivalStatus, isFestivalNewToday, STATUS_LABELS, type FestivalStatus } from "~/lib/festivals";
import { getRegionByCode } from "~/components/map/region-data";
import { shareFestivalToKakao } from "~/lib/kakao-share";
import type { FestivalPreference } from "~/lib/supabase/types";
import {
  flattenNearbyInfo,
  getNearbyInfo,
  type NearbyCategory,
  type NearbyInfo,
  type NearbyPlaceWithCategory,
} from "~/lib/nearby";
import { formatDateRange, parseIsoDate, cn } from "~/lib/utils";

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

function naverSearchUrl(query: string): string {
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
}

/** 네이버 지도 길찾기 - 행사 위치를 출발지, 주변 장소를 도착지로 하는 경로 링크. v5 경로는 WGS84 경위도(lng,lat)를 그대로 받는다. */
function naverDirectionsUrl(params: {
  fromLat: number;
  fromLng: number;
  fromName: string;
  toLat: number;
  toLng: number;
  toName: string;
}): string {
  const from = `${params.fromLng},${params.fromLat},${encodeURIComponent(params.fromName)}`;
  const to = `${params.toLng},${params.toLat},${encodeURIComponent(params.toName)}`;
  return `https://map.naver.com/v5/directions/${from}/${to}/-/car`;
}

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
  preference?: FestivalPreference | null;
  onTogglePreference?: (festival: Festival, next: FestivalPreference | null) => void;
  /** 이 위치/크기에서 카드가 확장되는 것처럼 열리는 애니메이션을 재생한다(없으면 중앙에서 확대). */
  originRect?: DOMRect | null;
}

export function FestivalDetailModal({
  festival,
  onClose,
  preference,
  onTogglePreference,
  originRect,
}: FestivalDetailModalProps) {
  const [nearby, setNearby] = useState<NearbyInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [flipStyle, setFlipStyle] = useState<Record<string, string> | undefined>(undefined);

  // 카드→모달 확장 애니메이션에 쓸 변수를 계산한다. 닫힐 때(festival이 null이 됨)는 손대지
  // 않고 그대로 둬서, 축소 애니메이션이 같은 위치로 되돌아갈 수 있게 한다.
  useLayoutEffect(() => {
    if (!festival) return;
    if (!originRect || !contentRef.current) {
      setFlipStyle(undefined);
      return;
    }
    const finalRect = contentRef.current.getBoundingClientRect();
    const dx = originRect.left + originRect.width / 2 - (finalRect.left + finalRect.width / 2);
    const dy = originRect.top + originRect.height / 2 - (finalRect.top + finalRect.height / 2);
    const sx = originRect.width / finalRect.width;
    const sy = originRect.height / finalRect.height;
    setFlipStyle({
      "--flip-dx": `${dx}px`,
      "--flip-dy": `${dy}px`,
      "--flip-sx": `${sx}`,
      "--flip-sy": `${sy}`,
    });
  }, [festival, originRect]);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [kakaoShareError, setKakaoShareError] = useState<string | null>(null);
  const listItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setCategoryFilter("all");
    setSelectedPlaceId(null);
    setShareCopied(false);
    setKakaoShareError(null);

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

  async function handleCopyLink() {
    if (!festival) return;
    const shareUrl = `${window.location.origin}/?festival=${festival.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setShareMenuOpen(false);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // 클립보드 접근이 막힌 환경 - 조용히 무시
    }
  }

  async function handleKakaoShare() {
    if (!festival) return;
    setKakaoShareError(null);
    const region = getRegionByCode(festival.regionCode);
    const regionText = `${region?.name ?? ""}${festival.sigungu ? ` ${festival.sigungu}` : ""}`;

    try {
      await shareFestivalToKakao({
        title: festival.name,
        region: regionText,
        naverUrl: naverSearchUrl(festival.name),
        shareUrl: `${window.location.origin}/?festival=${festival.id}`,
        imageUrl: festival.imageUrl,
      });
      setShareMenuOpen(false);
    } catch (err) {
      setKakaoShareError(err instanceof Error ? err.message : "카카오톡 공유에 실패했어요.");
    }
  }

  const status = festival ? getFestivalStatus(festival) : null;
  const region = festival ? getRegionByCode(festival.regionCode) : null;
  // festival.latitude/longitude를 .map() 콜백 안에서 다시 접근하면 TS가 narrowing을 못
  // 지켜줘서(클로저 경계를 넘으면 좁혀진 타입이 유지 안 됨) 여기서 로컬 상수로 뽑아둔다.
  const festivalCoords =
    festival && festival.latitude != null && festival.longitude != null
      ? { lat: festival.latitude, lng: festival.longitude }
      : null;
  const hasCoords = festivalCoords != null;

  return (
    <Dialog open={!!festival} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        ref={contentRef}
        style={flipStyle as React.CSSProperties | undefined}
        animationClassName={
          flipStyle
            ? "data-[state=open]:animate-flip-in data-[state=closed]:animate-flip-out"
            : undefined
        }
        className="max-h-[85vh] max-w-3xl overflow-hidden p-0"
      >
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

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {isFestivalNewToday(festival) && (
                  <Badge className="bg-rose-500 text-white">New</Badge>
                )}
                {status && (
                  <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
                )}
                <Badge variant="soft">{festival.category}</Badge>
                {onTogglePreference && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={preference === "favorite" ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                      aria-pressed={preference === "favorite"}
                      onClick={() => onTogglePreference(festival, preference === "favorite" ? null : "favorite")}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                        preference === "favorite"
                          ? "text-amber-500"
                          : "text-season-muted hover:text-amber-500",
                      )}
                    >
                      <Star className="h-4 w-4" fill={preference === "favorite" ? "currentColor" : "none"} />
                    </button>
                    <button
                      type="button"
                      aria-label={preference === "not_interested" ? "관심없음 해제" : "관심없음으로 표시"}
                      aria-pressed={preference === "not_interested"}
                      onClick={() =>
                        onTogglePreference(festival, preference === "not_interested" ? null : "not_interested")
                      }
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                        preference === "not_interested"
                          ? "text-season-primary"
                          : "text-season-muted hover:text-season-primary",
                      )}
                    >
                      <EyeOff className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={naverSearchUrl(festival.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="optical-center flex items-center gap-1.5 rounded-full border border-season-border px-3 py-1.5 text-xs font-medium text-season-surface-foreground hover:bg-season-secondary"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  네이버
                </a>

                <Popover open={shareMenuOpen} onOpenChange={setShareMenuOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="optical-center flex items-center gap-1.5 rounded-full border border-season-border px-3 py-1.5 text-xs font-medium text-season-surface-foreground hover:bg-season-secondary"
                    >
                      {shareCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          링크 복사됨
                        </>
                      ) : (
                        <>
                          <Share2 className="h-3.5 w-3.5" />
                          공유하기
                        </>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-max min-w-[13rem] p-1.5">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="optical-center flex w-full items-center gap-2 whitespace-nowrap rounded-xl px-2 py-2 text-left text-sm text-season-surface-foreground hover:bg-season-secondary"
                    >
                      <LinkIcon className="h-4 w-4 shrink-0 text-season-muted" />
                      링크 복사하기
                    </button>
                    <button
                      type="button"
                      onClick={handleKakaoShare}
                      className="optical-center flex w-full items-center gap-2 whitespace-nowrap rounded-xl px-2 py-2 text-left text-sm text-season-surface-foreground hover:bg-season-secondary"
                    >
                      <MessageCircle className="h-4 w-4 shrink-0 text-season-muted" />
                      카카오톡 친구에게 보내기
                    </button>
                    {kakaoShareError && (
                      <p className="mt-1 px-2 text-[11px] text-season-muted">{kakaoShareError}</p>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {festival.description && (
              <p className="mt-3 text-sm text-season-muted">{festival.description}</p>
            )}

            <div className="mt-4 space-y-1.5 text-sm">
              <p className="flex items-start gap-1.5 text-season-surface-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-season-muted" />
                <span>
                  {region && !festival.address.startsWith(region.name) ? `${region.name} ` : ""}
                  {festival.address}
                </span>
              </p>
              {/*
                주소가 길면 여러 줄로 줄바꿈되는데, 링크를 주소와 한 줄에 나란히 두면(flex
                items-center) 줄바꿈된 주소 블록 한가운데에 링크가 떠 있는 것처럼 보였다.
                주소 길이와 무관하게 항상 깔끔하도록 링크를 아예 별도 줄로 빼고, 아이콘 폭만큼
                들여써서 주소 텍스트와 같은 시작선에 맞춘다.
              */}
              {region && (
                <Link
                  to={`/places?region=${region.code}${festival.sigungu ? `&sigungu=${encodeURIComponent(festival.sigungu)}` : ""}${festivalCoords ? `&lat=${festivalCoords.lat}&lng=${festivalCoords.lng}` : ""}`}
                  onClick={(e) => e.stopPropagation()}
                  className="ml-[22px] inline-block text-xs font-medium text-season-primary hover:underline"
                >
                  이 지역 정보 보기 →
                </Link>
              )}
              <p className="text-season-muted">{formatDateRange(festival.startDate, festival.endDate)}</p>
            </div>

            {/* 진행 기간을 달력으로 - 오늘이 속한 달과 다음 달까지만 보여준다(그 이후는 표시 안 함).
                모바일은 2개월 달력이 들어갈 폭이 부족해 기존처럼 텍스트만 보여주고, 데스크탑(sm+)에서만 표시한다. */}
            <div className="mt-3 hidden justify-center overflow-x-auto rounded-2xl border border-season-border bg-season-surface p-2 pointer-events-none sm:flex">
              <Calendar
                mode="range"
                numberOfMonths={2}
                defaultMonth={new Date()}
                disableNavigation
                selected={{
                  from: parseIsoDate(festival.startDate),
                  to: parseIsoDate(festival.endDate),
                }}
              />
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
              ) : nearby && festivalCoords ? (
                allPlaces.length === 0 ? (
                  <p className="py-4 text-center text-sm text-season-muted">
                    주변 20km 이내에서 관광지·음식점·숙소 정보를 찾지 못했어요.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-semibold text-season-surface-foreground">주변 정보</h3>
                      {/*
                        모바일에서는 4개 항목이 pill 그룹 하나에 다 안 들어가 줄바꿈되면서
                        줄마다 시작 위치가 어긋나 보였다. 2x2 grid로 셀 너비를 맞춰 정렬을
                        고정하고, 화면이 넓어지면(sm+) 한 줄 pill 그룹으로 되돌린다.
                      */}
                      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:gap-1">
                        {FILTER_ITEMS.map((item) => {
                          const active = item.value === categoryFilter;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setCategoryFilter(item.value)}
                              className={cn(
                                "optical-center flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                active
                                  ? "border-season-primary bg-season-primary text-season-primary-foreground"
                                  : "border-season-border bg-season-surface text-season-surface-foreground hover:bg-season-secondary",
                              )}
                            >
                              {item.icon}
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {expandedRadiusNotes.length > 0 && (
                      <p className="mt-2 text-[11px] text-season-muted">{expandedRadiusNotes.join(" · ")}</p>
                    )}

                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <NearbyMap
                        festivalLat={festivalCoords.lat}
                        festivalLng={festivalCoords.lng}
                        places={filteredPlaces}
                        selectedPlaceId={selectedPlaceId}
                        onSelectPlace={handleSelectPlace}
                        className="aspect-square w-full"
                      />

                      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto p-1 sm:max-h-none">
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
                              directionsUrl={
                                place.latitude != null && place.longitude != null
                                  ? naverDirectionsUrl({
                                      fromLat: festivalCoords.lat,
                                      fromLng: festivalCoords.lng,
                                      fromName: festival.name,
                                      toLat: place.latitude,
                                      toLng: place.longitude,
                                      toName: place.title,
                                    })
                                  : null
                              }
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
  directionsUrl,
}: {
  place: NearbyPlaceWithCategory;
  selected: boolean;
  onSelect: () => void;
  itemRef: (el: HTMLDivElement | null) => void;
  directionsUrl: string | null;
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
      <div className="flex shrink-0 flex-col gap-1">
        {place.link && (
          <a
            href={place.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 rounded-full border border-season-border px-2 py-1 text-[11px] font-medium text-season-primary hover:bg-season-secondary"
          >
            <ExternalLink className="h-3 w-3" />
            지도
          </a>
        )}
        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 rounded-full border border-season-border px-2 py-1 text-[11px] font-medium text-season-surface-foreground hover:bg-season-secondary"
          >
            <Navigation className="h-3 w-3" />
            길찾기
          </a>
        )}
      </div>
    </div>
  );
}
