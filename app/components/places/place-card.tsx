import { useState } from "react";
import { ExternalLink, Hotel, Landmark, MapPin, Phone, Utensils } from "lucide-react";
import type { Place, PlaceCategory } from "~/lib/places";
import { PLACE_CATEGORY_LABELS } from "~/lib/places";
import { getRegionByCode } from "~/components/map/region-data";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

const CATEGORY_ICONS: Record<PlaceCategory, typeof Landmark> = {
  attraction: Landmark,
  lodging: Hotel,
  restaurant: Utensils,
};

const CATEGORY_BADGE_VARIANT: Record<PlaceCategory, "solid" | "outline" | "soft"> = {
  attraction: "solid",
  lodging: "outline",
  restaurant: "soft",
};

function naverMapSearchUrl(query: string): string {
  return `https://map.naver.com/v5/search/${encodeURIComponent(query)}`;
}

interface PlaceCardProps {
  place: Place;
  onSelectRegion?: (regionCode: string, sigungu?: string | null) => void;
}

export function PlaceCard({ place, onSelectRegion }: PlaceCardProps) {
  const region = getRegionByCode(place.regionCode);
  const Icon = CATEGORY_ICONS[place.category];
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = place.imageUrl && !imageFailed;

  return (
    <Card className="flex gap-3 p-4 transition-colors duration-300">
      {showImage ? (
        <img
          src={place.imageUrl}
          alt=""
          onError={() => setImageFailed(true)}
          className="h-11 w-11 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-season-secondary text-season-primary">
          <Icon className="h-5 w-5" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-semibold text-season-surface-foreground">{place.name}</h3>
          <Badge variant={CATEGORY_BADGE_VARIANT[place.category]} className="shrink-0">
            {PLACE_CATEGORY_LABELS[place.category]}
          </Badge>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-season-muted">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {region ? (
              <button
                type="button"
                onClick={() => onSelectRegion?.(place.regionCode, place.sigungu)}
                className={cn("truncate", onSelectRegion && "hover:text-season-primary hover:underline")}
              >
                {region.name}
                {place.sigungu ? ` ${place.sigungu}` : ""}
              </button>
            ) : (
              <span className="truncate">{place.address}</span>
            )}
          </span>
          {place.tel && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {place.tel}
            </span>
          )}
        </div>

        <p className="mt-1 truncate text-xs text-season-muted">{place.address}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a
            href={naverMapSearchUrl(place.name)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="optical-center flex items-center gap-1 rounded-full border border-season-border px-2.5 py-1 text-[11px] font-medium text-season-primary hover:bg-season-secondary"
          >
            <ExternalLink className="h-3 w-3" />
            지도
          </a>
        </div>
      </div>
    </Card>
  );
}
