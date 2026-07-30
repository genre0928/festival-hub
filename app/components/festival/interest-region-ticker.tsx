import { Calendar, MapPin, PlayCircle } from "lucide-react";
import { Marquee } from "~/components/magicui/marquee";
import { Card } from "~/components/ui/card";
import { getRegionByCode } from "~/components/map/region-data";
import { isFestivalNewToday } from "~/lib/festivals";
import type { Festival } from "~/lib/data/festivals.mock";

/** festival.startDate/endDate는 항상 "YYYY-MM-DD"라 문자열만 잘라 "MM/DD~MM/DD"로 표시한다. */
export function formatCompactDateRange(startDate: string, endDate: string): string {
  const toMonthDay = (iso: string) => iso.slice(5).replace("-", "/");
  return `${toMonthDay(startDate)}~${toMonthDay(endDate)}`;
}

interface InterestRegionTickerProps {
  festivals: Festival[];
  durationSeconds: number;
  onSelectFestival: (festival: Festival, originRect: DOMRect) => void;
  /** 카드에서 연 모달이 떠 있는 동안 true로 줘서 슬라이드를 멈춘다(닫을 때 같은 자리로 축소되게). */
  paused?: boolean;
}

export function InterestRegionTicker({
  festivals,
  durationSeconds,
  onSelectFestival,
  paused,
}: InterestRegionTickerProps) {
  if (festivals.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3 px-4 py-3">
      <div className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-season-primary">
        <PlayCircle className="h-4 w-4 shrink-0" />
        관심지역 진행중
      </div>
      <Marquee className="[--gap:2.5rem]" durationSeconds={durationSeconds} paused={paused}>
        {festivals.map((festival) => {
          const region = getRegionByCode(festival.regionCode);
          const address = `${region?.name ?? ""}${festival.sigungu ? ` ${festival.sigungu}` : ""}`;
          const isNew = isFestivalNewToday(festival);
          return (
            <button
              key={festival.id}
              type="button"
              onClick={(e) => onSelectFestival(festival, e.currentTarget.getBoundingClientRect())}
              className="relative w-28 shrink-0 overflow-hidden rounded-2xl border border-season-border bg-season-surface text-left shadow-sm transition-shadow hover:shadow-md sm:w-32"
            >
              {isNew && (
                // 이 카드는 overflow-hidden이라 FestivalCard처럼 바깥으로 뺄 수 없어서,
                // 사진 위 안쪽 모서리에 작게 배지로 얹는다.
                <span className="absolute left-1 top-1 z-10 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
                  New
                </span>
              )}
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
                <p className="mt-0.5 flex items-center gap-0.5 truncate text-[11px] text-season-muted">
                  <Calendar className="h-2.5 w-2.5 shrink-0" />
                  {formatCompactDateRange(festival.startDate, festival.endDate)}
                </p>
              </div>
            </button>
          );
        })}
      </Marquee>
    </Card>
  );
}
