import { useState } from "react";
import {
  Landmark,
  Leaf,
  MapPin,
  Music,
  Palette,
  PartyPopper,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import type { Festival, FestivalCategory } from "~/lib/data/festivals.mock";
import { getFestivalStatus, STATUS_LABELS, type FestivalStatus } from "~/lib/festivals";
import { getRegionByCode } from "~/components/map/region-data";
import { formatDateRange, cn } from "~/lib/utils";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

const CATEGORY_ICONS: Record<FestivalCategory, typeof Landmark> = {
  전통: Landmark,
  음악: Music,
  음식: UtensilsCrossed,
  자연: Leaf,
  불꽃: Sparkles,
  예술: Palette,
  기타: PartyPopper,
};

const STATUS_BADGE_VARIANT: Record<FestivalStatus, "solid" | "outline" | "soft"> = {
  ongoing: "solid",
  upcoming: "outline",
  ended: "soft",
};

interface FestivalCardProps {
  festival: Festival;
  selected?: boolean;
  onSelectRegion?: (regionCode: string) => void;
}

export function FestivalCard({ festival, selected, onSelectRegion }: FestivalCardProps) {
  const status = getFestivalStatus(festival);
  const region = getRegionByCode(festival.regionCode);
  const Icon = CATEGORY_ICONS[festival.category];
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = festival.imageUrl && !imageFailed;

  return (
    <Card
      className={cn(
        "flex gap-3 p-4 transition-colors duration-300",
        selected && "ring-2 ring-season-ring",
        status === "ended" && "opacity-70",
      )}
    >
      {showImage ? (
        <img
          src={festival.imageUrl}
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
          <h3 className="truncate font-semibold text-season-surface-foreground">
            {festival.name}
          </h3>
          <Badge variant={STATUS_BADGE_VARIANT[status]} className="shrink-0">
            {STATUS_LABELS[status]}
          </Badge>
        </div>

        {festival.description && (
          <p className="mt-1 line-clamp-2 text-sm text-season-muted">{festival.description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-season-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {region ? (
              <button
                type="button"
                onClick={() => onSelectRegion?.(festival.regionCode)}
                className="hover:text-season-primary hover:underline"
              >
                {region.name}
              </button>
            ) : (
              festival.address
            )}
          </span>
          <span>{formatDateRange(festival.startDate, festival.endDate)}</span>
        </div>

        {festival.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {festival.tags.map((tag) => (
              <Badge key={tag} variant="soft" className="text-[11px]">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
