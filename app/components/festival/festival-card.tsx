import { useState } from "react";
import {
  EyeOff,
  Landmark,
  Leaf,
  MapPin,
  Music,
  Palette,
  PartyPopper,
  Sparkles,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import type { Festival, FestivalCategory } from "~/lib/data/festivals.mock";
import { getFestivalStatus, isFestivalNewToday, STATUS_LABELS, type FestivalStatus } from "~/lib/festivals";
import { getRegionByCode } from "~/components/map/region-data";
import type { FestivalPreference } from "~/lib/supabase/types";
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
  onSelectRegion?: (regionCode: string, sigungu?: string | null) => void;
  onOpenDetail?: (festival: Festival) => void;
  /** 로그인한 사용자만 즐겨찾기/관심없음 버튼이 뜬다(비로그인이면 undefined로 안 넘기면 됨) */
  preference?: FestivalPreference | null;
  onTogglePreference?: (festival: Festival, next: FestivalPreference | null) => void;
}

export function FestivalCard({
  festival,
  selected,
  onSelectRegion,
  onOpenDetail,
  preference,
  onTogglePreference,
}: FestivalCardProps) {
  const status = getFestivalStatus(festival);
  const region = getRegionByCode(festival.regionCode);
  const Icon = CATEGORY_ICONS[festival.category];
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = festival.imageUrl && !imageFailed;
  const isNew = isFestivalNewToday(festival);

  return (
    <Card
      role={onOpenDetail ? "button" : undefined}
      tabIndex={onOpenDetail ? 0 : undefined}
      onClick={() => onOpenDetail?.(festival)}
      onKeyDown={(e) => {
        if (onOpenDetail && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpenDetail(festival);
        }
      }}
      className={cn(
        "relative flex gap-3 p-4 transition-colors duration-300",
        onOpenDetail && "cursor-pointer hover:border-season-primary/50",
        selected && "ring-2 ring-season-ring",
        status === "ended" && "opacity-70",
      )}
    >
      {isNew && (
        <span className="absolute left-2 top-2 z-10 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          New
        </span>
      )}

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
          <div className="flex shrink-0 items-center gap-1">
            {onTogglePreference && (
              <>
                <button
                  type="button"
                  aria-label={preference === "favorite" ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                  aria-pressed={preference === "favorite"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePreference(festival, preference === "favorite" ? null : "favorite");
                  }}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
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
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePreference(festival, preference === "not_interested" ? null : "not_interested");
                  }}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
                    preference === "not_interested"
                      ? "text-season-primary"
                      : "text-season-muted hover:text-season-primary",
                  )}
                >
                  <EyeOff className="h-4 w-4" />
                </button>
              </>
            )}
            <Badge variant={STATUS_BADGE_VARIANT[status]} className="shrink-0">
              {STATUS_LABELS[status]}
            </Badge>
          </div>
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
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRegion?.(festival.regionCode, festival.sigungu);
                }}
                className="hover:text-season-primary hover:underline"
              >
                {region.name}
                {festival.sigungu ? ` ${festival.sigungu}` : ""}
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
