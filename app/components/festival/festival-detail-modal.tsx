import { useEffect, useState } from "react";
import {
  Hotel,
  Landmark,
  Loader2,
  MapPin,
  Phone,
  Utensils,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import type { Festival } from "~/lib/data/festivals.mock";
import { getFestivalStatus, STATUS_LABELS, type FestivalStatus } from "~/lib/festivals";
import { getRegionByCode } from "~/components/map/region-data";
import { getNearbyInfo, type NearbyInfo, type NearbyPlace } from "~/lib/nearby";
import { formatDateRange, cn } from "~/lib/utils";

const STATUS_BADGE_VARIANT: Record<FestivalStatus, "solid" | "outline" | "soft"> = {
  ongoing: "solid",
  upcoming: "outline",
  ended: "soft",
};

interface FestivalDetailModalProps {
  festival: Festival | null;
  onClose: () => void;
}

export function FestivalDetailModal({ festival, onClose }: FestivalDetailModalProps) {
  const [nearby, setNearby] = useState<NearbyInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!festival || festival.latitude == null || festival.longitude == null) {
      setNearby(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setNearby(null);

    getNearbyInfo(festival.longitude, festival.latitude)
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

  const status = festival ? getFestivalStatus(festival) : null;
  const region = festival ? getRegionByCode(festival.regionCode) : null;
  const hasCoords = festival?.latitude != null && festival?.longitude != null;

  return (
    <Dialog open={!!festival} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-hidden p-0">
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
              <img
                src={festival.imageUrl}
                alt=""
                className="mt-4 h-48 w-full rounded-xl object-cover"
              />
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
            <div className="mt-6 space-y-6 border-t border-season-border pt-5">
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
              ) : nearby ? (
                <>
                  <NearbySection
                    title="같이 가면 좋은 주변 관광지"
                    icon={Landmark}
                    places={nearby.attractions}
                  />
                  <NearbySection title="주변 음식점" icon={Utensils} places={nearby.restaurants} />
                  <NearbySection title="주변 숙소" icon={Hotel} places={nearby.lodgings} />
                </>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NearbySection({
  title,
  icon: Icon,
  places,
}: {
  title: string;
  icon: typeof Landmark;
  places: NearbyPlace[];
}) {
  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-season-surface-foreground">
        <Icon className="h-4 w-4 text-season-primary" />
        {title}
      </h3>

      {places.length === 0 ? (
        <p className="mt-2 text-xs text-season-muted">주변 5km 이내에 정보가 없어요.</p>
      ) : (
        <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
          {places.map((place) => (
            <div
              key={place.contentId}
              className="w-40 shrink-0 rounded-xl border border-season-border bg-season-surface p-2"
            >
              {place.imageUrl ? (
                <img
                  src={place.imageUrl}
                  alt=""
                  className="h-24 w-full rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-24 w-full items-center justify-center rounded-lg bg-season-secondary text-season-muted">
                  <Icon className="h-6 w-6" />
                </div>
              )}
              <p className="mt-1.5 truncate text-xs font-medium text-season-surface-foreground">
                {place.title}
              </p>
              <div className="flex items-center justify-between text-[11px] text-season-muted">
                <span>{place.distanceMeters != null ? `${(place.distanceMeters / 1000).toFixed(1)}km` : ""}</span>
                {place.tel && (
                  <span className={cn("flex items-center gap-0.5 truncate")}>
                    <Phone className="h-2.5 w-2.5 shrink-0" />
                    {place.tel}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
