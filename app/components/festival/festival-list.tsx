import { PartyPopper } from "lucide-react";
import type { Festival } from "~/lib/data/festivals.mock";
import { FestivalCard } from "~/components/festival/festival-card";
import { BlurFade } from "~/components/magicui/blur-fade";

interface FestivalListProps {
  festivals: Festival[];
  selectedRegion: string | null;
  onSelectRegion: (regionCode: string) => void;
  onOpenDetail: (festival: Festival) => void;
}

export function FestivalList({ festivals, selectedRegion, onSelectRegion, onOpenDetail }: FestivalListProps) {
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
            selected={selectedRegion === festival.regionCode}
            onSelectRegion={onSelectRegion}
            onOpenDetail={onOpenDetail}
          />
        </BlurFade>
      ))}
    </div>
  );
}
