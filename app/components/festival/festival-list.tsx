import { PartyPopper } from "lucide-react";
import type { Festival } from "~/lib/data/festivals.mock";
import { FestivalCard } from "~/components/festival/festival-card";
import { BlurFade } from "~/components/magicui/blur-fade";
import type { FestivalPreference } from "~/lib/supabase/types";

interface FestivalListProps {
  festivals: Festival[];
  selectedRegions: string[];
  selectedSigungu: string | null;
  onSelectRegion: (regionCode: string, sigungu?: string | null) => void;
  onOpenDetail: (festival: Festival) => void;
  preferences?: Record<string, FestivalPreference>;
  onTogglePreference?: (festival: Festival, next: FestivalPreference | null) => void;
}

export function FestivalList({
  festivals,
  selectedRegions,
  selectedSigungu,
  onSelectRegion,
  onOpenDetail,
  preferences,
  onTogglePreference,
}: FestivalListProps) {
  if (festivals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-season-border py-16 text-center text-season-muted">
        <PartyPopper className="h-8 w-8" />
        <p className="text-sm">조건에 맞는 축제가 없어요. 필터를 조정해보세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {festivals.map((festival, i) => (
        <BlurFade key={festival.id} delay={Math.min(i, 8) * 0.03}>
          <FestivalCard
            festival={festival}
            selected={
              selectedRegions.length === 1 &&
              selectedRegions[0] === festival.regionCode &&
              (!selectedSigungu || selectedSigungu === festival.sigungu)
            }
            onSelectRegion={onSelectRegion}
            onOpenDetail={onOpenDetail}
            preference={preferences?.[festival.id] ?? null}
            onTogglePreference={onTogglePreference}
          />
        </BlurFade>
      ))}
    </div>
  );
}
