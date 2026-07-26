import { MapPin, PlayCircle } from "lucide-react";
import { Marquee } from "~/components/magicui/marquee";
import { Card } from "~/components/ui/card";
import { getRegionByCode } from "~/components/map/region-data";
import type { Festival } from "~/lib/data/festivals.mock";

interface InterestRegionTickerProps {
  festivals: Festival[];
  durationSeconds: number;
  onSelectFestival: (festival: Festival) => void;
}

export function InterestRegionTicker({
  festivals,
  durationSeconds,
  onSelectFestival,
}: InterestRegionTickerProps) {
  if (festivals.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3 px-4 py-3">
      <div className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-season-primary">
        <PlayCircle className="h-4 w-4 shrink-0" />
        관심지역 진행중
      </div>
      <Marquee durationSeconds={durationSeconds}>
        {festivals.map((festival) => {
          const region = getRegionByCode(festival.regionCode);
          const address = `${region?.name ?? ""}${festival.sigungu ? ` ${festival.sigungu}` : ""}`;
          return (
            <button
              key={festival.id}
              type="button"
              onClick={() => onSelectFestival(festival)}
              className="w-28 shrink-0 overflow-hidden rounded-2xl border border-season-border bg-season-surface text-left shadow-sm transition-shadow hover:shadow-md sm:w-32"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-season-secondary">
                {festival.imageUrl ? (
                  <img src={festival.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-season-muted">
                    <PlayCircle className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-medium text-season-surface-foreground">
                  {festival.name}
                </p>
                <p className="mt-0.5 flex items-center gap-0.5 truncate text-[11px] text-season-muted">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  {address}
                </p>
              </div>
            </button>
          );
        })}
      </Marquee>
    </Card>
  );
}
